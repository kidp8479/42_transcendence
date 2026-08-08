package store

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
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
	ErrInvalid  = errors.New("auth record is invalid")
	ErrNotFound = errors.New("auth record not found")
	ErrCSRF     = errors.New("CSRF token is invalid")
	ErrReplay   = errors.New("refresh token replay detected")
)

const (
	refreshTokenGrace       = 5 * time.Second
	WebSocketTicketAudience = "transcendence-ws"
	WebSocketTicketTTL      = 60 * time.Second
)

type AccountStatus string

const (
	AccountStatusActive          AccountStatus = "ACTIVE"
	AccountStatusPendingApproval AccountStatus = "PENDING_APPROVAL"
	AccountStatusDisabled        AccountStatus = "DISABLED"
)

type Store struct {
	pool                  atomic.Pointer[pgxpool.Pool]
	refreshCipher         *refreshTokenCipher
	projectAPITokenPepper []byte
}

type User struct {
	ID            string  `json:"id"`
	Email         string  `json:"email"`
	EmailVerified bool    `json:"emailVerified"`
	Username      string  `json:"username"`
	AvatarURL     *string `json:"avatarUrl"`
	Campus        *string `json:"campus"`
	// Status controls authentication eligibility and is not profile response data.
	Status     AccountStatus `json:"-"`
	GlobalRole string        `json:"-"`
}

type LocalCredential struct {
	User
	PasswordHash string
}

type RefreshFamily struct {
	ID                   string
	User                 User
	AuthenticationMethod string
	AssuranceLevel       int
	AuthenticatedAt      time.Time
	IdleExpiresAt        time.Time
	AbsoluteExpiresAt    time.Time
	CSRFTokenHash        string
}

type CreatedRefreshSession struct {
	RefreshFamily
	RefreshToken string
	CSRFToken    string
}

type AccessState struct {
	RefreshFamily
	GlobalRole string
}

type WebSocketAdmission struct {
	UserID          string
	RefreshFamilyID string
	Username        string
	AvatarURL       *string
}

type refreshUse int

const (
	refreshReplay refreshUse = iota
	refreshCurrent
	refreshGrace
)

func New(pool *pgxpool.Pool) *Store {
	store := &Store{}
	store.pool.Store(pool)
	return store
}

// SetRefreshCipher installs the process-local key used to recover an already
// issued successor during the bounded refresh retry grace period.
func (s *Store) SetRefreshCipher(secret string) error {
	refreshCipher, err := newRefreshTokenCipher(secret)
	if err != nil {
		return err
	}
	s.refreshCipher = refreshCipher
	return nil
}

// ReplacePool publishes a fully connected pool before its predecessor drains.
func (s *Store) ReplacePool(pool *pgxpool.Pool) *pgxpool.Pool {
	return s.pool.Swap(pool)
}

func (s *Store) currentPool() *pgxpool.Pool {
	return s.pool.Load()
}

