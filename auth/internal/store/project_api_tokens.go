package store

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	ProjectAPITokenPrefix       = "trp_v1_"
	projectAPITokenSelectorSize = 16
	projectAPITokenSecretSize   = 32
	MaxProjectAPITokens         = 10
)

type ProjectAPITokenPermission string

const (
	ProjectAPITokenRead      ProjectAPITokenPermission = "READ"
	ProjectAPITokenReadWrite ProjectAPITokenPermission = "READ_WRITE"
)

type ProjectAPIToken struct {
	ID              string
	ProjectID       string
	Label           string
	Permission      ProjectAPITokenPermission
	CreatedByUserID *string
	CreatedAt       time.Time
	ExpiresAt       time.Time
	LastUsedAt      *time.Time
	RevokedAt       *time.Time
	RevokedByUserID *string
}

type CreatedProjectAPIToken struct {
	ProjectAPIToken
	Token string
}

type CreateProjectAPITokenRequest struct {
	ProjectID       string
	Label           string
	Permission      ProjectAPITokenPermission
	ExpiresAt       time.Time
	CreatedByUserID string
}

type ProjectAPITokenPrincipal struct {
	TokenID    string
	ProjectID  string
	Permission ProjectAPITokenPermission
}

func (s *Store) SetProjectAPITokenPepper(value string) error {
	if len(value) < 32 {
		return fmt.Errorf("project API token pepper must be at least 32 characters")
	}
	s.projectAPITokenPepper = []byte(value)
	return nil
}

