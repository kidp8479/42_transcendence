package server

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
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
	healthErr         error
	createFamilyCalls int
	rotateCalls       int
	revokeCalls       int
	issueTicketCalls  int
	consumeCalls      int
	revalidateCalls   int
	ticket            string
	admission         store.WebSocketAdmission
	projectToken      store.CreatedProjectAPIToken
	projectRequest    store.CreateProjectAPITokenRequest
	projectPrincipal  store.ProjectAPITokenPrincipal
	oauthTransaction  store.OAuthTransaction
	oauthProfile      store.FortyTwoProfile
	oauthCreated      store.OAuthTransaction
	oauthCreateCalls  int
	oauthConsumeCalls int
}

func (s *testAuthStore) Ping(context.Context) error {
	return s.healthErr
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

func (s *testAuthStore) CreateProjectAPIToken(
	_ context.Context,
	request store.CreateProjectAPITokenRequest,
) (store.CreatedProjectAPIToken, error) {
	s.projectRequest = request
	if s.projectToken.ExpiresAt.IsZero() {
		s.projectToken.ProjectAPIToken = store.ProjectAPIToken{
			ID: "6ba7b812-9dad-11d1-80b4-00c04fd430c8", ProjectID: request.ProjectID,
			Label: request.Label, Permission: request.Permission, ExpiresAt: request.ExpiresAt,
		}
	}
	return s.projectToken, s.err
}

func (s *testAuthStore) ListProjectAPITokens(context.Context, string) ([]store.ProjectAPIToken, error) {
	return nil, s.err
}

func (s *testAuthStore) RevokeProjectAPIToken(
	context.Context,
	string,
	string,
	string,
) (store.ProjectAPIToken, error) {
	return store.ProjectAPIToken{}, s.err
}

func (s *testAuthStore) DeleteProjectAPIToken(context.Context, string, string, string) error {
	return s.err
}

func (s *testAuthStore) IntrospectProjectAPIToken(
	context.Context,
	string,
) (store.ProjectAPITokenPrincipal, error) {
	return s.projectPrincipal, s.err
}

func (s *testAuthStore) CreateOAuthTransaction(_ context.Context, transaction store.OAuthTransaction) error {
	s.oauthCreated = transaction
	s.oauthCreateCalls++
	return s.err
}

func (s *testAuthStore) ConsumeOAuthTransaction(context.Context, string) (store.OAuthTransaction, error) {
	s.oauthConsumeCalls++
	return s.oauthTransaction, s.err
}

func (s *testAuthStore) ResolveFortyTwoLogin(_ context.Context, profile store.FortyTwoProfile) (store.User, error) {
	s.oauthProfile = profile
	return s.credential.User, s.err
}

func (s *testAuthStore) LinkFortyTwoIdentity(_ context.Context, _ string, profile store.FortyTwoProfile) error {
	s.oauthProfile = profile
	return s.err
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
		AppOrigin: "http://localhost:5173", OAuthProvidersCallbackOrigin: "http://localhost:5173",
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

type queuedOAuthClient struct {
	responses []*http.Response
	requests  []*http.Request
}

func (c *queuedOAuthClient) Do(request *http.Request) (*http.Response, error) {
	c.requests = append(c.requests, request)
	if len(c.responses) == 0 {
		return nil, errors.New("unexpected provider request")
	}
	response := c.responses[0]
	c.responses = c.responses[1:]
	return response, nil
}

func oauthResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Body: io.NopCloser(bytes.NewBufferString(body)), Header: make(http.Header)}
}

func TestFortyTwoAvailabilityRequiresCompleteConfiguration(t *testing.T) {
	server := newLoginTestServer(&testAuthStore{}, testTokenService{})
	request := httptest.NewRequest(http.MethodGet, "/auth/oauth/42/availability", nil)

	unconfigured := httptest.NewRecorder()
	server.handleFortyTwoAvailability(unconfigured, request)
	if unconfigured.Code != http.StatusOK || !strings.Contains(unconfigured.Body.String(), `"available":false`) {
		t.Fatalf("unconfigured availability = %d %s", unconfigured.Code, unconfigured.Body.String())
	}

	server.oauth42 = OAuth42Config{
		ClientID: "id", ClientSecret: "secret", HTTPClient: &queuedOAuthClient{},
	}
	configured := httptest.NewRecorder()
	server.handleFortyTwoAvailability(configured, request)
	if configured.Code != http.StatusOK || !strings.Contains(configured.Body.String(), `"available":true`) {
		t.Fatalf("configured availability = %d %s", configured.Code, configured.Body.String())
	}
}

