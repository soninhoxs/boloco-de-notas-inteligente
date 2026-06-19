package user

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID               uuid.UUID  `json:"id"`
	Email            string     `json:"email"`
	DisplayName      string     `json:"display_name"`
	EmailVerified    bool       `json:"email_verified"`
	PendingEmail     string     `json:"pending_email,omitempty"`
	MFAEnabled       bool       `json:"mfa_enabled"`
	AIConsentGranted bool       `json:"ai_consent_granted"`
	AIConsentAt      *time.Time `json:"ai_consent_at,omitempty"`
	Settings         Settings   `json:"settings"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type Settings struct {
	Theme       string         `json:"theme"`
	Language    string         `json:"language"`
	AIEnabled   bool           `json:"ai_enabled"`
	AIProvider  string         `json:"ai_provider"`
	AIModel     string         `json:"ai_model"`
	Preferences map[string]any `json:"preferences"`
}

type UpdateProfileInput struct {
	DisplayName *string `json:"display_name,omitempty"`
	Email       *string `json:"email,omitempty" binding:"omitempty,email"`
}

type UpdateSettingsInput struct {
	Theme       *string        `json:"theme,omitempty"`
	Language    *string        `json:"language,omitempty"`
	AIEnabled   *bool          `json:"ai_enabled,omitempty"`
	AIProvider  *string        `json:"ai_provider,omitempty"`
	AIModel     *string        `json:"ai_model,omitempty"`
	Preferences map[string]any `json:"preferences,omitempty"`
}
