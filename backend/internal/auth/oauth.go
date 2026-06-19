package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
)

var (
	ErrOAuthNotConfigured = errors.New("oauth provider not configured")
	ErrConsentRequired    = errors.New("lgpd consent required")
	ErrOAuthStateInvalid  = errors.New("invalid oauth state")
	ErrOAuthEmailInUse    = errors.New("email already registered with password login")
	ErrOAuthCodeInvalid   = errors.New("invalid oauth exchange code")
)

type OAuthProfile struct {
	Provider       string
	ProviderUserID string
	Email          string
	DisplayName    string
}

type consentContextKey struct{}

func WithConsent(ctx context.Context) context.Context {
	return context.WithValue(ctx, consentContextKey{}, true)
}

func hasConsentFlag(ctx context.Context) bool {
	return ctx.Value(consentContextKey{}) == true
}

func (s *Service) OAuthRedirectURL(provider string) string {
	return fmt.Sprintf(
		"%s/api/v1/auth/%s/callback",
		strings.TrimRight(s.cfg.OAuth.BackendURL, "/"),
		provider,
	)
}

func (s *Service) googleOAuthConfig(redirectURL string) (*oauth2.Config, error) {
	if s.cfg.OAuth.GoogleClientID == "" || s.cfg.OAuth.GoogleClientSecret == "" {
		return nil, ErrOAuthNotConfigured
	}
	return &oauth2.Config{
		ClientID:     s.cfg.OAuth.GoogleClientID,
		ClientSecret: s.cfg.OAuth.GoogleClientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}, nil
}

func (s *Service) githubOAuthConfig(redirectURL string) (*oauth2.Config, error) {
	if s.cfg.OAuth.GitHubClientID == "" || s.cfg.OAuth.GitHubClientSecret == "" {
		return nil, ErrOAuthNotConfigured
	}
	return &oauth2.Config{
		ClientID:     s.cfg.OAuth.GitHubClientID,
		ClientSecret: s.cfg.OAuth.GitHubClientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"read:user", "user:email"},
		Endpoint:     github.Endpoint,
	}, nil
}

func (s *Service) BeginOAuth(ctx context.Context, provider string, withConsent bool) (string, error) {

	state, err := randomState()
	if err != nil {
		return "", err
	}

	redirectURL := s.OAuthRedirectURL(provider)
	var authURL string

	switch provider {
	case "google":
		cfg, err := s.googleOAuthConfig(redirectURL)
		if err != nil {
			return "", err
		}
		authURL = cfg.AuthCodeURL(state, oauth2.AccessTypeOffline)
	case "github":
		cfg, err := s.githubOAuthConfig(redirectURL)
		if err != nil {
			return "", err
		}
		authURL = cfg.AuthCodeURL(state)
	default:
		return "", fmt.Errorf("unsupported provider: %s", provider)
	}

	payload, _ := json.Marshal(map[string]any{
		"provider":     provider,
		"consent":      s.cfg.OAuth.CurrentConsentVersion,
		"with_consent": withConsent,
	})
	if err := s.cache.Set(ctx, "oauth_state:"+state, string(payload), 10*time.Minute); err != nil {
		return "", err
	}

	return authURL, nil
}

