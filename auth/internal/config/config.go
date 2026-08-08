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
	defaultPort           = "3001"
	maxRefreshIdleTTL     = 7 * 24 * time.Hour
	maxRefreshAbsoluteTTL = 30 * 24 * time.Hour
	maxJWTAccessTTL       = 15 * time.Minute
	maxJWTLeeway          = time.Minute
	defaultVaultDBHost    = "db"
	defaultVaultDBPort    = "5432"
)

type Config struct {
	Port                         string
	AppOrigin                    string
	OAuthProvidersCallbackOrigin string
	RefreshCookieName            string
	CSRFCookieName               string
	CookieSecure                 bool
	RefreshIdleTTL               time.Duration
	RefreshAbsoluteTTL           time.Duration
	JWTIssuer                    string
	JWTAudience                  string
	JWTAccessTTL                 time.Duration
	JWTLeeway                    time.Duration
	VaultAddress                 string
	VaultRoleIDFile              string
	VaultSecretIDFile            string
	VaultDatabaseRole            string
	VaultDatabaseHost            string
	VaultDatabasePort            string
	VaultDatabaseName            string
}

func Load() (Config, error) {
	cfg := Config{
		Port:                         envOrDefault("PORT", defaultPort),
		AppOrigin:                    strings.TrimRight(strings.TrimSpace(os.Getenv("APP_ORIGIN")), "/"),
		OAuthProvidersCallbackOrigin: strings.TrimRight(strings.TrimSpace(os.Getenv("AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN")), "/"),
		RefreshCookieName:            strings.TrimSpace(os.Getenv("AUTH_REFRESH_COOKIE")),
		CSRFCookieName:               strings.TrimSpace(os.Getenv("AUTH_CSRF_COOKIE")),
		JWTIssuer:                    strings.TrimSpace(os.Getenv("AUTH_JWT_ISSUER")),
		JWTAudience:                  strings.TrimSpace(os.Getenv("AUTH_JWT_AUDIENCE")),
		VaultAddress:                 strings.TrimRight(strings.TrimSpace(os.Getenv("VAULT_ADDR")), "/"),
		VaultRoleIDFile:              strings.TrimSpace(os.Getenv("VAULT_ROLE_ID_FILE")),
		VaultSecretIDFile:            strings.TrimSpace(os.Getenv("VAULT_SECRET_ID_FILE")),
		VaultDatabaseRole:            strings.TrimSpace(os.Getenv("VAULT_DB_ROLE")),
		VaultDatabaseHost:            envOrDefault("VAULT_DB_HOST", defaultVaultDBHost),
		VaultDatabasePort:            envOrDefault("VAULT_DB_PORT", defaultVaultDBPort),
		VaultDatabaseName:            strings.TrimSpace(os.Getenv("VAULT_DB_NAME")),
	}
	var err error

	if err := validateVaultConfig(cfg); err != nil {
		return Config{}, err
	}
	if cfg.AppOrigin == "" {
		return Config{}, fmt.Errorf("APP_ORIGIN is required")
	}
	if !isValidConfiguredBrowserOrigin(cfg.AppOrigin) {
		return Config{}, fmt.Errorf("APP_ORIGIN must be an origin such as https://localhost:8443 or https://*.paris.42.school:8443")
	}
	if cfg.OAuthProvidersCallbackOrigin != "" && !isValidConcreteOrigin(cfg.OAuthProvidersCallbackOrigin) {
		return Config{}, fmt.Errorf("AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN must be a concrete http or https origin")
	}
	cfg.CookieSecure, err = parseRequiredBool("AUTH_COOKIE_SECURE")
	if err != nil {
		return Config{}, err
	}
	if strings.HasPrefix(cfg.AppOrigin, "https://") && !cfg.CookieSecure {
		return Config{}, fmt.Errorf("AUTH_COOKIE_SECURE must be true when APP_ORIGIN uses https")
	}
	cfg.RefreshIdleTTL, err = parseRequiredDuration("AUTH_REFRESH_IDLE_TTL")
	if err != nil {
		return Config{}, err
	}
	cfg.RefreshAbsoluteTTL, err = parseRequiredDuration("AUTH_REFRESH_ABSOLUTE_TTL")
	if err != nil {
		return Config{}, err
	}
	if cfg.RefreshIdleTTL <= 0 || cfg.RefreshIdleTTL > maxRefreshIdleTTL {
		return Config{}, fmt.Errorf("AUTH_REFRESH_IDLE_TTL must be positive and no more than 7d")
	}
	if cfg.RefreshAbsoluteTTL <= cfg.RefreshIdleTTL || cfg.RefreshAbsoluteTTL > maxRefreshAbsoluteTTL {
		return Config{}, fmt.Errorf("AUTH_REFRESH_ABSOLUTE_TTL must exceed idle lifetime and be no more than 30d")
	}
	cfg.JWTAccessTTL, err = parseRequiredDuration("AUTH_JWT_ACCESS_TTL")
	if err != nil {
		return Config{}, err
	}
	if cfg.JWTAccessTTL <= 0 || cfg.JWTAccessTTL > maxJWTAccessTTL {
		return Config{}, fmt.Errorf("AUTH_JWT_ACCESS_TTL must be positive and no more than 15m")
	}
	cfg.JWTLeeway, err = parseRequiredDuration("AUTH_JWT_LEEWAY")
	if err != nil {
		return Config{}, err
	}
	if cfg.JWTLeeway < 0 || cfg.JWTLeeway > maxJWTLeeway {
		return Config{}, fmt.Errorf("AUTH_JWT_LEEWAY must be between 0 and 1m")
	}
	if cfg.JWTIssuer == "" || cfg.JWTAudience == "" {
		return Config{}, fmt.Errorf("AUTH_JWT_ISSUER and AUTH_JWT_AUDIENCE are required")
	}
	if cfg.RefreshCookieName == "" || cfg.CSRFCookieName == "" || cfg.RefreshCookieName == cfg.CSRFCookieName {
		return Config{}, fmt.Errorf("refresh and CSRF cookie names must be distinct and non-empty")
	}

	return cfg, nil
}

