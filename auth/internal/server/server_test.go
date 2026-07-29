package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/42london/42_transcendence/auth/internal/config"
	"github.com/42london/42_transcendence/auth/internal/middleware"
	"github.com/42london/42_transcendence/auth/internal/password"
	"github.com/42london/42_transcendence/auth/internal/store"
)

type testAuthStore struct {
	credential           store.LocalCredential
	introspectionSession store.Session
	introspectionErr     error
	createSessionCalls   int
}

func (s *testAuthStore) CreateLocalAccount(context.Context, string, string, string) (store.User, error) {
	return store.User{}, nil
}

func (s *testAuthStore) FindLocalCredential(context.Context, string) (store.LocalCredential, error) {
	return s.credential, nil
}

func (s *testAuthStore) CreateSession(
	context.Context,
	store.User,
	string,
	time.Duration,
	time.Duration,
	*string,
	*string,
) (store.CreatedSession, error) {
	s.createSessionCalls++
	now := time.Now()
	return store.CreatedSession{
		Token:     "session-token",
		CSRFToken: "csrf-token",
		Session: store.Session{
			ID:                "session-id",
			IdleExpiresAt:     now.Add(time.Hour),
			AbsoluteExpiresAt: now.Add(time.Hour),
		},
	}, nil
}

func (s *testAuthStore) IntrospectSession(context.Context, string, time.Duration) (store.Session, error) {
	return s.introspectionSession, s.introspectionErr
}

func (s *testAuthStore) RevokeSession(context.Context, string) error {
	return nil
}

func (s *testAuthStore) RecordEvent(context.Context, *string, string, *string, *string, *string) error {
	return nil
}

func newLoginTestServer(t *testing.T, authStore authStore) *Server {
	t.Helper()
	return &Server{
		cfg: config.Config{
			AppOrigin:          "http://localhost:5173",
			SessionCookieName:  "tr_session",
			CSRFCookieName:     "tr_csrf",
			SessionIdleTimeout: time.Hour,
		},
		store:               authStore,
		passwords:           password.NewHasher(),
		loginIPLimiter:      middleware.NewFixedWindowLimiter(loginRequestsPerIP, rateLimitWindow, maxRateLimitEntries),
		loginAccountLimiter: middleware.NewFixedWindowLimiter(loginRequestsPerAccount, rateLimitWindow, maxRateLimitEntries),
		passwordSlots:       make(chan struct{}, passwordConcurrency),
	}
}

func TestHandleLoginRequiresActiveAccount(t *testing.T) {
	passwords := password.NewHasher()
	passwordHash, err := passwords.Hash("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	tests := []struct {
		name       string
		status     store.AccountStatus
		wantStatus int
		wantCreate int
	}{
		{
			name:       "active account creates a session",
			status:     store.AccountStatusActive,
			wantStatus: http.StatusOK,
			wantCreate: 1,
		},
		{
			name:       "pending approval account has generic login failure",
			status:     store.AccountStatusPendingApproval,
			wantStatus: http.StatusUnauthorized,
			wantCreate: 0,
		},
		{
			name:       "disabled account has generic login failure",
			status:     store.AccountStatusDisabled,
			wantStatus: http.StatusUnauthorized,
			wantCreate: 0,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			authStore := &testAuthStore{
				credential: store.LocalCredential{
					User: store.User{
						ID:     "user-id",
						Status: test.status,
					},
					PasswordHash: passwordHash,
				},
			}
			server := newLoginTestServer(t, authStore)
			request := httptest.NewRequest(
				http.MethodPost,
				"/auth/login",
				strings.NewReader(`{"email":"student@example.com","password":"correct horse battery staple"}`),
			)
			request.Header.Set("Origin", server.cfg.AppOrigin)
			response := httptest.NewRecorder()

			server.handleLogin(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("handleLogin() status = %d, want %d", response.Code, test.wantStatus)
			}
			if authStore.createSessionCalls != test.wantCreate {
				t.Errorf("CreateSession() calls = %d, want %d", authStore.createSessionCalls, test.wantCreate)
			}
			if test.wantStatus == http.StatusUnauthorized {
				if !strings.Contains(response.Body.String(), "invalid email or password") {
					t.Errorf("handleLogin() body = %q, want generic credential failure", response.Body.String())
				}
			}
		})
	}
}

