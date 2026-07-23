package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrConflict = errors.New("auth record already exists")
	ErrNotFound = errors.New("auth record not found")
)

type Store struct {
	pool atomic.Pointer[pgxpool.Pool]
}

type User struct {
	ID            string  `json:"id"`
	Email         string  `json:"email"`
	EmailVerified bool    `json:"emailVerified"`
	Username      string  `json:"username"`
	AvatarURL     *string `json:"avatarUrl"`
	Campus        *string `json:"campus"`
}

type LocalCredential struct {
	User
	PasswordHash string
}

type Session struct {
	ID                   string
	User                 User
	AuthenticationMethod string
	AssuranceLevel       int
	AuthenticatedAt      time.Time
	IdleExpiresAt        time.Time
	AbsoluteExpiresAt    time.Time
	CSRFTokenHash        string
}

type CreatedSession struct {
	Session
	Token     string
	CSRFToken string
}

func New(pool *pgxpool.Pool) *Store {
	store := &Store{}
	store.pool.Store(pool)
	return store
}

// ReplacePool publishes a fully connected pool before its predecessor drains.
func (s *Store) ReplacePool(pool *pgxpool.Pool) *pgxpool.Pool {
	return s.pool.Swap(pool)
}

func (s *Store) currentPool() *pgxpool.Pool {
	return s.pool.Load()
}

