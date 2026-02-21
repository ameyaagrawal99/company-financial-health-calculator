'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { calculateFinancials } from '@/lib/api'
import { FinancialStatement, BalanceSheet, ProfitLoss, CashFlow, CurrencyUnit } from '@/lib/types'

type Section = 'meta' | 'bs_assets' | 'bs_liab' | 'pl' | 'cf' | 'compliance'

const FIELD_LABELS: Record<string, string> = {
  // Balance Sheet Assets
  fixed_assets: 'Fixed Assets (Net Block)',
  cwip: 'CWIP',
  lt_investments: 'LT Investments',
  dta: 'Deferred Tax Asset',
  lt_loans_advances: 'LT Loans & Advances',
  inventory: 'Inventory',
  trade_receivables: 'Trade Receivables (Debtors)',
  cash_and_equivalents: 'Cash & Equivalents',
  st_loans_advances: 'ST Loans & Advances',
  gst_itc_receivable: 'GST ITC Receivable',
  tds_receivable: 'TDS Receivable',
  other_current_assets: 'Other Current Assets',
  // Balance Sheet Liabilities
  share_capital: 'Share Capital',
  reserves_surplus: 'Reserves & Surplus',
  lt_borrowings: 'LT Borrowings (Term Loans)',
  dtl: 'Deferred Tax Liability',
  lt_provisions: 'LT Provisions',
  st_borrowings: 'ST Borrowings',
  cc_od_facilities: 'CC / OD Facilities',
  trade_payables: 'Trade Payables (Creditors)',
  gst_payable: 'GST Payable',
  tds_payable: 'TDS Payable',
  pf_esi_pt_payable: 'PF / ESI / PT Payable',
  customer_advances: 'Customer Advances',
  other_current_liabilities: 'Other Current Liabilities',
  msme_payable_overdue: 'MSME Overdue (>45 days)',
  number_of_shares: 'Number of Shares',
  // P&L
  revenue_from_operations: 'Revenue from Operations',
  other_income: 'Other Income',
  raw_materials: 'Raw Materials Consumed',
  purchases: 'Purchases of Stock-in-Trade',
  change_in_inventory: 'Change in Inventory',
  employee_benefits: 'Employee Benefit Expenses',
  finance_costs: 'Finance Costs (Interest)',
  depreciation: 'Depreciation & Amortization',
  other_expenses: 'Other Expenses',
  tax_expense: 'Tax Expense',
  // Cash Flow
  operating_cash_flow: 'Operating Cash Flow',
  investing_cash_flow: 'Investing Cash Flow',
  financing_cash_flow: 'Financing Cash Flow',
  capex: 'Capital Expenditure (Capex)',
  opening_cash: 'Opening Cash Balance',
  closing_cash: 'Closing Cash Balance',
}

const FIELD_NOTES: Record<string, string> = {
  revenue_from_operations: 'Core business revenue, exclude other income',
  trade_receivables: 'Total outstanding debtors',
  inventory: 'Raw materials + WIP + Finished goods',
  lt_borrowings: 'Bank term loans, bonds, debentures >1 year',
  cc_od_facilities: 'Cash credit, overdraft — current portion',
  pf_esi_pt_payable: 'Statutory dues — PF, ESI, Professional Tax',
  msme_payable_overdue: 'Disclosure required under MSMED Act',
  operating_cash_flow: 'From cash flow statement (indirect method)',
  capex: 'Purchase of fixed assets (usually negative)',
  change_in_inventory: 'Positive = stock decreased (reduction adds to profit)',
}

function NumInput({ field, value, onChange }: { field: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1C1917', marginBottom: 4 }}>
        {FIELD_LABELS[field] || field}
        {FIELD_NOTES[field] && <span style={{ fontWeight: 400, color: '#6B6560', marginLeft: 6 }}>— {FIELD_NOTES[field]}</span>}
      </label>
      <input
        type="number"
        step="0.01"
        placeholder="0.00"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #E4E2DC',
          borderRadius: 8,
          fontSize: 14,
          background: '#FFFFFF',
          outline: 'none',
          color: '#1C1917',
        }}
      />
    </div>
  )
}

function SectionPanel({ title, icon, open, onToggle, children }: any) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: '#1C1917' }}>
          <span>{icon}</span> {title}
        </div>
        {open ? <ChevronDown size={18} color="#6B6560" /> : <ChevronRight size={18} color="#6B6560" />}
      </div>
      {open && <div style={{ marginTop: 16, borderTop: '1px solid #E4E2DC', paddingTop: 16 }}>{children}</div>}
    </div>
  )
}

