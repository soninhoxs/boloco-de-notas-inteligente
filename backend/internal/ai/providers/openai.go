package providers

import (
	"github.com/diario/backend/internal/ai/chat"
)

func NewOpenAIProvider(apiKey string) *BaseProvider {
	return NewBaseProvider(chat.ProviderConfig{
		Name:         "openai",
		BaseURL:      "https://api.openai.com/v1",
		APIKey:       apiKey,
		DefaultModel: "gpt-4o-mini",
		Models: []string{
			"gpt-4o",
			"gpt-4o-mini",
			"gpt-4-turbo",
			"gpt-3.5-turbo",
		},
	})
}
