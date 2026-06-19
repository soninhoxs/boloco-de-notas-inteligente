import type { AppLanguage } from '@/lib/i18n'

export type NoteCategory = 'idea' | 'task' | 'gratitude' | 'reminder'

export const NOTE_TAG_PREFIXES_BY_LANG: Record<
  AppLanguage,
  Record<NoteCategory, string>
> = {
  'pt-BR': {
    idea: '💡 Ideia: ',
    task: '✅ Tarefa: ',
    gratitude: '🙏 Gratidão: ',
    reminder: '🔔 Lembrete: ',
  },
  'en-US': {
    idea: '💡 Idea: ',
    task: '✅ Task: ',
    gratitude: '🙏 Gratitude: ',
    reminder: '🔔 Reminder: ',
  },
}

const ALL_PREFIX_ENTRIES = Object.values(NOTE_TAG_PREFIXES_BY_LANG).flatMap(
  (prefixes) => Object.entries(prefixes) as [NoteCategory, string][]
)

export function getNoteTagPrefixes(
  language: AppLanguage
): Record<NoteCategory, string> {
  return NOTE_TAG_PREFIXES_BY_LANG[language]
}

export function detectNoteCategory(text: string): NoteCategory | null {
  for (const [category, prefix] of ALL_PREFIX_ENTRIES) {
    if (text.startsWith(prefix)) return category
  }
  return null
}

export function stripNoteTagPrefix(text: string): string {
  for (const [, prefix] of ALL_PREFIX_ENTRIES) {
    if (text.startsWith(prefix)) return text.slice(prefix.length)
  }
  return text
}

export function isAiSuggestible(text: string): boolean {
  const category = detectNoteCategory(text)
  return category === 'idea' || category === 'task'
}