export default function UploadPage() {
  const router = useRouter()
  const { setStatement, setReport, setLoading, setError } = useAppStore()

  const [meta, setMeta] = useState({ company_name: '', financial_year: 'FY 2024-25', currency_unit: 'lakhs' as CurrencyUnit })
  const [bs, setBs] = useState<Partial<BalanceSheet>>({})
  const [pl, setPl] = useState<Partial<ProfitLoss>>({})
  const [cf, setCf] = useState<Partial<CashFlow>>({})
  const [comp, setComp] = useState({ roc_filed: undefined as boolean | undefined, ibc_overdue: undefined as number | undefined })

  const [openSections, setOpenSections] = useState<Record<Section, boolean>>({
    meta: true,
    bs_assets: true,
    bs_liab: true,
    pl: true,
    cf: false,
    compliance: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggle = (s: Section) => setOpenSections(p => ({ ...p, [s]: !p[s] }))

  const bsField = (key: keyof BalanceSheet) => ({
    field: key,
    value: bs[key] as number | undefined,
    onChange: (v: number | undefined) => setBs(p => ({ ...p, [key]: v }))
  })

  const plField = (key: keyof ProfitLoss) => ({
    field: key,
    value: pl[key] as number | undefined,
    onChange: (v: number | undefined) => setPl(p => ({ ...p, [key]: v }))
  })

  const cfField = (key: keyof CashFlow) => ({
    field: key,
    value: cf[key] as number | undefined,
    onChange: (v: number | undefined) => setCf(p => ({ ...p, [key]: v }))
  })

  const handleCalculate = async () => {
    if (!pl.revenue_from_operations) {
      alert('Please enter at least Revenue from Operations to calculate.')
      return
    }
    setIsSubmitting(true)
    const stmt: FinancialStatement = {
      company_name: meta.company_name || 'Your Company',
      financial_year: meta.financial_year,
      currency_unit: meta.currency_unit,
      balance_sheet: Object.keys(bs).length ? bs as BalanceSheet : undefined,
      profit_loss: Object.keys(pl).length ? pl as ProfitLoss : undefined,
      cash_flow: Object.keys(cf).length ? cf as CashFlow : undefined,
      roc_filed: comp.roc_filed,
      ibc_overdue_amount: comp.ibc_overdue,
    }
    try {
      setStatement(stmt)
      setLoading(true)
      const report = await calculateFinancials(stmt)
      setReport(report)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
      setLoading(false)
    }
  }

  const cu = meta.currency_unit === 'crores' ? 'Crores' : meta.currency_unit === 'lakhs' ? 'Lakhs' : meta.currency_unit

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <a href="/" style={{ fontSize: 13, color: '#3D5A80', textDecoration: 'none' }}>← Home</a>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '12px 0 4px' }}>Enter Financial Data</h1>
        <p style={{ fontSize: 14, color: '#6B6560', margin: 0 }}>
          Fill in what you have — all fields are optional. More data = more accurate health score.
          All values in ₹ {cu} unless noted.
        </p>
      </div>

      {/* Meta */}
      <SectionPanel title="Company Information" icon="🏢" open={openSections.meta} onToggle={() => toggle('meta')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1C1917', display: 'block', marginBottom: 4 }}>Company Name</label>
            <input
              value={meta.company_name}
              onChange={e => setMeta(p => ({ ...p, company_name: e.target.value }))}
              placeholder="e.g. Sharma Textiles Pvt Ltd"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, color: '#1C1917' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1C1917', display: 'block', marginBottom: 4 }}>Financial Year</label>
            <select
              value={meta.financial_year}
              onChange={e => setMeta(p => ({ ...p, financial_year: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, color: '#1C1917', background: '#fff' }}
            >
              {['FY 2024-25', 'FY 2023-24', 'FY 2022-23', 'FY 2021-22', 'FY 2020-21'].map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1C1917', display: 'block', marginBottom: 4 }}>Currency Unit</label>
            <select
              value={meta.currency_unit}
              onChange={e => setMeta(p => ({ ...p, currency_unit: e.target.value as CurrencyUnit }))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, color: '#1C1917', background: '#fff' }}
            >
              <option value="lakhs">₹ Lakhs (L)</option>
              <option value="crores">₹ Crores (Cr)</option>
              <option value="thousands">₹ Thousands</option>
              <option value="units">₹ Units (actual)</option>
            </select>
          </div>
        </div>
      </SectionPanel>

      {/* BS Assets */}
      <SectionPanel title="Balance Sheet — Assets" icon="📊" open={openSections.bs_assets} onToggle={() => toggle('bs_assets')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3D5A80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Non-Current Assets</div>
            {(['fixed_assets', 'cwip', 'lt_investments', 'dta', 'lt_loans_advances'] as (keyof BalanceSheet)[]).map(k => (
              <NumInput key={k} {...bsField(k)} />
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3D5A80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Current Assets</div>
            {(['inventory', 'trade_receivables', 'cash_and_equivalents', 'st_loans_advances', 'gst_itc_receivable', 'tds_receivable', 'other_current_assets'] as (keyof BalanceSheet)[]).map(k => (
              <NumInput key={k} {...bsField(k)} />
            ))}
          </div>
        </div>
      </SectionPanel>

      {/* BS Liabilities */}
      <SectionPanel title="Balance Sheet — Equity & Liabilities" icon="📉" open={openSections.bs_liab} onToggle={() => toggle('bs_liab')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3D5A80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Equity & LT Liabilities</div>
            {(['share_capital', 'reserves_surplus', 'lt_borrowings', 'dtl', 'lt_provisions'] as (keyof BalanceSheet)[]).map(k => (
              <NumInput key={k} {...bsField(k)} />
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3D5A80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Current Liabilities</div>
            {(['st_borrowings', 'cc_od_facilities', 'trade_payables', 'gst_payable', 'tds_payable', 'pf_esi_pt_payable', 'customer_advances', 'other_current_liabilities', 'msme_payable_overdue'] as (keyof BalanceSheet)[]).map(k => (
              <NumInput key={k} {...bsField(k)} />
            ))}
          </div>
        </div>
      </SectionPanel>

      {/* P&L */}
      <SectionPanel title="Profit & Loss Statement" icon="📈" open={openSections.pl} onToggle={() => toggle('pl')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3D5A80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Income</div>
            {(['revenue_from_operations', 'other_income'] as (keyof ProfitLoss)[]).map(k => (
              <NumInput key={k} {...plField(k)} />
            ))}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9A3412', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, marginTop: 16 }}>Costs & Expenses</div>
            {(['raw_materials', 'purchases', 'change_in_inventory', 'employee_benefits', 'finance_costs', 'depreciation', 'other_expenses', 'tax_expense'] as (keyof ProfitLoss)[]).map(k => (
              <NumInput key={k} {...plField(k)} />
            ))}
          </div>
          <div style={{ background: '#F8F7F4', borderRadius: 10, padding: '16px', alignSelf: 'start' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1C1917', marginBottom: 12 }}>📖 How to find these values</div>
            {[
              ['Revenue from Operations', 'Schedule III Part II — Line 1 or 2'],
              ['Raw Materials', 'Cost of materials consumed (Schedule of manufacturing costs)'],
              ['Employee Benefits', 'Salaries + PF + ESOP + gratuity'],
              ['Finance Costs', 'Interest on borrowings, bank charges'],
              ['Other Expenses', 'Admin + selling + marketing'],
              ['Tax Expense', 'Current tax + deferred tax (net)'],
            ].map(([k, v]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#3D5A80' }}>{k}</div>
                <div style={{ fontSize: 11, color: '#6B6560' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionPanel>

      {/* Cash Flow */}
      <SectionPanel title="Cash Flow Statement (Optional)" icon="💵" open={openSections.cf} onToggle={() => toggle('cf')}>
        <p style={{ fontSize: 13, color: '#6B6560', marginTop: 0, marginBottom: 16 }}>
          If you don't have a cash flow statement, we'll estimate from the P&L. Provide if available for more accurate DSCR and FCF calculations.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['operating_cash_flow', 'investing_cash_flow', 'financing_cash_flow', 'capex', 'opening_cash', 'closing_cash'] as (keyof CashFlow)[]).map(k => (
            <NumInput key={k} {...cfField(k)} />
          ))}
        </div>
      </SectionPanel>

      {/* Compliance */}
      <SectionPanel title="Compliance Inputs (Optional)" icon="✅" open={openSections.compliance} onToggle={() => toggle('compliance')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1C1917', display: 'block', marginBottom: 4 }}>ROC Annual Return Filed?</label>
            <select
              value={comp.roc_filed === undefined ? '' : comp.roc_filed ? 'yes' : 'no'}
              onChange={e => setComp(p => ({ ...p, roc_filed: e.target.value === '' ? undefined : e.target.value === 'yes' }))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, color: '#1C1917', background: '#fff' }}
            >
              <option value="">Not sure</option>
              <option value="yes">Yes — Filed</option>
              <option value="no">No — Not Filed</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1C1917', display: 'block', marginBottom: 4 }}>
              IBC Overdue Amount (₹ L) <span style={{ fontWeight: 400, color: '#6B6560' }}>— any single creditor overdue ≥ ₹1Cr?</span>
            </label>
            <input
              type="number"
              value={comp.ibc_overdue ?? ''}
              onChange={e => setComp(p => ({ ...p, ibc_overdue: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
              placeholder="0 = No risk"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, color: '#1C1917' }}
            />
          </div>
        </div>
      </SectionPanel>

      {/* Submit */}
      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button
          onClick={handleCalculate}
          disabled={isSubmitting}
          style={{
            flex: 1,
            background: isSubmitting ? '#6B6560' : '#3D5A80',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '14px 24px',
            fontWeight: 700,
            fontSize: 15,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {isSubmitting ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Calculating...</> : '⚡ Calculate Financial Health →'}
        </button>
      </div>

      <p style={{ fontSize: 12, color: '#6B6560', textAlign: 'center', marginTop: 12 }}>
        Requires at least Revenue from Operations. All other fields improve accuracy.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  )
}
