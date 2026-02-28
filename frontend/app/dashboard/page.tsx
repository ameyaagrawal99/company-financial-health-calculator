'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/lib/store'
import HealthScoreWidget from '@/components/dashboard/HealthScoreWidget'
import SectionCard from '@/components/dashboard/SectionCard'
import { formatCurrency, formatPct, formatX, formatDays } from '@/lib/formatters'
import { FinancialHealthReport } from '@/lib/types'
import { exportExcel, triggerDownload, getAIAnalysis, getLawymanQA } from '@/lib/api'
import { AIKeys } from '@/lib/ai-keys'
import { Download, FileSpreadsheet, RefreshCw, Sparkles, X, ChevronDown, ChevronUp, Settings, MessageSquare } from 'lucide-react'

const ChatPanel = dynamic(() => import('@/components/chat/ChatPanel'), { ssr: false })
const AISettingsModal = dynamic(() => import('@/components/chat/AISettingsModal'), { ssr: false })

function buildSectionCards(report: FinancialHealthReport) {
  const r = report.ratios
  const c = report.compliance
  const cu = report.currency_unit

  const st = (v: number | undefined | null, good: (x: number) => boolean, warn?: (x: number) => boolean) => {
    if (v === undefined || v === null) return 'N/A' as const
    if (good(v)) return 'Good' as const
    if (warn && warn(v)) return 'Watch' as const
    return 'Critical' as const
  }

  return [
    {
      title: 'Income & Profitability', icon: '📈', href: '/dashboard/income',
      overallStatus: st(r.net_profit_margin, v => v > 10, v => v > 0),
      metrics: [
        { label: 'Revenue', value: formatCurrency(r.revenue, cu), status: 'N/A' as const },
        { label: 'Gross Margin', value: formatPct(r.gross_margin), status: st(r.gross_margin, v => v > 30, v => v > 15) },
        { label: 'Net Margin', value: formatPct(r.net_profit_margin), status: st(r.net_profit_margin, v => v > 10, v => v > 0) },
        { label: 'ROE', value: formatPct(r.roe), status: st(r.roe, v => v > 15, v => v > 0) },
      ],
    },
    {
      title: 'Expenditure Analysis', icon: '💸', href: '/dashboard/expenses',
      overallStatus: st(r.cost_to_revenue, v => v < 80, v => v < 95),
      metrics: [
        { label: 'Total Costs', value: formatCurrency(r.total_costs, cu), status: 'N/A' as const },
        { label: 'Cost-to-Revenue', value: formatPct(r.cost_to_revenue), status: st(r.cost_to_revenue, v => v < 80, v => v < 95) },
        { label: 'Largest Cost', value: r.largest_cost_head || 'N/A', status: 'N/A' as const },
        { label: 'EBITDA Margin', value: formatPct(r.ebitda_margin), status: st(r.ebitda_margin, v => v > 15, v => v > 8) },
      ],
    },
    {
      title: 'Cash Flow', icon: '💵', href: '/dashboard/cashflow',
      overallStatus: st(r.operating_cash_flow, v => v > 0),
      metrics: [
        { label: 'Operating CF', value: formatCurrency(r.operating_cash_flow, cu), status: st(r.operating_cash_flow, v => v > 0) },
        { label: 'Free Cash Flow', value: formatCurrency(r.free_cash_flow, cu), status: st(r.free_cash_flow, v => v > 0) },
        { label: 'CF Margin', value: formatPct(r.cash_flow_margin), status: st(r.cash_flow_margin, v => v > 10, v => v > 5) },
        { label: 'DSCR', value: formatX(r.dscr), status: st(r.dscr, v => v > 1.25, v => v > 1) },
      ],
    },
    {
      title: 'Receivables & Debtors', icon: '📬', href: '/dashboard/receivables',
      overallStatus: st(r.dso, v => v < 45, v => v < 90),
      metrics: [
        { label: 'DSO', value: formatDays(r.dso), status: st(r.dso, v => v < 45, v => v < 90) },
        { label: 'Receivables TO', value: formatX(r.receivables_turnover), status: st(r.receivables_turnover, v => v > 8, v => v > 4) },
        { label: 'CCC', value: formatDays(r.cash_conversion_cycle), status: st(r.cash_conversion_cycle, v => v < 60, v => v < 90) },
        { label: 'Quick Ratio', value: formatX(r.quick_ratio), status: st(r.quick_ratio, v => v >= 1, v => v >= 0.7) },
      ],
    },
    {
      title: 'Payables & Creditors', icon: '📤', href: '/dashboard/payables',
      overallStatus: st(r.dpo, v => v < 60, v => v < 90),
      metrics: [
        { label: 'DPO', value: formatDays(r.dpo), status: st(r.dpo, v => v < 60, v => v < 90) },
        { label: 'GST Status', value: c.gst_status, status: c.gst_status === 'OK' ? 'Good' as const : c.gst_status === 'Warning' ? 'Watch' as const : 'Critical' as const },
        { label: 'TDS Status', value: c.tds_status, status: c.tds_status === 'OK' ? 'Good' as const : 'Critical' as const },
        { label: 'MSME Overdue', value: c.msme_overdue ? '⚠ Yes' : '✓ None', status: c.msme_overdue ? 'Critical' as const : 'Good' as const },
      ],
    },
    {
      title: 'Debt & Loans', icon: '🏦', href: '/dashboard/debt',
      overallStatus: st(r.debt_to_equity, v => v < 1, v => v < 3),
      metrics: [
        { label: 'Total Debt', value: formatCurrency(r.total_debt, cu), status: 'N/A' as const },
        { label: 'D/E Ratio', value: formatX(r.debt_to_equity), status: st(r.debt_to_equity, v => v < 1, v => v < 3) },
        { label: 'Interest Cover', value: formatX(r.interest_coverage), status: st(r.interest_coverage, v => v > 3, v => v > 1.5) },
        { label: 'Net Debt/EBITDA', value: formatX(r.net_debt_to_ebitda), status: st(r.net_debt_to_ebitda, v => v < 2, v => v < 4) },
      ],
    },
    {
      title: 'Liquidity & Working Capital', icon: '💧', href: '/dashboard/liquidity',
      overallStatus: st(r.current_ratio, v => v >= 1.5, v => v >= 1),
      metrics: [
        { label: 'Current Ratio', value: formatX(r.current_ratio), status: st(r.current_ratio, v => v >= 1.5, v => v >= 1) },
        { label: 'Quick Ratio', value: formatX(r.quick_ratio), status: st(r.quick_ratio, v => v >= 1, v => v >= 0.7) },
        { label: 'Working Capital', value: formatCurrency(r.working_capital, cu), status: st(r.working_capital, v => v > 0) },
        { label: 'Cash Ratio', value: formatX(r.cash_ratio), status: st(r.cash_ratio, v => v > 0.2, v => v > 0.1) },
      ],
    },
    {
      title: 'Efficiency Ratios', icon: '⚙️', href: '/dashboard/efficiency',
      overallStatus: st(r.asset_turnover, v => v > 1, v => v > 0.5),
      metrics: [
        { label: 'Asset Turnover', value: formatX(r.asset_turnover), status: st(r.asset_turnover, v => v > 1, v => v > 0.5) },
        { label: 'Inventory TO', value: formatX(r.inventory_turnover), status: st(r.inventory_turnover, v => v > 6, v => v > 3) },
        { label: 'DIO', value: formatDays(r.dio), status: st(r.dio, v => v < 45, v => v < 90) },
        { label: 'Fixed Asset TO', value: formatX(r.fixed_asset_turnover), status: st(r.fixed_asset_turnover, v => v > 2, v => v > 1) },
      ],
    },
    {
      title: 'Indian Compliance', icon: '✅', href: '/dashboard/compliance',
      overallStatus: (c.gst_status === 'Critical' || c.tds_status === 'Critical' || c.ibc_risk || c.msme_overdue) ? 'Critical' as const :
                     (c.gst_status === 'Warning' || c.pf_esi_status !== 'OK') ? 'Watch' as const : 'Good' as const,
      metrics: [
        { label: 'GST', value: c.gst_status, status: c.gst_status === 'OK' ? 'Good' as const : c.gst_status === 'Warning' ? 'Watch' as const : 'Critical' as const },
        { label: 'TDS', value: c.tds_status, status: c.tds_status === 'OK' ? 'Good' as const : 'Critical' as const },
        { label: 'PF/ESI', value: c.pf_esi_status, status: c.pf_esi_status === 'OK' ? 'Good' as const : 'Watch' as const },
        { label: 'MSME/IBC', value: (c.msme_overdue || c.ibc_risk) ? '⚠ Risk' : '✓ OK', status: (c.msme_overdue || c.ibc_risk) ? 'Critical' as const : 'Good' as const },
      ],
    },
  ]
}

