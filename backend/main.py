import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload, calculate

app = FastAPI(
    title="Company Financial Health Calculator API",
    description="India-first financial health calculator — 50+ ratios, compliance checks, 0–100 health score.",
    version="1.0.0",
)

# Allow all origins in production (Vercel preview URLs are dynamic)
# In tighter environments, replace with explicit allowed origins
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
origins = [o.strip() for o in ALLOWED_ORIGINS.split(",")] if ALLOWED_ORIGINS != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,   # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(calculate.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Financial Health Calculator API"}
