package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var (
	ErrEmailNotVerified   = errors.New("email not verified")
	ErrInvalidVerifyToken = errors.New("invalid verification token")
	ErrEmailChangePending = errors.New("email change already pending")
)

const emailVerifyTTL = 24 * time.Hour

type emailChangePayload struct {
	UserID   string `json:"user_id"`
	NewEmail string `json:"new_email"`
}

func (s *Service) CreateEmailVerificationToken(ctx context.Context, userID uuid.UUID) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	if err := s.cache.Set(ctx, "email_verify:"+token, userID.String(), emailVerifyTTL); err != nil {
		return "", err
	}
	return token, nil
}

func (s *Service) VerifyEmail(ctx context.Context, token string) error {
	userIDStr, err := s.cache.Get(ctx, "email_verify:"+token)
	if err != nil || userIDStr == "" {
		return ErrInvalidVerifyToken
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return ErrInvalidVerifyToken
	}
	if err := s.repo.SetEmailVerified(ctx, userID, true); err != nil {
		return err
	}
	_ = s.cache.Delete(ctx, "email_verify:"+token)
	return nil
}

func (s *Service) RequestEmailChange(ctx context.Context, userID uuid.UUID, newEmail string) (string, error) {
	existing, err := s.repo.FindByEmail(ctx, newEmail)
	if err == nil && existing.ID != userID {
		return "", ErrUserAlreadyExists
	}

	token, err := randomToken()
	if err != nil {
		return "", err
	}

	payload, _ := json.Marshal(emailChangePayload{
		UserID:   userID.String(),
		NewEmail: newEmail,
	})
	if err := s.cache.Set(ctx, "email_change:"+token, string(payload), emailVerifyTTL); err != nil {
		return "", err
	}
	if err := s.repo.SetPendingEmail(ctx, userID, newEmail); err != nil {
		return "", err
	}
	return token, nil
}

func (s *Service) ConfirmEmailChange(ctx context.Context, token string) error {
	raw, err := s.cache.Get(ctx, "email_change:"+token)
	if err != nil || raw == "" {
		return ErrInvalidVerifyToken
	}
	var payload emailChangePayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return ErrInvalidVerifyToken
	}
	userID, err := uuid.Parse(payload.UserID)
	if err != nil {
		return ErrInvalidVerifyToken
	}
	if err := s.repo.ConfirmEmailChange(ctx, userID, payload.NewEmail); err != nil {
		return err
	}
	_ = s.cache.Delete(ctx, "email_change:"+token)
	return s.RevokeAllUserSessions(ctx, userID)
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}
	return base64.URLEncoding.EncodeToString(b), nil
}
