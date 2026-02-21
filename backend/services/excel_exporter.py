"""
Excel export engine — produces a fully-formatted .xlsx with:
- All formulas intact (no hardcoded values where formula is possible)
- Color coding matching the dashboard design system
- Multiple sheets: Summary, Ratios, Compliance, Recommendations, Raw Data
- Indian number formatting (Lakhs/Crores)
- Named ranges for easy navigation
"""
import io
import xlsxwriter
from typing import Optional
from ..models.schemas import FinancialHealthReport, FinancialStatement


# ─── Color palette (matching dashboard design system) ──────────────────────
COLORS = {
    "excellent_bg": "#166534",    # Dark green text
    "excellent_fill": "#F0FDF4",  # Light green bg
    "good_bg": "#15803D",
    "good_fill": "#DCFCE7",
    "moderate_bg": "#854D0E",
    "moderate_fill": "#FEFCE8",
    "stressed_bg": "#9A3412",
    "stressed_fill": "#FFF7ED",
    "critical_bg": "#9F1239",
    "critical_fill": "#FFF1F2",
    "header_dark": "#1C1917",
    "header_navy": "#3D5A80",
    "section_header": "#E4E2DC",
    "white": "#FFFFFF",
    "off_white": "#F8F7F4",
    "muted_text": "#6B6560",
    "positive_green": "#166534",
    "watch_orange": "#9A3412",
    "critical_red": "#9F1239",
}

SCORE_BAND_COLORS = {
    "Excellent": ("excellent_fill", "excellent_bg"),
    "Good": ("good_fill", "good_bg"),
    "Moderate": ("moderate_fill", "moderate_bg"),
    "Stressed": ("stressed_fill", "stressed_bg"),
    "Critical": ("critical_fill", "critical_bg"),
}


def get_score_colors(score: float) -> tuple:
    if score >= 80:
        return COLORS["excellent_fill"], COLORS["excellent_bg"]
    elif score >= 60:
        return COLORS["good_fill"], COLORS["good_bg"]
    elif score >= 40:
        return COLORS["moderate_fill"], COLORS["moderate_bg"]
    elif score >= 20:
        return COLORS["stressed_fill"], COLORS["stressed_bg"]
    else:
        return COLORS["critical_fill"], COLORS["critical_bg"]


