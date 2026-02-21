'use client'
import { FinancialHealthReport } from '@/lib/types'
import { getScoreStatus, SCORE_COLORS } from '@/lib/formatters'

interface Props {
  report: FinancialHealthReport
}

const SUB_SCORE_LABELS: Record<string, string> = {
  profitability: 'Profitability',
  liquidity: 'Liquidity',
  leverage: 'Leverage',
  efficiency: 'Efficiency',
  cash_flow: 'Cash Flow',
  compliance: 'Compliance',
}

const WEIGHTS: Record<string, number> = {
  profitability: 25,
  liquidity: 20,
  leverage: 20,
  efficiency: 15,
  cash_flow: 10,
  compliance: 10,
}

function ScoreBar({ score, label, weight }: { score: number; label: string; weight: number }) {
  const status = getScoreStatus(score)
  const colors = SCORE_COLORS[status]
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: '#1C1917' }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#6B6560' }}>{weight}% weight</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{score.toFixed(0)}/100</span>
        </div>
      </div>
      <div style={{ height: 8, background: '#E4E2DC', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: colors.text,
            borderRadius: 4,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}

export default function HealthScoreWidget({ report }: Props) {
  const status = getScoreStatus(report.health_score)
  const colors = SCORE_COLORS[status]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Score display */}
      <div className="card" style={{ textAlign: 'center', border: `2px solid ${colors.border}`, background: colors.bg }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Financial Health Score
        </div>
        <div style={{ fontSize: 80, fontWeight: 800, color: colors.text, lineHeight: 1 }}>
          {report.health_score.toFixed(0)}
        </div>
        <div style={{ fontSize: 14, color: colors.text, marginTop: 4 }}>out of 100</div>
        <div style={{
          display: 'inline-block',
          marginTop: 12,
          padding: '6px 20px',
          borderRadius: 999,
          background: colors.text,
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
        }}>
          {report.score_band}
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: '#6B6560' }}>
          {report.company_name} · {report.financial_year}
        </div>

        {report.balance_sheet_balanced === false && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#FFF7ED', borderRadius: 8, fontSize: 12, color: '#9A3412' }}>
            ⚠ Balance sheet off by ₹{report.balance_sheet_diff?.toFixed(1)} L — check inputs
          </div>
        )}
        {report.missing_fields.filter(f => !f.includes('optional')).length > 0 && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#F8F7F4', borderRadius: 8, fontSize: 12, color: '#6B6560' }}>
            Missing: {report.missing_fields.filter(f => !f.includes('optional')).join(', ')}
          </div>
        )}
      </div>

      {/* Sub-scores */}
      <div className="card">
        <div className="section-header">Category Breakdown</div>
        {(Object.entries(report.sub_scores) as [string, number][]).map(([key, val]) => (
          <ScoreBar key={key} score={val} label={SUB_SCORE_LABELS[key] || key} weight={WEIGHTS[key] || 0} />
        ))}
        <div style={{ marginTop: 12, fontSize: 11, color: '#6B6560', borderTop: '1px solid #E4E2DC', paddingTop: 8 }}>
          Overall = Σ (category score × weight). Calibrated to RBI/SEBI benchmarks.
        </div>
      </div>
    </div>
  )
}
