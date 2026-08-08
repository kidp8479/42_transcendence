package server

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/42london/42_transcendence/auth/internal/store"
)

const (
	fortyTwoAuthorizeURL = "https://api.intra.42.fr/oauth/authorize"
	fortyTwoTokenURL     = "https://api.intra.42.fr/oauth/token"
	fortyTwoProfileURL   = "https://api.intra.42.fr/v2/me"
	oauthTransactionTTL  = 10 * time.Minute
	oauthRequestTimeout  = 10 * time.Second
)

type fortyTwoTokenResponse struct {
	AccessToken string `json:"access_token"`
}

type fortyTwoProfileResponse struct {
	ID        json.Number `json:"id"`
	Login     string      `json:"login"`
	Email     string      `json:"email"`
	FirstName string      `json:"first_name"`
	LastName  string      `json:"last_name"`
	Image     struct {
		Link string `json:"link"`
	} `json:"image"`
	Campus []struct {
		Name string `json:"name"`
	} `json:"campus"`
	Display string `json:"displayname"`
}

func (s *Server) handleFortyTwoStart(w http.ResponseWriter, r *http.Request) {
	returnTo := safeOAuthReturnPath(r.URL.Query().Get("returnTo"))
	url, err := s.createFortyTwoTransaction(r.Context(), returnTo, "LOGIN", nil)
	if err != nil {
		logOAuthFailure(w, err)
		return
	}
	http.Redirect(w, r, url, http.StatusFound)
}

func (s *Server) handleFortyTwoAvailability(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"available": s.fortyTwoOAuthAvailable()})
}

func (s *Server) handleAccountLink(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("provider") != "FORTY_TWO" {
		writeError(w, http.StatusNotFound, "Not Found", "provider not found")
		return
	}
	accessToken, ok := bearerToken(r.Header.Get("Authorization"))
	if !ok {
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return
	}
	claims, _, err := s.validateAccess(r.Context(), accessToken)
	if errors.Is(err, errAccessInvalid) || errors.Is(err, errAccessInactive) {
		writeError(w, http.StatusUnauthorized, "Unauthorized", "active session required")
		return
	}
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "Service Unavailable", "account link could not be started")
		return
	}
	authorizationURL, err := s.createFortyTwoTransaction(r.Context(), "/user-settings", "LINK", &claims.Subject)
	if err != nil {
		logOAuthFailure(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"authorizationUrl": authorizationURL})
}

func (s *Server) createFortyTwoTransaction(ctx context.Context, returnTo, purpose string, userID *string) (string, error) {
	if !s.fortyTwoOAuthAvailable() {
		return "", errors.New("42 OAuth is not configured")
	}
	state, err := randomOAuthState()
	if err != nil {
		return "", err
	}
	redirectURI := s.oauthCallbackURI()
	if err := s.store.CreateOAuthTransaction(ctx, store.OAuthTransaction{
		Provider: "FORTY_TWO", StateHash: hashOAuthState(state), RedirectURI: redirectURI,
		ReturnTo: returnTo, Purpose: purpose, InitiatingUserID: userID,
		ExpiresAt: time.Now().UTC().Add(oauthTransactionTTL),
	}); err != nil {
		return "", err
	}
	authorizationURL, err := url.Parse(fortyTwoAuthorizeURL)
	if err != nil {
		return "", err
	}
	query := authorizationURL.Query()
	query.Set("response_type", "code")
	query.Set("client_id", s.oauth42.ClientID)
	query.Set("redirect_uri", redirectURI)
	query.Set("scope", "public")
	query.Set("state", state)
	authorizationURL.RawQuery = query.Encode()
	return authorizationURL.String(), nil
}

func (s *Server) fortyTwoOAuthAvailable() bool {
	return s.cfg.OAuthProvidersCallbackOrigin != "" &&
		s.oauth42.ClientID != "" &&
		s.oauth42.ClientSecret != "" &&
		s.oauth42.HTTPClient != nil
}

func (s *Server) handleFortyTwoCallback(w http.ResponseWriter, r *http.Request) {
	code, state := r.URL.Query().Get("code"), r.URL.Query().Get("state")
	if code == "" || state == "" {
		writeError(w, http.StatusBadRequest, "Bad Request", "OAuth callback is invalid")
		return
	}
	transaction, err := s.store.ConsumeOAuthTransaction(r.Context(), hashOAuthState(state))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusBadRequest, "Bad Request", "OAuth callback is invalid")
		return
	}
	if err != nil || transaction.Provider != "FORTY_TWO" {
		logOAuthFailure(w, err)
		return
	}
	profile, err := s.fetchFortyTwoProfile(r.Context(), code, transaction.RedirectURI)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Bad Request", "OAuth login could not be completed")
		return
	}
	if transaction.Purpose == "LINK" {
		if transaction.InitiatingUserID == nil || s.store.LinkFortyTwoIdentity(r.Context(), *transaction.InitiatingUserID, profile) != nil {
			writeError(w, http.StatusConflict, "Conflict", "account link could not be completed")
			return
		}
		s.recordEvent(r, transaction.InitiatingUserID, "IDENTITY_LINK_SUCCEEDED", "FORTY_TWO", nil)
		http.Redirect(w, r, transaction.ReturnTo, http.StatusFound)
		return
	}
	user, err := s.store.ResolveFortyTwoLogin(r.Context(), profile)
	if errors.Is(err, store.ErrConflict) {
		writeError(w, http.StatusConflict, "Conflict", "OAuth login could not be completed")
		return
	}
	if err != nil || user.Status != store.AccountStatusActive {
		writeError(w, http.StatusUnauthorized, "Unauthorized", "OAuth login could not be completed")
		return
	}
	session, accessToken, err := s.createLogin(r, user, "FORTY_TWO")
	if err != nil {
		logOAuthFailure(w, err)
		return
	}
	s.setRefreshCookies(w, session)
	s.recordEvent(r, &user.ID, "LOGIN_SUCCEEDED", "FORTY_TWO", &session.ID)
	// The access JWT remains intentionally out of URLs; the refresh cookie
	// allows the application to obtain it through its normal refresh flow.
	_ = accessToken
	http.Redirect(w, r, transaction.ReturnTo, http.StatusFound)
}