func TestHandleIntrospectRejectsInactiveAccount(t *testing.T) {
	tests := []struct {
		name             string
		introspectionErr error
		want             int
	}{
		{name: "active account", want: http.StatusOK},
		{name: "pending approval account", introspectionErr: store.ErrNotFound, want: http.StatusUnauthorized},
		{name: "disabled account", introspectionErr: store.ErrNotFound, want: http.StatusUnauthorized},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			authStore := &testAuthStore{
				introspectionSession: store.Session{
					ID: "session-id",
					User: store.User{
						ID: "user-id",
					},
				},
				introspectionErr: test.introspectionErr,
			}
			server := &Server{
				cfg: config.Config{
					InternalToken:      "internal-token",
					SessionIdleTimeout: time.Hour,
				},
				store: authStore,
			}
			request := httptest.NewRequest(
				http.MethodPost,
				"/auth/internal/introspect",
				strings.NewReader(`{"sessionToken":"session-token","requestMethod":"GET"}`),
			)
			request.Header.Set("Authorization", "Bearer internal-token")
			response := httptest.NewRecorder()

			server.handleIntrospect(response, request)

			if response.Code != test.want {
				t.Fatalf("handleIntrospect() status = %d, want %d", response.Code, test.want)
			}
			if test.want == http.StatusUnauthorized && !strings.Contains(response.Body.String(), "SESSION_INACTIVE") {
				t.Errorf("handleIntrospect() body = %q, want inactive-session code", response.Body.String())
			}
		})
	}
}

func TestNormalizeEmail(t *testing.T) {
	t.Parallel()

	email, err := normalizeEmail("  Student@Example.COM ")
	if err != nil {
		t.Fatalf("normalizeEmail() error = %v", err)
	}
	if email != "student@example.com" {
		t.Fatalf("normalizeEmail() = %q, want student@example.com", email)
	}
}

func TestNormalizeEmailRejectsDisplayName(t *testing.T) {
	t.Parallel()

	if _, err := normalizeEmail("Student <student@example.com>"); err == nil {
		t.Fatal("normalizeEmail() error = nil, want display-name rejection")
	}
}

func TestRequiresCSRF(t *testing.T) {
	t.Parallel()

	tests := []struct {
		method string
		want   bool
	}{
		{method: http.MethodGet, want: false},
		{method: http.MethodHead, want: false},
		{method: http.MethodOptions, want: false},
		{method: http.MethodPost, want: true},
		{method: http.MethodPatch, want: true},
		{method: http.MethodDelete, want: true},
	}

	for _, test := range tests {
		if got := requiresCSRF(test.method); got != test.want {
			t.Errorf("requiresCSRF(%q) = %v, want %v", test.method, got, test.want)
		}
	}
}

func TestHandleSessionClearsCookiesWhenCSRFCookieIsMissing(t *testing.T) {
	t.Parallel()

	server := &Server{
		cfg: config.Config{
			SessionCookieName: "tr_session",
			CSRFCookieName:    "tr_csrf",
		},
	}

	request := httptest.NewRequest(http.MethodGet, "/auth/session", nil)
	request.AddCookie(&http.Cookie{Name: "tr_session", Value: "session-token"})
	response := httptest.NewRecorder()

	server.handleSession(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("handleSession() status = %d, want %d", response.Code, http.StatusUnauthorized)
	}

	cookies := response.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatalf("handleSession() cleared %d cookies, want 2", len(cookies))
	}
	for _, cookie := range cookies {
		if cookie.MaxAge != -1 {
			t.Errorf("cleared cookie %q MaxAge = %d, want -1", cookie.Name, cookie.MaxAge)
		}
	}
}

func TestHandleHealthFailsWhenRuntimeIsUnavailable(t *testing.T) {
	t.Parallel()

	server := &Server{ready: func() bool { return false }}
	response := httptest.NewRecorder()

	server.handleHealth(response, httptest.NewRequest(http.MethodGet, "/auth/health", nil))

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("handleHealth() status = %d, want %d", response.Code, http.StatusServiceUnavailable)
	}
}

func TestClientIP(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		remoteAddr string
		realIP     string
		want       string
	}{
		{
			name:       "trusted nginx header",
			remoteAddr: "172.20.0.5:41234",
			realIP:     "203.0.113.10",
			want:       "203.0.113.10",
		},
		{
			name:       "invalid header falls back to remote host",
			remoteAddr: "10.0.0.5:53122",
			realIP:     "spoofed",
			want:       "10.0.0.5",
		},
		{
			name:       "ipv6 remote address",
			remoteAddr: "[2001:db8::1]:53122",
			want:       "2001:db8::1",
		},
		{
			name:       "bare remote address",
			remoteAddr: "10.0.0.5",
			want:       "10.0.0.5",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/auth/session", nil)
			request.RemoteAddr = test.remoteAddr
			if test.realIP != "" {
				request.Header.Set("X-Real-IP", test.realIP)
			}

			if got := clientIP(request); got != test.want {
				t.Errorf("clientIP() = %q, want %q", got, test.want)
			}
		})
	}
}
