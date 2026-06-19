import type { TranslationKey } from '@/lib/i18n/translations'

export type AiErrorCode = Extract<
  TranslationKey,
  `ai.error.${string}`
>

export class AiServiceError extends Error {
  readonly code: AiErrorCode
  readonly params?: Record<string, string | number>

  constructor(code: AiErrorCode, params?: Record<string, string | number>) {
    super(code)
    this.code = code
    this.params = params
    this.name = 'AiServiceError'
  }
}
