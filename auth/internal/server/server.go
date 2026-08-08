package server

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/42london/42_transcendence/auth/internal/config"
	"github.com/42london/42_transcendence/auth/internal/middleware"
	"github.com/42london/42_transcendence/auth/internal/password"
	"github.com/42london/42_transcendence/auth/internal/store"
	"github.com/42london/42_transcendence/auth/internal/token"
	"github.com/google/uuid"
)

const (
	maxRequestBody            = 16 * 1024
	rateLimitWindow           = time.Minute
	maxRateLimitEntries       = 10_000
	registerRequestsPerIP     = 20
	loginRequestsPerIP        = 10
	loginRequestsPerAccount   = 5
	ticketRequestsPerAccount  = 30
	passwordConcurrency       = 2
	projectAPITokenDefaultTTL = 90 * 24 * time.Hour
	projectAPITokenMaxTTL     = 365 * 24 * time.Hour
	healthCheckTimeout        = 2 * time.Second
)

var (
	usernamePattern        = regexp.MustCompile(`^[A-Za-z0-9_-]{3,32}$`)
	webSocketTicketPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)
)

var (
	errAccessInvalid  = errors.New("access token is invalid")
	errAccessInactive = errors.New("access token is inactive")
)

type Server struct {
	cfg                  config.Config
	internalToken        string
	store                authStore
	webSockets           webSocketStore
	tokens               tokenService
	passwords            *password.Hasher
	registerIPLimiter    *middleware.FixedWindowLimiter
	loginIPLimiter       *middleware.FixedWindowLimiter
	loginAccountLimiter  *middleware.FixedWindowLimiter
	ticketAccountLimiter *middleware.FixedWindowLimiter
	passwordSlots        chan struct{}
	decoyPasswordHash    string
	ready                func() bool
	oauth42              OAuth42Config
}

type authStore interface {
	Ping(context.Context) error
	CreateLocalAccount(context.Context, string, string, string) (store.User, error)
	FindLocalCredential(context.Context, string) (store.LocalCredential, error)
	CreateRefreshFamily(context.Context, store.User, string, time.Duration, time.Duration, *string, *string) (store.CreatedRefreshSession, error)
	RotateRefreshToken(context.Context, string, string, time.Duration) (store.CreatedRefreshSession, error)
	RevokeRefreshFamily(context.Context, string, string, string) (store.RefreshFamily, error)
	IntrospectAccess(context.Context, string, string) (store.AccessState, error)
	RecordEvent(context.Context, *string, string, *string, *string, *string) error
	CreateProjectAPIToken(context.Context, store.CreateProjectAPITokenRequest) (store.CreatedProjectAPIToken, error)
	ListProjectAPITokens(context.Context, string) ([]store.ProjectAPIToken, error)
	RevokeProjectAPIToken(context.Context, string, string, string) (store.ProjectAPIToken, error)
	DeleteProjectAPIToken(context.Context, string, string, string) error
	IntrospectProjectAPIToken(context.Context, string) (store.ProjectAPITokenPrincipal, error)
	CreateOAuthTransaction(context.Context, store.OAuthTransaction) error
	ConsumeOAuthTransaction(context.Context, string) (store.OAuthTransaction, error)
	ResolveFortyTwoLogin(context.Context, store.FortyTwoProfile) (store.User, error)
	LinkFortyTwoIdentity(context.Context, string, store.FortyTwoProfile) error
}

// OAuth42Config keeps provider credentials and transport at the process edge.
// The transport is injectable so provider exchange/profile handling is testable.
type OAuth42Config struct {
	ClientID     string
	ClientSecret string
	HTTPClient   interface {
		Do(*http.Request) (*http.Response, error)
	}
}

type webSocketStore interface {
	IssueWebSocketTicket(context.Context, string, string) (string, error)
	ConsumeWebSocketTicket(context.Context, string) (store.WebSocketAdmission, error)
	ValidateWebSocketSession(context.Context, string, string) error
}

type tokenService interface {
	Mint(context.Context, token.MintRequest) (string, error)
	Validate(context.Context, string) (token.Claims, error)
}

type registerRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type introspectionRequest struct {
	AccessToken string `json:"accessToken"`
}

type webSocketTicketRequest struct {
	Ticket string `json:"ticket"`
}

type webSocketSessionRequest struct {
	Subject   string `json:"sub"`
	SessionID string `json:"sid"`
}

type createProjectAPITokenRequest struct {
	ProjectID       string `json:"projectId"`
	Label           string `json:"label"`
	Permission      string `json:"permission"`
	ExpiresAt       string `json:"expiresAt"`
	CreatedByUserID string `json:"createdByUserId"`
}

type revokeProjectAPITokenRequest struct {
	ProjectID   string `json:"projectId"`
	ActorUserID string `json:"actorUserId"`
}

type deleteProjectAPITokenRequest struct {
	ActorUserID string `json:"actorUserId"`
}

