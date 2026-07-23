package vault

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestClientUsesAppRoleTokenForRuntimeOperations(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/auth/approle/login":
			writeTestJSON(t, w, map[string]any{
				"auth": map[string]any{
					"client_token":   "runtime-token",
					"lease_duration": 3600,
					"renewable":      true,
				},
			})
		case "/v1/kv/data/auth/oauth":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{
				"oauth_42_client_id": "42-id", "oauth_42_client_secret": "42-secret",
				"oauth_google_client_id": "google-id", "oauth_google_client_secret": "google-secret",
			}}})
		case "/v1/kv/data/internal/backend-auth":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{
				"internal_token": "a-credential-that-is-definitely-long-enough",
			}}})
		case "/v1/database/creds/auth-runtime":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{
				"lease_id":       "database/creds/auth-runtime/opaque",
				"lease_duration": 28_800,
				"renewable":      true,
				"data":           map[string]string{"username": "v-auth", "password": "database-password"},
			})
		case "/v1/transit/sign/auth-access-jwt":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{"data": map[string]string{"signature": "vault:v1:signature"}})
		default:
			t.Errorf("unexpected Vault path %s", r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	if _, err := client.Login(context.Background(), "role-id", "secret-id"); err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	secrets, err := client.ReadSecrets(context.Background())
	if err != nil {
		t.Fatalf("ReadSecrets() error = %v", err)
	}
	if secrets.InternalToken != "a-credential-that-is-definitely-long-enough" {
		t.Errorf("ReadSecrets() internal token = %q", secrets.InternalToken)
	}
	credentials, err := client.IssueDatabaseCredentials(context.Background(), "auth-runtime")
	if err != nil {
		t.Fatalf("IssueDatabaseCredentials() error = %v", err)
	}
	if credentials.Username != "v-auth" {
		t.Errorf("IssueDatabaseCredentials() username = %q, want v-auth", credentials.Username)
	}
	signature, err := client.Sign(context.Background(), []byte("jwt signing input"))
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	if signature != "vault:v1:signature" {
		t.Errorf("Sign() = %q", signature)
	}
}

func TestRenewDatabaseCredentialsRetainsCredentialFields(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requireVaultToken(t, r)
		if r.URL.Path != "/v1/sys/leases/renew" {
			http.NotFound(w, r)
			return
		}
		writeTestJSON(t, w, map[string]any{
			"lease_id":       "database/creds/auth-runtime/renewed",
			"lease_duration": 28_800,
			"renewable":      true,
		})
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	client.setToken("runtime-token")
	renewed, err := client.RenewDatabaseCredentials(context.Background(), DatabaseCredentials{
		Username: "v-auth", Password: "database-password", LeaseID: "previous-lease",
	})
	if err != nil {
		t.Fatalf("RenewDatabaseCredentials() error = %v", err)
	}
	if renewed.Username != "v-auth" || renewed.Password != "database-password" {
		t.Errorf("RenewDatabaseCredentials() lost database credentials: %#v", renewed)
	}
}

func TestRuntimeReauthenticatesAndReplacesDatabaseLease(t *testing.T) {
	t.Parallel()

	loginCalls := 0
	databaseCalls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/auth/approle/login":
			loginCalls++
			writeTestJSON(t, w, map[string]any{"auth": map[string]any{
				"client_token": "runtime-token", "lease_duration": 3600, "renewable": true,
			}})
		case "/v1/kv/data/auth/oauth":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{}}})
		case "/v1/kv/data/internal/backend-auth":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{
				"internal_token": "a-credential-that-is-definitely-long-enough",
			}}})
		case "/v1/database/creds/auth-runtime":
			requireVaultToken(t, r)
			databaseCalls++
			writeTestJSON(t, w, map[string]any{
				"lease_id":       "database/creds/auth-runtime/lease",
				"lease_duration": 28_800,
				"renewable":      true,
				"data":           map[string]string{"username": "v-auth", "password": "database-password"},
			})
		case "/v1/auth/token/renew-self":
			requireVaultToken(t, r)
			http.Error(w, "token maximum TTL reached", http.StatusForbidden)
		default:
			t.Errorf("unexpected Vault path %s", r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	directory := t.TempDir()
	roleIDFile := filepath.Join(directory, "role_id")
	secretIDFile := filepath.Join(directory, "secret_id")
	for path, value := range map[string]string{roleIDFile: "role-id", secretIDFile: "secret-id"} {
		if err := os.WriteFile(path, []byte(value), 0o600); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}

	refreshes := 0
	runtime, err := NewRuntime(RuntimeConfig{
		Address: server.URL, RoleIDFile: roleIDFile, SecretIDFile: secretIDFile, DatabaseRole: "auth-runtime",
	}, func(context.Context, DatabaseCredentials) error {
		refreshes++
		return nil
	})
	if err != nil {
		t.Fatalf("NewRuntime() error = %v", err)
	}
	if _, err := runtime.Start(context.Background()); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if err := runtime.renew(context.Background()); err != nil {
		t.Fatalf("renew() error = %v", err)
	}
	if loginCalls != 2 || databaseCalls != 2 || refreshes != 2 {
		t.Errorf("login calls = %d, database calls = %d, pool refreshes = %d; want 2 each", loginCalls, databaseCalls, refreshes)
	}
}

func requireVaultToken(t *testing.T, request *http.Request) {
	t.Helper()
	if request.Header.Get("X-Vault-Token") != "runtime-token" {
		t.Errorf("X-Vault-Token = %q, want runtime-token", request.Header.Get("X-Vault-Token"))
	}
}

func writeTestJSON(t *testing.T, response http.ResponseWriter, value any) {
	t.Helper()
	response.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(response).Encode(value); err != nil {
		t.Fatalf("encode response: %v", err)
	}
}
