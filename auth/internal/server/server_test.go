package server

import (
	"net/http"
	"testing"
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
