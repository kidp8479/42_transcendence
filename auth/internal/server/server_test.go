package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/42london/42_transcendence/auth/internal/config"
	"github.com/42london/42_transcendence/auth/internal/middleware"
	"github.com/42london/42_transcendence/auth/internal/password"
	"github.com/42london/42_transcendence/auth/internal/store"
	"github.com/42london/42_transcendence/auth/internal/token"
)

var testNow = time.Date(2026, time.August, 2, 12, 0, 0, 0, time.UTC)

type testAuthStore struct {
	credential        store.LocalCredential
	created           store.CreatedRefreshSession
	family            store.RefreshFamily
	access            store.AccessState
	err               error
	createFamilyCalls int
	rotateCalls       int
	revokeCalls       int
	issueTicketCalls  int
	consumeCalls      int
	revalidateCalls   int
	ticket            string
	admission         store.WebSocketAdmission
}

func (s *testAuthStore) CreateLocalAccount(context.Context, string, string, string) (store.User, error) {
	return s.credential.User, s.err
}

func (s *testAuthStore) FindLocalCredential(context.Context, string) (store.LocalCredential, error) {
	return s.credential, s.err
}

func (s *testAuthStore) CreateRefreshFamily(
	context.Context, store.User, string, time.Duration, time.Duration, *string, *string,
) (store.CreatedRefreshSession, error) {
	s.createFamilyCalls++
	return s.created, s.err
}

func (s *testAuthStore) RotateRefreshToken(
	context.Context, string, string, time.Duration,
) (store.CreatedRefreshSession, error) {
	s.rotateCalls++
	return s.created, s.err
}

func (s *testAuthStore) GetRefreshFamily(context.Context, string, string) (store.RefreshFamily, error) {
	return s.family, s.err
}

func (s *testAuthStore) RevokeRefreshFamily(context.Context, string, string, string) (store.RefreshFamily, error) {
	s.revokeCalls++
	return s.family, s.err
}

func (s *testAuthStore) IntrospectAccess(context.Context, string, string) (store.AccessState, error) {
	return s.access, s.err
}

func (s *testAuthStore) IssueWebSocketTicket(context.Context, string, string) (string, error) {
	s.issueTicketCalls++
	return s.ticket, s.err
}

func (s *testAuthStore) ConsumeWebSocketTicket(context.Context, string) (store.WebSocketAdmission, error) {
	s.consumeCalls++
	return s.admission, s.err
}

func (s *testAuthStore) ValidateWebSocketSession(context.Context, string, string) error {
	s.revalidateCalls++
	return s.err
}

func (s *testAuthStore) RecordEvent(context.Context, *string, string, *string, *string, *string) error {
	return nil
}

type testTokenService struct {
	compact string
	claims  token.Claims
	err     error
}

func (s testTokenService) Mint(context.Context, token.MintRequest) (string, error) {
	return s.compact, s.err
}

func (s testTokenService) Validate(context.Context, string) (token.Claims, error) {
	return s.claims, s.err
}

func testConfig() config.Config {
	return config.Config{
		AppOrigin:         "http://localhost:5173",
		RefreshCookieName: "tr_refresh", CSRFCookieName: "tr_csrf",
		RefreshIdleTTL: 7 * 24 * time.Hour, RefreshAbsoluteTTL: 30 * 24 * time.Hour,
		JWTAccessTTL: 15 * time.Minute,
	}
}

func testFamily() store.RefreshFamily {
	user := store.User{ID: "user-id", Status: store.AccountStatusActive, GlobalRole: "USER"}
	return store.RefreshFamily{
		ID: "family-id", User: user, AuthenticationMethod: "LOCAL", AssuranceLevel: 1,
		AuthenticatedAt: testNow.Add(-time.Hour), IdleExpiresAt: testNow.Add(7 * 24 * time.Hour),
		AbsoluteExpiresAt: testNow.Add(30 * 24 * time.Hour),
	}
}

