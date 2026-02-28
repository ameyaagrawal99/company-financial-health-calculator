"""
Unified AI Gateway — wraps both Anthropic Claude and OpenAI GPT-4o behind one interface.
Handles analysis, streaming chat, and vision-based PDF extraction.
"""
import base64
import json
import os
import re
from pathlib import Path
from typing import Optional, AsyncIterator
from ..models.schemas import FinancialHealthReport, ChatMessage


SKILLS_DIR = Path(__file__).parent / "skills"


def _load_skill(name: str) -> str:
    """Load a markdown skill file; return empty string if not found."""
    path = SKILLS_DIR / f"{name}.md"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def build_financial_context(report: FinancialHealthReport) -> str:
    """Build a compact text block of all ratios for injection into chat prompts."""
    r = report.ratios
    s = report.sub_scores

    def fmt(v, suffix=""):
        return f"{v:.2f}{suffix}" if v is not None else "N/A"

    return f"""
COMPANY: {report.company_name}  |  FY: {report.financial_year}  |  Currency: ₹ {report.currency_unit}
Health Score: {report.health_score}/100 ({report.score_band})

SUB-SCORES
  Profitability: {s.profitability}/100  Liquidity: {s.liquidity}/100
  Leverage: {s.leverage}/100  Efficiency: {s.efficiency}/100
  Cash Flow: {s.cash_flow}/100  Compliance: {s.compliance}/100

PROFITABILITY
  Gross Margin: {fmt(r.gross_margin, "%")}  Net Margin: {fmt(r.net_profit_margin, "%")}
  EBITDA Margin: {fmt(r.ebitda_margin, "%")}  ROE: {fmt(r.roe, "%")}
  ROA: {fmt(r.roa, "%")}  ROCE: {fmt(r.roce, "%")}
  Revenue: ₹{fmt(r.revenue)}  Net Profit: ₹{fmt(r.net_profit)}

LIQUIDITY
  Current Ratio: {fmt(r.current_ratio, "x")}  Quick Ratio: {fmt(r.quick_ratio, "x")}
  Cash Ratio: {fmt(r.cash_ratio, "x")}  Working Capital: ₹{fmt(r.working_capital)}

LEVERAGE
  D/E: {fmt(r.debt_to_equity, "x")}  ICR: {fmt(r.interest_coverage, "x")}
  DSCR: {fmt(r.dscr, "x")}  Net Debt/EBITDA: {fmt(r.net_debt_to_ebitda, "x")}

EFFICIENCY
  DSO: {fmt(r.dso, " days")}  DPO: {fmt(r.dpo, " days")}
  DIO: {fmt(r.dio, " days")}  CCC: {fmt(r.cash_conversion_cycle, " days")}

CASH FLOW
  Operating CF: ₹{fmt(r.operating_cash_flow)}  Free CF: ₹{fmt(r.free_cash_flow)}
  CF Margin: {fmt(r.cash_flow_margin, "%")}

COMPLIANCE
  GST: {report.compliance.gst_status.value}
  TDS: {report.compliance.tds_status.value}
  MSME Overdue: {"YES" if report.compliance.msme_overdue else "No"}
  IBC Risk: {"YES" if report.compliance.ibc_risk else "No"}
""".strip()


def _resolve_provider(preferred: str, claude_key: Optional[str], openai_key: Optional[str]) -> str:
    """Resolve 'auto' to the first available provider."""
    if preferred == "auto":
        if claude_key:
            return "claude"
        if openai_key:
            return "openai"
        raise ValueError("No API key provided. Please add a Claude or OpenAI key in AI Settings.")
    if preferred == "claude" and not claude_key:
        raise ValueError("Claude selected but no Claude API key provided.")
    if preferred == "openai" and not openai_key:
        raise ValueError("OpenAI selected but no OpenAI API key provided.")
    return preferred


def _friendly_error(error_msg: str, provider: str) -> str:
    """Convert raw API errors to user-friendly messages."""
    if "invalid_api_key" in error_msg or "authentication" in error_msg.lower():
        return f"Invalid {provider.title()} API key. Please check your key in AI Settings."
    if "quota" in error_msg or "billing" in error_msg:
        return f"{provider.title()} quota exceeded. Please check your billing dashboard."
    # Token / context-size errors — e.g. OpenAI 429 "Request too large" or "tokens per min"
    if "token" in error_msg.lower() and any(
        kw in error_msg.lower() for kw in ("large", "limit", "exceeded", "maximum", "tpm", "context")
    ):
        return (
            f"The PDF has too many pages for your {provider.title()} account's token limit. "
            "Try a shorter document (2–3 pages), or switch to Claude which handles larger PDFs better."
        )
    if "rate_limit" in error_msg or "rate limit" in error_msg:
        return "Rate limit hit. Please wait a moment and try again."
    if "overloaded" in error_msg:
        return "Claude is temporarily overloaded. Try again in a moment, or switch to OpenAI."
    return error_msg


