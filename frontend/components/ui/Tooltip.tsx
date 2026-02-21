'use client'
import { useState } from 'react'
import { Info } from 'lucide-react'
import { TooltipData } from '@/lib/tooltips'

interface TooltipProps {
  data: TooltipData | null
  children?: React.ReactNode
}

export default function MetricTooltip({ data, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  if (!data) return <>{children}</>

  return (
    <span
      className="tooltip-container"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <Info size={13} style={{ marginLeft: 4, color: '#6B6560', cursor: 'help', flexShrink: 0 }} />
      {visible && (
        <div className="tooltip-box">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#fff' }}>{data.name}</div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Formula</span>
            <div style={{ fontFamily: 'monospace', color: '#E2E8F0', fontSize: 11, marginTop: 2 }}>{data.formula}</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Plain English</span>
            <div style={{ marginTop: 2 }}>{data.plain}</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Indian Context</span>
            <div style={{ marginTop: 2 }}>{data.indianContext}</div>
          </div>
          <div>
            <span style={{ color: '#86EFAC', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Healthy Range</span>
            <div style={{ marginTop: 2, color: '#86EFAC' }}>{data.healthyRange}</div>
          </div>
        </div>
      )}
    </span>
  )
}
