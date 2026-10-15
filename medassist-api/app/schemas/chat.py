"""Chat models: ask request/response, messages, sessions and feedback."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints

from app.schemas.common import CamelModel, EscalationReason, EscalationStatus, Role, Route

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class AskRequest(CamelModel):
    """Body of POST /ask and /ask/stream."""

    question: Question
    session_id: UUID | None = None
    # The pharmacy the customer is shopping at, when the page knows it (escalations go there).
    pharmacy_id: UUID | None = None


class Citation(CamelModel):
    """One numbered source; `n` matches the [n] marker in the answer text."""

    n: int = Field(ge=1)
    drug: str
    section: str
    url: str


class ProductCard(CamelModel):
    """A shop medicine shown under an answer (graph/nodes/tools.py). In stock: the batch the
    cart uses (cheapest valid batch, the customer's pharmacy first). Out of stock: no batch,
    no price, maybe in-stock alternatives with the same generic."""

    batch_id: str | None = None
    medicine_id: str
    name: str
    generic_name: str | None = None
    price: float | None = Field(default=None, ge=0)  # medicine_batches.selling_price
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] = "USD"
    in_stock: bool
    pharmacy_id: str | None = None
    pharmacy_name: str | None = None
    image_url: str | None = None
    alternatives: list[ProductCard] | None = None


class AnswerMeta(CamelModel):
    """Metadata sent after the answer (last SSE event before `done`)."""

    message_id: UUID
    session_id: UUID
    route: Route
    escalated: bool
    escalation_reason: EscalationReason | None = None
    escalation_status: EscalationStatus | None = None
    products: list[ProductCard] | None = None
    latency_ms: int = Field(ge=0)
    tokens: int | None = Field(default=None, ge=0)  # LLM input + output tokens (None: no LLM call)


class AskResponse(CamelModel):
    """Non-streaming answer (POST /ask)."""

    answer: str
    citations: list[Citation]
    meta: AnswerMeta


class ChatMessageOut(CamelModel):
    """One stored message in a session."""

    id: UUID
    session_id: UUID
    role: Role
    content: str
    created_at: datetime
    citations: list[Citation] | None = None
    meta: AnswerMeta | None = None
    feedback: Literal[1, -1] | None = None


class ChatSessionOut(CamelModel):
    """One chat session in the sidebar list."""

    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class FeedbackIn(CamelModel):
    """Thumbs up (1) or down (-1) on an assistant message."""

    rating: Literal[1, -1]
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