// ── Render Markdown-ish text from GPT ──────────────────────────────────────
function AnalysisText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize: 14, lineHeight: 1.75, color: '#1C1917' }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, color: '#1C3557', margin: '20px 0 8px', borderBottom: '1px solid #E4E2DC', paddingBottom: 4 }}>{line.replace('### ', '')}</h3>
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: '#1C3557', margin: '24px 0 10px' }}>{line.replace('## ', '')}</h2>
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} style={{ fontWeight: 700, margin: '8px 0' }}>{line.replace(/\*\*/g, '')}</p>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const content = line.replace(/^[-•] /, '').replace(/\*\*(.*?)\*\*/g, '$1')
          return <div key={i} style={{ display: 'flex', gap: 8, margin: '4px 0' }}><span style={{ color: '#3D5A80', marginTop: 2 }}>•</span><span dangerouslySetInnerHTML={{ __html: line.replace(/^[-•] /, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} /></div>
        }
        if (line.trim() === '') return <div key={i} style={{ height: 8 }} />
        return <p key={i} style={{ margin: '4px 0' }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
      })}
    </div>
  )
}

// Maps AI-returned question text → emoji prefix for the accordion
const LAYMAN_ICONS: Record<string, string> = {
  'Is this business profitable enough?': '🏆',
  'Is this company ready for a bank loan?': '🏦',
  'Is the company spending too much?': '💸',
  'Are customers paying on time?': '⏱️',
  'Is inventory being managed well?': '📦',
  'Can the company pay its bills this month?': '💧',
  'Is the business growing or declining?': '📈',
  'What is the biggest financial risk right now?': '🔥',
  'Would an investor or partner find this company attractive?': '🤝',
  'Is this business at risk of serious financial trouble?': '🚨',
}

