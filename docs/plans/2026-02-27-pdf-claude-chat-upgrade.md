# PDF + Claude API + Chat Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add scanned/digital PDF parsing, Claude API support alongside OpenAI, expert skill system prompts, and a streaming financial-consultant chat feature grounded in uploaded data.

**Architecture:** A unified `AIGateway` service wraps both Anthropic and OpenAI behind one interface; the PDF parser auto-detects digital vs scanned and routes to the cheapest extraction strategy; a new `/api/chat` SSE endpoint streams responses token-by-token; the frontend stores API keys in localStorage and chat history per company.

**Tech Stack:** FastAPI + anthropic + pypdf + pdf2image + Pillow (backend) · Next.js 14 + react-markdown + remark-gfm + Zustand persist (frontend) · Vercel (deploy)

---

## Task 1: Backend Dependencies + Dockerfile

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/Dockerfile`

**Step 1: Add Python packages to requirements.txt**

Replace the file's dependencies block with:

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
python-multipart>=0.0.9
openpyxl>=3.1.2
xlrd>=2.0.1
pandas>=2.2.0
openai>=1.30.0
anthropic>=0.25.0
pypdf>=4.0.0
pdf2image>=1.17.0
Pillow>=10.3.0
httpx>=0.27.0
```

**Step 2: Add poppler to Dockerfile**

Locate the `apt-get` / `pip install` section and add `poppler-utils` before the pip install step:

```dockerfile
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libpoppler-dev \
    && rm -rf /var/lib/apt/lists/*
```

If no Dockerfile exists yet, create one at `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    poppler-utils \
    libpoppler-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 3: Verify imports work locally**

```bash
cd backend
pip install anthropic pypdf pdf2image Pillow
python -c "import anthropic, pypdf, pdf2image; print('OK')"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add backend/requirements.txt backend/Dockerfile
git commit -m "chore: add anthropic, pypdf, pdf2image, pillow, poppler deps"
```

---

## Task 2: Extend Pydantic Schemas

**Files:**
- Modify: `backend/models/schemas.py`

**Step 1: Add imports at top of schemas.py**

After the existing imports add:

```python
from typing import Literal
```

**Step 2: Add ChatMessage and ChatRequest models**

After the `ParsedFileResponse` class, add:

```python
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    statement: Optional[FinancialStatement] = None
    provider: str = "auto"   # "auto" | "claude" | "openai"
```

**Step 3: Add MonthlyBudget stub to FinancialStatement**

Inside `FinancialStatement`, after `ibc_overdue_amount`:

```python
class MonthlyBudget(BaseModel):
    """Stub — will be populated when monthly budget feature is built."""
    month: Optional[str] = None               # e.g. "April 2025"
    revenue_budget: Optional[float] = None
    expense_budget: Optional[float] = None
    actual_revenue: Optional[float] = None
    actual_expense: Optional[float] = None
    variance_note: Optional[str] = None
```

And in `FinancialStatement`:

```python
budget: Optional[MonthlyBudget] = None
```

**Step 4: Verify no import errors**

```bash
cd backend
python -c "from models.schemas import ChatMessage, ChatRequest, MonthlyBudget; print('OK')"
```

Expected: `OK`

**Step 5: Commit**

```bash
git add backend/models/schemas.py
git commit -m "feat: add ChatMessage, ChatRequest, MonthlyBudget schemas"
```

---

## Task 3: Write Three AI Skill Files

**Files:**
- Create: `backend/services/skills/financial_analyst.md`
- Create: `backend/services/skills/ratio_explainer.md`
- Create: `backend/services/skills/chat_consultant.md`

**Step 1: Create skills directory**

```bash
mkdir -p backend/services/skills
```

**Step 2: Create financial_analyst.md**

```markdown
# Financial Analyst Skill — Arjun Mehta, CFO

## Persona
You are Arjun Mehta, a senior CFO with 25 years advising Indian listed and unlisted companies.
Your expertise spans Indian GAAP, Ind AS, GST, Companies Act 2013, RBI lending norms, SEBI LODR,
and the realities of Indian SME and mid-cap finance. You speak plainly but with authority.

## Mandatory Output Format
1. Every financial claim MUST cite a specific ratio or line item value from the data provided.
2. Recommendations follow the format: **Action → Timeline → Expected Impact**.
3. Use Indian benchmarks (RBI SME lending norms, Ind AS standards, MSME Payment Act).
4. Flag items with: ⚠️ (Risk) · ✅ (Strength) · 💡 (Opportunity)

## Guardrails
- If a ratio is missing or cannot be computed, say "Data not available — cannot assess [X]".
- Never invent or extrapolate numbers not present in the provided data.
- If asked for industry comparisons beyond the data, state "Industry benchmark: [value] — your company: [value from data]".
- Never provide legal or tax advice; direct users to a CA/CS for compliance decisions.

## Analysis Structure
1. Executive Summary (3-4 sentences, board-ready)
2. Strengths (bullet points with numbers)
3. Critical Concerns (bullet points with quantified risk)
4. Working Capital Analysis (DSO, DPO, DIO, CCC)
5. Debt & Solvency Assessment (D/E, ICR, DSCR, banker view)
6. Profitability Deep Dive (margins, ROCE, margin levers)
7. Compliance Risk Assessment (GST, TDS, MSME, ROC)
8. Strategic Recommendations (Action → Timeline → Impact format)
9. Banker/Investor Perspective
10. 90-Day Action Plan (top 3 CFO priorities)
```

**Step 3: Create ratio_explainer.md**

```markdown
# Ratio Explainer Skill — Priya Sharma, CA + CFA

