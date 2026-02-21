import { create } from 'zustand'
import { FinancialStatement, FinancialHealthReport } from './types'

interface AppState {
  statement: FinancialStatement | null
  report: FinancialHealthReport | null
  isLoading: boolean
  error: string | null
  setStatement: (stmt: FinancialStatement) => void
  setReport: (report: FinancialHealthReport) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  statement: null,
  report: null,
  isLoading: false,
  error: null,
  setStatement: (stmt) => set({ statement: stmt }),
  setReport: (report) => set({ report }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),
  reset: () => set({ statement: null, report: null, isLoading: false, error: null }),
}))
