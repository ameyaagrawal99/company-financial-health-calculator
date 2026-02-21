from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload, calculate

app = FastAPI(
    title="Company Financial Health Calculator API",
    description="India-first financial health calculator — 50+ ratios, compliance checks, 0–100 health score.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(calculate.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Financial Health Calculator API"}
