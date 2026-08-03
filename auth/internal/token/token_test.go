package token

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

var fixedNow = time.Date(2026, time.August, 1, 12, 0, 0, 0, time.UTC)

type fakeSigner struct {
	privateKey     ed25519.PrivateKey
	encoding       *base64.Encoding
	signatureKeyID string
	err            error
}

func (s fakeSigner) Sign(_ context.Context, keyID string, value []byte) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	encoding := s.encoding
	if encoding == nil {
		encoding = base64.RawURLEncoding
	}
	if s.signatureKeyID != "" {
		keyID = s.signatureKeyID
	}
	return "vault:" + keyID + ":" + encoding.EncodeToString(ed25519.Sign(s.privateKey, value)), nil
}

type fakeKeyProvider struct {
	keys map[string]ed25519.PublicKey
	err  error
}

func (p fakeKeyProvider) SigningKeyID(context.Context) (string, error) {
	if p.err != nil {
		return "", p.err
	}
	return "v1", nil
}

func (p fakeKeyProvider) PublicKey(_ context.Context, keyID string) (ed25519.PublicKey, bool, error) {
	if p.err != nil {
		return nil, false, p.err
	}
	key, ok := p.keys[keyID]
	if !ok {
		return nil, false, nil
	}
	return key, true, nil
}

func TestServiceMintAndValidate(t *testing.T) {
	t.Parallel()

	service, _ := newTestService(t)
	token, err := service.Mint(context.Background(), MintRequest{
		Subject:              "user-123",
		SessionID:            "session-456",
		TokenID:              "token-789",
		AuthenticationMethod: "password",
		AssuranceLevel:       "aal2",
		GlobalRoles:          []string{"USER"},
		AuthenticationTime:   fixedNow.Add(-time.Minute),
		Lifetime:             15 * time.Minute,
	})
	if err != nil {
		t.Fatalf("Mint() error = %v", err)
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("Mint() produced %d compact token parts, want 3", len(parts))
	}
	header := decodeTestJSON(t, parts[0])
	if header["alg"] != algorithm || header["typ"] != tokenType || header["kid"] != "v1" {
		t.Errorf("Mint() header = %#v, want strict EdDSA JWT header", header)
	}
	claims := decodeTestJSON(t, parts[1])
	for _, required := range []string{"iss", "aud", "sub", "sid", "jti", "iat", "exp", "auth_time", "amr", "acr", "global_roles"} {
		if _, ok := claims[required]; !ok {
			t.Errorf("Mint() omitted required %q claim", required)
		}
	}

	verified, err := service.Validate(context.Background(), token)
	if err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if verified.Subject != "user-123" || verified.SessionID != "session-456" ||
		verified.TokenID != "token-789" || verified.KeyID != "v1" {
		t.Errorf("Validate() claims = %#v", verified)
	}
	if !verified.IssuedAt.Equal(fixedNow) || !verified.ExpiresAt.Equal(fixedNow.Add(15*time.Minute)) {
		t.Errorf("Validate() token times = issued %s, expires %s", verified.IssuedAt, verified.ExpiresAt)
	}
}

func TestServiceMintGeneratesTokenIDAndParsesStandardBase64TransitSignature(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	service, err := NewService(Config{
		Issuer: "https://auth.example.test", Audience: "frontend",
		Clock: func() time.Time { return fixedNow },
	}, fakeSigner{privateKey: privateKey, encoding: base64.StdEncoding}, fakeKeyProvider{keys: map[string]ed25519.PublicKey{"v1": publicKey}})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	token, err := service.Mint(context.Background(), testMintRequest())
	if err != nil {
		t.Fatalf("Mint() error = %v", err)
	}
	verified, err := service.Validate(context.Background(), token)
	if err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if verified.TokenID == "" {
		t.Fatal("Mint() generated an empty token ID")
	}
}

func TestServiceMintRejectsTransitKeyVersionDrift(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	service, err := NewService(
		Config{Issuer: "issuer", Audience: "audience", Clock: func() time.Time { return fixedNow }},
		fakeSigner{privateKey: privateKey, signatureKeyID: "v2"},
		fakeKeyProvider{keys: map[string]ed25519.PublicKey{"v1": publicKey}},
	)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	if _, err := service.Mint(context.Background(), testMintRequest()); err == nil {
		t.Fatal("Mint() accepted a Transit signature from a different key version")
	}
}

func TestServiceMintVerifiesTransitSignatureBeforeReturning(t *testing.T) {
	t.Parallel()

	publicKey, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	_, wrongPrivateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	service, err := NewService(
		Config{Issuer: "issuer", Audience: "audience", Clock: func() time.Time { return fixedNow }},
		fakeSigner{privateKey: wrongPrivateKey},
		fakeKeyProvider{keys: map[string]ed25519.PublicKey{"v1": publicKey}},
	)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	if _, err := service.Mint(context.Background(), testMintRequest()); err == nil {
		t.Fatal("Mint() returned a JWT whose Transit signature failed local verification")
	}
}

