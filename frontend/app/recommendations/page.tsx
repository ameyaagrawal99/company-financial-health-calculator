'use client'
import { useAppStore } from '@/lib/store'
import { Recommendation } from '@/lib/types'

const PRIORITY_CONFIG = {
  Critical: { color: '#9F1239', bg: '#FFF1F2', border: '#FECDD3', emoji: '🔴', label: 'CRITICAL — Act Immediately' },
  Watch: { color: '#854D0E', bg: '#FFF7ED', border: '#FED7AA', emoji: '🟡', label: 'WATCH — Monitor Closely' },
  Positive: { color: '#166534', bg: '#F0FDF4', border: '#86EFAC', emoji: '🟢', label: 'POSITIVE — Keep it Up' },
}

function RecCard({ rec }: { rec: Recommendation }) {
  const config = PRIORITY_CONFIG[rec.priority]
  return (
    <div style={{
      background: config.bg,
      border: `1px solid ${config.border}`,
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 15 }}>{config.emoji}</span>
          <div style={{ fontSize: 11, fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {rec.category}
          </div>
        </div>
        <div style={{ background: config.color, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
          {rec.priority}
        </div>
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, color: '#1C1917', marginBottom: 8 }}>{rec.finding}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Business Impact</div>
          <div style={{ fontSize: 13, color: '#374151' }}>{rec.impact}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#3D5A80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Recommended Action</div>
          <div style={{ fontSize: 13, color: '#374151' }}>{rec.action}</div>
        </div>
      </div>
    </div>
  )
}

export default function RecommendationsPage() {
  const { report } = useAppStore()

  if (!report) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <h2>No data yet</h2>
        <a href="/upload" style={{ color: '#3D5A80' }}>Start here →</a>
      </div>
    )
  }

  const critical = report.recommendations.filter(r => r.priority === 'Critical')
  const watch = report.recommendations.filter(r => r.priority === 'Watch')
  const positive = report.recommendations.filter(r => r.priority === 'Positive')

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/dashboard" style={{ fontSize: 13, color: '#3D5A80', textDecoration: 'none' }}>← Dashboard</a>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>Recommendations</h1>
        <p style={{ fontSize: 14, color: '#6B6560', margin: 0 }}>
          {report.company_name} · {report.financial_year} · {report.recommendations.length} action items
        </p>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        {critical.length > 0 && (
          <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8, padding: '10px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#9F1239' }}>{critical.length}</div>
            <div style={{ fontSize: 11, color: '#9F1239', fontWeight: 600 }}>Critical Issues</div>
          </div>
        )}
        {watch.length > 0 && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#854D0E' }}>{watch.length}</div>
            <div style={{ fontSize: 11, color: '#854D0E', fontWeight: 600 }}>Watch Items</div>
          </div>
        )}
        {positive.length > 0 && (
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#166534' }}>{positive.length}</div>
            <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Strengths</div>
          </div>
        )}
      </div>

      {critical.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#9F1239', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            🔴 CRITICAL — Address Immediately ({critical.length})
          </div>
          {critical.map((rec, i) => <RecCard key={i} rec={rec} />)}
        </>
      )}

      {watch.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#854D0E', marginBottom: 12, marginTop: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
            🟡 WATCH — Monitor Closely ({watch.length})
          </div>
          {watch.map((rec, i) => <RecCard key={i} rec={rec} />)}
        </>
      )}

      {positive.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 12, marginTop: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
            🟢 POSITIVE — Maintain These ({positive.length})
          </div>
          {positive.map((rec, i) => <RecCard key={i} rec={rec} />)}
        </>
      )}
    </div>
  )
}
