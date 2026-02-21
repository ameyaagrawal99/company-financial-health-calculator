export type CurrencyUnit = 'units' | 'thousands' | 'lakhs' | 'crores'
export type ScoreBand = 'Excellent' | 'Good' | 'Moderate' | 'Stressed' | 'Critical'
export type StatusEnum = 'OK' | 'Warning' | 'Critical' | 'N/A'
export type Priority = 'Critical' | 'Watch' | 'Positive'

export interface BalanceSheet {
  fixed_assets?: number
  cwip?: number
  lt_investments?: number
  dta?: number
  lt_loans_advances?: number
  inventory?: number
  trade_receivables?: number
  cash_and_equivalents?: number
  st_loans_advances?: number
  gst_itc_receivable?: number
  tds_receivable?: number
  other_current_assets?: number
  share_capital?: number
  reserves_surplus?: number
  lt_borrowings?: number
  dtl?: number
  lt_provisions?: number
  st_borrowings?: number
  cc_od_facilities?: number
  trade_payables?: number
  gst_payable?: number
  tds_payable?: number
  pf_esi_pt_payable?: number
  customer_advances?: number
  other_current_liabilities?: number
  msme_payable_overdue?: number
  number_of_shares?: number
}

export interface ProfitLoss {
  revenue_from_operations?: number
  other_income?: number
  raw_materials?: number
  purchases?: number
  change_in_inventory?: number
  employee_benefits?: number
  finance_costs?: number
  depreciation?: number
  other_expenses?: number
  tax_expense?: number
}

export interface CashFlow {
  operating_cash_flow?: number
  investing_cash_flow?: number
  financing_cash_flow?: number
  capex?: number
  opening_cash?: number
  closing_cash?: number
}

export interface FinancialStatement {
  company_name?: string
  financial_year?: string
  currency_unit?: CurrencyUnit
  balance_sheet?: BalanceSheet
  profit_loss?: ProfitLoss
  cash_flow?: CashFlow
  roc_filed?: boolean
  ibc_overdue_amount?: number
}

export interface SubScores {
  profitability: number
  liquidity: number
  leverage: number
  efficiency: number
  cash_flow: number
  compliance: number
}

export interface FinancialRatios {
  gross_margin?: number
  net_profit_margin?: number
  ebitda_margin?: number
  roe?: number
  roa?: number
  roce?: number
  eps?: number
  operating_profit_margin?: number
  current_ratio?: number
  quick_ratio?: number
  cash_ratio?: number
  working_capital?: number
  cash_conversion_cycle?: number
  dso?: number
  dpo?: number
  dio?: number
  asset_turnover?: number
  inventory_turnover?: number
  receivables_turnover?: number
  fixed_asset_turnover?: number
  debt_to_equity?: number
  debt_ratio?: number
  interest_coverage?: number
  dscr?: number
  net_debt_to_ebitda?: number
  equity_multiplier?: number
  operating_cash_flow?: number
  free_cash_flow?: number
  cash_flow_to_debt?: number
  cash_flow_margin?: number
  capex_intensity?: number
  revenue?: number
  gross_profit?: number
  ebitda?: number
  ebit?: number
  net_profit?: number
  total_assets?: number
  total_debt?: number
  shareholders_equity?: number
  current_assets?: number
  current_liabilities?: number
  cogs?: number
  total_costs?: number
  cost_to_revenue?: number
  largest_cost_head?: string
}

export interface ComplianceStatus {
  gst_status: StatusEnum
  tds_status: StatusEnum
  pf_esi_status: StatusEnum
  msme_overdue: boolean
  ibc_risk: boolean
  roc_status: StatusEnum
}

export interface Recommendation {
  priority: Priority
  category: string
  finding: string
  impact: string
  action: string
}

export interface FinancialHealthReport {
  company_name: string
  financial_year: string
  currency_unit: string
  health_score: number
  score_band: ScoreBand
  sub_scores: SubScores
  ratios: FinancialRatios
  compliance: ComplianceStatus
  recommendations: Recommendation[]
  missing_fields: string[]
  balance_sheet_balanced?: boolean
  balance_sheet_diff?: number
}
