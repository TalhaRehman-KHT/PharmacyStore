"""Pharmacist escalation models."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import StringConstraints

from app.schemas.chat import Citation
from app.schemas.common import CamelModel, EscalationReason, EscalationStatus


class EscalationOut(CamelModel):
    """One question waiting for (or answered by) a pharmacist."""

    id: UUID
    message_id: UUID
    customer_first_name: str
    question: str
    reason: EscalationReason
    status: EscalationStatus
    created_at: datetime
    sources: list[Citation]
    reply: str | None = None
    answered_at: datetime | None = None


class EscalationReplyIn(CamelModel):
    """Pharmacist reply; shown to the customer in their chat."""

    reply: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=2000)]