func newLoginTestServer(authStore authStore, tokens tokenService) *Server {
	return &Server{
		cfg: testConfig(), internalToken: "internal-token",
		store: authStore, tokens: tokens, passwords: password.NewHasher(),
		loginIPLimiter:      middleware.NewFixedWindowLimiter(loginRequestsPerIP, rateLimitWindow, maxRateLimitEntries),
		loginAccountLimiter: middleware.NewFixedWindowLimiter(loginRequestsPerAccount, rateLimitWindow, maxRateLimitEntries),
		passwordSlots:       make(chan struct{}, passwordConcurrency),
	}
}

func TestHandleLoginRequiresActiveAccountAndReturnsAccessToken(t *testing.T) {
	passwords := password.NewHasher()
	passwordHash, err := passwords.Hash("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	for _, test := range []struct {
		name       string
		status     store.AccountStatus
		wantStatus int
		wantCreate int
	}{
		{"active", store.AccountStatusActive, http.StatusOK, 1},
		{"pending", store.AccountStatusPendingApproval, http.StatusUnauthorized, 0},
		{"disabled", store.AccountStatusDisabled, http.StatusUnauthorized, 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			family := testFamily()
			family.User.Status = test.status
			authStore := &testAuthStore{
				credential: store.LocalCredential{User: family.User, PasswordHash: passwordHash},
				created: store.CreatedRefreshSession{
					RefreshFamily: family, RefreshToken: "refresh-token", CSRFToken: "csrf-token",
				},
			}
			server := newLoginTestServer(authStore, testTokenService{compact: "access-token"})
			server.decoyPasswordHash = passwordHash
			request := httptest.NewRequest(http.MethodPost, "/auth/login",
				strings.NewReader(`{"email":"student@example.com","password":"correct horse battery staple"}`))
			request.Header.Set("Origin", server.cfg.AppOrigin)
			response := httptest.NewRecorder()

			server.handleLogin(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, test.wantStatus)
			}
			if authStore.createFamilyCalls != test.wantCreate {
				t.Errorf("CreateRefreshFamily calls = %d, want %d", authStore.createFamilyCalls, test.wantCreate)
			}
			if test.wantStatus == http.StatusOK {
				if !strings.Contains(response.Body.String(), `"accessToken":"access-token"`) {
					t.Errorf("response = %s, want access token", response.Body.String())
				}
				cookies := response.Result().Cookies()
				if len(cookies) != 2 ||
					!cookies[0].HttpOnly || cookies[0].Path != "/auth" ||
					cookies[1].HttpOnly || cookies[1].Path != "/" {
					t.Errorf("refresh cookies = %#v", cookies)
				}
			}
		})
	}
}

func TestHandleRefreshRequiresExactOriginAndDoubleSubmitCSRF(t *testing.T) {
	family := testFamily()
	authStore := &testAuthStore{created: store.CreatedRefreshSession{
		RefreshFamily: family, RefreshToken: "next-refresh", CSRFToken: "csrf-token",
	}}
	server := newLoginTestServer(authStore, testTokenService{compact: "access-token"})

	request := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	request.Header.Set("Origin", server.cfg.AppOrigin)
	request.Header.Set("X-CSRF-Token", "wrong")
	request.AddCookie(&http.Cookie{Name: "tr_refresh", Value: "refresh-token"})
	request.AddCookie(&http.Cookie{Name: "tr_csrf", Value: "csrf-token"})
	response := httptest.NewRecorder()
	server.handleRefresh(response, request)

	if response.Code != http.StatusForbidden || authStore.rotateCalls != 0 {
		t.Fatalf("status = %d, rotate calls = %d; want 403 and no rotation", response.Code, authStore.rotateCalls)
	}
}

