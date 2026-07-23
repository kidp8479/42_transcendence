package vault

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

const (
	renewalSafetyMargin = time.Minute
	retryInterval       = 15 * time.Second
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
	credentials, err := r.client.IssueDatabaseCredentials(ctx, r.config.DatabaseRole)
	if err != nil {
		return Secrets{}, err
	}
	if err := r.refreshDatabase(ctx, credentials); err != nil {
		return Secrets{}, fmt.Errorf("connect with Vault database credentials: %w", err)
	}
	now := time.Now()
	r.tokenExpiresAt = now.Add(token.LeaseDuration)
	r.databaseExpiresAt = now.Add(credentials.LeaseDuration)
	r.database = credentials
	r.roleID = roleID
	r.secretID = secretID
	r.ready.Store(true)
	return secrets, nil
}

func (r *Runtime) Run(ctx context.Context) {
	for {
		delay := renewalDelay(time.Until(r.tokenExpiresAt), time.Until(r.databaseExpiresAt))
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}

		if err := r.renew(ctx); err != nil {
			if isAuthorizationError(err) ||
				time.Until(r.tokenExpiresAt) <= renewalSafetyMargin ||
				time.Until(r.databaseExpiresAt) <= renewalSafetyMargin {
				r.ready.Store(false)
				log.Printf("Vault credentials can no longer be renewed before expiry: %v", err)
				return
			}
			log.Printf("Vault credential renewal failed; retrying before expiry: %v", err)
			if !wait(ctx, retryInterval) {
				return
			}
		}
	}
}

func (r *Runtime) Ready() bool {
	return r.ready.Load()
}

func (r *Runtime) Sign(ctx context.Context, value []byte) (string, error) {
	if !r.Ready() {
		return "", fmt.Errorf("Vault runtime is not ready")
	}
	return r.client.Sign(ctx, value)
}

func (r *Runtime) renew(ctx context.Context) error {
	token, err := r.client.RenewToken(ctx)
	if err != nil {
		return r.reauthenticate(ctx)
	}
	credentials, err := r.client.RenewDatabaseCredentials(ctx, r.database)
	if err != nil {
		return err
	}
	if err := r.refreshDatabase(ctx, credentials); err != nil {
		return fmt.Errorf("refresh database pool: %w", err)
	}
	now := time.Now()
	r.tokenExpiresAt = now.Add(token.LeaseDuration)
	r.databaseExpiresAt = now.Add(credentials.LeaseDuration)
	r.database = credentials
	return nil
}

func (r *Runtime) reauthenticate(ctx context.Context) error {
	token, err := r.client.Login(ctx, r.roleID, r.secretID)
	if err != nil {
		return fmt.Errorf("renew Vault token or reauthenticate: %w", err)
	}
	credentials, err := r.client.IssueDatabaseCredentials(ctx, r.config.DatabaseRole)
	if err != nil {
		return fmt.Errorf("issue database credentials after Vault reauthentication: %w", err)
	}
	if err := r.refreshDatabase(ctx, credentials); err != nil {
		return fmt.Errorf("refresh database pool after Vault reauthentication: %w", err)
	}
	now := time.Now()
	r.tokenExpiresAt = now.Add(token.LeaseDuration)
	r.databaseExpiresAt = now.Add(credentials.LeaseDuration)
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
