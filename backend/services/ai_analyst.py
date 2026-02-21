"""
AI-powered financial analyst using OpenAI GPT-4.
Provides plain-English narrative analysis, CFO-style commentary,
red flag detection, and India-specific strategic advice.
"""
import os
from typing import Optional
from ..models.schemas import FinancialHealthReport


def _build_prompt(report: FinancialHealthReport) -> str:
    """Build a rich, structured prompt for GPT-4 financial analysis."""
    r = report.ratios
    s = report.sub_scores
    c = report.compliance

    def fmt(v, suffix="", decimals=2):
        if v is None:
            return "N/A"
        return f"{v:.{decimals}f}{suffix}"

    recs_text = "\n".join(
        f"  [{rec.priority.value}] {rec.category}: {rec.finding}"
        for rec in report.recommendations[:10]
    )

    prompt = f"""You are a senior CFO and financial analyst with 20+ years of experience advising Indian SMEs,
mid-caps, and corporates. You have deep knowledge of Indian GAAP, Ind AS, GST, Companies Act 2013,
RBI lending norms, SEBI regulations, and the Indian business environment.

Analyze the following financial health report for **{report.company_name}** (FY: {report.financial_year})
and provide a comprehensive, actionable, CFO-grade narrative.

## FINANCIAL HEALTH OVERVIEW
- Overall Health Score: {report.health_score}/100 ({report.score_band})
- Currency: ₹ {report.currency_unit.title()}

## SUB-SCORES
- Profitability: {s.profitability}/100
- Liquidity: {s.liquidity}/100
- Leverage/Solvency: {s.leverage}/100
- Efficiency: {s.efficiency}/100
- Cash Flow Quality: {s.cash_flow}/100
- Compliance Risk: {s.compliance}/100

## KEY FINANCIAL RATIOS
### Profitability
- Gross Margin: {fmt(r.gross_margin, "%")}
- Net Profit Margin: {fmt(r.net_profit_margin, "%")}
- EBITDA Margin: {fmt(r.ebitda_margin, "%")}
- ROE: {fmt(r.roe, "%")}
- ROA: {fmt(r.roa, "%")}
- ROCE: {fmt(r.roce, "%")}

### Liquidity
- Current Ratio: {fmt(r.current_ratio, "x")}
- Quick Ratio: {fmt(r.quick_ratio, "x")}
- Cash Ratio: {fmt(r.cash_ratio, "x")}
- Working Capital: ₹{fmt(r.working_capital)} {report.currency_unit}

### Leverage & Solvency
- Debt-to-Equity: {fmt(r.debt_to_equity, "x")}
- Interest Coverage: {fmt(r.interest_coverage, "x")}
- DSCR: {fmt(r.dscr, "x")}
- Net Debt/EBITDA: {fmt(r.net_debt_to_ebitda, "x")}

### Efficiency
- DSO: {fmt(r.dso, " days")}
- DPO: {fmt(r.dpo, " days")}
- DIO: {fmt(r.dio, " days")}
- Cash Conversion Cycle: {fmt(r.cash_conversion_cycle, " days")}
- Asset Turnover: {fmt(r.asset_turnover, "x")}
- Inventory Turnover: {fmt(r.inventory_turnover, "x")}

### Cash Flow
- Operating Cash Flow: ₹{fmt(r.operating_cash_flow)} {report.currency_unit}
- Free Cash Flow: ₹{fmt(r.free_cash_flow)} {report.currency_unit}
- Cash Flow Margin: {fmt(r.cash_flow_margin, "%")}

## COMPLIANCE STATUS
- GST: {c.gst_status.value}
- TDS/TCS: {c.tds_status.value}
- PF/ESI: {c.pf_esi_status.value}
- MSME Overdue: {"YES ⚠️" if c.msme_overdue else "No"}
- IBC Risk: {"YES 🚨" if c.ibc_risk else "No"}
- ROC Filings: {c.roc_status.value}

## TOP RECOMMENDATIONS ALREADY IDENTIFIED
{recs_text}

---

Please provide a structured analysis with the following sections. Be specific, quantitative, and India-context aware:

### 1. EXECUTIVE SUMMARY (3-4 sentences)
Plain-English verdict on the company's financial health. What's the single most important thing the board needs to know?

### 2. STRENGTHS (3-5 bullet points)
What is this company doing well financially? Be specific with numbers.

### 3. CRITICAL CONCERNS (3-5 bullet points)
What are the most urgent problems requiring immediate attention? Quantify the risk.

### 4. WORKING CAPITAL ANALYSIS
Deep dive into the cash conversion cycle, receivables, payables, and inventory dynamics. What's the working capital funding gap? India-specific context (MSME payments, trade credit norms).

### 5. DEBT & SOLVENCY ASSESSMENT
Is the debt level sustainable? How would a banker/lender view this company? Reference RBI norms, bank credit ratings implications.

### 6. PROFITABILITY DEEP DIVE
Is the margin profile healthy for this type of business? What's compressing margins? What levers exist to improve?

### 7. COMPLIANCE RISK ASSESSMENT
What regulatory risks could crystallize into cash outflows or operational disruptions? Prioritize by severity.

### 8. STRATEGIC RECOMMENDATIONS (5-7 actionable items)
CFO-grade action items with specific targets, timelines, and expected financial impact. India-specific playbook.

### 9. BANKER/INVESTOR PERSPECTIVE
How would a lender or investor view this company today? What would they want to see improved before extending credit or investing?

### 10. 90-DAY ACTION PLAN
The top 3 things the CFO/MD should do in the next 90 days to materially improve the health score.

Keep the tone professional but accessible — as if presenting to a board of directors. Use ₹ amounts and Indian financial terminology where appropriate.
"""
    return prompt