def _detect_image_mime(img_bytes: bytes) -> str:
    """Detect image MIME type from magic bytes — avoids hardcoding image/png for JPEG camera photos."""
    if img_bytes[:2] == b'\xff\xd8':
        return 'image/jpeg'
    if img_bytes[:4] == b'\x89PNG':
        return 'image/png'
    if img_bytes[:4] == b'RIFF' and img_bytes[8:12] == b'WEBP':
        return 'image/webp'
    if img_bytes[:4] == b'GIF8':
        return 'image/gif'
    return 'image/png'  # Safe fallback for PDF-converted pages


class AIGateway:
    """Unified interface for Claude and OpenAI."""

    def __init__(
        self,
        claude_key: Optional[str] = None,
        openai_key: Optional[str] = None,
    ):
        self.claude_key = claude_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.openai_key = openai_key or os.getenv("OPENAI_API_KEY", "")

    # ------------------------------------------------------------------ #
    #  Public: Analysis                                                    #
    # ------------------------------------------------------------------ #

    async def analyze(
        self,
        report: FinancialHealthReport,
        provider: str = "auto",
    ) -> dict:
        """Run full CFO analysis. Returns the same dict shape as the old ai_analyst.py."""
        try:
            resolved = _resolve_provider(provider, self.claude_key, self.openai_key)
        except ValueError as e:
            return {"available": False, "error": str(e), "analysis": None}

        skill = _load_skill("financial_analyst")
        from .ai_analyst import _build_prompt  # reuse existing prompt builder
        prompt = _build_prompt(report)

        try:
            if resolved == "claude":
                text = await self._claude_complete(prompt, system=skill)
                model_name = "claude-3-5-sonnet-20241022"
            else:
                text = await self._openai_complete(prompt, system=skill)
                model_name = "gpt-4o"

            return {
                "available": True,
                "error": None,
                "analysis": text,
                "model": model_name,
                "provider": resolved,
                "company_name": report.company_name,
                "financial_year": report.financial_year,
                "health_score": report.health_score,
                "score_band": report.score_band,
            }
        except Exception as e:
            return {
                "available": False,
                "error": _friendly_error(str(e), resolved),
                "analysis": None,
            }

    # ------------------------------------------------------------------ #
    #  Public: Layman Q&A                                                  #
    # ------------------------------------------------------------------ #

    async def generate_layman_qa(
        self,
        report: FinancialHealthReport,
        provider: str = "auto",
    ) -> list[dict]:
        """Answer 10 plain-English business health questions in a single API call.
        Returns a list of {question, answer} dicts."""
        try:
            resolved = _resolve_provider(provider, self.claude_key, self.openai_key)
        except ValueError as e:
            raise ValueError(str(e)) from e

        system = _load_skill("layman_qa")
        financial_data = build_financial_context(report)
        user_msg = (
            f"Here are the financial metrics for {report.company_name} ({report.financial_year}):\n\n"
            f"{financial_data}\n\n"
            "Now answer all 10 questions in the JSON format specified."
        )

        try:
            if resolved == "claude":
                raw = await self._claude_complete(user_msg, system=system, max_tokens=2500)
            else:
                raw = await self._openai_complete(user_msg, system=system, max_tokens=2500)
        except Exception as e:
            raise ValueError(_friendly_error(str(e), resolved)) from e

        # Strip possible markdown fences before parsing
        raw = re.sub(r"^```[a-z]*\n?", "", raw.strip(), flags=re.MULTILINE)
        raw = re.sub(r"\n?```$", "", raw.strip(), flags=re.MULTILINE)
        try:
            result = json.loads(raw.strip())
            if isinstance(result, list):
                return result
            raise ValueError("Expected a JSON array")
        except (json.JSONDecodeError, ValueError) as exc:
            raise ValueError(f"AI returned invalid JSON for layman Q&A: {exc}") from exc

    # ------------------------------------------------------------------ #
    #  Public: Streaming Chat                                              #
    # ------------------------------------------------------------------ #

    async def chat_stream(
        self,
        messages: list[ChatMessage],
        report: Optional[FinancialHealthReport] = None,
        provider: str = "auto",
        raw_text: Optional[str] = None,
    ) -> AsyncIterator[str]:
        """Yield text chunks for streaming chat. Each chunk is a plain string."""
        try:
            resolved = _resolve_provider(provider, self.claude_key, self.openai_key)
        except ValueError as e:
            yield f"[ERROR] {_friendly_error(str(e), provider)}"
            return

        # Build system prompt with financial context injected
        skill_template = _load_skill("chat_consultant")
        if report:
            financial_data = build_financial_context(report)
            system = skill_template.replace("{COMPANY_NAME}", report.company_name)
            system = system.replace("{FINANCIAL_YEAR}", report.financial_year)
            system = system.replace("{FINANCIAL_DATA}", financial_data)
        else:
            system = skill_template.replace("{COMPANY_NAME}", "the company")
            system = system.replace("{FINANCIAL_YEAR}", "the current financial year")
            system = system.replace("{FINANCIAL_DATA}", "No financial data uploaded yet.")

        # Append raw PDF text excerpt so the AI can answer questions about MD&A,
        # auditor remarks, risk factors etc. that don't appear in ratio tables.
        if raw_text and raw_text.strip():
            excerpt = raw_text.strip()[:3000]
            system += (
                "\n\n---\nADDITIONAL DOCUMENT CONTEXT (from original PDF — first 3000 chars)\n"
                f"{excerpt}\n---"
            )

        api_messages = [{"role": m.role, "content": m.content} for m in messages]

        if resolved == "claude":
            async for chunk in self._claude_stream(api_messages, system=system):
                yield chunk
        else:
            async for chunk in self._openai_stream(api_messages, system=system):
                yield chunk

    # ------------------------------------------------------------------ #
    #  Public: PDF Vision Extraction                                       #
    # ------------------------------------------------------------------ #

    async def extract_pdf_with_vision(
        self,
        image_bytes_list: list[bytes],
        provider: str = "auto",
    ) -> str:
        """Extract financial text from scanned PDF page images via vision API."""
        resolved = _resolve_provider(provider, self.claude_key, self.openai_key)

        prompt = (
            "These are pages from a scanned financial statement (P&L, Balance Sheet, or Cash Flow). "
            "Extract ALL financial line items and values you can read. "
            "Return a structured text list: 'Line Item: Value' per line. "
            "Preserve section headers (Balance Sheet / P&L / Cash Flow). "
            "If text is unclear, mark it with [UNCLEAR]."
        )

        try:
            if resolved == "claude":
                return await self._claude_vision(image_bytes_list, prompt)
            else:
                return await self._openai_vision(image_bytes_list, prompt)
        except Exception as e:
            raise ValueError(_friendly_error(str(e), resolved)) from e

    async def extract_pdf_native_claude(self, pdf_bytes: bytes) -> str:
        """Use Claude's native PDF API (beta) — no image conversion needed."""
        if not self.claude_key:
            raise ValueError("Claude API key required for native PDF extraction.")
        try:
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=self.claude_key)
            response = await client.beta.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                betas=["pdfs-2024-09-25"],
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": base64.standard_b64encode(pdf_bytes).decode("utf-8"),
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "Extract ALL financial line items and values from this financial statement. "
                                "Return structured text: 'Line Item: Value' per line. "
                                "Preserve section headers (Balance Sheet / P&L / Cash Flow)."
                            ),
                        },
                    ],
                }],
            )
            return response.content[0].text
        except Exception as e:
            raise ValueError(_friendly_error(str(e), "claude")) from e

    async def map_text_to_schema(
        self, extracted_text: str, provider: str = "auto"
    ) -> dict:
        """Use AI to map extracted PDF text to FinancialStatement JSON schema."""
        resolved = _resolve_provider(provider, self.claude_key, self.openai_key)

        system = (
            "You are a financial data extraction engine. "
            "Your ONLY job is to output valid JSON matching the given schema. "
            "No commentary, no markdown fences — just the JSON object."
        )

        schema_hint = """
Map the extracted text to this JSON structure (all values in same currency unit as source):
{
  "company_name": "string or null",
  "financial_year": "string like FY 2024-25 or null",
  "currency_unit": "units|thousands|lakhs|crores",
  "balance_sheet": {
    "fixed_assets": number_or_null,
    "inventory": number_or_null,
    "trade_receivables": number_or_null,
    "cash_and_equivalents": number_or_null,
    "other_current_assets": number_or_null,
    "share_capital": number_or_null,
    "reserves_surplus": number_or_null,
    "lt_borrowings": number_or_null,
    "st_borrowings": number_or_null,
    "trade_payables": number_or_null,
    "other_current_liabilities": number_or_null
  },
  "profit_loss": {
    "revenue_from_operations": number_or_null,
    "other_income": number_or_null,
    "raw_materials": number_or_null,
    "purchases": number_or_null,
    "employee_benefits": number_or_null,
    "finance_costs": number_or_null,
    "depreciation": number_or_null,
    "other_expenses": number_or_null,
    "tax_expense": number_or_null
  },
  "cash_flow": {
    "operating_cash_flow": number_or_null,
    "investing_cash_flow": number_or_null,
    "financing_cash_flow": number_or_null,
    "capex": number_or_null
  }
}
"""
        user_msg = f"{schema_hint}\n\nExtracted Text:\n{extracted_text}"

        try:
            if resolved == "claude":
                raw = await self._claude_complete(user_msg, system=system, max_tokens=2000)
            else:
                raw = await self._openai_complete(user_msg, system=system, max_tokens=2000)
        except Exception as e:
            raise ValueError(_friendly_error(str(e), resolved)) from e

        # Strip possible markdown fences before parsing
        raw = re.sub(r"^```[a-z]*\n?", "", raw.strip(), flags=re.MULTILINE)
        raw = re.sub(r"\n?```$", "", raw.strip(), flags=re.MULTILINE)
        try:
            return json.loads(raw.strip())
        except json.JSONDecodeError as exc:
            raise ValueError(f"AI returned invalid JSON: {exc}") from exc

    # ------------------------------------------------------------------ #
    #  Private: Claude calls                                               #
    # ------------------------------------------------------------------ #

    async def _claude_complete(
        self, user_msg: str, system: str = "", max_tokens: int = 3000
    ) -> str:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=self.claude_key)
        response = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=max_tokens,
            system=system or "You are a helpful financial analyst.",
            messages=[{"role": "user", "content": user_msg}],
        )
        return response.content[0].text

    async def _claude_stream(
        self, messages: list, system: str = ""
    ) -> AsyncIterator[str]:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=self.claude_key)
        async with client.messages.stream(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2048,
            system=system or "You are a helpful financial consultant.",
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def _claude_vision(self, image_bytes_list: list[bytes], prompt: str) -> str:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=self.claude_key)
        content = []
        for img_bytes in image_bytes_list[:12]:  # Max 12 pages
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": _detect_image_mime(img_bytes),  # Auto-detect JPEG/PNG/WebP
                    "data": base64.standard_b64encode(img_bytes).decode("utf-8"),
                },
            })
        content.append({"type": "text", "text": prompt})
        response = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            messages=[{"role": "user", "content": content}],
        )
        return response.content[0].text

    # ------------------------------------------------------------------ #
    #  Private: OpenAI calls                                               #
    # ------------------------------------------------------------------ #

    async def _openai_complete(
        self, user_msg: str, system: str = "", max_tokens: int = 3000
    ) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.openai_key)
        response = await client.chat.completions.create(
            model="gpt-4o",
            max_tokens=max_tokens,
            temperature=0.3,
            messages=[
                {"role": "system", "content": system or "You are a helpful financial analyst."},
                {"role": "user", "content": user_msg},
            ],
        )
        return response.choices[0].message.content or ""

    async def _openai_stream(
        self, messages: list, system: str = ""
    ) -> AsyncIterator[str]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.openai_key)
        stream = await client.chat.completions.create(
            model="gpt-4o",
            max_tokens=2048,
            temperature=0.4,
            stream=True,
            messages=[
                {"role": "system", "content": system or "You are a helpful financial consultant."},
                *messages,
            ],
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def _openai_vision(self, image_bytes_list: list[bytes], prompt: str) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.openai_key)
        content = [{"type": "text", "text": prompt}]
        # Cap at 6 pages for OpenAI to stay within free-tier TPM limits.
        # Use detail:"auto" so OpenAI picks low (~85 tokens) vs high (~1105 tokens)
        # based on image content — financial tables rarely need full high-detail tiles.
        for img_bytes in image_bytes_list[:6]:
            b64 = base64.standard_b64encode(img_bytes).decode("utf-8")
            mime = _detect_image_mime(img_bytes)  # Auto-detect JPEG/PNG/WebP
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "auto"},
            })
        response = await client.chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=[{"role": "user", "content": content}],
        )
        return response.choices[0].message.content or ""