type introspectProjectAPITokenRequest struct {
	APIKey string `json:"apiKey"`
}

type tokenResponse struct {
	AccessToken       string     `json:"accessToken"`
	TokenType         string     `json:"tokenType"`
	ExpiresIn         int64      `json:"expiresIn"`
	User              store.User `json:"user"`
	CSRFToken         string     `json:"csrfToken"`
	IdleExpiresAt     time.Time  `json:"idleExpiresAt"`
	AbsoluteExpiresAt time.Time  `json:"absoluteExpiresAt"`
}

type introspectionResponse struct {
	Active               bool      `json:"active"`
	Subject              string    `json:"sub"`
	SessionID            string    `json:"sid"`
	TokenID              string    `json:"jti"`
	ExpiresAt            int64     `json:"exp"`
	AuthTime             int64     `json:"auth_time"`
	GlobalRoles          []string  `json:"global_roles"`
	AuthenticationMethod string    `json:"authenticationMethod"`
	AssuranceLevel       int       `json:"assuranceLevel"`
	AuthenticatedAt      time.Time `json:"authenticatedAt"`
	IdleExpiresAt        time.Time `json:"idleExpiresAt"`
	AbsoluteExpiresAt    time.Time `json:"absoluteExpiresAt"`
}

type webSocketTicketResponse struct {
	Ticket    string `json:"ticket"`
	ExpiresIn int64  `json:"expiresIn"`
}

type webSocketAdmissionResponse struct {
	Active    bool    `json:"active"`
	Subject   string  `json:"sub"`
	SessionID string  `json:"sid"`
	Username  string  `json:"username"`
	AvatarURL *string `json:"avatarUrl"`
}