func TestServiceValidateRejectsInvalidTokens(t *testing.T) {
	t.Parallel()

	service, privateKey := newTestService(t)
	validClaims := testClaimsJSON()
	cases := []struct {
		name    string
		token   string
		wantErr string
	}{
		{
			name:    "none algorithm",
			token:   signedTestToken(t, privateKey, `{"alg":"none","typ":"JWT","kid":"v1"}`, validClaims),
			wantErr: "algorithm",
		},
		{
			name:    "algorithm confusion",
			token:   signedTestToken(t, privateKey, `{"alg":"HS256","typ":"JWT","kid":"v1"}`, validClaims),
			wantErr: "algorithm",
		},
		{
			name:    "wrong token type",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWS","kid":"v1"}`, validClaims),
			wantErr: "type",
		},
		{
			name:    "empty key ID",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":""}`, validClaims),
			wantErr: "key ID",
		},
		{
			name:    "extra header parameter",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1","jwk":{}}`, validClaims),
			wantErr: "only alg",
		},
		{
			name:    "missing required claim",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, `{"iss":"https://auth.example.test","aud":"frontend","sub":"user","sid":"session","jti":"id","iat":1785585600,"exp":1785586500,"auth_time":1785585540,"acr":"aal2","global_roles":["USER"]}`),
			wantErr: "amr",
		},
		{
			name:    "wrong issuer",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, strings.Replace(validClaims, "https://auth.example.test", "https://other.example.test", 1)),
			wantErr: "issuer",
		},
		{
			name:    "wrong audience",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, strings.Replace(validClaims, `"frontend"`, `"other-client"`, 1)),
			wantErr: "audience",
		},
		{
			name:    "audience array",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, strings.Replace(validClaims, `"aud":"frontend"`, `"aud":["frontend"]`, 1)),
			wantErr: "aud",
		},
		{
			name:    "expired",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, `{"iss":"https://auth.example.test","aud":"frontend","sub":"user","sid":"session","jti":"id","iat":1785585500,"exp":1785585599,"auth_time":1785585490,"amr":"password","acr":"aal2","global_roles":["USER"]}`),
			wantErr: "expired",
		},
		{
			name:    "issued in future",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, strings.Replace(validClaims, `"iat":1785585600`, `"iat":1785585661`, 1)),
			wantErr: "future",
		},
		{
			name:    "authentication after issuance",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, strings.Replace(validClaims, `"auth_time":1785585540`, `"auth_time":1785585601`, 1)),
			wantErr: "after issuance",
		},
		{
			name:    "duplicate header key",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","alg":"EdDSA","typ":"JWT","kid":"v1"}`, validClaims),
			wantErr: "duplicate",
		},
		{
			name:    "duplicate claim key",
			token:   signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, strings.Replace(validClaims, `"sub":"user"`, `"sub":"user","sub":"attacker"`, 1)),
			wantErr: "duplicate",
		},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			if _, err := service.Validate(context.Background(), test.token); err == nil || !strings.Contains(err.Error(), test.wantErr) {
				t.Errorf("Validate() error = %v, want %q", err, test.wantErr)
			}
		})
	}
}

func TestServiceValidateRejectsMalformedCompactTokensAndSignatures(t *testing.T) {
	t.Parallel()

	service, privateKey := newTestService(t)
	valid := signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, testClaimsJSON())
	parts := strings.Split(valid, ".")
	cases := []string{
		"",
		"one.two",
		"one.two.three.four",
		parts[0] + "=" + "." + parts[1] + "." + parts[2],
		parts[0] + "." + parts[1] + "." + base64.RawURLEncoding.EncodeToString(make([]byte, ed25519.SignatureSize-1)),
		parts[0] + "." + parts[1] + "." + strings.Repeat("A", maxTokenLength),
	}
	for _, compact := range cases {
		if _, err := service.Validate(context.Background(), compact); err == nil {
			t.Errorf("Validate(%q) error = nil, want malformed-token rejection", compact)
		}
	}

	replacement := "A"
	if valid[len(valid)-1] == 'A' {
		replacement = "B"
	}
	tampered := valid[:len(valid)-1] + replacement
	if _, err := service.Validate(context.Background(), tampered); err == nil {
		t.Fatal("Validate() accepted a token with a tampered signature")
	}
}

func TestServiceValidateUsesKeyIDForLookup(t *testing.T) {
	t.Parallel()

	service, privateKey := newTestService(t)
	token := signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v999"}`, testClaimsJSON())
	if _, err := service.Validate(context.Background(), token); !IsInvalid(err) {
		t.Errorf("Validate() error = %v, want typed invalid-token rejection", err)
	}
}