func (s *Store) Ping(ctx context.Context) error {
	pool := s.currentPool()
	if pool == nil {
		return errors.New("authentication database pool is unavailable")
	}
	return pool.Ping(ctx)
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
		ID:         uuid.NewString(),
		Email:      email,
		Username:   username,
		Status:     AccountStatusActive,
		GlobalRole: "USER",
	}
	identityID := uuid.NewString()
	credentialID := uuid.NewString()

	_, err = tx.Exec(
		ctx,
		`INSERT INTO "User"
			("id", "email", "emailVerified", "username", "twoFactorEnabled", "status", "createdAt", "updatedAt")
		 VALUES ($1, $2, false, $3, false, CAST($4 AS "AccountStatus"), $5, $5)`,
		user.ID,
		user.Email,
		user.Username,
		string(user.Status),
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
			u."status"::text,
			u."globalRole"::text,
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
		&credential.Status,
		&credential.GlobalRole,
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

func (s *Store) CreateRefreshFamily(
	ctx context.Context,
	user User,
	method string,
	idleTimeout time.Duration,
	absoluteTimeout time.Duration,
	ipHash *string,
	userAgentHash *string,
) (CreatedRefreshSession, error) {
	token, err := randomToken(32)
	if err != nil {
		return CreatedRefreshSession{}, err
	}
	csrfToken, err := randomToken(32)
	if err != nil {
		return CreatedRefreshSession{}, err
	}

	now := time.Now().UTC()
	session := CreatedRefreshSession{
		RefreshToken: token,
		CSRFToken:    csrfToken,
		RefreshFamily: RefreshFamily{
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

	tx, err := s.currentPool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("begin refresh family transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	_, err = tx.Exec(
		ctx,
		`INSERT INTO "RefreshTokenFamily"
			("id", "userId", "authenticationMethod", "assuranceLevel", "csrfTokenHash",
			 "authenticatedAt", "lastUsedAt", "idleExpiresAt", "absoluteExpiresAt",
			 "ipHash", "userAgentHash", "createdAt", "updatedAt")
		 VALUES
			($1, $2, CAST($3 AS "AuthProvider"), $4, $5, $6, $6, $7, $8, $9, $10, $6, $6)`,
		session.ID,
		session.User.ID,
		session.AuthenticationMethod,
		session.AssuranceLevel,
		session.CSRFTokenHash,
		session.AuthenticatedAt,
		session.IdleExpiresAt,
		session.AbsoluteExpiresAt,
		ipHash,
		userAgentHash,
	)
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("create refresh family: %w", err)
	}

	_, err = tx.Exec(
		ctx,
		`INSERT INTO "AuthRefreshToken"
			("id", "familyId", "tokenHash", "issuedAt", "expiresAt")
		 VALUES ($1, $2, $3, $4, $5)`,
		uuid.NewString(),
		session.ID,
		hashToken(session.RefreshToken),
		session.AuthenticatedAt,
		session.IdleExpiresAt,
	)
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("create initial refresh token: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("commit refresh family transaction: %w", err)
	}
	return session, nil
}

func (s *Store) RotateRefreshToken(
	ctx context.Context,
	token string,
	csrfToken string,
	idleTimeout time.Duration,
) (CreatedRefreshSession, error) {
	tx, err := s.currentPool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("begin refresh rotation: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	type refreshRow struct {
		id                  string
		familyID            string
		replacedByID        *string
		graceExpiresAt      *time.Time
		successorCiphertext *string
		expiresAt           time.Time
	}
	var incoming refreshRow
	var family RefreshFamily
	var revokedAt *time.Time
	err = tx.QueryRow(ctx,
		`SELECT
			t."id", t."familyId", t."replacedById", t."graceExpiresAt",
			t."successorCiphertext", t."expiresAt",
			f."id", f."authenticationMethod"::text, f."assuranceLevel",
			f."authenticatedAt", f."idleExpiresAt", f."absoluteExpiresAt",
			f."csrfTokenHash", f."revokedAt",
			u."id", u."email", u."emailVerified", u."username", u."avatarUrl",
			u."campus", u."status"::text, u."globalRole"::text
		 FROM "AuthRefreshToken" t
		 JOIN "RefreshTokenFamily" f ON f."id" = t."familyId"
		 JOIN "User" u ON u."id" = f."userId"
		 WHERE t."tokenHash" = $1
		 FOR UPDATE OF f`,
		hashToken(token),
	).Scan(
		&incoming.id, &incoming.familyID, &incoming.replacedByID,
		&incoming.graceExpiresAt, &incoming.successorCiphertext, &incoming.expiresAt,
		&family.ID, &family.AuthenticationMethod, &family.AssuranceLevel,
		&family.AuthenticatedAt, &family.IdleExpiresAt, &family.AbsoluteExpiresAt,
		&family.CSRFTokenHash, &revokedAt,
		&family.User.ID, &family.User.Email, &family.User.EmailVerified,
		&family.User.Username, &family.User.AvatarURL, &family.User.Campus,
		&family.User.Status, &family.User.GlobalRole,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return CreatedRefreshSession{}, ErrNotFound
	}
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("lock refresh family: %w", err)
	}
	now := time.Now().UTC()
	if _, err := tx.Exec(ctx,
		`UPDATE "AuthRefreshToken"
		 SET "successorCiphertext" = NULL
		 WHERE "successorCiphertext" IS NOT NULL
		   AND "graceExpiresAt" <= $1`,
		now,
	); err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("clear expired refresh successors: %w", err)
	}
	if revokedAt != nil || !family.IdleExpiresAt.After(now) ||
		!family.AbsoluteExpiresAt.After(now) || family.User.Status != AccountStatusActive {
		return CreatedRefreshSession{}, ErrNotFound
	}
	if !VerifyTokenHash(csrfToken, family.CSRFTokenHash) {
		return CreatedRefreshSession{}, ErrCSRF
	}

	var head refreshRow
	err = tx.QueryRow(ctx,
		`SELECT "id", "familyId", "replacedById", "graceExpiresAt",
		        "successorCiphertext", "expiresAt"
		 FROM "AuthRefreshToken"
		 WHERE "familyId" = $1 AND "replacedById" IS NULL
		 ORDER BY "issuedAt" DESC
		 LIMIT 1
		 FOR UPDATE`,
		family.ID,
	).Scan(
		&head.id, &head.familyID, &head.replacedByID,
		&head.graceExpiresAt, &head.successorCiphertext, &head.expiresAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return CreatedRefreshSession{}, fmt.Errorf("refresh family has no current token")
	}
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("lock current refresh token: %w", err)
	}

	use := classifyRefreshUse(
		incoming.id, incoming.replacedByID, head.id, incoming.graceExpiresAt, now,
	)
	if use == refreshGrace {
		if incoming.successorCiphertext == nil || s.refreshCipher == nil {
			return CreatedRefreshSession{}, fmt.Errorf("refresh successor recovery is unavailable")
		}
		successor, err := s.refreshCipher.decrypt(*incoming.successorCiphertext)
		if err != nil {
			return CreatedRefreshSession{}, fmt.Errorf("decrypt refresh successor: %w", err)
		}
		var successorHash string
		err = tx.QueryRow(ctx,
			`SELECT "tokenHash" FROM "AuthRefreshToken" WHERE "id" = $1`,
			head.id,
		).Scan(&successorHash)
		if err != nil {
			return CreatedRefreshSession{}, fmt.Errorf("load refresh successor hash: %w", err)
		}
		if !VerifyTokenHash(successor, successorHash) {
			return CreatedRefreshSession{}, fmt.Errorf("refresh successor ciphertext does not match token chain")
		}
		if !head.expiresAt.After(now) {
			return CreatedRefreshSession{}, ErrNotFound
		}
		return CreatedRefreshSession{
			RefreshFamily: family,
			RefreshToken:  successor,
			CSRFToken:     csrfToken,
		}, nil
	}
	if use == refreshReplay {
		_, revokeErr := tx.Exec(ctx,
			`UPDATE "RefreshTokenFamily"
			 SET "revokedAt" = CURRENT_TIMESTAMP,
			     "revokedReason" = 'REFRESH_TOKEN_REPLAY',
			     "updatedAt" = CURRENT_TIMESTAMP
			 WHERE "userId" = $1 AND "revokedAt" IS NULL`,
			family.User.ID,
		)
		if revokeErr != nil {
			return CreatedRefreshSession{}, fmt.Errorf("revoke families after refresh replay: %w", revokeErr)
		}
		_, auditErr := tx.Exec(ctx,
			`INSERT INTO "AuthEvent"
				("id", "userId", "eventType", "provider", "sessionId", "createdAt")
			 VALUES ($1, $2, 'REFRESH_REPLAY_DETECTED', CAST($3 AS "AuthProvider"), $4, CURRENT_TIMESTAMP)`,
			uuid.NewString(), family.User.ID, family.AuthenticationMethod, family.ID,
		)
		if auditErr != nil {
			return CreatedRefreshSession{}, fmt.Errorf("record refresh replay event: %w", auditErr)
		}
		if err := tx.Commit(ctx); err != nil {
			return CreatedRefreshSession{}, fmt.Errorf("commit refresh replay revocation: %w", err)
		}
		return CreatedRefreshSession{}, ErrReplay
	}
	if !head.expiresAt.After(now) {
		return CreatedRefreshSession{}, ErrNotFound
	}

	newToken, err := randomToken(32)
	if err != nil {
		return CreatedRefreshSession{}, err
	}
	newID := uuid.NewString()
	if s.refreshCipher == nil {
		return CreatedRefreshSession{}, fmt.Errorf("refresh successor recovery is unavailable")
	}
	successorCiphertext, err := s.refreshCipher.encrypt(newToken)
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("encrypt refresh successor: %w", err)
	}
	idleExpiresAt := minTime(now.Add(idleTimeout), family.AbsoluteExpiresAt)
	_, err = tx.Exec(ctx,
		`INSERT INTO "AuthRefreshToken"
			("id", "familyId", "tokenHash", "issuedAt", "expiresAt")
		 VALUES ($1, $2, $3, $4, $5)`,
		newID, family.ID, hashToken(newToken), now, idleExpiresAt,
	)
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("insert rotated refresh token: %w", err)
	}
	command, err := tx.Exec(ctx,
		`UPDATE "AuthRefreshToken"
		 SET "usedAt" = $2,
		     "replacedAt" = $2,
		     "graceExpiresAt" = $3,
		     "successorCiphertext" = $4,
		     "replacedById" = $5
		 WHERE "id" = $1 AND "replacedById" IS NULL`,
		head.id, now, now.Add(refreshTokenGrace), successorCiphertext, newID,
	)
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("replace current refresh token: %w", err)
	}
	if command.RowsAffected() != 1 {
		return CreatedRefreshSession{}, fmt.Errorf("refresh token chain changed while locked")
	}
	_, err = tx.Exec(ctx,
		`UPDATE "RefreshTokenFamily"
		 SET "lastUsedAt" = $2, "idleExpiresAt" = $3, "updatedAt" = $2
		 WHERE "id" = $1`,
		family.ID, now, idleExpiresAt,
	)
	if err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("update refresh family activity: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return CreatedRefreshSession{}, fmt.Errorf("commit refresh rotation: %w", err)
	}
	family.IdleExpiresAt = idleExpiresAt
	return CreatedRefreshSession{
		RefreshFamily: family,
		RefreshToken:  newToken,
		CSRFToken:     csrfToken,
	}, nil
}

