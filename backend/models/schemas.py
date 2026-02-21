from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum


class CurrencyUnit(str, Enum):
    units = "units"
    thousands = "thousands"
    lakhs = "lakhs"
    crores = "crores"


class StatusEnum(str, Enum):
    ok = "OK"
    warning = "Warning"
    critical = "Critical"
    na = "N/A"


class PriorityEnum(str, Enum):
    critical = "Critical"
    watch = "Watch"
    positive = "Positive"


class BalanceSheet(BaseModel):
    # Fixed Assets
    fixed_assets: Optional[float] = None
    cwip: Optional[float] = None
    lt_investments: Optional[float] = None
    dta: Optional[float] = None
    lt_loans_advances: Optional[float] = None
    # Current Assets
    inventory: Optional[float] = None
    trade_receivables: Optional[float] = None
    cash_and_equivalents: Optional[float] = None
    st_loans_advances: Optional[float] = None
    gst_itc_receivable: Optional[float] = None
    tds_receivable: Optional[float] = None
    other_current_assets: Optional[float] = None
    # Equity
    share_capital: Optional[float] = None
    reserves_surplus: Optional[float] = None
    # Long-term Liabilities
    lt_borrowings: Optional[float] = None
    dtl: Optional[float] = None
    lt_provisions: Optional[float] = None
    # Current Liabilities
    st_borrowings: Optional[float] = None
    cc_od_facilities: Optional[float] = None
    trade_payables: Optional[float] = None
    gst_payable: Optional[float] = None
    tds_payable: Optional[float] = None
    pf_esi_pt_payable: Optional[float] = None
    customer_advances: Optional[float] = None
    other_current_liabilities: Optional[float] = None
    msme_payable_overdue: Optional[float] = None
    number_of_shares: Optional[float] = None


class ProfitLoss(BaseModel):
    revenue_from_operations: Optional[float] = None
    other_income: Optional[float] = None
    raw_materials: Optional[float] = None
    purchases: Optional[float] = None
    change_in_inventory: Optional[float] = None
    employee_benefits: Optional[float] = None
    finance_costs: Optional[float] = None
    depreciation: Optional[float] = None
    other_expenses: Optional[float] = None
    tax_expense: Optional[float] = None


class CashFlow(BaseModel):
    operating_cash_flow: Optional[float] = None
    investing_cash_flow: Optional[float] = None
    financing_cash_flow: Optional[float] = None
    capex: Optional[float] = None
    opening_cash: Optional[float] = None
    closing_cash: Optional[float] = None


class FinancialStatement(BaseModel):
    company_name: Optional[str] = "Your Company"
    financial_year: Optional[str] = "FY 2024-25"
    currency_unit: Optional[CurrencyUnit] = CurrencyUnit.lakhs
    balance_sheet: Optional[BalanceSheet] = None
    profit_loss: Optional[ProfitLoss] = None
    cash_flow: Optional[CashFlow] = None
    roc_filed: Optional[bool] = None
    ibc_overdue_amount: Optional[float] = None


class Recommendation(BaseModel):
    priority: PriorityEnum
    category: str
    finding: str
    impact: str
    action: str


class ComplianceStatus(BaseModel):
    gst_status: StatusEnum = StatusEnum.na
    tds_status: StatusEnum = StatusEnum.na
    pf_esi_status: StatusEnum = StatusEnum.na
    msme_overdue: bool = False
    ibc_risk: bool = False
    roc_status: StatusEnum = StatusEnum.na


class SubScores(BaseModel):
    profitability: float = 0
    liquidity: float = 0
    leverage: float = 0
    efficiency: float = 0
    cash_flow: float = 0
    compliance: float = 0


class FinancialRatios(BaseModel):
    # Profitability
    gross_margin: Optional[float] = None
    net_profit_margin: Optional[float] = None
    ebitda_margin: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    roce: Optional[float] = None
    eps: Optional[float] = None
    operating_profit_margin: Optional[float] = None
    # Liquidity
    current_ratio: Optional[float] = None
    quick_ratio: Optional[float] = None
    cash_ratio: Optional[float] = None
    working_capital: Optional[float] = None
    cash_conversion_cycle: Optional[float] = None
    # Efficiency
    dso: Optional[float] = None
    dpo: Optional[float] = None
    dio: Optional[float] = None
    asset_turnover: Optional[float] = None
    inventory_turnover: Optional[float] = None
    receivables_turnover: Optional[float] = None
    fixed_asset_turnover: Optional[float] = None
    # Leverage
    debt_to_equity: Optional[float] = None
    debt_ratio: Optional[float] = None
    interest_coverage: Optional[float] = None
    dscr: Optional[float] = None
    net_debt_to_ebitda: Optional[float] = None
    equity_multiplier: Optional[float] = None
    # Cash Flow
    operating_cash_flow: Optional[float] = None
    free_cash_flow: Optional[float] = None
    cash_flow_to_debt: Optional[float] = None
    cash_flow_margin: Optional[float] = None
    capex_intensity: Optional[float] = None
    # Derived
    revenue: Optional[float] = None
    gross_profit: Optional[float] = None
    ebitda: Optional[float] = None
    ebit: Optional[float] = None
    net_profit: Optional[float] = None
    total_assets: Optional[float] = None
    total_debt: Optional[float] = None
    shareholders_equity: Optional[float] = None
    current_assets: Optional[float] = None
    current_liabilities: Optional[float] = None
    cogs: Optional[float] = None
    total_costs: Optional[float] = None
    cost_to_revenue: Optional[float] = None
    largest_cost_head: Optional[str] = None


class FinancialHealthReport(BaseModel):
    company_name: str
    financial_year: str
    currency_unit: str
    health_score: float
    score_band: str
    sub_scores: SubScores
    ratios: FinancialRatios
    compliance: ComplianceStatus
    recommendations: List[Recommendation]
    missing_fields: List[str] = []
    balance_sheet_balanced: Optional[bool] = None
    balance_sheet_diff: Optional[float] = None


class MappingRequest(BaseModel):
    raw_columns: List[str]
    data_preview: List[Dict[str, Any]]
    detected_type: Optional[str] = None
    confidence: Optional[float] = None


class ParsedFileResponse(BaseModel):
    sheets: List[str]
    detected_type: str
    confidence: float
    columns: List[str]
    preview: List[Dict[str, Any]]
    mapping_suggestions: Dict[str, str]
    financial_year: Optional[str] = None
    currency_unit: Optional[str] = None