func TestFortyTwoStartStoresOnlyStateHashAndSafeReturnPath(t *testing.T) {
	authStore := &testAuthStore{}
	client := &queuedOAuthClient{}
	server := newLoginTestServer(authStore, testTokenService{})
	server.oauth42 = OAuth42Config{ClientID: "id", ClientSecret: "secret", HTTPClient: client}
	request := httptest.NewRequest(http.MethodGet, "/auth/oauth/42/start?returnTo=/user-settings", nil)
	response := httptest.NewRecorder()

	server.handleFortyTwoStart(response, request)

	if response.Code != http.StatusFound || authStore.oauthCreateCalls != 1 {
		t.Fatalf("status = %d, transaction calls = %d", response.Code, authStore.oauthCreateCalls)
	}
	location, err := response.Result().Location()
	if err != nil {
		t.Fatal(err)
	}
	state := location.Query().Get("state")
	if state == "" || authStore.oauthCreated.StateHash != hashOAuthState(state) || authStore.oauthCreated.StateHash == state {
		t.Fatal("OAuth state was not stored exclusively as a SHA-256 hash")
	}
	if authStore.oauthCreated.ReturnTo != "/user-settings" ||
		authStore.oauthCreated.RedirectURI != "http://localhost:5173/auth/oauth/42/callback" ||
		location.Query().Get("scope") != "public" {
		t.Fatalf("unexpected OAuth transaction or authorization URL: %#v, %s", authStore.oauthCreated, location)
	}
}

func TestFortyTwoLinkReturnsToUserSettings(t *testing.T) {
	family := testFamily()
	authStore := &testAuthStore{access: store.AccessState{RefreshFamily: family, GlobalRole: family.User.GlobalRole}}
	server := newLoginTestServer(authStore, testTokenService{claims: token.Claims{
		Subject: family.User.ID, SessionID: family.ID, AuthenticationMethod: family.AuthenticationMethod,
		AssuranceLevel: assuranceName(family.AssuranceLevel), AuthenticationTime: family.AuthenticatedAt,
	}})
	server.oauth42 = OAuth42Config{ClientID: "id", ClientSecret: "secret", HTTPClient: &queuedOAuthClient{}}
	request := httptest.NewRequest(http.MethodPost, "/auth/account/link/FORTY_TWO", nil)
	request.SetPathValue("provider", "FORTY_TWO")
	request.Header.Set("Authorization", "Bearer access")
	response := httptest.NewRecorder()

	server.handleAccountLink(response, request)

	if response.Code != http.StatusOK || authStore.oauthCreated.ReturnTo != "/user-settings" ||
		authStore.oauthCreated.InitiatingUserID == nil || *authStore.oauthCreated.InitiatingUserID != family.User.ID {
		t.Fatalf("status=%d transaction=%#v", response.Code, authStore.oauthCreated)
	}
}

