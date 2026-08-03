package vault

import (
	"context"
	"crypto/ed25519"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	renewalSafetyMargin = time.Minute
	retryInterval       = 15 * time.Second
	maxCachedPublicKeys = 32
	maxNegativeKeyIDs   = 64
	negativeKeyTTL      = 30 * time.Second
	keySetTTL           = time.Minute
	maxKeyCatchUp       = maxCachedPublicKeys
)

type RuntimeConfig struct {
	Address      string
	RoleIDFile   string
	SecretIDFile string
	DatabaseRole string
}

type DatabaseRefresher func(context.Context, DatabaseCredentials) error

type Runtime struct {
	client            *Client
	config            RuntimeConfig
	refreshDatabase   DatabaseRefresher
	ready             atomic.Bool
	tokenExpiresAt    time.Time
	databaseExpiresAt time.Time
	database          DatabaseCredentials
	roleID            string
	secretID          string
	keyMu             sync.Mutex
	publicKeys        TransitPublicKeys
	latestKeyVersion  int
	keySetRefreshedAt time.Time
	negativeKeyIDs    map[string]time.Time
	unknownKeyChecked time.Time
	keyRefreshDone    chan struct{}
	keyRefreshErr     error
}

func NewRuntime(config RuntimeConfig, refreshDatabase DatabaseRefresher) (*Runtime, error) {
	if config.RoleIDFile == "" || config.SecretIDFile == "" || config.DatabaseRole == "" {
		return nil, fmt.Errorf("Vault role ID file, Secret ID file, and database role are required")
	}
	if refreshDatabase == nil {
		return nil, fmt.Errorf("Vault database refresher is required")
	}
	client, err := NewClient(config.Address)
	if err != nil {
		return nil, err
	}
	return &Runtime{client: client, config: config, refreshDatabase: refreshDatabase}, nil
}

func (r *Runtime) Start(ctx context.Context) (Secrets, error) {
	roleID, err := readIDFile(r.config.RoleIDFile, "Role ID")
	if err != nil {
		return Secrets{}, err
	}
	secretID, err := readIDFile(r.config.SecretIDFile, "Secret ID")
	if err != nil {
		return Secrets{}, err
	}
	token, err := r.client.Login(ctx, roleID, secretID)
	if err != nil {
		return Secrets{}, err
	}
	secrets, err := r.client.ReadSecrets(ctx)
	if err != nil {
		return Secrets{}, err
	}
	keyInfo, err := r.client.TransitKeyInfo(ctx)
	if err != nil {
		return Secrets{}, fmt.Errorf("load Transit public keys: %w", err)
	}
	credentials, err := r.client.IssueDatabaseCredentials(ctx, r.config.DatabaseRole)
	if err != nil {
		return Secrets{}, err
	}
	if err := r.refreshDatabase(ctx, credentials); err != nil {
		return Secrets{}, fmt.Errorf("connect with Vault database credentials: %w", err)
	}
	r.installKeyInfo(keyInfo)
	now := time.Now()
	r.tokenExpiresAt = now.Add(token.LeaseDuration)
	r.databaseExpiresAt = now.Add(credentials.LeaseDuration)
	r.database = credentials
	r.roleID = roleID
	r.secretID = secretID
	r.ready.Store(true)
	return secrets, nil
}

func (r *Runtime) Run(ctx context.Context) error {
	for {
		delay := renewalDelay(time.Until(r.tokenExpiresAt), time.Until(r.databaseExpiresAt))
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil
		case <-timer.C:
		}

		if err := r.renew(ctx); err != nil {
			if isAuthorizationError(err) ||
				time.Until(r.tokenExpiresAt) <= renewalSafetyMargin ||
				time.Until(r.databaseExpiresAt) <= renewalSafetyMargin {
				r.ready.Store(false)
				return fmt.Errorf("Vault credentials can no longer be renewed before expiry: %w", err)
			}
			log.Printf("Vault credential renewal failed; retrying before expiry: %v", err)
			if !wait(ctx, retryInterval) {
				return nil
			}
		}
	}
}

func (r *Runtime) Ready() bool {
	return r.ready.Load()
}

func (r *Runtime) Sign(ctx context.Context, keyID string, value []byte) (string, error) {
	if !r.Ready() {
		return "", fmt.Errorf("Vault runtime is not ready")
	}
	return r.client.Sign(ctx, keyID, value)
}

func (r *Runtime) SigningKeyID(ctx context.Context) (string, error) {
	if !r.Ready() {
		return "", fmt.Errorf("Vault runtime is not ready")
	}
	r.keyMu.Lock()
	version := r.latestKeyVersion
	refreshedAt := r.keySetRefreshedAt
	r.keyMu.Unlock()
	if version <= 0 || time.Since(refreshedAt) >= keySetTTL {
		if err := r.refreshPublicKeys(ctx, false, ""); err != nil {
			return "", err
		}
		r.keyMu.Lock()
		version = r.latestKeyVersion
		r.keyMu.Unlock()
	}
	if version <= 0 {
		return "", fmt.Errorf("Transit signing key is unavailable")
	}
	return fmt.Sprintf("v%d", version), nil
}

