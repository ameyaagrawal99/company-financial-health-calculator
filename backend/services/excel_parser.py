"""
Excel/CSV parser with auto-detection of Indian financial statement formats.
"""
import pandas as pd
import io
import re
from typing import Dict, List, Tuple, Any, Optional


# Known field synonyms — maps raw header variations to standard field names
FIELD_SYNONYMS = {
    # Balance Sheet — Assets
    "fixed_assets": ["fixed assets", "net fixed assets", "tangible assets", "property plant equipment", "ppe", "net block"],
    "cwip": ["cwip", "capital work in progress", "capital wip", "work in progress"],
    "lt_investments": ["long term investments", "lt investments", "investments", "non current investments"],
    "dta": ["deferred tax asset", "dta", "deferred tax"],
    "lt_loans_advances": ["long term loans", "lt loans", "long term advances", "other non current assets"],
    "inventory": ["inventory", "inventories", "stock", "closing stock", "stock in trade"],
    "trade_receivables": ["trade receivables", "debtors", "accounts receivable", "sundry debtors", "receivables"],
    "cash_and_equivalents": ["cash", "cash and cash equivalents", "cash & bank", "bank balance", "cash equivalents"],
    "st_loans_advances": ["short term loans", "st loans", "short term advances", "advances", "loans & advances"],
    "gst_itc_receivable": ["gst receivable", "gst itc", "input tax credit", "itc receivable"],
    "tds_receivable": ["tds receivable", "tds refundable", "advance tax", "tds & advance tax"],
    "other_current_assets": ["other current assets", "prepaid expenses", "other assets"],
    # Balance Sheet — Equity & Liabilities
    "share_capital": ["share capital", "paid up capital", "equity share capital"],
    "reserves_surplus": ["reserves", "reserves and surplus", "retained earnings", "other equity"],
    "lt_borrowings": ["long term borrowings", "lt borrowings", "term loans", "long term debt", "secured loans"],
    "dtl": ["deferred tax liability", "dtl"],
    "lt_provisions": ["long term provisions", "lt provisions", "employee benefit obligations"],
    "st_borrowings": ["short term borrowings", "st borrowings", "working capital loans", "short term debt"],
    "cc_od_facilities": ["cc", "od", "cash credit", "overdraft", "cc/od", "bank od"],
    "trade_payables": ["trade payables", "creditors", "accounts payable", "sundry creditors", "payables"],
    "gst_payable": ["gst payable", "gst liability", "output gst"],
    "tds_payable": ["tds payable", "tds liability", "tax deducted at source payable"],
    "pf_esi_pt_payable": ["pf payable", "esi payable", "pf & esi", "provident fund", "statutory dues"],
    "customer_advances": ["customer advances", "advance from customers", "deferred revenue"],
    "other_current_liabilities": ["other current liabilities", "other liabilities"],
    "msme_payable_overdue": ["msme overdue", "msme payable overdue"],
    "number_of_shares": ["number of shares", "no of shares", "shares outstanding"],
    # P&L
    "revenue_from_operations": ["revenue from operations", "net revenue", "sales", "turnover", "net sales", "revenue"],
    "other_income": ["other income", "non operating income", "interest income"],
    "raw_materials": ["raw materials", "material cost", "cost of materials", "raw material consumed"],
    "purchases": ["purchases", "purchase of stock", "purchase of goods", "cost of goods"],
    "change_in_inventory": ["change in inventory", "change in stock", "inventory change"],
    "employee_benefits": ["employee benefits", "employee cost", "salaries", "wages", "staff cost", "remuneration"],
    "finance_costs": ["finance costs", "interest expense", "interest", "finance charges", "borrowing costs"],
    "depreciation": ["depreciation", "amortization", "depreciation & amortization", "d&a"],
    "other_expenses": ["other expenses", "operating expenses", "administrative expenses", "selling expenses", "overheads"],
    "tax_expense": ["tax expense", "income tax", "current tax", "tax"],
    # Cash Flow
    "operating_cash_flow": ["operating cash flow", "ocf", "cash from operations", "net cash from operating"],
    "investing_cash_flow": ["investing cash flow", "cash from investing", "net cash from investing"],
    "financing_cash_flow": ["financing cash flow", "cash from financing", "net cash from financing"],
    "capex": ["capex", "capital expenditure", "purchase of fixed assets", "additions to fixed assets"],
    "opening_cash": ["opening cash", "opening balance", "beginning cash"],
    "closing_cash": ["closing cash", "closing balance", "ending cash"],
}