func (s *Store) CreateLocalAccount(
	ctx context.Context,
	email string,
	username string,
	passwordHash string,
) (User, error) {
	tx, err := s.currentPool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return User{}, fmt.Errorf("begin local account transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	now := time.Now().UTC()
	user := User{
		ID:       uuid.NewString(),
		Email:    email,
		Username: username,
	}
	identityID := uuid.NewString()
	credentialID := uuid.NewString()

	_, err = tx.Exec(
		ctx,
		`INSERT INTO "User"
			("id", "email", "emailVerified", "username", "twoFactorEnabled", "createdAt", "updatedAt")
		 VALUES ($1, $2, false, $3, false, $4, $4)`,
		user.ID,
		user.Email,
		user.Username,
		now,
	)
	if err != nil {
		return User{}, mapWriteError("insert local user", err)
	}

	_, err = tx.Exec(
		ctx,
		`INSERT INTO "AuthIdentity"
			("id", "userId", "provider", "providerSubject", "email", "emailVerified", "createdAt", "updatedAt")
		 VALUES ($1, $2, CAST('LOCAL' AS "AuthProvider"), $3, $3, false, $4, $4)`,
		identityID,
		user.ID,
		user.Email,
		now,
	)
	if err != nil {
		return User{}, mapWriteError("insert local identity", err)
	}

	_, err = tx.Exec(
		ctx,
		`INSERT INTO "PasswordCredential"
			("id", "identityId", "passwordHash", "passwordChangedAt", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $4, $4)`,
		credentialID,
		identityID,
		passwordHash,
		now,
	)
	if err != nil {
		return User{}, mapWriteError("insert local password credential", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("commit local account transaction: %w", err)
	}
	return user, nil
}

func (s *Store) FindLocalCredential(ctx context.Context, normalizedEmail string) (LocalCredential, error) {
	var credential LocalCredential
	err := s.currentPool().QueryRow(
		ctx,
		`SELECT
			u."id",
			u."email",
			u."emailVerified",
			u."username",
			u."avatarUrl",
			u."campus",
			pc."passwordHash"
		 FROM "AuthIdentity" ai
		 JOIN "User" u ON u."id" = ai."userId"
		 JOIN "PasswordCredential" pc ON pc."identityId" = ai."id"
		 WHERE ai."provider" = CAST('LOCAL' AS "AuthProvider")
		   AND ai."providerSubject" = $1`,
		normalizedEmail,
	).Scan(
		&credential.ID,
		&credential.Email,
		&credential.EmailVerified,
		&credential.Username,
		&credential.AvatarURL,
		&credential.Campus,
		&credential.PasswordHash,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return LocalCredential{}, ErrNotFound
	}
	if err != nil {
		return LocalCredential{}, fmt.Errorf("find local credential: %w", err)
	}
	return credential, nil
}

func (s *Store) CreateSession(
	ctx context.Context,
	user User,
	method string,
	idleTimeout time.Duration,
	absoluteTimeout time.Duration,
	ipHash *string,
	userAgentHash *string,
) (CreatedSession, error) {
	token, err := randomToken(32)
	if err != nil {
		return CreatedSession{}, err
	}
	csrfToken, err := randomToken(32)
	if err != nil {
		return CreatedSession{}, err
	}

	now := time.Now().UTC()
	session := CreatedSession{
		Token:     token,
		CSRFToken: csrfToken,
		Session: Session{
			ID:                   uuid.NewString(),
			User:                 user,
			AuthenticationMethod: method,
			AssuranceLevel:       1,
			AuthenticatedAt:      now,
			IdleExpiresAt:        now.Add(idleTimeout),
			AbsoluteExpiresAt:    now.Add(absoluteTimeout),
			CSRFTokenHash:        hashToken(csrfToken),
		},
	}

	_, err = s.currentPool().Exec(
		ctx,
		`INSERT INTO "AuthSession"
			("id", "userId", "tokenHash", "csrfTokenHash", "authenticationMethod",
			 "assuranceLevel", "authenticatedAt", "lastSeenAt", "idleExpiresAt",
			 "absoluteExpiresAt", "ipHash", "userAgentHash", "createdAt", "updatedAt")
		 VALUES
			($1, $2, $3, $4, CAST($5 AS "AuthProvider"), $6, $7, $7, $8, $9, $10, $11, $7, $7)`,
		session.ID,
		session.User.ID,
		hashToken(session.Token),
		session.CSRFTokenHash,
		session.AuthenticationMethod,
		session.AssuranceLevel,
		session.AuthenticatedAt,
		session.IdleExpiresAt,
		session.AbsoluteExpiresAt,
		ipHash,
		userAgentHash,
	)
	if err != nil {
		return CreatedSession{}, fmt.Errorf("create auth session: %w", err)
	}

	return session, nil
}

func (s *Store) IntrospectSession(
	ctx context.Context,
	token string,
	idleTimeout time.Duration,
) (Session, error) {
	tokenHash := hashToken(token)
	var session Session

	err := s.currentPool().QueryRow(
		ctx,
		`UPDATE "AuthSession" AS s
		 SET "lastSeenAt" = CURRENT_TIMESTAMP,
		     "idleExpiresAt" = LEAST(CURRENT_TIMESTAMP + $2::interval, s."absoluteExpiresAt"),
		     "updatedAt" = CURRENT_TIMESTAMP
		 FROM "User" AS u
		 WHERE s."userId" = u."id"
		   AND s."tokenHash" = $1
		   AND s."revokedAt" IS NULL
		   AND s."idleExpiresAt" > CURRENT_TIMESTAMP
		   AND s."absoluteExpiresAt" > CURRENT_TIMESTAMP
		 RETURNING
			s."id",
			u."id",
			u."email",
			u."emailVerified",
			u."username",
			u."avatarUrl",
			u."campus",
			s."authenticationMethod"::text,
			s."assuranceLevel",
			s."authenticatedAt",
			s."idleExpiresAt",
			s."absoluteExpiresAt",
			s."csrfTokenHash"`,
		tokenHash,
		durationInterval(idleTimeout),
	).Scan(
		&session.ID,
		&session.User.ID,
		&session.User.Email,
		&session.User.EmailVerified,
		&session.User.Username,
		&session.User.AvatarURL,
		&session.User.Campus,
		&session.AuthenticationMethod,
		&session.AssuranceLevel,
		&session.AuthenticatedAt,
		&session.IdleExpiresAt,
		&session.AbsoluteExpiresAt,
		&session.CSRFTokenHash,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, ErrNotFound
	}
	if err != nil {
		return Session{}, fmt.Errorf("introspect auth session: %w", err)
	}
	return session, nil
}

func (s *Store) RevokeSession(ctx context.Context, token string) error {
	command, err := s.currentPool().Exec(
		ctx,
		`UPDATE "AuthSession"
		 SET "revokedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
		 WHERE "tokenHash" = $1 AND "revokedAt" IS NULL`,
		hashToken(token),
	)
	if err != nil {
		return fmt.Errorf("revoke auth session: %w", err)
	}
	if command.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) RecordEvent(
	ctx context.Context,
	userID *string,
	eventType string,
	provider *string,
	sessionID *string,
	ipHash *string,
) error {
	_, err := s.currentPool().Exec(
		ctx,
		`INSERT INTO "AuthEvent"
			("id", "userId", "eventType", "provider", "sessionId", "ipHash", "createdAt")
		 VALUES ($1, $2, $3, CAST($4 AS "AuthProvider"), $5, $6, CURRENT_TIMESTAMP)`,
		uuid.NewString(),
		userID,
		eventType,
		provider,
		sessionID,
		ipHash,
	)
	if err != nil {
		return fmt.Errorf("record auth event: %w", err)
	}
	return nil
}

func HashMetadata(value string) *string {
	if value == "" {
		return nil
	}
	hash := sha256.Sum256([]byte(value))
	encoded := hex.EncodeToString(hash[:])
	return &encoded
}

func VerifyTokenHash(token, expectedHash string) bool {
	actual := hashToken(token)
	return subtleEqual(actual, expectedHash)
}

func randomToken(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate secure token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func subtleEqual(left, right string) bool {
	if len(left) != len(right) {
		return false
	}
	var difference byte
	for i := range left {
		difference |= left[i] ^ right[i]
	}
	return difference == 0
}

func durationInterval(duration time.Duration) string {
	return fmt.Sprintf("%f seconds", duration.Seconds())
}

func mapWriteError(operation string, err error) error {
	var pgError *pgconn.PgError
	if errors.As(err, &pgError) && pgError.Code == "23505" {
		return fmt.Errorf("%s: %w", operation, ErrConflict)
	}
	return fmt.Errorf("%s: %w", operation, err)
}
