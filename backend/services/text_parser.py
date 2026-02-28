"""
Rule-based financial statement text parser.

Extracts standard Indian financial statement fields from structured PDF text
using keyword + number patterns — NO AI required.

Used as a fast-path before falling back to AI schema mapping, so that clean
digital PDFs (Tally exports, MCA filings, Schedule III statements, etc.)
work without any API key.

Coverage:
  - Balance Sheet: equity, liabilities, assets
  - P&L: revenue, major expense lines, profit, tax
  - Cash Flow: operating / investing / financing

Limitations:
  - For PDFs with both quarterly and annual P&L columns, picks the first
    (usually quarterly) figure. Users can correct on the mapping screen.
  - Cannot parse image-based / scanned PDFs — those still need AI vision.
"""

import re
from typing import Optional


# ---------------------------------------------------------------------------
# Number helpers
# ---------------------------------------------------------------------------

def _to_number(s: str) -> Optional[float]:
    """Convert '41,806' or '(1,234)' or '-1,234' to float. Returns None on failure."""
    s = s.strip().replace(",", "").replace(" ", "")
    negative = (s.startswith("(") and s.endswith(")")) or s.startswith("-")
    s = s.strip("()-")
    if not s:
        return None
    try:
        val = float(s)
        return -val if negative else val
    except ValueError:
        return None


def _first_num_in(text: str) -> Optional[float]:
    """
    Find the first numeric value in text, skipping note references like '2.1' or '2.18'.
    Handles formats: 41,806  (1,234)  -1234  41806.50
    """
    for m in re.finditer(
        r"\([\d,]+(?:\.\d+)?\)|-\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?", text
    ):
        raw = m.group().strip()
        # Skip note cross-references like "2.1", "2.18" — always N.NN small decimals
        if re.match(r"^\d{1,2}\.\d{1,2}$", raw.replace(",", "")):
            continue
        # Skip plain zeros that are column separators
        val = _to_number(raw)
        if val is not None:
            return val
    return None


# ---------------------------------------------------------------------------
# Field patterns — (regex, section, schema_key)
# Ordered so the most specific patterns come first.
# ---------------------------------------------------------------------------

