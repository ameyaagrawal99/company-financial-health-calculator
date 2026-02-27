"""Streaming chat endpoint — Server-Sent Events (SSE)."""
import json
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from ..models.schemas import ChatRequest
from ..services.ai_gateway import AIGateway
from ..services.calculator import calculate_all_ratios

router = APIRouter(prefix="/api", tags=["chat"])


async def _event_generator(gateway: AIGateway, request: ChatRequest):
    """Async generator that yields SSE-formatted chunks."""
    report = None
    if request.statement:
        try:
            report = calculate_all_ratios(request.statement)
        except Exception:  # noqa: BLE001 — bad statement data, chat continues without it
            report = None

    try:
        async for chunk in gateway.chat_stream(
            messages=request.messages,
            report=report,
            provider=request.provider,
        ):
            payload = json.dumps({"text": chunk, "done": False})
            yield f"data: {payload}\n\n"
    except ValueError as e:
        payload = json.dumps({"error": str(e), "done": True})
        yield f"data: {payload}\n\n"
        return
    except Exception as e:  # noqa: BLE001 — surface error to client
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
    """
    Stream an AI chat response as Server-Sent Events.

    The client must supply at least one of X-Claude-Key or X-OpenAI-Key headers.
    An optional `statement` field in the request body grounds the conversation
    in the company's calculated financial metrics.
    """
    if not x_claude_key and not x_openai_key:
        raise HTTPException(
            status_code=400,
            detail="No API key provided. Set X-Claude-Key or X-OpenAI-Key header.",
        )

    gateway = AIGateway(claude_key=x_claude_key, openai_key=x_openai_key)

    return StreamingResponse(
        _event_generator(gateway, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
