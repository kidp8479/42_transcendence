package password

import (
	"strings"
	"testing"
)

func TestHasherRoundTrip(t *testing.T) {
	t.Parallel()

	hasher := NewHasher()
	encoded, err := hasher.Hash("correct-horse-battery-staple")
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}
	if !strings.HasPrefix(encoded, "$argon2id$v=19$") {
		t.Fatalf("Hash() = %q, want argon2id encoding", encoded)
	}

	valid, err := hasher.Verify("correct-horse-battery-staple", encoded)
	if err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
	if !valid {
		t.Fatal("Verify() = false, want true")
	}

	valid, err = hasher.Verify("wrong-password", encoded)
	if err != nil {
		t.Fatalf("Verify() wrong password error = %v", err)
	}
	if valid {
		t.Fatal("Verify() wrong password = true, want false")
	}
}

func TestHasherUsesRandomSalt(t *testing.T) {
	t.Parallel()

	hasher := NewHasher()
	first, err := hasher.Hash("correct-horse-battery-staple")
	if err != nil {
		t.Fatalf("first Hash() error = %v", err)
	}
	second, err := hasher.Hash("correct-horse-battery-staple")
	if err != nil {
		t.Fatalf("second Hash() error = %v", err)
	}
	if first == second {
		t.Fatal("Hash() produced identical encodings, want random salts")
	}
}

func TestHasherRejectsInvalidEncoding(t *testing.T) {
	t.Parallel()

	hasher := NewHasher()
	if _, err := hasher.Verify("password", "not-an-argon2id-hash"); err == nil {
		t.Fatal("Verify() error = nil, want invalid encoding error")
	}
}
