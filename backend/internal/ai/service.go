package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/diario/backend/internal/ai/providers"
	"github.com/diario/backend/internal/ai/security"
	"github.com/diario/backend/internal/auth"
	"github.com/diario/backend/internal/common/cache"
	"github.com/diario/backend/internal/common/config"
	"github.com/diario/backend/internal/notes"
)

var (
	ErrProviderNotFound  = errors.New("AI provider not found")
	ErrJobNotFound       = errors.New("job not found")
	ErrRateLimitExceeded = errors.New("rate limit exceeded")
	ErrContentRejected   = errors.New("content rejected by security policy")
	ErrAIConsentRequired = errors.New("ai consent required")
)

type Service struct {
	cfg         *config.Config
	cache       *cache.RedisCache
	queue       *Queue
	notesRepo   *notes.Repository
	authRepo    *auth.Repository
	providers   map[string]providers.Provider
	rateLimiter *cache.RateLimiter
}

func NewService(cfg *config.Config, redisCache *cache.RedisCache, queue *Queue, notesRepo *notes.Repository, authRepo *auth.Repository) *Service {
	providerMap := make(map[string]providers.Provider)

	if cfg.AI.GroqAPIKey != "" {
		providerMap["groq"] = providers.NewGroqProvider(cfg.AI.GroqAPIKey)
	}
	if cfg.AI.OpenAIAPIKey != "" {
		providerMap["openai"] = providers.NewOpenAIProvider(cfg.AI.OpenAIAPIKey)
	}
	if cfg.AI.DeepSeekAPIKey != "" {
		providerMap["deepseek"] = providers.NewDeepSeekProvider(cfg.AI.DeepSeekAPIKey)
	}

	return &Service{
		cfg:         cfg,
		cache:       redisCache,
		queue:       queue,
		notesRepo:   notesRepo,
		authRepo:    authRepo,
		providers:   providerMap,
		rateLimiter: cache.NewRateLimiter(redisCache, 40, time.Hour),
	}
}

func (s *Service) RequestSuggestions(ctx context.Context, userID uuid.UUID, input RequestSuggestionsInput) (*Job, error) {
	allowed, err := s.rateLimiter.Allow(ctx, fmt.Sprintf("ai:%s", userID))
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, ErrRateLimitExceeded
	}

	if s.authRepo != nil {
		user, err := s.authRepo.FindByID(ctx, userID)
		if err != nil {
			return nil, err
		}
		if user.AIConsentAt == nil {
			return nil, ErrAIConsentRequired
		}
	}

	note, err := s.notesRepo.FindByID(ctx, input.NoteID, userID)
	if err != nil {
		return nil, err
	}

	if note.Category != "idea" && note.Category != "task" {
		return nil, errors.New("AI suggestions only available for ideas and tasks")
	}

	sanitized, err := security.ValidateUserContent(note.Content)
	if err != nil {
		return nil, ErrContentRejected
	}
	note.Content = sanitized

	providerName := input.Provider
	if providerName == "" {
		providerName = s.cfg.AI.DefaultProvider
	}

	if _, ok := s.providers[providerName]; !ok {
		return nil, ErrProviderNotFound
	}

	model := input.Model
	if model == "" {
		model = s.providers[providerName].DefaultModel()
	}

	job := &Job{
		ID:       uuid.New().String(),
		UserID:   userID,
		NoteID:   input.NoteID,
		Content:  note.Content,
		Category: note.Category,
		Provider: providerName,
		Model:    model,
		Status:   JobStatusPending,
	}

	if err := s.queue.Enqueue(ctx, job); err != nil {
		return nil, err
	}

	return job, nil
}

func (s *Service) GetJobStatus(ctx context.Context, userID uuid.UUID, jobID string) (*Job, error) {
	job, err := s.queue.GetJob(ctx, jobID)
	if err != nil {
		return nil, ErrJobNotFound
	}

	if job.UserID != userID {
		return nil, ErrJobNotFound
	}

	return job, nil
}

func (s *Service) GetJobResult(ctx context.Context, userID uuid.UUID, jobID string) (*JobResult, error) {
	job, err := s.queue.GetJob(ctx, jobID)
	if err != nil {
		return nil, ErrJobNotFound
	}

	if job.UserID != userID {
		return nil, ErrJobNotFound
	}

	if job.Status == JobStatusPending || job.Status == JobStatusProcessing {
		return &JobResult{
			JobID:  jobID,
			Status: job.Status,
		}, nil
	}

	return s.queue.GetResult(ctx, jobID)
}

