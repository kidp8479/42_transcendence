package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type OAuthTransaction struct {
	Provider         string
	StateHash        string
	RedirectURI      string
	ReturnTo         string
	Purpose          string
	InitiatingUserID *string
	ExpiresAt        time.Time
}

type FortyTwoProfile struct {
	Subject     string
	Email       string
	Username    string
	DisplayName string
	AvatarURL   *string
	Campus      *string
}

func (s *Store) CreateOAuthTransaction(ctx context.Context, transaction OAuthTransaction) error {
	_, err := s.currentPool().Exec(ctx,
		`INSERT INTO "OAuthTransaction"
		 ("id", "provider", "stateHash", "redirectUri", "returnTo", "purpose", "initiatingUserId", "createdAt", "expiresAt")
		 VALUES ($1, CAST($2 AS "AuthProvider"), $3, $4, $5, CAST($6 AS "OAuthTransactionPurpose"), $7, CURRENT_TIMESTAMP, $8)`,
		uuid.NewString(), transaction.Provider, transaction.StateHash, transaction.RedirectURI,
		transaction.ReturnTo, transaction.Purpose, transaction.InitiatingUserID, transaction.ExpiresAt,
	)
	if err != nil {
		return mapWriteError("create OAuth transaction", err)
	}
	return nil
}

// ConsumeOAuthTransaction atomically marks a valid state as used before the
// authorization code is exchanged with the provider.
func (s *Store) ConsumeOAuthTransaction(ctx context.Context, stateHash string) (OAuthTransaction, error) {
	var transaction OAuthTransaction
	err := s.currentPool().QueryRow(ctx,
		`UPDATE "OAuthTransaction"
		 SET "consumedAt" = CURRENT_TIMESTAMP
		 WHERE "stateHash" = $1 AND "consumedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP
		 RETURNING "provider"::text, "stateHash", "redirectUri", "returnTo", "purpose"::text, "initiatingUserId", "expiresAt"`,
		stateHash,
	).Scan(&transaction.Provider, &transaction.StateHash, &transaction.RedirectURI,
		&transaction.ReturnTo, &transaction.Purpose, &transaction.InitiatingUserID, &transaction.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return OAuthTransaction{}, ErrNotFound
	}
	if err != nil {
		return OAuthTransaction{}, fmt.Errorf("consume OAuth transaction: %w", err)
	}
	return transaction, nil
}

func (s *Store) ResolveFortyTwoLogin(ctx context.Context, profile FortyTwoProfile) (User, error) {
	tx, err := s.currentPool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return User{}, fmt.Errorf("begin 42 identity resolution: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	user, found, err := findIdentityUser(ctx, tx, "FORTY_TWO", profile.Subject)
	if err != nil {
		return User{}, err
	}
	if found {
		if err := tx.Commit(ctx); err != nil {
			return User{}, fmt.Errorf("commit 42 identity resolution: %w", err)
		}
		return user, nil
	}
	// Automatic email linking deliberately considers LOCAL identities only.
	user, found, err = findIdentityUser(ctx, tx, "LOCAL", profile.Email)
	if err != nil {
		return User{}, err
	}
	if !found {
		user, err = createFortyTwoUser(ctx, tx, profile)
		if err != nil {
			return User{}, err
		}
	}
	if err := insertFortyTwoIdentity(ctx, tx, user.ID, profile); err != nil {
		if errors.Is(err, ErrConflict) {
			// A concurrent callback won the unique provider-subject insert.
			// Its identity is authoritative, never the provisional user above.
			_ = tx.Rollback(ctx)
			resolved, resolvedFound, lookupErr := findIdentityUserPool(ctx, s, "FORTY_TWO", profile.Subject)
			if lookupErr == nil && resolvedFound {
				return resolved, nil
			}
		}
		return User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return User{}, mapWriteError("commit 42 identity resolution", err)
	}
	return user, nil
}

func (s *Store) LinkFortyTwoIdentity(ctx context.Context, userID string, profile FortyTwoProfile) error {
	tx, err := s.currentPool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin 42 identity link: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	existing, found, err := findIdentityUser(ctx, tx, "FORTY_TWO", profile.Subject)
	if err != nil {
		return err
	}
	if found {
		if existing.ID != userID {
			return ErrConflict
		}
		return tx.Commit(ctx)
	}
	if err := insertFortyTwoIdentity(ctx, tx, userID, profile); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return mapWriteError("commit 42 identity link", err)
	}
	return nil
}