export default function DashboardPage() {
  const router = useRouter()
  const { report, statement, rawText, isLoading } = useAppStore() as any
  const [exporting, setExporting] = useState(false)

  // AI state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiTokens, setAiTokens] = useState<number | null>(null)

  // CFO Chat + AI Settings
  const [showChat, setShowChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Per-card AI prefill
  const [chatPrefill, setChatPrefill] = useState('')

  // Layman Q&A state
  const [laymanQA, setLaymanQA] = useState<Array<{ question: string; answer: string }>>([])
  const [laymanLoading, setLaymanLoading] = useState(false)
  const [laymanError, setLaymanError] = useState<string | null>(null)
  const [laymanExpandedIdx, setLaymanExpandedIdx] = useState<number | null>(null)

  const handleExport = async () => {
    if (!statement) return
    setExporting(true)
    try {
      const blob = await exportExcel(statement)
      const name = `Financial_Health_${(report?.company_name || 'Report').replace(/\s+/g, '_')}_${report?.financial_year || 'FY2425'}.xlsx`
      triggerDownload(blob, name)
    } catch (err: any) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const handleAIAnalysis = async () => {
    if (!statement) return
    // Use AIKeys — the single source of truth (stored as fin_health_openai_key / fin_health_claude_key)
    if (!AIKeys.hasAnyKey()) {
      setShowSettings(true)
      return
    }
    setAiOpen(true)
    setAiLoading(true)
    setAiResult(null)
    setAiError(null)
    try {
      const res = await getAIAnalysis(statement, AIKeys.getHeaders())
      if (res.available && res.analysis) {
        setAiResult(res.analysis)
        setAiTokens(res.tokens_used || null)
      } else {
        setAiError(res.error || 'Analysis unavailable')
      }
    } catch (err: any) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleLaymanQA = async () => {
    if (!statement) return
    if (!AIKeys.hasAnyKey()) {
      setShowSettings(true)
      return
    }
    setLaymanLoading(true)
    setLaymanError(null)
    setLaymanQA([])
    try {
      const qa = await getLawymanQA(statement, AIKeys.getHeaders())
      setLaymanQA(qa)
    } catch (err: any) {
      setLaymanError(err.message)
    } finally {
      setLaymanLoading(false)
    }
  }

  if (!report) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>No data yet</h2>
        <p style={{ color: '#6B6560', marginBottom: 24 }}>Upload your financial statements or enter data manually to see your health score.</p>
        <a href="/upload" style={{ background: '#3D5A80', color: '#fff', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          Get Started →
        </a>
      </div>
    )
  }

  const sections = buildSectionCards(report)
  const criticalRecs = report.recommendations.filter((r: any) => r.priority === 'Critical').length
  const watchRecs = report.recommendations.filter((r: any) => r.priority === 'Watch').length

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <a href="/" style={{ fontSize: 13, color: '#3D5A80', textDecoration: 'none' }}>← Home</a>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>{report.company_name}</h1>
          <span style={{ fontSize: 13, color: '#6B6560' }}>{report.financial_year} · ₹ {report.currency_unit}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/recommendations" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 13, color: '#1C1917', textDecoration: 'none', background: '#fff' }}>
            {criticalRecs > 0 && <span style={{ background: '#9F1239', color: '#fff', borderRadius: 999, width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{criticalRecs}</span>}
            💡 Recommendations
          </a>
          {/* AI Button */}
          <button
            onClick={handleAIAnalysis}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Sparkles size={15} />
            AI Analysis
          </button>
          {/* AI Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            AI Settings
          </button>
          {/* CFO Chat toggle */}
          <button
            onClick={() => setShowChat(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showChat ? 'bg-blue-600 text-white' : 'border border-blue-200 text-blue-600 hover:bg-blue-50'}`}
          >
            CFO Chat {showChat ? '▲' : '▼'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#166534', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer' }}
          >
            <FileSpreadsheet size={16} />
            {exporting ? 'Exporting...' : 'Download Excel'}
          </button>
          <a href="/upload" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #3D5A80', borderRadius: 8, fontSize: 13, color: '#3D5A80', textDecoration: 'none', background: '#fff' }}>
            <RefreshCw size={14} /> Re-enter
          </a>
        </div>
      </div>

      {/* Health Score */}
      <div style={{ marginBottom: 28 }}>
        <HealthScoreWidget report={report} />
      </div>

      {/* Alert strip */}
      {(criticalRecs > 0 || watchRecs > 0) && (
        <div style={{ marginBottom: 24, padding: '12px 16px', background: criticalRecs > 0 ? '#FFF1F2' : '#FFF7ED', borderRadius: 10, border: `1px solid ${criticalRecs > 0 ? '#FECDD3' : '#FED7AA'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, color: criticalRecs > 0 ? '#9F1239' : '#9A3412', fontWeight: 500 }}>
            {criticalRecs > 0 && `🔴 ${criticalRecs} critical issue${criticalRecs > 1 ? 's' : ''} require immediate attention. `}
            {watchRecs > 0 && `🟡 ${watchRecs} area${watchRecs > 1 ? 's' : ''} need monitoring.`}
          </div>
          <a href="/recommendations" style={{ fontSize: 13, fontWeight: 600, color: '#3D5A80', textDecoration: 'none' }}>View All →</a>
        </div>
      )}

      {/* ── AI Analysis Panel ──────────────────────────────────────────── */}
      {aiOpen && (
        <div style={{ marginBottom: 28, border: '1px solid #C4B5FD', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 24px rgba(99,102,241,0.12)' }}>
          {/* Panel header */}
          <div style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={20} color="#fff" />
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>GPT-4o Financial Analysis</div>
                <div style={{ color: '#DDD6FE', fontSize: 12 }}>CFO-grade narrative · India-specific · {report.company_name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {aiTokens && <span style={{ fontSize: 11, color: '#DDD6FE' }}>{aiTokens.toLocaleString()} tokens used</span>}
              <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: '6px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <Settings size={12} /> Settings
              </button>
              <button onClick={() => setAiOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: '6px 8px', color: '#fff', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '24px', background: '#FAFAF9', minHeight: 120 }}>
            {aiLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#6366F1', marginBottom: 6 }}>GPT-4o is analyzing your financials…</div>
                <div style={{ fontSize: 13, color: '#8B5CF6' }}>Reviewing 50+ ratios, compliance status, and Indian market context. This takes ~15 seconds.</div>
              </div>
            )}
            {aiError && !aiLoading && (
              <div style={{ padding: '16px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8, color: '#9F1239', fontSize: 13 }}>
                <strong>Error:</strong> {aiError}
                {aiError.includes('API key') && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => setShowSettings(true)} style={{ fontSize: 12, color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Open AI Settings →
                    </button>
                  </div>
                )}
              </div>
            )}
            {aiResult && !aiLoading && (
              <AnalysisText text={aiResult} />
            )}
            {!aiLoading && !aiError && !aiResult && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#8B5CF6' }}>
                <Sparkles size={32} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 14 }}>Analysis running — results will appear here shortly</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9 Section Cards — each has an Ask AI button that pre-fills the chat */}
      {(() => {
        const sectionQuestions: Record<string, string> = {
          'Income & Profitability': 'Explain the profitability metrics for this company. Are the margins healthy compared to industry norms?',
          'Expenditure Analysis': 'Analyse the cost structure. Is the company spending efficiently? What is the largest cost driver?',
          'Cash Flow': 'How is the cash flow position? Can the company sustain operations and fund growth from its own cash?',
          'Receivables & Debtors': 'Is the company collecting payments from customers fast enough? Any debtor concentration risk?',
          'Payables & Creditors': 'Is the company managing its supplier payments well? Any risk of payable stress?',
          'Debt & Loans': 'Is this company ready for a bank loan? Explain the debt position and interest coverage.',
          'Liquidity & Working Capital': 'Can the company pay its short-term bills? Is working capital healthy and sustainable?',
          'Efficiency Ratios': 'How efficiently is the company using its assets and inventory? Are there inefficiency red flags?',
          'Indian Compliance': 'What are the compliance risks? Any GST, TDS, PF/ESI or MSME overdue issues I should know about?',
        }
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {sections.map(s => (
              <SectionCard
                key={s.title}
                {...s}
                onAskAI={() => {
                  setChatPrefill(sectionQuestions[s.title] || `Tell me about ${s.title} for this company.`)
                  setShowChat(true)
                }}
              />
            ))}
          </div>
        )
      })()}

      {/* ── Business Health Check — Layman Q&A ─────────────────── */}
      <div style={{ marginTop: 24, border: '1px solid #5EEAD4', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 16px rgba(20,184,166,0.10)' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0D9488, #0891B2)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Business Health Check</div>
              <div style={{ color: '#99F6E4', fontSize: 12 }}>10 plain-English answers · No finance jargon · For founders &amp; directors</div>
            </div>
          </div>
          <button
            onClick={handleLaymanQA}
            disabled={laymanLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: laymanLoading ? 'rgba(255,255,255,0.18)' : '#fff',
              color: laymanLoading ? '#e2e8f0' : '#0D9488',
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: 8, padding: '8px 18px',
              fontWeight: 700, fontSize: 13,
              cursor: laymanLoading ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            {laymanLoading
              ? <><RefreshCw size={14} className="animate-spin" />&nbsp;Generating…</>
              : laymanQA.length > 0
                ? <>🔄 Regenerate</>
                : <>✨ Generate Answers</>
            }
          </button>
        </div>

        {/* Body — appears after first click */}
        {(laymanLoading || laymanQA.length > 0 || !!laymanError) && (
          <div style={{ background: '#F0FDFA', padding: '20px 24px' }}>
            {laymanLoading && (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🤔</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0D9488', marginBottom: 6 }}>AI is reviewing your financials…</div>
                <div style={{ fontSize: 13, color: '#0891B2' }}>Preparing plain-English answers to 10 business health questions. This takes ~10 seconds.</div>
              </div>
            )}
            {laymanError && !laymanLoading && (
              <div style={{ padding: '14px 16px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8, color: '#9F1239', fontSize: 13 }}>
                <strong>Error:</strong> {laymanError}
                {laymanError.toLowerCase().includes('key') && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => setShowSettings(true)} style={{ fontSize: 12, color: '#0D9488', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Open AI Settings →
                    </button>
                  </div>
                )}
              </div>
            )}
            {laymanQA.length > 0 && !laymanLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {laymanQA.map((item, idx) => {
                  const isOpen = laymanExpandedIdx === idx
                  const icon = LAYMAN_ICONS[item.question] ?? '💡'
                  return (
                    <div
                      key={idx}
                      style={{
                        border: `1px solid ${isOpen ? '#5EEAD4' : '#CCFBF1'}`,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: isOpen ? '#fff' : '#F9FFFE',
                      }}
                    >
                      <button
                        onClick={() => setLaymanExpandedIdx(isOpen ? null : idx)}
                        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 14, color: '#134E4A' }}>
                          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                          {item.question}
                        </span>
                        <span style={{ color: '#0D9488', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '4px 16px 14px 46px', fontSize: 13, color: '#1C4A47', lineHeight: 1.75 }}>
                          {item.answer}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI CTA */}
      <div style={{ marginTop: 24, padding: '20px 24px', background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', border: '1px solid #C4B5FD', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#4C1D95', marginBottom: 4 }}>🤖 Get AI-Powered CFO Analysis</div>
          <div style={{ fontSize: 13, color: '#6D28D9', lineHeight: 1.5 }}>
            GPT-4o analyzes your 50+ ratios and delivers a board-ready narrative — strengths, red flags, working capital insights, debt assessment, 90-day action plan, and India-specific regulatory risk. Powered by your own OpenAI key.
          </div>
        </div>
        <button
          onClick={handleAIAnalysis}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          <Sparkles size={16} />
          Analyse with AI
        </button>
      </div>

      {/* Excel Export CTA */}
      <div style={{ marginTop: 16, padding: '20px 24px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#166534', marginBottom: 4 }}>📊 Export to Excel — Full Control</div>
          <div style={{ fontSize: 13, color: '#15803D', lineHeight: 1.5 }}>
            Download a fully-formatted Excel workbook with all formulas intact, color coding, and 6 sheets — Summary, All Ratios, Compliance, Recommendations, Input Data, and Interactive Calculator.
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, background: '#166534', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 14, cursor: exporting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
        >
          <Download size={16} />
          {exporting ? 'Building...' : 'Download .xlsx'}
        </button>
      </div>

      {/* CFO Chat Panel — floating bottom-right */}
      {showChat && (
        <div className="fixed right-4 bottom-4 w-96 h-[560px] z-40 shadow-2xl rounded-xl">
          <ChatPanel
            statement={statement}
            companyName={report?.company_name ?? ''}
            financialYear={report?.financial_year ?? ''}
            rawText={rawText ?? undefined}
            initialMessage={chatPrefill}
          />
        </div>
      )}

      {/* AI Settings Modal */}
      <AISettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