func TestFortyTwoCallbackConsumesThenUsesNumericProfile(t *testing.T) {
	user := store.User{ID: "user-id", Status: store.AccountStatusActive, GlobalRole: "USER"}
	authStore := &testAuthStore{
		credential: store.LocalCredential{User: user},
		created: store.CreatedRefreshSession{RefreshFamily: store.RefreshFamily{
			ID: "family-id", User: user, AuthenticationMethod: "FORTY_TWO", AuthenticatedAt: testNow,
			IdleExpiresAt: testNow.Add(time.Hour), AbsoluteExpiresAt: testNow.Add(24 * time.Hour),
		}, RefreshToken: "refresh", CSRFToken: "csrf"},
		oauthTransaction: store.OAuthTransaction{Provider: "FORTY_TWO", Purpose: "LOGIN", ReturnTo: "/dashboard", RedirectURI: "http://localhost:5173/auth/oauth/42/callback"},
	}
	client := &queuedOAuthClient{responses: []*http.Response{
		oauthResponse(http.StatusOK, `{"access_token":"provider-token"}`),
		oauthResponse(http.StatusOK, `{"id":42,"login":"forty-two","email":"student@example.test","first_name":"Student","last_name":"Example","image":{"link":"https://cdn.example.test/avatar.png"},"campus":[{"name":"42 London"}],"displayname":"Student"}`),
	}}
	server := newLoginTestServer(authStore, testTokenService{compact: "access"})
	server.oauth42 = OAuth42Config{ClientID: "id", ClientSecret: "secret", HTTPClient: client}
	request := httptest.NewRequest(http.MethodGet, "/auth/oauth/42/callback?code=code&state=state", nil)
	response := httptest.NewRecorder()

	server.handleFortyTwoCallback(response, request)

	if response.Code != http.StatusFound || authStore.oauthConsumeCalls != 1 || authStore.oauthProfile.Subject != "42" {
		t.Fatalf("status=%d consumes=%d profile=%#v", response.Code, authStore.oauthConsumeCalls, authStore.oauthProfile)
	}
	if authStore.oauthProfile.FirstName == nil || *authStore.oauthProfile.FirstName != "Student" ||
		authStore.oauthProfile.LastName == nil || *authStore.oauthProfile.LastName != "Example" ||
		authStore.oauthProfile.AvatarURL == nil || *authStore.oauthProfile.AvatarURL != "https://cdn.example.test/avatar.png" ||
		authStore.oauthProfile.Campus == nil || *authStore.oauthProfile.Campus != "42 London" {
		t.Fatalf("profile enrichment fields = %#v", authStore.oauthProfile)
	}
	if len(client.requests) != 2 || client.requests[1].Header.Get("Authorization") != "Bearer provider-token" {
		t.Fatalf("provider calls were not a server-side token exchange and profile request")
	}
}

func TestResolveProjectAPITokenExpiryDefaultsAndEnforcesBounds(t *testing.T) {
	now := time.Date(2026, time.August, 5, 16, 0, 0, 0, time.UTC)
	resolved, err := resolveProjectAPITokenExpiry("", now)
	if err != nil || !resolved.Equal(now.Add(projectAPITokenDefaultTTL)) {
		t.Fatalf("default expiry = %s, %v", resolved, err)
	}
	request := createProjectAPITokenRequest{
		ProjectID: "6ba7b810-9dad-11d1-80b4-00c04fd430c8", CreatedByUserID: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
		Label: "automation", Permission: "READ",
	}
	for _, test := range []struct {
		name string
		when time.Time
		ok   bool
	}{
		{"one second in future", now.Add(time.Second), true},
		{"exactly 365 days", now.Add(projectAPITokenMaxTTL), true},
		{"past", now.Add(-time.Second), false},
		{"beyond 365 days", now.Add(projectAPITokenMaxTTL + time.Second), false},
	} {
		t.Run(test.name, func(t *testing.T) {
			if err := validateProjectAPITokenCreate(request, test.when, now); (err == nil) != test.ok {
				t.Fatalf("validateProjectAPITokenCreate() error = %v, want valid=%v", err, test.ok)
			}
		})
	}
	if _, err := resolveProjectAPITokenExpiry("not-a-timestamp", now); err == nil {
		t.Fatal("resolveProjectAPITokenExpiry() accepted an invalid timestamp")
	}
}

