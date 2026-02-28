import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FinancialStatement, FinancialHealthReport } from './types'

interface AppState {
  statement: FinancialStatement | null
  report: FinancialHealthReport | null
  rawText: string | null
  isLoading: boolean
  error: string | null
  setStatement: (stmt: FinancialStatement) => void
  setReport: (report: FinancialHealthReport) => void
  setRawText: (text: string | null) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  reset: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      statement: null,
      report: null,
      rawText: null,
      isLoading: false,
      error: null,
      setStatement: (stmt) => set({ statement: stmt }),
      setReport: (report) => set({ report }),
      setRawText: (text) => set({ rawText: text }),
      setLoading: (v) => set({ isLoading: v }),
      setError: (e) => set({ error: e }),
      reset: () => set({ statement: null, report: null, rawText: null, isLoading: false, error: null }),
    }),
    {
      name: 'fin-health-store',
      // Only persist data fields, not ephemeral UI state
      partialize: (state) => ({
        statement: state.statement,
        report: state.report,
        rawText: state.rawText,
      }),
    }
  )
)