async def generate_ai_analysis(
    report: FinancialHealthReport,
    api_key: Optional[str] = None
) -> dict:
    """
    Generate AI-powered financial analysis using OpenAI GPT-4.
    Returns structured analysis sections.
    """
    key = api_key or os.getenv("OPENAI_API_KEY", "")
    if not key:
        return {
            "available": False,
            "error": "OpenAI API key not configured. Please set OPENAI_API_KEY in your environment.",
            "analysis": None
        }

    try:
        # Lazy import so the app works without openai installed
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=key)
        prompt = _build_prompt(report)

        response = await client.chat.completions.create(
            model="gpt-4o",          # Use GPT-4o for best quality + speed
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a senior CFO and financial analyst specializing in Indian businesses. "
                        "Provide precise, quantitative, actionable analysis. "
                        "Always reference Indian regulatory context (GST, Companies Act, RBI norms, Ind AS). "
                        "Format your response with clear markdown headers and bullet points."
                    )
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,         # Low temperature for factual financial analysis
            max_tokens=3000,
        )

        analysis_text = response.choices[0].message.content
        tokens_used = response.usage.total_tokens

        return {
            "available": True,
            "error": None,
            "analysis": analysis_text,
            "model": "gpt-4o",
            "tokens_used": tokens_used,
            "company_name": report.company_name,
            "financial_year": report.financial_year,
            "health_score": report.health_score,
            "score_band": report.score_band,
        }

    except ImportError:
        return {
            "available": False,
            "error": "OpenAI package not installed. Run: pip install openai",
            "analysis": None
        }
    except Exception as e:
        error_msg = str(e)
        # Provide helpful messages for common errors
        if "invalid_api_key" in error_msg or "Incorrect API key" in error_msg:
            error_msg = "Invalid OpenAI API key. Please check your key at platform.openai.com"
        elif "insufficient_quota" in error_msg:
            error_msg = "OpenAI quota exceeded. Please check your billing at platform.openai.com"
        elif "rate_limit" in error_msg:
            error_msg = "OpenAI rate limit hit. Please try again in a moment."
        return {
            "available": False,
            "error": error_msg,
            "analysis": None
        }