func TestHandleIntrospectReturnsCurrentRoleForValidJWTAndFamily(t *testing.T) {
	family := testFamily()
	claims := token.Claims{
		Subject: "user-id", SessionID: "family-id", TokenID: "jti",
		ExpiresAt: testNow.Add(10 * time.Minute), AuthenticationTime: family.AuthenticatedAt,
		AuthenticationMethod: "LOCAL", AssuranceLevel: "aal1",
	}
	authStore := &testAuthStore{access: store.AccessState{RefreshFamily: family, GlobalRole: "PLATFORM_ADMIN"}}
	server := &Server{
		cfg: testConfig(), internalToken: "internal-token",
		store: authStore, tokens: testTokenService{claims: claims},
	}
	request := httptest.NewRequest(http.MethodPost, "/auth/internal/introspect",
		strings.NewReader(`{"accessToken":"jwt"}`))
	request.Header.Set("Authorization", "Bearer internal-token")
	response := httptest.NewRecorder()

	server.handleIntrospect(response, request)

	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"PLATFORM_ADMIN"`) {
		t.Fatalf("response = %d %s", response.Code, response.Body.String())
	}
}

func TestHandleIntrospectRejectsRevokedFamily(t *testing.T) {
	authStore := &testAuthStore{err: store.ErrNotFound}
	server := &Server{
		cfg: testConfig(), internalToken: "internal-token", store: authStore,
		tokens: testTokenService{claims: token.Claims{Subject: "user", SessionID: "family"}},
	}
	request := httptest.NewRequest(http.MethodPost, "/auth/internal/introspect",
		strings.NewReader(`{"accessToken":"jwt"}`))
	request.Header.Set("Authorization", "Bearer internal-token")
	response := httptest.NewRecorder()
	server.handleIntrospect(response, request)

	if response.Code != http.StatusUnauthorized || !strings.Contains(response.Body.String(), "TOKEN_INACTIVE") {
		t.Fatalf("response = %d %s", response.Code, response.Body.String())
	}
}

func TestHandleIntrospectDistinguishesInvalidTokensFromInfrastructureFailures(t *testing.T) {
	for _, test := range []struct {
		name       string
		authStore  *testAuthStore
		tokens     testTokenService
		wantStatus int
		wantCode   string
	}{
		{
			name:       "invalid JWT",
			authStore:  &testAuthStore{},
			tokens:     testTokenService{err: fmt.Errorf("%w: signature is invalid", token.ErrInvalid)},
			wantStatus: http.StatusUnauthorized,
			wantCode:   "TOKEN_INVALID",
		},
		{
			name:       "key provider unavailable",
			authStore:  &testAuthStore{},
			tokens:     testTokenService{err: errors.New("Vault unavailable")},
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "INTROSPECTION_UNAVAILABLE",
		},
		{
			name:       "database unavailable",
			authStore:  &testAuthStore{err: errors.New("database unavailable")},
			tokens:     testTokenService{claims: token.Claims{Subject: "user", SessionID: "family"}},
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "INTROSPECTION_UNAVAILABLE",
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := &Server{
				cfg: testConfig(), internalToken: "internal-token",
				store: test.authStore, tokens: test.tokens,
			}
			request := httptest.NewRequest(http.MethodPost, "/auth/internal/introspect",
				strings.NewReader(`{"accessToken":"jwt"}`))
			request.Header.Set("Authorization", "Bearer internal-token")
			response := httptest.NewRecorder()

			server.handleIntrospect(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", response.Code, test.wantStatus, response.Body.String())
			}
			if !strings.Contains(response.Body.String(), test.wantCode) {
				t.Fatalf("body = %s, want code %s", response.Body.String(), test.wantCode)
			}
		})
	}
}

func TestRefreshReplayClearsCookies(t *testing.T) {
	server := &Server{
		cfg: testConfig(), internalToken: "internal-token",
		store: &testAuthStore{err: store.ErrReplay},
	}
	request := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	request.Header.Set("Origin", server.cfg.AppOrigin)
	request.Header.Set("X-CSRF-Token", "csrf-token")
	request.AddCookie(&http.Cookie{Name: "tr_refresh", Value: "refresh-token"})
	request.AddCookie(&http.Cookie{Name: "tr_csrf", Value: "csrf-token"})
	response := httptest.NewRecorder()
	server.handleRefresh(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", response.Code)
	}
	for _, cookie := range response.Result().Cookies() {
		if cookie.MaxAge != -1 {
			t.Errorf("cookie %q MaxAge = %d, want -1", cookie.Name, cookie.MaxAge)
		}
	}
}

func TestSecurityHeadersDisableCaching(t *testing.T) {
	server := &Server{}
	handler := server.securityHeaders(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/", nil))
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Errorf("Cache-Control = %q", response.Header().Get("Cache-Control"))
	}
}

func TestNormalizeEmail(t *testing.T) {
	email, err := normalizeEmail("  Student@Example.COM ")
	if err != nil || email != "student@example.com" {
		t.Fatalf("normalizeEmail() = %q, %v", email, err)
	}
	if _, err := normalizeEmail("Student <student@example.com>"); err == nil {
		t.Fatal("display name was accepted")
	}
}

func TestHandleHealthFailsWhenRuntimeIsUnavailable(t *testing.T) {
	server := &Server{ready: func() bool { return false }}
	response := httptest.NewRecorder()
	server.handleHealth(response, httptest.NewRequest(http.MethodGet, "/auth/health", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", response.Code)
	}
}

func TestBearerTokenRejectsMalformedAuthorization(t *testing.T) {
	for _, value := range []string{"", "bearer token", "Bearer ", "Basic token"} {
		if _, ok := bearerToken(value); ok {
			t.Errorf("bearerToken(%q) accepted malformed authorization", value)
		}
	}
	if value, ok := bearerToken("Bearer token"); !ok || value != "token" {
		t.Errorf("bearerToken() = %q, %v", value, ok)
	}
}

func TestValidateAccessRejectsChangedAuthenticationContext(t *testing.T) {
	family := testFamily()
	server := &Server{
		store: &testAuthStore{access: store.AccessState{RefreshFamily: family, GlobalRole: "USER"}},
		tokens: testTokenService{claims: token.Claims{
			Subject: "user-id", SessionID: "family-id", AuthenticationMethod: "LOCAL",
			AssuranceLevel: "aal2", AuthenticationTime: family.AuthenticatedAt,
		}},
	}
	if _, _, err := server.validateAccess(context.Background(), "jwt"); !errors.Is(err, errAccessInactive) {
		t.Fatalf("validateAccess() error = %v, want inactive", err)
	}
}

func TestHandleIssueWebSocketTicketRequiresExactOriginAndActiveAccess(t *testing.T) {
	family := testFamily()
	claims := token.Claims{
		Subject: "user-id", SessionID: "family-id",
		AuthenticationTime:   family.AuthenticatedAt,
		AuthenticationMethod: "LOCAL", AssuranceLevel: "aal1",
	}
	authStore := &testAuthStore{
		access: store.AccessState{RefreshFamily: family, GlobalRole: "USER"},
		ticket: strings.Repeat("a", 43),
	}
	server := &Server{
		cfg: testConfig(), store: authStore, webSockets: authStore,
		tokens: testTokenService{claims: claims},
		ticketAccountLimiter: middleware.NewFixedWindowLimiter(
			ticketRequestsPerAccount, rateLimitWindow, maxRateLimitEntries,
		),
	}

	rejected := httptest.NewRequest(http.MethodPost, "/auth/ws-ticket", nil)
	rejected.Header.Set("Origin", "http://evil.example")
	rejected.Header.Set("Authorization", bearerHeader("access-token"))
	rejectedResponse := httptest.NewRecorder()
	server.handleIssueWebSocketTicket(rejectedResponse, rejected)
	if rejectedResponse.Code != http.StatusForbidden || authStore.issueTicketCalls != 0 {
		t.Fatalf("wrong origin response = %d, issue calls = %d", rejectedResponse.Code, authStore.issueTicketCalls)
	}

	request := httptest.NewRequest(http.MethodPost, "/auth/ws-ticket", nil)
	request.Header.Set("Origin", server.cfg.AppOrigin)
	request.Header.Set("Authorization", bearerHeader("access-token"))
	response := httptest.NewRecorder()
	server.handleIssueWebSocketTicket(response, request)
	if response.Code != http.StatusCreated ||
		!strings.Contains(response.Body.String(), `"expiresIn":60`) ||
		authStore.issueTicketCalls != 1 {
		t.Fatalf("ticket response = %d %s, issue calls = %d", response.Code, response.Body.String(), authStore.issueTicketCalls)
	}
}

func TestHandleIssueWebSocketTicketRateLimitsBySubject(t *testing.T) {
	family := testFamily()
	claims := token.Claims{
		Subject: "user-id", SessionID: "family-id",
		AuthenticationTime:   family.AuthenticatedAt,
		AuthenticationMethod: "LOCAL", AssuranceLevel: "aal1",
	}
	authStore := &testAuthStore{
		access: store.AccessState{RefreshFamily: family, GlobalRole: "USER"},
		ticket: strings.Repeat("a", 43),
	}
	server := &Server{
		cfg: testConfig(), store: authStore, webSockets: authStore,
		tokens: testTokenService{claims: claims},
		ticketAccountLimiter: middleware.NewFixedWindowLimiter(
			ticketRequestsPerAccount, rateLimitWindow, maxRateLimitEntries,
		),
	}

	for range ticketRequestsPerAccount {
		request := httptest.NewRequest(http.MethodPost, "/auth/ws-ticket", nil)
		request.Header.Set("Origin", server.cfg.AppOrigin)
		request.Header.Set("Authorization", bearerHeader("access-token"))
		response := httptest.NewRecorder()
		server.handleIssueWebSocketTicket(response, request)
		if response.Code != http.StatusCreated {
			t.Fatalf("allowed ticket status = %d, want 201", response.Code)
		}
	}

	request := httptest.NewRequest(http.MethodPost, "/auth/ws-ticket", nil)
	request.Header.Set("Origin", server.cfg.AppOrigin)
	request.Header.Set("Authorization", bearerHeader("access-token"))
	response := httptest.NewRecorder()
	server.handleIssueWebSocketTicket(response, request)
	if response.Code != http.StatusTooManyRequests ||
		authStore.issueTicketCalls != ticketRequestsPerAccount {
		t.Fatalf(
			"limited response = %d, issue calls = %d; want 429 and %d",
			response.Code, authStore.issueTicketCalls, ticketRequestsPerAccount,
		)
	}
}

func TestHandleConsumeWebSocketTicketAndRevalidateRequireInternalCredential(t *testing.T) {
	authStore := &testAuthStore{
		admission: store.WebSocketAdmission{
			UserID: "user-id", RefreshFamilyID: "family-id",
			Username: "student",
		},
	}
	server := &Server{
		internalToken: "internal-token", webSockets: authStore,
	}
	ticket := strings.Repeat("a", 43)

	consume := httptest.NewRequest(http.MethodPost, "/auth/internal/ws-ticket/consume",
		strings.NewReader(fmt.Sprintf(`{"ticket":%q}`, ticket)))
	consume.Header.Set("Authorization", bearerHeader(server.internalToken))
	consumeResponse := httptest.NewRecorder()
	server.handleConsumeWebSocketTicket(consumeResponse, consume)
	if consumeResponse.Code != http.StatusOK ||
		!strings.Contains(consumeResponse.Body.String(), `"sid":"family-id"`) ||
		authStore.consumeCalls != 1 {
		t.Fatalf("consume response = %d %s, calls = %d", consumeResponse.Code, consumeResponse.Body.String(), authStore.consumeCalls)
	}

	revalidate := httptest.NewRequest(http.MethodPost, "/auth/internal/ws-session/revalidate",
		strings.NewReader(`{"sub":"user-id","sid":"family-id"}`))
	revalidate.Header.Set("Authorization", bearerHeader(server.internalToken))
	revalidateResponse := httptest.NewRecorder()
	server.handleRevalidateWebSocketSession(revalidateResponse, revalidate)
	if revalidateResponse.Code != http.StatusOK || authStore.revalidateCalls != 1 {
		t.Fatalf("revalidate response = %d %s, calls = %d", revalidateResponse.Code, revalidateResponse.Body.String(), authStore.revalidateCalls)
	}

	unauthorized := httptest.NewRequest(http.MethodPost, "/auth/internal/ws-ticket/consume",
		strings.NewReader(fmt.Sprintf(`{"ticket":%q}`, ticket)))
	unauthorizedResponse := httptest.NewRecorder()
	server.handleConsumeWebSocketTicket(unauthorizedResponse, unauthorized)
	if unauthorizedResponse.Code != http.StatusUnauthorized || authStore.consumeCalls != 1 {
		t.Fatalf("unauthorized response = %d, consume calls = %d", unauthorizedResponse.Code, authStore.consumeCalls)
	}
}

func bearerHeader(value string) string {
	return strings.Join([]string{"Bearer", value}, " ")
}
