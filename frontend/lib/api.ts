import { FinancialStatement, FinancialHealthReport } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function uploadFile(file: File): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData })
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
  openaiKey?: string
): Promise<{
  available: boolean
  error: string | null
  analysis: string | null
  model?: string
  tokens_used?: number
  health_score?: number
  score_band?: string
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (openaiKey) headers['X-OpenAI-Key'] = openaiKey

  const res = await fetch(`${API_URL}/api/ai-analysis`, {
    method: 'POST',
    headers,
    body: JSON.stringify(stmt),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'AI analysis failed')
  }
  return res.json()
}
