import type { NoteCategory } from '@/lib/note-tags'
import type { Note } from '@/types/notes'
import type { AiProvider, Settings } from '@/types/settings'
import { retrieveRelevantNotes } from '@/lib/rag/retrieve-notes'
import { buildCoachingContext, detectCoachingIntent } from '@/lib/rag/coaching-context'
import { AI_PROVIDERS } from '@/services/ai-providers'
import { getSystemPrompt, buildUserMessage } from '@/services/ai-prompts'
import {
  checkRateLimit,
  isHarmfulContent,
  validateModelOutput,
  validateUserInput,
  wrapUserQuery,
} from '@/services/ai-security'
import { AiServiceError } from '@/services/ai-errors'

export { AI_PROVIDERS } from '@/services/ai-providers'
export { getModelLabel, MODEL_LABELS } from '@/services/ai-providers'
export { AiServiceError } from '@/services/ai-errors'

export interface AiConfig {
  enabled: boolean
  apiKey: string
  provider: AiProvider
  model: string
}

export interface AiRequestOptions {
  notes?: Note[]
  excludeNoteId?: string
}

export function getProviderApiKey(
  settings: Settings,
  provider: AiProvider
): string {
  return settings.aiApiKeys[provider]?.trim() ?? ''
}

export function settingsToAiConfig(settings: Settings): AiConfig {
  return {
    enabled: settings.aiEnabled,
    apiKey: getProviderApiKey(settings, settings.aiProvider),
    provider: settings.aiProvider,
    model: settings.aiModel,
  }
}

export function resolveNoteAiConfig(
  settings: Settings,
  note?: Pick<Note, 'aiProvider' | 'aiModel'>
): AiConfig {
  const base = settingsToAiConfig(settings)
  if (!note?.aiProvider && !note?.aiModel) return base

  const provider = note.aiProvider ?? base.provider
  const providerModels = AI_PROVIDERS[provider].models
  const model =
    note.aiModel &&
    (providerModels as readonly string[]).includes(note.aiModel)
      ? note.aiModel
      : AI_PROVIDERS[provider].defaultModel

  return {
    ...base,
    provider,
    model,
    apiKey: getProviderApiKey(settings, provider),
  }
}

function providerLabel(provider: AiProvider): string {
  return AI_PROVIDERS[provider].label.replace(' (grátis)', '').replace(' (pago)', '')
}

function parseProviderError(
  status: number,
  body: string,
  provider: AiProvider
): AiServiceError {
  if (status === 401) {
    return new AiServiceError('ai.error.invalidApiKey')
  }

  let apiMessage: string
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string }
    }
    apiMessage = parsed.error?.message?.toLowerCase() ?? ''
  } catch {
    apiMessage = body.toLowerCase()
  }

  if (status === 429) {
    if (
      apiMessage.includes('quota') ||
      apiMessage.includes('billing') ||
      apiMessage.includes('insufficient')
    ) {
      return new AiServiceError('ai.error.quotaExceeded', {
        provider: providerLabel(provider),
      })
    }
    return new AiServiceError('ai.error.rateLimited')
  }

  return new AiServiceError('ai.error.apiError', {
    status,
    body: body.slice(0, 120),
  })
}

function buildRequestHeaders(
  apiKey: string,
  provider: AiProvider
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey.trim()}`,
  }

  if (provider === 'openrouter' && typeof window !== 'undefined') {
    headers['HTTP-Referer'] = window.location.origin
    headers['X-Title'] = 'Diario de Pensamentos'
  }

  return headers
}

export async function fetchAiSuggestions(
  config: AiConfig,
  category: NoteCategory,
  content: string,
  options: AiRequestOptions = {}
): Promise<string[]> {
  if (!config.enabled) {
    throw new AiServiceError('ai.error.disabled')
  }

  if (!config.apiKey.trim()) {
    throw new AiServiceError('ai.error.noApiKey')
  }

  if (category !== 'idea' && category !== 'task') {
    throw new AiServiceError('ai.error.categoryNotSupported')
  }

  checkRateLimit()
  const { content: safeContent } = validateUserInput(content)

  const ragChunks = retrieveRelevantNotes(
    options.notes ?? [],
    safeContent,
    category,
    options.excludeNoteId
  )
  const intent = detectCoachingIntent(safeContent)
  const coachingContext = buildCoachingContext(
    safeContent,
    category,
    ragChunks,
    intent
  )
  const userMessage = buildUserMessage(
    category,
    wrapUserQuery(safeContent),
    coachingContext,
    intent
  )

  const provider = AI_PROVIDERS[config.provider]
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildRequestHeaders(config.apiKey, config.provider),
    body: JSON.stringify({
      model: config.model || provider.defaultModel,
      temperature: intent === 'practical' ? 0.5 : 0.35,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getSystemPrompt(intent) },
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw parseProviderError(response.status, body, config.provider)
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }

  const raw = data.choices?.[0]?.message?.content
  if (!raw) {
    throw new AiServiceError('ai.error.emptyResponse')
  }

  if (isHarmfulContent(raw)) {
    throw new AiServiceError('ai.error.harmfulContent')
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return validateModelOutput(parsed).suggestions
  } catch (err) {
    if (err instanceof AiServiceError) throw err
    throw new AiServiceError('ai.error.parseError')
  }
}
