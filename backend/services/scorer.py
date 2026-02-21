"""
Financial Health Score engine — weighted 0–100 score across 6 categories.
Calibrated to RBI/SEBI/Indian SME lending benchmarks.
"""
from ..models.schemas import FinancialRatios, ComplianceStatus, SubScores


def clamp(val: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, val))


def score_profitability(r: FinancialRatios) -> float:
    score = 50.0  # Base
    # Net Profit Margin (0–100 scale)
    if r.net_profit_margin is not None:
        npm = r.net_profit_margin
        if npm > 20:
            score += 15
        elif npm > 10:
            score += 10
        elif npm > 5:
            score += 5
        elif npm > 0:
            score += 0
        else:
            score -= 20
    # EBITDA Margin
    if r.ebitda_margin is not None:
        em = r.ebitda_margin
        if em > 25:
            score += 15
        elif em > 15:
            score += 8
        elif em > 8:
            score += 3
        elif em < 0:
            score -= 15
    # ROE
    if r.roe is not None:
        roe = r.roe
        if roe > 20:
            score += 10
        elif roe > 12:
            score += 5
        elif roe > 0:
            score += 0
        else:
            score -= 10
    # ROA
    if r.roa is not None:
        roa = r.roa
        if roa > 10:
            score += 10
        elif roa > 5:
            score += 5
        elif roa < 0:
            score -= 10
    return clamp(score)


def score_liquidity(r: FinancialRatios) -> float:
    score = 50.0
    if r.current_ratio is not None:
        cr = r.current_ratio
        if cr >= 2.0:
            score += 20
        elif cr >= 1.5:
            score += 12
        elif cr >= 1.0:
            score += 5
        elif cr >= 0.8:
            score -= 10
        else:
            score -= 25
    if r.quick_ratio is not None:
        qr = r.quick_ratio
        if qr >= 1.0:
            score += 15
        elif qr >= 0.7:
            score += 5
        elif qr >= 0.5:
            score -= 5
        else:
            score -= 15
    if r.cash_ratio is not None:
        cash_r = r.cash_ratio
        if cash_r >= 0.3:
            score += 10
        elif cash_r >= 0.1:
            score += 5
        else:
            score -= 5
    if r.cash_conversion_cycle is not None:
        ccc = r.cash_conversion_cycle
        if ccc < 30:
            score += 5
        elif ccc < 60:
            score += 0
        elif ccc < 90:
            score -= 5
        else:
            score -= 15
    return clamp(score)


def score_leverage(r: FinancialRatios) -> float:
    score = 50.0
    if r.debt_to_equity is not None:
        de = r.debt_to_equity
        if de < 0.5:
            score += 20
        elif de < 1.0:
            score += 10
        elif de < 2.0:
            score += 0
        elif de < 3.0:
            score -= 10
        else:
            score -= 25
    if r.interest_coverage is not None:
        ic = r.interest_coverage
        if ic > 5:
            score += 20
        elif ic > 3:
            score += 10
        elif ic > 1.5:
            score += 0
        elif ic > 1:
            score -= 10
        else:
            score -= 25
    if r.dscr is not None:
        dscr = r.dscr
        if dscr > 2:
            score += 10
        elif dscr > 1.25:
            score += 5
        elif dscr > 1:
            score -= 5
        else:
            score -= 20
    return clamp(score)


def score_efficiency(r: FinancialRatios) -> float:
    score = 50.0
    if r.dso is not None:
        dso = r.dso
        if dso < 30:
            score += 15
        elif dso < 45:
            score += 8
        elif dso < 60:
            score += 0
        elif dso < 90:
            score -= 10
        else:
            score -= 20
    if r.asset_turnover is not None:
        at = r.asset_turnover
        if at > 2:
            score += 15
        elif at > 1:
            score += 8
        elif at > 0.5:
            score += 0
        else:
            score -= 10
    if r.inventory_turnover is not None:
        it = r.inventory_turnover
        if it > 10:
            score += 10
        elif it > 5:
            score += 5
        elif it > 3:
            score += 0
        else:
            score -= 10
    if r.dpo is not None:
        dpo = r.dpo
        # Moderate DPO is healthy — too long signals stress
        if 30 <= dpo <= 60:
            score += 5
        elif dpo > 90:
            score -= 10
    return clamp(score)


def score_cash_flow(r: FinancialRatios) -> float:
    score = 50.0
    if r.operating_cash_flow is not None:
        ocf = r.operating_cash_flow
        if ocf > 0:
            score += 20
            # Bonus for strong OCF margin
            if r.cash_flow_margin and r.cash_flow_margin > 15:
                score += 15
            elif r.cash_flow_margin and r.cash_flow_margin > 8:
                score += 8
        else:
            score -= 25
    if r.free_cash_flow is not None:
        fcf = r.free_cash_flow
        if fcf > 0:
            score += 15
        else:
            score -= 10
    if r.cash_flow_to_debt is not None:
        ctd = r.cash_flow_to_debt
        if ctd > 0.3:
            score += 15
        elif ctd > 0.1:
            score += 5
        elif ctd < 0:
            score -= 15
    return clamp(score)


def score_compliance(compliance: ComplianceStatus) -> float:
    score = 80.0  # Start high, deduct for violations
    if compliance.gst_status.value == "Critical":
        score -= 30
    elif compliance.gst_status.value == "Warning":
        score -= 15
    if compliance.tds_status.value == "Critical":
        score -= 25
    elif compliance.tds_status.value == "Warning":
        score -= 10
    if compliance.pf_esi_status.value == "Critical":
        score -= 15
    elif compliance.pf_esi_status.value == "Warning":
        score -= 8
    if compliance.msme_overdue:
        score -= 15
    if compliance.ibc_risk:
        score -= 30
    if compliance.roc_status.value == "Critical":
        score -= 10
    return clamp(score)


def calculate_health_score(r: FinancialRatios, compliance: ComplianceStatus) -> tuple[float, SubScores]:
    sub = SubScores(
        profitability=round(score_profitability(r), 1),
        liquidity=round(score_liquidity(r), 1),
        leverage=round(score_leverage(r), 1),
        efficiency=round(score_efficiency(r), 1),
        cash_flow=round(score_cash_flow(r), 1),
        compliance=round(score_compliance(compliance), 1),
    )
    weights = {
        "profitability": 0.25,
        "liquidity": 0.20,
        "leverage": 0.20,
        "efficiency": 0.15,
        "cash_flow": 0.10,
        "compliance": 0.10,
    }
    total = (
        sub.profitability * weights["profitability"] +
        sub.liquidity * weights["liquidity"] +
        sub.leverage * weights["leverage"] +
        sub.efficiency * weights["efficiency"] +
        sub.cash_flow * weights["cash_flow"] +
        sub.compliance * weights["compliance"]
    )
    return round(clamp(total), 1), sub


def get_score_band(score: float) -> str:
    if score >= 80:
        return "Excellent"
    elif score >= 60:
        return "Good"
    elif score >= 40:
        return "Moderate"
    elif score >= 20:
        return "Stressed"
    else:
        return "Critical"
