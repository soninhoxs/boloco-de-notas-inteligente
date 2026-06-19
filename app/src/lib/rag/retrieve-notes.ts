import type { Note } from '@/types/notes'
import type { NoteCategory } from '@/lib/note-tags'
import { detectNoteCategory, stripNoteTagPrefix } from '@/lib/note-tags'

export interface RagChunk {
  id: string
  text: string
  createdAt: number
  score: number
  matchedTokens: string[]
  noteCategory: NoteCategory | null
}

const STOP_WORDS = new Set([
  'para',
  'com',
  'uma',
  'por',
  'que',
  'dos',
  'das',
  'nos',
  'nas',
  'the',
  'and',
  'for',
  'you',
  'your',
])

const MAX_CHUNKS = 4
const MAX_CHUNK_CHARS = 220
const MAX_TOTAL_CONTEXT_CHARS = 900

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}…`
}

function uniqueTokens(tokens: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const token of tokens) {
    if (seen.has(token)) continue
    seen.add(token)
    result.push(token)
  }
  return result
}

function getMatchedTokens(
  queryTokens: Set<string>,
  noteText: string
): string[] {
  const noteTokens = tokenize(stripNoteTagPrefix(noteText))
  return uniqueTokens(noteTokens.filter((token) => queryTokens.has(token))).slice(
    0,
    5
  )
}

function scoreNote(
  queryTokens: string[],
  noteText: string,
  category: NoteCategory
): number {
  const body = stripNoteTagPrefix(noteText).trim()
  if (!body) return 0

  const noteTokens = tokenize(body)
  if (noteTokens.length === 0) return 0

  const querySet = new Set(queryTokens)
  let overlap = 0
  for (const token of noteTokens) {
    if (querySet.has(token)) overlap += 1
  }

  const noteCategory = detectNoteCategory(noteText)
  const categoryBonus = noteCategory === category ? 1.5 : 0
  const density = overlap / Math.sqrt(noteTokens.length)

  return overlap + density + categoryBonus
}

function selectDiverseChunks(ranked: RagChunk[]): RagChunk[] {
  const selected: RagChunk[] = []
  const coveredTokens = new Set<string>()

  for (const chunk of ranked) {
    if (selected.length >= MAX_CHUNKS) break

    const freshTokens = chunk.matchedTokens.filter(
      (token) => !coveredTokens.has(token)
    )

    if (
      selected.length === 0 ||
      freshTokens.length > 0 ||
      chunk.score >= ranked[0].score * 0.6
    ) {
      selected.push(chunk)
      freshTokens.forEach((token) => coveredTokens.add(token))
      continue
    }

    if (selected.length < 2) {
      selected.push(chunk)
    }
  }

  return selected
}

function formatChunk(note: Note, index: number): string {
  const date = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(note.createdAt))

  const body = truncate(stripNoteTagPrefix(note.text), MAX_CHUNK_CHARS)
  return `[${index}] (${date}) ${body}`
}

export function retrieveRelevantNotes(
  notes: Note[],
  query: string,
  category: NoteCategory,
  excludeNoteId?: string
): RagChunk[] {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  const queryTokenSet = new Set(queryTokens)

  const ranked = notes
    .filter((note) => note.id !== excludeNoteId && note.text.trim())
    .map((note) => {
      const matchedTokens = getMatchedTokens(queryTokenSet, note.text)
      return {
        id: note.id,
        text: note.text,
        createdAt: note.createdAt,
        score: scoreNote(queryTokens, note.text, category),
        matchedTokens,
        noteCategory: detectNoteCategory(note.text),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)

  return selectDiverseChunks(ranked)
}

/** @deprecated Use buildCoachingContext from coaching-context.ts */
export function buildRagContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return ''

  const lines: string[] = []
  let totalChars = 0

  for (let i = 0; i < chunks.length; i += 1) {
    const line = formatChunk(
      { id: chunks[i].id, text: chunks[i].text, createdAt: chunks[i].createdAt },
      i + 1
    )
    if (totalChars + line.length > MAX_TOTAL_CONTEXT_CHARS) break
    lines.push(line)
    totalChars += line.length
  }

  if (lines.length === 0) return ''

  return `<contexto_anotacoes_usuario>
${lines.join('\n')}
</contexto_anotacoes_usuario>`
}