func findIdentityUser(ctx context.Context, tx pgx.Tx, provider, subject string) (User, bool, error) {
	var user User
	err := tx.QueryRow(ctx,
		`SELECT u."id", u."email", u."emailVerified", u."username", u."avatarUrl", u."campus", u."status"::text, u."globalRole"::text
		 FROM "AuthIdentity" ai JOIN "User" u ON u."id" = ai."userId"
		 WHERE ai."provider" = CAST($1 AS "AuthProvider") AND ai."providerSubject" = $2 FOR UPDATE OF ai`,
		provider, subject,
	).Scan(&user.ID, &user.Email, &user.EmailVerified, &user.Username, &user.AvatarURL, &user.Campus, &user.Status, &user.GlobalRole)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, false, nil
	}
	if err != nil {
		return User{}, false, fmt.Errorf("find provider identity: %w", err)
	}
	return user, true, nil
}

func createFortyTwoUser(ctx context.Context, tx pgx.Tx, profile FortyTwoProfile) (User, error) {
	now := time.Now().UTC()
	base := sanitizedUsername(profile.Username)
	for attempt := 0; attempt < 8; attempt++ {
		username := base
		if attempt > 0 {
			username = fmt.Sprintf("%s-%s", base[:min(len(base), 24)], strings.ReplaceAll(uuid.NewString()[:7], "-", ""))
		}
		user := User{ID: uuid.NewString(), Email: profile.Email, Username: username, AvatarURL: profile.AvatarURL,
			Campus: profile.Campus, Status: AccountStatusActive, GlobalRole: "USER"}
		var insertedID string
		err := tx.QueryRow(ctx,
			`INSERT INTO "User" ("id", "email", "emailVerified", "username", "avatarUrl", "campus", "twoFactorEnabled", "status", "globalRole", "createdAt", "updatedAt")
			 VALUES ($1, $2, false, $3, $4, $5, false, CAST('ACTIVE' AS "AccountStatus"), CAST('USER' AS "GlobalRole"), $6, $6)
			 ON CONFLICT ("username") DO NOTHING
			 RETURNING "id"`,
			user.ID, user.Email, user.Username, user.AvatarURL, user.Campus, now,
		).Scan(&insertedID)
		if err == nil && insertedID == user.ID {
			return user, nil
		}
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if !isUniqueViolation(err) {
			return User{}, mapWriteError("create 42 user", err)
		}
	}
	return User{}, ErrConflict
}

func insertFortyTwoIdentity(ctx context.Context, tx pgx.Tx, userID string, profile FortyTwoProfile) error {
	metadata, err := json.Marshal(map[string]string{"login": profile.Username})
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx,
		`INSERT INTO "AuthIdentity" ("id", "userId", "provider", "providerSubject", "email", "emailVerified", "displayName", "profile", "createdAt", "updatedAt")
		 VALUES ($1, $2, CAST('FORTY_TWO' AS "AuthProvider"), $3, $4, false, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		uuid.NewString(), userID, profile.Subject, profile.Email, nullableString(profile.DisplayName), metadata)
	if err != nil {
		return mapWriteError("insert 42 identity", err)
	}
	return nil
}

func sanitizedUsername(value string) string {
	var out strings.Builder
	for _, character := range strings.ToLower(value) {
		if (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9') || character == '_' || character == '-' {
			out.WriteRune(character)
		}
	}
	base := strings.Trim(out.String(), "-_")
	if len(base) < 3 {
		base = "user"
	}
	if len(base) > 32 {
		base = base[:32]
	}
	return base
}

func nullableString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func isUniqueViolation(err error) bool {
	var pgError *pgconn.PgError
	return errors.As(err, &pgError) && pgError.Code == "23505"
}

func findIdentityUserPool(ctx context.Context, s *Store, provider, subject string) (User, bool, error) {
	var user User
	err := s.currentPool().QueryRow(ctx,
		`SELECT u."id", u."email", u."emailVerified", u."username", u."avatarUrl", u."campus", u."status"::text, u."globalRole"::text
		 FROM "AuthIdentity" ai JOIN "User" u ON u."id" = ai."userId"
		 WHERE ai."provider" = CAST($1 AS "AuthProvider") AND ai."providerSubject" = $2`,
		provider, subject,
	).Scan(&user.ID, &user.Email, &user.EmailVerified, &user.Username, &user.AvatarURL, &user.Campus, &user.Status, &user.GlobalRole)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, false, nil
	}
	if err != nil {
		return User{}, false, fmt.Errorf("find provider identity: %w", err)
	}
	return user, true, nil
}