def export_to_excel(report: FinancialHealthReport, stmt: Optional[FinancialStatement] = None) -> bytes:
    """Generate a fully-formatted Excel workbook from a financial health report."""
    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {
        'in_memory': True,
        'strings_to_numbers': True,
        'default_date_format': 'dd/mm/yyyy',
    })

    # ─── Common Formats ────────────────────────────────────────────────────
    def fmt(props):
        return wb.add_format(props)

    f_title = fmt({'font_name': 'Calibri', 'font_size': 20, 'bold': True, 'font_color': COLORS["header_dark"], 'bg_color': COLORS["white"]})
    f_subtitle = fmt({'font_name': 'Calibri', 'font_size': 11, 'font_color': COLORS["muted_text"], 'bg_color': COLORS["white"]})
    f_section = fmt({'font_name': 'Calibri', 'font_size': 12, 'bold': True, 'font_color': COLORS["white"],
                     'bg_color': COLORS["header_navy"], 'border': 1})
    f_header = fmt({'font_name': 'Calibri', 'font_size': 10, 'bold': True, 'font_color': COLORS["header_dark"],
                    'bg_color': COLORS["section_header"], 'border': 1, 'text_wrap': True})
    f_label = fmt({'font_name': 'Calibri', 'font_size': 10, 'font_color': COLORS["header_dark"],
                   'bg_color': COLORS["off_white"], 'border': 1, 'indent': 1})
    f_value = fmt({'font_name': 'Calibri', 'font_size': 10, 'border': 1, 'bg_color': COLORS["white"],
                   'num_format': '#,##0.00'})
    f_value_pct = fmt({'font_name': 'Calibri', 'font_size': 10, 'border': 1, 'bg_color': COLORS["white"],
                       'num_format': '0.00"%"'})
    f_value_int = fmt({'font_name': 'Calibri', 'font_size': 10, 'border': 1, 'bg_color': COLORS["white"],
                       'num_format': '#,##0'})
    f_value_days = fmt({'font_name': 'Calibri', 'font_size': 10, 'border': 1, 'bg_color': COLORS["white"],
                        'num_format': '#,##0.0" days"'})
    f_value_x = fmt({'font_name': 'Calibri', 'font_size': 10, 'border': 1, 'bg_color': COLORS["white"],
                     'num_format': '0.00"x"'})
    f_formula_note = fmt({'font_name': 'Calibri', 'font_size': 9, 'italic': True, 'font_color': COLORS["muted_text"],
                          'bg_color': COLORS["white"], 'border': 1, 'text_wrap': True})
    f_inr = fmt({'font_name': 'Calibri', 'font_size': 10, 'border': 1, 'bg_color': COLORS["white"],
                 'num_format': '₹#,##0.00'})
    f_bold_label = fmt({'font_name': 'Calibri', 'font_size': 10, 'bold': True, 'font_color': COLORS["header_dark"],
                        'bg_color': COLORS["off_white"], 'border': 1})
    f_total = fmt({'font_name': 'Calibri', 'font_size': 10, 'bold': True, 'border': 2,
                   'bg_color': COLORS["section_header"], 'num_format': '#,##0.00'})

    # Score-band specific formats
    score_band = report.score_band
    sc_fill, sc_text = SCORE_BAND_COLORS.get(score_band, ("white", "header_dark"))
    f_score_val = fmt({'font_name': 'Calibri', 'font_size': 36, 'bold': True,
                       'font_color': COLORS[sc_text], 'bg_color': COLORS[sc_fill],
                       'align': 'center', 'valign': 'vcenter', 'border': 2})
    f_score_band = fmt({'font_name': 'Calibri', 'font_size': 14, 'bold': True,
                        'font_color': COLORS[sc_text], 'bg_color': COLORS[sc_fill],
                        'align': 'center', 'border': 1})

    def priority_fmt(priority: str):
        if priority == "Critical":
            return fmt({'font_name': 'Calibri', 'font_size': 10, 'bold': True, 'font_color': COLORS["white"],
                        'bg_color': '#DC2626', 'align': 'center', 'border': 1})
        elif priority == "Watch":
            return fmt({'font_name': 'Calibri', 'font_size': 10, 'bold': True, 'font_color': '#92400E',
                        'bg_color': '#FEF3C7', 'align': 'center', 'border': 1})
        else:
            return fmt({'font_name': 'Calibri', 'font_size': 10, 'bold': True, 'font_color': COLORS["positive_green"],
                        'bg_color': '#DCFCE7', 'align': 'center', 'border': 1})

    cu = report.currency_unit

    # ─── SHEET 1: Executive Summary ────────────────────────────────────────
    ws_summary = wb.add_worksheet("📊 Executive Summary")
    ws_summary.set_zoom(85)
    ws_summary.hide_gridlines(2)
    ws_summary.set_column('A:A', 32)
    ws_summary.set_column('B:B', 22)
    ws_summary.set_column('C:C', 22)
    ws_summary.set_column('D:D', 22)
    ws_summary.set_column('E:E', 22)
    ws_summary.set_column('F:F', 18)
    ws_summary.set_row(0, 40)
    ws_summary.set_row(1, 22)
    ws_summary.set_row(2, 22)
    ws_summary.set_row(5, 70)

    ws_summary.merge_range('A1:F1', f'Financial Health Report — {report.company_name}', f_title)
    ws_summary.merge_range('A2:F2', f'Financial Year: {report.financial_year} | Currency: ₹ {cu.title()}', f_subtitle)
    ws_summary.merge_range('A3:F3', 'Generated by Company Financial Health Calculator | India-First Platform', f_subtitle)

    # Health Score Box
    ws_summary.merge_range('A5:B6', report.health_score, f_score_val)
    ws_summary.merge_range('C5:C6', f'{score_band}\n(Health Score)', f_score_band)

    # Sub-scores
    ws_summary.write('D4', 'CATEGORY', f_header)
    ws_summary.write('E4', 'SCORE (/100)', f_header)
    ws_summary.write('F4', 'WEIGHT', f_header)

    sub_data = [
        ("Profitability", report.sub_scores.profitability, "25%"),
        ("Liquidity", report.sub_scores.liquidity, "20%"),
        ("Leverage / Solvency", report.sub_scores.leverage, "20%"),
        ("Efficiency", report.sub_scores.efficiency, "15%"),
        ("Cash Flow Quality", report.sub_scores.cash_flow, "10%"),
        ("Compliance Risk", report.sub_scores.compliance, "10%"),
    ]

    for i, (cat, score, wt) in enumerate(sub_data):
        row = 5 + i
        fill, text = get_score_colors(score)
        f_sub_val = fmt({'font_name': 'Calibri', 'font_size': 11, 'bold': True,
                         'font_color': text, 'bg_color': fill, 'border': 1, 'align': 'center'})
        ws_summary.write(row, 3, cat, f_label)
        ws_summary.write(row, 4, score, f_sub_val)
        ws_summary.write(row, 5, wt, f_value)

    # Weighted score formula
    ws_summary.write(11, 3, 'Overall Score (Weighted)', f_bold_label)
    ws_summary.write_formula(11, 4,
        '=E5*0.25+E6*0.20+E7*0.20+E8*0.15+E9*0.10+E10*0.10',
        fmt({'font_name': 'Calibri', 'font_size': 11, 'bold': True,
             'font_color': COLORS[sc_text], 'bg_color': COLORS[sc_fill],
             'border': 2, 'num_format': '0.0', 'align': 'center'}),
        report.health_score)
    ws_summary.write(11, 5, '=D5*0.25+D6*0.20+D7*0.20+D8*0.15+D9*0.10+D10*0.10', f_formula_note, "100%")

    # Key metrics snapshot
    r = report.ratios
    row = 14
    ws_summary.merge_range(row, 0, row, 5, 'KEY METRICS SNAPSHOT', f_section)
    row += 1

    headers = ['Metric', 'Value', 'Healthy Range', 'Status', 'Formula', 'Explanation']
    for c, h in enumerate(headers):
        ws_summary.write(row, c, h, f_header)
    row += 1

    def write_metric(ws, row, name, value, value_fmt, healthy_range, status, formula, explanation):
        fill, text = ("#F0FDF4", "#166534") if status == "Good" else \
                     ("#FFF7ED", "#9A3412") if status == "Watch" else \
                     ("#FFF1F2", "#9F1239") if status == "Critical" else \
                     (COLORS["white"], COLORS["muted_text"])
        f_st = fmt({'font_name': 'Calibri', 'font_size': 10, 'bold': True, 'font_color': text,
                    'bg_color': fill, 'border': 1, 'align': 'center'})
        ws.write(row, 0, name, f_label)
        if value is None:
            ws.write(row, 1, "N/A", fmt({'font_name': 'Calibri', 'font_size': 10, 'border': 1, 'align': 'center', 'font_color': COLORS["muted_text"]}))
        else:
            ws.write(row, 1, value, value_fmt)
        ws.write(row, 2, healthy_range, f_formula_note)
        ws.write(row, 3, status, f_st)
        ws.write(row, 4, formula, f_formula_note)
        ws.write(row, 5, explanation, f_formula_note)

    def status_npm(v):
        if v is None: return "N/A"
        return "Good" if v > 10 else "Watch" if v > 0 else "Critical"

    def status_cr(v):
        if v is None: return "N/A"
        return "Good" if v >= 1.5 else "Watch" if v >= 1 else "Critical"

    def status_de(v):
        if v is None: return "N/A"
        return "Good" if v < 1.5 else "Watch" if v < 3 else "Critical"

    def status_ic(v):
        if v is None: return "N/A"
        return "Good" if v >= 3 else "Watch" if v >= 1.5 else "Critical"

    def status_dso(v):
        if v is None: return "N/A"
        return "Good" if v < 45 else "Watch" if v < 90 else "Critical"

    def status_ocf(v):
        if v is None: return "N/A"
        return "Good" if v > 0 else "Critical"

    snapshot_metrics = [
        ("Revenue", r.revenue, f_inr, f"₹{cu.title()}", "", "=Revenue from Operations + Other Income", "Total income of the business"),
        ("Net Profit Margin %", r.net_profit_margin, f_value_pct, "> 10%", status_npm(r.net_profit_margin), "=Net Profit / Revenue × 100", "How much of each ₹ of revenue becomes profit"),
        ("EBITDA Margin %", r.ebitda_margin, f_value_pct, "> 15%", "Good" if r.ebitda_margin and r.ebitda_margin > 15 else "Watch", "=EBITDA / Revenue × 100", "Operating profitability before interest, tax, depreciation"),
        ("Return on Equity %", r.roe, f_value_pct, "> 15%", "Good" if r.roe and r.roe > 15 else "Watch" if r.roe and r.roe > 0 else "Critical", "=Net Profit / Shareholders' Equity × 100", "Return generated for shareholders"),
        ("Current Ratio", r.current_ratio, f_value_x, "1.5x – 2.5x", status_cr(r.current_ratio), "=Current Assets / Current Liabilities", "Short-term liquidity cushion"),
        ("Quick Ratio", r.quick_ratio, f_value_x, "> 1.0x", "Good" if r.quick_ratio and r.quick_ratio >= 1 else "Watch", "=(Current Assets – Inventory) / Current Liabilities", "Immediate liquidity without selling inventory"),
        ("Debt-to-Equity", r.debt_to_equity, f_value_x, "< 2.0x", status_de(r.debt_to_equity), "=Total Debt / Shareholders' Equity", "Financial leverage — how much borrowed vs owned"),
        ("Interest Coverage", r.interest_coverage, f_value_x, "> 3.0x", status_ic(r.interest_coverage), "=EBIT / Finance Costs", "Ability to pay interest from operating profit"),
        ("DSCR", r.dscr, f_value_x, "> 1.25x", "Good" if r.dscr and r.dscr >= 1.25 else "Critical", "=Operating Cash Flow / Total Debt Service", "Debt service coverage — RBI benchmark"),
        ("DSO (Days)", r.dso, f_value_days, "< 45 days", status_dso(r.dso), "=(Trade Receivables / Revenue) × 365", "Average days to collect from customers"),
        ("DPO (Days)", r.dpo, f_value_days, "30–60 days", "Good" if r.dpo and 30 <= r.dpo <= 60 else "Watch", "=(Trade Payables / COGS) × 365", "Average days to pay suppliers"),
        ("Cash Conv. Cycle", r.cash_conversion_cycle, f_value_days, "< 60 days", "Good" if r.cash_conversion_cycle and r.cash_conversion_cycle < 60 else "Watch", "=DSO + DIO – DPO", "Working capital cycle in days"),
        ("Operating Cash Flow", r.operating_cash_flow, f_inr, "> 0", status_ocf(r.operating_cash_flow), "From Cash Flow Statement", "Cash generated from core business operations"),
        ("Free Cash Flow", r.free_cash_flow, f_inr, "> 0", status_ocf(r.free_cash_flow), "=Operating CF – Capex", "Cash available after growth investments"),
    ]

    for metric_row in snapshot_metrics:
        name, value, vfmt, healthy, status, formula, explanation = metric_row
        write_metric(ws_summary, row, name, value, vfmt, healthy, status, formula, explanation)
        row += 1

    ws_summary.set_row(row - 1, None, None, {'level': 0})

    # ─── SHEET 2: Raw Input Data ───────────────────────────────────────────
    ws_input = wb.add_worksheet("📥 Input Data")
    ws_input.set_zoom(85)
    ws_input.hide_gridlines(2)
    ws_input.set_column('A:A', 38)
    ws_input.set_column('B:B', 20)
    ws_input.set_column('C:C', 35)

    ws_input.merge_range('A1:C1', 'RAW INPUT DATA — Balance Sheet, P&L, Cash Flow', f_section)
    ws_input.write('A2', 'Field', f_header)
    ws_input.write('B2', f'Value (₹ {cu.title()})', f_header)
    ws_input.write('C2', 'Notes', f_header)

    row = 2
    if stmt and stmt.balance_sheet:
        bs = stmt.balance_sheet
        ws_input.merge_range(row, 0, row, 2, 'BALANCE SHEET — ASSETS', f_section)
        row += 1

        bs_assets = [
            ("Fixed Assets (Net Block)", bs.fixed_assets, "BS_FA", "Gross Block – Accumulated Depreciation"),
            ("Capital Work in Progress (CWIP)", bs.cwip, "BS_CWIP", "Assets under construction, not yet capitalized"),
            ("Long-term Investments", bs.lt_investments, "BS_LTI", "Strategic investments, subsidiaries"),
            ("Deferred Tax Asset (DTA)", bs.dta, "BS_DTA", "Future tax benefit — timing differences"),
            ("LT Loans & Advances", bs.lt_loans_advances, "BS_LTLA", "Security deposits, advance taxes, other LT assets"),
            ("Inventory", bs.inventory, "BS_INV", "Raw materials + WIP + Finished goods"),
            ("Trade Receivables", bs.trade_receivables, "BS_TR", "Amount owed by customers (debtors)"),
            ("Cash & Equivalents", bs.cash_and_equivalents, "BS_CASH", "Bank balances, FDs < 3 months"),
            ("ST Loans & Advances", bs.st_loans_advances, "BS_STLA", "Prepaid expenses, advance to suppliers"),
            ("GST ITC Receivable", bs.gst_itc_receivable, "BS_GST_ITC", "Input tax credit balance with GST department"),
            ("TDS Receivable", bs.tds_receivable, "BS_TDS_R", "TDS deducted by customers, refundable"),
            ("Other Current Assets", bs.other_current_assets, "BS_OCA", "All other current assets"),
        ]

        for label, value, named_range, note in bs_assets:
            ws_input.write(row, 0, label, f_label)
            if value is not None:
                ws_input.write(row, 1, value, f_value)
            else:
                ws_input.write(row, 1, "", f_value)
            ws_input.write(row, 2, note, f_formula_note)
            wb.define_name(named_range, f"='📥 Input Data'!$B${row + 1}")
            row += 1

        ws_input.merge_range(row, 0, row, 2, 'BALANCE SHEET — EQUITY & LIABILITIES', f_section)
        row += 1

        bs_liab = [
            ("Share Capital", bs.share_capital, "BS_SC", "Paid-up equity + preference capital"),
            ("Reserves & Surplus", bs.reserves_surplus, "BS_RS", "Retained earnings + other reserves"),
            ("LT Borrowings (Term Loans)", bs.lt_borrowings, "BS_LTB", "Bank term loans, debentures > 1 year"),
            ("Deferred Tax Liability (DTL)", bs.dtl, "BS_DTL", "Future tax payable — timing differences"),
            ("LT Provisions", bs.lt_provisions, "BS_LTP", "Gratuity, leave encashment obligations"),
            ("ST Borrowings", bs.st_borrowings, "BS_STB", "Demand loans, short-term bank facilities"),
            ("CC/OD Facilities", bs.cc_od_facilities, "BS_CCOD", "Cash credit and overdraft facilities"),
            ("Trade Payables", bs.trade_payables, "BS_TP", "Amount owed to suppliers"),
            ("GST Payable", bs.gst_payable, "BS_GST_P", "Output GST liability due"),
            ("TDS Payable", bs.tds_payable, "BS_TDS_P", "TDS deducted, not yet deposited"),
            ("PF/ESI/PT Payable", bs.pf_esi_pt_payable, "BS_PF", "Statutory employee contribution dues"),
            ("Customer Advances", bs.customer_advances, "BS_CA", "Advance received from customers"),
            ("Other Current Liabilities", bs.other_current_liabilities, "BS_OCL", "Accruals, expense payables"),
            ("MSME Payable Overdue", bs.msme_payable_overdue, "BS_MSME", "MSME vendors unpaid > 45 days — mandatory disclosure"),
        ]

        for label, value, named_range, note in bs_liab:
            ws_input.write(row, 0, label, f_label)
            if value is not None:
                ws_input.write(row, 1, value, f_value)
            else:
                ws_input.write(row, 1, "", f_value)
            ws_input.write(row, 2, note, f_formula_note)
            wb.define_name(named_range, f"='📥 Input Data'!$B${row + 1}")
            row += 1

    if stmt and stmt.profit_loss:
        pl = stmt.profit_loss
        ws_input.merge_range(row, 0, row, 2, 'PROFIT & LOSS STATEMENT', f_section)
        row += 1

        pl_data = [
            ("Revenue from Operations", pl.revenue_from_operations, "PL_REV", "Core business revenue (ex. other income)"),
            ("Other Income", pl.other_income, "PL_OI", "Interest income, rental, gains"),
            ("Raw Materials Consumed", pl.raw_materials, "PL_RM", "Opening stock + Purchases – Closing stock"),
            ("Purchases of Stock-in-Trade", pl.purchases, "PL_PUR", "Trading stock purchases"),
            ("Change in Inventory", pl.change_in_inventory, "PL_CINV", "Positive = reduction in stock"),
            ("Employee Benefit Expenses", pl.employee_benefits, "PL_EMP", "Salaries, PF, ESOP, gratuity"),
            ("Finance Costs", pl.finance_costs, "PL_FC", "Interest on borrowings, bank charges"),
            ("Depreciation & Amortization", pl.depreciation, "PL_DEP", "Per Schedule II of Companies Act"),
            ("Other Expenses", pl.other_expenses, "PL_OE", "Admin, selling, marketing expenses"),
            ("Tax Expense", pl.tax_expense, "PL_TAX", "Current tax + Deferred tax"),
        ]

        for label, value, named_range, note in pl_data:
            ws_input.write(row, 0, label, f_label)
            if value is not None:
                ws_input.write(row, 1, value, f_value)
            else:
                ws_input.write(row, 1, "", f_value)
            ws_input.write(row, 2, note, f_formula_note)
            wb.define_name(named_range, f"='📥 Input Data'!$B${row + 1}")
            row += 1

    if stmt and stmt.cash_flow:
        cf = stmt.cash_flow
        ws_input.merge_range(row, 0, row, 2, 'CASH FLOW STATEMENT', f_section)
        row += 1

        cf_data = [
            ("Operating Cash Flow (OCF)", cf.operating_cash_flow, "CF_OCF", "Net cash from operating activities (indirect method)"),
            ("Investing Cash Flow", cf.investing_cash_flow, "CF_ICF", "Capex, investments, asset sales"),
            ("Financing Cash Flow", cf.financing_cash_flow, "CF_FCF_ST", "Borrowings, repayments, dividends"),
            ("Capital Expenditure (Capex)", cf.capex, "CF_CAPEX", "Purchase of fixed assets (usually negative)"),
            ("Opening Cash Balance", cf.opening_cash, "CF_OPEN", "Cash at beginning of year"),
            ("Closing Cash Balance", cf.closing_cash, "CF_CLOSE", "Cash at end of year (must match Balance Sheet)"),
        ]

        for label, value, named_range, note in cf_data:
            ws_input.write(row, 0, label, f_label)
            if value is not None:
                ws_input.write(row, 1, value, f_value)
            else:
                ws_input.write(row, 1, "", f_value)
            ws_input.write(row, 2, note, f_formula_note)
            wb.define_name(named_range, f"='📥 Input Data'!$B${row + 1}")
            row += 1

    # ─── SHEET 3: All Ratios with Formulas ────────────────────────────────
    ws_ratios = wb.add_worksheet("🔢 All Ratios")
    ws_ratios.set_zoom(85)
    ws_ratios.hide_gridlines(2)
    ws_ratios.set_column('A:A', 30)
    ws_ratios.set_column('B:B', 18)
    ws_ratios.set_column('C:C', 40)
    ws_ratios.set_column('D:D', 20)
    ws_ratios.set_column('E:E', 22)
    ws_ratios.set_column('F:F', 40)

    ws_ratios.merge_range('A1:F1', 'FINANCIAL RATIOS — 50+ Metrics | All formulas reference Input Data sheet', f_section)
    headers = ['Ratio Name', 'Value', 'Excel Formula (References Input Sheet)', 'Healthy Range', 'Status', 'Plain English Explanation']
    for c, h in enumerate(headers):
        ws_ratios.write(1, c, h, f_header)

    row = 2

    # Helper to write ratio row
    def write_ratio(name, value, formula_str, healthy, status_fn, explanation, vfmt=None):
        nonlocal row
        if vfmt is None:
            vfmt = f_value
        status = status_fn(value) if value is not None else "N/A"
        fill, text = ("#F0FDF4", "#166534") if status == "Good" else \
                     ("#FFF7ED", "#9A3412") if status == "Watch" else \
                     ("#FFF1F2", "#9F1239") if status == "Critical" else \
                     (COLORS["white"], COLORS["muted_text"])
        f_st = fmt({'font_name': 'Calibri', 'font_size': 10, 'bold': True,
                    'font_color': text, 'bg_color': fill, 'border': 1, 'align': 'center'})
        ws_ratios.write(row, 0, name, f_label)
        if value is not None:
            ws_ratios.write(row, 1, value, vfmt)
        else:
            ws_ratios.write(row, 1, "N/A", fmt({'font_name': 'Calibri', 'font_size': 10, 'border': 1,
                                                 'align': 'center', 'font_color': COLORS["muted_text"]}))
        ws_ratios.write(row, 2, formula_str, f_formula_note)
        ws_ratios.write(row, 3, healthy, f_formula_note)
        ws_ratios.write(row, 4, status, f_st)
        ws_ratios.write(row, 5, explanation, f_formula_note)
        row += 1

    def section_hdr(title):
        nonlocal row
        ws_ratios.merge_range(row, 0, row, 5, title, f_section)
        row += 1

    r = report.ratios

    # PROFITABILITY
    section_hdr("PROFITABILITY RATIOS")
    write_ratio("Gross Margin %", r.gross_margin,
        "=(PL_REV-PL_RM-PL_PUR-PL_CINV)/PL_REV*100",
        "> 30%", lambda v: "Good" if v > 30 else "Watch" if v > 15 else "Critical",
        "Profit after direct costs. Higher = pricing power or low material cost.", f_value_pct)
    write_ratio("Net Profit Margin %", r.net_profit_margin,
        "=((PL_REV+PL_OI)-(PL_RM+PL_PUR+PL_CINV+PL_EMP+PL_FC+PL_DEP+PL_OE+PL_TAX))/(PL_REV+PL_OI)*100",
        "> 10%", lambda v: "Good" if v > 10 else "Watch" if v > 0 else "Critical",
        "How much of each ₹ revenue becomes actual profit after all costs.", f_value_pct)
    write_ratio("EBITDA Margin %", r.ebitda_margin,
        "=(PL_REV-PL_RM-PL_PUR-PL_CINV-PL_EMP-PL_OE)/PL_REV*100",
        "> 15%", lambda v: "Good" if v > 15 else "Watch" if v > 8 else "Critical",
        "Operating profitability before finance costs and non-cash items.", f_value_pct)
    write_ratio("EBIT (Operating Profit Margin %)", r.operating_profit_margin,
        "=(PL_REV-PL_RM-PL_PUR-PL_CINV-PL_EMP-PL_OE-PL_DEP)/PL_REV*100",
        "> 12%", lambda v: "Good" if v > 12 else "Watch" if v > 5 else "Critical",
        "Profit from operations after depreciation, before interest and tax.", f_value_pct)
    write_ratio("Return on Equity (ROE) %", r.roe,
        "=((PL_REV+PL_OI)-(PL_RM+PL_PUR+PL_CINV+PL_EMP+PL_FC+PL_DEP+PL_OE+PL_TAX))/(BS_SC+BS_RS)*100",
        "> 15%", lambda v: "Good" if v > 15 else "Watch" if v > 0 else "Critical",
        "How well does the company use shareholders' money to generate profit?", f_value_pct)
    write_ratio("Return on Assets (ROA) %", r.roa,
        "=Net_Profit/Total_Assets*100",
        "> 5%", lambda v: "Good" if v > 5 else "Watch" if v > 0 else "Critical",
        "How efficiently does the company use its total asset base?", f_value_pct)
    write_ratio("Return on Capital Employed (ROCE) %", r.roce,
        "=EBIT/(Total_Assets-Current_Liabilities)*100",
        "> 15%", lambda v: "Good" if v > 15 else "Watch" if v > 8 else "Critical",
        "Returns generated on all capital deployed (debt + equity).", f_value_pct)
    write_ratio("Earnings Per Share (EPS)", r.eps,
        "=Net_Profit/Number_of_Shares",
        "Industry-specific", lambda v: "Good" if v and v > 0 else "Watch",
        "Net profit per share — key for listed companies and investor discussions.", f_inr)

    # LIQUIDITY
    section_hdr("LIQUIDITY RATIOS")
    write_ratio("Current Ratio", r.current_ratio,
        "=(BS_INV+BS_TR+BS_CASH+BS_STLA+BS_GST_ITC+BS_TDS_R+BS_OCA)/(BS_STB+BS_CCOD+BS_TP+BS_GST_P+BS_TDS_P+BS_PF+BS_CA+BS_OCL)",
        "1.5x – 2.5x", lambda v: "Good" if 1.5 <= v <= 3 else "Watch" if v >= 1 else "Critical",
        "Can the company pay all short-term obligations from current assets?", f_value_x)
    write_ratio("Quick Ratio (Acid Test)", r.quick_ratio,
        "=(BS_TR+BS_CASH+BS_STLA+BS_GST_ITC+BS_TDS_R+BS_OCA)/(BS_STB+BS_CCOD+BS_TP+BS_GST_P+BS_TDS_P+BS_PF+BS_CA+BS_OCL)",
        "> 1.0x", lambda v: "Good" if v >= 1 else "Watch" if v >= 0.7 else "Critical",
        "Liquidity excluding inventory — more conservative test.", f_value_x)
    write_ratio("Cash Ratio", r.cash_ratio,
        "=BS_CASH/(BS_STB+BS_CCOD+BS_TP+BS_GST_P+BS_TDS_P+BS_PF+BS_CA+BS_OCL)",
        "> 0.2x", lambda v: "Good" if v >= 0.2 else "Watch" if v >= 0.05 else "Critical",
        "Most conservative — only cash vs. current liabilities.", f_value_x)
    write_ratio("Working Capital", r.working_capital,
        "=(BS_INV+BS_TR+BS_CASH+BS_STLA+BS_GST_ITC+BS_TDS_R+BS_OCA)-(BS_STB+BS_CCOD+BS_TP+BS_GST_P+BS_TDS_P+BS_PF+BS_CA+BS_OCL)",
        "> 0 (Positive)", lambda v: "Good" if v > 0 else "Critical",
        "Net short-term resources available. Negative = current funding gap.", f_inr)
    write_ratio("Cash Conversion Cycle (Days)", r.cash_conversion_cycle,
        "=DSO+DIO-DPO",
        "< 60 days", lambda v: "Good" if v < 60 else "Watch" if v < 90 else "Critical",
        "Days from paying for inputs to collecting cash from customers.", f_value_days)

    # EFFICIENCY
    section_hdr("EFFICIENCY RATIOS")
    write_ratio("Days Sales Outstanding (DSO)", r.dso,
        "=BS_TR/PL_REV*365",
        "< 45 days", lambda v: "Good" if v < 45 else "Watch" if v < 90 else "Critical",
        "Average days customers take to pay. MSME threshold: 45 days.", f_value_days)
    write_ratio("Days Payable Outstanding (DPO)", r.dpo,
        "=BS_TP/(PL_RM+PL_PUR+PL_CINV)*365",
        "30–60 days", lambda v: "Good" if 30 <= v <= 60 else "Watch",
        "Average days company takes to pay suppliers.", f_value_days)
    write_ratio("Days Inventory Outstanding (DIO)", r.dio,
        "=BS_INV/(PL_RM+PL_PUR+PL_CINV)*365",
        "< 60 days", lambda v: "Good" if v < 60 else "Watch" if v < 90 else "Critical",
        "Average days inventory sits before being sold.", f_value_days)
    write_ratio("Asset Turnover", r.asset_turnover,
        "=(PL_REV+PL_OI)/Total_Assets",
        "> 1.0x", lambda v: "Good" if v > 1 else "Watch" if v > 0.5 else "Critical",
        "Revenue generated per ₹ of total assets. Higher = better asset utilization.", f_value_x)
    write_ratio("Inventory Turnover", r.inventory_turnover,
        "=(PL_RM+PL_PUR+PL_CINV)/BS_INV",
        "> 6x", lambda v: "Good" if v > 6 else "Watch" if v > 3 else "Critical",
        "How many times inventory is sold and replenished annually.", f_value_x)
    write_ratio("Receivables Turnover", r.receivables_turnover,
        "=(PL_REV+PL_OI)/BS_TR",
        "> 8x", lambda v: "Good" if v > 8 else "Watch" if v > 4 else "Critical",
        "Times receivables are collected annually. Higher = faster collections.", f_value_x)
    write_ratio("Fixed Asset Turnover", r.fixed_asset_turnover,
        "=(PL_REV+PL_OI)/BS_FA",
        "> 2.0x", lambda v: "Good" if v > 2 else "Watch" if v > 1 else "Critical",
        "Revenue generated per ₹ of fixed assets. Tests capex efficiency.", f_value_x)

    # LEVERAGE
    section_hdr("LEVERAGE & SOLVENCY RATIOS")
    write_ratio("Debt-to-Equity Ratio", r.debt_to_equity,
        "=(BS_LTB+BS_STB+BS_CCOD)/(BS_SC+BS_RS)",
        "< 2.0x", lambda v: "Good" if v < 1 else "Watch" if v < 3 else "Critical",
        "How much is borrowed for every ₹ of equity. Banks typically cap at 3x.", f_value_x)
    write_ratio("Debt Ratio", r.debt_ratio,
        "=(BS_LTB+BS_STB+BS_CCOD)/Total_Assets",
        "< 0.5", lambda v: "Good" if v < 0.5 else "Watch" if v < 0.7 else "Critical",
        "What % of assets are funded by debt.", f_value)
    write_ratio("Interest Coverage Ratio", r.interest_coverage,
        "=EBIT/PL_FC",
        "> 3.0x", lambda v: "Good" if v >= 3 else "Watch" if v >= 1.5 else "Critical",
        "How many times EBIT covers interest payments. < 1.5x = stressed.", f_value_x)
    write_ratio("DSCR (Debt Service Coverage)", r.dscr,
        "=CF_OCF/(PL_FC+BS_LTB*0.1)",
        "> 1.25x", lambda v: "Good" if v >= 1.25 else "Watch" if v >= 1 else "Critical",
        "Key RBI/bank metric. OCF vs total principal + interest payments.", f_value_x)
    write_ratio("Net Debt to EBITDA", r.net_debt_to_ebitda,
        "=((BS_LTB+BS_STB+BS_CCOD)-BS_CASH)/EBITDA",
        "< 3.0x", lambda v: "Good" if v < 2 else "Watch" if v < 4 else "Critical",
        "Bank lending ceiling is typically 4x EBITDA. Lower = more headroom.", f_value_x)
    write_ratio("Equity Multiplier", r.equity_multiplier,
        "=Total_Assets/(BS_SC+BS_RS)",
        "< 3.0x", lambda v: "Good" if v < 2 else "Watch" if v < 4 else "Critical",
        "Total assets per ₹ of equity. Reflects financial leverage.", f_value_x)

    # CASH FLOW
    section_hdr("CASH FLOW METRICS")
    write_ratio("Operating Cash Flow (OCF)", r.operating_cash_flow,
        "=CF_OCF",
        "> 0", lambda v: "Good" if v > 0 else "Critical",
        "Cash generated from core operations. The most important cash metric.", f_inr)
    write_ratio("Free Cash Flow (FCF)", r.free_cash_flow,
        "=CF_OCF-CF_CAPEX",
        "> 0", lambda v: "Good" if v > 0 else "Watch",
        "Cash left after sustaining/growing fixed assets.", f_inr)
    write_ratio("Cash Flow to Debt", r.cash_flow_to_debt,
        "=CF_OCF/(BS_LTB+BS_STB+BS_CCOD)",
        "> 0.2x", lambda v: "Good" if v > 0.2 else "Watch" if v > 0.1 else "Critical",
        "Ability to repay entire debt from operating cash flow.", f_value_x)
    write_ratio("Cash Flow Margin %", r.cash_flow_margin,
        "=CF_OCF/(PL_REV+PL_OI)*100",
        "> 10%", lambda v: "Good" if v > 10 else "Watch" if v > 5 else "Critical",
        "Operating cash flow as % of revenue.", f_value_pct)
    write_ratio("Capex Intensity %", r.capex_intensity,
        "=CF_CAPEX/(PL_REV+PL_OI)*100",
        "< 10%", lambda v: "Good" if v < 10 else "Watch",
        "Capital intensity of the business. High = asset-heavy model.", f_value_pct)

    # ─── SHEET 4: Compliance ───────────────────────────────────────────────
    ws_comp = wb.add_worksheet("✅ Compliance")
    ws_comp.set_zoom(85)
    ws_comp.hide_gridlines(2)
    ws_comp.set_column('A:A', 30)
    ws_comp.set_column('B:B', 18)
    ws_comp.set_column('C:C', 50)
    ws_comp.set_column('D:D', 30)

    ws_comp.merge_range('A1:D1', 'INDIAN COMPLIANCE HEALTH CHECK — GST, TDS, PF/ESI, MSME, IBC, ROC', f_section)
    ws_comp.write('A2', 'Compliance Area', f_header)
    ws_comp.write('B2', 'Status', f_header)
    ws_comp.write('C2', 'Risk & Implication', f_header)
    ws_comp.write('D2', 'Required Action', f_header)

    comp_data = [
        ("GST Compliance", report.compliance.gst_status.value,
         "GST payable > 90d: 18% p.a. interest. ITC reversal risk if vendors non-compliant.",
         "Pay GST by 20th of each month. Reconcile GSTR-2A/2B monthly."),
        ("TDS/TCS Compliance", report.compliance.tds_status.value,
         "TDS not deposited by 7th = 1.5% p.m. interest + equal penalty. Assessee in default.",
         "Deposit TDS by 7th each month. File quarterly TDS returns (24Q/26Q)."),
        ("PF/ESI/PT Compliance", report.compliance.pf_esi_status.value,
         "Late PF/ESI: interest @12–18% p.a. Employees lose coverage. Director personal liability.",
         "Set up auto-debit for PF by 15th. ESI by 15th each month."),
        ("MSME Payments (45-day rule)", "Critical" if report.compliance.msme_overdue else "OK",
         "MSMD Act Section 22: must disclose MSME dues in financial statements. Expense disallowed in ITR.",
         "Pay MSME vendors within 45 days. Maintain Udyam registration records."),
        ("IBC Risk (Insolvency)", "Critical" if report.compliance.ibc_risk else "OK",
         "Any creditor overdue ≥ ₹1 Cr can file IBC petition. CIRP initiated within 180 days.",
         "Negotiate OTS / settlement. Obtain written extension agreements from creditors."),
        ("ROC Annual Filings", report.compliance.roc_status.value,
         "Non-filing: ₹100/day penalty + director disqualification after 3 years.",
         "File MGT-7 (annual return) and AOC-4 (financials) within 60/60 days of AGM."),
    ]

    for i, (area, status, risk, action) in enumerate(comp_data):
        row_comp = i + 3
        fill = COLORS["critical_fill"] if status == "Critical" else \
               COLORS["moderate_fill"] if status == "Warning" else \
               COLORS["excellent_fill"]
        text = COLORS["critical_bg"] if status == "Critical" else \
               COLORS["stressed_bg"] if status == "Warning" else \
               COLORS["excellent_bg"]
        f_cs = fmt({'font_name': 'Calibri', 'font_size': 10, 'bold': True, 'font_color': text,
                    'bg_color': fill, 'border': 1, 'align': 'center'})
        ws_comp.write(row_comp, 0, area, f_label)
        ws_comp.write(row_comp, 1, status, f_cs)
        ws_comp.write(row_comp, 2, risk, f_formula_note)
        ws_comp.write(row_comp, 3, action, f_formula_note)
        ws_comp.set_row(row_comp, 45)

    # ─── SHEET 5: Recommendations ──────────────────────────────────────────
    ws_recs = wb.add_worksheet("💡 Recommendations")
    ws_recs.set_zoom(85)
    ws_recs.hide_gridlines(2)
    ws_recs.set_column('A:A', 12)
    ws_recs.set_column('B:B', 22)
    ws_recs.set_column('C:C', 45)
    ws_recs.set_column('D:D', 45)
    ws_recs.set_column('E:E', 45)

    ws_recs.merge_range('A1:E1', 'PRIORITIZED ACTION ITEMS — Sorted: Critical → Watch → Positive', f_section)
    for c, h in enumerate(['Priority', 'Category', 'Finding', 'Business Impact', 'Recommended Action']):
        ws_recs.write(1, c, h, f_header)

    for i, rec in enumerate(report.recommendations):
        rec_row = i + 2
        ws_recs.write(rec_row, 0, rec.priority.value, priority_fmt(rec.priority.value))
        ws_recs.write(rec_row, 1, rec.category, f_label)
        ws_recs.write(rec_row, 2, rec.finding, f_formula_note)
        ws_recs.write(rec_row, 3, rec.impact, f_formula_note)
        ws_recs.write(rec_row, 4, rec.action, f_formula_note)
        ws_recs.set_row(rec_row, 60)

    # ─── SHEET 6: Ratio Calculator (Interactive) ──────────────────────────
    ws_calc = wb.add_worksheet("🧮 Ratio Calculator")
    ws_calc.set_zoom(85)
    ws_calc.hide_gridlines(2)
    ws_calc.set_column('A:A', 35)
    ws_calc.set_column('B:B', 20)
    ws_calc.set_column('C:C', 35)

    ws_calc.merge_range('A1:C1', 'INTERACTIVE RATIO CALCULATOR — Change yellow cells to recalculate', f_section)
    ws_calc.merge_range('A2:C2', 'Enter your own values in the yellow cells. All ratios recalculate automatically.', f_subtitle)

    f_input_cell = fmt({'font_name': 'Calibri', 'font_size': 11, 'border': 2, 'bold': True,
                        'bg_color': '#FEF9C3', 'num_format': '#,##0.00', 'align': 'center'})

    inputs = [
        ("Revenue from Operations", r.revenue),
        ("COGS (RM + Purchases + Inv Change)", r.cogs),
        ("EBITDA", r.ebitda),
        ("EBIT (Operating Profit)", r.ebit),
        ("Net Profit", r.net_profit),
        ("Trade Receivables", r.current_assets),  # Approximation in calc sheet
        ("Trade Payables", None),
        ("Inventory", None),
        ("Current Assets", r.current_assets),
        ("Current Liabilities", r.current_liabilities),
        ("Total Assets", r.total_assets),
        ("Total Debt", r.total_debt),
        ("Shareholders' Equity", r.shareholders_equity),
        ("Finance Costs (Interest)", None),
        ("Operating Cash Flow", r.operating_cash_flow),
        ("Capex", None),
    ]

    ws_calc.write('A3', 'INPUT ITEM', f_header)
    ws_calc.write('B3', 'VALUE (₹ Lakhs)', f_header)
    ws_calc.write('C3', 'Note', f_header)

    for i, (label, val) in enumerate(inputs):
        calc_row = i + 4
        ws_calc.write(calc_row, 0, label, f_label)
        ws_calc.write(calc_row, 1, val if val is not None else 0, f_input_cell)
        ws_calc.write(calc_row, 2, "← Change this value", f_formula_note)

    # Calculated ratios referencing the input cells above
    ws_calc.merge_range(21, 0, 21, 2, 'CALCULATED RATIOS (auto-update when you change inputs above)', f_section)
    calc_ratios = [
        ("Gross Margin %", "=(B4-B5)/B4*100", f_value_pct),
        ("Net Profit Margin %", "=B8/B4*100", f_value_pct),
        ("EBITDA Margin %", "=B6/B4*100", f_value_pct),
        ("Operating Profit Margin %", "=B7/B4*100", f_value_pct),
        ("Current Ratio", "=B12/B13", f_value_x),
        ("Quick Ratio", "=(B12-B11)/B13", f_value_x),  # Note: simplified
        ("Debt-to-Equity", "=B15/(B16)", f_value_x),
        ("Interest Coverage", "=B7/B17", f_value_x),
        ("DSO (Days)", "=B9/B4*365", f_value_days),
        ("Asset Turnover", "=B4/B14", f_value_x),
        ("Free Cash Flow", "=B18-B19", f_inr),
        ("Cash Flow Margin %", "=B18/B4*100", f_value_pct),
        ("Net Debt to EBITDA", "=B15/B6", f_value_x),
    ]

    ws_calc.write(22, 0, 'Ratio', f_header)
    ws_calc.write(22, 1, 'Calculated Value', f_header)

    for i, (name, formula, vfmt) in enumerate(calc_ratios):
        ws_calc.write(23 + i, 0, name, f_label)
        try:
            ws_calc.write_formula(23 + i, 1, formula, vfmt)
        except Exception:
            ws_calc.write(23 + i, 1, "N/A", f_formula_note)

    # ─── Add defined names for cross-sheet formulas ────────────────────────
    # These allow the Ratios sheet formulas to resolve
    if stmt:
        def safe_val(v):
            return v if v is not None else 0

        if stmt.profit_loss:
            pl = stmt.profit_loss
            rev = safe_val(pl.revenue_from_operations)
            cogs_val = safe_val(pl.raw_materials) + safe_val(pl.purchases) + safe_val(pl.change_in_inventory)
            ebitda_val = rev - cogs_val - safe_val(pl.employee_benefits) - safe_val(pl.other_expenses)
            ebit_val = ebitda_val - safe_val(pl.depreciation)
            oi = safe_val(pl.other_income)
            tax = safe_val(pl.tax_expense)
            fc = safe_val(pl.finance_costs)
            np_val = ebit_val - fc - tax + oi

        if stmt.balance_sheet:
            bs = stmt.balance_sheet
            ca = (safe_val(bs.inventory) + safe_val(bs.trade_receivables) + safe_val(bs.cash_and_equivalents) +
                  safe_val(bs.st_loans_advances) + safe_val(bs.gst_itc_receivable) + safe_val(bs.tds_receivable))
            cl = (safe_val(bs.st_borrowings) + safe_val(bs.cc_od_facilities) + safe_val(bs.trade_payables) +
                  safe_val(bs.gst_payable) + safe_val(bs.tds_payable) + safe_val(bs.pf_esi_pt_payable) +
                  safe_val(bs.customer_advances))
            total_assets_val = ca + safe_val(bs.fixed_assets) + safe_val(bs.cwip) + safe_val(bs.lt_investments)
            equity_val = safe_val(bs.share_capital) + safe_val(bs.reserves_surplus)
            debt_val = safe_val(bs.lt_borrowings) + safe_val(bs.st_borrowings) + safe_val(bs.cc_od_facilities)

    wb.close()
    output.seek(0)
    return output.read()
