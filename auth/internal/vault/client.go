// Package vault provides the narrow Vault API surface the auth service needs.
package vault

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const requestTimeout = 10 * time.Second

type Client struct {
	address string
	http    *http.Client

	mu    sync.RWMutex
	token string
}

type HTTPError struct {
	StatusCode int
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("Vault returned HTTP %d", e.StatusCode)
}

type Token struct {
	LeaseDuration time.Duration
	Renewable     bool
}

type DatabaseCredentials struct {
	Username      string
	Password      string
	LeaseID       string
	LeaseDuration time.Duration
	Renewable     bool
}

type OAuthCredentials struct {
	FortyTwoClientID     string
	FortyTwoClientSecret string
	GoogleClientID       string
	GoogleClientSecret   string
}

type Secrets struct {
	OAuth         OAuthCredentials
	InternalToken string
}

func NewClient(address string) (*Client, error) {
	parsed, err := url.Parse(address)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return nil, fmt.Errorf("invalid Vault address")
	}
	return &Client{
		address: strings.TrimRight(address, "/"),
		http:    &http.Client{Timeout: requestTimeout},
	}, nil
}

func (c *Client) Login(ctx context.Context, roleID, secretID string) (Token, error) {
	var response struct {
		Auth struct {
			ClientToken   string `json:"client_token"`
			LeaseDuration int    `json:"lease_duration"`
			Renewable     bool   `json:"renewable"`
		} `json:"auth"`
	}
	if err := c.request(ctx, http.MethodPost, "auth/approle/login", "", map[string]string{
		"role_id": roleID, "secret_id": secretID,
	}, &response); err != nil {
		return Token{}, fmt.Errorf("Vault AppRole login: %w", err)
	}
	if response.Auth.ClientToken == "" || response.Auth.LeaseDuration <= 0 || !response.Auth.Renewable {
		return Token{}, fmt.Errorf("Vault AppRole login returned an unusable renewable token")
	}
	c.setToken(response.Auth.ClientToken)
	return Token{LeaseDuration: time.Duration(response.Auth.LeaseDuration) * time.Second, Renewable: response.Auth.Renewable}, nil
}

func (c *Client) RenewToken(ctx context.Context) (Token, error) {
	var response struct {
		Auth struct {
			LeaseDuration int  `json:"lease_duration"`
			Renewable     bool `json:"renewable"`
		} `json:"auth"`
	}
	if err := c.request(ctx, http.MethodPost, "auth/token/renew-self", c.tokenValue(), nil, &response); err != nil {
		return Token{}, fmt.Errorf("renew Vault token: %w", err)
	}
	if response.Auth.LeaseDuration <= 0 || !response.Auth.Renewable {
		return Token{}, fmt.Errorf("Vault token renewal returned an unusable renewable token")
	}
	return Token{LeaseDuration: time.Duration(response.Auth.LeaseDuration) * time.Second, Renewable: response.Auth.Renewable}, nil
}

func (c *Client) ReadSecrets(ctx context.Context) (Secrets, error) {
	oauth, err := c.readKV(ctx, "kv/data/auth/oauth")
	if err != nil {
		return Secrets{}, fmt.Errorf("read OAuth credentials: %w", err)
	}
	internal, err := c.readKV(ctx, "kv/data/internal/backend-auth")
	if err != nil {
		return Secrets{}, fmt.Errorf("read internal credential: %w", err)
	}
	secrets := Secrets{
		OAuth: OAuthCredentials{
			FortyTwoClientID:     oauth["oauth_42_client_id"],
			FortyTwoClientSecret: oauth["oauth_42_client_secret"],
			GoogleClientID:       oauth["oauth_google_client_id"],
			GoogleClientSecret:   oauth["oauth_google_client_secret"],
		},
		InternalToken: internal["internal_token"],
	}
	if len(secrets.InternalToken) < 32 {
		return Secrets{}, fmt.Errorf("Vault internal credential must be at least 32 characters")
	}
	return secrets, nil
}

