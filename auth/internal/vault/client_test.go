package vault

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestTransitKeyInfoUsesLatestVaultSigningVersion(t *testing.T) {
	t.Parallel()

	publicKey := make([]byte, ed25519.PublicKeySize)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requireVaultToken(t, r)
		writeTestJSON(t, w, map[string]any{"data": map[string]any{
			"latest_version": 3,
			"keys": map[string]any{
				"2": map[string]string{"public_key": base64.StdEncoding.EncodeToString(publicKey)},
				"3": map[string]string{"public_key": base64.StdEncoding.EncodeToString(publicKey)},
			},
		}})
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}

	client.setToken("runtime-token")
	info, err := client.TransitKeyInfo(context.Background())
	if err != nil {
		t.Fatalf("TransitKeyInfo() error = %v", err)
	}
	if info.LatestVersion != 3 || len(info.PublicKeys["v3"]) != ed25519.PublicKeySize {
		t.Fatalf("TransitKeyInfo() = %#v", info)
	}
}

func TestTransitKeyInfoParsesVaultPKIXAndPEMPublicKeys(t *testing.T) {
	t.Parallel()

	publicKey, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	der, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		t.Fatalf("MarshalPKIXPublicKey() error = %v", err)
	}
	pemValue := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))

	for _, test := range []struct {
		name  string
		value string
	}{
		{"PEM", pemValue},
		{"base64 PKIX", base64.StdEncoding.EncodeToString(der)},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requireVaultToken(t, r)
				writeTestJSON(t, w, map[string]any{"data": map[string]any{
					"latest_version": 1,
					"keys": map[string]any{
						"1": map[string]string{"public_key": test.value},
					},
				}})
			}))
			defer server.Close()

			client, err := NewClient(server.URL)
			if err != nil {
				t.Fatalf("NewClient() error = %v", err)
			}
			client.setToken("runtime-token")
			info, err := client.TransitKeyInfo(context.Background())
			if err != nil {
				t.Fatalf("TransitKeyInfo() error = %v", err)
			}
			if !bytes.Equal(info.PublicKeys["v1"], publicKey) {
				t.Fatalf("public key = %x, want %x", info.PublicKeys["v1"], publicKey)
			}
		})
	}
}

func TestReadSecretsRequiresDedicatedRefreshSuccessorKey(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requireVaultToken(t, r)
		switch r.URL.Path {
		case "/v1/kv/data/auth/oauth":
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{}}})
		case "/v1/kv/data/internal/backend-auth":
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{
				"internal_token": "a-credential-that-is-definitely-long-enough",
			}}})
		case "/v1/kv/data/auth/refresh-successor":
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{
				"cipher_key": "short",
			}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	client.setToken("runtime-token")
	if _, err := client.ReadSecrets(context.Background()); err == nil {
		t.Fatal("ReadSecrets() accepted a short refresh successor key")
	}
}

func TestParseTransitEd25519PublicKeyRejectsWrongPKIXType(t *testing.T) {
	t.Parallel()

	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	der, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		t.Fatalf("MarshalPKIXPublicKey() error = %v", err)
	}
	if _, err := parseTransitEd25519PublicKey(base64.StdEncoding.EncodeToString(der)); err == nil {
		t.Fatal("parseTransitEd25519PublicKey() accepted a non-Ed25519 key")
	}
	if _, err := parseTransitEd25519PublicKey(base64.StdEncoding.EncodeToString([]byte("invalid DER"))); err == nil {
		t.Fatal("parseTransitEd25519PublicKey() accepted invalid PKIX")
	}
}

func TestClientRejectsInvalidTransitKeyVersionsWithoutRequest(t *testing.T) {
	t.Parallel()

	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		requests.Add(1)
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	for _, keyID := range []string{"", "v0", "v01", "v-1", "v18446744073709551615"} {
		if _, err := client.Sign(context.Background(), keyID, []byte("input")); err == nil {
			t.Errorf("Sign() accepted key ID %q", keyID)
		}
	}
	if requests.Load() != 0 {
		t.Fatalf("invalid key IDs caused %d Vault requests", requests.Load())
	}
}