func (s *Service) CompleteOAuth(ctx context.Context, provider, code, state string) (*User, *TokenPair, error) {
	raw, err := s.cache.Get(ctx, "oauth_state:"+state)
	if err != nil || raw == "" {
		return nil, nil, ErrOAuthStateInvalid
	}
	_ = s.cache.Delete(ctx, "oauth_state:"+state)

	var stored struct {
		Provider    string `json:"provider"`
		Consent     string `json:"consent"`
		WithConsent bool   `json:"with_consent"`
	}
	if err := json.Unmarshal([]byte(raw), &stored); err != nil || stored.Provider != provider {
		return nil, nil, ErrOAuthStateInvalid
	}

	redirectURL := s.OAuthRedirectURL(provider)
	var profile *OAuthProfile

	switch provider {
	case "google":
		cfg, err := s.googleOAuthConfig(redirectURL)
		if err != nil {
			return nil, nil, err
		}
		token, err := cfg.Exchange(ctx, code)
		if err != nil {
			return nil, nil, fmt.Errorf("oauth exchange failed: %w", err)
		}
		profile, err = fetchGoogleProfile(ctx, token.AccessToken)
		if err != nil {
			return nil, nil, err
		}
	case "github":
		cfg, err := s.githubOAuthConfig(redirectURL)
		if err != nil {
			return nil, nil, err
		}
		token, err := cfg.Exchange(ctx, code)
		if err != nil {
			return nil, nil, fmt.Errorf("oauth exchange failed: %w", err)
		}
		profile, err = fetchGitHubProfile(ctx, token.AccessToken)
		if err != nil {
			return nil, nil, err
		}
	default:
		return nil, nil, fmt.Errorf("unsupported provider: %s", provider)
	}

	user, err := s.repo.FindOAuthUser(ctx, provider, profile.ProviderUserID)
	if err != nil && !errors.Is(err, ErrUserNotFound) {
		return nil, nil, err
	}

	now := time.Now().UTC()
	consentVersion := s.cfg.OAuth.CurrentConsentVersion

	if user == nil {
		existing, findErr := s.repo.FindByEmail(ctx, profile.Email)
		if findErr == nil {
			if existing.PasswordHash != "" {
				return nil, nil, ErrOAuthEmailInUse
			}
			user = existing
			if linkErr := s.repo.LinkOAuthAccount(ctx, user.ID, provider, profile.ProviderUserID); linkErr != nil {
				return nil, nil, linkErr
			}
		} else if errors.Is(findErr, ErrUserNotFound) {
			if !stored.WithConsent {
				return nil, nil, ErrConsentRequired
			}
			user = &User{
				ID:             uuid.New(),
				Email:          profile.Email,
				DisplayName:    profile.DisplayName,
				AuthProvider:   provider,
				ConsentVersion: consentVersion,
				ConsentedAt:    &now,
				Settings: Settings{
					Theme:      "system",
					Language:   "pt-BR",
					AIEnabled:  true,
					AIProvider: "groq",
				},
				CreatedAt: now,
				UpdatedAt: now,
			}
			if err := s.repo.CreateOAuthUser(ctx, user, provider, profile.ProviderUserID); err != nil {
				return nil, nil, err
			}
		} else {
			return nil, nil, findErr
		}
	}

	if user.ConsentVersion == "" {
		user.ConsentVersion = consentVersion
		user.ConsentedAt = &now
		_ = s.repo.UpdateConsent(ctx, user.ID, consentVersion, now)
	}

	tokens, err := s.generateTokenPair(user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

type oauthCallbackPayload struct {
	Tokens TokenPair `json:"tokens"`
}

func (s *Service) CreateOAuthCallbackCode(ctx context.Context, tokens *TokenPair) (string, error) {
	code, err := randomState()
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(oauthCallbackPayload{Tokens: *tokens})
	if err != nil {
		return "", err
	}
	if err := s.cache.Set(ctx, "oauth_code:"+code, string(payload), 2*time.Minute); err != nil {
		return "", err
	}
	return code, nil
}

func (s *Service) ExchangeOAuthCode(ctx context.Context, code string) (*TokenPair, error) {
	raw, err := s.cache.Get(ctx, "oauth_code:"+code)
	if err != nil || raw == "" {
		return nil, ErrOAuthCodeInvalid
	}
	_ = s.cache.Delete(ctx, "oauth_code:"+code)

	var payload oauthCallbackPayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, ErrOAuthCodeInvalid
	}
	return &payload.Tokens, nil
}

func (s *Service) FrontendCallbackURL(code string) string {
	return s.cfg.OAuth.FrontendURL + "/auth/callback?code=" + url.QueryEscape(code)
}

func (s *Service) FrontendLoginURL(query string) string {
	return s.cfg.OAuth.FrontendURL + "/login" + query
}

func (s *Service) FrontendURL(path string) string {
	return strings.TrimRight(s.cfg.OAuth.FrontendURL, "/") + path
}

func randomState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func fetchGoogleProfile(ctx context.Context, accessToken string) (*OAuthProfile, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google profile failed: %s", string(body))
	}

	var data struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	if data.Email == "" {
		return nil, errors.New("google account without email")
	}

	displayName := data.Name
	if displayName == "" {
		displayName = strings.Split(data.Email, "@")[0]
	}

	return &OAuthProfile{
		Provider:       "google",
		ProviderUserID: data.ID,
		Email:          data.Email,
		DisplayName:    displayName,
	}, nil
}

func fetchGitHubProfile(ctx context.Context, accessToken string) (*OAuthProfile, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github profile failed: %s", string(body))
	}

	var user struct {
		ID    int64  `json:"id"`
		Login string `json:"login"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.Unmarshal(body, &user); err != nil {
		return nil, err
	}

	email := user.Email
	if email == "" {
		email, err = fetchGitHubPrimaryEmail(ctx, accessToken)
		if err != nil {
			return nil, err
		}
	}

	displayName := user.Name
	if displayName == "" {
		displayName = user.Login
	}

	return &OAuthProfile{
		Provider:       "github",
		ProviderUserID: fmt.Sprintf("%d", user.ID),
		Email:          email,
		DisplayName:    displayName,
	}, nil
}

func fetchGitHubPrimaryEmail(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user/emails", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("github emails failed: %s", string(body))
	}

	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := json.Unmarshal(body, &emails); err != nil {
		return "", err
	}

	for _, item := range emails {
		if item.Primary && item.Verified {
			return item.Email, nil
		}
	}
	for _, item := range emails {
		if item.Verified {
			return item.Email, nil
		}
	}
	return "", errors.New("github account without verified email")
}
