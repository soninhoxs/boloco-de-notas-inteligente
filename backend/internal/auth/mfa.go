package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrMFARequired      = errors.New("mfa required")
	ErrMFAInvalid       = errors.New("invalid mfa code")
	ErrMFANotEnabled    = errors.New("mfa not enabled")
	ErrMFATokenInvalid  = errors.New("invalid mfa session token")
	ErrMFAAlreadyActive = errors.New("mfa already enabled")
)

const mfaPendingTTL = 5 * time.Minute

type MFASetup struct {
	Secret string `json:"secret"`
	URL    string `json:"otpauth_url"`
}

func (s *Service) BeginMFASetup(ctx context.Context, userID uuid.UUID) (*MFASetup, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user.MFAEnabled {
		return nil, ErrMFAAlreadyActive
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Mega Brain",
		AccountName: user.Email,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate mfa secret: %w", err)
	}

	if err := s.cache.Set(ctx, "mfa_setup:"+userID.String(), key.Secret(), 15*time.Minute); err != nil {
		return nil, err
	}

	return &MFASetup{
		Secret: key.Secret(),
		URL:    key.URL(),
	}, nil
}

func (s *Service) EnableMFA(ctx context.Context, userID uuid.UUID, code string) error {
	secret, err := s.cache.Get(ctx, "mfa_setup:"+userID.String())
	if err != nil || secret == "" {
		return ErrMFAInvalid
	}
	if !totp.Validate(code, secret) {
		return ErrMFAInvalid
	}
	if err := s.repo.SetMFA(ctx, userID, secret, true); err != nil {
		return err
	}
	_ = s.cache.Delete(ctx, "mfa_setup:"+userID.String())
	return nil
}

func (s *Service) DisableMFA(ctx context.Context, userID uuid.UUID, code, password string) error {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if !user.MFAEnabled || user.MFASecret == "" {
		return ErrMFANotEnabled
	}
	if user.PasswordHash != "" {
		if err := s.verifyPassword(user.PasswordHash, password); err != nil {
			return ErrInvalidCredentials
		}
	}
	if !totp.Validate(code, user.MFASecret) {
		return ErrMFAInvalid
	}
	return s.repo.SetMFA(ctx, userID, "", false)
}

func (s *Service) CreateMFAPendingToken(ctx context.Context, userID uuid.UUID) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	if err := s.cache.Set(ctx, "mfa_pending:"+token, userID.String(), mfaPendingTTL); err != nil {
		return "", err
	}
	return token, nil
}

func (s *Service) CompleteMFALogin(ctx context.Context, mfaToken, code string) (*User, *TokenPair, error) {
	userIDStr, err := s.cache.Get(ctx, "mfa_pending:"+mfaToken)
	if err != nil || userIDStr == "" {
		return nil, nil, ErrMFATokenInvalid
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, nil, ErrMFATokenInvalid
	}
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	if !user.MFAEnabled || !totp.Validate(code, user.MFASecret) {
		return nil, nil, ErrMFAInvalid
	}
	_ = s.cache.Delete(ctx, "mfa_pending:"+mfaToken)
	tokens, err := s.generateTokenPair(user)
	if err != nil {
		return nil, nil, err
	}
	return user, tokens, nil
}

func (s *Service) verifyPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}
