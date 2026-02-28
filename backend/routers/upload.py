from fastapi import APIRouter, UploadFile, File, Header, HTTPException
from typing import Optional
from ..services.excel_parser import parse_excel_file
from ..services.pdf_parser import parse_pdf_file
from ..services.image_parser import parse_image_file
from ..models.schemas import ParsedFileResponse

router = APIRouter(prefix="/api", tags=["upload"])

IMAGE_EXTENSIONS  = {'.jpg', '.jpeg', '.png', '.webp'}          # Camera photos, screenshots
ALLOWED_EXTENSIONS = {'.xlsx', '.xls', '.csv', '.pdf'} | IMAGE_EXTENSIONS
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


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
        elif ext in IMAGE_EXTENSIONS:
            result = await parse_image_file(
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
            parsed_statement=result.get("parsed_statement"),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")
