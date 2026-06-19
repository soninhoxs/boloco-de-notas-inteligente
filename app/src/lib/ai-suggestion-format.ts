import { stripNoteTagPrefix } from '@/lib/note-tags'

/** Rótulos gerados pela IA — removidos ao salvar na nota */
const SUGGESTION_LABEL_PATTERN =
  /^(Nível \d+ — [^:]+|Ação imediata|Opção \d+|Para agora)\s*—\s*/i

const TAG_PREFIXES = [
  '💡 Ideia: ',
  '✅ Tarefa: ',
  '🙏 Gratidão: ',
  '🔔 Lembrete: ',
  '💡 Idea: ',
  '✅ Task: ',
  '🙏 Gratitude: ',
  '🔔 Reminder: ',
]

export function parseSuggestionLabel(suggestion: string): {
  label: string | null
  body: string
} {
  const match = suggestion.match(SUGGESTION_LABEL_PATTERN)
  if (!match) return { label: null, body: suggestion }

  return {
    label: match[1],
    body: suggestion.slice(match[0].length).trim(),
  }
}

/** Texto limpo para colar na nota (sem "Opção 1 —", etc.) */
export function formatSuggestionForNote(suggestion: string): string {
  const { body } = parseSuggestionLabel(suggestion)
  return body || suggestion.trim()
}

function getTagPrefix(text: string): string {
  for (const prefix of TAG_PREFIXES) {
    if (text.startsWith(prefix)) return prefix
  }
  return ''
}

function splitNoteBody(body: string): { userContent: string; bullets: string[] } {
  if (body.startsWith('• ')) {
    const bullets = body
      .split('\n')
      .filter((line) => line.startsWith('• '))
      .map((line) => line.slice(2).trim())
    return { userContent: '', bullets }
  }

  const bulletIndex = body.search(/\n• /)
  if (bulletIndex === -1) {
    return { userContent: body, bullets: [] }
  }

  const userContent = body.slice(0, bulletIndex).trimEnd()
  const bulletSection = body.slice(bulletIndex + 1)
  const bullets = bulletSection
    .split('\n')
    .filter((line) => line.startsWith('• '))
    .map((line) => line.slice(2).trim())

  return { userContent, bullets }
}

function rebuildNoteText(
  tagPrefix: string,
  userContent: string,
  bullets: string[]
): string {
  if (bullets.length === 0) {
    return tagPrefix + userContent
  }

  const bulletLines = bullets.map((bullet) => `• ${bullet}`).join('\n')
  if (!userContent.trim()) {
    return tagPrefix + bulletLines
  }

  return `${tagPrefix}${userContent}\n\n${bulletLines}`
}

export function isSuggestionInNoteText(
  noteText: string,
  suggestion: string
): boolean {
  const body = stripNoteTagPrefix(noteText).trim()
  const clean = formatSuggestionForNote(suggestion)
  const { bullets } = splitNoteBody(body)
  return bullets.includes(clean)
}

/** Adiciona ou remove a sugestão da nota (toggle). */
export function toggleSuggestionInNoteText(
  noteText: string,
  suggestion: string
): string {
  const tagPrefix = getTagPrefix(noteText)
  const body = stripNoteTagPrefix(noteText).trim()
  const clean = formatSuggestionForNote(suggestion)
  const { userContent, bullets } = splitNoteBody(body)

  const existingIndex = bullets.indexOf(clean)
  const nextBullets =
    existingIndex >= 0
      ? bullets.filter((_, index) => index !== existingIndex)
      : [...bullets, clean]

  return rebuildNoteText(tagPrefix, userContent, nextBullets)
}

/** @deprecated Use toggleSuggestionInNoteText */
export function appendSuggestionToNoteText(
  noteText: string,
  suggestion: string
): string {
  if (isSuggestionInNoteText(noteText, suggestion)) {
    return noteText
  }
  return toggleSuggestionInNoteText(noteText, suggestion)
}