func classifyRefreshUse(
	incomingID string,
	replacedByID *string,
	headID string,
	graceExpiresAt *time.Time,
	now time.Time,
) refreshUse {
	if incomingID == headID && replacedByID == nil {
		return refreshCurrent
	}
	if replacedByID != nil && *replacedByID == headID &&
		graceExpiresAt != nil && graceExpiresAt.After(now) {
		return refreshGrace
	}
	return refreshReplay
}

func (s *Store) GetRefreshFamily(ctx context.Context, token, csrfToken string) (RefreshFamily, error) {
	var family RefreshFamily
	var revokedAt *time.Time
	err := s.currentPool().QueryRow(ctx,
		`SELECT
			f."id", f."authenticationMethod"::text, f."assuranceLevel",
			f."authenticatedAt", f."idleExpiresAt", f."absoluteExpiresAt",
			f."csrfTokenHash", f."revokedAt",
			u."id", u."email", u."emailVerified", u."username", u."avatarUrl",
			u."campus", u."status"::text, u."globalRole"::text
		 FROM "AuthRefreshToken" t
		 JOIN "RefreshTokenFamily" f ON f."id" = t."familyId"
		 JOIN "User" u ON u."id" = f."userId"
		 WHERE t."tokenHash" = $1
		   AND t."replacedById" IS NULL
		   AND t."usedAt" IS NULL
		   AND t."expiresAt" > CURRENT_TIMESTAMP`,
		hashToken(token),
	).Scan(
		&family.ID, &family.AuthenticationMethod, &family.AssuranceLevel,
		&family.AuthenticatedAt, &family.IdleExpiresAt, &family.AbsoluteExpiresAt,
		&family.CSRFTokenHash, &revokedAt,
		&family.User.ID, &family.User.Email, &family.User.EmailVerified,
		&family.User.Username, &family.User.AvatarURL, &family.User.Campus,
		&family.User.Status, &family.User.GlobalRole,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return RefreshFamily{}, ErrNotFound
	}
	if err != nil {
		return RefreshFamily{}, fmt.Errorf("get refresh family: %w", err)
	}
	now := time.Now().UTC()
	if revokedAt != nil || !family.IdleExpiresAt.After(now) ||
		!family.AbsoluteExpiresAt.After(now) || family.User.Status != AccountStatusActive {
		return RefreshFamily{}, ErrNotFound
	}
	if !VerifyTokenHash(csrfToken, family.CSRFTokenHash) {
		return RefreshFamily{}, ErrCSRF
	}
	return family, nil
}

