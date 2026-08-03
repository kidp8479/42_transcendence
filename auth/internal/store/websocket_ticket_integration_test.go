package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestWebSocketTicketIsHashOnlyAndAtomicallyConsumed(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	defer pool.Close()

	userID := uuid.NewString()
	familyID := uuid.NewString()
	now := time.Now().UTC()
	_, err = pool.Exec(ctx,
		`INSERT INTO "User"
			("id", "email", "emailVerified", "username", "twoFactorEnabled", "status", "createdAt", "updatedAt")
		 VALUES ($1, $2, true, $3, false, CAST('ACTIVE' AS "AccountStatus"), $4, $4)`,
		userID, userID+"@example.test", "ws-"+userID, now,
	)
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM "User" WHERE "id" = $1`, userID)
	}()
	_, err = pool.Exec(ctx,
		`INSERT INTO "RefreshTokenFamily"
			("id", "userId", "authenticationMethod", "assuranceLevel", "csrfTokenHash",
			 "authenticatedAt", "lastUsedAt", "idleExpiresAt", "absoluteExpiresAt", "createdAt", "updatedAt")
		 VALUES ($1, $2, CAST('LOCAL' AS "AuthProvider"), 1, $3, $4, $4, $5, $6, $4, $4)`,
		familyID, userID, "csrf-hash", now, now.Add(time.Hour), now.Add(24*time.Hour),
	)
	if err != nil {
		t.Fatalf("insert test family: %v", err)
	}

	authStore := New(pool)
	expiredTicketID := uuid.NewString()
	_, err = pool.Exec(ctx,
		`INSERT INTO "WebSocketTicket"
			("id", "ticketHash", "userId", "refreshFamilyId", "audience", "issuedAt", "expiresAt")
		 VALUES ($1, $2, $3, $4, $5, $6, $6)`,
		expiredTicketID, strings.Repeat("0", 64), userID, familyID,
		WebSocketTicketAudience, now.Add(-time.Minute),
	)
	if err != nil {
		t.Fatalf("insert expired ticket: %v", err)
	}
	ticket, err := authStore.IssueWebSocketTicket(ctx, userID, familyID)
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}
	var expiredCount int
	if err := pool.QueryRow(
		ctx,
		`SELECT COUNT(*) FROM "WebSocketTicket" WHERE "id" = $1`,
		expiredTicketID,
	).Scan(&expiredCount); err != nil {
		t.Fatalf("check expired ticket cleanup: %v", err)
	}
	if expiredCount != 0 {
		t.Fatal("expired ticket was not removed during issuance")
	}
	var storedHash, audience string
	var issuedAt, expiresAt time.Time
	err = pool.QueryRow(ctx,
		`SELECT "ticketHash", "audience", "issuedAt", "expiresAt"
		 FROM "WebSocketTicket" WHERE "refreshFamilyId" = $1`,
		familyID,
	).Scan(&storedHash, &audience, &issuedAt, &expiresAt)
	if err != nil {
		t.Fatalf("read persisted ticket: %v", err)
	}
	sum := sha256.Sum256([]byte(ticket))
	if storedHash != hex.EncodeToString(sum[:]) || storedHash == ticket {
		t.Fatal("ticket was not persisted exclusively as its SHA-256 hash")
	}
	if audience != WebSocketTicketAudience ||
		expiresAt.Sub(issuedAt) != WebSocketTicketTTL {
		t.Fatalf("ticket audience/lifetime = %q/%s", audience, expiresAt.Sub(issuedAt))
	}

	start := make(chan struct{})
	results := make(chan error, 2)
	var wait sync.WaitGroup
	for range 2 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			<-start
			_, consumeErr := authStore.ConsumeWebSocketTicket(context.Background(), ticket)
			results <- consumeErr
		}()
	}
	close(start)
	wait.Wait()
	close(results)

	successes := 0
	rejections := 0
	for consumeErr := range results {
		switch {
		case consumeErr == nil:
			successes++
		case errors.Is(consumeErr, ErrNotFound):
			rejections++
		default:
			t.Fatalf("consume ticket: %v", consumeErr)
		}
	}
	if successes != 1 || rejections != 1 {
		t.Fatalf("atomic consume results = %d success, %d rejected", successes, rejections)
	}
}
