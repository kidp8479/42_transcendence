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
)

type Config struct {
	Port                   string
	DatabaseURL            string
	AppOrigin              string
	InternalToken          string
	SessionCookieName      string
	CSRFCookieName         string
	CookieSecure           bool
	SessionIdleTimeout     time.Duration
	SessionAbsoluteTimeout time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Port:                   envOrDefault("PORT", defaultPort),
		DatabaseURL:            strings.TrimSpace(os.Getenv("DATABASE_URL")),
		AppOrigin:              strings.TrimRight(strings.TrimSpace(os.Getenv("APP_ORIGIN")), "/"),
		InternalToken:          strings.TrimSpace(os.Getenv("AUTH_INTERNAL_TOKEN")),
		SessionCookieName:      envOrDefault("AUTH_SESSION_COOKIE", defaultCookieName),
		CSRFCookieName:         envOrDefault("AUTH_CSRF_COOKIE", defaultCSRFCookieName),
		SessionIdleTimeout:     defaultIdleTimeout,
		SessionAbsoluteTimeout: defaultAbsoluteTimeout,
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.AppOrigin == "" {
		return Config{}, fmt.Errorf("APP_ORIGIN is required")
	}
	origin, err := url.Parse(cfg.AppOrigin)
	if err != nil || origin.Scheme == "" || origin.Host == "" || origin.Path != "" {
		return Config{}, fmt.Errorf("APP_ORIGIN must be an origin such as http://localhost:8080")
	}
	if len(cfg.InternalToken) < 32 {
		return Config{}, fmt.Errorf("AUTH_INTERNAL_TOKEN must be at least 32 characters")
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
