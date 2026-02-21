"""
Core financial ratio calculation engine — 50+ ratios for Indian businesses.
"""
from typing import Optional
from ..models.schemas import FinancialStatement, FinancialRatios


def safe_div(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    if numerator is None or denominator is None:
        return None
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)


def calculate_all_ratios(stmt: FinancialStatement) -> FinancialRatios:
    bs = stmt.balance_sheet or {}
    pl = stmt.profit_loss or {}
    cf = stmt.cash_flow or {}

    # Use attribute access safely
    def g(obj, key, default=None):
        if obj is None:
            return default
        return getattr(obj, key, default) or default

    # ─── Derived Income Statement Items ─────────────────────────────────────
    revenue = (g(pl, 'revenue_from_operations', 0) or 0) + (g(pl, 'other_income', 0) or 0)
    rev_ops = g(pl, 'revenue_from_operations', 0) or 0

    raw_materials = g(pl, 'raw_materials', 0) or 0
    purchases = g(pl, 'purchases', 0) or 0
    change_inv = g(pl, 'change_in_inventory', 0) or 0
    cogs = raw_materials + purchases + change_inv

    gross_profit = rev_ops - cogs if rev_ops else None

    employee_benefits = g(pl, 'employee_benefits', 0) or 0
    finance_costs = g(pl, 'finance_costs', 0) or 0
    depreciation = g(pl, 'depreciation', 0) or 0
    other_expenses = g(pl, 'other_expenses', 0) or 0
    tax_expense = g(pl, 'tax_expense', 0) or 0

    total_opex = employee_benefits + finance_costs + depreciation + other_expenses
    total_costs = cogs + total_opex
    ebitda = rev_ops - cogs - employee_benefits - other_expenses if rev_ops else None
    ebit = (ebitda - depreciation) if ebitda is not None else None
    pbt = (ebit - finance_costs) if ebit is not None else None
    net_profit = (pbt - tax_expense) if pbt is not None else None

    # ─── Derived Balance Sheet Items ─────────────────────────────────────────
    fixed_assets = g(bs, 'fixed_assets', 0) or 0
    cwip = g(bs, 'cwip', 0) or 0
    lt_investments = g(bs, 'lt_investments', 0) or 0
    dta = g(bs, 'dta', 0) or 0
    lt_loans = g(bs, 'lt_loans_advances', 0) or 0

    inventory = g(bs, 'inventory', 0) or 0
    trade_receivables = g(bs, 'trade_receivables', 0) or 0
    cash = g(bs, 'cash_and_equivalents', 0) or 0
    st_loans = g(bs, 'st_loans_advances', 0) or 0
    gst_itc = g(bs, 'gst_itc_receivable', 0) or 0
    tds_rec = g(bs, 'tds_receivable', 0) or 0
    other_ca = g(bs, 'other_current_assets', 0) or 0

    current_assets = inventory + trade_receivables + cash + st_loans + gst_itc + tds_rec + other_ca
    non_current_assets = fixed_assets + cwip + lt_investments + dta + lt_loans
    total_assets = current_assets + non_current_assets

    share_capital = g(bs, 'share_capital', 0) or 0
    reserves = g(bs, 'reserves_surplus', 0) or 0
    shareholders_equity = share_capital + reserves

    lt_borrowings = g(bs, 'lt_borrowings', 0) or 0
    dtl = g(bs, 'dtl', 0) or 0
    lt_provisions = g(bs, 'lt_provisions', 0) or 0

    st_borrowings = g(bs, 'st_borrowings', 0) or 0
    cc_od = g(bs, 'cc_od_facilities', 0) or 0
    trade_payables = g(bs, 'trade_payables', 0) or 0
    gst_payable = g(bs, 'gst_payable', 0) or 0
    tds_payable = g(bs, 'tds_payable', 0) or 0
    pf_esi = g(bs, 'pf_esi_pt_payable', 0) or 0
    cust_adv = g(bs, 'customer_advances', 0) or 0
    other_cl = g(bs, 'other_current_liabilities', 0) or 0

    current_liabilities = st_borrowings + cc_od + trade_payables + gst_payable + tds_payable + pf_esi + cust_adv + other_cl
    non_current_liabilities = lt_borrowings + dtl + lt_provisions

    total_debt = lt_borrowings + st_borrowings + cc_od

    # Cash flow
    ocf = g(cf, 'operating_cash_flow')
    capex = g(cf, 'capex', 0) or 0
    fcf = (ocf - capex) if ocf is not None else None

    # Cost analysis
    cost_heads = {
        "Raw Materials": raw_materials,
        "Employee Benefits": employee_benefits,
        "Finance Costs": finance_costs,
        "Depreciation": depreciation,
        "Other Expenses": other_expenses,
    }
    largest_cost_head = max(cost_heads, key=lambda k: cost_heads[k]) if any(cost_heads.values()) else None

    # ─── Profitability Ratios ─────────────────────────────────────────────────
    gross_margin = safe_div(gross_profit, rev_ops) * 100 if gross_profit is not None and rev_ops else None
    net_profit_margin = safe_div(net_profit, revenue) * 100 if net_profit is not None and revenue else None
    ebitda_margin = safe_div(ebitda, rev_ops) * 100 if ebitda is not None and rev_ops else None
    operating_profit_margin = safe_div(ebit, rev_ops) * 100 if ebit is not None and rev_ops else None

    roe = safe_div(net_profit, shareholders_equity) * 100 if net_profit is not None and shareholders_equity else None
    roa = safe_div(net_profit, total_assets) * 100 if net_profit is not None and total_assets else None

    capital_employed = total_assets - current_liabilities if total_assets and current_liabilities else None
    roce = safe_div(ebit, capital_employed) * 100 if ebit is not None and capital_employed else None

    num_shares = g(bs, 'number_of_shares')
    eps = safe_div(net_profit, num_shares) if net_profit is not None and num_shares else None

    # ─── Liquidity Ratios ─────────────────────────────────────────────────────
    current_ratio = safe_div(current_assets, current_liabilities) if current_assets and current_liabilities else None
    quick_assets = current_assets - inventory
    quick_ratio = safe_div(quick_assets, current_liabilities) if current_liabilities else None
    cash_ratio = safe_div(cash, current_liabilities) if current_liabilities else None
    working_capital = current_assets - current_liabilities if current_assets and current_liabilities else None

    # ─── Efficiency Ratios ────────────────────────────────────────────────────
    dso = safe_div(trade_receivables, rev_ops) * 365 if trade_receivables and rev_ops else None
    dpo = safe_div(trade_payables, cogs) * 365 if trade_payables and cogs else None
    dio = safe_div(inventory, cogs) * 365 if inventory and cogs else None

    ccc = None
    if dso is not None and dio is not None and dpo is not None:
        ccc = round(dso + dio - dpo, 2)

    asset_turnover = safe_div(revenue, total_assets) if revenue and total_assets else None
    inventory_turnover = safe_div(cogs, inventory) if inventory else None
    receivables_turnover = safe_div(revenue, trade_receivables) if trade_receivables else None
    net_fixed_assets = fixed_assets
    fixed_asset_turnover = safe_div(revenue, net_fixed_assets) if net_fixed_assets else None

    # ─── Leverage / Solvency Ratios ───────────────────────────────────────────
    debt_to_equity = safe_div(total_debt, shareholders_equity) if shareholders_equity else None
    debt_ratio = safe_div(total_debt, total_assets) if total_assets else None
    interest_coverage = safe_div(ebit, finance_costs) if ebit is not None and finance_costs else None

    # DSCR: NOI / (principal repayment + interest) — approximate
    debt_service = finance_costs + (lt_borrowings * 0.1)  # Approx 10yr principal
    dscr = safe_div(ocf, debt_service) if ocf is not None and debt_service else None

    net_debt = total_debt - cash
    net_debt_to_ebitda = safe_div(net_debt, ebitda) if ebitda else None
    equity_multiplier = safe_div(total_assets, shareholders_equity) if shareholders_equity else None

    # ─── Cash Flow Metrics ────────────────────────────────────────────────────
    cash_flow_to_debt = safe_div(ocf, total_debt) if ocf is not None and total_debt else None
    cash_flow_margin = safe_div(ocf, revenue) * 100 if ocf is not None and revenue else None
    capex_intensity = safe_div(capex, revenue) * 100 if revenue else None

    # ─── Cost analysis ────────────────────────────────────────────────────────
    cost_to_revenue = safe_div(total_costs, revenue) * 100 if revenue else None

    return FinancialRatios(
        # Profitability
        gross_margin=gross_margin,
        net_profit_margin=net_profit_margin,
        ebitda_margin=ebitda_margin,
        roe=roe,
        roa=roa,
        roce=roce,
        eps=eps,
        operating_profit_margin=operating_profit_margin,
        # Liquidity
        current_ratio=current_ratio,
        quick_ratio=quick_ratio,
        cash_ratio=cash_ratio,
        working_capital=working_capital,
        cash_conversion_cycle=ccc,
        # Efficiency
        dso=round(dso, 1) if dso else None,
        dpo=round(dpo, 1) if dpo else None,
        dio=round(dio, 1) if dio else None,
        asset_turnover=asset_turnover,
        inventory_turnover=inventory_turnover,
        receivables_turnover=receivables_turnover,
        fixed_asset_turnover=fixed_asset_turnover,
        # Leverage
        debt_to_equity=debt_to_equity,
        debt_ratio=debt_ratio,
        interest_coverage=interest_coverage,
        dscr=dscr,
        net_debt_to_ebitda=net_debt_to_ebitda,
        equity_multiplier=equity_multiplier,
        # Cash Flow
        operating_cash_flow=ocf,
        free_cash_flow=round(fcf, 2) if fcf else None,
        cash_flow_to_debt=cash_flow_to_debt,
        cash_flow_margin=cash_flow_margin,
        capex_intensity=capex_intensity,
        # Derived
        revenue=round(revenue, 2) if revenue else None,
        gross_profit=round(gross_profit, 2) if gross_profit is not None else None,
        ebitda=round(ebitda, 2) if ebitda is not None else None,
        ebit=round(ebit, 2) if ebit is not None else None,
        net_profit=round(net_profit, 2) if net_profit is not None else None,
        total_assets=round(total_assets, 2) if total_assets else None,
        total_debt=round(total_debt, 2) if total_debt else None,
        shareholders_equity=round(shareholders_equity, 2) if shareholders_equity else None,
        current_assets=round(current_assets, 2) if current_assets else None,
        current_liabilities=round(current_liabilities, 2) if current_liabilities else None,
        cogs=round(cogs, 2) if cogs else None,
        total_costs=round(total_costs, 2) if total_costs else None,
        cost_to_revenue=cost_to_revenue,
        largest_cost_head=largest_cost_head,
    )
