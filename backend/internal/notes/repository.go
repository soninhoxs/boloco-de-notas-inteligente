package notes

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/diario/backend/internal/common/database"
)

var (
	ErrNoteNotFound = errors.New("note not found")
)

type Repository struct {
	db *database.PostgresDB
}

func NewRepository(db *database.PostgresDB) *Repository {
	return &Repository{db: db}
}

func populateNoteFromJSON(note *Note, locationJSON, suggestionsJSON, metadataJSON []byte) error {
	if len(locationJSON) > 0 && string(locationJSON) != "null" {
		if err := json.Unmarshal(locationJSON, &note.Location); err != nil {
			return fmt.Errorf("failed to unmarshal location: %w", err)
		}
	}
	if len(suggestionsJSON) > 0 && string(suggestionsJSON) != "null" {
		if err := json.Unmarshal(suggestionsJSON, &note.AISuggestions); err != nil {
			return fmt.Errorf("failed to unmarshal suggestions: %w", err)
		}
	}
	if len(metadataJSON) > 0 && string(metadataJSON) != "null" {
		if err := json.Unmarshal(metadataJSON, &note.Metadata); err != nil {
			return fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}
	return nil
}

func (r *Repository) Create(ctx context.Context, note *Note) error {
	locationJSON, err := json.Marshal(note.Location)
	if err != nil {
		return fmt.Errorf("failed to marshal location: %w", err)
	}

	suggestionsJSON, err := json.Marshal(note.AISuggestions)
	if err != nil {
		return fmt.Errorf("failed to marshal suggestions: %w", err)
	}

	metadataJSON, err := json.Marshal(note.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
		INSERT INTO notes (id, user_id, content, category, location, metadata, ai_suggestions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err = r.db.Pool.Exec(ctx, query,
		note.ID,
		note.UserID,
		note.Content,
		note.Category,
		locationJSON,
		metadataJSON,
		suggestionsJSON,
		note.CreatedAt,
		note.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create note: %w", err)
	}

	return nil
}

func (r *Repository) FindByID(ctx context.Context, id, userID uuid.UUID) (*Note, error) {
	query := `
		SELECT id, user_id, content, category, location, metadata, ai_suggestions, created_at, updated_at
		FROM notes
		WHERE id = $1 AND user_id = $2
	`

	var note Note
	var locationJSON, suggestionsJSON, metadataJSON []byte

	err := r.db.Pool.QueryRow(ctx, query, id, userID).Scan(
		&note.ID,
		&note.UserID,
		&note.Content,
		&note.Category,
		&locationJSON,
		&metadataJSON,
		&suggestionsJSON,
		&note.CreatedAt,
		&note.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoteNotFound
		}
		return nil, fmt.Errorf("failed to find note: %w", err)
	}

	if err := populateNoteFromJSON(&note, locationJSON, suggestionsJSON, metadataJSON); err != nil {
		return nil, err
	}

	return &note, nil
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID, params ListNotesParams) (*NotesPage, error) {
	if params.Limit <= 0 || params.Limit > 100 {
		params.Limit = 20
	}

	var cursorTime time.Time
	var cursorID uuid.UUID
	if params.Cursor != "" {
		decoded, err := base64.StdEncoding.DecodeString(params.Cursor)
		if err == nil {
			fmt.Sscanf(string(decoded), "%s|%s", &cursorTime, &cursorID)
		}
	}

	baseQuery := `
		SELECT id, user_id, content, category, location, metadata, ai_suggestions, created_at, updated_at
		FROM notes
		WHERE user_id = $1
	`

	countQuery := `SELECT COUNT(*) FROM notes WHERE user_id = $1`
	args := []any{userID}
	argIndex := 2

	if params.Category != "" {
		baseQuery += fmt.Sprintf(" AND category = $%d", argIndex)
		countQuery += fmt.Sprintf(" AND category = $%d", argIndex)
		args = append(args, params.Category)
		argIndex++
	}

	if params.Search != "" {
		baseQuery += fmt.Sprintf(" AND to_tsvector('portuguese', content) @@ plainto_tsquery('portuguese', $%d)", argIndex)
		countQuery += fmt.Sprintf(" AND to_tsvector('portuguese', content) @@ plainto_tsquery('portuguese', $%d)", argIndex)
		args = append(args, params.Search)
		argIndex++
	}

	if !cursorTime.IsZero() {
		baseQuery += fmt.Sprintf(" AND (created_at, id) < ($%d, $%d)", argIndex, argIndex+1)
		args = append(args, cursorTime, cursorID)
		argIndex += 2
	}

	baseQuery += " ORDER BY created_at DESC, id DESC"
	baseQuery += fmt.Sprintf(" LIMIT $%d", argIndex)
	args = append(args, params.Limit+1)

	rows, err := r.db.Pool.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list notes: %w", err)
	}
	defer rows.Close()

	notes := make([]Note, 0, params.Limit)
	for rows.Next() {
		var note Note
		var locationJSON, suggestionsJSON, metadataJSON []byte

		if err := rows.Scan(
			&note.ID,
			&note.UserID,
			&note.Content,
			&note.Category,
			&locationJSON,
			&metadataJSON,
			&suggestionsJSON,
			&note.CreatedAt,
			&note.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}

		if err := populateNoteFromJSON(&note, locationJSON, suggestionsJSON, metadataJSON); err != nil {
			return nil, err
		}

		notes = append(notes, note)
	}

	hasMore := len(notes) > params.Limit
	if hasMore {
		notes = notes[:params.Limit]
	}

	var nextCursor string
	if hasMore && len(notes) > 0 {
		lastNote := notes[len(notes)-1]
		cursorData := fmt.Sprintf("%s|%s", lastNote.CreatedAt.Format(time.RFC3339Nano), lastNote.ID)
		nextCursor = base64.StdEncoding.EncodeToString([]byte(cursorData))
	}

	var total int64
	countArgs := args[:len(args)-1]
	if !cursorTime.IsZero() {
		countArgs = countArgs[:len(countArgs)-2]
	}
	r.db.Pool.QueryRow(ctx, countQuery, countArgs[:argIndex-2]...).Scan(&total)

	return &NotesPage{
		Notes:      notes,
		NextCursor: nextCursor,
		HasMore:    hasMore,
		Total:      total,
	}, nil
}

func (r *Repository) Update(ctx context.Context, note *Note) error {
	locationJSON, _ := json.Marshal(note.Location)
	suggestionsJSON, _ := json.Marshal(note.AISuggestions)
	metadataJSON, _ := json.Marshal(note.Metadata)

	query := `
		UPDATE notes
		SET content = $3, category = $4, location = $5, metadata = $6, ai_suggestions = $7, updated_at = $8
		WHERE id = $1 AND user_id = $2
	`

	result, err := r.db.Pool.Exec(ctx, query,
		note.ID,
		note.UserID,
		note.Content,
		note.Category,
		locationJSON,
		metadataJSON,
		suggestionsJSON,
		note.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update note: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNoteNotFound
	}

	return nil
}

func (r *Repository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	query := `DELETE FROM notes WHERE id = $1 AND user_id = $2`

	result, err := r.db.Pool.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete note: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNoteNotFound
	}

	return nil
}

