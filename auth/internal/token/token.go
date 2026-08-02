// Package token mints and validates Ed25519-signed JWTs.
package token

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
)

const (
	algorithm       = "EdDSA"
	tokenType       = "JWT"
	maxTokenLength  = 16 * 1024
	maxHeaderLength = 1024
	maxClaimsLength = 8 * 1024
)

// ErrInvalid identifies JWT failures that are safe to report as inactive
// credentials rather than an authentication infrastructure outage.
var ErrInvalid = errors.New("invalid JWT")

type invalidError struct {
	cause error
}

func (e *invalidError) Error() string {
	return e.cause.Error()
}

func (e *invalidError) Unwrap() error {
	return e.cause
}

func (e *invalidError) Is(target error) bool {
	return target == ErrInvalid
}

type dependencyError struct {
	cause error
}

func (e *dependencyError) Error() string {
	return e.cause.Error()
}

func (e *dependencyError) Unwrap() error {
	return e.cause
}

// IsInvalid reports whether validation failed because the JWT itself is
// invalid or expired, as opposed to a verification dependency outage.
func IsInvalid(err error) bool {
	return errors.Is(err, ErrInvalid)
}

// Signer signs a JWS signing input and returns a Vault Transit signature.
type Signer interface {
	Sign(context.Context, string, []byte) (string, error)
}

// PublicKeyProvider obtains the active Transit signing key identifier and
// public verification keys.
type PublicKeyProvider interface {
	SigningKeyID(context.Context) (string, error)
	PublicKey(context.Context, string) (ed25519.PublicKey, bool, error)
}

// Config contains the token properties controlled by the issuing service.
type Config struct {
	Issuer   string
	Audience string
	Leeway   time.Duration
	Clock    func() time.Time
}

// MintRequest contains the identity and authentication context of a new token.
type MintRequest struct {
	Subject              string
	SessionID            string
	TokenID              string
	AuthenticationMethod string
	AssuranceLevel       string
	GlobalRoles          []string
	AuthenticationTime   time.Time
	Lifetime             time.Duration
}

// Claims are the verified JWT claims. KeyID is read from the protected header.
type Claims struct {
	Issuer               string
	Audience             string
	Subject              string
	SessionID            string
	TokenID              string
	IssuedAt             time.Time
	ExpiresAt            time.Time
	AuthenticationTime   time.Time
	AuthenticationMethod string
	AssuranceLevel       string
	GlobalRoles          []string
	KeyID                string
}

// Service mints and validates compact EdDSA JWTs.
type Service struct {
	config   Config
	signer   Signer
	provider PublicKeyProvider
}

// NewService creates a JWT service with the supplied signing and verification
// dependencies.
func NewService(config Config, signer Signer, provider PublicKeyProvider) (*Service, error) {
	if config.Issuer == "" || config.Audience == "" {
		return nil, errors.New("token issuer and audience are required")
	}
	if config.Leeway < 0 {
		return nil, errors.New("token leeway cannot be negative")
	}
	if signer == nil || provider == nil {
		return nil, errors.New("token signer and public key provider are required")
	}
	if config.Clock == nil {
		config.Clock = time.Now
	}
	return &Service{config: config, signer: signer, provider: provider}, nil
}