func TestRuntimeCoalescesAndNegativeCachesUnknownKeyRefresh(t *testing.T) {
	t.Parallel()

	var requests atomic.Int32
	publicKey := make(ed25519.PublicKey, ed25519.PublicKeySize)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requireVaultToken(t, r)
		requests.Add(1)
		time.Sleep(20 * time.Millisecond)
		writeTestJSON(t, w, map[string]any{"data": map[string]any{
			"latest_version": 1,
			"keys": map[string]any{
				"1": map[string]string{"public_key": base64.StdEncoding.EncodeToString(publicKey)},
			},
		}})
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	client.setToken("runtime-token")
	runtime := &Runtime{client: client}
	runtime.installKeyInfo(TransitKeyInfo{
		LatestVersion: 1,
		PublicKeys:    TransitPublicKeys{"v1": publicKey},
	})
	runtime.ready.Store(true)

	const callers = 20
	var wait sync.WaitGroup
	wait.Add(callers)
	for i := 0; i < callers; i++ {
		go func() {
			defer wait.Done()
			if _, found, err := runtime.PublicKey(context.Background(), "v2"); err != nil || found {
				t.Errorf("PublicKey(v2) = found %v, error %v; want unknown", found, err)
			}
		}()
	}
	wait.Wait()
	if requests.Load() != 1 {
		t.Fatalf("concurrent unknown-kid lookups caused %d Vault requests, want 1", requests.Load())
	}
	if _, found, err := runtime.PublicKey(context.Background(), "v2"); err != nil || found {
		t.Fatalf("negative-cached PublicKey(v2) = found %v, error %v", found, err)
	}
	if _, found, err := runtime.PublicKey(context.Background(), "v3"); err != nil || found {
		t.Fatalf("rate-limited PublicKey(v3) = found %v, error %v", found, err)
	}
	if _, found, err := runtime.PublicKey(context.Background(), "v999"); err != nil || found {
		t.Fatalf("implausible PublicKey(v999) = found %v, error %v", found, err)
	}
	if requests.Load() != 1 {
		t.Fatalf("negative or implausible key IDs caused %d Vault requests, want 1", requests.Load())
	}
}

func TestRuntimeRefreshesImmediatelyForNextTransitKeyVersion(t *testing.T) {
	t.Parallel()

	v1 := make(ed25519.PublicKey, ed25519.PublicKeySize)
	v2 := append(ed25519.PublicKey(nil), v1...)
	v2[0] = 1
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requireVaultToken(t, r)
		writeTestJSON(t, w, map[string]any{"data": map[string]any{
			"latest_version": 2,
			"keys": map[string]any{
				"1": map[string]string{"public_key": base64.StdEncoding.EncodeToString(v1)},
				"2": map[string]string{"public_key": base64.StdEncoding.EncodeToString(v2)},
			},
		}})
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	client.setToken("runtime-token")
	runtime := &Runtime{client: client}
	runtime.installKeyInfo(TransitKeyInfo{LatestVersion: 1, PublicKeys: TransitPublicKeys{"v1": v1}})
	runtime.ready.Store(true)

	key, found, err := runtime.PublicKey(context.Background(), "v2")
	if err != nil || !found || !bytes.Equal(key, v2) {
		t.Fatalf("PublicKey(v2) = %x, %v, %v; want refreshed key", key, found, err)
	}
}

func TestRuntimeCatchesUpAfterMultipleTransitKeyRotations(t *testing.T) {
	t.Parallel()

	v1 := make(ed25519.PublicKey, ed25519.PublicKeySize)
	v4 := append(ed25519.PublicKey(nil), v1...)
	v4[0] = 4
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requireVaultToken(t, r)
		requests.Add(1)
		writeTestJSON(t, w, map[string]any{"data": map[string]any{
			"latest_version": 4,
			"keys": map[string]any{
				"1": map[string]string{"public_key": base64.StdEncoding.EncodeToString(v1)},
				"4": map[string]string{"public_key": base64.StdEncoding.EncodeToString(v4)},
			},
		}})
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	client.setToken("runtime-token")
	runtime := &Runtime{client: client}
	runtime.installKeyInfo(TransitKeyInfo{LatestVersion: 1, PublicKeys: TransitPublicKeys{"v1": v1}})
	runtime.ready.Store(true)

	key, found, err := runtime.PublicKey(context.Background(), "v4")
	if err != nil || !found || !bytes.Equal(key, v4) {
		t.Fatalf("PublicKey(v4) = %x, %v, %v; want refreshed key", key, found, err)
	}
	if requests.Load() != 1 {
		t.Fatalf("multi-rotation catch-up caused %d Vault requests, want 1", requests.Load())
	}
}