func (r *Repository) Search(ctx context.Context, userID uuid.UUID, query string, limit int) ([]Note, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	sqlQuery := `
		SELECT id, user_id, content, category, location, metadata, ai_suggestions, created_at, updated_at,
		       ts_rank(to_tsvector('portuguese', content), plainto_tsquery('portuguese', $2)) as rank
		FROM notes
		WHERE user_id = $1 AND to_tsvector('portuguese', content) @@ plainto_tsquery('portuguese', $2)
		ORDER BY rank DESC, created_at DESC
		LIMIT $3
	`

	rows, err := r.db.Pool.Query(ctx, sqlQuery, userID, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search notes: %w", err)
	}
	defer rows.Close()

	notes := make([]Note, 0)
	for rows.Next() {
		var note Note
		var locationJSON, suggestionsJSON, metadataJSON []byte
		var rank float64

		if err := rows.Scan(
			&note.ID,
			&note.UserID,
			&note.Content,
			&note.Category,
			&locationJSON,
			&metadataJSON,
			&suggestionsJSON,
			&note.CreatedAt,
			&note.UpdatedAt,
			&rank,
		); err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}

		if err := populateNoteFromJSON(&note, locationJSON, suggestionsJSON, metadataJSON); err != nil {
			return nil, err
		}

		notes = append(notes, note)
	}

	return notes, nil
}