## Persona
You are Priya Sharma, a Chartered Accountant and CFA Charterholder specialising in financial
education for Indian business owners. You explain ratios in plain language without losing precision.

## Mandatory Output Format Per Ratio
1. **Formula** — exact formula using line items
2. **What It Measures** — one sentence
3. **This Company's Value** — cite the actual number from the data
4. **Indian Benchmark** — typical range for Indian businesses of this type
5. **One Action** — the single most impactful thing to move this ratio in the right direction

## Guardrails
- Always start with the formula and the actual computed value before interpreting.
- If a ratio cannot be computed (missing data), state which line items are missing.
- Keep explanations under 200 words per ratio unless the user asks for more.
- Avoid jargon unless you immediately define it.
```

**Step 4: Create chat_consultant.md**

```markdown
# Financial Chat Consultant Skill

## Context Injection Template
This template is filled at runtime. DO NOT treat placeholder text as real data.

```
Company: {COMPANY_NAME}
Financial Year: {FINANCIAL_YEAR}
Uploaded Financial Data:
{FINANCIAL_DATA}
```

## Persona
You are a sharp, pragmatic financial consultant with deep knowledge of Indian business finance.
You speak like a trusted advisor — direct, specific, never vague.

## Conversation Rules
1. **Data-first**: All financial claims MUST reference the data above. Cite the specific value.
2. **Source tags**:
   - Use 📊 when drawing from uploaded data.
   - Use 📚 when giving general financial guidance not from the data.
   - Use ⚠️ when flagging something unverified or needing CA/CS confirmation.
3. **No fabrication**: If a value is not in the data, say "That data wasn't uploaded."
4. **Context awareness**: Refer to {COMPANY_NAME} by name; personalise every response.
5. **Scope limit**: If asked about topics unrelated to finance (e.g., HR, IT), politely redirect.
6. **Budget mode**: If monthly budget data is present, compare actuals vs. budget. If absent, note it.

## Response Format
- Use bullet points for lists of 3+ items.
- Bold key numbers and ratios.
- Keep initial responses concise (under 200 words). Offer to elaborate.
- End with a follow-up question to deepen the conversation.
```

**Step 5: Commit**

```bash
git add backend/services/skills/
git commit -m "feat: add financial_analyst, ratio_explainer, chat_consultant skill files"
```

---

## Task 4: Build AIGateway Service

**Files:**
- Create: `backend/services/ai_gateway.py`

**Step 1: Create ai_gateway.py**

```python
"""
Unified AI Gateway — wraps both Anthropic Claude and OpenAI GPT-4o behind one interface.
Handles analysis, streaming chat, and vision-based PDF extraction.
"""
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
    if "rate_limit" in error_msg or "rate limit" in error_msg:
        return "Rate limit hit. Please wait a moment and try again."
    if "overloaded" in error_msg:
        return "Claude is temporarily overloaded. Try again in a moment, or switch to OpenAI."
    return error_msg


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
        from ..services.ai_analyst import _build_prompt  # reuse existing prompt builder
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
    #  Public: Streaming Chat                                              #
    # ------------------------------------------------------------------ #

    async def chat_stream(
        self,
        messages: list[ChatMessage],
        report: Optional[FinancialHealthReport] = None,
        provider: str = "auto",
    ) -> AsyncIterator[str]:
        """Yield text chunks for streaming chat. Each chunk is a plain string."""
        resolved = _resolve_provider(provider, self.claude_key, self.openai_key)

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

        if resolved == "claude":
            return await self._claude_vision(image_bytes_list, prompt)
        else:
            return await self._openai_vision(image_bytes_list, prompt)

    async def extract_pdf_native_claude(self, pdf_bytes: bytes) -> str:
        """Use Claude's native PDF API (beta) — no image conversion needed."""
        import anthropic
        import base64

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

        if resolved == "claude":
            raw = await self._claude_complete(user_msg, system=system, max_tokens=2000)
        else:
            raw = await self._openai_complete(user_msg, system=system, max_tokens=2000)

        import json
        # Strip possible markdown fences before parsing
        raw = re.sub(r"^```[a-z]*\n?", "", raw.strip(), flags=re.MULTILINE)
        raw = re.sub(r"\n?```$", "", raw.strip(), flags=re.MULTILINE)
        return json.loads(raw.strip())

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
        import base64
        client = anthropic.AsyncAnthropic(api_key=self.claude_key)
        content = []
        for img_bytes in image_bytes_list[:12]:  # Max 12 pages
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64.standard_b64encode(img_bytes).decode("utf-8"),
                },
            })
        content.append({"type": "text", "text": prompt})
        response = await anthropic.AsyncAnthropic(api_key=self.claude_key).messages.create(
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
        return response.choices[0].message.content

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
        import base64
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.openai_key)
        content = [{"type": "text", "text": prompt}]
        for img_bytes in image_bytes_list[:12]:
            b64 = base64.standard_b64encode(img_bytes).decode("utf-8")
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"},
            })
        response = await client.chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=[{"role": "user", "content": content}],
        )
        return response.choices[0].message.content