_PATTERNS: list[tuple[str, str, str]] = [
    # ── Balance Sheet ───────────────────────────────────────────────────── #
    (r"equity\s+share\s+capital|share\s+capital",               "balance_sheet", "share_capital"),
    (r"reserves\s+(?:and|&)\s+surplus",                         "balance_sheet", "reserves_surplus"),
    (r"long.?term\s+borrowings?|long\s+term\s+debt",            "balance_sheet", "lt_borrowings"),
    (r"short.?term\s+borrowings?|short\s+term\s+debt",          "balance_sheet", "st_borrowings"),
    (r"trade\s+payables?|sundry\s+creditors?",                  "balance_sheet", "trade_payables"),
    (r"other\s+current\s+liabilities",                          "balance_sheet", "other_current_liabilities"),
    # Fixed assets: match tangible before generic 'fixed assets' to avoid note text
    (r"tangible\s+assets?",                                     "balance_sheet", "fixed_assets"),
    (r"property[,\s]+plant\s+and\s+equipment",                  "balance_sheet", "fixed_assets"),
    (r"inventories?|stock.in.trade",                             "balance_sheet", "inventory"),
    (r"trade\s+receivables?|sundry\s+debtors?",                 "balance_sheet", "trade_receivables"),
    (r"cash\s+and\s+(?:cash\s+)?equivalents?|cash\s+and\s+bank","balance_sheet", "cash_and_equivalents"),
    (r"other\s+current\s+assets?",                              "balance_sheet", "other_current_assets"),

    # ── Profit & Loss ────────────────────────────────────────────────────── #
    # Revenue: many labels used across companies
    (r"(?:total\s+)?revenue\s+from\s+operations",               "profit_loss", "revenue_from_operations"),
    (r"income\s+from\s+software\s+services",                    "profit_loss", "revenue_from_operations"),
    (r"net\s+(?:sales?|revenue)",                               "profit_loss", "revenue_from_operations"),
    (r"gross\s+revenue",                                        "profit_loss", "revenue_from_operations"),
    (r"other\s+income",                                         "profit_loss", "other_income"),
    (r"raw\s+materials?\s+consumed|cost\s+of\s+raw\s+materials?","profit_loss", "raw_materials"),
    (r"purchases?\s+of\s+(?:stock|goods)",                      "profit_loss", "purchases"),
    (r"employee\s+benefit\s+expenses?|staff\s+costs?",          "profit_loss", "employee_benefits"),
    (r"finance\s+costs?|interest\s+(?:expense|charges?)",       "profit_loss", "finance_costs"),
    (r"depreciation\s+and\s+amort(?:isation|ization)",          "profit_loss", "depreciation"),
    (r"other\s+expenses?",                                      "profit_loss", "other_expenses"),
    (r"(?:income\s+)?tax\s+expense|provision\s+for\s+tax|current\s+tax", "profit_loss", "tax_expense"),

    # ── Cash Flow ────────────────────────────────────────────────────────── #
    (r"net\s+cash\s+generated\s+(?:by|from)\s+operating",       "cash_flow", "operating_cash_flow"),
    (r"net\s+cash\s+(?:from|provided\s+by)\s+operating",        "cash_flow", "operating_cash_flow"),
    (r"net\s+cash\s+used\s+in\s+investing",                     "cash_flow", "investing_cash_flow"),
    (r"net\s+cash\s+from\s+investing",                          "cash_flow", "investing_cash_flow"),
    (r"net\s+cash\s+used\s+in\s+financing",                     "cash_flow", "financing_cash_flow"),
    (r"net\s+cash\s+from\s+financing",                          "cash_flow", "financing_cash_flow"),
    (r"purchase\s+of\s+(?:fixed\s+assets|property,\s*plant)",   "cash_flow", "capex"),
    (r"capital\s+expenditure",                                   "cash_flow", "capex"),
]


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def try_parse_financial_text(text: str) -> dict:
    """
    Attempt rule-based extraction of financial data from structured PDF text.

    Returns a dict matching the FinancialStatement schema shape with only the
    fields we could confidently identify. Callers should check
    `count_extracted_fields()` and fall back to AI if the count is too low.
    """
    result: dict = {
        "company_name": None,
        "financial_year": None,
        "currency_unit": "lakhs",
        "balance_sheet": {},
        "profit_loss": {},
        "cash_flow": {},
    }

    text_lower = text.lower()

    # ── Currency ────────────────────────────────────────────────────────── #
    if re.search(r"in\s+[`₹]\s*crore|in\s+crore|₹\s+crore|rs\.\s+crore", text_lower):
        result["currency_unit"] = "crores"
    elif re.search(r"in\s+lakh|₹\s+lakh|in\s+[`₹]\s*lakh|rs\.\s+lakh", text_lower):
        result["currency_unit"] = "lakhs"
    elif re.search(r"in\s+thousands?|₹\s+thousands?", text_lower):
        result["currency_unit"] = "thousands"
    elif re.search(r"in\s+millions?|₹\s+millions?", text_lower):
        result["currency_unit"] = "millions"

    # ── Financial Year ───────────────────────────────────────────────────── #
    # Prefer "Year ended / as at March 31, YYYY" patterns
    for pat in [
        r"(?:march|mar)[.,]?\s+31[,.]?\s*(\d{4})",
        r"(?:march|mar)\s+(\d{4})",
        r"year\s+end(?:ed|ing)\s+(\d{1,2})[/-](\d{1,2})[/-](\d{4})",
        r"fy\s*(\d{4})-(\d{2})",
        r"(\d{4})-(\d{2,4})\s*(?:annual|year)",
    ]:
        m = re.search(pat, text_lower)
        if m:
            yr = int(m.group(1))
            if 2000 <= yr <= 2100:
                result["financial_year"] = f"FY {yr - 1}-{str(yr)[2:]}"
                break

    # ── Company Name ─────────────────────────────────────────────────────── #
    # First non-empty line in the first 10 lines that has no digits
    for line in text.split("\n")[:10]:
        line = line.strip()
        if len(line) > 4 and not any(c.isdigit() for c in line):
            result["company_name"] = line
            break

    # ── Financial Line Items ─────────────────────────────────────────────── #
    lines = text.split("\n")

    for pattern, section, key in _PATTERNS:
        if key in result[section]:
            continue  # Already matched by an earlier (more specific) pattern

        for line in lines:
            m = re.search(pattern, line, re.IGNORECASE)
            if m:
                after = line[m.end():]
                val = _first_num_in(after)
                if val is not None:
                    result[section][key] = val
                    break

    return result


def count_extracted_fields(parsed: dict) -> int:
    """Count how many financial fields were successfully extracted."""
    total = 0
    for section in ("balance_sheet", "profit_loss", "cash_flow"):
        total += len(parsed.get(section, {}))
    return total