func (s *Service) ProcessJob(ctx context.Context, job *Job) error {
	if err := s.queue.UpdateJobStatus(ctx, job.ID, JobStatusProcessing, ""); err != nil {
		return err
	}

	provider, ok := s.providers[job.Provider]
	if !ok {
		result := &JobResult{
			JobID:  job.ID,
			Status: JobStatusFailed,
			Error:  "provider not configured",
		}
		return s.queue.SaveResult(ctx, job.ID, result)
	}

	messages := s.buildPrompt(job)

	var suggestions []Suggestion
	var lastErr error

	for attempt := 0; attempt < s.cfg.AI.MaxRetries; attempt++ {
		resp, err := provider.Complete(ctx, messages, job.Model)
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(attempt+1) * time.Second)
			continue
		}

		if len(resp.Choices) > 0 {
			raw := resp.Choices[0].Message.Content
			if validated, err := security.ValidateAIOutput(raw); err != nil {
				lastErr = ErrContentRejected
				break
			} else {
				suggestions = s.parseSuggestions(validated)
				lastErr = nil
				break
			}
		}
	}

	if lastErr != nil {
		result := &JobResult{
			JobID:  job.ID,
			Status: JobStatusFailed,
			Error:  lastErr.Error(),
		}
		s.queue.SaveResult(ctx, job.ID, result)
		return lastErr
	}

	result := &JobResult{
		JobID:       job.ID,
		Status:      JobStatusCompleted,
		Suggestions: suggestions,
	}

	if err := s.queue.SaveResult(ctx, job.ID, result); err != nil {
		return err
	}

	s.queue.PublishCompletion(ctx, job.UserID, job.ID)

	return nil
}

func (s *Service) GetProvider(name string) (providers.Provider, bool) {
	p, ok := s.providers[name]
	return p, ok
}

func (s *Service) buildPrompt(job *Job) []ChatMessage {
	systemPrompt := `Você é um coach pessoal de produtividade e bem-estar. 
Analise o pensamento do usuário e forneça sugestões práticas e motivacionais.
Responda em português brasileiro de forma empática e construtiva.
Formate sua resposta em tópicos claros.`

	var userPrompt string
	switch job.Category {
	case "idea":
		userPrompt = fmt.Sprintf(`O usuário registrou uma IDEIA:

"%s"

Por favor, forneça:
1. Uma validação positiva da ideia
2. 2-3 passos práticos para desenvolver essa ideia
3. Possíveis desafios e como superá-los
4. Uma frase motivacional relacionada`, job.Content)

	case "task":
		userPrompt = fmt.Sprintf(`O usuário registrou uma TAREFA:

"%s"

Por favor, forneça:
1. Como priorizar essa tarefa
2. Sugestão de divisão em subtarefas menores
3. Estimativa de tempo e dicas de produtividade
4. Uma frase motivacional para completar a tarefa`, job.Content)

	default:
		userPrompt = fmt.Sprintf(`O usuário registrou:

"%s"

Forneça sugestões úteis e motivacionais.`, job.Content)
	}

	return []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}
}

func (s *Service) parseSuggestions(content string) []Suggestion {
	suggestions := []Suggestion{}

	lines := strings.Split(content, "\n")
	var currentType string
	var currentContent strings.Builder

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "1.") || strings.HasPrefix(line, "**1") {
			if currentContent.Len() > 0 {
				suggestions = append(suggestions, Suggestion{
					Type:    currentType,
					Content: strings.TrimSpace(currentContent.String()),
				})
				currentContent.Reset()
			}
			currentType = "validation"
			currentContent.WriteString(strings.TrimPrefix(strings.TrimPrefix(line, "1."), "**1"))
		} else if strings.HasPrefix(line, "2.") || strings.HasPrefix(line, "**2") {
			if currentContent.Len() > 0 {
				suggestions = append(suggestions, Suggestion{
					Type:    currentType,
					Content: strings.TrimSpace(currentContent.String()),
				})
				currentContent.Reset()
			}
			currentType = "action"
			currentContent.WriteString(strings.TrimPrefix(strings.TrimPrefix(line, "2."), "**2"))
		} else if strings.HasPrefix(line, "3.") || strings.HasPrefix(line, "**3") {
			if currentContent.Len() > 0 {
				suggestions = append(suggestions, Suggestion{
					Type:    currentType,
					Content: strings.TrimSpace(currentContent.String()),
				})
				currentContent.Reset()
			}
			currentType = "challenge"
			currentContent.WriteString(strings.TrimPrefix(strings.TrimPrefix(line, "3."), "**3"))
		} else if strings.HasPrefix(line, "4.") || strings.HasPrefix(line, "**4") {
			if currentContent.Len() > 0 {
				suggestions = append(suggestions, Suggestion{
					Type:    currentType,
					Content: strings.TrimSpace(currentContent.String()),
				})
				currentContent.Reset()
			}
			currentType = "motivation"
			currentContent.WriteString(strings.TrimPrefix(strings.TrimPrefix(line, "4."), "**4"))
		} else {
			if currentContent.Len() > 0 {
				currentContent.WriteString(" ")
			}
			currentContent.WriteString(line)
		}
	}

	if currentContent.Len() > 0 {
		suggestions = append(suggestions, Suggestion{
			Type:    currentType,
			Content: strings.TrimSpace(currentContent.String()),
		})
	}

	if len(suggestions) == 0 {
		suggestions = append(suggestions, Suggestion{
			Type:    "general",
			Content: content,
		})
	}

	return suggestions
}
