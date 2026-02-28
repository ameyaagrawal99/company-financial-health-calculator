/**
 * AI key management — stores Claude and OpenAI keys in localStorage.
 * Keys NEVER leave the browser except as request headers to the backend.
 */

const CLAUDE_KEY  = 'fin_health_claude_key'
const OPENAI_KEY  = 'fin_health_openai_key'
const PROVIDER    = 'fin_health_ai_provider'

export type AIProvider = 'auto' | 'claude' | 'openai'

function safeGet(key: string): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(key) || ''
}

export const AIKeys = {
  getClaude:   () => safeGet(CLAUDE_KEY),
  getOpenAI:   () => safeGet(OPENAI_KEY),
  getProvider: (): AIProvider => (safeGet(PROVIDER) as AIProvider) || 'auto',

  setClaude:   (k: string) => localStorage.setItem(CLAUDE_KEY, k),
  setOpenAI:   (k: string) => localStorage.setItem(OPENAI_KEY, k),
  setProvider: (p: AIProvider) => localStorage.setItem(PROVIDER, p),

  clear: () => {
    localStorage.removeItem(CLAUDE_KEY)
    localStorage.removeItem(OPENAI_KEY)
    localStorage.removeItem(PROVIDER)
  },

  /** Returns headers to pass to every API fetch call. */
  getHeaders: (): Record<string, string> => {
    const h: Record<string, string> = {}
    const claude  = safeGet(CLAUDE_KEY)
    const openai  = safeGet(OPENAI_KEY)
    const stored  = (safeGet(PROVIDER) as AIProvider) || 'auto'
    if (claude)  h['X-Claude-Key']  = claude
    if (openai)  h['X-OpenAI-Key']  = openai
    // Smart fallback: if a specific provider is stored but its key is missing,
    // send 'auto' so the backend picks whichever key IS available (or errors cleanly).
    let effective: AIProvider = stored
    if (stored === 'openai' && !openai) effective = 'auto'
    if (stored === 'claude' && !claude) effective = 'auto'
    h['X-Provider'] = effective
    return h
  },

  /** Returns true if at least one key is set. */
  hasAnyKey: () => Boolean(safeGet(CLAUDE_KEY) || safeGet(OPENAI_KEY)),

  /** Mask key for display: sk-ant-api03-...XXXX */
  maskKey: (key: string): string => {
    if (!key || key.length < 8) return '(empty)'
    return key.slice(0, 10) + '...' + key.slice(-4)
  },
}
