"""Map database rows to API schemas. jsonb columns already hold the camelCase API shape."""

from app.schemas.chat import ChatMessageOut, ChatSessionOut, Citation
from app.schemas.escalation import EscalationOut


def session_out(row: dict) -> ChatSessionOut:
    return ChatSessionOut.model_validate(row)


def message_out(
    row: dict, rating: int | None = None, escalation: dict | None = None
) -> ChatMessageOut:
    """One chat_messages row, plus this user's feedback rating and the message's escalation.

    Assistant messages get `meta` rebuilt from the stored columns; `escalation` is the
    escalations row whose message_id is this message (or None).
    """
    data = {
        "id": row["id"],
        "session_id": row["session_id"],
        "role": row["role"],
        "content": row["content"],
        "created_at": row["created_at"],
        "feedback": rating,
    }
    if row["role"] == "assistant":
        data["citations"] = row.get("citations") or []
        data["meta"] = {
            "message_id": row["id"],
            "session_id": row["session_id"],
            "route": row.get("route") or "knowledge",
            "escalated": escalation is not None,
            "escalation_reason": escalation["reason"] if escalation else None,
            "escalation_status": escalation["status"] if escalation else None,
            "products": row.get("products") or None,
            "latency_ms": row.get("latency_ms") or 0,
            "tokens": row.get("tokens"),
        }
    return ChatMessageOut.model_validate(data)


def first_name(full_name: str | None) -> str:
    """Only the customer's first name is shown to pharmacists."""
    parts = (full_name or "").split()
    return parts[0] if parts else "Customer"


def escalation_out(row: dict, customer_name: str | None, sources: list) -> EscalationOut:
    return EscalationOut.model_validate(
        {
            **row,
            "customer_first_name": first_name(customer_name),
            "sources": [Citation.model_validate(s) for s in sources],
        }
    )