```

**Step 2: Smoke-test the module imports**

```bash
cd backend
python -c "from services.ai_gateway import AIGateway, build_financial_context; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/services/ai_gateway.py
git commit -m "feat: add AIGateway — unified Claude+OpenAI service with streaming + vision"
```

---

## Task 5: Build PDF Parser Service

**Files:**
- Create: `backend/services/pdf_parser.py`

**Step 1: Create pdf_parser.py**

```python
"""
PDF parser — handles both digital (text-based) and scanned (image-based) PDFs.

Strategy:
  1. Try pypdf text extraction (fast, free)
  2. If text insufficient AND Claude key present → Claude native PDF API
  3. Else → pdf2image + vision API
  4. Map extracted text to FinancialStatement schema via AI
"""
import io
from typing import Optional
from .ai_gateway import AIGateway


MIN_TEXT_CHARS = 150   # Below this = likely scanned


def _extract_digital_text(pdf_bytes: bytes) -> tuple[str, int]:
    """Extract text from a digital PDF using pypdf. Returns (text, page_count)."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)
    return "\n\n".join(pages), len(reader.pages)


def _is_text_sufficient(text: str, min_chars: int = MIN_TEXT_CHARS) -> bool:
    """Return True if extracted text looks like real financial data."""
    stripped = text.strip()
    if len(stripped) < min_chars:
        return False
    # Must contain at least some digits (financial data has numbers)
    digit_count = sum(1 for c in stripped if c.isdigit())
    return digit_count >= 10


def _pdf_to_images(pdf_bytes: bytes, max_pages: int = 12) -> list[bytes]:
    """Convert PDF pages to PNG bytes using pdf2image + poppler."""
    from pdf2image import convert_from_bytes
    from PIL import Image

    pil_images = convert_from_bytes(pdf_bytes, dpi=200, fmt="PNG")
    result = []
    for pil_img in pil_images[:max_pages]:
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        result.append(buf.getvalue())
    return result


async def parse_pdf_file(
    pdf_bytes: bytes,
    filename: str,
    claude_key: Optional[str] = None,
    openai_key: Optional[str] = None,
) -> dict:
    """
    Main entry point. Returns a dict compatible with ParsedFileResponse.
    Raises ValueError if parsing fails and no AI keys are provided for scanned PDFs.
    """
    gateway = AIGateway(claude_key=claude_key, openai_key=openai_key)
    has_any_key = bool(claude_key or openai_key)

    # Step 1: Try digital text extraction
    try:
        raw_text, page_count = _extract_digital_text(pdf_bytes)
    except Exception as e:
        raise ValueError(f"Could not read PDF file: {e}")

    extraction_method = "digital"
    extracted_text = ""

    if _is_text_sufficient(raw_text):
        extracted_text = raw_text
    elif not has_any_key:
        raise ValueError(
            "This appears to be a scanned PDF. Please add a Claude or OpenAI API key "
            "in AI Settings to enable vision-based extraction."
        )
    elif claude_key:
        # Try Claude native PDF API first (cheaper than image conversion)
        try:
            extracted_text = await gateway.extract_pdf_native_claude(pdf_bytes)
            extraction_method = "claude_native_pdf"
        except Exception:
            # Native PDF API failed (e.g., beta not available) — fall back to vision
            images = _pdf_to_images(pdf_bytes)
            extracted_text = await gateway.extract_pdf_with_vision(images, provider="claude")
            extraction_method = "vision_claude"
    else:
        # OpenAI vision
        images = _pdf_to_images(pdf_bytes)
        extracted_text = await gateway.extract_pdf_with_vision(images, provider="openai")
        extraction_method = "vision_openai"

    if not extracted_text.strip():
        raise ValueError("Could not extract any financial data from the PDF.")

    # Step 2: Map extracted text to FinancialStatement schema
    provider = "claude" if claude_key else "openai"
    schema_data = await gateway.map_text_to_schema(extracted_text, provider=provider)

    # Attach metadata
    schema_data["_extraction_method"] = extraction_method
    schema_data["_page_count"] = page_count if extraction_method == "digital" else None

    return {
        "sheets": ["PDF Import"],
        "detected_type": "financial_statement",
        "confidence": 0.85,
        "columns": list(schema_data.keys()),
        "preview": [schema_data],
        "mapping_suggestions": {},
        "financial_year": schema_data.get("financial_year"),
        "currency_unit": schema_data.get("currency_unit", "lakhs"),
        "parsed_statement": schema_data,
    }
```

**Step 2: Verify imports**

```bash
cd backend
python -c "from services.pdf_parser import parse_pdf_file; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/services/pdf_parser.py
git commit -m "feat: add PDF parser with digital/scanned detection and AI extraction"
```

---

## Task 6: Update Upload Router for PDFs

**Files:**
- Modify: `backend/routers/upload.py`

**Step 1: Replace upload.py content**

```python
from fastapi import APIRouter, UploadFile, File, Header, HTTPException
from typing import Optional
from ..services.excel_parser import parse_excel_file
from ..services.pdf_parser import parse_pdf_file
from ..models.schemas import ParsedFileResponse

router = APIRouter(prefix="/api", tags=["upload"])

ALLOWED_EXTENSIONS = {'.xlsx', '.xls', '.csv', '.pdf'}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB (PDFs can be larger)


@router.post("/upload", response_model=ParsedFileResponse)
async def upload_file(
    file: UploadFile = File(...),
    x_claude_key: Optional[str] = Header(default=None),
    x_openai_key: Optional[str] = Header(default=None),
):
    """Upload financial statement (Excel/CSV/PDF) and return parsed data."""
    filename = file.filename or ""
    ext = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not supported. Use .xlsx, .xls, .csv, or .pdf"
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 20MB.")

    try:
        if ext == '.pdf':
            result = await parse_pdf_file(
                file_bytes, filename,
                claude_key=x_claude_key,
                openai_key=x_openai_key,
            )
        else:
            result = parse_excel_file(file_bytes, filename)

        return ParsedFileResponse(
            sheets=result["sheets"],
            detected_type=result["detected_type"],
            confidence=result["confidence"],
            columns=result["columns"],
            preview=result["preview"],
            mapping_suggestions=result["mapping_suggestions"],
            financial_year=result.get("financial_year"),
            currency_unit=result.get("currency_unit"),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")
```

**Step 2: Verify router imports**

```bash
cd backend
python -c "from routers.upload import router; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/routers/upload.py
git commit -m "feat: upload router now accepts .pdf with AI key pass-through"
```

---

## Task 7: Refactor ai_analyst.py to Delegate to AIGateway

**Files:**
- Modify: `backend/services/ai_analyst.py`

**Step 1: Replace ai_analyst.py content**

Keep the `_build_prompt` function intact (AIGateway imports it). Only change `generate_ai_analysis` to delegate:

```python
"""
AI-powered financial analyst — thin wrapper around AIGateway.
The _build_prompt function is kept here and imported by AIGateway.
"""
import os
from typing import Optional
from ..models.schemas import FinancialHealthReport
from .ai_gateway import AIGateway


def _build_prompt(report: FinancialHealthReport) -> str:
    """Build a rich, structured prompt for financial analysis."""
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

    return f"""Analyze the following financial health report for **{report.company_name}** (FY: {report.financial_year}).

