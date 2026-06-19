package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/sony/gobreaker"

	"github.com/diario/backend/internal/ai/chat"
)

type Provider interface {
	Name() string
	Complete(ctx context.Context, messages []chat.ChatMessage, model string) (*chat.ChatResponse, error)
	Models() []string
	DefaultModel() string
}

type BaseProvider struct {
	name         string
	baseURL      string
	apiKey       string
	defaultModel string
	models       []string
	client       *http.Client
	breaker      *gobreaker.CircuitBreaker
}

func NewBaseProvider(cfg chat.ProviderConfig) *BaseProvider {
	cbSettings := gobreaker.Settings{
		Name:        cfg.Name,
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 3 && failureRatio >= 0.6
		},
	}

	return &BaseProvider{
		name:         cfg.Name,
		baseURL:      cfg.BaseURL,
		apiKey:       cfg.APIKey,
		defaultModel: cfg.DefaultModel,
		models:       cfg.Models,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
		breaker: gobreaker.NewCircuitBreaker(cbSettings),
	}
}

func (p *BaseProvider) Name() string {
	return p.name
}

func (p *BaseProvider) Models() []string {
	return p.models
}

func (p *BaseProvider) DefaultModel() string {
	return p.defaultModel
}

func (p *BaseProvider) Complete(ctx context.Context, messages []chat.ChatMessage, model string) (*chat.ChatResponse, error) {
	if model == "" {
		model = p.defaultModel
	}

	result, err := p.breaker.Execute(func() (interface{}, error) {
		return p.doRequest(ctx, messages, model)
	})

	if err != nil {
		return nil, fmt.Errorf("provider %s failed: %w", p.name, err)
	}

	return result.(*chat.ChatResponse), nil
}

func (p *BaseProvider) doRequest(ctx context.Context, messages []chat.ChatMessage, model string) (*chat.ChatResponse, error) {
	reqBody := chat.ChatRequest{
		Model:       model,
		Messages:    messages,
		MaxTokens:   1024,
		Temperature: 0.7,
		Stream:      false,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var chatResp chat.ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &chatResp, nil
}