func (r *Runtime) PublicKey(ctx context.Context, keyID string) (ed25519.PublicKey, bool, error) {
	if !r.Ready() {
		return nil, false, fmt.Errorf("Vault runtime is not ready")
	}
	version, acceptable := transitKeyVersion(keyID)
	if !acceptable {
		return nil, false, nil
	}
	now := time.Now()
	r.keyMu.Lock()
	key := r.publicKeys[keyID]
	if len(key) == ed25519.PublicKeySize {
		r.keyMu.Unlock()
		return append(ed25519.PublicKey(nil), key...), true, nil
	}
	if expiry, found := r.negativeKeyIDs[keyID]; found && expiry.After(now) {
		r.keyMu.Unlock()
		return nil, false, nil
	}
	latest := r.latestKeyVersion
	unknownKeyChecked := r.unknownKeyChecked
	r.keyMu.Unlock()

	// A verifier-only replica may miss several rotations. Permit one coalesced
	// Vault refresh within the bounded retained-key window; old or implausibly
	// distant versions never trigger Vault traffic.
	if latest > 0 && (version <= latest || version > latest+maxKeyCatchUp) {
		r.rememberUnknownKey(keyID, now)
		return nil, false, nil
	}
	if !unknownKeyChecked.IsZero() && now.Sub(unknownKeyChecked) < negativeKeyTTL {
		r.rememberUnknownKey(keyID, now)
		return nil, false, nil
	}
	if err := r.refreshPublicKeys(ctx, true, keyID); err != nil {
		return nil, false, err
	}
	r.keyMu.Lock()
	key = r.publicKeys[keyID]
	r.keyMu.Unlock()
	if len(key) != ed25519.PublicKeySize {
		return nil, false, nil
	}
	return append(ed25519.PublicKey(nil), key...), true, nil
}

func (r *Runtime) refreshPublicKeys(ctx context.Context, force bool, unknownKeyID string) error {
	r.keyMu.Lock()
	if !force && r.latestKeyVersion > 0 && time.Since(r.keySetRefreshedAt) < keySetTTL {
		r.keyMu.Unlock()
		return nil
	}
	if done := r.keyRefreshDone; done != nil {
		r.keyMu.Unlock()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-done:
		}
		r.keyMu.Lock()
		err := r.keyRefreshErr
		if err == nil && unknownKeyID != "" && len(r.publicKeys[unknownKeyID]) != ed25519.PublicKeySize {
			r.rememberUnknownKeyLocked(unknownKeyID, time.Now())
		}
		r.keyMu.Unlock()
		return err
	}
	done := make(chan struct{})
	r.keyRefreshDone = done
	if unknownKeyID != "" {
		r.unknownKeyChecked = time.Now()
	}
	r.keyMu.Unlock()

	info, err := r.client.TransitKeyInfo(ctx)

	r.keyMu.Lock()
	if err == nil {
		r.installKeyInfoLocked(info)
		if unknownKeyID != "" && len(r.publicKeys[unknownKeyID]) != ed25519.PublicKeySize {
			r.rememberUnknownKeyLocked(unknownKeyID, time.Now())
		}
	}
	r.keyRefreshErr = err
	r.keyRefreshDone = nil
	close(done)
	r.keyMu.Unlock()
	return err
}

func (r *Runtime) installKeyInfo(info TransitKeyInfo) {
	r.keyMu.Lock()
	defer r.keyMu.Unlock()
	r.installKeyInfoLocked(info)
}

func (r *Runtime) installKeyInfoLocked(info TransitKeyInfo) {
	versions := make([]int, 0, len(info.PublicKeys))
	for keyID := range info.PublicKeys {
		version, ok := transitKeyVersion(keyID)
		if ok && version <= info.LatestVersion {
			versions = append(versions, version)
		}
	}
	sort.Sort(sort.Reverse(sort.IntSlice(versions)))
	if len(versions) > maxCachedPublicKeys {
		versions = versions[:maxCachedPublicKeys]
	}
	keys := make(TransitPublicKeys, len(versions))
	for _, version := range versions {
		keyID := fmt.Sprintf("v%d", version)
		keys[keyID] = append(ed25519.PublicKey(nil), info.PublicKeys[keyID]...)
	}
	r.publicKeys = keys
	r.latestKeyVersion = info.LatestVersion
	r.keySetRefreshedAt = time.Now()
	r.negativeKeyIDs = make(map[string]time.Time)
}

