import { describe, expect, it } from 'vitest'
import { apiNoteToLocal, localInputToApiCreate } from '@/lib/note-api-mapper'

describe('note-api-mapper', () => {
  it('maps API note to local note', () => {
    const local = apiNoteToLocal({
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: 'user-1',
      content: '💡 Ideia: Build a feature',
      category: 'idea',
      created_at: '2026-06-18T12:00:00.000Z',
      updated_at: '2026-06-18T12:00:00.000Z',
      location: {
        latitude: -23.5,
        longitude: -46.6,
        city: 'São Paulo',
        state: 'SP',
      },
      metadata: {
        ai_provider: 'groq',
        ai_model: 'llama',
      },
    })

    expect(local.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(local.text).toBe('💡 Ideia: Build a feature')
    expect(local.location?.city).toBe('São Paulo')
    expect(local.aiProvider).toBe('groq')
    expect(local.aiModel).toBe('llama')
  })

  it('maps local input to API create payload', () => {
    const payload = localInputToApiCreate({
      text: '✅ Tarefa: Finish report',
      location: {
        latitude: 1,
        longitude: 2,
        city: 'Rio',
        state: 'RJ',
      },
    })

    expect(payload.content).toBe('✅ Tarefa: Finish report')
    expect(payload.category).toBe('task')
    expect(payload.location?.city).toBe('Rio')
  })
})