func (s *Server) fetchFortyTwoProfile(ctx context.Context, code, redirectURI string) (store.FortyTwoProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, oauthRequestTimeout)
	defer cancel()
	form := url.Values{"grant_type": {"authorization_code"}, "client_id": {s.oauth42.ClientID},
		"client_secret": {s.oauth42.ClientSecret}, "code": {code}, "redirect_uri": {redirectURI}}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, fortyTwoTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return store.FortyTwoProfile{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := s.oauth42.HTTPClient.Do(request)
	if err != nil {
		return store.FortyTwoProfile{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return store.FortyTwoProfile{}, errors.New("42 token exchange failed")
	}
	var exchanged fortyTwoTokenResponse
	if json.NewDecoder(http.MaxBytesReader(nil, response.Body, 16*1024)).Decode(&exchanged) != nil || exchanged.AccessToken == "" {
		return store.FortyTwoProfile{}, errors.New("42 token response is invalid")
	}
	profileRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, fortyTwoProfileURL, nil)
	if err != nil {
		return store.FortyTwoProfile{}, err
	}
	profileRequest.Header.Set("Authorization", "Bearer "+exchanged.AccessToken)
	profileResponse, err := s.oauth42.HTTPClient.Do(profileRequest)
	if err != nil {
		return store.FortyTwoProfile{}, err
	}
	defer profileResponse.Body.Close()
	if profileResponse.StatusCode != http.StatusOK {
		return store.FortyTwoProfile{}, errors.New("42 profile request failed")
	}
	var raw fortyTwoProfileResponse
	decoder := json.NewDecoder(http.MaxBytesReader(nil, profileResponse.Body, 64*1024))
	decoder.UseNumber()
	if decoder.Decode(&raw) != nil {
		return store.FortyTwoProfile{}, errors.New("42 profile response is invalid")
	}
	subject := raw.ID.String()
	email, err := normalizeEmail(raw.Email)
	if err != nil || !numericSubject(subject) {
		return store.FortyTwoProfile{}, errors.New("42 profile response is incomplete")
	}

	profile := store.FortyTwoProfile{Subject: subject, Email: email, Username: raw.Login, DisplayName: raw.Display}
	profile.FirstName = nullableProfileString(raw.FirstName)
	profile.LastName = nullableProfileString(raw.LastName)
	profile.AvatarURL = nullableProfileString(raw.Image.Link)
	if len(raw.Campus) > 0 {
		profile.Campus = nullableProfileString(raw.Campus[0].Name)
	}
	return profile, nil
}

func nullableProfileString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func numericSubject(value string) bool {
	if value == "" {
		return false
	}
	for _, character := range value {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}

func (s *Server) oauthCallbackURI() string {
	return strings.TrimRight(s.cfg.OAuthProvidersCallbackOrigin, "/") + "/auth/oauth/42/callback"
}

func safeOAuthReturnPath(value string) string {
	if value == "" || strings.ContainsAny(value, "\\\x00\r\n") || !strings.HasPrefix(value, "/") || strings.HasPrefix(value, "//") {
		return "/dashboard"
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || strings.HasPrefix(parsed.Path, "//") {
		return "/dashboard"
	}
	normalized := path.Clean(parsed.Path)
	if !strings.HasPrefix(normalized, "/") {
		return "/dashboard"
	}
	for _, prefix := range []string{"/dashboard", "/projects", "/profile", "/settings", "/user-settings"} {
		if normalized == prefix || strings.HasPrefix(normalized, prefix+"/") {
			return normalized
		}
	}
	return "/dashboard"
}

func randomOAuthState() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func hashOAuthState(state string) string {
	sum := sha256.Sum256([]byte(state))
	return hex.EncodeToString(sum[:])
}

func logOAuthFailure(w http.ResponseWriter, err error) {
	_ = err // Provider failures can contain sensitive grant values; do not log them.
	writeError(w, http.StatusServiceUnavailable, "Service Unavailable", "OAuth login could not be completed")
}
