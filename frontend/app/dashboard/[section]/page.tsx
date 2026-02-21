'use client'
import { useAppStore } from '@/lib/store'
import { useParams } from 'next/navigation'
import { formatCurrency, formatPct, formatX, formatDays, STATUS_COLORS } from '@/lib/formatters'
import { FinancialRatios, ComplianceStatus } from '@/lib/types'
import { getTooltip } from '@/lib/tooltips'
import MetricTooltip from '@/components/ui/Tooltip'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

type MetricRow = { label: string; value: string; status: string; formula?: string; healthy?: string }

function MetricTile({ label, value, status, tooltipKey }: { label: string; value: string; status: string; tooltipKey?: string }) {
  const sc = STATUS_COLORS[status] || STATUS_COLORS['N/A']
  const tooltip = tooltipKey ? getTooltip(tooltipKey) : null
  return (
    <div style={{ background: sc.bg, border: `1px solid ${status === 'Good' ? '#86EFAC' : status === 'Watch' ? '#FDE047' : status === 'Critical' ? '#FCA5A5' : '#E4E2DC'}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: sc.text, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
        <MetricTooltip data={tooltip}>{label}</MetricTooltip>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: sc.text }}>{value}</div>
      <div style={{ fontSize: 10, color: sc.text, marginTop: 2 }}>{status}</div>
    </div>
  )
}

function RatioTable({ rows }: { rows: MetricRow[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#F8F7F4' }}>
          {['Metric', 'Value', 'Status', 'Formula', 'Healthy Range'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: '#6B6560', borderBottom: '1px solid #E4E2DC' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const sc = STATUS_COLORS[row.status] || STATUS_COLORS['N/A']
          return (
            <tr key={i} style={{ borderBottom: '1px solid #E4E2DC' }}>
              <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1C1917' }}>{row.label}</td>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: sc.text }}>{row.value}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{ background: sc.bg, color: sc.text, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{row.status}</span>
              </td>
              <td style={{ padding: '8px 12px', color: '#6B6560', fontFamily: 'monospace', fontSize: 11 }}>{row.formula || '—'}</td>
              <td style={{ padding: '8px 12px', color: '#6B6560', fontSize: 11 }}>{row.healthy || '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const CHART_COLORS = ['#3D5A80', '#4ADE80', '#FACC15', '#F87171', '#818CF8']

function buildSectionContent(section: string, ratios: FinancialRatios, compliance: ComplianceStatus, cu: string) {
  const n = (v: number | undefined | null) => v ?? 0
  const st = (v: number | undefined | null, good: (x: number) => boolean, warn?: (x: number) => boolean): string => {
    if (v === undefined || v === null) return 'N/A'
    if (good(v)) return 'Good'
    if (warn && warn(v)) return 'Watch'
    return 'Critical'
  }

  switch (section) {
    case 'income':
      return {
        title: '📈 Income & Profitability',
        tiles: [
          { label: 'Revenue', value: formatCurrency(ratios.revenue, cu), status: 'N/A', tooltipKey: undefined },
          { label: 'Gross Margin', value: formatPct(ratios.gross_margin), status: st(ratios.gross_margin, v => v > 30, v => v > 15), tooltipKey: 'gross_margin' },
          { label: 'Net Profit Margin', value: formatPct(ratios.net_profit_margin), status: st(ratios.net_profit_margin, v => v > 10, v => v > 0), tooltipKey: 'net_profit_margin' },
          { label: 'EBITDA Margin', value: formatPct(ratios.ebitda_margin), status: st(ratios.ebitda_margin, v => v > 15, v => v > 8), tooltipKey: 'ebitda_margin' },
          { label: 'EBIT Margin', value: formatPct(ratios.operating_profit_margin), status: st(ratios.operating_profit_margin, v => v > 12, v => v > 5), tooltipKey: undefined },
          { label: 'ROE', value: formatPct(ratios.roe), status: st(ratios.roe, v => v > 15, v => v > 0), tooltipKey: 'roe' },
          { label: 'ROA', value: formatPct(ratios.roa), status: st(ratios.roa, v => v > 5, v => v > 0), tooltipKey: 'roa' },
          { label: 'ROCE', value: formatPct(ratios.roce), status: st(ratios.roce, v => v > 15, v => v > 8), tooltipKey: 'roce' },
        ],
        rows: [
          { label: 'Revenue', value: formatCurrency(ratios.revenue, cu), status: 'N/A', formula: 'Rev from Ops + Other Income', healthy: 'Growing YoY' },
          { label: 'COGS', value: formatCurrency(ratios.cogs, cu), status: st(ratios.cogs && ratios.revenue ? ratios.cogs / ratios.revenue : null, v => v < 0.7, v => v < 0.85), formula: 'RM + Purchases + Inv Change', healthy: '< 70% of revenue' },
          { label: 'Gross Profit', value: formatCurrency(ratios.gross_profit, cu), status: st(ratios.gross_margin, v => v > 30, v => v > 15), formula: 'Revenue – COGS', healthy: '> 30% margin' },
          { label: 'EBITDA', value: formatCurrency(ratios.ebitda, cu), status: st(ratios.ebitda_margin, v => v > 15, v => v > 8), formula: 'Rev – COGS – Emp – OtherExp', healthy: '> 15% margin' },
          { label: 'EBIT', value: formatCurrency(ratios.ebit, cu), status: st(ratios.operating_profit_margin, v => v > 12, v => v > 5), formula: 'EBITDA – Depreciation', healthy: '> 12% margin' },
          { label: 'Net Profit', value: formatCurrency(ratios.net_profit, cu), status: st(ratios.net_profit_margin, v => v > 10, v => v > 0), formula: 'EBIT – Finance Costs – Tax', healthy: '> 10% margin' },
          { label: 'Gross Margin %', value: formatPct(ratios.gross_margin), status: st(ratios.gross_margin, v => v > 30, v => v > 15), formula: 'Gross Profit / Revenue × 100', healthy: '> 30%' },
          { label: 'Net Profit Margin %', value: formatPct(ratios.net_profit_margin), status: st(ratios.net_profit_margin, v => v > 10, v => v > 0), formula: 'Net Profit / Revenue × 100', healthy: '> 10%' },
          { label: 'EBITDA Margin %', value: formatPct(ratios.ebitda_margin), status: st(ratios.ebitda_margin, v => v > 15, v => v > 8), formula: 'EBITDA / Revenue × 100', healthy: '> 15%' },
          { label: 'ROE %', value: formatPct(ratios.roe), status: st(ratios.roe, v => v > 15, v => v > 0), formula: 'Net Profit / Equity × 100', healthy: '> 15%' },
          { label: 'ROA %', value: formatPct(ratios.roa), status: st(ratios.roa, v => v > 5, v => v > 0), formula: 'Net Profit / Total Assets × 100', healthy: '> 5%' },
          { label: 'ROCE %', value: formatPct(ratios.roce), status: st(ratios.roce, v => v > 15, v => v > 8), formula: 'EBIT / Capital Employed × 100', healthy: '> 15%' },
        ],
        chartData: [
          { name: 'Revenue', value: n(ratios.revenue) },
          { name: 'Gross Profit', value: n(ratios.gross_profit) },
          { name: 'EBITDA', value: n(ratios.ebitda) },
          { name: 'EBIT', value: n(ratios.ebit) },
          { name: 'Net Profit', value: n(ratios.net_profit) },
        ],
        chartType: 'waterfall',
      }

    case 'liquidity':
      return {
        title: '💧 Liquidity & Working Capital',
        tiles: [
          { label: 'Current Ratio', value: formatX(ratios.current_ratio), status: st(ratios.current_ratio, v => v >= 1.5, v => v >= 1), tooltipKey: 'current_ratio' },
          { label: 'Quick Ratio', value: formatX(ratios.quick_ratio), status: st(ratios.quick_ratio, v => v >= 1, v => v >= 0.7), tooltipKey: 'quick_ratio' },
          { label: 'Cash Ratio', value: formatX(ratios.cash_ratio), status: st(ratios.cash_ratio, v => v > 0.2, v => v > 0.1), tooltipKey: undefined },
          { label: 'Working Capital', value: formatCurrency(ratios.working_capital, cu), status: st(ratios.working_capital, v => v > 0), tooltipKey: undefined },
          { label: 'Current Assets', value: formatCurrency(ratios.current_assets, cu), status: 'N/A', tooltipKey: undefined },
          { label: 'Current Liabilities', value: formatCurrency(ratios.current_liabilities, cu), status: 'N/A', tooltipKey: undefined },
          { label: 'Cash Conv. Cycle', value: formatDays(ratios.cash_conversion_cycle), status: st(ratios.cash_conversion_cycle, v => v < 60, v => v < 90), tooltipKey: 'cash_conversion_cycle' },
        ],
        rows: [
          { label: 'Current Assets', value: formatCurrency(ratios.current_assets, cu), status: 'N/A', formula: 'BS: Inv+Debtors+Cash+Other CA', healthy: 'Should exceed Current Liabilities' },
          { label: 'Current Liabilities', value: formatCurrency(ratios.current_liabilities, cu), status: 'N/A', formula: 'BS: ST Borr+Trade Payables+Other CL', healthy: 'Manageable vs CA' },
          { label: 'Working Capital', value: formatCurrency(ratios.working_capital, cu), status: st(ratios.working_capital, v => v > 0), formula: 'Current Assets – Current Liabilities', healthy: 'Positive' },
          { label: 'Current Ratio', value: formatX(ratios.current_ratio), status: st(ratios.current_ratio, v => v >= 1.5, v => v >= 1), formula: 'Current Assets / Current Liabilities', healthy: '1.33x–2.5x (Bank norm: >1.33x)' },
          { label: 'Quick Ratio', value: formatX(ratios.quick_ratio), status: st(ratios.quick_ratio, v => v >= 1, v => v >= 0.7), formula: '(CA – Inventory) / CL', healthy: '> 1.0x' },
          { label: 'Cash Ratio', value: formatX(ratios.cash_ratio), status: st(ratios.cash_ratio, v => v > 0.2, v => v > 0.1), formula: 'Cash / Current Liabilities', healthy: '> 0.2x' },
          { label: 'Cash Conv. Cycle', value: formatDays(ratios.cash_conversion_cycle), status: st(ratios.cash_conversion_cycle, v => v < 60, v => v < 90), formula: 'DSO + DIO – DPO', healthy: '< 60 days' },
        ],
        chartData: [
          { name: 'Current Ratio', value: n(ratios.current_ratio), benchmark: 1.5 },
          { name: 'Quick Ratio', value: n(ratios.quick_ratio), benchmark: 1.0 },
          { name: 'Cash Ratio', value: n(ratios.cash_ratio), benchmark: 0.2 },
        ],
        chartType: 'bar_benchmark',
      }

    case 'debt':
      return {
        title: '🏦 Debt & Loans',
        tiles: [
          { label: 'Total Debt', value: formatCurrency(ratios.total_debt, cu), status: 'N/A', tooltipKey: undefined },
          { label: 'D/E Ratio', value: formatX(ratios.debt_to_equity), status: st(ratios.debt_to_equity, v => v < 1, v => v < 3), tooltipKey: 'debt_to_equity' },
          { label: 'Debt Ratio', value: formatX(ratios.debt_ratio), status: st(ratios.debt_ratio, v => v < 0.5, v => v < 0.7), tooltipKey: undefined },
          { label: 'Interest Coverage', value: formatX(ratios.interest_coverage), status: st(ratios.interest_coverage, v => v > 3, v => v > 1.5), tooltipKey: 'interest_coverage' },
          { label: 'DSCR', value: formatX(ratios.dscr), status: st(ratios.dscr, v => v > 1.25, v => v > 1), tooltipKey: 'dscr' },
          { label: 'Net Debt/EBITDA', value: formatX(ratios.net_debt_to_ebitda), status: st(ratios.net_debt_to_ebitda, v => v < 2, v => v < 4), tooltipKey: undefined },
          { label: 'Equity Multiplier', value: formatX(ratios.equity_multiplier), status: st(ratios.equity_multiplier, v => v < 2, v => v < 4), tooltipKey: undefined },
        ],
        rows: [
          { label: 'Total Debt', value: formatCurrency(ratios.total_debt, cu), status: 'N/A', formula: 'LT Borrowings + ST Borr + CC/OD', healthy: 'Manageable vs EBITDA' },
          { label: 'D/E Ratio', value: formatX(ratios.debt_to_equity), status: st(ratios.debt_to_equity, v => v < 1, v => v < 3), formula: 'Total Debt / Shareholders Equity', healthy: '< 2.0x (bank norm)' },
          { label: 'Debt Ratio', value: formatX(ratios.debt_ratio), status: st(ratios.debt_ratio, v => v < 0.5, v => v < 0.7), formula: 'Total Debt / Total Assets', healthy: '< 0.5' },
          { label: 'Interest Coverage', value: formatX(ratios.interest_coverage), status: st(ratios.interest_coverage, v => v > 3, v => v > 1.5), formula: 'EBIT / Finance Costs', healthy: '> 3.0x' },
          { label: 'DSCR', value: formatX(ratios.dscr), status: st(ratios.dscr, v => v > 1.25, v => v > 1), formula: 'OCF / (Interest + Principal)', healthy: '> 1.25x (RBI norm)' },
          { label: 'Net Debt to EBITDA', value: formatX(ratios.net_debt_to_ebitda), status: st(ratios.net_debt_to_ebitda, v => v < 2, v => v < 4), formula: '(Total Debt – Cash) / EBITDA', healthy: '< 3.0x' },
          { label: 'Equity Multiplier', value: formatX(ratios.equity_multiplier), status: st(ratios.equity_multiplier, v => v < 2, v => v < 4), formula: 'Total Assets / Equity', healthy: '< 3.0x' },
        ],
        chartData: [
          { name: 'Total Debt', value: n(ratios.total_debt) },
          { name: "Shareholders' Equity", value: n(ratios.shareholders_equity) },
          { name: 'Total Assets', value: n(ratios.total_assets) },
        ],
        chartType: 'bar',
      }

    case 'efficiency':
      return {
        title: '⚙️ Efficiency Ratios',
        tiles: [
          { label: 'Asset Turnover', value: formatX(ratios.asset_turnover), status: st(ratios.asset_turnover, v => v > 1, v => v > 0.5), tooltipKey: 'asset_turnover' },
          { label: 'Inventory Turnover', value: formatX(ratios.inventory_turnover), status: st(ratios.inventory_turnover, v => v > 6, v => v > 3), tooltipKey: undefined },
          { label: 'Receivables Turnover', value: formatX(ratios.receivables_turnover), status: st(ratios.receivables_turnover, v => v > 8, v => v > 4), tooltipKey: undefined },
          { label: 'Fixed Asset Turnover', value: formatX(ratios.fixed_asset_turnover), status: st(ratios.fixed_asset_turnover, v => v > 2, v => v > 1), tooltipKey: undefined },
          { label: 'DSO (days)', value: formatDays(ratios.dso), status: st(ratios.dso, v => v < 45, v => v < 90), tooltipKey: 'dso' },
          { label: 'DPO (days)', value: formatDays(ratios.dpo), status: st(ratios.dpo, v => v < 60, v => v < 90), tooltipKey: 'dpo' },
          { label: 'DIO (days)', value: formatDays(ratios.dio), status: st(ratios.dio, v => v < 60, v => v < 90), tooltipKey: 'dio' },
        ],
        rows: [
          { label: 'Asset Turnover', value: formatX(ratios.asset_turnover), status: st(ratios.asset_turnover, v => v > 1, v => v > 0.5), formula: 'Revenue / Total Assets', healthy: '> 1.0x' },
          { label: 'Inventory Turnover', value: formatX(ratios.inventory_turnover), status: st(ratios.inventory_turnover, v => v > 6, v => v > 3), formula: 'COGS / Inventory', healthy: '> 6x' },
          { label: 'Receivables Turnover', value: formatX(ratios.receivables_turnover), status: st(ratios.receivables_turnover, v => v > 8, v => v > 4), formula: 'Revenue / Trade Receivables', healthy: '> 8x' },
          { label: 'Fixed Asset Turnover', value: formatX(ratios.fixed_asset_turnover), status: st(ratios.fixed_asset_turnover, v => v > 2, v => v > 1), formula: 'Revenue / Net Fixed Assets', healthy: '> 2.0x' },
          { label: 'DSO', value: formatDays(ratios.dso), status: st(ratios.dso, v => v < 45, v => v < 90), formula: '(Receivables / Revenue) × 365', healthy: '< 45 days' },
          { label: 'DPO', value: formatDays(ratios.dpo), status: st(ratios.dpo, v => v < 60, v => v < 90), formula: '(Payables / COGS) × 365', healthy: '30–60 days' },
          { label: 'DIO', value: formatDays(ratios.dio), status: st(ratios.dio, v => v < 60, v => v < 90), formula: '(Inventory / COGS) × 365', healthy: '< 60 days' },
          { label: 'Cash Conv. Cycle', value: formatDays(ratios.cash_conversion_cycle), status: st(ratios.cash_conversion_cycle, v => v < 60, v => v < 90), formula: 'DSO + DIO – DPO', healthy: '< 60 days' },
        ],
        chartData: [
          { name: 'DSO', value: n(ratios.dso), benchmark: 45 },
          { name: 'DPO', value: n(ratios.dpo), benchmark: 45 },
          { name: 'DIO', value: n(ratios.dio), benchmark: 60 },
          { name: 'CCC', value: n(ratios.cash_conversion_cycle), benchmark: 60 },
        ],
        chartType: 'bar_benchmark',
      }

    case 'cashflow':
      return {
        title: '💵 Cash Flow Analysis',
        tiles: [
          { label: 'Operating CF', value: formatCurrency(ratios.operating_cash_flow, cu), status: (ratios.operating_cash_flow ?? 0) > 0 ? 'Good' : 'Critical', tooltipKey: undefined },
          { label: 'Free Cash Flow', value: formatCurrency(ratios.free_cash_flow, cu), status: (ratios.free_cash_flow ?? 0) > 0 ? 'Good' : 'Watch', tooltipKey: undefined },
          { label: 'CF Margin', value: formatPct(ratios.cash_flow_margin), status: st(ratios.cash_flow_margin, v => v > 10, v => v > 5), tooltipKey: undefined },
          { label: 'CF to Debt', value: formatX(ratios.cash_flow_to_debt), status: st(ratios.cash_flow_to_debt, v => v > 0.2, v => v > 0.1), tooltipKey: undefined },
          { label: 'Capex Intensity', value: formatPct(ratios.capex_intensity), status: st(ratios.capex_intensity, v => v < 10, v => v < 20), tooltipKey: undefined },
        ],
        rows: [
          { label: 'Operating Cash Flow', value: formatCurrency(ratios.operating_cash_flow, cu), status: (ratios.operating_cash_flow ?? 0) > 0 ? 'Good' : 'Critical', formula: 'Cash Flow Statement (Indirect)', healthy: 'Positive, growing' },
          { label: 'Free Cash Flow', value: formatCurrency(ratios.free_cash_flow, cu), status: (ratios.free_cash_flow ?? 0) > 0 ? 'Good' : 'Watch', formula: 'OCF – Capex', healthy: 'Positive' },
          { label: 'CF to Debt Ratio', value: formatX(ratios.cash_flow_to_debt), status: st(ratios.cash_flow_to_debt, v => v > 0.2, v => v > 0.1), formula: 'OCF / Total Debt', healthy: '> 0.2x' },
          { label: 'Cash Flow Margin %', value: formatPct(ratios.cash_flow_margin), status: st(ratios.cash_flow_margin, v => v > 10, v => v > 5), formula: 'OCF / Revenue × 100', healthy: '> 10%' },
          { label: 'Capex Intensity %', value: formatPct(ratios.capex_intensity), status: st(ratios.capex_intensity, v => v < 10), formula: 'Capex / Revenue × 100', healthy: '< 10% (asset-light)' },
        ],
        chartData: [
          { name: 'Operating CF', value: n(ratios.operating_cash_flow) },
          { name: 'Free CF', value: n(ratios.free_cash_flow) },
        ],
        chartType: 'bar',
      }

    case 'compliance':
      const compData = [
        { area: 'GST', status: compliance.gst_status, risk: 'GST payable > 90d: 18% p.a. interest', action: 'Pay by 20th of each month' },
        { area: 'TDS/TCS', status: compliance.tds_status, risk: 'Default: 1.5%/month interest + penalty', action: 'Deposit by 7th monthly, file quarterly' },
        { area: 'PF/ESI/PT', status: compliance.pf_esi_status, risk: 'Late deposit: 12-18% p.a. interest', action: 'Set up auto-debit by 15th monthly' },
        { area: 'MSME (>45d)', status: compliance.msme_overdue ? 'Critical' : 'OK', risk: 'MSMED Act: mandatory disclosure + ITR disallowance', action: 'Pay MSME vendors within 45 days' },
        { area: 'IBC Risk', status: compliance.ibc_risk ? 'Critical' : 'OK', risk: 'Creditor >₹1Cr overdue = insolvency petition risk', action: 'Negotiate OTS / settlement immediately' },
        { area: 'ROC Filing', status: compliance.roc_status, risk: '₹100/day penalty + director disqualification', action: 'File MGT-7 & AOC-4 within 60 days of AGM' },
      ]
      return {
        title: '✅ Indian Compliance Health',
        tiles: compData.map(d => ({
          label: d.area,
          value: d.status === 'OK' ? '✓ OK' : d.status === 'Warning' ? '⚠ Warning' : d.status === 'Critical' ? '✗ Critical' : d.status,
          status: d.status === 'OK' ? 'Good' : d.status === 'Warning' ? 'Watch' : d.status === 'Critical' ? 'Critical' : 'N/A',
          tooltipKey: undefined,
        })),
        rows: compData.map(d => ({
          label: d.area,
          value: d.status,
          status: d.status === 'OK' ? 'Good' : d.status === 'Warning' ? 'Watch' : d.status === 'Critical' ? 'Critical' : 'N/A',
          formula: d.risk,
          healthy: d.action,
        })),
        chartData: [],
        chartType: 'none',
      }

    default:
      return {
        title: `📊 ${section}`,
        tiles: [],
        rows: [],
        chartData: [],
        chartType: 'none',
      }
  }
}

export default function SectionPage() {
  const params = useParams()
  const section = params?.section as string || 'income'
  const { report } = useAppStore()

  if (!report) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <h2>No data</h2>
        <a href="/upload" style={{ color: '#3D5A80' }}>Enter data first →</a>
      </div>
    )
  }

  const content = buildSectionContent(section, report.ratios, report.compliance, report.currency_unit)

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/dashboard" style={{ fontSize: 13, color: '#3D5A80', textDecoration: 'none' }}>← Dashboard</a>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>{content.title}</h1>
        <p style={{ fontSize: 13, color: '#6B6560', margin: 0 }}>{report.company_name} · {report.financial_year}</p>
      </div>

      {/* Hero tiles */}
      {content.tiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {content.tiles.map((t, i) => (
            <MetricTile key={i} {...t} />
          ))}
        </div>
      )}

      {/* Chart */}
      {content.chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-header">Chart View</div>
          <ResponsiveContainer width="100%" height={240}>
            {content.chartType === 'bar_benchmark' ? (
              <BarChart data={content.chartData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartTooltip />
                <Bar dataKey="value" fill="#3D5A80" radius={[4, 4, 0, 0]} />
                <Bar dataKey="benchmark" fill="#E4E2DC" radius={[4, 4, 0, 0]} name="Benchmark" />
              </BarChart>
            ) : (
              <BarChart data={content.chartData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartTooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {content.chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.value >= 0 ? '#3D5A80' : '#F87171'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed ratio table */}
      {content.rows.length > 0 && (
        <div className="card">
          <div className="section-header">Detailed Breakdown</div>
          <RatioTable rows={content.rows} />
        </div>
      )}
    </div>
  )
}
