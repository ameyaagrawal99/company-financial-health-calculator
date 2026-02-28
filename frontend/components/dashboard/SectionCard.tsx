'use client'
import { STATUS_COLORS } from '@/lib/formatters'

interface HeroMetric {
  label: string
  value: string
  status?: 'Good' | 'Watch' | 'Critical' | 'N/A'
}

interface SectionCardProps {
  title: string
  icon: string
  metrics: HeroMetric[]
  overallStatus: 'Good' | 'Watch' | 'Critical' | 'N/A'
  href: string
  onAskAI?: () => void
}

export default function SectionCard({ title, icon, metrics, overallStatus, href, onAskAI }: SectionCardProps) {
  const statusColors = STATUS_COLORS[overallStatus] || STATUS_COLORS['N/A']

  return (
    <a href={href} style={{ textDecoration: 'none' }}>
      <div
        className="card"
        style={{
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, transform 0.2s',
          height: '100%',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none'
          ;(e.currentTarget as HTMLElement).style.transform = 'none'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1917' }}>{title}</span>
          </div>
          <div className={`badge badge-${overallStatus.toLowerCase()}`}>
            {overallStatus}
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {metrics.slice(0, 4).map((m, i) => {
            const mc = STATUS_COLORS[m.status || 'N/A']
            return (
              <div key={i} style={{
                background: '#F8F7F4',
                borderRadius: 8,
                padding: '8px 10px',
                borderLeft: `3px solid ${m.status === 'Good' ? '#4ADE80' : m.status === 'Watch' ? '#FACC15' : m.status === 'Critical' ? '#F87171' : '#E4E2DC'}`,
              }}>
                <div style={{ fontSize: 10, color: '#6B6560', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: mc.text }}>{m.value}</div>
              </div>
            )
          })}
        </div>

        {/* Footer: View details + Ask AI */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {onAskAI ? (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAskAI() }}
              style={{
                fontSize: 11, color: '#6366F1', background: '#EEF2FF',
                border: '1px solid #C7D2FE', borderRadius: 6,
                padding: '3px 8px', cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              💬 Ask AI
            </button>
          ) : <span />}
          <span style={{ fontSize: 12, color: '#3D5A80', fontWeight: 600 }}>View Details →</span>
        </div>
      </div>
    </a>
  )
}
