package middleware

import (
	"testing"
	"time"
)

func TestFixedWindowLimiter(t *testing.T) {
	t.Parallel()

	limiter := NewFixedWindowLimiter(2, time.Minute, 10)
	now := time.Now()

	if !limiter.Allow("client", now) {
		t.Fatal("first Allow() = false, want true")
	}
	if !limiter.Allow("client", now) {
		t.Fatal("second Allow() = false, want true")
	}
	if limiter.Allow("client", now) {
		t.Fatal("third Allow() = true, want false")
	}
	if !limiter.Allow("client", now.Add(time.Minute)) {
		t.Fatal("Allow() after window = false, want true")
	}
}

func TestFixedWindowLimiterBoundsEntries(t *testing.T) {
	t.Parallel()

	limiter := NewFixedWindowLimiter(1, time.Minute, 1)
	now := time.Now()

	if !limiter.Allow("first", now) {
		t.Fatal("Allow(first) = false, want true")
	}
	if limiter.Allow("second", now) {
		t.Fatal("Allow(second) = true, want capacity denial")
	}
	if !limiter.Allow("second", now.Add(time.Minute)) {
		t.Fatal("Allow(second) after expiry = false, want true")
	}
}