## FINANCIAL HEALTH OVERVIEW
- Overall Health Score: {report.health_score}/100 ({report.score_band})
- Currency: Rs {report.currency_unit.title()}

## SUB-SCORES
- Profitability: {s.profitability}/100
- Liquidity: {s.liquidity}/100
- Leverage/Solvency: {s.leverage}/100
- Efficiency: {s.efficiency}/100
- Cash Flow Quality: {s.cash_flow}/100
- Compliance Risk: {s.compliance}/100

## KEY FINANCIAL RATIOS
Gross Margin: {fmt(r.gross_margin, "%")} | Net Margin: {fmt(r.net_profit_margin, "%")} | EBITDA Margin: {fmt(r.ebitda_margin, "%")}
ROE: {fmt(r.roe, "%")} | ROA: {fmt(r.roa, "%")} | ROCE: {fmt(r.roce, "%")}
Current Ratio: {fmt(r.current_ratio, "x")} | Quick Ratio: {fmt(r.quick_ratio, "x")} | Cash Ratio: {fmt(r.cash_ratio, "x")}
D/E: {fmt(r.debt_to_equity, "x")} | ICR: {fmt(r.interest_coverage, "x")} | DSCR: {fmt(r.dscr, "x")}
DSO: {fmt(r.dso, " days")} | DPO: {fmt(r.dpo, " days")} | CCC: {fmt(r.cash_conversion_cycle, " days")}
Operating CF: Rs{fmt(r.operating_cash_flow)} | Free CF: Rs{fmt(r.free_cash_flow)}

## COMPLIANCE
GST: {c.gst_status.value} | TDS: {c.tds_status.value} | MSME Overdue: {"YES" if c.msme_overdue else "No"} | IBC Risk: {"YES" if c.ibc_risk else "No"}

## TOP RECOMMENDATIONS
{recs_text}

