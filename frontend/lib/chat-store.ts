import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

interface ChatState {
  // Map key: "companyName::financialYear"
  histories: Record<string, ChatMessage[]>
  activeKey: string

  setActiveCompany: (companyName: string, financialYear: string) => void
  getMessages: () => ChatMessage[]
  addMessage: (role: 'user' | 'assistant', content: string) => string  // returns id
  updateMessage: (id: string, content: string) => void
  clearHistory: () => void
}

const MAX_MESSAGES = 100
const TRIM_TO = 80

function makeKey(company: string, year: string): string {
  return `${company}::${year}`
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      histories: {},
      activeKey: '',

      setActiveCompany: (companyName, financialYear) => {
        set({ activeKey: makeKey(companyName, financialYear) })
      },

      getMessages: () => {
        const { histories, activeKey } = get()
        return histories[activeKey] || []
      },

      addMessage: (role, content) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const msg: ChatMessage = { id, role, content, createdAt: Date.now() }

        set((state) => {
          const key = state.activeKey
          const existing = state.histories[key] || []
          let updated = [...existing, msg]
          // Trim to avoid unbounded localStorage growth
          if (updated.length > MAX_MESSAGES) {
            updated = updated.slice(updated.length - TRIM_TO)
          }
          return {
            histories: { ...state.histories, [key]: updated },
          }
        })
        return id
      },

      updateMessage: (id, content) => {
        set((state) => {
          const key = state.activeKey
          const messages = (state.histories[key] || []).map((m) =>
            m.id === id ? { ...m, content } : m
          )
          return { histories: { ...state.histories, [key]: messages } }
        })
      },

      clearHistory: () => {
        set((state) => ({
          histories: { ...state.histories, [state.activeKey]: [] },
        }))
      },
    }),
    {
      name: 'fin-chat-history',
      storage: createJSONStorage(() => localStorage),
      // Only persist the histories map, not ephemeral activeKey
      partialize: (state) => ({ histories: state.histories }),
    }
  )
)