func (s *Store) RevokeRefreshFamily(ctx context.Context, token, csrfToken, reason string) (RefreshFamily, error) {
	family, err := s.GetRefreshFamily(ctx, token, csrfToken)
	if err != nil {
		return RefreshFamily{}, err
	}
	command, err := s.currentPool().Exec(ctx,
		`UPDATE "RefreshTokenFamily"
		 SET "revokedAt" = CURRENT_TIMESTAMP, "revokedReason" = $2, "updatedAt" = CURRENT_TIMESTAMP
		 WHERE "id" = $1 AND "revokedAt" IS NULL`,
		family.ID, reason,
	)
	if err != nil {
		return RefreshFamily{}, fmt.Errorf("revoke refresh family: %w", err)
	}
	if command.RowsAffected() == 0 {
		return RefreshFamily{}, ErrNotFound
	}
	return family, nil
}

func (s *Store) IntrospectAccess(ctx context.Context, userID, familyID string) (AccessState, error) {
	var state AccessState
	err := s.currentPool().QueryRow(ctx,
		`SELECT
			f."id", f."authenticationMethod"::text, f."assuranceLevel",
			f."authenticatedAt", f."idleExpiresAt", f."absoluteExpiresAt",
			f."csrfTokenHash", u."id", u."globalRole"::text
		 FROM "RefreshTokenFamily" f
		 JOIN "User" u ON u."id" = f."userId"
		 WHERE f."id" = $1
		   AND f."userId" = $2
		   AND f."revokedAt" IS NULL
		   AND f."idleExpiresAt" > CURRENT_TIMESTAMP
		   AND f."absoluteExpiresAt" > CURRENT_TIMESTAMP
		   AND u."status" = CAST('ACTIVE' AS "AccountStatus")`,
		familyID, userID,
	).Scan(
		&state.ID, &state.AuthenticationMethod, &state.AssuranceLevel,
		&state.AuthenticatedAt, &state.IdleExpiresAt, &state.AbsoluteExpiresAt,
		&state.CSRFTokenHash, &state.User.ID, &state.GlobalRole,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return AccessState{}, ErrNotFound
	}
	if err != nil {
		return AccessState{}, fmt.Errorf("introspect access token family: %w", err)
	}
	state.User.GlobalRole = state.GlobalRole
	return state, nil
}

