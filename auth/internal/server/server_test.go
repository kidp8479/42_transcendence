package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/42london/42_transcendence/auth/internal/config"
)

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
