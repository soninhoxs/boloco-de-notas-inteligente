package user

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/diario/backend/internal/ai"
	"github.com/diario/backend/internal/auth"
	"github.com/diario/backend/internal/common/cache"
	"github.com/diario/backend/internal/common/config"
	"github.com/diario/backend/internal/notes"
)

type StorageDeleter interface {
	DeleteByUser(ctx context.Context, userID uuid.UUID) error
}

type SessionRevoker interface {
	RevokeAllUserSessions(ctx context.Context, userID uuid.UUID) error
}

type EmailChanger interface {
	RequestEmailChange(ctx context.Context, userID uuid.UUID, newEmail string) (string, error)
	SendEmailChangeVerification(to, token string) error
}

type Service struct {
	repo           *Repository
	cache          *cache.RedisCache
	notesRepo      *notes.Repository
	storage        StorageDeleter
	aiQueue        *ai.Queue
	sessionRevoker SessionRevoker
	emailChanger   EmailChanger
	cfg            *config.Config
}

type ServiceDeps struct {
	NotesRepo      *notes.Repository
	Storage        StorageDeleter
	AIQueue        *ai.Queue
	SessionRevoker SessionRevoker
	EmailChanger   EmailChanger
	Config         *config.Config
}

func NewService(repo *Repository, cache *cache.RedisCache, deps ServiceDeps) *Service {
	return &Service{
		repo:           repo,
		cache:          cache,
		notesRepo:      deps.NotesRepo,
		storage:        deps.Storage,
		aiQueue:        deps.AIQueue,
		sessionRevoker: deps.SessionRevoker,
		emailChanger:   deps.EmailChanger,
		cfg:            deps.Config,
	}
}

func (s *Service) GetProfile(ctx context.Context, userID uuid.UUID) (*User, error) {
	cacheKey := fmt.Sprintf("user:%s", userID)

	var user User
	if err := s.cache.GetJSON(ctx, cacheKey, &user); err == nil {
		return &user, nil
	}

	userFromDB, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	s.cache.SetJSON(ctx, cacheKey, userFromDB, 5*time.Minute)

	return userFromDB, nil
}

func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, input UpdateProfileInput) (*User, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if input.DisplayName != nil {
		user.DisplayName = *input.DisplayName
	}

	if input.Email != nil {
		return nil, auth.ErrEmailChangePending
	}

	user.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	s.invalidateCache(ctx, userID)

	return user, nil
}

func (s *Service) RequestEmailChange(ctx context.Context, userID uuid.UUID, newEmail string) (string, error) {
	if s.emailChanger == nil {
		return "", fmt.Errorf("email change not configured")
	}
	return s.emailChanger.RequestEmailChange(ctx, userID, newEmail)
}

func (s *Service) SendEmailChangeVerification(to, token string) error {
	if s.emailChanger == nil {
		return nil
	}
	return s.emailChanger.SendEmailChangeVerification(to, token)
}

func (s *Service) UpdateSettings(ctx context.Context, userID uuid.UUID, input UpdateSettingsInput) (*User, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if input.AIEnabled != nil && *input.AIEnabled && !user.AIConsentGranted {
		return nil, auth.ErrConsentRequired
	}

	if input.Theme != nil {
		user.Settings.Theme = *input.Theme
	}
	if input.Language != nil {
		user.Settings.Language = *input.Language
	}
	if input.AIEnabled != nil {
		user.Settings.AIEnabled = *input.AIEnabled
	}
	if input.AIProvider != nil {
		user.Settings.AIProvider = *input.AIProvider
	}
	if input.AIModel != nil {
		user.Settings.AIModel = *input.AIModel
	}
	if input.Preferences != nil {
		if user.Settings.Preferences == nil {
			user.Settings.Preferences = make(map[string]any)
		}
		for k, v := range input.Preferences {
			user.Settings.Preferences[k] = v
		}
	}

	user.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	s.invalidateCache(ctx, userID)

	return user, nil
}

func (s *Service) ExportData(ctx context.Context, userID uuid.UUID) (map[string]any, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	allNotes, err := s.notesRepo.ExportAllByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"exported_at": time.Now().UTC(),
		"profile":     user,
		"notes":       allNotes,
	}, nil
}

func (s *Service) DeleteAccount(ctx context.Context, userID uuid.UUID) error {
	if s.storage != nil {
		if err := s.storage.DeleteByUser(ctx, userID); err != nil {
			return fmt.Errorf("failed to delete storage: %w", err)
		}
	}
	if s.aiQueue != nil {
		_ = s.aiQueue.DeleteUserData(ctx, userID)
	}
	if s.sessionRevoker != nil {
		_ = s.sessionRevoker.RevokeAllUserSessions(ctx, userID)
	}

	if err := s.repo.Delete(ctx, userID); err != nil {
		return err
	}

	s.invalidateCache(ctx, userID)

	return nil
}

func (s *Service) invalidateCache(ctx context.Context, userID uuid.UUID) {
	cacheKey := fmt.Sprintf("user:%s", userID)
	s.cache.Delete(ctx, cacheKey)
}
