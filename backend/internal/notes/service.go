package notes

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/diario/backend/internal/common/cache"
)

type Service struct {
	repo  *Repository
	cache *cache.RedisCache
}

func NewService(repo *Repository, cache *cache.RedisCache) *Service {
	return &Service{
		repo:  repo,
		cache: cache,
	}
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID, input CreateNoteInput) (*Note, error) {
	now := time.Now().UTC()
	note := &Note{
		ID:            uuid.New(),
		UserID:        userID,
		Content:       input.Content,
		Category:      input.Category,
		Location:      input.Location,
		Metadata:      input.Metadata,
		AISuggestions: []Suggestion{},
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.repo.Create(ctx, note); err != nil {
		return nil, err
	}

	s.invalidateUserCache(ctx, userID)

	return note, nil
}

func (s *Service) Get(ctx context.Context, noteID, userID uuid.UUID) (*Note, error) {
	cacheKey := fmt.Sprintf("note:%s:%s", userID, noteID)

	var note Note
	if err := s.cache.GetJSON(ctx, cacheKey, &note); err == nil {
		return &note, nil
	}

	noteFromDB, err := s.repo.FindByID(ctx, noteID, userID)
	if err != nil {
		return nil, err
	}

	s.cache.SetJSON(ctx, cacheKey, noteFromDB, 5*time.Minute)

	return noteFromDB, nil
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, params ListNotesParams) (*NotesPage, error) {
	return s.repo.ListByUser(ctx, userID, params)
}

func (s *Service) Update(ctx context.Context, noteID, userID uuid.UUID, input UpdateNoteInput) (*Note, error) {
	note, err := s.repo.FindByID(ctx, noteID, userID)
	if err != nil {
		return nil, err
	}

	if input.Content != nil {
		note.Content = *input.Content
	}
	if input.Category != nil {
		note.Category = *input.Category
	}
	if input.Location != nil {
		note.Location = input.Location
	}
	if input.Metadata != nil {
		note.Metadata = input.Metadata
	}

	note.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, note); err != nil {
		return nil, err
	}

	s.invalidateNoteCache(ctx, userID, noteID)

	return note, nil
}

func (s *Service) Delete(ctx context.Context, noteID, userID uuid.UUID) error {
	if err := s.repo.Delete(ctx, noteID, userID); err != nil {
		return err
	}

	s.invalidateNoteCache(ctx, userID, noteID)
	s.invalidateUserCache(ctx, userID)

	return nil
}

func (s *Service) Search(ctx context.Context, userID uuid.UUID, query string, limit int) ([]Note, error) {
	return s.repo.Search(ctx, userID, query, limit)
}

func (s *Service) GetStats(ctx context.Context, userID uuid.UUID) (*NoteStats, error) {
	cacheKey := fmt.Sprintf("stats:%s", userID)

	var stats NoteStats
	if err := s.cache.GetJSON(ctx, cacheKey, &stats); err == nil {
		return &stats, nil
	}

	statsFromDB, err := s.repo.GetStats(ctx, userID)
	if err != nil {
		return nil, err
	}

	s.cache.SetJSON(ctx, cacheKey, statsFromDB, 1*time.Minute)

	return statsFromDB, nil
}

func (s *Service) UpdateSuggestions(ctx context.Context, noteID, userID uuid.UUID, suggestions []Suggestion) error {
	note, err := s.repo.FindByID(ctx, noteID, userID)
	if err != nil {
		return err
	}

	note.AISuggestions = suggestions
	note.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, note); err != nil {
		return err
	}

	s.invalidateNoteCache(ctx, userID, noteID)

	return nil
}

func (s *Service) invalidateNoteCache(ctx context.Context, userID, noteID uuid.UUID) {
	cacheKey := fmt.Sprintf("note:%s:%s", userID, noteID)
	s.cache.Delete(ctx, cacheKey)
}

func (s *Service) invalidateUserCache(ctx context.Context, userID uuid.UUID) {
	statsKey := fmt.Sprintf("stats:%s", userID)
	s.cache.Delete(ctx, statsKey)
}
