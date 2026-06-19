package ai

import (
	"time"

	"github.com/google/uuid"

	"github.com/diario/backend/internal/ai/chat"
)

type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusProcessing JobStatus = "processing"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
)

type Job struct {
	ID        string    `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	NoteID    uuid.UUID `json:"note_id"`
	Content   string    `json:"content"`
	Category  string    `json:"category"`
	Provider  string    `json:"provider"`
	Model     string    `json:"model"`
	Status    JobStatus `json:"status"`
	Error     string    `json:"error,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type JobResult struct {
	JobID       string       `json:"job_id"`
	Status      JobStatus    `json:"status"`
	Suggestions []Suggestion `json:"suggestions,omitempty"`
	Error       string       `json:"error,omitempty"`
	ProcessedAt *time.Time   `json:"processed_at,omitempty"`
}

type Suggestion struct {
	Type    string `json:"type"`
	Content string `json:"content"`
}

type RequestSuggestionsInput struct {
	NoteID   uuid.UUID `json:"note_id" binding:"required"`
	Provider string    `json:"provider,omitempty"`
	Model    string    `json:"model,omitempty"`
}

type ChatMessage = chat.ChatMessage
type ChatRequest = chat.ChatRequest
type ChatResponse = chat.ChatResponse
type ProviderConfig = chat.ProviderConfig
