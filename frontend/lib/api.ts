import { FinancialStatement, FinancialHealthReport } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function uploadFile(
  file: File,
  aiHeaders: Record<string, string> = {}
): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: aiHeaders,   // Let browser set Content-Type for multipart
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

export async function calculateFinancials(stmt: FinancialStatement): Promise<FinancialHealthReport> {
  const res = await fetch(`${API_URL}/api/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stmt),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Calculation failed')
  }
  return res.json()
}

export async function exportExcel(stmt: FinancialStatement): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/export/excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stmt),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Export failed')
  }
  return res.blob()
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function getAIAnalysis(
  stmt: FinancialStatement,
  aiHeaders: Record<string, string> = {}
): Promise<{
  available: boolean
  error: string | null
  analysis: string | null
  model?: string
  provider?: string
  tokens_used?: number
  health_score?: number
  score_band?: string
}> {
  const res = await fetch(`${API_URL}/api/ai-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiHeaders },
    body: JSON.stringify(stmt),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'AI analysis failed')
  }
  return res.json()
}

export interface ChatStreamOptions {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  statement?: FinancialStatement
  rawText?: string
  aiHeaders: Record<string, string>
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: string) => void
  signal?: AbortSignal
}

export async function streamChat(options: ChatStreamOptions): Promise<void> {
  const { messages, statement, rawText, aiHeaders, onChunk, onDone, onError, signal } = options

  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiHeaders },
    body: JSON.stringify({
      messages,
      statement: statement ?? null,
      provider: aiHeaders['X-Provider'] || 'auto',
      raw_text: rawText ?? null,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Chat failed' }))
    onError(err.detail || 'Chat request failed')
    return
  }

  const reader = res.body?.getReader()
  if (!reader) { onError('No response body'); return }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''  // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr) continue

      try {
        const event = JSON.parse(jsonStr)
        if (event.error) { onError(event.error); return }
        if (event.text) onChunk(event.text)
        if (event.done) { onDone(); return }
      } catch {
        // Malformed SSE line — skip
      }
    }
  }
  onDone()
}

export interface LaymanQAItem {
  question: string
  answer: string
}

export async function getLawymanQA(
  stmt: FinancialStatement,
  aiHeaders: Record<string, string> = {}
): Promise<LaymanQAItem[]> {
  const res = await fetch(`${API_URL}/api/layman-qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiHeaders },
    body: JSON.stringify(stmt),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Layman Q&A failed' }))
    throw new Error(err.detail || 'Layman Q&A failed')
  }
  const data = await res.json()
  return data.qa as LaymanQAItem[]
}
