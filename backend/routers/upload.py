from fastapi import APIRouter, UploadFile, File, HTTPException
from ..services.excel_parser import parse_excel_file
from ..models.schemas import ParsedFileResponse

router = APIRouter(prefix="/api", tags=["upload"])

ALLOWED_EXTENSIONS = {'.xlsx', '.xls', '.csv'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload", response_model=ParsedFileResponse)
async def upload_file(file: UploadFile = File(...)):
    """Upload financial statement file and get parsing results with mapping suggestions."""
    # Validate file
    filename = file.filename or ""
    ext = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not supported. Use .xlsx, .xls, or .csv")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    try:
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
