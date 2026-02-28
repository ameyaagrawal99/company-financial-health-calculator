"""
Image parser — handles direct camera scans and photo uploads of financial documents.

Supports: JPEG, PNG, WebP  (camera photos, screenshots, scanned photos)

Strategy:
  1. Normalize image: apply EXIF rotation, convert to RGB, cap resolution, save as JPEG
  2. Send to vision AI (Claude or OpenAI GPT-4o)
  3. Map extracted text to FinancialStatement schema via AI

Unlike PDF parsing, images ALWAYS require an AI key (there is no "digital text" fallback).
"""

import asyncio
import io
from typing import Optional

from .ai_gateway import AIGateway


MAX_DIM = 3000    # Cap longest edge — 3000px preserves A4 text at 150 dpi equivalent
JPEG_QUALITY = 88  # High quality but ~3-4x smaller than lossless PNG


async def parse_image_file(
    image_bytes: bytes,
    filename: str,
    claude_key: Optional[str] = None,
    openai_key: Optional[str] = None,
) -> dict:
    """
    Parse a camera-captured or directly uploaded image of a financial document.

    Requires an AI API key (Claude or OpenAI) for vision-based extraction.
    Raises ValueError with a user-friendly message on failure.
    """
    has_any_key = bool(claude_key or openai_key)
    if not has_any_key:
        raise ValueError(
            "Camera scans and photos require an AI API key for vision extraction. "
            "Please add a Claude or OpenAI key in ⚙ AI Settings."
        )

    # Step 1: Normalize image (EXIF rotation, RGB conversion, resize, JPEG encode)
    try:
        normalized_bytes = await asyncio.to_thread(_normalize_image, image_bytes)
    except Exception as e:
        raise ValueError(
            f"Could not read image file '{filename}'. "
            f"Ensure it is a valid JPEG, PNG, or WebP photo. Detail: {e}"
        ) from e

    # Step 2: Extract financial text via vision AI
    gateway = AIGateway(claude_key=claude_key, openai_key=openai_key)
    provider = "claude" if claude_key else "openai"

    extracted_text = await gateway.extract_pdf_with_vision([normalized_bytes], provider=provider)

    if not extracted_text.strip():
        raise ValueError(
            "Could not extract any financial data from the image. "
            "Ensure the photo is clear, well-lit, and shows a financial statement "
            "(Balance Sheet, P&L, or Cash Flow)."
        )

    # Step 3: Map extracted text to FinancialStatement JSON schema
    schema_data = await gateway.map_text_to_schema(extracted_text, provider=provider)
    schema_data["_extraction_method"] = "vision_image_scan"

    return {
        "sheets": ["Camera Scan"],
        "detected_type": "financial_statement",
        "confidence": 0.80,
        "columns": list(schema_data.keys()),
        "preview": [schema_data],
        "mapping_suggestions": {},
        "financial_year": schema_data.get("financial_year"),
        "currency_unit": schema_data.get("currency_unit", "lakhs"),
        "parsed_statement": schema_data,
    }


def _normalize_image(image_bytes: bytes) -> bytes:
    """
    Normalize image for vision AI:
      - Apply EXIF auto-rotation (phone cameras embed orientation data — without this,
        documents arrive rotated 90° and vision models struggle to parse them)
      - Convert to RGB (handles RGBA, palette, grayscale, HEIC modes)
      - Downscale large images (12MP phones → cap at MAX_DIM to reduce token cost)
      - Save as JPEG (smaller than PNG; accepted by Claude and OpenAI vision APIs)

    Runs in a thread (via asyncio.to_thread) because PIL is synchronous/CPU-bound.
    """
    from PIL import Image, ImageOps

    img = Image.open(io.BytesIO(image_bytes))

    # Apply EXIF orientation tag so the image is right-side-up
    img = ImageOps.exif_transpose(img)

    # Convert to RGB — required for JPEG output; handles RGBA, P (palette), L (grayscale)
    if img.mode != "RGB":
        img = img.convert("RGB")

    # Downscale if either dimension exceeds MAX_DIM
    w, h = img.size
    if max(w, h) > MAX_DIM:
        scale = MAX_DIM / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Encode as JPEG — LANCZOS resize already applied; optimize flag reduces file size ~5%
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()
