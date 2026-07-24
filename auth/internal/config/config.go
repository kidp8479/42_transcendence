package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultPort            = "3001"
	defaultCookieName      = "tr_session"
	defaultCSRFCookieName  = "tr_csrf"
	defaultIdleTimeout     = 30 * time.Minute
	defaultAbsoluteTimeout = 7 * 24 * time.Hour
	defaultVaultDBHost     = "db"
	defaultVaultDBPort     = "5432"
)

type Config struct {
	Port                   string
	AppOrigin              string
	InternalToken          string
	SessionCookieName      string
	CSRFCookieName         string
	CookieSecure           bool
	SessionIdleTimeout     time.Duration
	SessionAbsoluteTimeout time.Duration
	VaultAddress           string
	VaultRoleIDFile        string
	VaultSecretIDFile      string
	VaultDatabaseRole      string
	VaultDatabaseHost      string
	VaultDatabasePort      string
	VaultDatabaseName      string
}

func Load() (Config, error) {
	cfg := Config{
		Port:                   envOrDefault("PORT", defaultPort),
		AppOrigin:              strings.TrimRight(strings.TrimSpace(os.Getenv("APP_ORIGIN")), "/"),
		SessionCookieName:      envOrDefault("AUTH_SESSION_COOKIE", defaultCookieName),
		CSRFCookieName:         envOrDefault("AUTH_CSRF_COOKIE", defaultCSRFCookieName),
		SessionIdleTimeout:     defaultIdleTimeout,
		SessionAbsoluteTimeout: defaultAbsoluteTimeout,
		VaultAddress:           strings.TrimRight(strings.TrimSpace(os.Getenv("VAULT_ADDR")), "/"),
		VaultRoleIDFile:        strings.TrimSpace(os.Getenv("VAULT_ROLE_ID_FILE")),
		VaultSecretIDFile:      strings.TrimSpace(os.Getenv("VAULT_SECRET_ID_FILE")),
		VaultDatabaseRole:      strings.TrimSpace(os.Getenv("VAULT_DB_ROLE")),
		VaultDatabaseHost:      envOrDefault("VAULT_DB_HOST", defaultVaultDBHost),
		VaultDatabasePort:      envOrDefault("VAULT_DB_PORT", defaultVaultDBPort),
		VaultDatabaseName:      strings.TrimSpace(os.Getenv("VAULT_DB_NAME")),
	}

	if err := validateVaultConfig(cfg); err != nil {
		return Config{}, err
	}
	if cfg.AppOrigin == "" {
		return Config{}, fmt.Errorf("APP_ORIGIN is required")
	}
	origin, err := url.Parse(cfg.AppOrigin)
	if err != nil || origin.Scheme == "" || origin.Host == "" || origin.Path != "" {
		return Config{}, fmt.Errorf("APP_ORIGIN must be an origin such as http://localhost:8080")
	}
	cfg.CookieSecure, err = parseBool("AUTH_COOKIE_SECURE", false)
	if err != nil {
		return Config{}, err
	}
	if origin.Scheme == "https" && !cfg.CookieSecure {
		return Config{}, fmt.Errorf("AUTH_COOKIE_SECURE must be true when APP_ORIGIN uses https")
	}
	cfg.SessionIdleTimeout, err = parseDuration("AUTH_SESSION_IDLE_TIMEOUT", defaultIdleTimeout)
	if err != nil {
		return Config{}, err
	}
	cfg.SessionAbsoluteTimeout, err = parseDuration("AUTH_SESSION_ABSOLUTE_TIMEOUT", defaultAbsoluteTimeout)
	if err != nil {
		return Config{}, err
	}
	if cfg.SessionIdleTimeout <= 0 || cfg.SessionAbsoluteTimeout <= cfg.SessionIdleTimeout {
		return Config{}, fmt.Errorf("session timeouts must be positive and absolute timeout must exceed idle timeout")
	}

	return cfg, nil
}

func validateVaultConfig(cfg Config) error {
	address, err := url.Parse(cfg.VaultAddress)
	if err != nil || (address.Scheme != "http" && address.Scheme != "https") || address.Host == "" {
		return fmt.Errorf("VAULT_ADDR must be an http or https URL")
	}
	if cfg.VaultRoleIDFile == "" {
		return fmt.Errorf("VAULT_ROLE_ID_FILE is required")
	}
	if cfg.VaultSecretIDFile == "" {
		return fmt.Errorf("VAULT_SECRET_ID_FILE is required")
	}
	if cfg.VaultDatabaseRole == "" {
		return fmt.Errorf("VAULT_DB_ROLE is required")
	}
	if cfg.VaultDatabaseHost == "" || cfg.VaultDatabasePort == "" || cfg.VaultDatabaseName == "" {
		return fmt.Errorf("VAULT_DB_HOST, VAULT_DB_PORT, and VAULT_DB_NAME are required")
	}
	if _, err := strconv.ParseUint(cfg.VaultDatabasePort, 10, 16); err != nil {
		return fmt.Errorf("VAULT_DB_PORT must be a valid port")
	}
	return nil
}

func envOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func parseBool(name string, fallback bool) (bool, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s must be a boolean: %w", name, err)
	}
	return parsed, nil
}

func parseDuration(name string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be a Go duration: %w", name, err)
	}
	return parsed, nil
}