STATEMENT_KEYWORDS = {
    "balance_sheet": ["fixed assets", "current assets", "shareholders equity", "reserves", "trade payables",
                      "trade receivables", "balance sheet", "liabilities", "net worth"],
    "profit_loss": ["revenue", "sales", "turnover", "net profit", "ebitda", "depreciation", "tax expense",
                    "profit and loss", "income statement", "p&l"],
    "cash_flow": ["operating cash flow", "investing activities", "financing activities", "capex", "cash flow"],
}


def normalize_header(h: str) -> str:
    return re.sub(r'[^a-z0-9 ]', ' ', str(h).lower()).strip()


def detect_statement_type(df: pd.DataFrame) -> Tuple[str, float]:
    """Detect whether this is a BS, P&L, or Cash Flow statement."""
    all_text = " ".join([normalize_header(str(c)) for c in df.columns] +
                        [normalize_header(str(v)) for v in df.iloc[:, 0].dropna().values[:30]])

    scores = {}
    for stmt_type, keywords in STATEMENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in all_text)
        scores[stmt_type] = score

    best = max(scores, key=lambda k: scores[k])
    total = sum(scores.values())
    confidence = scores[best] / total if total > 0 else 0.3
    return best, round(confidence, 2)


def fuzzy_match_field(header: str) -> Optional[str]:
    """Match a raw header to a standard field name."""
    normalized = normalize_header(header)
    for field, synonyms in FIELD_SYNONYMS.items():
        if any(syn in normalized or normalized in syn for syn in synonyms):
            return field
    return None


def suggest_mappings(columns: List[str], first_col_values: List[str]) -> Dict[str, str]:
    """Auto-suggest field mappings from raw column names."""
    suggestions = {}
    # Try column names first
    for col in columns:
        field = fuzzy_match_field(col)
        if field:
            suggestions[col] = field
    # Try first column values (common in Indian statements where fields are row labels)
    for val in first_col_values:
        field = fuzzy_match_field(val)
        if field and val not in suggestions:
            suggestions[str(val)] = field
    return suggestions


def detect_currency_unit(df: pd.DataFrame) -> str:
    """Detect currency scale from headers or notes."""
    text = " ".join([str(c) for c in df.columns] + [str(df.iloc[0, 0]) if len(df) > 0 else ""])
    text_lower = text.lower()
    if "crore" in text_lower or "cr" in text_lower:
        return "crores"
    if "lakh" in text_lower or " l " in text_lower:
        return "lakhs"
    if "thousand" in text_lower or "'000" in text_lower:
        return "thousands"
    return "lakhs"  # Default for Indian statements


