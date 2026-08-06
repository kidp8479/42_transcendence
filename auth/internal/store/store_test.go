package store

import (
	"testing"
	"time"
)

func TestClassifyRefreshUse(t *testing.T) {
	head := "head"
	next := "head"
	now := time.Now()
	activeGrace := now.Add(time.Second)
	expiredGrace := now.Add(-time.Second)

	for _, test := range []struct {
		name       string
		incoming   string
		replacedBy *string
		grace      *time.Time
		want       refreshUse
	}{
		{"current", head, nil, nil, refreshCurrent},
		{"immediately previous inside grace", "previous", &next, &activeGrace, refreshGrace},
		{"immediately previous after grace", "previous", &next, &expiredGrace, refreshReplay},
		{"unlinked token is replay", "unknown", nil, nil, refreshReplay},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := classifyRefreshUse(
				test.incoming, test.replacedBy, head, test.grace, now,
			); got != test.want {
				t.Fatalf("classifyRefreshUse() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestRefreshTokenCipherRecoversSuccessorWithoutPersistingPlaintext(t *testing.T) {
	refreshCipher, err := newRefreshTokenCipher("an-internal-credential-that-is-long-enough")
	if err != nil {
		t.Fatalf("newRefreshTokenCipher() error = %v", err)
	}
	const token = "raw-refresh-successor"
	ciphertext, err := refreshCipher.encrypt(token)
	if err != nil {
		t.Fatalf("encrypt() error = %v", err)
	}
	if ciphertext == token {
		t.Fatal("encrypted successor equals plaintext")
	}
	recovered, err := refreshCipher.decrypt(ciphertext)
	if err != nil {
		t.Fatalf("decrypt() error = %v", err)
	}
	if recovered != token {
		t.Fatalf("decrypt() = %q, want %q", recovered, token)
	}
}

func TestProjectAPITokenFormatAndHMAC(t *testing.T) {
	selector, err := randomToken(projectAPITokenSelectorSize)
	if err != nil {
		t.Fatalf("randomToken(selector): %v", err)
	}
	secret, err := randomToken(projectAPITokenSecretSize)
	if err != nil {
		t.Fatalf("randomToken(secret): %v", err)
	}
	raw := formatProjectAPIToken(selector, secret)
	gotSelector, gotSecret, ok := parseProjectAPIToken(raw)
	if !ok || gotSelector != selector || gotSecret != secret {
		t.Fatalf("parseProjectAPIToken(%q) = %q, %q, %v", raw, gotSelector, gotSecret, ok)
	}
	if _, _, ok := parseProjectAPIToken(raw + "x"); ok {
		t.Fatal("parseProjectAPIToken accepted a malformed token")
	}
	digest := projectAPITokenHMAC([]byte("test-project-api-token-pepper-long-enough"), selector, secret)
	if len(digest) != 64 {
		t.Fatalf("HMAC digest length = %d, want 64", len(digest))
	}
	if digest == projectAPITokenHMAC([]byte("test-project-api-token-pepper-long-enough"), selector, secret+"x") {
		t.Fatal("HMAC digest did not bind the secret")
	}
}

func TestProjectAPITokenPepperConfiguration(t *testing.T) {
	store := New(nil)
	const value = "project-api-token-pepper-long-enough"
	if err := store.SetProjectAPITokenPepper(value); err != nil {
		t.Fatalf("SetProjectAPITokenPepper() error = %v", err)
	}
	current, err := store.currentProjectAPITokenPepper()
	if err != nil || string(current) != value {
		t.Fatalf("currentProjectAPITokenPepper() = %#v, %v", current, err)
	}
}

func TestProjectAPITokenPepperConfigurationRejectsShortValue(t *testing.T) {
	store := New(nil)
	if err := store.SetProjectAPITokenPepper("too-short"); err == nil {
		t.Fatal("SetProjectAPITokenPepper() accepted a short value")
	}
}