// Mint creates a compact JWT with the configured issuer, audience, and key ID.
func (s *Service) Mint(ctx context.Context, request MintRequest) (string, error) {
	if err := validateMintRequest(request); err != nil {
		return "", err
	}

	tokenID := request.TokenID
	if tokenID == "" {
		var err error
		tokenID, err = newTokenID()
		if err != nil {
			return "", err
		}
	}

	issuedAt := s.config.Clock().UTC().Truncate(time.Second)
	keyID, err := s.provider.SigningKeyID(ctx)
	if err != nil {
		return "", fmt.Errorf("resolve active signing key: %w", err)
	}
	if !validKeyID(keyID) {
		return "", errors.New("active signing key ID is invalid")
	}

	claims := Claims{
		Issuer:               s.config.Issuer,
		Audience:             s.config.Audience,
		Subject:              request.Subject,
		SessionID:            request.SessionID,
		TokenID:              tokenID,
		IssuedAt:             issuedAt,
		ExpiresAt:            issuedAt.Add(request.Lifetime),
		AuthenticationTime:   request.AuthenticationTime.UTC().Truncate(time.Second),
		AuthenticationMethod: request.AuthenticationMethod,
		AssuranceLevel:       request.AssuranceLevel,
		GlobalRoles:          append([]string(nil), request.GlobalRoles...),
		KeyID:                keyID,
	}
	if claims.AuthenticationTime.After(issuedAt) {
		return "", errors.New("token authentication time cannot be after issuance")
	}

	header, err := json.Marshal(struct {
		Algorithm string `json:"alg"`
		Type      string `json:"typ"`
		KeyID     string `json:"kid"`
	}{algorithm, tokenType, keyID})
	if err != nil {
		return "", fmt.Errorf("encode token header: %w", err)
	}
	payload, err := json.Marshal(struct {
		Issuer               string   `json:"iss"`
		Audience             string   `json:"aud"`
		Subject              string   `json:"sub"`
		SessionID            string   `json:"sid"`
		TokenID              string   `json:"jti"`
		IssuedAt             int64    `json:"iat"`
		ExpiresAt            int64    `json:"exp"`
		AuthenticationTime   int64    `json:"auth_time"`
		AuthenticationMethod string   `json:"amr"`
		AssuranceLevel       string   `json:"acr"`
		GlobalRoles          []string `json:"global_roles"`
	}{
		claims.Issuer, claims.Audience, claims.Subject, claims.SessionID,
		claims.TokenID, claims.IssuedAt.Unix(), claims.ExpiresAt.Unix(),
		claims.AuthenticationTime.Unix(), claims.AuthenticationMethod,
		claims.AssuranceLevel, claims.GlobalRoles,
	})
	if err != nil {
		return "", fmt.Errorf("encode token claims: %w", err)
	}

	signingInput := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	transitSignature, err := s.signer.Sign(ctx, keyID, []byte(signingInput))
	if err != nil {
		return "", fmt.Errorf("sign token: %w", err)
	}
	signature, err := ParseTransitSignature(transitSignature)
	if err != nil {
		return "", fmt.Errorf("parse signer response: %w", err)
	}
	if transitKeyID(transitSignature) != keyID {
		return "", errors.New("Vault Transit signed with an unexpected key version")
	}
	publicKey, found, err := s.provider.PublicKey(ctx, keyID)
	if err != nil {
		return "", fmt.Errorf("lookup minted token public key: %w", err)
	}
	if !found || len(publicKey) != ed25519.PublicKeySize {
		return "", errors.New("minted token public key is unavailable")
	}
	if !ed25519.Verify(publicKey, []byte(signingInput), signature) {
		return "", errors.New("Vault Transit returned an invalid token signature")
	}
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

// Validate verifies a compact JWT's protected header, signature, and claims.
func (s *Service) Validate(ctx context.Context, compact string) (Claims, error) {
	claims, err := s.validate(ctx, compact)
	if err == nil {
		return claims, nil
	}
	var dependency *dependencyError
	if errors.As(err, &dependency) {
		return Claims{}, dependency.cause
	}
	return Claims{}, &invalidError{cause: err}
}

func (s *Service) validate(ctx context.Context, compact string) (Claims, error) {
	headerPart, payloadPart, signaturePart, err := splitCompact(compact)
	if err != nil {
		return Claims{}, err
	}
	headerBytes, err := decodeCompactPart(headerPart, maxHeaderLength)
	if err != nil {
		return Claims{}, fmt.Errorf("decode token header: %w", err)
	}
	header, err := decodeObject(headerBytes)
	if err != nil {
		return Claims{}, fmt.Errorf("decode token header: %w", err)
	}
	keyID, err := validateHeader(header)
	if err != nil {
		return Claims{}, err
	}

	signature, err := decodeCompactPart(signaturePart, ed25519.SignatureSize)
	if err != nil {
		return Claims{}, fmt.Errorf("decode token signature: %w", err)
	}
	if len(signature) != ed25519.SignatureSize {
		return Claims{}, errors.New("token signature has an invalid length")
	}
	publicKey, found, err := s.provider.PublicKey(ctx, keyID)
	if err != nil {
		return Claims{}, &dependencyError{cause: fmt.Errorf("lookup token public key: %w", err)}
	}
	if !found {
		return Claims{}, errors.New("token signing key is unknown")
	}
	if len(publicKey) != ed25519.PublicKeySize {
		return Claims{}, &dependencyError{cause: errors.New("token public key provider returned an invalid key")}
	}
	if !ed25519.Verify(publicKey, []byte(headerPart+"."+payloadPart), signature) {
		return Claims{}, errors.New("token signature is invalid")
	}

	payloadBytes, err := decodeCompactPart(payloadPart, maxClaimsLength)
	if err != nil {
		return Claims{}, fmt.Errorf("decode token claims: %w", err)
	}
	payload, err := decodeObject(payloadBytes)
	if err != nil {
		return Claims{}, fmt.Errorf("decode token claims: %w", err)
	}
	claims, err := parseClaims(payload)
	if err != nil {
		return Claims{}, err
	}
	claims.KeyID = keyID
	if err := s.validateClaims(claims); err != nil {
		return Claims{}, err
	}
	return claims, nil
}

// ParseTransitSignature parses a Vault Transit signature such as
// "vault:v1:<base64 signature>". Both base64url and standard base64 are
// accepted because Vault's encoding varies with its configuration.
func ParseTransitSignature(value string) ([]byte, error) {
	parts := strings.Split(value, ":")
	if len(parts) != 3 || parts[0] != "vault" || !validTransitVersion(parts[1]) || parts[2] == "" {
		return nil, errors.New("invalid Vault Transit signature format")
	}

	for _, encoding := range []*base64.Encoding{
		base64.RawURLEncoding,
		base64.URLEncoding,
		base64.RawStdEncoding,
		base64.StdEncoding,
	} {
		signature, err := encoding.DecodeString(parts[2])
		if err == nil && encoding.EncodeToString(signature) == parts[2] {
			if len(signature) != ed25519.SignatureSize {
				return nil, errors.New("Vault Transit signature has an invalid length")
			}
			return signature, nil
		}
	}
	return nil, errors.New("invalid Vault Transit signature encoding")
}

func transitKeyID(value string) string {
	parts := strings.Split(value, ":")
	if len(parts) != 3 || !validTransitVersion(parts[1]) {
		return ""
	}
	return parts[1]
}

func validKeyID(value string) bool {
	return validTransitVersion(value)
}

func validateMintRequest(request MintRequest) error {
	if request.Subject == "" || request.SessionID == "" || request.AuthenticationMethod == "" ||
		request.AssuranceLevel == "" || !validRoles(request.GlobalRoles) {
		return errors.New("token subject, session ID, authentication method, assurance level, and global role are required")
	}
	if request.AuthenticationTime.IsZero() {
		return errors.New("token authentication time is required")
	}
	if request.Lifetime <= 0 {
		return errors.New("token lifetime must be positive")
	}
	return nil
}

func newTokenID() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate token ID: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func splitCompact(compact string) (string, string, string, error) {
	if compact == "" || len(compact) > maxTokenLength {
		return "", "", "", errors.New("invalid compact token length")
	}
	parts := strings.Split(compact, ".")
	if len(parts) != 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
		return "", "", "", errors.New("invalid compact token format")
	}
	return parts[0], parts[1], parts[2], nil
}

