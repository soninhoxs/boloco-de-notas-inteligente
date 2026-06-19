import { api } from '@/services/api'
import type { NoteAttachment } from '@/types/notes'

function dataUrlToFile(dataUrl: string, name: string): File {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], name, { type: mime })
}

export async function uploadNoteAttachments(
  attachments: NoteAttachment[]
): Promise<NoteAttachment[]> {
  const uploaded: NoteAttachment[] = []

  for (const attachment of attachments) {
    if (attachment.dataUrl.startsWith('http')) {
      uploaded.push(attachment)
      continue
    }

    try {
      const file = dataUrlToFile(attachment.dataUrl, attachment.name)
      const result = await api.storage.upload(file)
      uploaded.push({
        ...attachment,
        dataUrl: result.url,
      })
    } catch {
      uploaded.push(attachment)
    }
  }

  return uploaded
}