func (c *Client) IssueDatabaseCredentials(ctx context.Context, role string) (DatabaseCredentials, error) {
	var response databaseResponse
	if err := c.request(ctx, http.MethodGet, "database/creds/"+url.PathEscape(role), c.tokenValue(), nil, &response); err != nil {
		return DatabaseCredentials{}, fmt.Errorf("issue database credentials: %w", err)
	}
	return response.credentials(true)
}

func (c *Client) RenewDatabaseCredentials(ctx context.Context, credentials DatabaseCredentials) (DatabaseCredentials, error) {
	var response databaseResponse
	if err := c.request(ctx, http.MethodPost, "sys/leases/renew", c.tokenValue(), map[string]string{
		"lease_id": credentials.LeaseID,
	}, &response); err != nil {
		return DatabaseCredentials{}, fmt.Errorf("renew database credentials: %w", err)
	}
	renewed, err := response.credentials(false)
	if err != nil {
		return DatabaseCredentials{}, err
	}
	// Lease renewal responses do not repeat the database username/password.
	renewed.Username = credentials.Username
	renewed.Password = credentials.Password
	return renewed, nil
}

// Sign delegates Ed25519 signing to Vault Transit. The private key is never
// returned by this API.
func (c *Client) Sign(ctx context.Context, value []byte) (string, error) {
	var response struct {
		Data struct {
			Signature string `json:"signature"`
		} `json:"data"`
	}
	if err := c.request(ctx, http.MethodPost, "transit/sign/auth-access-jwt", c.tokenValue(), map[string]string{
		"input": base64.StdEncoding.EncodeToString(value),
	}, &response); err != nil {
		return "", fmt.Errorf("sign with Vault Transit: %w", err)
	}
	if response.Data.Signature == "" {
		return "", fmt.Errorf("Vault Transit returned an empty signature")
	}
	return response.Data.Signature, nil
}

func (c *Client) readKV(ctx context.Context, path string) (map[string]string, error) {
	var response struct {
		Data struct {
			Data map[string]string `json:"data"`
		} `json:"data"`
	}
	if err := c.request(ctx, http.MethodGet, path, c.tokenValue(), nil, &response); err != nil {
		return nil, err
	}
	if response.Data.Data == nil {
		return nil, fmt.Errorf("Vault KV response has no data")
	}
	return response.Data.Data, nil
}

type databaseResponse struct {
	LeaseID       string `json:"lease_id"`
	LeaseDuration int    `json:"lease_duration"`
	Renewable     bool   `json:"renewable"`
	Data          struct {
		Username string `json:"username"`
		Password string `json:"password"`
	} `json:"data"`
}

func (r databaseResponse) credentials(requireCredentials bool) (DatabaseCredentials, error) {
	if r.LeaseID == "" || r.LeaseDuration <= 0 || !r.Renewable ||
		(requireCredentials && (r.Data.Username == "" || r.Data.Password == "")) {
		return DatabaseCredentials{}, fmt.Errorf("Vault database credentials response is incomplete")
	}
	return DatabaseCredentials{
		Username:      r.Data.Username,
		Password:      r.Data.Password,
		LeaseID:       r.LeaseID,
		LeaseDuration: time.Duration(r.LeaseDuration) * time.Second,
		Renewable:     r.Renewable,
	}, nil
}

func (c *Client) request(ctx context.Context, method, path, token string, requestBody, responseBody any) error {
	var body io.Reader
	if requestBody != nil {
		encoded, err := json.Marshal(requestBody)
		if err != nil {
			return fmt.Errorf("encode request: %w", err)
		}
		body = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, c.address+"/v1/"+path, body)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	if requestBody != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("X-Vault-Token", token)
	}
	response, err := c.http.Do(request)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return &HTTPError{StatusCode: response.StatusCode}
	}
	if responseBody != nil {
		if err := json.NewDecoder(response.Body).Decode(responseBody); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}
	return nil
}

func (c *Client) setToken(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.token = token
}

func (c *Client) tokenValue() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.token
}
