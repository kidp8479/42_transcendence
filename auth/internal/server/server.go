package server

import (
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
)

const (
	maxRequestBody          = 16 * 1024
	rateLimitWindow         = time.Minute
	maxRateLimitEntries     = 10_000
	registerRequestsPerIP   = 5
	loginRequestsPerIP      = 10
	loginRequestsPerAccount = 5
	passwordConcurrency     = 2
)

var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{3,32}$`)

type Server struct {
	cfg                 config.Config
	store               *store.Store
	passwords           *password.Hasher
	registerIPLimiter   *middleware.FixedWindowLimiter
	loginIPLimiter      *middleware.FixedWindowLimiter
	loginAccountLimiter *middleware.FixedWindowLimiter
	passwordSlots       chan struct{}
	decoyPasswordHash   string
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
	SessionToken  string  `json:"sessionToken"`
	RequestMethod string  `json:"requestMethod"`
	Origin        *string `json:"origin"`
	CSRFToken     *string `json:"csrfToken"`
}

type sessionResponse struct {
	User              store.User `json:"user"`
	CSRFToken         string     `json:"csrfToken"`
	IdleExpiresAt     time.Time  `json:"idleExpiresAt"`
	AbsoluteExpiresAt time.Time  `json:"absoluteExpiresAt"`
}

type introspectionResponse struct {
	Active               bool      `json:"active"`
	SessionID            string    `json:"sessionId"`
	UserID               string    `json:"userId"`
	AuthenticationMethod string    `json:"authenticationMethod"`
	AssuranceLevel       int       `json:"assuranceLevel"`
	AuthenticatedAt      time.Time `json:"authenticatedAt"`
	IdleExpiresAt        time.Time `json:"idleExpiresAt"`
	AbsoluteExpiresAt    time.Time `json:"absoluteExpiresAt"`
}

type errorResponse struct {
	StatusCode int    `json:"statusCode"`
	Error      string `json:"error"`
	Message    string `json:"message"`
	Code       string `json:"code,omitempty"`
}

func New(
	cfg config.Config,
	authStore *store.Store,
	passwords *password.Hasher,
) (http.Handler, error) {
	decoyPasswordHash, err := passwords.Hash("auth-decoy-password")
	if err != nil {
		return nil, fmt.Errorf("create decoy password hash: %w", err)
	}

	server := &Server{
		cfg:                 cfg,
		store:               authStore,
		passwords:           passwords,
		registerIPLimiter:   middleware.NewFixedWindowLimiter(registerRequestsPerIP, rateLimitWindow, maxRateLimitEntries),
		loginIPLimiter:      middleware.NewFixedWindowLimiter(loginRequestsPerIP, rateLimitWindow, maxRateLimitEntries),
		loginAccountLimiter: middleware.NewFixedWindowLimiter(loginRequestsPerAccount, rateLimitWindow, maxRateLimitEntries),
		passwordSlots:       make(chan struct{}, passwordConcurrency),
		decoyPasswordHash:   decoyPasswordHash,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /auth/health", server.handleHealth)
	mux.HandleFunc("POST /auth/register", server.handleRegister)
	mux.HandleFunc("POST /auth/login", server.handleLogin)
	mux.HandleFunc("POST /auth/logout", server.handleLogout)
	mux.HandleFunc("GET /auth/session", server.handleSession)
	mux.HandleFunc("POST /auth/internal/introspect", server.handleIntrospect)

	return server.recoverPanic(server.securityHeaders(mux)), nil
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
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

	session, err := s.createSession(r, user, "LOCAL")
	if err != nil {
		log.Printf("create registration session: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "session could not be created")
		return
	}
	s.setSessionCookies(w, session)
	s.recordEvent(r, &user.ID, "REGISTER_SUCCEEDED", "LOCAL", &session.ID)
	writeJSON(w, http.StatusCreated, toSessionResponse(session))
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
	if !found || !valid {
		var userID *string
		if found {
			userID = &credential.ID
		}
		s.recordEvent(r, userID, "LOGIN_FAILED", "LOCAL", nil)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "invalid email or password")
		return
	}

	session, err := s.createSession(r, credential.User, "LOCAL")
	if err != nil {
		log.Printf("create login session: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "session could not be created")
		return
	}
	s.setSessionCookies(w, session)
	s.recordEvent(r, &credential.ID, "LOGIN_SUCCEEDED", "LOCAL", &session.ID)
	writeJSON(w, http.StatusOK, toSessionResponse(session))
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	sessionToken, csrfToken, ok := s.sessionTokens(r)
	if !ok {
		s.clearSessionCookies(w)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return
	}
	if !s.validOrigin(r.Header.Get("Origin")) || r.Header.Get("X-CSRF-Token") != csrfToken {
		writeError(w, http.StatusForbidden, "Forbidden", "CSRF validation failed")
		return
	}

	session, err := s.store.IntrospectSession(r.Context(), sessionToken, s.cfg.SessionIdleTimeout)
	if errors.Is(err, store.ErrNotFound) {
		s.clearSessionCookies(w)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return
	}
	if err != nil {
		log.Printf("introspect logout session: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "logout could not be completed")
		return
	}
	if !store.VerifyTokenHash(csrfToken, session.CSRFTokenHash) {
		writeError(w, http.StatusForbidden, "Forbidden", "CSRF validation failed")
		return
	}
	if err := s.store.RevokeSession(r.Context(), sessionToken); err != nil && !errors.Is(err, store.ErrNotFound) {
		log.Printf("revoke session: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "logout could not be completed")
		return
	}

	s.clearSessionCookies(w)
	s.recordEvent(r, &session.User.ID, "LOGOUT_SUCCEEDED", session.AuthenticationMethod, &session.ID)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	sessionToken, csrfToken, ok := s.sessionTokens(r)
	if !ok {
		s.clearSessionCookies(w)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return
	}

	session, err := s.store.IntrospectSession(r.Context(), sessionToken, s.cfg.SessionIdleTimeout)
	if errors.Is(err, store.ErrNotFound) {
		s.clearSessionCookies(w)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return
	}
	if err != nil {
		log.Printf("get session: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "session could not be loaded")
		return
	}
	if !store.VerifyTokenHash(csrfToken, session.CSRFTokenHash) {
		s.clearSessionCookies(w)
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return
	}

	writeJSON(w, http.StatusOK, sessionResponse{
		User:              session.User,
		CSRFToken:         csrfToken,
		IdleExpiresAt:     session.IdleExpiresAt,
		AbsoluteExpiresAt: session.AbsoluteExpiresAt,
	})
}

func (s *Server) handleIntrospect(w http.ResponseWriter, r *http.Request) {
	if !s.validInternalToken(r.Header.Get("Authorization")) {
		ipHash := store.HashMetadata(clientIP(r))
		if ipHash == nil {
			log.Print("rejected internal introspection credentials from ip_hash=unknown")
		} else {
			log.Printf("rejected internal introspection credentials from ip_hash=%s", *ipHash)
		}
		writeErrorCode(
			w,
			http.StatusUnauthorized,
			"Unauthorized",
			"invalid internal credentials",
			"INVALID_INTERNAL_CREDENTIALS",
		)
		return
	}

	var request introspectionRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}
	if request.SessionToken == "" || request.RequestMethod == "" {
		writeError(w, http.StatusBadRequest, "Bad Request", "sessionToken and requestMethod are required")
		return
	}

	session, err := s.store.IntrospectSession(r.Context(), request.SessionToken, s.cfg.SessionIdleTimeout)
	if errors.Is(err, store.ErrNotFound) {
		writeErrorCode(
			w,
			http.StatusUnauthorized,
			"Unauthorized",
			"session is inactive",
			"SESSION_INACTIVE",
		)
		return
	}
	if err != nil {
		log.Printf("internal session introspection: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error", "session could not be introspected")
		return
	}

	if requiresCSRF(request.RequestMethod) {
		if request.Origin == nil || !s.validOrigin(*request.Origin) ||
			request.CSRFToken == nil ||
			!store.VerifyTokenHash(*request.CSRFToken, session.CSRFTokenHash) {
			writeErrorCode(
				w,
				http.StatusForbidden,
				"Forbidden",
				"CSRF validation failed",
				"CSRF_VALIDATION_FAILED",
			)
			return
		}
	}

	writeJSON(w, http.StatusOK, introspectionResponse{
		Active:               true,
		SessionID:            session.ID,
		UserID:               session.User.ID,
		AuthenticationMethod: session.AuthenticationMethod,
		AssuranceLevel:       session.AssuranceLevel,
		AuthenticatedAt:      session.AuthenticatedAt,
		IdleExpiresAt:        session.IdleExpiresAt,
		AbsoluteExpiresAt:    session.AbsoluteExpiresAt,
	})
}

func (s *Server) createSession(r *http.Request, user store.User, method string) (store.CreatedSession, error) {
	return s.store.CreateSession(
		r.Context(),
		user,
		method,
		s.cfg.SessionIdleTimeout,
		s.cfg.SessionAbsoluteTimeout,
		store.HashMetadata(clientIP(r)),
		store.HashMetadata(r.UserAgent()),
	)
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

func (s *Server) setSessionCookies(w http.ResponseWriter, session store.CreatedSession) {
	maxAge := int(time.Until(session.AbsoluteExpiresAt).Seconds())
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.SessionCookieName,
		Value:    session.Token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.CSRFCookieName,
		Value:    session.CSRFToken,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: false,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) clearSessionCookies(w http.ResponseWriter) {
	for _, cookie := range []http.Cookie{
		{
			Name:     s.cfg.SessionCookieName,
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   s.cfg.CookieSecure,
			SameSite: http.SameSiteLaxMode,
		},
		{
			Name:     s.cfg.CSRFCookieName,
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: false,
			Secure:   s.cfg.CookieSecure,
			SameSite: http.SameSiteLaxMode,
		},
	} {
		http.SetCookie(w, &cookie)
	}
}

func (s *Server) sessionTokens(r *http.Request) (string, string, bool) {
	sessionCookie, err := r.Cookie(s.cfg.SessionCookieName)
	if err != nil || sessionCookie.Value == "" {
		return "", "", false
	}
	csrfCookie, err := r.Cookie(s.cfg.CSRFCookieName)
	if err != nil || csrfCookie.Value == "" {
		return "", "", false
	}
	return sessionCookie.Value, csrfCookie.Value, true
}

func (s *Server) validOrigin(origin string) bool {
	return origin == s.cfg.AppOrigin
}

func (s *Server) validInternalToken(authorization string) bool {
	const prefix = "Bearer "
	if !strings.HasPrefix(authorization, prefix) {
		return false
	}
	token := strings.TrimPrefix(authorization, prefix)
	if len(token) != len(s.cfg.InternalToken) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(s.cfg.InternalToken)) == 1
}

func (s *Server) recordEvent(r *http.Request, userID *string, eventType, provider string, sessionID *string) {
	if err := s.store.RecordEvent(
		r.Context(),
		userID,
		eventType,
		&provider,
		sessionID,
		store.HashMetadata(clientIP(r)),
	); err != nil {
		log.Printf("record auth event %s: %v", eventType, err)
	}
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

func normalizeEmail(value string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(normalized)
	if err != nil || address.Address != normalized || len(normalized) > 320 {
		return "", fmt.Errorf("invalid email")
	}
	return normalized, nil
}

func requiresCSRF(method string) bool {
	switch strings.ToUpper(method) {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return false
	default:
		return true
	}
}

func clientIP(r *http.Request) string {
	// nginx is the only published entrypoint and overwrites X-Real-IP. If the
	// auth service is ever exposed directly, replace this assumption with an
	// explicit trusted-proxy allow-list before relying on forwarded headers.
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); net.ParseIP(realIP) != nil {
		return realIP
	}
	if host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr)); err == nil {
		return host
	}
	return strings.Trim(strings.TrimSpace(r.RemoteAddr), "[]")
}

func toSessionResponse(session store.CreatedSession) sessionResponse {
	return sessionResponse{
		User:              session.User,
		CSRFToken:         session.CSRFToken,
		IdleExpiresAt:     session.IdleExpiresAt,
		AbsoluteExpiresAt: session.AbsoluteExpiresAt,
	}
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
		StatusCode: status,
		Error:      name,
		Message:    message,
		Code:       code,
	})
}

func writeRateLimited(w http.ResponseWriter) {
	w.Header().Set("Retry-After", "60")
	writeError(w, http.StatusTooManyRequests, "Too Many Requests", "too many authentication attempts")
}
