package providers

import (
	"github.com/diario/backend/internal/ai/chat"
)

func NewDeepSeekProvider(apiKey string) *BaseProvider {
	return NewBaseProvider(chat.ProviderConfig{
		Name:         "deepseek",
		BaseURL:      "https://api.deepseek.com/v1",
		APIKey:       apiKey,
		DefaultModel: "deepseek-chat",
		Models: []string{
			"deepseek-chat",
			"deepseek-coder",
		},
	})
}