func TestHandleCreateProjectAPITokenReturnsDefaultResolvedExpiry(t *testing.T) {
	authStore := &testAuthStore{}
	server := &Server{internalToken: "internal-token", store: authStore}
	request := httptest.NewRequest(http.MethodPost, "/auth/internal/project-api-tokens", strings.NewReader(
		`{"projectId":"6ba7b810-9dad-11d1-80b4-00c04fd430c8","createdByUserId":"6ba7b811-9dad-11d1-80b4-00c04fd430c8","label":"automation","permission":"READ"}`,
	))
	request.Header.Set("Authorization", "Bearer internal-token")
	response := httptest.NewRecorder()
	server.handleCreateProjectAPIToken(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}

	if authStore.projectRequest.ExpiresAt.Before(time.Now().UTC().Add(projectAPITokenDefaultTTL-time.Second)) ||
		authStore.projectRequest.ExpiresAt.After(time.Now().UTC().Add(projectAPITokenDefaultTTL+time.Second)) {
		t.Fatalf("store expiry = %s, want resolved 90-day default", authStore.projectRequest.ExpiresAt)
	}
	if !strings.Contains(response.Body.String(), authStore.projectRequest.ExpiresAt.Format(time.RFC3339Nano)) {
		t.Fatalf("response does not return resolved expiry: %s", response.Body.String())
	}
}

func TestHandleCreateProjectAPITokenMapsStaleProjectAndExpiryFailures(t *testing.T) {
	for _, test := range []struct {
		name       string
		storeError error
		wantStatus int
	}{
		{"deleted project", store.ErrNotFound, http.StatusNotFound},
		{"expiry elapsed during issuance", store.ErrInvalid, http.StatusBadRequest},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := &Server{
				internalToken: "internal-token",
				store:         &testAuthStore{err: test.storeError},
			}
			request := httptest.NewRequest(http.MethodPost, "/auth/internal/project-api-tokens", strings.NewReader(
				`{"projectId":"6ba7b810-9dad-11d1-80b4-00c04fd430c8","createdByUserId":"6ba7b811-9dad-11d1-80b4-00c04fd430c8","label":"automation","permission":"READ"}`,
			))
			request.Header.Set("Authorization", "Bearer internal-token")
			response := httptest.NewRecorder()

			server.handleCreateProjectAPIToken(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", response.Code, test.wantStatus, response.Body.String())
			}
		})
	}
}

func TestHandleIntrospectProjectAPITokenReturnsMetadata(t *testing.T) {
	expiresAt := testNow.Add(90 * 24 * time.Hour)
	lastUsedAt := testNow.Add(-time.Minute)
	server := &Server{
		internalToken: "internal-token",
		store: &testAuthStore{projectPrincipal: store.ProjectAPITokenPrincipal{
			TokenID: "6ba7b812-9dad-11d1-80b4-00c04fd430c8", ProjectID: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			Label: "automation", Permission: store.ProjectAPITokenReadWrite,
			ExpiresAt: expiresAt, LastUsedAt: lastUsedAt,
		}},
	}
	request := httptest.NewRequest(http.MethodPost, "/auth/internal/project-api-tokens/introspect",
		strings.NewReader(`{"apiKey":"trp_v1_selector.secret"}`))
	request.Header.Set("Authorization", "Bearer internal-token")
	response := httptest.NewRecorder()

	server.handleIntrospectProjectAPIToken(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	for _, value := range []string{
		`"label":"automation"`,
		`"permission":"READ_WRITE"`,
		expiresAt.Format(time.RFC3339Nano),
		lastUsedAt.Format(time.RFC3339Nano),
	} {
		if !strings.Contains(response.Body.String(), value) {
			t.Errorf("response = %s, want %s", response.Body.String(), value)
		}
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
	server := &Server{ready: func() bool { return false }, store: &testAuthStore{}}
	response := httptest.NewRecorder()
	server.handleHealth(response, httptest.NewRequest(http.MethodGet, "/auth/health", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", response.Code)
	}
}

func TestHandleHealthFailsWhenDatabaseIsUnavailable(t *testing.T) {
	server := &Server{
		ready: func() bool { return true },
		store: &testAuthStore{healthErr: errors.New("database unavailable")},
	}
	response := httptest.NewRecorder()
	server.handleHealth(response, httptest.NewRequest(http.MethodGet, "/auth/health", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", response.Code)
	}
	if response.Body.String() != "{\"status\":\"unavailable\"}\n" {
		t.Fatalf("body = %q", response.Body.String())
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
