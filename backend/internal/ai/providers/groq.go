package providers

import (
	"github.com/diario/backend/internal/ai/chat"
)

func NewGroqProvider(apiKey string) *BaseProvider {
	return NewBaseProvider(chat.ProviderConfig{
		Name:         "groq",
		BaseURL:      "https://api.groq.com/openai/v1",
		APIKey:       apiKey,
		DefaultModel: "llama-3.1-70b-versatile",
		Models: []string{
			"llama-3.1-70b-versatile",
			"llama-3.1-8b-instant",
			"mixtral-8x7b-32768",
			"gemma2-9b-it",
		},
	})
}