func decodeCompactPart(part string, maxLength int) ([]byte, error) {
	if len(part) > maxLength*2 || strings.Contains(part, "=") {
		return nil, errors.New("invalid base64url encoding")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil || base64.RawURLEncoding.EncodeToString(decoded) != part {
		return nil, errors.New("invalid base64url encoding")
	}
	if len(decoded) > maxLength {
		return nil, errors.New("token part is too large")
	}
	return decoded, nil
}

func decodeObject(value []byte) (map[string]json.RawMessage, error) {
	decoder := json.NewDecoder(strings.NewReader(string(value)))
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	if delimiter, ok := token.(json.Delim); !ok || delimiter != '{' {
		return nil, errors.New("must be a JSON object")
	}

	object := make(map[string]json.RawMessage)
	for decoder.More() {
		keyToken, err := decoder.Token()
		if err != nil {
			return nil, err
		}
		key, ok := keyToken.(string)
		if !ok {
			return nil, errors.New("object key is not a string")
		}
		if _, exists := object[key]; exists {
			return nil, fmt.Errorf("duplicate JSON key %q", key)
		}
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil {
			return nil, err
		}
		object[key] = raw
	}
	if token, err = decoder.Token(); err != nil {
		return nil, err
	} else if delimiter, ok := token.(json.Delim); !ok || delimiter != '}' {
		return nil, errors.New("unterminated JSON object")
	}
	if _, err := decoder.Token(); err != io.EOF {
		if err == nil {
			return nil, errors.New("unexpected JSON value after object")
		}
		return nil, err
	}
	return object, nil
}

func validateHeader(header map[string]json.RawMessage) (string, error) {
	if len(header) != 3 {
		return "", errors.New("token header must contain only alg, typ, and kid")
	}
	algorithmValue, err := objectString(header, "alg")
	if err != nil || algorithmValue != algorithm {
		return "", errors.New("token header has an invalid algorithm")
	}
	typeValue, err := objectString(header, "typ")
	if err != nil || typeValue != tokenType {
		return "", errors.New("token header has an invalid type")
	}
	keyID, err := objectString(header, "kid")
	if err != nil || !validKeyID(keyID) {
		return "", errors.New("token header has an invalid key ID")
	}
	return keyID, nil
}

func parseClaims(payload map[string]json.RawMessage) (Claims, error) {
	issuer, err := objectString(payload, "iss")
	if err != nil {
		return Claims{}, requiredClaimError("iss")
	}
	audience, err := objectString(payload, "aud")
	if err != nil {
		return Claims{}, requiredClaimError("aud")
	}
	subject, err := objectString(payload, "sub")
	if err != nil {
		return Claims{}, requiredClaimError("sub")
	}
	sessionID, err := objectString(payload, "sid")
	if err != nil {
		return Claims{}, requiredClaimError("sid")
	}
	tokenID, err := objectString(payload, "jti")
	if err != nil {
		return Claims{}, requiredClaimError("jti")
	}
	issuedAt, err := objectUnixTime(payload, "iat")
	if err != nil {
		return Claims{}, requiredClaimError("iat")
	}
	expiresAt, err := objectUnixTime(payload, "exp")
	if err != nil {
		return Claims{}, requiredClaimError("exp")
	}
	authenticationTime, err := objectUnixTime(payload, "auth_time")
	if err != nil {
		return Claims{}, requiredClaimError("auth_time")
	}
	authenticationMethod, err := objectString(payload, "amr")
	if err != nil {
		return Claims{}, requiredClaimError("amr")
	}
	assuranceLevel, err := objectString(payload, "acr")
	if err != nil {
		return Claims{}, requiredClaimError("acr")
	}
	globalRoles, err := objectStringSlice(payload, "global_roles")
	if err != nil {
		return Claims{}, requiredClaimError("global_roles")
	}

	return Claims{
		Issuer:               issuer,
		Audience:             audience,
		Subject:              subject,
		SessionID:            sessionID,
		TokenID:              tokenID,
		IssuedAt:             time.Unix(issuedAt, 0).UTC(),
		ExpiresAt:            time.Unix(expiresAt, 0).UTC(),
		AuthenticationTime:   time.Unix(authenticationTime, 0).UTC(),
		AuthenticationMethod: authenticationMethod,
		AssuranceLevel:       assuranceLevel,
		GlobalRoles:          globalRoles,
	}, nil
}

func (s *Service) validateClaims(claims Claims) error {
	if claims.Issuer != s.config.Issuer {
		return errors.New("token issuer is invalid")
	}
	if claims.Audience != s.config.Audience {
		return errors.New("token audience is invalid")
	}
	if !claims.ExpiresAt.After(claims.IssuedAt) {
		return errors.New("token expiration must be after issuance")
	}
	if claims.AuthenticationTime.After(claims.IssuedAt) {
		return errors.New("token authentication time is after issuance")
	}
	now := s.config.Clock()
	if !now.Before(claims.ExpiresAt.Add(s.config.Leeway)) {
		return errors.New("token has expired")
	}
	if claims.IssuedAt.After(now.Add(s.config.Leeway)) {
		return errors.New("token was issued in the future")
	}
	return nil
}

func objectString(object map[string]json.RawMessage, key string) (string, error) {
	raw, exists := object[key]
	if !exists {
		return "", errors.New("missing string")
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil || value == "" {
		return "", errors.New("invalid string")
	}
	return value, nil
}

func objectUnixTime(object map[string]json.RawMessage, key string) (int64, error) {
	raw, exists := object[key]
	if !exists {
		return 0, errors.New("missing integer")
	}
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return 0, err
	}
	if _, err := decoder.Token(); err != io.EOF {
		return 0, errors.New("invalid integer")
	}
	number, ok := value.(json.Number)
	if !ok {
		return 0, errors.New("invalid integer")
	}
	parsed, err := strconv.ParseInt(string(number), 10, 64)
	if err != nil || parsed < 0 {
		return 0, errors.New("invalid integer")
	}
	return parsed, nil
}

func objectStringSlice(object map[string]json.RawMessage, key string) ([]string, error) {
	raw, exists := object[key]
	if !exists {
		return nil, errors.New("missing string array")
	}
	var value []string
	if err := json.Unmarshal(raw, &value); err != nil || !validRoles(value) {
		return nil, errors.New("invalid string array")
	}
	return value, nil
}

func validRoles(roles []string) bool {
	if len(roles) == 0 {
		return false
	}
	for _, role := range roles {
		if role == "" {
			return false
		}
	}
	return true
}

func requiredClaimError(name string) error {
	return fmt.Errorf("token has an invalid or missing %s claim", name)
}

func validTransitVersion(value string) bool {
	if len(value) < 2 || value[0] != 'v' || value[1] == '0' {
		return false
	}
	for _, character := range value[1:] {
		if character < '0' || character > '9' {
			return false
		}
	}
	_, err := strconv.ParseUint(value[1:], 10, 64)
	return err == nil
}
