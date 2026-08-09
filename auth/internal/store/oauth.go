package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
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
	FirstName   *string
	LastName    *string
	AvatarURL   *string
	Campus      *string
}

type FortyTwoLoginResolution struct {
	User       User
	AutoLinked bool
}

func (s *Store) CreateOAuthTransaction(ctx context.Context, transaction OAuthTransaction) error {
	if _, err := s.currentPool().Exec(ctx, `DELETE FROM "OAuthTransaction" WHERE "expiresAt" <= CURRENT_TIMESTAMP`); err != nil {
		log.Printf("clean expired OAuth transactions: %v", err)
	}
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

func (s *Store) ResolveFortyTwoLogin(ctx context.Context, profile FortyTwoProfile) (FortyTwoLoginResolution, error) {
	tx, err := s.currentPool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return FortyTwoLoginResolution{}, fmt.Errorf("begin 42 identity resolution: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	user, found, err := findIdentityUser(ctx, tx, "FORTY_TWO", profile.Subject)
	if err != nil {
		return FortyTwoLoginResolution{}, err
	}
	if found {
		user, err = enrichFortyTwoUser(ctx, tx, user, profile)
		if err != nil {
			return FortyTwoLoginResolution{}, err
		}
		if err := updateFortyTwoIdentity(ctx, tx, user.ID, profile); err != nil {
			return FortyTwoLoginResolution{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return FortyTwoLoginResolution{}, fmt.Errorf("commit 42 identity resolution: %w", err)
		}
		return FortyTwoLoginResolution{User: user}, nil
	}
	// Automatic email linking deliberately considers LOCAL identities only.
	user, found, err = findIdentityUser(ctx, tx, "LOCAL", profile.Email)
	if err != nil {
		return FortyTwoLoginResolution{}, err
	}
	autoLinked := found
	if !found {
		user, err = createFortyTwoUser(ctx, tx, profile)
		if err != nil {
			if errors.Is(err, ErrConflict) {
				_ = tx.Rollback(ctx)
				resolved, resolvedFound, lookupErr := findIdentityUserPool(ctx, s, "FORTY_TWO", profile.Subject)
				if lookupErr == nil && resolvedFound {
					return FortyTwoLoginResolution{User: resolved}, nil
				}
			}
			return FortyTwoLoginResolution{}, err
		}
	}
	if err := insertFortyTwoIdentity(ctx, tx, user.ID, profile); err != nil {
		if errors.Is(err, ErrConflict) {
			// A concurrent callback won the unique provider-subject insert.
			// Its identity is authoritative, never the provisional user above.
			_ = tx.Rollback(ctx)
			resolved, resolvedFound, lookupErr := findIdentityUserPool(ctx, s, "FORTY_TWO", profile.Subject)
			if lookupErr == nil && resolvedFound {
				return FortyTwoLoginResolution{User: resolved}, nil
			}
		}
		return FortyTwoLoginResolution{}, err
	}
	user, err = enrichFortyTwoUser(ctx, tx, user, profile)
	if err != nil {
		return FortyTwoLoginResolution{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return FortyTwoLoginResolution{}, mapWriteError("commit 42 identity resolution", err)
	}
	return FortyTwoLoginResolution{User: user, AutoLinked: autoLinked}, nil
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
		if _, err := enrichFortyTwoUser(ctx, tx, existing, profile); err != nil {
			return err
		}
		if err := updateFortyTwoIdentity(ctx, tx, userID, profile); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}
	if err := insertFortyTwoIdentity(ctx, tx, userID, profile); err != nil {
		return err
	}
	var user User
	if err := tx.QueryRow(ctx,
		`SELECT "id", "email", "emailVerified", "username", "firstName", "lastName", "avatarUrl", "campus", "status"::text, "globalRole"::text
		 FROM "User" WHERE "id" = $1 FOR UPDATE`,
		userID,
	).Scan(&user.ID, &user.Email, &user.EmailVerified, &user.Username, &user.FirstName, &user.LastName,
		&user.AvatarURL, &user.Campus, &user.Status, &user.GlobalRole); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("find user for 42 identity link: %w", err)
	}
	if _, err := enrichFortyTwoUser(ctx, tx, user, profile); err != nil {
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
		`SELECT u."id", u."email", u."emailVerified", u."username", u."firstName", u."lastName", u."avatarUrl", u."campus", u."status"::text, u."globalRole"::text
		 FROM "AuthIdentity" ai JOIN "User" u ON u."id" = ai."userId"
		 WHERE ai."provider" = CAST($1 AS "AuthProvider") AND ai."providerSubject" = $2 FOR UPDATE OF ai`,
		provider, subject,
	).Scan(&user.ID, &user.Email, &user.EmailVerified, &user.Username, &user.FirstName, &user.LastName,
		&user.AvatarURL, &user.Campus, &user.Status, &user.GlobalRole)
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
		user := User{ID: uuid.NewString(), Email: profile.Email, EmailVerified: true, Username: username,
			FirstName: profile.FirstName, LastName: profile.LastName, AvatarURL: profile.AvatarURL,
			Campus: profile.Campus, Status: AccountStatusActive, GlobalRole: "USER"}
		var insertedID string
		err := tx.QueryRow(ctx,
			`INSERT INTO "User" ("id", "email", "emailVerified", "username", "firstName", "lastName", "avatarUrl", "campus", "twoFactorEnabled", "status", "globalRole", "createdAt", "updatedAt")
			 VALUES ($1, $2, true, $3, $4, $5, $6, $7, false, CAST('ACTIVE' AS "AccountStatus"), CAST('USER' AS "GlobalRole"), $8, $8)
			 ON CONFLICT ("username") DO NOTHING
			 RETURNING "id"`,
			user.ID, user.Email, user.Username, user.FirstName, user.LastName, user.AvatarURL, user.Campus, now,
		).Scan(&insertedID)
		if err == nil && insertedID == user.ID {
			return user, nil
		}
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if isUniqueViolation(err) {
			return User{}, ErrConflict
		}
		return User{}, mapWriteError("create 42 user", err)
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
		 VALUES ($1, $2, CAST('FORTY_TWO' AS "AuthProvider"), $3, $4, true, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		uuid.NewString(), userID, profile.Subject, profile.Email, nullableString(profile.DisplayName), metadata)
	if err != nil {
		return mapWriteError("insert 42 identity", err)
	}
	return nil
}

func updateFortyTwoIdentity(ctx context.Context, tx pgx.Tx, userID string, profile FortyTwoProfile) error {
	command, err := tx.Exec(ctx,
		`UPDATE "AuthIdentity"
		 SET "email" = $3, "emailVerified" = true, "updatedAt" = CURRENT_TIMESTAMP
		 WHERE "userId" = $1
		   AND "provider" = CAST('FORTY_TWO' AS "AuthProvider")
		   AND "providerSubject" = $2`,
		userID, profile.Subject, profile.Email,
	)
	if err != nil {
		return fmt.Errorf("update 42 identity: %w", err)
	}
	if command.RowsAffected() != 1 {
		return ErrNotFound
	}
	return nil
}

// enrichFortyTwoUser only fills blank profile fields; provider data never
// changes a user's username, email, or nonblank profile values.
func enrichFortyTwoUser(ctx context.Context, tx pgx.Tx, user User, profile FortyTwoProfile) (User, error) {
	err := tx.QueryRow(ctx,
		`UPDATE "User"
		 SET "firstName" = CASE
				 WHEN NULLIF(BTRIM("firstName"), '') IS NULL AND NULLIF(BTRIM($2), '') IS NOT NULL THEN BTRIM($2)
				 ELSE "firstName" END,
		     "lastName" = CASE
				 WHEN NULLIF(BTRIM("lastName"), '') IS NULL AND NULLIF(BTRIM($3), '') IS NOT NULL THEN BTRIM($3)
				 ELSE "lastName" END,
		     "avatarUrl" = CASE
				 WHEN NULLIF(BTRIM("avatarUrl"), '') IS NULL AND NULLIF(BTRIM($4), '') IS NOT NULL THEN BTRIM($4)
				 ELSE "avatarUrl" END,
		     "campus" = CASE
				 WHEN NULLIF(BTRIM("campus"), '') IS NULL AND NULLIF(BTRIM($5), '') IS NOT NULL THEN BTRIM($5)
				 ELSE "campus" END,
		     "emailVerified" = CASE WHEN "email" = $6 THEN true ELSE "emailVerified" END,
		     "updatedAt" = CURRENT_TIMESTAMP
		 WHERE "id" = $1
		 RETURNING "id", "email", "emailVerified", "username", "firstName", "lastName", "avatarUrl", "campus", "status"::text, "globalRole"::text`,
		user.ID, profile.FirstName, profile.LastName, profile.AvatarURL, profile.Campus, profile.Email,
	).Scan(&user.ID, &user.Email, &user.EmailVerified, &user.Username, &user.FirstName, &user.LastName,
		&user.AvatarURL, &user.Campus, &user.Status, &user.GlobalRole)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("enrich 42 user profile: %w", err)
	}
	return user, nil
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
		`SELECT u."id", u."email", u."emailVerified", u."username", u."firstName", u."lastName", u."avatarUrl", u."campus", u."status"::text, u."globalRole"::text
		 FROM "AuthIdentity" ai JOIN "User" u ON u."id" = ai."userId"
		 WHERE ai."provider" = CAST($1 AS "AuthProvider") AND ai."providerSubject" = $2`,
		provider, subject,
	).Scan(&user.ID, &user.Email, &user.EmailVerified, &user.Username, &user.FirstName, &user.LastName,
		&user.AvatarURL, &user.Campus, &user.Status, &user.GlobalRole)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, false, nil
	}
	if err != nil {
		return User{}, false, fmt.Errorf("find provider identity: %w", err)
	}
	return user, true, nil
}
