import type { AiProvider } from '@/types/settings'

export interface AiProviderConfig {
  label: string
  baseUrl: string
  keyUrl: string
  keyHost: string
  models: readonly string[]
  defaultModel: string
  freeTier: boolean
}

export const AI_PROVIDERS: Record<AiProvider, AiProviderConfig> = {
  groq: {
    label: 'Groq (grátis)',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
    keyHost: 'console.groq.com',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    defaultModel: 'llama-3.3-70b-versatile',
    freeTier: true,
  },
  cerebras: {
    label: 'Cerebras (grátis)',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyUrl: 'https://cloud.cerebras.ai',
    keyHost: 'cloud.cerebras.ai',
    models: ['llama-3.3-70b', 'gpt-oss-120b'],
    defaultModel: 'llama-3.3-70b',
    freeTier: true,
  },
  openrouter: {
    label: 'OpenRouter (grátis)',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    keyHost: 'openrouter.ai',
    models: [
      'openrouter/free',
      'deepseek/deepseek-r1:free',
      'qwen/qwen3-4b:free',
    ],
    defaultModel: 'openrouter/free',
    freeTier: true,
  },
  deepseek: {
    label: 'DeepSeek (China)',
    baseUrl: 'https://api.deepseek.com/v1',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyHost: 'platform.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    freeTier: false,
  },
  openai: {
    label: 'OpenAI (pago)',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHost: 'platform.openai.com',
    models: ['gpt-4o-mini', 'gpt-4o'],
    defaultModel: 'gpt-4o-mini',
    freeTier: false,
  },
}

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AiProvider[]

export const MODEL_LABELS: Record<string, string> = {
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
  'llama-3.3-70b': 'Llama 3.3 70B',
  'gpt-oss-120b': 'GPT-OSS 120B',
  'openrouter/free': 'Roteador grátis',
  'deepseek/deepseek-r1:free': 'DeepSeek R1 (grátis)',
  'qwen/qwen3-4b:free': 'Qwen 3 4B (grátis)',
  'deepseek-chat': 'DeepSeek V3',
  'deepseek-reasoner': 'DeepSeek R1',
  'gpt-4o-mini': 'GPT-4o mini',
  'gpt-4o': 'GPT-4o',
}

export function createDefaultApiKeys(): Record<AiProvider, string> {
  return Object.fromEntries(
    AI_PROVIDER_IDS.map((id) => [id, ''])
  ) as Record<AiProvider, string>
}

export function getModelLabel(modelId: string): string {
  return MODEL_LABELS[modelId] ?? modelId
}
