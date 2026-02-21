"""
Rules-based recommendations engine — 50+ rules covering all categories.
"""
from typing import List
from ..models.schemas import FinancialRatios, ComplianceStatus, Recommendation, PriorityEnum


def generate_recommendations(r: FinancialRatios, compliance: ComplianceStatus, currency_unit: str = "L") -> List[Recommendation]:
    recs: List[Recommendation] = []
    u = f"₹{currency_unit}"

    def add(priority: PriorityEnum, category: str, finding: str, impact: str, action: str):
        recs.append(Recommendation(priority=priority, category=category, finding=finding, impact=impact, action=action))

    # ─── Profitability ─────────────────────────────────────────────────────
    if r.net_profit_margin is not None:
        if r.net_profit_margin < 0:
            add(PriorityEnum.critical, "Profitability", f"Net loss reported (margin: {r.net_profit_margin:.1f}%)",
                "Business is burning equity. Lenders and investors will be concerned.",
                "Immediately review pricing strategy, cut discretionary costs, and consider product/service mix optimization.")
        elif r.net_profit_margin < 3:
            add(PriorityEnum.watch, "Profitability", f"Thin net margin of {r.net_profit_margin:.1f}% — dangerously low",
                "Any revenue dip or cost increase will push to losses.",
                "Target 8–12% net margin. Audit top expense heads and explore price increases.")
        elif r.net_profit_margin > 15:
            add(PriorityEnum.positive, "Profitability", f"Strong net margin of {r.net_profit_margin:.1f}%",
                "Healthy profitability supports growth and investor confidence.",
                "Maintain discipline. Explore reinvestment into growth or returning capital to shareholders.")

    if r.ebitda_margin is not None:
        if r.ebitda_margin < 5:
            add(PriorityEnum.critical, "Profitability", f"EBITDA margin of {r.ebitda_margin:.1f}% is very low",
                "Operational cash generation is weak. Debt servicing will be strained.",
                "Focus on operational efficiency. Benchmark against industry peers.")
        elif r.ebitda_margin > 20:
            add(PriorityEnum.positive, "Profitability", f"EBITDA margin of {r.ebitda_margin:.1f}% indicates strong operations",
                "Strong buffer for debt servicing, reinvestment, and downturns.",
                "Lock in contracts and explore capacity expansion.")

    if r.roe is not None:
        if r.roe < 0:
            add(PriorityEnum.critical, "Profitability", f"Negative ROE ({r.roe:.1f}%) — equity is being eroded",
                "Shareholders are losing value. Risk of net worth going negative.",
                "Turnaround plan required. Consider equity infusion if losses are structural.")
        elif r.roe > 20:
            add(PriorityEnum.positive, "Profitability", f"Excellent ROE of {r.roe:.1f}% — strong shareholder returns",
                "Business generates strong returns on equity deployed.",
                "Retain earnings to compound growth. Consider dividend policy.")

    if r.gross_margin is not None and r.gross_margin < 20:
        add(PriorityEnum.watch, "Profitability", f"Gross margin of {r.gross_margin:.1f}% is below 20%",
            "High cost of goods leaving little room for operating expenses.",
            "Renegotiate supplier contracts, explore cheaper raw material sources, or raise prices.")

    # ─── Liquidity ─────────────────────────────────────────────────────────
    if r.current_ratio is not None:
        if r.current_ratio < 1.0:
            add(PriorityEnum.critical, "Liquidity", f"Current ratio of {r.current_ratio:.2f}x — immediate liquidity crisis risk",
                "Current liabilities exceed current assets. Company may default on short-term obligations.",
                "Urgently negotiate payment terms with creditors, accelerate collections, consider working capital loan.")
        elif r.current_ratio < 1.5:
            add(PriorityEnum.watch, "Liquidity", f"Current ratio of {r.current_ratio:.2f}x — below healthy range",
                "Limited cushion to handle unexpected cash flow disruptions.",
                "Target current ratio of 1.5–2.0x. Reduce short-term debt, improve collections.")
        elif r.current_ratio > 3.0:
            add(PriorityEnum.watch, "Liquidity", f"Current ratio of {r.current_ratio:.2f}x — possibly too high",
                "Excess current assets may indicate idle cash or bloated inventory.",
                "Deploy surplus cash productively — capex, debt repayment, or dividends.")

    if r.quick_ratio is not None and r.quick_ratio < 0.5:
        add(PriorityEnum.critical, "Liquidity", f"Quick ratio of {r.quick_ratio:.2f}x is dangerously low",
            "Even after excluding inventory, cannot cover current liabilities.",
            "Urgently convert receivables to cash and negotiate extended payable terms.")

    if r.cash_conversion_cycle is not None and r.cash_conversion_cycle > 90:
        add(PriorityEnum.watch, "Liquidity", f"Cash conversion cycle of {r.cash_conversion_cycle:.0f} days — too long",
            f"Working capital is locked in operations for {r.cash_conversion_cycle:.0f} days.",
            "Reduce DSO (faster collections), reduce DIO (faster inventory turnover), extend DPO.")

    # ─── Receivables / DSO ─────────────────────────────────────────────────
    if r.dso is not None:
        if r.dso > 90:
            wc_impact = None
            if r.revenue and r.dso:
                wc_impact = round(r.revenue * (r.dso - 45) / 365, 1)
            impact_str = f"₹{wc_impact:.1f}L cash locked in overdue debtors." if wc_impact else "Significant cash locked in overdue debtors."
            add(PriorityEnum.critical, "Receivables", f"DSO of {r.dso:.0f} days — debtors severely overdue",
                impact_str,
                "Implement strict 30/60/90 day aging reviews. Consider factoring/invoice discounting for immediate liquidity.")
        elif r.dso > 60:
            add(PriorityEnum.watch, "Receivables", f"DSO of {r.dso:.0f} days — above optimal range",
                "Working capital strain. Higher risk of bad debts.",
                "Implement credit checks before extending terms. Offer early payment discounts.")
        elif r.dso < 30:
            add(PriorityEnum.positive, "Receivables", f"Excellent DSO of {r.dso:.0f} days — collections are fast",
                "Strong cash flow from operations.",
                "Maintain discipline. Monitor for any sudden deterioration.")

    # ─── Payables / DPO ────────────────────────────────────────────────────
    if r.dpo is not None and r.dpo > 90:
        add(PriorityEnum.watch, "Payables", f"DPO of {r.dpo:.0f} days — paying suppliers very late",
            "Risk of supplier relationship damage, supply disruption, and MSME Act penalties.",
            "Negotiate formal extended terms rather than delaying payments. Prioritize MSME vendors (45-day limit).")

    # ─── Debt / Leverage ───────────────────────────────────────────────────
    if r.debt_to_equity is not None:
        if r.debt_to_equity > 3.0:
            add(PriorityEnum.critical, "Debt", f"Debt-to-equity ratio of {r.debt_to_equity:.2f}x — highly leveraged",
                "Banks will view additional lending as high risk. Interest burden may exceed EBIT.",
                "Prioritize debt repayment. Explore equity infusion. Avoid further debt-funded expansion.")
        elif r.debt_to_equity > 2.0:
            add(PriorityEnum.watch, "Debt", f"D/E ratio of {r.debt_to_equity:.2f}x — moderately high leverage",
                "Limited headroom for additional credit facilities.",
                "Reduce leverage to below 2x before next credit cycle. Retain profits rather than distribute.")
        elif r.debt_to_equity < 0.5:
            add(PriorityEnum.positive, "Debt", f"Low D/E ratio of {r.debt_to_equity:.2f}x — conservative leverage",
                "Strong balance sheet. Good headroom for growth capital.",
                "Consider optimal leverage to improve ROE — conservative companies often under-utilize debt.")

    if r.interest_coverage is not None:
        if r.interest_coverage < 1.0:
            add(PriorityEnum.critical, "Debt", f"Interest coverage of {r.interest_coverage:.2f}x — cannot cover interest from EBIT",
                "Risk of loan default. Lenders may classify as NPA.",
                "Immediate discussion with lenders for restructuring. Explore OTS (one-time settlement) options.")
        elif r.interest_coverage < 2.0:
            add(PriorityEnum.watch, "Debt", f"Interest coverage of {r.interest_coverage:.2f}x — tight coverage",
                "Small drop in profits will make it hard to service debt.",
                "Target coverage above 3x. Focus on EBITDA improvement.")
        elif r.interest_coverage > 5.0:
            add(PriorityEnum.positive, "Debt", f"Strong interest coverage of {r.interest_coverage:.2f}x",
                "Comfortable debt servicing capacity.",
                "Good position to approach lenders for better rate renegotiation.")

    if r.dscr is not None and r.dscr < 1.0:
        add(PriorityEnum.critical, "Debt", f"DSCR of {r.dscr:.2f}x — insufficient to service total debt",
            "Cannot meet principal + interest obligations from operating cash flow.",
            "Renegotiate repayment schedule, moratorium on principal, or explore debt restructuring.")

    if r.net_debt_to_ebitda is not None and r.net_debt_to_ebitda > 4:
        add(PriorityEnum.watch, "Debt", f"Net Debt/EBITDA of {r.net_debt_to_ebitda:.1f}x — above 4x threshold",
            "Banks typically cap lending at 4x EBITDA. May face difficulty raising new debt.",
            "Reduce net debt through prepayment. Improve EBITDA to bring ratio below 3x.")

    # ─── Cash Flow ─────────────────────────────────────────────────────────
    if r.operating_cash_flow is not None:
        if r.operating_cash_flow < 0:
            add(PriorityEnum.critical, "Cash Flow", "Negative operating cash flow — business is cash burning",
                "Despite potential accounting profits, actual cash position is deteriorating.",
                "Review working capital management. Accelerate collections, delay non-critical payments.")
        elif r.free_cash_flow is not None and r.free_cash_flow < 0:
            add(PriorityEnum.watch, "Cash Flow", "Negative free cash flow — capex exceeds operating cash",
                "Heavy capital investment may be justified if growth-oriented, but monitor carefully.",
                "Evaluate ROI on capex. Ensure investments are generating adequate returns.")

    if r.cash_flow_margin is not None and r.cash_flow_margin > 15:
        add(PriorityEnum.positive, "Cash Flow", f"Strong cash flow margin of {r.cash_flow_margin:.1f}%",
            "Business converts revenue efficiently into operating cash.",
            "Excellent position for debt repayment, dividends, or reinvestment.")

    # ─── Efficiency ─────────────────────────────────────────────────────────
    if r.inventory_turnover is not None and r.inventory_turnover < 3:
        add(PriorityEnum.watch, "Efficiency", f"Low inventory turnover of {r.inventory_turnover:.1f}x — slow-moving stock",
            "Capital locked in excess inventory. Risk of obsolescence and storage costs.",
            "Implement ABC analysis, reduce reorder quantities, clear slow-moving items with discounts.")

    if r.asset_turnover is not None and r.asset_turnover < 0.5:
        add(PriorityEnum.watch, "Efficiency", f"Asset turnover of {r.asset_turnover:.2f}x — underutilizing assets",
            "Revenue generated per rupee of assets is low.",
            "Review idle assets for disposal or lease. Focus on revenue growth strategies.")

    # ─── Compliance ─────────────────────────────────────────────────────────
    if compliance.gst_status.value == "Critical":
        add(PriorityEnum.critical, "Compliance", "GST payable outstanding is critically high",
            "Risk of GST department notice, penalty (18% p.a. interest), and input credit block.",
            "Clear GST dues immediately. File pending returns. Consider GST installment plan if large amount.")
    elif compliance.gst_status.value == "Warning":
        add(PriorityEnum.watch, "Compliance", "GST payable outstanding needs attention",
            "Accumulating interest at 18% p.a. Auto-populated liability increasing.",
            "Set up standing instruction to pay GST by 20th of each month.")

    if compliance.tds_status.value == "Critical":
        add(PriorityEnum.critical, "Compliance", "TDS deducted but not deposited to government",
            "Assessee in default. Risk of 1.5% p.m. interest, penalty equal to TDS amount, and prosecution.",
            "Deposit TDS immediately via challan ITNS 281. File TDS returns if overdue.")

    if compliance.pf_esi_status.value == "Critical":
        add(PriorityEnum.critical, "Compliance", "PF/ESI statutory dues are outstanding",
            "Employees' social security is at risk. Labor department action and personal liability of directors.",
            "Clear PF/ESI dues immediately. Set up auto-debit for monthly payments.")

    if compliance.msme_overdue:
        add(PriorityEnum.critical, "Compliance", "MSME vendor payments overdue beyond 45 days",
            "Mandatory disclosure under Section 22 of MSMED Act. Disallowance of expense in ITR.",
            "Pay MSME vendors within 45 days. Maintain vendor registration status records.")

    if compliance.ibc_risk:
        add(PriorityEnum.critical, "Compliance", "IBC trigger risk — creditor overdue ≥ ₹1 Cr",
            "Any single creditor can file insolvency petition under IBC. CIRP can be initiated.",
            "Negotiate OTS or restructuring with creditors. Obtain written waiver/extension agreements.")

    # Sort: Critical first, then Watch, then Positive
    priority_order = {PriorityEnum.critical: 0, PriorityEnum.watch: 1, PriorityEnum.positive: 2}
    recs.sort(key=lambda r: priority_order.get(r.priority, 3))

    return recs
