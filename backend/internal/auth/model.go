package auth

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID               uuid.UUID  `json:"id"`
	Email            string     `json:"email"`
	PasswordHash     string     `json:"-"`
	DisplayName      string     `json:"display_name"`
	AuthProvider     string     `json:"auth_provider,omitempty"`
	ConsentVersion   string     `json:"consent_version,omitempty"`
	ConsentedAt      *time.Time `json:"consented_at,omitempty"`
	EmailVerified    bool       `json:"email_verified"`
	PendingEmail     string     `json:"pending_email,omitempty"`
	MFAEnabled       bool       `json:"mfa_enabled"`
	MFASecret        string     `json:"-"`
	AIConsentAt      *time.Time `json:"ai_consent_at,omitempty"`
	AIConsentVersion string     `json:"ai_consent_version,omitempty"`
	Settings         Settings   `json:"settings"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type Settings struct {
	Theme       string `json:"theme"`
	Language    string `json:"language"`
	AIEnabled   bool   `json:"ai_enabled"`
	AIProvider  string `json:"ai_provider"`
}

type RegisterInput struct {
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required,min=8,max=128"`
	DisplayName    string `json:"display_name" binding:"required,min=2,max=100"`
	ConsentVersion string `json:"consent_version" binding:"required"`
	ConsentPrivacy bool   `json:"consent_privacy" binding:"required"`
	ConsentTerms   bool   `json:"consent_terms" binding:"required"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,max=128"`
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type RefreshInput struct {
	RefreshToken string `json:"refresh_token"`
}

type MFALoginInput struct {
	MFAToken string `json:"mfa_token" binding:"required"`
	Code     string `json:"code" binding:"required"`
}

type MFAEnableInput struct {
	Code string `json:"code" binding:"required"`
}

type MFADisableInput struct {
	Code     string `json:"code" binding:"required"`
	Password string `json:"password"`
}

type EmailChangeInput struct {
	Email string `json:"email" binding:"required,email"`
}

type AIConsentInput struct {
	ConsentVersion string `json:"consent_version" binding:"required"`
	ConsentAI      bool   `json:"consent_ai" binding:"required"`
}

type Claims struct {
	UserID string `json:"sub"`
	Email  string `json:"email"`
	Type   string `json:"type"`
}
