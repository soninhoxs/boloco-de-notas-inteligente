package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/diario/backend/internal/common/database"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
)

const userSelectColumns = `
	id, email, COALESCE(password_hash, ''), display_name, settings,
	COALESCE(auth_provider, 'local'), COALESCE(consent_version, ''), consented_at,
	COALESCE(email_verified, false), COALESCE(pending_email, ''),
	COALESCE(mfa_secret, ''), COALESCE(mfa_enabled, false),
	ai_consent_at, COALESCE(ai_consent_version, ''),
	created_at, updated_at
`

type Repository struct {
	db *database.PostgresDB
}

func NewRepository(db *database.PostgresDB) *Repository {
	return &Repository{db: db}
}

func scanUser(row pgx.Row) (*User, error) {
	var user User
	var settingsJSON []byte
	var pendingEmail *string

	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.DisplayName,
		&settingsJSON,
		&user.AuthProvider,
		&user.ConsentVersion,
		&user.ConsentedAt,
		&user.EmailVerified,
		&pendingEmail,
		&user.MFASecret,
		&user.MFAEnabled,
		&user.AIConsentAt,
		&user.AIConsentVersion,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if pendingEmail != nil {
		user.PendingEmail = *pendingEmail
	}
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

func (r *Repository) Create(ctx context.Context, user *User) error {
	settingsJSON, err := json.Marshal(user.Settings)
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	query := `
		INSERT INTO users (
			id, email, password_hash, display_name, settings,
			consent_version, consented_at, auth_provider, email_verified,
			created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err = r.db.Pool.Exec(ctx, query,
		user.ID,
		user.Email,
		nullIfEmpty(user.PasswordHash),
		user.DisplayName,
		settingsJSON,
		user.ConsentVersion,
		user.ConsentedAt,
		user.AuthProvider,
		user.EmailVerified,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrUserAlreadyExists
		}
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

func (r *Repository) FindByEmail(ctx context.Context, email string) (*User, error) {
	query := `SELECT ` + userSelectColumns + ` FROM users WHERE email = $1`
	row := r.db.Pool.QueryRow(ctx, query, email)
	user, err := scanUser(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	return user, nil
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*User, error) {
	query := `SELECT ` + userSelectColumns + ` FROM users WHERE id = $1`
	row := r.db.Pool.QueryRow(ctx, query, id)
	user, err := scanUser(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	return user, nil
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

func (r *Repository) SetEmailVerified(ctx context.Context, userID uuid.UUID, verified bool) error {
	query := `UPDATE users SET email_verified = $2, updated_at = NOW() WHERE id = $1`
	result, err := r.db.Pool.Exec(ctx, query, userID, verified)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *Repository) SetPendingEmail(ctx context.Context, userID uuid.UUID, email string) error {
	query := `UPDATE users SET pending_email = $2, updated_at = NOW() WHERE id = $1`
	result, err := r.db.Pool.Exec(ctx, query, userID, email)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *Repository) ConfirmEmailChange(ctx context.Context, userID uuid.UUID, newEmail string) error {
	query := `
		UPDATE users
		SET email = $2, pending_email = NULL, email_verified = true, updated_at = NOW()
		WHERE id = $1
	`
	result, err := r.db.Pool.Exec(ctx, query, userID, newEmail)
	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrUserAlreadyExists
		}
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *Repository) SetMFA(ctx context.Context, userID uuid.UUID, secret string, enabled bool) error {
	query := `UPDATE users SET mfa_secret = $2, mfa_enabled = $3, updated_at = NOW() WHERE id = $1`
	result, err := r.db.Pool.Exec(ctx, query, userID, nullIfEmpty(secret), enabled)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *Repository) SetAIConsent(ctx context.Context, userID uuid.UUID, version string, at time.Time) error {
	query := `
		UPDATE users
		SET ai_consent_at = $2,
		    ai_consent_version = $3,
		    settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{ai_enabled}', 'true'::jsonb),
		    updated_at = $2
		WHERE id = $1
	`
	result, err := r.db.Pool.Exec(ctx, query, userID, at, version)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *Repository) CreateOAuthUser(ctx context.Context, user *User, provider, providerUserID string) error {
	user.EmailVerified = true
	if err := r.Create(ctx, user); err != nil {
		return err
	}
	return r.LinkOAuthAccount(ctx, user.ID, provider, providerUserID)
}

func (r *Repository) LinkOAuthAccount(ctx context.Context, userID uuid.UUID, provider, providerUserID string) error {
	query := `
		INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (provider, provider_user_id) DO NOTHING
	`
	_, err := r.db.Pool.Exec(ctx, query, userID, provider, providerUserID)
	return err
}

func (r *Repository) FindOAuthUser(ctx context.Context, provider, providerUserID string) (*User, error) {
	query := `
		SELECT ` + userSelectColumns + `
		FROM users u
		INNER JOIN oauth_accounts o ON o.user_id = u.id
		WHERE o.provider = $1 AND o.provider_user_id = $2
	`

	row := r.db.Pool.QueryRow(ctx, query, provider, providerUserID)
	user, err := scanUser(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to find oauth user: %w", err)
	}
	return user, nil
}

func (r *Repository) UpdateConsent(ctx context.Context, userID uuid.UUID, version string, at time.Time) error {
	query := `UPDATE users SET consent_version = $2, consented_at = $3, updated_at = $3 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, userID, version, at)
	return err
}

func nullIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func isDuplicateKeyError(err error) bool {
	return err != nil && (err.Error() == "duplicate key value violates unique constraint" ||
		contains(err.Error(), "duplicate key") ||
		contains(err.Error(), "SQLSTATE 23505"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsAt(s, substr, 0))
}

func containsAt(s, substr string, start int) bool {
	for i := start; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