func TestRuntimeRejectsTransitKeyBeyondCatchUpBound(t *testing.T) {
	t.Parallel()

	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		requests.Add(1)
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	client.setToken("runtime-token")
	runtime := &Runtime{client: client}
	runtime.installKeyInfo(TransitKeyInfo{
		LatestVersion: 1,
		PublicKeys:    TransitPublicKeys{"v1": make(ed25519.PublicKey, ed25519.PublicKeySize)},
	})
	runtime.ready.Store(true)

	keyID := fmt.Sprintf("v%d", 1+maxKeyCatchUp+1)
	if _, found, err := runtime.PublicKey(context.Background(), keyID); err != nil || found {
		t.Fatalf("PublicKey(%s) = found %v, error %v; want bounded rejection", keyID, found, err)
	}
	if requests.Load() != 0 {
		t.Fatalf("out-of-bound key lookup caused %d Vault requests", requests.Load())
	}
}

func TestRuntimeBoundsCachedTransitKeySet(t *testing.T) {
	t.Parallel()

	keys := make(TransitPublicKeys)
	for version := 1; version <= maxCachedPublicKeys+8; version++ {
		keys[fmt.Sprintf("v%d", version)] = make(ed25519.PublicKey, ed25519.PublicKeySize)
	}
	runtime := &Runtime{}
	runtime.installKeyInfo(TransitKeyInfo{LatestVersion: maxCachedPublicKeys + 8, PublicKeys: keys})

	if len(runtime.publicKeys) != maxCachedPublicKeys {
		t.Fatalf("cached key count = %d, want %d", len(runtime.publicKeys), maxCachedPublicKeys)
	}
	if _, found := runtime.publicKeys["v1"]; found {
		t.Fatal("bounded key cache retained the oldest key")
	}
	if _, found := runtime.publicKeys[fmt.Sprintf("v%d", maxCachedPublicKeys+8)]; !found {
		t.Fatal("bounded key cache omitted the latest key")
	}
}

func TestRuntimeStartRequiresTransitPublicKeys(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/auth/approle/login":
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
		case "/v1/kv/data/auth/refresh-successor":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{
				"cipher_key": "a-dedicated-refresh-successor-key-long-enough",
			}}})
		case "/v1/database/creds/auth-runtime":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{
				"lease_id": "database-lease", "lease_duration": 28_800, "renewable": true,
				"data": map[string]string{"username": "v-auth", "password": "database-password"},
			})
		case "/v1/transit/keys/auth-access-jwt":
			requireVaultToken(t, r)
			http.Error(w, "Transit unavailable", http.StatusServiceUnavailable)
		default:
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
	poolRefreshes := 0
	runtime, err := NewRuntime(RuntimeConfig{
		Address: server.URL, RoleIDFile: roleIDFile, SecretIDFile: secretIDFile, DatabaseRole: "auth-runtime",
	}, func(context.Context, DatabaseCredentials) error {
		poolRefreshes++
		return nil
	})
	if err != nil {
		t.Fatalf("NewRuntime() error = %v", err)
	}
	if _, err := runtime.Start(context.Background()); err == nil {
		t.Fatal("Start() succeeded without Transit public-key availability")
	}
	if runtime.Ready() || poolRefreshes != 0 {
		t.Fatalf("failed startup ready = %v, pool refreshes = %d", runtime.Ready(), poolRefreshes)
	}
}

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
		case "/v1/kv/data/auth/refresh-successor":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{
				"cipher_key": "a-dedicated-refresh-successor-key-long-enough",
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
			var body map[string]string
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Errorf("decode Transit signing request: %v", err)
			}
			if body["key_version"] != "1" {
				t.Errorf("Transit key_version = %q, want 1", body["key_version"])
			}
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
	if secrets.RefreshSuccessorCipherKey != "a-dedicated-refresh-successor-key-long-enough" {
		t.Errorf("ReadSecrets() refresh successor key = %q", secrets.RefreshSuccessorCipherKey)
	}
	credentials, err := client.IssueDatabaseCredentials(context.Background(), "auth-runtime")
	if err != nil {
		t.Fatalf("IssueDatabaseCredentials() error = %v", err)
	}
	if credentials.Username != "v-auth" {
		t.Errorf("IssueDatabaseCredentials() username = %q, want v-auth", credentials.Username)
	}
	signature, err := client.Sign(context.Background(), "v1", []byte("jwt signing input"))
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
			"lease_id":       "previous-lease",
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

