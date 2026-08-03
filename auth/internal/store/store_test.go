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
