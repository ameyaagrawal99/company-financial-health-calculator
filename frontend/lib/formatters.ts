export function formatCurrency(value: number | undefined | null, unit: string = 'lakhs'): string {
  if (value === null || value === undefined) return 'N/A'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (unit === 'crores') {
    if (abs >= 100) return `${sign}₹${(abs / 100).toFixed(1)} Cr`
    return `${sign}₹${abs.toFixed(2)} Cr`
  }
  // Lakhs default
  if (abs >= 100) return `${sign}₹${(abs / 100).toFixed(1)} Cr`
  if (abs >= 1) return `${sign}₹${abs.toFixed(1)} L`
  return `${sign}₹${(abs * 100).toFixed(0)} K`
}

export function formatPct(value: number | undefined | null, decimals = 1): string {
  if (value === null || value === undefined) return 'N/A'
  return `${value.toFixed(decimals)}%`
}

export function formatX(value: number | undefined | null, decimals = 2): string {
  if (value === null || value === undefined) return 'N/A'
  return `${value.toFixed(decimals)}x`
}

export function formatDays(value: number | undefined | null): string {
  if (value === null || value === undefined) return 'N/A'
  return `${Math.round(value)} days`
}

export function formatNum(value: number | undefined | null, decimals = 2): string {
  if (value === null || value === undefined) return 'N/A'
  return value.toFixed(decimals)
}

export type ScoreStatus = 'excellent' | 'good' | 'moderate' | 'stressed' | 'critical'

export function getScoreStatus(score: number): ScoreStatus {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'moderate'
  if (score >= 20) return 'stressed'
  return 'critical'
}

export const SCORE_COLORS: Record<ScoreStatus, { bg: string; text: string; border: string }> = {
  excellent: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  good: { bg: '#DCFCE7', text: '#15803D', border: '#4ADE80' },
  moderate: { bg: '#FEFCE8', text: '#854D0E', border: '#FDE047' },
  stressed: { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
  critical: { bg: '#FFF1F2', text: '#9F1239', border: '#FCA5A5' },
}

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Good: { bg: '#F0FDF4', text: '#166534' },
  Watch: { bg: '#FFF7ED', text: '#9A3412' },
  Critical: { bg: '#FFF1F2', text: '#9F1239' },
  Positive: { bg: '#F0FDF4', text: '#166534' },
  OK: { bg: '#F0FDF4', text: '#166534' },
  Warning: { bg: '#FEFCE8', text: '#854D0E' },
  'N/A': { bg: '#F8F7F4', text: '#6B6560' },
}

export const SCORE_BAND_LABEL: Record<string, string> = {
  Excellent: '🟢 Excellent',
  Good: '🟢 Good',
  Moderate: '🟡 Moderate',
  Stressed: '🟠 Stressed',
  Critical: '🔴 Critical',
}