def detect_financial_year(df: pd.DataFrame) -> Optional[str]:
    """Extract financial year from headers."""
    text = " ".join([str(c) for c in df.columns])
    # Match patterns like FY 2024-25, March 2025, 2024-25
    patterns = [
        r'FY\s*(\d{4}[-–]\d{2,4})',
        r'(\d{4}[-–]\d{2,4})',
        r'March[,\s]+(\d{4})',
        r'31[- ]Mar[a-z]*[- ,]+(\d{4})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            year_str = match.group(1)
            # Normalize to FY YYYY-YY format
            if re.match(r'\d{4}[-–]\d{2}$', year_str):
                return f"FY {year_str}"
            elif re.match(r'\d{4}$', year_str):
                yr = int(year_str)
                return f"FY {yr - 1}-{str(yr)[-2:]}"
    return None


def parse_excel_file(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Parse uploaded Excel or CSV file and return structured data."""
    try:
        fname_lower = filename.lower()
        if fname_lower.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_bytes))
            sheets = ["Sheet1"]
        else:
            # Explicitly pick the right engine:
            # .xls  → xlrd  (legacy binary format)
            # .xlsx / .xlsm / .xlsb / .ods → openpyxl (modern XML format)
            engine = "xlrd" if fname_lower.endswith('.xls') else "openpyxl"
            xl = pd.ExcelFile(io.BytesIO(file_bytes), engine=engine)
            sheets = xl.sheet_names
            # Pick most relevant sheet
            df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=0, header=None, engine=engine)
            # Try to find header row
            for i in range(min(10, len(df))):
                row = df.iloc[i]
                non_null = row.dropna()
                if len(non_null) >= 2:
                    df.columns = df.iloc[i]
                    df = df[i + 1:].reset_index(drop=True)
                    break

        detected_type, confidence = detect_statement_type(df)
        currency_unit = detect_currency_unit(df)
        financial_year = detect_financial_year(df)

        columns = [str(c) for c in df.columns.tolist()]
        first_col_vals = df.iloc[:30, 0].dropna().astype(str).tolist()

        preview = df.head(20).fillna("").astype(str).to_dict(orient='records')
        mapping_suggestions = suggest_mappings(columns, first_col_vals)

        return {
            "sheets": sheets,
            "detected_type": detected_type,
            "confidence": confidence,
            "columns": columns,
            "preview": preview,
            "mapping_suggestions": mapping_suggestions,
            "financial_year": financial_year,
            "currency_unit": currency_unit,
            "raw_data": df.to_dict(orient='records'),
        }
    except Exception as e:
        raise ValueError(f"Could not parse file: {str(e)}")


def extract_values_from_mapping(
    raw_data: List[Dict],
    column_mapping: Dict[str, str],
    value_column: Optional[str] = None
) -> Dict[str, Optional[float]]:
    """
    Extract field values based on column mapping.
    Supports two layouts:
    1. Row-label layout: first column has field names, another column has values
    2. Column-header layout: headers are field names, rows are companies/years
    """
    result: Dict[str, Optional[float]] = {}

    if not raw_data:
        return result

    # Determine layout
    first_row_keys = list(raw_data[0].keys())

    # Row-label layout (most common in Indian statements)
    # Find which column has field labels
    label_col = first_row_keys[0]
    # Find value column (rightmost numeric column if not specified)
    if value_column is None:
        numeric_cols = []
        for col in first_row_keys[1:]:
            try:
                vals = [float(str(r.get(col, "")).replace(",", "").replace("(", "-").replace(")", ""))
                        for r in raw_data if str(r.get(col, "")).strip() not in ["", "nan"]]
                if len(vals) > 2:
                    numeric_cols.append(col)
            except (ValueError, TypeError):
                pass
        value_column = numeric_cols[-1] if numeric_cols else (first_row_keys[1] if len(first_row_keys) > 1 else None)

    if value_column:
        for row in raw_data:
            label = str(row.get(label_col, "")).strip()
            if label and label in column_mapping:
                std_field = column_mapping[label]
                raw_val = str(row.get(value_column, "")).strip()
                try:
                    # Handle Indian number formats: 1,23,456 and (negative)
                    clean_val = raw_val.replace(",", "").replace(" ", "")
                    negative = clean_val.startswith("(") or clean_val.startswith("-")
                    clean_val = clean_val.replace("(", "").replace(")", "").replace("-", "")
                    val = float(clean_val)
                    if negative:
                        val = -val
                    result[std_field] = val
                except (ValueError, TypeError):
                    result[std_field] = None

    return result