type projectAPITokenResponse struct {
	ID         string     `json:"id"`
	ProjectID  string     `json:"projectId"`
	Label      string     `json:"label"`
	Permission string     `json:"permission"`
	CreatedAt  time.Time  `json:"createdAt"`
	ExpiresAt  time.Time  `json:"expiresAt"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
	RevokedAt  *time.Time `json:"revokedAt"`
}

type projectAPITokenIntrospectionResponse struct {
	Active        bool      `json:"active"`
	PrincipalType string    `json:"principalType"`
	TokenID       string    `json:"tokenId"`
	ProjectID     string    `json:"projectId"`
	Label         string    `json:"label"`
	Permission    string    `json:"permission"`
	ExpiresAt     time.Time `json:"expiresAt"`
	LastUsedAt    time.Time `json:"lastUsedAt"`
}

type createdProjectAPITokenResponse struct {
	Token  projectAPITokenResponse `json:"token"`
	APIKey string                  `json:"apiKey"`
}

type errorResponse struct {
	StatusCode int    `json:"statusCode"`
	Error      string `json:"error"`
	Message    string `json:"message"`
	Code       string `json:"code,omitempty"`
}

func New(
	cfg config.Config,
	internalToken string,
	authStore *store.Store,
	passwords *password.Hasher,
	tokens tokenService,
) (http.Handler, error) {
	return NewWithOAuthReadiness(cfg, internalToken, authStore, passwords, tokens, OAuth42Config{}, func() bool { return true })
}

func NewWithReadiness(
	cfg config.Config,
	internalToken string,
	authStore *store.Store,
	passwords *password.Hasher,
	tokens tokenService,
	ready func() bool,
) (http.Handler, error) {
	return NewWithOAuthReadiness(cfg, internalToken, authStore, passwords, tokens, OAuth42Config{}, ready)
}

func NewWithOAuthReadiness(
	cfg config.Config,
	internalToken string,
	authStore *store.Store,
	passwords *password.Hasher,
	tokens tokenService,
	oauth42 OAuth42Config,
	ready func() bool,
) (http.Handler, error) {
	if ready == nil {
		ready = func() bool { return true }
	}
	if len(internalToken) < 32 {
		return nil, fmt.Errorf("internal credential must be at least 32 characters")
	}
	if authStore == nil || passwords == nil || tokens == nil {
		return nil, fmt.Errorf("auth store, password hasher, and token service are required")
	}
	decoyPasswordHash, err := passwords.Hash("auth-decoy-password")
	if err != nil {
		return nil, fmt.Errorf("create decoy password hash: %w", err)
	}

	server := &Server{
		cfg:                  cfg,
		internalToken:        internalToken,
		store:                authStore,
		webSockets:           authStore,
		tokens:               tokens,
		passwords:            passwords,
		registerIPLimiter:    middleware.NewFixedWindowLimiter(registerRequestsPerIP, rateLimitWindow, maxRateLimitEntries),
		loginIPLimiter:       middleware.NewFixedWindowLimiter(loginRequestsPerIP, rateLimitWindow, maxRateLimitEntries),
		loginAccountLimiter:  middleware.NewFixedWindowLimiter(loginRequestsPerAccount, rateLimitWindow, maxRateLimitEntries),
		ticketAccountLimiter: middleware.NewFixedWindowLimiter(ticketRequestsPerAccount, rateLimitWindow, maxRateLimitEntries),
		passwordSlots:        make(chan struct{}, passwordConcurrency),
		decoyPasswordHash:    decoyPasswordHash,
		ready:                ready,
		oauth42:              oauth42,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /auth/health", server.handleHealth)
	mux.HandleFunc("POST /auth/register", server.handleRegister)
	mux.HandleFunc("POST /auth/login", server.handleLogin)
	mux.HandleFunc("GET /auth/oauth/42/availability", server.handleFortyTwoAvailability)
	mux.HandleFunc("GET /auth/oauth/42/start", server.handleFortyTwoStart)
	mux.HandleFunc("GET /auth/oauth/42/callback", server.handleFortyTwoCallback)
	mux.HandleFunc("POST /auth/account/link/{provider}", server.handleAccountLink)
	mux.HandleFunc("POST /auth/refresh", server.handleRefresh)
	mux.HandleFunc("POST /auth/logout", server.handleLogout)
	mux.HandleFunc("POST /auth/ws-ticket", server.handleIssueWebSocketTicket)
	mux.HandleFunc("POST /auth/internal/introspect", server.handleIntrospect)
	mux.HandleFunc("POST /auth/internal/project-api-tokens", server.handleCreateProjectAPIToken)
	mux.HandleFunc("GET /auth/internal/projects/{projectId}/api-tokens", server.handleListProjectAPITokens)
	mux.HandleFunc("POST /auth/internal/project-api-tokens/{tokenId}/revoke", server.handleRevokeProjectAPIToken)
	mux.HandleFunc("DELETE /auth/internal/projects/{projectId}/api-tokens/{tokenId}", server.handleDeleteProjectAPIToken)
	mux.HandleFunc("POST /auth/internal/project-api-tokens/introspect", server.handleIntrospectProjectAPIToken)
	mux.HandleFunc("POST /auth/internal/ws-ticket/consume", server.handleConsumeWebSocketTicket)
	mux.HandleFunc("POST /auth/internal/ws-session/revalidate", server.handleRevalidateWebSocketSession)

	return server.recoverPanic(server.securityHeaders(server.requireReady(mux))), nil
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if !s.ready() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), healthCheckTimeout)
	defer cancel()
	if err := s.store.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if !s.validOrigin(r.Header.Get("Origin")) {
		writeError(w, http.StatusForbidden, "Forbidden", "request origin is not allowed")
		return
	}
	if !s.registerIPLimiter.Allow(clientIP(r), time.Now()) {
		writeRateLimited(w)
		return
	}
	var request registerRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	email, err := normalizeEmail(request.Email)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", "email must be valid")
		return
	}
	request.Username = strings.TrimSpace(request.Username)
	if !usernamePattern.MatchString(request.Username) {
		writeError(w, http.StatusBadRequest, "Bad Request", "username must be 3-32 letters, numbers, underscores, or hyphens")
		return
	}
	if len(request.Password) < 12 || len(request.Password) > 128 {
		writeError(w, http.StatusBadRequest, "Bad Request", "password must be 12-128 characters")
		return
	}
	passwordHash, err, available := s.hashPassword(request.Password)
	if !available {
		writeRateLimited(w)
		return
	}
	if err != nil {
		log.Printf("hash registration password: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "account could not be created")
		return
	}
	user, err := s.store.CreateLocalAccount(r.Context(), email, request.Username, passwordHash)
	if errors.Is(err, store.ErrConflict) {
		s.recordEvent(r, nil, "REGISTER_CONFLICT", "LOCAL", nil)
		writeError(w, http.StatusConflict, "Conflict", "email or username already exists")
		return
	}
	if err != nil {
		log.Printf("create local account: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "account could not be created")
		return
	}
	session, accessToken, err := s.createLogin(r, user, "LOCAL")
	if err != nil {
		log.Printf("create registration credentials: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "credentials could not be created")
		return
	}
	s.setRefreshCookies(w, session)
	s.recordEvent(r, &user.ID, "REGISTER_SUCCEEDED", "LOCAL", &session.ID)
	writeJSON(w, http.StatusCreated, s.tokenResponse(session, accessToken))
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.validOrigin(r.Header.Get("Origin")) {
		writeError(w, http.StatusForbidden, "Forbidden", "request origin is not allowed")
		return
	}
	if !s.loginIPLimiter.Allow(clientIP(r), time.Now()) {
		writeRateLimited(w)
		return
	}
	var request loginRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	email, err := normalizeEmail(request.Email)
	if err != nil || len(request.Password) > 128 {
		writeError(w, http.StatusUnauthorized, "Unauthorized", "invalid email or password")
		return
	}
	if !s.loginAccountLimiter.Allow(email, time.Now()) {
		writeRateLimited(w)
		return
	}
	credential, err := s.store.FindLocalCredential(r.Context(), email)
	passwordHash := s.decoyPasswordHash
	found := true
	if errors.Is(err, store.ErrNotFound) {
		found = false
	} else if err != nil {
		log.Printf("find local credential: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "login could not be completed")
		return
	} else {
		passwordHash = credential.PasswordHash
	}
	valid, err, available := s.verifyPassword(request.Password, passwordHash)
	if !available {
		writeRateLimited(w)
		return
	}
	if err != nil {
		log.Printf("verify local password: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "login could not be completed")
		return
	}
	if !found || !valid || credential.Status != store.AccountStatusActive {
		var userID *string
		if found {
			userID = &credential.ID
		}
		s.recordEvent(r, userID, "LOGIN_FAILED", "LOCAL", nil)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "invalid email or password")
		return
	}
	session, accessToken, err := s.createLogin(r, credential.User, "LOCAL")
	if err != nil {
		log.Printf("create login credentials: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "credentials could not be created")
		return
	}
	s.setRefreshCookies(w, session)
	s.recordEvent(r, &credential.ID, "LOGIN_SUCCEEDED", "LOCAL", &session.ID)
	writeJSON(w, http.StatusOK, s.tokenResponse(session, accessToken))
}

func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	refreshToken, csrfToken, ok := s.cookieCredentials(w, r)
	if !ok {
		return
	}
	session, err := s.store.RotateRefreshToken(
		r.Context(), refreshToken, csrfToken, s.cfg.RefreshIdleTTL,
	)
	if errors.Is(err, store.ErrCSRF) {
		writeError(w, http.StatusForbidden, "Forbidden", "CSRF validation failed")
		return
	}
	if errors.Is(err, store.ErrReplay) || errors.Is(err, store.ErrNotFound) {
		s.clearRefreshCookies(w)
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "refresh session is inactive", "SESSION_INACTIVE")
		return
	}
	if err != nil {
		log.Printf("rotate refresh token: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "credentials could not be refreshed")
		return
	}
	s.setRefreshCookies(w, session)
	accessToken, err := s.mintAccessToken(r.Context(), session.RefreshFamily)
	if err != nil {
		log.Printf("mint refreshed access token: %v", err)
		writeError(w, http.StatusServiceUnavailable, "Service Unavailable", "access token could not be issued")
		return
	}
	s.recordEvent(r, &session.User.ID, "REFRESH_SUCCEEDED", session.AuthenticationMethod, &session.ID)
	writeJSON(w, http.StatusOK, s.tokenResponse(session, accessToken))
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	refreshToken, csrfToken, ok := s.cookieCredentials(w, r)
	if !ok {
		return
	}
	family, err := s.store.RevokeRefreshFamily(r.Context(), refreshToken, csrfToken, "LOGOUT")
	if errors.Is(err, store.ErrCSRF) {
		writeError(w, http.StatusForbidden, "Forbidden", "CSRF validation failed")
		return
	}
	if errors.Is(err, store.ErrNotFound) {
		s.clearRefreshCookies(w)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return
	}
	if err != nil {
		log.Printf("revoke refresh family: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "logout could not be completed")
		return
	}
	s.clearRefreshCookies(w)
	s.recordEvent(r, &family.User.ID, "LOGOUT_SUCCEEDED", family.AuthenticationMethod, &family.ID)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleIntrospect(w http.ResponseWriter, r *http.Request) {
	if !s.requireInternal(w, r) {
		return
	}
	var request introspectionRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	claims, state, err := s.validateAccess(r.Context(), request.AccessToken)
	if errors.Is(err, errAccessInvalid) {
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "access token is invalid", "TOKEN_INVALID")
		return
	}
	if errors.Is(err, errAccessInactive) {
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "access token is inactive", "TOKEN_INACTIVE")
		return
	}
	if err != nil {
		log.Printf("introspect access token: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"access token could not be introspected", "INTROSPECTION_UNAVAILABLE",
		)
		return
	}
	writeJSON(w, http.StatusOK, introspectionResponse{
		Active: true, Subject: claims.Subject, SessionID: claims.SessionID,
		TokenID: claims.TokenID, ExpiresAt: claims.ExpiresAt.Unix(),
		AuthTime: claims.AuthenticationTime.Unix(), GlobalRoles: []string{state.GlobalRole},
		AuthenticationMethod: state.AuthenticationMethod,
		AssuranceLevel:       state.AssuranceLevel,
		AuthenticatedAt:      state.AuthenticatedAt,
		IdleExpiresAt:        state.IdleExpiresAt,
		AbsoluteExpiresAt:    state.AbsoluteExpiresAt,
	})
}

func (s *Server) handleCreateProjectAPIToken(w http.ResponseWriter, r *http.Request) {
	if !s.requireInternal(w, r) {
		return
	}
	var request createProjectAPITokenRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	now := time.Now().UTC()
	expiresAt, err := resolveProjectAPITokenExpiry(request.ExpiresAt, now)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	if err := validateProjectAPITokenCreate(request, expiresAt, now); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	created, err := s.store.CreateProjectAPIToken(
		r.Context(),
		store.CreateProjectAPITokenRequest{
			ProjectID:       request.ProjectID,
			Label:           strings.TrimSpace(request.Label),
			Permission:      store.ProjectAPITokenPermission(request.Permission),
			ExpiresAt:       expiresAt,
			CreatedByUserID: request.CreatedByUserID,
		},
	)
	if errors.Is(err, store.ErrConflict) {
		writeError(
			w,
			http.StatusConflict,
			"Conflict",
			fmt.Sprintf("a project can have at most %d active API tokens", store.MaxProjectAPITokens),
		)
		return
	}
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "Not Found", "project not found")
		return
	}
	if errors.Is(err, store.ErrInvalid) {
		writeError(w, http.StatusBadRequest, "Bad Request", "expiresAt must be in the future")
		return
	}
	if err != nil {
		log.Printf("create project API token: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"project API token could not be created", "PROJECT_API_TOKEN_UNAVAILABLE",
		)
		return
	}
	writeJSON(w, http.StatusCreated, createdProjectAPITokenResponse{
		Token:  projectAPITokenMetadata(created.ProjectAPIToken),
		APIKey: created.Token,
	})
}

func (s *Server) handleListProjectAPITokens(w http.ResponseWriter, r *http.Request) {
	if !s.requireInternal(w, r) {
		return
	}
	projectID := r.PathValue("projectId")
	if !validUUID(projectID) {
		writeError(w, http.StatusBadRequest, "Bad Request", "projectId must be a UUID")
		return
	}
	tokens, err := s.store.ListProjectAPITokens(r.Context(), projectID)
	if err != nil {
		log.Printf("list project API tokens: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"project API tokens could not be listed", "PROJECT_API_TOKEN_UNAVAILABLE",
		)
		return
	}
	response := make([]projectAPITokenResponse, 0, len(tokens))
	for _, projectToken := range tokens {
		response = append(response, projectAPITokenMetadata(projectToken))
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleRevokeProjectAPIToken(w http.ResponseWriter, r *http.Request) {
	if !s.requireInternal(w, r) {
		return
	}
	tokenID := r.PathValue("tokenId")
	var request revokeProjectAPITokenRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	if !validUUID(tokenID) || !validUUID(request.ProjectID) || !validUUID(request.ActorUserID) {
		writeError(w, http.StatusBadRequest, "Bad Request", "projectId, tokenId, and actorUserId must be UUIDs")
		return
	}
	token, err := s.store.RevokeProjectAPIToken(
		r.Context(), request.ProjectID, tokenID, request.ActorUserID,
	)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "Not Found", "project API token not found")
		return
	}
	if err != nil {
		log.Printf("revoke project API token: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"project API token could not be revoked", "PROJECT_API_TOKEN_UNAVAILABLE",
		)
		return
	}
	writeJSON(w, http.StatusOK, projectAPITokenMetadata(token))
}

func (s *Server) handleDeleteProjectAPIToken(w http.ResponseWriter, r *http.Request) {
	if !s.requireInternal(w, r) {
		return
	}
	projectID := r.PathValue("projectId")
	tokenID := r.PathValue("tokenId")
	var request deleteProjectAPITokenRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	if !validUUID(projectID) || !validUUID(tokenID) || !validUUID(request.ActorUserID) {
		writeError(w, http.StatusBadRequest, "Bad Request", "projectId, tokenId, and actorUserId must be UUIDs")
		return
	}
	if err := s.store.DeleteProjectAPIToken(r.Context(), projectID, tokenID, request.ActorUserID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "Not Found", "project API token not found")
		return
	} else if err != nil {
		log.Printf("delete project API token: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"project API token could not be deleted", "PROJECT_API_TOKEN_UNAVAILABLE",
		)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleIntrospectProjectAPIToken(w http.ResponseWriter, r *http.Request) {
	if !s.requireInternal(w, r) {
		return
	}
	var request introspectProjectAPITokenRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	principal, err := s.store.IntrospectProjectAPIToken(r.Context(), request.APIKey)
	if errors.Is(err, store.ErrNotFound) {
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "project API token is invalid", "PROJECT_API_TOKEN_INVALID")
		return
	}
	if err != nil {
		log.Printf("introspect project API token: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"project API token could not be introspected", "PROJECT_API_TOKEN_UNAVAILABLE",
		)
		return
	}
	writeJSON(w, http.StatusOK, projectAPITokenIntrospectionResponse{
		Active: true, PrincipalType: "PROJECT_API_TOKEN", TokenID: principal.TokenID,
		ProjectID: principal.ProjectID, Label: principal.Label,
		Permission: string(principal.Permission), ExpiresAt: principal.ExpiresAt,
		LastUsedAt: principal.LastUsedAt,
	})
}

func validateProjectAPITokenCreate(
	request createProjectAPITokenRequest,
	expiresAt time.Time,
	now time.Time,
) error {
	if !validUUID(request.ProjectID) || !validUUID(request.CreatedByUserID) {
		return errors.New("projectId and createdByUserId must be UUIDs")
	}
	if label := strings.TrimSpace(request.Label); len(label) == 0 || len(label) > 100 {
		return errors.New("label must be 1-100 characters")
	}
	if request.Permission != string(store.ProjectAPITokenRead) &&
		request.Permission != string(store.ProjectAPITokenReadWrite) {
		return errors.New("permission must be READ or READ_WRITE")
	}
	if !expiresAt.After(now) || expiresAt.After(now.Add(projectAPITokenMaxTTL)) {
		return errors.New("expiresAt must be in the next 365 days")
	}
	return nil
}

func resolveProjectAPITokenExpiry(value string, now time.Time) (time.Time, error) {
	if value == "" {
		return now.Add(projectAPITokenDefaultTTL), nil
	}
	expiresAt, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, errors.New("expiresAt must be an RFC3339 timestamp")
	}
	return expiresAt.UTC(), nil
}

func projectAPITokenMetadata(token store.ProjectAPIToken) projectAPITokenResponse {
	return projectAPITokenResponse{
		ID: token.ID, ProjectID: token.ProjectID, Label: token.Label,
		Permission: string(token.Permission), CreatedAt: token.CreatedAt,
		ExpiresAt: token.ExpiresAt, LastUsedAt: token.LastUsedAt, RevokedAt: token.RevokedAt,
	}
}

func validUUID(value string) bool {
	return uuid.Validate(value) == nil
}

func (s *Server) handleIssueWebSocketTicket(w http.ResponseWriter, r *http.Request) {
	if !s.validOrigin(r.Header.Get("Origin")) {
		writeError(w, http.StatusForbidden, "Forbidden", "request origin is not allowed")
		return
	}
	accessToken, ok := bearerToken(r.Header.Get("Authorization"))
	if !ok {
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "access token is required", "TOKEN_INVALID")
		return
	}
	claims, _, err := s.validateAccess(r.Context(), accessToken)
	if errors.Is(err, errAccessInvalid) {
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "access token is invalid", "TOKEN_INVALID")
		return
	}
	if errors.Is(err, errAccessInactive) {
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "access token is inactive", "TOKEN_INACTIVE")
		return
	}
	if err != nil {
		log.Printf("validate websocket ticket request: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"websocket ticket could not be issued", "TICKET_ISSUE_UNAVAILABLE",
		)
		return
	}
	if !s.ticketAccountLimiter.Allow(claims.Subject, time.Now()) {
		writeRateLimited(w)
		return
	}
	ticket, err := s.webSockets.IssueWebSocketTicket(
		r.Context(),
		claims.Subject,
		claims.SessionID,
	)
	if errors.Is(err, store.ErrNotFound) {
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "access token is inactive", "TOKEN_INACTIVE")
		return
	}
	if err != nil {
		log.Printf("issue websocket ticket: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"websocket ticket could not be issued", "TICKET_ISSUE_UNAVAILABLE",
		)
		return
	}
	writeJSON(w, http.StatusCreated, webSocketTicketResponse{
		Ticket:    ticket,
		ExpiresIn: int64(store.WebSocketTicketTTL / time.Second),
	})
}

func (s *Server) handleConsumeWebSocketTicket(w http.ResponseWriter, r *http.Request) {
	if !s.requireInternal(w, r) {
		return
	}
	var request webSocketTicketRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	if !webSocketTicketPattern.MatchString(request.Ticket) {
		writeError(w, http.StatusBadRequest, "Bad Request", "ticket is invalid")
		return
	}
	admission, err := s.webSockets.ConsumeWebSocketTicket(r.Context(), request.Ticket)
	if errors.Is(err, store.ErrNotFound) {
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "websocket ticket is invalid", "TICKET_INVALID")
		return
	}
	if err != nil {
		log.Printf("consume websocket ticket: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"websocket ticket could not be consumed", "TICKET_CONSUME_UNAVAILABLE",
		)
		return
	}
	writeJSON(w, http.StatusOK, webSocketAdmissionResponse{
		Active:    true,
		Subject:   admission.UserID,
		SessionID: admission.RefreshFamilyID,
		Username:  admission.Username,
		AvatarURL: admission.AvatarURL,
	})
}

func (s *Server) handleRevalidateWebSocketSession(w http.ResponseWriter, r *http.Request) {
	if !s.requireInternal(w, r) {
		return
	}
	var request webSocketSessionRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	if request.Subject == "" || request.SessionID == "" {
		writeError(w, http.StatusBadRequest, "Bad Request", "sub and sid are required")
		return
	}
	err := s.webSockets.ValidateWebSocketSession(r.Context(), request.Subject, request.SessionID)
	if errors.Is(err, store.ErrNotFound) {
		writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "websocket session is inactive", "SESSION_INACTIVE")
		return
	}
	if err != nil {
		log.Printf("revalidate websocket session: %v", err)
		writeErrorCode(
			w, http.StatusServiceUnavailable, "Service Unavailable",
			"websocket session could not be revalidated", "SESSION_REVALIDATION_UNAVAILABLE",
		)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"active": true})
}

func (s *Server) createLogin(r *http.Request, user store.User, method string) (store.CreatedRefreshSession, string, error) {
	session, err := s.store.CreateRefreshFamily(
		r.Context(), user, method, s.cfg.RefreshIdleTTL, s.cfg.RefreshAbsoluteTTL,
		store.HashMetadata(clientIP(r)), store.HashMetadata(r.UserAgent()),
	)
	if err != nil {
		return store.CreatedRefreshSession{}, "", err
	}
	accessToken, err := s.mintAccessToken(r.Context(), session.RefreshFamily)
	if err != nil {
		_, revokeErr := s.store.RevokeRefreshFamily(
			r.Context(), session.RefreshToken, session.CSRFToken, "ACCESS_TOKEN_MINT_FAILED",
		)
		if revokeErr != nil {
			log.Printf("revoke family after access token mint failure: %v", revokeErr)
		}
		return store.CreatedRefreshSession{}, "", err
	}
	return session, accessToken, nil
}

func (s *Server) mintAccessToken(ctx context.Context, family store.RefreshFamily) (string, error) {
	return s.tokens.Mint(ctx, token.MintRequest{
		Subject: family.User.ID, SessionID: family.ID,
		AuthenticationMethod: family.AuthenticationMethod,
		AssuranceLevel:       assuranceName(family.AssuranceLevel),
		GlobalRoles:          []string{family.User.GlobalRole},
		AuthenticationTime:   family.AuthenticatedAt,
		Lifetime:             s.cfg.JWTAccessTTL,
	})
}

func (s *Server) validateAccess(ctx context.Context, compact string) (token.Claims, store.AccessState, error) {
	claims, err := s.tokens.Validate(ctx, compact)
	if err != nil {
		if token.IsInvalid(err) {
			return token.Claims{}, store.AccessState{}, fmt.Errorf("%w: %v", errAccessInvalid, err)
		}
		return token.Claims{}, store.AccessState{}, fmt.Errorf("validate access token: %w", err)
	}
	state, err := s.store.IntrospectAccess(ctx, claims.Subject, claims.SessionID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return token.Claims{}, store.AccessState{}, fmt.Errorf("%w: refresh family is inactive", errAccessInactive)
		}
		return token.Claims{}, store.AccessState{}, fmt.Errorf("load access token state: %w", err)
	}
	if claims.AuthenticationMethod != state.AuthenticationMethod ||
		claims.AssuranceLevel != assuranceName(state.AssuranceLevel) ||
		claims.AuthenticationTime.Unix() != state.AuthenticatedAt.UTC().Truncate(time.Second).Unix() {
		return token.Claims{}, store.AccessState{}, fmt.Errorf("%w: authentication context changed", errAccessInactive)
	}
	return claims, state, nil
}

func assuranceName(level int) string {
	return fmt.Sprintf("aal%d", level)
}

func (s *Server) tokenResponse(session store.CreatedRefreshSession, accessToken string) tokenResponse {
	return tokenResponse{
		AccessToken: accessToken, TokenType: "Bearer",
		ExpiresIn: int64(s.cfg.JWTAccessTTL / time.Second),
		User:      session.User, CSRFToken: session.CSRFToken,
		IdleExpiresAt: session.IdleExpiresAt, AbsoluteExpiresAt: session.AbsoluteExpiresAt,
	}
}

func (s *Server) cookieCredentials(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	if !s.validOrigin(r.Header.Get("Origin")) {
		writeError(w, http.StatusForbidden, "Forbidden", "request origin is not allowed")
		return "", "", false
	}
	refreshCookie, err := r.Cookie(s.cfg.RefreshCookieName)
	if err != nil || refreshCookie.Value == "" {
		s.clearRefreshCookies(w)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return "", "", false
	}
	csrfCookie, err := r.Cookie(s.cfg.CSRFCookieName)
	if err != nil || csrfCookie.Value == "" {
		s.clearRefreshCookies(w)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return "", "", false
	}
	header := r.Header.Get("X-CSRF-Token")
	if len(header) != len(csrfCookie.Value) ||
		subtle.ConstantTimeCompare([]byte(header), []byte(csrfCookie.Value)) != 1 {
		writeError(w, http.StatusForbidden, "Forbidden", "CSRF validation failed")
		return "", "", false
	}
	return refreshCookie.Value, csrfCookie.Value, true
}

func (s *Server) setRefreshCookies(w http.ResponseWriter, session store.CreatedRefreshSession) {
	maxAge := max(1, int(time.Until(session.AbsoluteExpiresAt).Seconds()))
	http.SetCookie(w, &http.Cookie{
		Name: s.cfg.RefreshCookieName, Value: session.RefreshToken, Path: "/auth",
		MaxAge: maxAge, HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name: s.cfg.CSRFCookieName, Value: session.CSRFToken, Path: "/",
		MaxAge: maxAge, HttpOnly: false, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) clearRefreshCookies(w http.ResponseWriter) {
	for _, cookie := range []http.Cookie{
		{Name: s.cfg.RefreshCookieName, Path: "/auth", MaxAge: -1, HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode},
		{Name: s.cfg.CSRFCookieName, Path: "/", MaxAge: -1, HttpOnly: false, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode},
	} {
		http.SetCookie(w, &cookie)
	}
}

func (s *Server) requireInternal(w http.ResponseWriter, r *http.Request) bool {
	if s.validInternalToken(r.Header.Get("Authorization")) {
		return true
	}
	ipHash := store.HashMetadata(clientIP(r))
	if ipHash == nil {
		log.Print("rejected internal credentials from ip_hash=unknown")
	} else {
		log.Printf("rejected internal credentials from ip_hash=%s", *ipHash)
	}
	writeErrorCode(w, http.StatusUnauthorized, "Unauthorized", "invalid internal credentials", "INVALID_INTERNAL_CREDENTIALS")
	return false
}

func (s *Server) validOrigin(origin string) bool {
	return s.cfg.AllowsBrowserOrigin(origin)
}

func (s *Server) validInternalToken(authorization string) bool {
	value, ok := bearerToken(authorization)
	if !ok || len(value) != len(s.internalToken) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(value), []byte(s.internalToken)) == 1
}

func bearerToken(authorization string) (string, bool) {
	const prefix = "Bearer "
	if !strings.HasPrefix(authorization, prefix) {
		return "", false
	}
	value := strings.TrimPrefix(authorization, prefix)
	return value, value != ""
}

func (s *Server) recordEvent(r *http.Request, userID *string, eventType, provider string, sessionID *string) {
	if err := s.store.RecordEvent(
		r.Context(), userID, eventType, &provider, sessionID, store.HashMetadata(clientIP(r)),
	); err != nil {
		log.Printf("record auth event %s: %v", eventType, err)
	}
}

func (s *Server) hashPassword(value string) (string, error, bool) {
	if !s.acquirePasswordSlot() {
		return "", nil, false
	}
	defer s.releasePasswordSlot()
	hash, err := s.passwords.Hash(value)
	return hash, err, true
}

func (s *Server) verifyPassword(value, encoded string) (bool, error, bool) {
	if !s.acquirePasswordSlot() {
		return false, nil, false
	}
	defer s.releasePasswordSlot()
	valid, err := s.passwords.Verify(value, encoded)
	return valid, err, true
}

func (s *Server) acquirePasswordSlot() bool {
	select {
	case s.passwordSlots <- struct{}{}:
		return true
	default:
		return false
	}
}

func (s *Server) releasePasswordSlot() {
	<-s.passwordSlots
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("panic serving %s %s: %v", r.Method, r.URL.Path, recovered)
				writeError(w, http.StatusInternalServerError, "Internal Server Error", "request could not be completed")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (s *Server) requireReady(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/health" && !s.ready() {
			writeError(w, http.StatusServiceUnavailable, "Service Unavailable", "authentication service credentials are unavailable")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func normalizeEmail(value string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(normalized)
	if err != nil || address.Address != normalized || len(normalized) > 320 {
		return "", fmt.Errorf("invalid email")
	}
	return normalized, nil
}

func clientIP(r *http.Request) string {
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); net.ParseIP(realIP) != nil {
		return realIP
	}
	if host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr)); err == nil {
		return host
	}
	return strings.Trim(strings.TrimSpace(r.RemoteAddr), "[]")
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBody)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		if errors.Is(err, io.EOF) {
			return fmt.Errorf("request body is required")
		}
		return fmt.Errorf("invalid JSON request body")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return fmt.Errorf("request body must contain a single JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("write JSON response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, name, message string) {
	writeErrorCode(w, status, name, message, "")
}

func writeErrorCode(w http.ResponseWriter, status int, name, message, code string) {
	writeJSON(w, status, errorResponse{
		StatusCode: status, Error: name, Message: message, Code: code,
	})
}

func writeRateLimited(w http.ResponseWriter) {
	w.Header().Set("Retry-After", "60")
	writeError(w, http.StatusTooManyRequests, "Too Many Requests", "too many authentication attempts")
}
