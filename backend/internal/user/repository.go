package user

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/diario/backend/internal/common/database"
)

var (
	ErrUserNotFound = errors.New("user not found")
)

type Repository struct {
	db *database.PostgresDB
}

func NewRepository(db *database.PostgresDB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*User, error) {
	query := `
		SELECT id, email, display_name, settings,
		       COALESCE(email_verified, false), COALESCE(pending_email, ''),
		       COALESCE(mfa_enabled, false), ai_consent_at,
		       created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user User
	var settingsJSON []byte
	var pendingEmail *string

	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.DisplayName,
		&settingsJSON,
		&user.EmailVerified,
		&pendingEmail,
		&user.MFAEnabled,
		&user.AIConsentAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to find user: %w", err)
	}

	if pendingEmail != nil {
		user.PendingEmail = *pendingEmail
	}
	user.AIConsentGranted = user.AIConsentAt != nil

	if err := json.Unmarshal(settingsJSON, &user.Settings); err != nil {
		user.Settings = Settings{
			Theme:      "system",
			Language:   "pt-BR",
			AIEnabled:  false,
			AIProvider: "groq",
		}
	}

	return &user, nil
}

func (r *Repository) Update(ctx context.Context, user *User) error {
	settingsJSON, err := json.Marshal(user.Settings)
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	query := `
		UPDATE users
		SET email = $2, display_name = $3, settings = $4, updated_at = $5
		WHERE id = $1
	`

	result, err := r.db.Pool.Exec(ctx, query,
		user.ID,
		user.Email,
		user.DisplayName,
		settingsJSON,
		user.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`

	result, err := r.db.Pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}
