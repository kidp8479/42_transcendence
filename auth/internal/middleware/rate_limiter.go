package middleware

import (
	"sync"
	"time"
)

type windowCounter struct {
	start time.Time
	count int
}

type FixedWindowLimiter struct {
	mu         sync.Mutex
	limit      int
	window     time.Duration
	maxEntries int
	entries    map[string]windowCounter
}

func NewFixedWindowLimiter(limit int, window time.Duration, maxEntries int) *FixedWindowLimiter {
	return &FixedWindowLimiter{
		limit:      limit,
		window:     window,
		maxEntries: maxEntries,
		entries:    make(map[string]windowCounter),
	}
}

func (l *FixedWindowLimiter) Allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, exists := l.entries[key]
	if exists && now.Sub(entry.start) >= l.window {
		delete(l.entries, key)
		exists = false
	}

	if !exists {
		if len(l.entries) >= l.maxEntries {
			l.removeExpired(now)
		}
		if len(l.entries) >= l.maxEntries {
			return false
		}
		l.entries[key] = windowCounter{start: now, count: 1}
		return true
	}

	if entry.count >= l.limit {
		return false
	}
	entry.count++
	l.entries[key] = entry
	return true
}

func (l *FixedWindowLimiter) removeExpired(now time.Time) {
	for key, entry := range l.entries {
		if now.Sub(entry.start) >= l.window {
			delete(l.entries, key)
		}
	}
}
