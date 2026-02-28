"""
PDF parser — handles both digital (text-based) and scanned (image-based) PDFs.

Strategy:
  1. Try pypdf text extraction (fast, free, no API key needed)
  2. If text insufficient AND Claude key present → Claude native PDF API
  3. Else if text insufficient AND any key → pdf2image + vision AI
  4a. Map text → schema via RULE-BASED parser (fast, free, no API key needed)
  4b. If too few fields extracted → fall back to AI schema mapping
"""
import asyncio
import io
from typing import Optional
from .ai_gateway import AIGateway
from .text_parser import try_parse_financial_text, count_extracted_fields


MIN_TEXT_CHARS = 150   # Below this = likely scanned
MIN_REGEX_FIELDS = 5   # Minimum fields for rule-based parse to be trusted


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

    # 150 DPI is sufficient for financial table OCR and reduces image size ~44%
    # vs 200 DPI, keeping vision-API token costs well within free-tier limits.
    pil_images = convert_from_bytes(pdf_bytes, dpi=150, fmt="PNG")
    result = []
    for pil_img in pil_images[:max_pages]:
        with io.BytesIO() as buf:
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

    For digital PDFs the rule-based parser runs first — no API key required.
    AI is only invoked when:
      - The PDF is scanned (vision extraction)
      - The rule-based parser finds fewer than MIN_REGEX_FIELDS fields
    """
    gateway = AIGateway(claude_key=claude_key, openai_key=openai_key)
    has_any_key = bool(claude_key or openai_key)

    # ── Step 1: Try digital text extraction ─────────────────────────────── #
    try:
        raw_text, page_count = await asyncio.to_thread(_extract_digital_text, pdf_bytes)
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
        except Exception:  # noqa: BLE001 — intentional: fall back to vision API
            images = await asyncio.to_thread(_pdf_to_images, pdf_bytes)
            extracted_text = await gateway.extract_pdf_with_vision(images, provider="claude")
            extraction_method = "vision_claude"
    else:
        # OpenAI vision
        images = await asyncio.to_thread(_pdf_to_images, pdf_bytes)
        extracted_text = await gateway.extract_pdf_with_vision(images, provider="openai")
        extraction_method = "vision_openai"

    if not extracted_text.strip():
        raise ValueError("Could not extract any financial data from the PDF.")

    # ── Step 2a: Rule-based schema mapping (no AI key required) ────────────#
    schema_data = try_parse_financial_text(extracted_text)
    fields_found = count_extracted_fields(schema_data)
    parse_method = "regex"

    # ── Step 2b: AI fallback if rule-based parse found too few fields ──────#
    if fields_found < MIN_REGEX_FIELDS:
        if not has_any_key:
            raise ValueError(
                f"Could not automatically extract financial data from this PDF "
                f"({fields_found} fields found). "
                "Please add a Claude or OpenAI API key in AI Settings to enable "
                "AI-assisted extraction."
            )
        provider = "claude" if claude_key else "openai"
        schema_data = await gateway.map_text_to_schema(extracted_text, provider=provider)
        parse_method = "ai"

    # Attach metadata
    schema_data["_extraction_method"] = extraction_method
    schema_data["_parse_method"] = parse_method
    schema_data["_fields_found"] = fields_found
    schema_data["_page_count"] = page_count if extraction_method == "digital" else None

    # Confidence: higher if we parsed all 3 sections; lower if AI fallback used
    base_confidence = 0.90 if parse_method == "regex" and fields_found >= 10 else 0.80

    return {
        "sheets": ["PDF Import"],
        "detected_type": "financial_statement",
        "confidence": base_confidence,
        "columns": list(schema_data.keys()),
        "preview": [schema_data],
        "mapping_suggestions": {},
        "financial_year": schema_data.get("financial_year"),
        "currency_unit": schema_data.get("currency_unit", "lakhs"),
        "parsed_statement": schema_data,
    }