Provide comprehensive CFO-grade analysis following the financial_analyst skill structure.
"""


async def generate_ai_analysis(
    report: FinancialHealthReport,
    api_key: Optional[str] = None,
    claude_key: Optional[str] = None,
    openai_key: Optional[str] = None,
    provider: str = "auto",
) -> dict:
    """
    Generate AI analysis. Delegates to AIGateway.
    Backward-compatible: old 'api_key' param is treated as openai_key.
    """
    effective_openai = openai_key or api_key or os.getenv("OPENAI_API_KEY", "")
    effective_claude = claude_key or os.getenv("ANTHROPIC_API_KEY", "")

    gateway = AIGateway(claude_key=effective_claude, openai_key=effective_openai)
    return await gateway.analyze(report, provider=provider)
```

**Step 2: Verify backward compatibility**

```bash
cd backend
python -c "from services.ai_analyst import generate_ai_analysis, _build_prompt; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/services/ai_analyst.py
git commit -m "refactor: ai_analyst.py now delegates to AIGateway; backward-compatible"
```

---

## Task 8: Update Calculate Router for Multi-Provider

**Files:**
- Modify: `backend/routers/calculate.py`

**Step 1: Find the ai-analysis endpoint in calculate.py and update its signature**

Locate the `@router.post("/api/ai-analysis")` endpoint. Update it to accept both key headers:

```python
@router.post("/api/ai-analysis")
async def ai_analysis(
    stmt: FinancialStatement,
    x_openai_key: Optional[str] = Header(default=None),
    x_claude_key: Optional[str] = Header(default=None),
    x_provider: Optional[str] = Header(default="auto"),
):
    report = run_full_calculation(stmt)
    result = await generate_ai_analysis(
        report,
        claude_key=x_claude_key,
        openai_key=x_openai_key,
        provider=x_provider or "auto",
    )
    return result
```

Also add `Optional` and `Header` to imports at top of calculate.py if not already there:

```python
from fastapi import APIRouter, Header
from typing import Optional
```

**Step 2: Verify**

```bash
cd backend
python -c "from routers.calculate import router; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/routers/calculate.py
git commit -m "feat: calculate router passes Claude+OpenAI keys to ai_analyst"
```

---

## Task 9: Create Chat Router (SSE Streaming)

**Files:**
- Create: `backend/routers/chat.py`

**Step 1: Create chat.py**

```python
"""
Streaming chat endpoint — SSE (Server-Sent Events).
The client reads token-by-token using fetch + ReadableStream.
"""
import json
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
from ..models.schemas import ChatRequest, FinancialStatement
from ..services.ai_gateway import AIGateway
from ..services.calculator import run_full_calculation

router = APIRouter(prefix="/api", tags=["chat"])


async def _event_generator(gateway: AIGateway, request: ChatRequest):
    """Generate SSE events from the AI stream."""
    report = None
    if request.statement:
        try:
            report = run_full_calculation(request.statement)
        except Exception:
            report = None  # Chat still works without computed ratios

    try:
        async for chunk in gateway.chat_stream(
            messages=request.messages,
            report=report,
            provider=request.provider,
        ):
            payload = json.dumps({"text": chunk, "done": False})
            yield f"data: {payload}\n\n"
    except ValueError as e:
        # Provider resolution error (no API key)
        payload = json.dumps({"error": str(e), "done": True})
        yield f"data: {payload}\n\n"
        return
    except Exception as e:
        payload = json.dumps({"error": f"Chat error: {str(e)}", "done": True})
        yield f"data: {payload}\n\n"
        return

    yield f"data: {json.dumps({'done': True})}\n\n"


@router.post("/chat")
async def chat(
    request: ChatRequest,
    x_claude_key: Optional[str] = Header(default=None),
    x_openai_key: Optional[str] = Header(default=None),
):
    """Stream chat responses as Server-Sent Events."""
    if not x_claude_key and not x_openai_key:
        raise HTTPException(
            status_code=400,
            detail="No API key provided. Add a Claude or OpenAI key in AI Settings."
        )

    gateway = AIGateway(claude_key=x_claude_key, openai_key=x_openai_key)

    return StreamingResponse(
        _event_generator(gateway, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Disable nginx buffering for true streaming
        },
    )
```

**Step 2: Verify**

```bash
cd backend
python -c "from routers.chat import router; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/routers/chat.py
git commit -m "feat: add SSE streaming chat router at /api/chat"
```

---

## Task 10: Register Chat Router in main.py

**Files:**
- Modify: `backend/main.py`

**Step 1: Add chat router import and registration**

```python
from .routers import upload, calculate, chat   # add chat

# After existing app.include_router lines:
app.include_router(chat.router)
```

**Step 2: Verify server starts**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Expected: Server starts, no import errors. Ctrl+C to stop.

**Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: register chat router in FastAPI app"
```

---

## Task 11: Create Frontend AI Keys Utility

**Files:**
- Create: `frontend/lib/ai-keys.ts`

**Step 1: Create ai-keys.ts**

```typescript
/**
 * AI key management — stores Claude and OpenAI keys in localStorage.
 * Keys NEVER leave the browser except as request headers to the backend.
 */

const CLAUDE_KEY  = 'fin_health_claude_key'
const OPENAI_KEY  = 'fin_health_openai_key'
const PROVIDER    = 'fin_health_ai_provider'

export type AIProvider = 'auto' | 'claude' | 'openai'

function safeGet(key: string): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(key) || ''
}

export const AIKeys = {
  getClaude:   () => safeGet(CLAUDE_KEY),
  getOpenAI:   () => safeGet(OPENAI_KEY),
  getProvider: (): AIProvider => (safeGet(PROVIDER) as AIProvider) || 'auto',

  setClaude:   (k: string) => localStorage.setItem(CLAUDE_KEY, k),
  setOpenAI:   (k: string) => localStorage.setItem(OPENAI_KEY, k),
  setProvider: (p: AIProvider) => localStorage.setItem(PROVIDER, p),

  clear: () => {
    localStorage.removeItem(CLAUDE_KEY)
    localStorage.removeItem(OPENAI_KEY)
    localStorage.removeItem(PROVIDER)
  },

  /** Returns headers to pass to every API fetch call. */
  getHeaders: (): Record<string, string> => {
    const h: Record<string, string> = {}
    const claude  = safeGet(CLAUDE_KEY)
    const openai  = safeGet(OPENAI_KEY)
    const provider = safeGet(PROVIDER) || 'auto'
    if (claude)  h['X-Claude-Key']  = claude
    if (openai)  h['X-OpenAI-Key']  = openai
    h['X-Provider'] = provider
    return h
  },

  /** Returns true if at least one key is set. */
  hasAnyKey: () => Boolean(safeGet(CLAUDE_KEY) || safeGet(OPENAI_KEY)),

  /** Mask key for display: sk-ant-api03-...XXXX */
  maskKey: (key: string): string => {
    if (!key || key.length < 8) return '(empty)'
    return key.slice(0, 10) + '...' + key.slice(-4)
  },
}
```

**Step 2: Verify TypeScript compilation**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors for ai-keys.ts

**Step 3: Commit**

```bash
git add frontend/lib/ai-keys.ts
git commit -m "feat: add AIKeys utility for Claude+OpenAI key management in localStorage"
```

---

## Task 12: Create Chat Store (Zustand + LocalStorage)

**Files:**
- Create: `frontend/lib/chat-store.ts`

**Step 1: Create chat-store.ts**

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

interface ChatState {
  // Map key: "companyName::financialYear"
  histories: Record<string, ChatMessage[]>
  activeKey: string

  setActiveCompany: (companyName: string, financialYear: string) => void
  getMessages: () => ChatMessage[]
  addMessage: (role: 'user' | 'assistant', content: string) => string  // returns id
  updateMessage: (id: string, content: string) => void
  clearHistory: () => void
}

const MAX_MESSAGES = 100
const TRIM_TO = 80

function makeKey(company: string, year: string): string {
  return `${company}::${year}`
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      histories: {},
      activeKey: '',

      setActiveCompany: (companyName, financialYear) => {
        set({ activeKey: makeKey(companyName, financialYear) })
      },

      getMessages: () => {
        const { histories, activeKey } = get()
        return histories[activeKey] || []
      },

      addMessage: (role, content) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const msg: ChatMessage = { id, role, content, createdAt: Date.now() }

        set((state) => {
          const key = state.activeKey
          const existing = state.histories[key] || []
          let updated = [...existing, msg]
          // Trim to avoid unbounded localStorage growth
          if (updated.length > MAX_MESSAGES) {
            updated = updated.slice(updated.length - TRIM_TO)
          }
          return {
            histories: { ...state.histories, [key]: updated },
          }
        })
        return id
      },

      updateMessage: (id, content) => {
        set((state) => {
          const key = state.activeKey
          const messages = (state.histories[key] || []).map((m) =>
            m.id === id ? { ...m, content } : m
          )
          return { histories: { ...state.histories, [key]: messages } }
        })
      },

      clearHistory: () => {
        set((state) => ({
          histories: { ...state.histories, [state.activeKey]: [] },
        }))
      },
    }),
    {
      name: 'fin-chat-history',
      storage: createJSONStorage(() => localStorage),
      // Only persist the histories map, not ephemeral activeKey
      partialize: (state) => ({ histories: state.histories }),
    }
  )
)
```

**Step 2: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/lib/chat-store.ts
git commit -m "feat: add Zustand chat store with per-company localStorage persistence"
```

---

## Task 13: Update api.ts for Multi-Provider + Chat Streaming

**Files:**
- Modify: `frontend/lib/api.ts`

**Step 1: Replace the getAIAnalysis function and add streamChat**

Find and replace the existing `getAIAnalysis` function, and add `streamChat` after `triggerDownload`:

```typescript
export async function getAIAnalysis(
  stmt: FinancialStatement,
  aiHeaders: Record<string, string> = {}
): Promise<{
  available: boolean
  error: string | null
  analysis: string | null
  model?: string
  provider?: string
  tokens_used?: number
  health_score?: number
  score_band?: string
}> {
  const res = await fetch(`${API_URL}/api/ai-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiHeaders },
    body: JSON.stringify(stmt),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'AI analysis failed')
  }
  return res.json()
}

export interface ChatStreamOptions {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  statement?: FinancialStatement
  aiHeaders: Record<string, string>
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: string) => void
  signal?: AbortSignal
}

export async function streamChat(options: ChatStreamOptions): Promise<void> {
  const { messages, statement, aiHeaders, onChunk, onDone, onError, signal } = options

  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiHeaders },
    body: JSON.stringify({
      messages,
      statement: statement ?? null,
      provider: aiHeaders['X-Provider'] || 'auto',
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Chat failed' }))
    onError(err.detail || 'Chat request failed')
    return
  }

  const reader = res.body?.getReader()
  if (!reader) { onError('No response body'); return }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''  // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr) continue

      try {
        const event = JSON.parse(jsonStr)
        if (event.error) { onError(event.error); return }
        if (event.text) onChunk(event.text)
        if (event.done) { onDone(); return }
      } catch {
        // Malformed SSE line — skip
      }
    }
  }
  onDone()
}
```

Also update `uploadFile` to accept and pass through AI headers:

```typescript
export async function uploadFile(
  file: File,
  aiHeaders: Record<string, string> = {}
): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: aiHeaders,   // Let browser set Content-Type for multipart
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}
```

**Step 2: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: api.ts — add streamChat SSE consumer, update getAIAnalysis for multi-provider"
```

---

## Task 14: Create ChatPanel and AISettingsModal Components

**Files:**
- Create: `frontend/components/chat/ChatPanel.tsx`
- Create: `frontend/components/chat/AISettingsModal.tsx`

**Step 1: Add react-markdown and remark-gfm to dependencies**

```bash
cd frontend
npm install react-markdown remark-gfm
```

**Step 2: Create frontend/components/chat/ChatPanel.tsx**

```tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, StopCircle, Trash2, MessageSquare } from 'lucide-react'
import { useChatStore } from '@/lib/chat-store'
import { streamChat } from '@/lib/api'
import { AIKeys } from '@/lib/ai-keys'
import type { FinancialStatement } from '@/lib/types'

interface Props {
  statement?: FinancialStatement
  companyName: string
  financialYear: string
}

const STARTER_QUESTIONS = [
  'What are the biggest financial risks for this company?',
  'How is the working capital position? Any concerns?',
  'Explain the debt-to-equity ratio and what it means.',
  'What should the CFO prioritise in the next 90 days?',
  'Is this company ready for a bank loan?',
]

export default function ChatPanel({ statement, companyName, financialYear }: Props) {
  const store = useChatStore()
  const messages = store.getMessages()

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Set active company whenever props change
  useEffect(() => {
    store.setActiveCompany(companyName, financialYear)
  }, [companyName, financialYear])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    if (!AIKeys.hasAnyKey()) {
      store.addMessage('assistant',
        '⚠️ Please add a Claude or OpenAI API key in **AI Settings** (⚙️ button) to use chat.')
      return
    }

    store.setActiveCompany(companyName, financialYear)
    const userMsgId = store.addMessage('user', trimmed)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Create placeholder for assistant response
    const assistantId = store.addMessage('assistant', '')
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    let accumulated = ''

    await streamChat({
      messages: store.getMessages()
        .filter(m => m.id !== assistantId)
        .map(m => ({ role: m.role, content: m.content })),
      statement,
      aiHeaders: AIKeys.getHeaders(),
      signal: controller.signal,
      onChunk: (chunk) => {
        accumulated += chunk
        store.updateMessage(assistantId, accumulated)
      },
      onDone: () => {
        setIsStreaming(false)
        abortRef.current = null
      },
      onError: (err) => {
        store.updateMessage(assistantId, `⚠️ ${err}`)
        setIsStreaming(false)
        abortRef.current = null
      },
    })
  }, [isStreaming, store, companyName, financialYear, statement])

  const handleStop = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">CFO Chat</span>
          <span className="text-xs text-gray-400">· {companyName}</span>
        </div>
        <button
          onClick={store.clearHistory}
          title="Clear chat history"
          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 text-center">
              Ask me anything about {companyName}&apos;s financials
            </p>
            <div className="grid gap-2">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-3 py-2 rounded-lg border border-blue-100
                             bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-gray max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content || '▋'}
                  </ReactMarkdown>
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about ratios, risks, recommendations…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:opacity-50 transition-all"
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
```

**Step 3: Create frontend/components/chat/AISettingsModal.tsx**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { AIKeys, type AIProvider } from '@/lib/ai-keys'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function AISettingsModal({ isOpen, onClose }: Props) {
  const [claudeKey, setClaudeKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [provider, setProvider] = useState<AIProvider>('auto')
  const [showClaude, setShowClaude] = useState(false)
  const [showOpenAI, setShowOpenAI] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setClaudeKey(AIKeys.getClaude())
      setOpenaiKey(AIKeys.getOpenAI())
      setProvider(AIKeys.getProvider())
    }
  }, [isOpen])

  const handleSave = () => {
    AIKeys.setClaude(claudeKey.trim())
    AIKeys.setOpenAI(openaiKey.trim())
    AIKeys.setProvider(provider)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 1000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">AI Settings</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Privacy notice */}
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">
          Keys are stored only in your browser&apos;s localStorage and are never sent to our servers
          except as headers on each AI request.
        </p>

        {/* Claude Key */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
            Anthropic (Claude) API Key
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline"
            >
              Get key <ExternalLink className="w-3 h-3" />
            </a>
          </label>
          <div className="relative">
            <input
              type={showClaude ? 'text' : 'password'}
              value={claudeKey}
              onChange={e => setClaudeKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowClaude(v => !v)}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showClaude ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* OpenAI Key */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
            OpenAI API Key
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline"
            >
              Get key <ExternalLink className="w-3 h-3" />
            </a>
          </label>
          <div className="relative">
            <input
              type={showOpenAI ? 'text' : 'password'}
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowOpenAI(v => !v)}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showOpenAI ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Provider selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Preferred Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {(['auto', 'claude', 'openai'] as AIProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors
                  ${provider === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
              >
                {p === 'auto' ? 'Auto' : p === 'claude' ? 'Claude' : 'GPT-4o'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Auto uses Claude if key present, otherwise OpenAI.
          </p>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm
                     hover:bg-blue-700 transition-colors"
        >
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
```

**Step 4: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

**Step 5: Commit**

```bash
git add frontend/components/chat/
git commit -m "feat: add ChatPanel (SSE streaming) and AISettingsModal components"
```

---

## Task 15: Update Dashboard Page

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

**Step 1: Add imports at the top of dashboard/page.tsx**

After existing imports, add:

```tsx
import { useState, lazy, Suspense } from 'react'
import { Settings } from 'lucide-react'
import { AIKeys } from '@/lib/ai-keys'

const ChatPanel = lazy(() => import('@/components/chat/ChatPanel'))
const AISettingsModal = lazy(() => import('@/components/chat/AISettingsModal'))
```

**Step 2: Add state inside the page component**

Inside the dashboard component, after existing state declarations:

```tsx
const [showChat, setShowChat] = useState(false)
const [showSettings, setShowSettings] = useState(false)
```

**Step 3: Update the AI analysis call**

Find the existing call to `getAIAnalysis(stmt, openaiKey)` and replace with:

```tsx
const result = await getAIAnalysis(stmt, AIKeys.getHeaders())
```

Remove any local `openaiKey` state if it was only used for this.

**Step 4: Add toolbar buttons and panels before closing tag**

In the JSX, add to the header/toolbar area (near where Excel export button is):

```tsx
{/* AI Settings button */}
<button
  onClick={() => setShowSettings(true)}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200
             text-sm text-gray-600 hover:bg-gray-50 transition-colors"
>
  <Settings className="w-4 h-4" />
  AI Settings
</button>

{/* CFO Chat toggle */}
<button
  onClick={() => setShowChat(v => !v)}
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
    transition-colors ${showChat
      ? 'bg-blue-600 text-white'
      : 'border border-blue-200 text-blue-600 hover:bg-blue-50'}`}
>
  CFO Chat {showChat ? '▲' : '▼'}
</button>
```

At the bottom of the page component, before the final closing div:

```tsx
{/* Chat Panel */}
{showChat && (
  <div className="fixed right-4 bottom-4 w-96 h-[560px] z-40 shadow-2xl rounded-xl">
    <Suspense fallback={null}>
      <ChatPanel
        statement={store.statement ?? undefined}
        companyName={store.report?.company_name ?? 'Company'}
        financialYear={store.report?.financial_year ?? 'FY'}
      />
    </Suspense>
  </div>
)}

{/* AI Settings Modal */}
<Suspense fallback={null}>
  <AISettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
</Suspense>
```

**Step 5: Verify build**

```bash
cd frontend
npm run build 2>&1 | tail -20
```

Expected: Build completes successfully

**Step 6: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat: dashboard — add CFO Chat panel and AI Settings modal"
```

---

## Task 16: Update Upload Page for PDF Support

**Files:**
- Modify: `frontend/app/upload/page.tsx`

**Step 1: Add PDF to the file dropzone accept config**

Find the `useDropzone` or `<input accept=...>` call and add `application/pdf`:

```tsx
// In useDropzone options:
accept: {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
  'application/pdf': ['.pdf'],
},
```

**Step 2: Pass AI headers on upload**

Find the `uploadFile(file)` call and update to:

```tsx
import { AIKeys } from '@/lib/ai-keys'

// ...
const result = await uploadFile(file, AIKeys.getHeaders())
```

**Step 3: Add a small info note near the upload area**

```tsx
<p className="text-xs text-gray-400 mt-1">
  Supports Excel (.xlsx/.xls), CSV, and PDF (digital or scanned).
  PDF parsing uses AI — add your API key in AI Settings.
</p>
```

**Step 4: Verify build**

```bash
cd frontend
npm run build 2>&1 | tail -20
```

Expected: No errors

**Step 5: Commit**

```bash
git add frontend/app/upload/page.tsx
git commit -m "feat: upload page supports PDF + passes AI headers to uploadFile"
```

---

## Task 17: Update next.config.js

**Files:**
- Modify: `frontend/next.config.js`

**Step 1: Add transpilePackages for react-markdown**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['react-markdown', 'remark-gfm', 'remark-parse', 'unified'],
}

module.exports = nextConfig
```

If the file already has content, merge the `transpilePackages` array rather than replacing.

**Step 2: Verify build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds with no module resolution errors

**Step 3: Commit**

```bash
git add frontend/next.config.js
git commit -m "chore: transpile react-markdown and unified packages for Next.js"
```

---

## Task 18: Full Build Verification

**Step 1: Run backend import check**

```bash
cd /path/to/repo/backend
python -c "
from models.schemas import ChatMessage, ChatRequest
from services.ai_gateway import AIGateway
from services.pdf_parser import parse_pdf_file
from services.ai_analyst import generate_ai_analysis
from routers.upload import router as upload_router
from routers.chat import router as chat_router
print('All backend imports OK')
"
```

Expected: `All backend imports OK`

**Step 2: Run frontend build**

```bash
cd frontend
npm run build
```

Expected: `Route (app) ... ✓` for all pages, no TypeScript errors

**Step 3: Check for any leftover openaiKey references**

```bash
grep -r "openaiKey" frontend/lib frontend/app --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

Expected: Zero results (all replaced with AIKeys.getHeaders())

**Step 4: Run dev server smoke test**

```bash
# Terminal 1: Backend
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

Navigate to `http://localhost:3000/dashboard`. Check:
- [ ] ⚙️ AI Settings button visible
- [ ] CFO Chat button visible
- [ ] Clicking AI Settings opens modal
- [ ] Clicking CFO Chat opens chat panel
- [ ] Adding a key and sending a message streams a response

**Step 5: Commit**

```bash
git add -A
git commit -m "test: full build verification checkpoint"
```

---

## Task 19: Deploy to Vercel

**Step 1: Push main branch**

```bash
git push origin main
```

**Step 2: Trigger Vercel deploy hook (main branch)**

```bash
curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_vY5hiTST9PqZArmkG5ibxBl8HzFr/HQznYuOSIc"
```

Expected: `{"job":{"state":"PENDING",...}}`

**Step 3: Monitor Vercel build**

Watch the Vercel dashboard or run:

```bash
sleep 120 && curl -s "https://company-financial-health-calculator.vercel.app/health"
```

Expected: `{"status":"ok","service":"Financial Health Calculator API"}`

**Step 4: Smoke-test production**

1. Open the Vercel frontend URL
2. Go to **AI Settings** — enter a Claude key — set provider to **Claude**
3. Upload a PDF financial statement
4. Verify it parses and redirects to dashboard
5. Open **CFO Chat** — ask: *"What is the current ratio?"*
6. Verify streaming response arrives word-by-word

---

## Notes on Preemptive Issue Handling

| Risk | Mitigation Built In |
|------|-------------------|
| Scanned PDF + no API key | Friendly error message in `parse_pdf_file` |
| Claude native PDF beta unavailable | Falls back to pdf2image + vision |
| poppler missing in prod | Added to Dockerfile |
| nginx buffering kills SSE | `X-Accel-Buffering: no` header on chat router |
| Chat context overflow | 100-message cap with trim-to-80 in chat store |
| User stops mid-stream | `AbortController` cancels SSE fetch |
| No API key for chat | Gateway raises ValueError → friendly SSE error event |
| OpenAI quota/rate limit | `_friendly_error` maps to human-readable messages |
| PDF map to schema fails (bad JSON) | `re.sub` strips markdown fences before `json.loads` |
| Monthly budget (future) | `MonthlyBudget` stub in schema; chat_consultant skill has budget mode section |