func (cfg Config) AllowsBrowserOrigin(origin string) bool {
	if cfg.AppOrigin != "https://*.paris.42.school:8443" {
		return origin == cfg.AppOrigin
	}

	parsed, err := url.Parse(origin)
	if err != nil ||
		parsed.Scheme != "https" ||
		parsed.Port() != "8443" ||
		parsed.Path != "" ||
		parsed.RawQuery != "" ||
		parsed.Fragment != "" ||
		parsed.User != nil {
		return false
	}
	labels := strings.Split(strings.ToLower(parsed.Hostname()), ".")
	return len(labels) == 4 &&
		labels[0] != "" &&
		labels[0] != "*" &&
		labels[1] == "paris" &&
		labels[2] == "42" &&
		labels[3] == "school"
}

func isValidConfiguredBrowserOrigin(origin string) bool {
	if origin == "https://*.paris.42.school:8443" {
		return true
	}
	parsed, err := url.Parse(origin)
	return err == nil &&
		(parsed.Scheme == "http" || parsed.Scheme == "https") &&
		parsed.Host != "" &&
		parsed.Path == "" &&
		parsed.RawQuery == "" &&
		parsed.Fragment == "" &&
		parsed.User == nil
}

func isValidConcreteOrigin(origin string) bool {
	parsed, err := url.Parse(origin)
	return err == nil &&
		(parsed.Scheme == "http" || parsed.Scheme == "https") &&
		parsed.Host != "" &&
		!strings.Contains(parsed.Hostname(), "*") &&
		parsed.Path == "" &&
		parsed.RawQuery == "" &&
		parsed.Fragment == "" &&
		parsed.User == nil
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

func parseRequiredBool(name string) (bool, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return false, fmt.Errorf("%s is required", name)
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s must be a boolean: %w", name, err)
	}
	return parsed, nil
}

func parseRequiredDuration(name string) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return 0, fmt.Errorf("%s is required", name)
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be a Go duration: %w", name, err)
	}
	return parsed, nil
}