func (s *Store) IssueWebSocketTicket(
	ctx context.Context,
	userID string,
	familyID string,
) (string, error) {
	ticket, err := randomToken(32)
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	command, err := s.currentPool().Exec(
		ctx,
		`WITH expired AS (
			SELECT "id"
			FROM "WebSocketTicket"
			WHERE "expiresAt" <= $4
			ORDER BY "expiresAt"
			LIMIT 100
		 ),
		 deleted AS (
			DELETE FROM "WebSocketTicket" t
			USING expired
			WHERE t."id" = expired."id"
			RETURNING t."id"
		 )
		 INSERT INTO "WebSocketTicket"
			("id", "ticketHash", "userId", "refreshFamilyId", "audience", "issuedAt", "expiresAt")
		 SELECT $1, $2, f."userId", f."id", $3, $4, $5
		 FROM "RefreshTokenFamily" f
		 JOIN "User" u ON u."id" = f."userId"
		 WHERE f."id" = $6
		   AND f."userId" = $7
		   AND f."revokedAt" IS NULL
		   AND f."idleExpiresAt" > $4
		   AND f."absoluteExpiresAt" > $4
		   AND u."status" = CAST('ACTIVE' AS "AccountStatus")`,
		uuid.NewString(),
		hashToken(ticket),
		WebSocketTicketAudience,
		now,
		now.Add(WebSocketTicketTTL),
		familyID,
		userID,
	)
	if err != nil {
		return "", fmt.Errorf("issue websocket ticket: %w", err)
	}
	if command.RowsAffected() != 1 {
		return "", ErrNotFound
	}
	return ticket, nil
}

