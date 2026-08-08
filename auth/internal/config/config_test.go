package config

import (
	"testing"
	"time"
)

func setRequiredEnvironment(t *testing.T) {
	t.Helper()
	for name, value := range map[string]string{
		"APP_ORIGIN":                "http://localhost:8080",
		"AUTH_COOKIE_SECURE":        "false",
		"AUTH_REFRESH_COOKIE":       "tr_refresh",
		"AUTH_CSRF_COOKIE":          "tr_csrf",
		"AUTH_REFRESH_IDLE_TTL":     "168h",
		"AUTH_REFRESH_ABSOLUTE_TTL": "720h",
		"AUTH_JWT_ISSUER":           "http://localhost:8080/auth",
		"AUTH_JWT_AUDIENCE":         "transcendence-api",
		"AUTH_JWT_ACCESS_TTL":       "15m",
		"AUTH_JWT_LEEWAY":           "30s",
		"VAULT_ADDR":                "http://vault:8200",
		"VAULT_ROLE_ID_FILE":        "/run/secrets/role-id",
		"VAULT_SECRET_ID_FILE":      "/run/secrets/secret-id",
		"VAULT_DB_ROLE":             "auth-runtime",
		"VAULT_DB_NAME":             "transcendence",
	} {
		t.Setenv(name, value)
	}
}

func TestLoadWiresExplicitJWTCutoverConfiguration(t *testing.T) {
	setRequiredEnvironment(t)
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.RefreshCookieName != "tr_refresh" ||
		cfg.RefreshIdleTTL != 7*24*time.Hour ||
		cfg.RefreshAbsoluteTTL != 30*24*time.Hour ||
		cfg.JWTAccessTTL != 15*time.Minute ||
		cfg.JWTLeeway != 30*time.Second {
		t.Fatalf("Load() explicit JWT/refresh values = %#v", cfg)
	}
}

func TestLoadRequiresEveryJWTCutoverSetting(t *testing.T) {
	for _, name := range []string{
		"AUTH_COOKIE_SECURE",
		"AUTH_REFRESH_COOKIE",
		"AUTH_CSRF_COOKIE",
		"AUTH_REFRESH_IDLE_TTL",
		"AUTH_REFRESH_ABSOLUTE_TTL",
		"AUTH_JWT_ISSUER",
		"AUTH_JWT_AUDIENCE",
		"AUTH_JWT_ACCESS_TTL",
		"AUTH_JWT_LEEWAY",
	} {
		t.Run(name, func(t *testing.T) {
			setRequiredEnvironment(t)
			t.Setenv(name, "")
			if _, err := Load(); err == nil {
				t.Fatalf("Load() accepted missing %s", name)
			}
		})
	}
}

func TestLoadRejectsLifetimeExpansion(t *testing.T) {
	setRequiredEnvironment(t)
	for name, value := range map[string]string{
		"AUTH_JWT_ACCESS_TTL":       "16m",
		"AUTH_JWT_LEEWAY":           "61s",
		"AUTH_REFRESH_IDLE_TTL":     "169h",
		"AUTH_REFRESH_ABSOLUTE_TTL": "721h",
	} {
		t.Run(name, func(t *testing.T) {
			t.Setenv(name, value)
			if _, err := Load(); err == nil {
				t.Fatalf("Load() accepted %s=%s", name, value)
			}
		})
	}
}

func TestLoadDoesNotFallBackToOpaqueSessionSettings(t *testing.T) {
	setRequiredEnvironment(t)
	t.Setenv("AUTH_REFRESH_COOKIE", "")
	t.Setenv("AUTH_SESSION_COOKIE", "legacy-session")
	t.Setenv("AUTH_SESSION_MODE", "opaque")
	t.Setenv("AUTH_SESSION_IDLE_TIMEOUT", "30m")
	t.Setenv("AUTH_SESSION_ABSOLUTE_TIMEOUT", "168h")
	if _, err := Load(); err == nil {
		t.Fatal("Load() accepted opaque session settings without explicit refresh settings")
	}
}

func TestAllowsBrowserOrigin(t *testing.T) {
	for _, test := range []struct {
		name       string
		configured string
		origin     string
		allowed    bool
	}{
		{"local exact origin", "https://localhost:8443", "https://localhost:8443", true},
		{"local wrong port", "https://localhost:8443", "https://localhost:8080", false},
		{"school computer", "https://*.paris.42.school:8443", "https://f6r13s1.paris.42.school:8443", true},
		{"school multi-label hostname", "https://*.paris.42.school:8443", "https://lab.f6r13s1.paris.42.school:8443", false},
		{"school wrong port", "https://*.paris.42.school:8443", "https://f6r13s1.paris.42.school:443", false},
		{"school lookalike", "https://*.paris.42.school:8443", "https://f6r13s1.paris.42.school.evil.example:8443", false},
		{"school wildcard sentinel", "https://*.paris.42.school:8443", "https://*.paris.42.school:8443", false},
		{"production rejects development", "https://tomato.iops.dev", "https://tomato-dev.iops.dev", false},
	} {
		t.Run(test.name, func(t *testing.T) {
			cfg := Config{AppOrigin: test.configured}
			if allowed := cfg.AllowsBrowserOrigin(test.origin); allowed != test.allowed {
				t.Fatalf("AllowsBrowserOrigin(%q) = %t, want %t", test.origin, allowed, test.allowed)
			}
		})
	}
}