func TestRenewDatabaseCredentialsRejectsUnexpectedLeaseID(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requireVaultToken(t, r)
		writeTestJSON(t, w, map[string]any{
			"lease_id":       "different-lease",
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
	_, err = client.RenewDatabaseCredentials(context.Background(), DatabaseCredentials{
		Username: "v-auth", Password: "database-password", LeaseID: "previous-lease",
	})
	if err == nil {
		t.Fatal("RenewDatabaseCredentials() error = nil, want lease mismatch rejection")
	}
}

func TestRuntimeRetainsRenewedTokenDeadlineAfterDatabaseRenewalFailure(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requireVaultToken(t, r)
		switch r.URL.Path {
		case "/v1/auth/token/renew-self":
			writeTestJSON(t, w, map[string]any{"auth": map[string]any{
				"lease_duration": 3600, "renewable": true,
			}})
		case "/v1/sys/leases/renew":
			http.Error(w, "temporary database renewal failure", http.StatusInternalServerError)
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
	client.setToken("runtime-token")
	before := time.Now()
	runtime := &Runtime{
		client: client,
		database: DatabaseCredentials{
			Username: "v-auth", Password: "database-password", LeaseID: "database-lease",
		},
		tokenExpiresAt: before.Add(time.Minute),
	}

	if err := runtime.renew(context.Background()); err == nil {
		t.Fatal("renew() error = nil, want database renewal failure")
	}
	if runtime.tokenExpiresAt.Before(before.Add(59 * time.Minute)) {
		t.Errorf("token expiry = %s, want refreshed deadline after database failure", runtime.tokenExpiresAt)
	}
}

func TestRuntimeReissuesDatabaseCredentialsAtLeaseRenewalLimit(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requireVaultToken(t, r)
		switch r.URL.Path {
		case "/v1/auth/token/renew-self":
			writeTestJSON(t, w, map[string]any{"auth": map[string]any{
				"lease_duration": 3600, "renewable": true,
			}})
		case "/v1/sys/leases/renew":
			http.Error(w, "lease renewal exceeds maximum TTL", http.StatusBadRequest)
		case "/v1/database/creds/auth-runtime":
			writeTestJSON(t, w, map[string]any{
				"lease_id":       "replacement-lease",
				"lease_duration": 28_800,
				"renewable":      true,
				"data":           map[string]string{"username": "v-auth-replacement", "password": "replacement-password"},
			})
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
	client.setToken("runtime-token")
	refreshes := 0
	runtime := &Runtime{
		client: client,
		config: RuntimeConfig{
			DatabaseRole: "auth-runtime",
		},
		refreshDatabase: func(context.Context, DatabaseCredentials) error {
			refreshes++
			return nil
		},
		database: DatabaseCredentials{
			Username: "v-auth", Password: "database-password", LeaseID: "database-lease",
		},
		tokenExpiresAt: time.Now().Add(time.Minute),
	}

	if err := runtime.renew(context.Background()); err != nil {
		t.Fatalf("renew() error = %v", err)
	}
	if runtime.database.LeaseID != "replacement-lease" || refreshes != 1 {
		t.Errorf("renew() did not replace the exhausted database lease: %#v, refreshes=%d", runtime.database, refreshes)
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
		case "/v1/kv/data/auth/refresh-successor":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{"data": map[string]any{"data": map[string]string{
				"cipher_key": "a-dedicated-refresh-successor-key-long-enough",
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
		case "/v1/transit/keys/auth-access-jwt":
			requireVaultToken(t, r)
			writeTestJSON(t, w, map[string]any{"data": map[string]any{
				"latest_version": 1,
				"keys": map[string]any{
					"1": map[string]string{"public_key": base64.StdEncoding.EncodeToString(make([]byte, ed25519.PublicKeySize))},
				},
			}})
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