func (r *Repository) GetStats(ctx context.Context, userID uuid.UUID) (*NoteStats, error) {
	stats := &NoteStats{
		ByCategory: make(map[string]int64),
	}

	err := r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM notes WHERE user_id = $1", userID).Scan(&stats.TotalNotes)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	weekAgo := now.AddDate(0, 0, -7)
	monthAgo := now.AddDate(0, -1, 0)

	r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM notes WHERE user_id = $1 AND created_at >= $2", userID, weekAgo).Scan(&stats.ThisWeek)
	r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM notes WHERE user_id = $1 AND created_at >= $2", userID, monthAgo).Scan(&stats.ThisMonth)

	rows, err := r.db.Pool.Query(ctx, "SELECT category, COUNT(*) FROM notes WHERE user_id = $1 GROUP BY category", userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var cat string
			var count int64
			if rows.Scan(&cat, &count) == nil {
				stats.ByCategory[cat] = count
			}
		}
	}

	var lastNote time.Time
	if r.db.Pool.QueryRow(ctx, "SELECT MAX(created_at) FROM notes WHERE user_id = $1", userID).Scan(&lastNote) == nil && !lastNote.IsZero() {
		stats.LastNoteAt = &lastNote
	}

	return stats, nil
}

func (r *Repository) GetRecentNotes(ctx context.Context, userID uuid.UUID, limit int) ([]Note, error) {
	query := `
		SELECT id, user_id, content, category, location, metadata, ai_suggestions, created_at, updated_at
		FROM notes
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := r.db.Pool.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := make([]Note, 0, limit)
	for rows.Next() {
		var note Note
		var locationJSON, suggestionsJSON, metadataJSON []byte

		if err := rows.Scan(
			&note.ID,
			&note.UserID,
			&note.Content,
			&note.Category,
			&locationJSON,
			&metadataJSON,
			&suggestionsJSON,
			&note.CreatedAt,
			&note.UpdatedAt,
		); err != nil {
			continue
		}

		if err := populateNoteFromJSON(&note, locationJSON, suggestionsJSON, metadataJSON); err != nil {
			continue
		}

		notes = append(notes, note)
	}

	return notes, nil
}

func (r *Repository) ExportAllByUser(ctx context.Context, userID uuid.UUID) ([]Note, error) {
	query := `
		SELECT id, user_id, content, category, location, metadata, ai_suggestions, created_at, updated_at
		FROM notes
		WHERE user_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export notes: %w", err)
	}
	defer rows.Close()

	notes := make([]Note, 0)
	for rows.Next() {
		var note Note
		var locationJSON, suggestionsJSON, metadataJSON []byte

		if err := rows.Scan(
			&note.ID,
			&note.UserID,
			&note.Content,
			&note.Category,
			&locationJSON,
			&metadataJSON,
			&suggestionsJSON,
			&note.CreatedAt,
			&note.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}

		if err := populateNoteFromJSON(&note, locationJSON, suggestionsJSON, metadataJSON); err != nil {
			return nil, err
		}

		notes = append(notes, note)
	}

	return notes, nil
}
