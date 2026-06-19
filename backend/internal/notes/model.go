package notes

import (
	"time"

	"github.com/google/uuid"
)

type Note struct {
	ID            uuid.UUID    `json:"id"`
	UserID        uuid.UUID    `json:"user_id"`
	Content       string       `json:"content"`
	Category      string       `json:"category"`
	Location      *Location    `json:"location,omitempty"`
	Metadata      *Metadata    `json:"metadata,omitempty"`
	AISuggestions []Suggestion `json:"ai_suggestions,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	State     string  `json:"state"`
	City      string  `json:"city"`
	Label     string  `json:"label,omitempty"`
	Task      string  `json:"task,omitempty"`
}

type MetadataAttachment struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	FileKey string `json:"file_key"`
	URL     string `json:"url,omitempty"`
}

type Metadata struct {
	Attachments []MetadataAttachment `json:"attachments,omitempty"`
	AIProvider  string               `json:"ai_provider,omitempty"`
	AIModel     string               `json:"ai_model,omitempty"`
}

type Suggestion struct {
	Type    string `json:"type"`
	Content string `json:"content"`
}

type Attachment struct {
	ID        uuid.UUID `json:"id"`
	NoteID    uuid.UUID `json:"note_id"`
	UserID    uuid.UUID `json:"user_id"`
	FileKey   string    `json:"file_key"`
	FileType  string    `json:"file_type"`
	FileSize  int64     `json:"file_size"`
	URL       string    `json:"url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateNoteInput struct {
	Content  string    `json:"content" binding:"required,min=1"`
	Category string    `json:"category" binding:"required,oneof=idea task reflection gratitude reminder"`
	Location *Location `json:"location,omitempty"`
	Metadata *Metadata `json:"metadata,omitempty"`
}

type UpdateNoteInput struct {
	Content  *string   `json:"content,omitempty"`
	Category *string   `json:"category,omitempty"`
	Location *Location `json:"location,omitempty"`
	Metadata *Metadata `json:"metadata,omitempty"`
}

type ListNotesParams struct {
	Cursor   string
	Limit    int
	Category string
	Search   string
}

type NotesPage struct {
	Notes      []Note `json:"notes"`
	NextCursor string `json:"next_cursor,omitempty"`
	HasMore    bool   `json:"has_more"`
	Total      int64  `json:"total"`
}

type NoteStats struct {
	TotalNotes    int64            `json:"total_notes"`
	ByCategory    map[string]int64 `json:"by_category"`
	ThisWeek      int64            `json:"this_week"`
	ThisMonth     int64            `json:"this_month"`
	AIRequests    int64            `json:"ai_requests"`
	LastNoteAt    *time.Time       `json:"last_note_at,omitempty"`
}
