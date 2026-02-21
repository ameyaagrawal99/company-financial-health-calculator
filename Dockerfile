FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire repo so relative imports work
COPY . .

# Set PYTHONPATH so "from backend.services..." works
ENV PYTHONPATH=/app

EXPOSE 8000

# Run from repo root — module path is backend.main:app
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