func (s *Store) CreateProjectAPIToken(
	ctx context.Context,
	request CreateProjectAPITokenRequest,
) (CreatedProjectAPIToken, error) {
	pepper, err := s.currentProjectAPITokenPepper()
	if err != nil {
		return CreatedProjectAPIToken{}, err
	}
	selector, err := randomToken(projectAPITokenSelectorSize)
	if err != nil {
		return CreatedProjectAPIToken{}, err
	}
	secret, err := randomToken(projectAPITokenSecretSize)
	if err != nil {
		return CreatedProjectAPIToken{}, err
	}
	token := formatProjectAPIToken(selector, secret)
	now := time.Now().UTC()
	created := CreatedProjectAPIToken{
		ProjectAPIToken: ProjectAPIToken{
			ID:              uuid.NewString(),
			ProjectID:       request.ProjectID,
			Label:           request.Label,
			Permission:      request.Permission,
			CreatedByUserID: stringPointer(request.CreatedByUserID),
			CreatedAt:       now,
			ExpiresAt:       request.ExpiresAt.UTC(),
		},
		Token: token,
	}

	tx, err := s.currentPool().Begin(ctx)
	if err != nil {
		return CreatedProjectAPIToken{}, fmt.Errorf("begin project API token transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Serialize the count-then-insert across independent auth-service
	// requests without granting auth_runtime read access to Project.
	if _, err := tx.Exec(
		ctx,
		`SELECT pg_advisory_xact_lock(hashtext($1))`,
		created.ProjectID,
	); err != nil {
		return CreatedProjectAPIToken{}, fmt.Errorf("lock project API token issuance: %w", err)
	}
	var activeCount int
	if err := tx.QueryRow(
		ctx,
		`SELECT count(*)
		 FROM "ProjectApiToken"
		 WHERE "projectId" = $1
		   AND "revokedAt" IS NULL
		   AND "expiresAt" > CURRENT_TIMESTAMP`,
		created.ProjectID,
	).Scan(&activeCount); err != nil {
		return CreatedProjectAPIToken{}, fmt.Errorf("count active project API tokens: %w", err)
	}
	if activeCount >= MaxProjectAPITokens {
		return CreatedProjectAPIToken{}, ErrConflict
	}

	_, err = tx.Exec(
		ctx,
		`INSERT INTO "ProjectApiToken"
			("id", "projectId", "label", "selector", "secretHmac",
			 "permission", "createdByUserId", "createdAt", "expiresAt")
		 VALUES ($1, $2, $3, $4, $5, CAST($6 AS "ProjectApiTokenPermission"), $7, $8, $9)`,
		created.ID,
		created.ProjectID,
		created.Label,
		selector,
		projectAPITokenHMAC(pepper, selector, secret),
		string(created.Permission),
		created.CreatedByUserID,
		created.CreatedAt,
		created.ExpiresAt,
	)
	if err != nil {
		return CreatedProjectAPIToken{}, mapWriteError("insert project API token", err)
	}
	if err := recordProjectAPITokenEvent(ctx, tx, created.ID, created.ProjectID, created.CreatedByUserID, "CREATED"); err != nil {
		return CreatedProjectAPIToken{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return CreatedProjectAPIToken{}, fmt.Errorf("commit project API token transaction: %w", err)
	}
	return created, nil
}

func (s *Store) ListProjectAPITokens(ctx context.Context, projectID string) ([]ProjectAPIToken, error) {
	rows, err := s.currentPool().Query(
		ctx,
		`SELECT "id", "projectId", "label", "permission"::text, "createdByUserId",
		        "createdAt", "expiresAt", "lastUsedAt", "revokedAt", "revokedByUserId"
		 FROM "ProjectApiToken"
		 WHERE "projectId" = $1
		 ORDER BY "createdAt" DESC`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list project API tokens: %w", err)
	}
	defer rows.Close()

	tokens := make([]ProjectAPIToken, 0)
	for rows.Next() {
		var token ProjectAPIToken
		if err := rows.Scan(
			&token.ID, &token.ProjectID, &token.Label, &token.Permission, &token.CreatedByUserID,
			&token.CreatedAt, &token.ExpiresAt, &token.LastUsedAt, &token.RevokedAt, &token.RevokedByUserID,
		); err != nil {
			return nil, fmt.Errorf("scan project API token: %w", err)
		}
		tokens = append(tokens, token)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate project API tokens: %w", err)
	}
	return tokens, nil
}

func (s *Store) RevokeProjectAPIToken(
	ctx context.Context,
	projectID string,
	tokenID string,
	actorUserID string,
) (ProjectAPIToken, error) {
	return s.changeProjectAPITokenState(ctx, projectID, tokenID, actorUserID, true)
}

func (s *Store) DeleteProjectAPIToken(
	ctx context.Context,
	projectID string,
	tokenID string,
	actorUserID string,
) error {
	tx, err := s.currentPool().Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin project API token deletion: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var deleted ProjectAPIToken
	err = tx.QueryRow(
		ctx,
		`DELETE FROM "ProjectApiToken"
		 WHERE "id" = $1 AND "projectId" = $2
		 RETURNING "id", "projectId", "label", "permission"::text, "createdByUserId",
		           "createdAt", "expiresAt", "lastUsedAt", "revokedAt", "revokedByUserId"`,
		tokenID,
		projectID,
	).Scan(
		&deleted.ID, &deleted.ProjectID, &deleted.Label, &deleted.Permission, &deleted.CreatedByUserID,
		&deleted.CreatedAt, &deleted.ExpiresAt, &deleted.LastUsedAt, &deleted.RevokedAt, &deleted.RevokedByUserID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete project API token: %w", err)
	}
	if err := recordProjectAPITokenEvent(ctx, tx, deleted.ID, deleted.ProjectID, stringPointer(actorUserID), "DELETED"); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit project API token deletion: %w", err)
	}
	return nil
}

func (s *Store) IntrospectProjectAPIToken(
	ctx context.Context,
	value string,
) (ProjectAPITokenPrincipal, error) {
	selector, secret, ok := parseProjectAPIToken(value)
	if !ok {
		return ProjectAPITokenPrincipal{}, ErrNotFound
	}
	pepper, err := s.currentProjectAPITokenPepper()
	if err != nil {
		return ProjectAPITokenPrincipal{}, err
	}
	tx, err := s.currentPool().Begin(ctx)
	if err != nil {
		return ProjectAPITokenPrincipal{}, fmt.Errorf("begin project API token introspection: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var principal ProjectAPITokenPrincipal
	var digest string
	// Lock the credential row through verification, last-use update, and
	// commit. Revoke and delete acquire the same row lock via UPDATE/DELETE,
	// so an introspection that starts after either mutation commits cannot
	// observe or return a still-active credential.
	err = tx.QueryRow(
		ctx,
		`SELECT "id", "projectId", "permission"::text, "secretHmac"
		 FROM "ProjectApiToken"
		 WHERE "selector" = $1
		   AND "revokedAt" IS NULL
		   AND "expiresAt" > CURRENT_TIMESTAMP
		 FOR UPDATE`,
		selector,
	).Scan(&principal.TokenID, &principal.ProjectID, &principal.Permission, &digest)
	if errors.Is(err, pgx.ErrNoRows) {
		return ProjectAPITokenPrincipal{}, ErrNotFound
	}
	if err != nil {
		return ProjectAPITokenPrincipal{}, fmt.Errorf("introspect project API token: %w", err)
	}
	if !hmac.Equal([]byte(projectAPITokenHMAC(pepper, selector, secret)), []byte(digest)) {
		return ProjectAPITokenPrincipal{}, ErrNotFound
	}
	if _, err := tx.Exec(
		ctx,
		`UPDATE "ProjectApiToken" SET "lastUsedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
		principal.TokenID,
	); err != nil {
		return ProjectAPITokenPrincipal{}, fmt.Errorf("update project API token last use: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return ProjectAPITokenPrincipal{}, fmt.Errorf("commit project API token introspection: %w", err)
	}
	return principal, nil
}

func (s *Store) changeProjectAPITokenState(
	ctx context.Context,
	projectID string,
	tokenID string,
	actorUserID string,
	revoke bool,
) (ProjectAPIToken, error) {
	tx, err := s.currentPool().Begin(ctx)
	if err != nil {
		return ProjectAPIToken{}, fmt.Errorf("begin project API token state change: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var token ProjectAPIToken
	err = tx.QueryRow(
		ctx,
		`UPDATE "ProjectApiToken"
		 SET "revokedAt" = CURRENT_TIMESTAMP,
		     "revokedByUserId" = $3
		 WHERE "id" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL
		 RETURNING "id", "projectId", "label", "permission"::text, "createdByUserId",
		           "createdAt", "expiresAt", "lastUsedAt", "revokedAt", "revokedByUserId"`,
		tokenID,
		projectID,
		actorUserID,
	).Scan(
		&token.ID, &token.ProjectID, &token.Label, &token.Permission, &token.CreatedByUserID,
		&token.CreatedAt, &token.ExpiresAt, &token.LastUsedAt, &token.RevokedAt, &token.RevokedByUserID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(
			ctx,
			`SELECT "id", "projectId", "label", "permission"::text, "createdByUserId",
			        "createdAt", "expiresAt", "lastUsedAt", "revokedAt", "revokedByUserId"
			 FROM "ProjectApiToken"
			 WHERE "id" = $1 AND "projectId" = $2`,
			tokenID,
			projectID,
		).Scan(
			&token.ID, &token.ProjectID, &token.Label, &token.Permission, &token.CreatedByUserID,
			&token.CreatedAt, &token.ExpiresAt, &token.LastUsedAt, &token.RevokedAt, &token.RevokedByUserID,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			return ProjectAPIToken{}, ErrNotFound
		}
		if err != nil {
			return ProjectAPIToken{}, fmt.Errorf("load already revoked project API token: %w", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return ProjectAPIToken{}, fmt.Errorf("commit idempotent project API token revocation: %w", err)
		}
		return token, nil
	}
	if err != nil {
		return ProjectAPIToken{}, fmt.Errorf("revoke project API token: %w", err)
	}
	if revoke {
		if err := recordProjectAPITokenEvent(ctx, tx, token.ID, token.ProjectID, stringPointer(actorUserID), "REVOKED"); err != nil {
			return ProjectAPIToken{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return ProjectAPIToken{}, fmt.Errorf("commit project API token state change: %w", err)
	}
	return token, nil
}

func recordProjectAPITokenEvent(
	ctx context.Context,
	tx pgx.Tx,
	tokenID string,
	projectID string,
	actorUserID *string,
	eventType string,
) error {
	_, err := tx.Exec(
		ctx,
		`INSERT INTO "ProjectApiTokenEvent"
			("id", "tokenId", "projectId", "actorUserId", "eventType", "createdAt")
		 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
		uuid.NewString(),
		tokenID,
		projectID,
		actorUserID,
		eventType,
	)
	if err != nil {
		return fmt.Errorf("record project API token event: %w", err)
	}
	return nil
}

func (s *Store) currentProjectAPITokenPepper() ([]byte, error) {
	if len(s.projectAPITokenPepper) == 0 {
		return nil, fmt.Errorf("project API token pepper is unavailable")
	}
	return s.projectAPITokenPepper, nil
}

func formatProjectAPIToken(selector string, secret string) string {
	return ProjectAPITokenPrefix + selector + "." + secret
}

func parseProjectAPIToken(value string) (string, string, bool) {
	if !strings.HasPrefix(value, ProjectAPITokenPrefix) {
		return "", "", false
	}
	parts := strings.Split(strings.TrimPrefix(value, ProjectAPITokenPrefix), ".")
	if len(parts) != 2 || len(parts[0]) != 22 || len(parts[1]) != 43 {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func projectAPITokenHMAC(pepper []byte, selector string, secret string) string {
	mac := hmac.New(sha256.New, pepper)
	_, _ = mac.Write([]byte(selector))
	_, _ = mac.Write([]byte("."))
	_, _ = mac.Write([]byte(secret))
	return hex.EncodeToString(mac.Sum(nil))
}

func stringPointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
