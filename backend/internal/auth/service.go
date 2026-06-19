package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/diario/backend/internal/common/cache"
	"github.com/diario/backend/internal/common/config"
	"github.com/diario/backend/internal/common/email"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidToken       = errors.New("invalid token")
	ErrTokenExpired       = errors.New("token expired")
	ErrTokenReuse         = errors.New("refresh token reuse detected")
)

type Service struct {
	repo   *Repository
	cfg    *config.Config
	cache  *cache.RedisCache
	mailer *email.Mailer
}

func NewService(repo *Repository, cfg *config.Config, cache *cache.RedisCache, mailer *email.Mailer) *Service {
	return &Service{
		repo:   repo,
		cfg:    cfg,
		cache:  cache,
		mailer: mailer,
	}
}

func (s *Service) SendVerificationEmail(to, token string) error {
	if s.mailer == nil || !s.mailer.Enabled() {
		return nil
	}
	return s.mailer.SendVerification(to, s.FrontendURL("/verify-email?token="+token))
}

func (s *Service) SendEmailChangeVerification(to, token string) error {
	if s.mailer == nil || !s.mailer.Enabled() {
		return nil
	}
	return s.mailer.SendEmailChange(to, s.FrontendURL("/verify-email-change?token="+token))
}

func (s *Service) Register(ctx context.Context, input RegisterInput) (*User, *TokenPair, string, error) {
	if !input.ConsentPrivacy || !input.ConsentTerms {
		return nil, nil, "", ErrConsentRequired
	}
	if input.ConsentVersion != s.cfg.OAuth.CurrentConsentVersion {
		return nil, nil, "", ErrConsentRequired
	}
	if err := ValidatePassword(input.Password); err != nil {
		return nil, nil, "", err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, "", fmt.Errorf("failed to hash password: %w", err)
	}

	now := time.Now().UTC()
	user := &User{
		ID:             uuid.New(),
		Email:          input.Email,
		PasswordHash:   string(hashedPassword),
		DisplayName:    input.DisplayName,
		AuthProvider:   "local",
		ConsentVersion: input.ConsentVersion,
		ConsentedAt:    &now,
		EmailVerified:  false,
		Settings: Settings{
			Theme:      "system",
			Language:   "pt-BR",
			AIEnabled:  false,
			AIProvider: "groq",
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, nil, "", err
	}

	verifyToken, err := s.CreateEmailVerificationToken(ctx, user.ID)
	if err != nil {
		return nil, nil, "", err
	}

	return user, nil, verifyToken, nil
}

func (s *Service) Login(ctx context.Context, input LoginInput) (*User, *TokenPair, string, error) {
	user, err := s.repo.FindByEmail(ctx, input.Email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, nil, "", ErrInvalidCredentials
		}
		return nil, nil, "", err
	}

	if user.PasswordHash == "" {
		return nil, nil, "", ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, nil, "", ErrInvalidCredentials
	}

	if user.AuthProvider == "local" && !user.EmailVerified {
		return nil, nil, "", ErrEmailNotVerified
	}

	if user.MFAEnabled {
		mfaToken, err := s.CreateMFAPendingToken(ctx, user.ID)
		if err != nil {
			return nil, nil, "", err
		}
		return user, nil, mfaToken, nil
	}

	tokens, err := s.generateTokenPair(user)
	if err != nil {
		return nil, nil, "", err
	}

	return user, tokens, "", nil
}

func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	token, err := jwt.Parse(refreshToken, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(s.cfg.JWT.Secret), nil
	})

	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	tokenType, _ := claims["type"].(string)
	if tokenType != "refresh" {
		return nil, ErrInvalidToken
	}

	userID, _ := claims["sub"].(string)
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, ErrInvalidToken
	}

	blacklisted, _ := s.cache.Exists(ctx, "blacklist:"+refreshToken)
	if blacklisted {
		_ = s.RevokeAllUserSessions(ctx, uid)
		return nil, ErrTokenReuse
	}

	user, err := s.repo.FindByID(ctx, uid)
	if err != nil {
		return nil, err
	}

	family, _ := claims["family"].(string)
	if family == "" {
		family = uuid.New().String()
	}

	if err := s.cache.Set(ctx, "blacklist:"+refreshToken, "1", s.cfg.JWT.RefreshExpiresIn); err != nil {
		return nil, fmt.Errorf("failed to blacklist old token: %w", err)
	}

	return s.generateTokenPairWithFamily(user, family)
}

func (s *Service) Logout(ctx context.Context, accessToken, refreshToken string) error {
	if accessToken != "" {
		if err := s.cache.Set(ctx, "blacklist:"+accessToken, "1", s.cfg.JWT.AccessExpiresIn); err != nil {
			return err
		}
	}

	if refreshToken != "" {
		if err := s.cache.Set(ctx, "blacklist:"+refreshToken, "1", s.cfg.JWT.RefreshExpiresIn); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) RecordAIConsent(ctx context.Context, userID uuid.UUID, version string) error {
	now := time.Now().UTC()
	return s.repo.SetAIConsent(ctx, userID, version, now)
}

func (s *Service) HasAIConsent(ctx context.Context, userID uuid.UUID) (bool, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return false, err
	}
	return user.AIConsentAt != nil, nil
}

func (s *Service) generateTokenPair(user *User) (*TokenPair, error) {
	return s.generateTokenPairWithFamily(user, uuid.New().String())
}

func (s *Service) generateTokenPairWithFamily(user *User, family string) (*TokenPair, error) {
	now := time.Now()

	accessClaims := jwt.MapClaims{
		"sub":   user.ID.String(),
		"email": user.Email,
		"type":  "access",
		"iat":   now.Unix(),
		"exp":   now.Add(s.cfg.JWT.AccessExpiresIn).Unix(),
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	refreshClaims := jwt.MapClaims{
		"sub":    user.ID.String(),
		"type":   "refresh",
		"family": family,
		"iat":    now.Unix(),
		"exp":    now.Add(s.cfg.JWT.RefreshExpiresIn).Unix(),
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresIn:    int64(s.cfg.JWT.AccessExpiresIn.Seconds()),
		TokenType:    "Bearer",
	}, nil
}
