"""
Indian compliance checker — GST, TDS, PF/ESI, MSME, IBC, ROC.
"""
from ..models.schemas import FinancialStatement, ComplianceStatus, StatusEnum


def check_compliance(stmt: FinancialStatement) -> ComplianceStatus:
    bs = stmt.balance_sheet
    compliance = ComplianceStatus()

    if bs is None:
        return compliance

    def g(key, default=0):
        return getattr(bs, key, default) or default

    # ─── GST ────────────────────────────────────────────────────────────────
    gst_payable = g('gst_payable')
    gst_itc = g('gst_itc_receivable')
    current_assets_total = (
        g('inventory') + g('trade_receivables') + g('cash_and_equivalents') +
        g('st_loans_advances') + gst_itc + g('tds_receivable') + g('other_current_assets')
    )

    if gst_payable > 0:
        # Rough heuristic: high GST payable relative to current liabilities
        cl = (g('st_borrowings') + g('cc_od_facilities') + gst_payable +
              g('tds_payable') + g('trade_payables') + g('pf_esi_pt_payable') +
              g('customer_advances') + g('other_current_liabilities'))
        gst_pct = (gst_payable / cl * 100) if cl > 0 else 0
        if gst_pct > 20:
            compliance.gst_status = StatusEnum.critical
        elif gst_pct > 10:
            compliance.gst_status = StatusEnum.warning
        else:
            compliance.gst_status = StatusEnum.ok
    elif gst_itc > current_assets_total * 0.3:
        # ITC blocked > 30% of current assets — flag
        compliance.gst_status = StatusEnum.warning
    else:
        compliance.gst_status = StatusEnum.ok

    # ─── TDS ────────────────────────────────────────────────────────────────
    tds_payable = g('tds_payable')
    if tds_payable > 0:
        # TDS should be deposited by 7th of next month
        revenue_proxy = 0
        # Flag if TDS payable is significantly large
        if tds_payable > 5:  # > ₹5L outstanding
            compliance.tds_status = StatusEnum.critical
        else:
            compliance.tds_status = StatusEnum.warning
    else:
        compliance.tds_status = StatusEnum.ok

    # ─── PF/ESI/PT ──────────────────────────────────────────────────────────
    pf_esi = g('pf_esi_pt_payable')
    if pf_esi > 0:
        if pf_esi > 2:  # > ₹2L outstanding
            compliance.pf_esi_status = StatusEnum.critical
        else:
            compliance.pf_esi_status = StatusEnum.warning
    else:
        compliance.pf_esi_status = StatusEnum.ok

    # ─── MSME ───────────────────────────────────────────────────────────────
    msme_overdue = g('msme_payable_overdue')
    compliance.msme_overdue = msme_overdue > 0

    # ─── IBC Risk ───────────────────────────────────────────────────────────
    ibc_overdue = stmt.ibc_overdue_amount or 0
    compliance.ibc_risk = ibc_overdue >= 100  # ₹1 Cr threshold (in Lakhs = 100)

    # ─── ROC ────────────────────────────────────────────────────────────────
    if stmt.roc_filed is None:
        compliance.roc_status = StatusEnum.na
    elif stmt.roc_filed:
        compliance.roc_status = StatusEnum.ok
    else:
        compliance.roc_status = StatusEnum.critical

    return compliance