func (r *Runtime) rememberUnknownKey(keyID string, now time.Time) {
	r.keyMu.Lock()
	defer r.keyMu.Unlock()
	r.rememberUnknownKeyLocked(keyID, now)
}

func (r *Runtime) rememberUnknownKeyLocked(keyID string, now time.Time) {
	if r.negativeKeyIDs == nil {
		r.negativeKeyIDs = make(map[string]time.Time)
	}
	for cachedKeyID, expiry := range r.negativeKeyIDs {
		if !expiry.After(now) {
			delete(r.negativeKeyIDs, cachedKeyID)
		}
	}
	if len(r.negativeKeyIDs) >= maxNegativeKeyIDs {
		var oldestKeyID string
		var oldestExpiry time.Time
		for cachedKeyID, expiry := range r.negativeKeyIDs {
			if oldestKeyID == "" || expiry.Before(oldestExpiry) {
				oldestKeyID, oldestExpiry = cachedKeyID, expiry
			}
		}
		delete(r.negativeKeyIDs, oldestKeyID)
	}
	r.negativeKeyIDs[keyID] = now.Add(negativeKeyTTL)
}

func (r *Runtime) renew(ctx context.Context) error {
	token, err := r.client.RenewToken(ctx)
	if err != nil {
		return r.reauthenticate(ctx)
	}
	r.tokenExpiresAt = time.Now().Add(token.LeaseDuration)
	credentials, err := r.client.RenewDatabaseCredentials(ctx, r.database)
	if err != nil {
		if isLeaseRenewalLimit(err) {
			return r.issueDatabaseCredentials(ctx)
		}
		return err
	}
	if err := r.refreshDatabase(ctx, credentials); err != nil {
		return fmt.Errorf("refresh database pool: %w", err)
	}
	r.databaseExpiresAt = time.Now().Add(credentials.LeaseDuration)
	r.database = credentials
	return nil
}

func (r *Runtime) issueDatabaseCredentials(ctx context.Context) error {
	credentials, err := r.client.IssueDatabaseCredentials(ctx, r.config.DatabaseRole)
	if err != nil {
		return fmt.Errorf("issue replacement database credentials: %w", err)
	}
	if err := r.refreshDatabase(ctx, credentials); err != nil {
		return fmt.Errorf("refresh database pool with replacement credentials: %w", err)
	}
	r.databaseExpiresAt = time.Now().Add(credentials.LeaseDuration)
	r.database = credentials
	return nil
}

func (r *Runtime) reauthenticate(ctx context.Context) error {
	token, err := r.client.Login(ctx, r.roleID, r.secretID)
	if err != nil {
		return fmt.Errorf("renew Vault token or reauthenticate: %w", err)
	}
	r.tokenExpiresAt = time.Now().Add(token.LeaseDuration)
	credentials, err := r.client.IssueDatabaseCredentials(ctx, r.config.DatabaseRole)
	if err != nil {
		return fmt.Errorf("issue database credentials after Vault reauthentication: %w", err)
	}
	if err := r.refreshDatabase(ctx, credentials); err != nil {
		return fmt.Errorf("refresh database pool after Vault reauthentication: %w", err)
	}
	r.databaseExpiresAt = time.Now().Add(credentials.LeaseDuration)
	r.database = credentials
	return nil
}

func readIDFile(path, label string) (string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("read Vault %s file: %w", label, err)
	}
	if info.Mode().Perm()&0o077 != 0 {
		return "", fmt.Errorf("Vault %s file permissions are too broad", label)
	}
	value, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read Vault %s file: %w", label, err)
	}
	if trimmed := strings.TrimSpace(string(value)); trimmed != "" {
		return trimmed, nil
	}
	return "", fmt.Errorf("Vault %s file is empty", label)
}

func DatabaseURL(host, port, database string, credentials DatabaseCredentials) string {
	return (&url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(credentials.Username, credentials.Password),
		Host:   host + ":" + port,
		Path:   database,
		RawQuery: url.Values{
			"sslmode": []string{"disable"},
		}.Encode(),
	}).String()
}

func renewalDelay(tokenTTL, databaseTTL time.Duration) time.Duration {
	ttl := min(tokenTTL, databaseTTL)
	if ttl <= 2*renewalSafetyMargin {
		return ttl / 2
	}
	return ttl - renewalSafetyMargin
}

func wait(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func isAuthorizationError(err error) bool {
	var vaultError *HTTPError
	return errors.As(err, &vaultError) && (vaultError.StatusCode == http.StatusForbidden ||
		vaultError.StatusCode == http.StatusUnauthorized)
}

func isLeaseRenewalLimit(err error) bool {
	var vaultError *HTTPError
	return errors.As(err, &vaultError) && vaultError.StatusCode == http.StatusBadRequest
}