func TestServiceValidateDistinguishesDependencyFailure(t *testing.T) {
	t.Parallel()

	_, privateKey := newTestService(t)
	service, err := NewService(
		Config{Issuer: "https://auth.example.test", Audience: "frontend", Clock: func() time.Time { return fixedNow }},
		fakeSigner{}, fakeKeyProvider{err: errors.New("Vault unavailable")},
	)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	compact := signedTestToken(t, privateKey, `{"alg":"EdDSA","typ":"JWT","kid":"v1"}`, testClaimsJSON())
	if _, err := service.Validate(context.Background(), compact); err == nil || IsInvalid(err) {
		t.Errorf("Validate() error = %v, want infrastructure error", err)
	}

	service, err = NewService(
		Config{Issuer: "https://auth.example.test", Audience: "frontend", Clock: func() time.Time { return fixedNow }},
		fakeSigner{}, fakeKeyProvider{keys: map[string]ed25519.PublicKey{"v1": {1}}},
	)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	if _, err := service.Validate(context.Background(), compact); err == nil || IsInvalid(err) {
		t.Errorf("Validate() malformed-provider-key error = %v, want infrastructure error", err)
	}
}

func TestParseTransitSignature(t *testing.T) {
	t.Parallel()

	signature := make([]byte, ed25519.SignatureSize)
	for index := range signature {
		signature[index] = byte(index + 128)
	}
	for _, encoding := range []*base64.Encoding{
		base64.RawURLEncoding, base64.URLEncoding, base64.RawStdEncoding, base64.StdEncoding,
	} {
		value := "vault:v12:" + encoding.EncodeToString(signature)
		parsed, err := ParseTransitSignature(value)
		if err != nil {
			t.Errorf("ParseTransitSignature(%q) error = %v", value, err)
		}
		if !stringSlicesEqual(parsed, signature) {
			t.Errorf("ParseTransitSignature(%q) = %x, want %x", value, parsed, signature)
		}
	}

	for _, value := range []string{
		"", "vault:v1", "vault:v0:AAAA", "vault:v01:AAAA", "vault:vx:AAAA",
		"not-vault:v1:AAAA", "vault:v1:not base64", "vault:v1:" + base64.RawURLEncoding.EncodeToString(make([]byte, 63)),
	} {
		if _, err := ParseTransitSignature(value); err == nil {
			t.Errorf("ParseTransitSignature(%q) error = nil, want rejection", value)
		}
	}
}

func TestNewServiceAndMintRejectInvalidInput(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	signer := fakeSigner{privateKey: privateKey}
	provider := fakeKeyProvider{keys: map[string]ed25519.PublicKey{"v1": publicKey}}
	if _, err := NewService(Config{}, signer, provider); err == nil {
		t.Fatal("NewService() accepted incomplete config")
	}
	if _, err := NewService(Config{Issuer: "issuer", Audience: "audience"}, nil, provider); err == nil {
		t.Fatal("NewService() accepted nil signer")
	}
	service, err := NewService(Config{Issuer: "issuer", Audience: "audience", Clock: func() time.Time { return fixedNow }}, signer, provider)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	request := testMintRequest()
	request.AuthenticationTime = fixedNow.Add(time.Second)
	if _, err := service.Mint(context.Background(), request); err == nil {
		t.Fatal("Mint() accepted authentication time after issuance")
	}
	request = testMintRequest()
	request.Lifetime = 0
	if _, err := service.Mint(context.Background(), request); err == nil {
		t.Fatal("Mint() accepted zero token lifetime")
	}
}

func newTestService(t *testing.T) (*Service, ed25519.PrivateKey) {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	service, err := NewService(Config{
		Issuer: "https://auth.example.test", Audience: "frontend",
		Clock: func() time.Time { return fixedNow },
	}, fakeSigner{privateKey: privateKey}, fakeKeyProvider{keys: map[string]ed25519.PublicKey{"v1": publicKey}})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	return service, privateKey
}

func testMintRequest() MintRequest {
	return MintRequest{
		Subject:              "user",
		SessionID:            "session",
		AuthenticationMethod: "password",
		AssuranceLevel:       "aal2",
		GlobalRoles:          []string{"USER"},
		AuthenticationTime:   fixedNow.Add(-time.Minute),
		Lifetime:             15 * time.Minute,
	}
}

func testClaimsJSON() string {
	return `{"iss":"https://auth.example.test","aud":"frontend","sub":"user","sid":"session","jti":"id","iat":1785585600,"exp":1785586500,"auth_time":1785585540,"amr":"password","acr":"aal2","global_roles":["USER"]}`
}

func signedTestToken(t *testing.T, privateKey ed25519.PrivateKey, header, claims string) string {
	t.Helper()
	signingInput := base64.RawURLEncoding.EncodeToString([]byte(header)) + "." + base64.RawURLEncoding.EncodeToString([]byte(claims))
	signature := ed25519.Sign(privateKey, []byte(signingInput))
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func decodeTestJSON(t *testing.T, part string) map[string]any {
	t.Helper()
	decoded, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil {
		t.Fatalf("DecodeString() error = %v", err)
	}
	var value map[string]any
	if err := json.Unmarshal(decoded, &value); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	return value
}

func stringSlicesEqual(left, right []byte) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
