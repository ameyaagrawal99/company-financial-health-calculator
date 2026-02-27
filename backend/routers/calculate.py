from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
import io
from typing import Optional

from ..models.schemas import FinancialStatement, FinancialHealthReport
from ..services.calculator import calculate_all_ratios
from ..services.scorer import calculate_health_score, get_score_band
from ..services.compliance_checker import check_compliance
from ..services.recommender import generate_recommendations
from ..services.excel_exporter import export_to_excel
from ..services.ai_analyst import generate_ai_analysis

router = APIRouter(prefix="/api", tags=["calculate"])


def _build_report(stmt: FinancialStatement) -> FinancialHealthReport:
    """Common helper to build a FinancialHealthReport from a statement."""
    ratios = calculate_all_ratios(stmt)
    compliance = check_compliance(stmt)
    health_score, sub_scores = calculate_health_score(ratios, compliance)
    score_band = get_score_band(health_score)
    recommendations = generate_recommendations(
        ratios, compliance, stmt.currency_unit.value if stmt.currency_unit else "L"
    )

    # Check balance sheet balance
    bs_balanced = None
    bs_diff = None
    if stmt.balance_sheet:
        bs = stmt.balance_sheet
        def g(key): return getattr(bs, key, 0) or 0
        total_assets = (g('fixed_assets') + g('cwip') + g('lt_investments') + g('dta') +
                       g('lt_loans_advances') + g('inventory') + g('trade_receivables') +
                       g('cash_and_equivalents') + g('st_loans_advances') + g('gst_itc_receivable') +
                       g('tds_receivable') + g('other_current_assets'))
        total_liab = (g('share_capital') + g('reserves_surplus') + g('lt_borrowings') + g('dtl') +
                     g('lt_provisions') + g('st_borrowings') + g('cc_od_facilities') +
                     g('trade_payables') + g('gst_payable') + g('tds_payable') + g('pf_esi_pt_payable') +
                     g('customer_advances') + g('other_current_liabilities'))
        bs_diff = round(abs(total_assets - total_liab), 2)
        bs_balanced = bs_diff < (total_assets * 0.01)  # Within 1%

    missing = []
    if not stmt.balance_sheet:
        missing.append("Balance Sheet")
    if not stmt.profit_loss:
        missing.append("Profit & Loss Statement")
    if not stmt.cash_flow:
        missing.append("Cash Flow Statement (optional)")
    if stmt.balance_sheet and not stmt.balance_sheet.trade_receivables:
        missing.append("Trade Receivables")
    if stmt.balance_sheet and not stmt.balance_sheet.inventory:
        missing.append("Inventory")

    return FinancialHealthReport(
        company_name=stmt.company_name or "Your Company",
        financial_year=stmt.financial_year or "FY 2024-25",
        currency_unit=stmt.currency_unit.value if stmt.currency_unit else "lakhs",
        health_score=health_score,
        score_band=score_band,
        sub_scores=sub_scores,
        ratios=ratios,
        compliance=compliance,
        recommendations=recommendations,
        missing_fields=missing,
        balance_sheet_balanced=bs_balanced,
        balance_sheet_diff=bs_diff,
    )


@router.post("/calculate", response_model=FinancialHealthReport)
async def calculate(stmt: FinancialStatement):
    """Main calculation endpoint — computes all ratios, score, and recommendations."""
    try:
        return _build_report(stmt)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Calculation error: {str(e)}")


@router.post("/export/excel")
async def export_excel(stmt: FinancialStatement):
    """Export full report as Excel with formulas, color coding, and formatting."""
    try:
        report = _build_report(stmt)
        excel_bytes = export_to_excel(report, stmt)
        filename = f"Financial_Health_{(stmt.company_name or 'Report').replace(' ', '_')}_{stmt.financial_year or 'FY2425'}.xlsx"

        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")


@router.post("/ai-analysis")
async def ai_analysis(
    stmt: FinancialStatement,
    x_openai_key: Optional[str] = Header(default=None),
    x_claude_key: Optional[str] = Header(default=None),
    x_provider: Optional[str] = Header(default="auto"),
):
    """
    Generate AI-powered CFO-grade narrative analysis.
    Optionally pass your OpenAI API key in X-OpenAI-Key header,
    Claude API key in X-Claude-Key header, and preferred provider
    in X-Provider header (openai | claude | auto). Falls back to env vars.
    """
    try:
        report = _build_report(stmt)
        result = await generate_ai_analysis(
            report,
            claude_key=x_claude_key,
            openai_key=x_openai_key,
            provider=x_provider or "auto",
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis error: {str(e)}")