func (s *Store) ConsumeWebSocketTicket(
	ctx context.Context,
	ticket string,
) (WebSocketAdmission, error) {
	var admission WebSocketAdmission
	err := s.currentPool().QueryRow(
		ctx,
		`UPDATE "WebSocketTicket" t
		 SET "consumedAt" = CURRENT_TIMESTAMP
		 FROM "RefreshTokenFamily" f
		 JOIN "User" u ON u."id" = f."userId"
		 WHERE t."ticketHash" = $1
		   AND t."audience" = $2
		   AND t."consumedAt" IS NULL
		   AND t."expiresAt" > CURRENT_TIMESTAMP
		   AND f."id" = t."refreshFamilyId"
		   AND f."userId" = t."userId"
		   AND f."revokedAt" IS NULL
		   AND f."idleExpiresAt" > CURRENT_TIMESTAMP
		   AND f."absoluteExpiresAt" > CURRENT_TIMESTAMP
		   AND u."status" = CAST('ACTIVE' AS "AccountStatus")
		 RETURNING t."userId", t."refreshFamilyId", u."username", u."avatarUrl"`,
		hashToken(ticket),
		WebSocketTicketAudience,
	).Scan(
		&admission.UserID,
		&admission.RefreshFamilyID,
		&admission.Username,
		&admission.AvatarURL,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return WebSocketAdmission{}, ErrNotFound
	}
	if err != nil {
		return WebSocketAdmission{}, fmt.Errorf("consume websocket ticket: %w", err)
	}
	return admission, nil
}

func (s *Store) ValidateWebSocketSession(
	ctx context.Context,
	userID string,
	familyID string,
) error {
	var active bool
	err := s.currentPool().QueryRow(
		ctx,
		`SELECT true
		 FROM "RefreshTokenFamily" f
		 JOIN "User" u ON u."id" = f."userId"
		 WHERE f."id" = $1
		   AND f."userId" = $2
		   AND f."revokedAt" IS NULL
		   AND f."idleExpiresAt" > CURRENT_TIMESTAMP
		   AND f."absoluteExpiresAt" > CURRENT_TIMESTAMP
		   AND u."status" = CAST('ACTIVE' AS "AccountStatus")`,
		familyID,
		userID,
	).Scan(&active)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("validate websocket session: %w", err)
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

func minTime(left, right time.Time) time.Time {
	if left.Before(right) {
		return left
	}
	return right
}

type refreshTokenCipher struct {
	aead cipher.AEAD
}

func newRefreshTokenCipher(secret string) (*refreshTokenCipher, error) {
	if len(secret) < 32 {
		return nil, fmt.Errorf("refresh token encryption secret must be at least 32 characters")
	}
	key := sha256.Sum256([]byte("TR-70 refresh successor encryption\x00" + secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("create refresh token cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create refresh token AEAD: %w", err)
	}
	return &refreshTokenCipher{aead: aead}, nil
}

func (c *refreshTokenCipher) encrypt(token string) (string, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generate refresh token nonce: %w", err)
	}
	sealed := c.aead.Seal(nonce, nonce, []byte(token), nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

func (c *refreshTokenCipher) decrypt(value string) (string, error) {
	sealed, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil || len(sealed) < c.aead.NonceSize()+c.aead.Overhead() {
		return "", fmt.Errorf("invalid refresh successor ciphertext")
	}
	nonce := sealed[:c.aead.NonceSize()]
	plaintext, err := c.aead.Open(nil, nonce, sealed[c.aead.NonceSize():], nil)
	if err != nil {
		return "", fmt.Errorf("authenticate refresh successor ciphertext: %w", err)
	}
	if len(plaintext) == 0 {
		return "", fmt.Errorf("refresh successor is empty")
	}
	return string(plaintext), nil
}

func mapWriteError(operation string, err error) error {
	var pgError *pgconn.PgError
	if errors.As(err, &pgError) {
		switch pgError.Code {
		case "23505":
			return fmt.Errorf("%s: %w", operation, ErrConflict)
		case "23503":
			return fmt.Errorf("%s: %w", operation, ErrNotFound)
		case "23514":
			return fmt.Errorf("%s: %w", operation, ErrInvalid)
		}
	}
	return fmt.Errorf("%s: %w", operation, err)
}
