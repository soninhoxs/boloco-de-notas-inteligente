export type AiProvider =
  | 'groq'
  | 'cerebras'
  | 'openrouter'
  | 'deepseek'
  | 'openai'

export type AiApiKeys = Record<AiProvider, string>

export interface Settings {
  username: string
  displayName: string
  bio: string
  notificationsEnabled: boolean
  autoSave: boolean
  language: 'pt-BR' | 'en-US'
  aiEnabled: boolean
  aiApiKeys: AiApiKeys
  aiProvider: AiProvider
  aiModel: string
}
