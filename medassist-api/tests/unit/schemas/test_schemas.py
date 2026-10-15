"""Schema tests: camelCase JSON, validation rules, and parity with the client's types."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.chat import (
    AnswerMeta,
    AskRequest,
    AskResponse,
    ChatMessageOut,
    ChatSessionOut,
    Citation,
    FeedbackIn,
    ProductCard,
)
from app.schemas.common import ApiError
from app.schemas.escalation import EscalationOut, EscalationReplyIn

# Field names copied from Client/src/features/medassist/types.js (JSDoc typedefs).
CLIENT_FIELDS = {
    Citation: ["n", "drug", "section", "url"],
    ProductCard: [
        "batchId", "medicineId", "name", "genericName", "price", "currency", "inStock",
        "pharmacyId", "pharmacyName", "imageUrl", "alternatives",
    ],
    AnswerMeta: [
        "messageId", "sessionId", "route", "escalated", "escalationReason", "escalationStatus",
        "products", "latencyMs", "tokens",
    ],
    ChatMessageOut: [
        "id", "sessionId", "role", "content", "createdAt", "citations", "meta", "feedback",
    ],
    ChatSessionOut: ["id", "title", "createdAt", "updatedAt"],
    EscalationOut: [
        "id", "messageId", "customerFirstName", "question", "reason", "status", "createdAt",
        "sources", "reply", "answeredAt",
    ],
    ApiError: ["status", "message", "retryAfterSec"],
}


def _aliases(model) -> set[str]:
    return {f.alias or name for name, f in model.model_fields.items()}


@pytest.mark.parametrize("model", list(CLIENT_FIELDS), ids=lambda m: m.__name__)
def test_schema_has_every_client_field(model):
    assert _aliases(model) == set(CLIENT_FIELDS[model])


def test_output_is_camel_case():
    meta = AnswerMeta(
        message_id=uuid4(), session_id=uuid4(), route="knowledge", escalated=False, latency_ms=120
    )
    data = meta.model_dump(by_alias=True, exclude_none=True)

    assert data["latencyMs"] == 120
    assert "latency_ms" not in data
    assert ApiError(status=429, message="slow down", retry_after_sec=60).model_dump(
        by_alias=True
    ) == {"status": 429, "message": "slow down", "retryAfterSec": 60}


def test_ask_response_round_trip_json():
    product = ProductCard(
        batch_id="b1", medicine_id="m1", name="Panadol", generic_name="Paracetamol", price=45,
        in_stock=True, pharmacy_id="ph1", pharmacy_name="City Pharmacy",
    )
    res = AskResponse(
        answer="Paracetamol relieves pain [1].",
        citations=[Citation(n=1, drug="paracetamol", section="Uses", url="https://x.test")],
        meta=AnswerMeta(
            message_id=uuid4(), session_id=uuid4(), route="both", escalated=False,
            products=[product], latency_ms=5,
        ),
    )
    data = res.model_dump(mode="json", by_alias=True, exclude_none=True)

    assert data["meta"]["products"][0] == {
        "batchId": "b1", "medicineId": "m1", "name": "Panadol", "genericName": "Paracetamol",
        "price": 45.0, "currency": "USD", "inStock": True, "pharmacyId": "ph1",
        "pharmacyName": "City Pharmacy",
    }


def test_accepts_camel_case_input():
    sid = uuid4()
    req = AskRequest.model_validate({"question": "  hi  ", "sessionId": str(sid)})
    assert req.session_id == sid
    assert AskRequest(question="  hi  ").question == "hi"


@pytest.mark.parametrize("question", ["a" * 501, "   ", ""])
def test_bad_question_rejected(question):
    with pytest.raises(ValidationError):
        AskRequest(question=question)


def test_question_of_500_chars_accepted():
    assert len(AskRequest(question="a" * 500).question) == 500


@pytest.mark.parametrize("rating", [0, 2, -2])
def test_bad_rating_rejected(rating):
    with pytest.raises(ValidationError):
        FeedbackIn(rating=rating)


def test_feedback_comment_limit():
    assert FeedbackIn(rating=-1, comment="wrong drug").comment == "wrong drug"
    with pytest.raises(ValidationError):
        FeedbackIn(rating=1, comment="x" * 501)


@pytest.mark.parametrize("reply", ["short", "   padded   ", "x" * 2001])
def test_bad_reply_rejected(reply):
    with pytest.raises(ValidationError):
        EscalationReplyIn(reply=reply)


def test_product_rules():
    with pytest.raises(ValidationError):
        ProductCard(medicine_id="m", name="n", price=-1, in_stock=True)
    with pytest.raises(ValidationError):
        ProductCard(medicine_id="m", name="n", price=1, currency="Rs", in_stock=True)
    out_of_stock = ProductCard(medicine_id="m", name="n", in_stock=False)
    assert out_of_stock.price is None and out_of_stock.batch_id is None


def test_escalation_dump_uses_iso_dates():
    now = datetime(2026, 10, 12, 9, 30, tzinfo=UTC)
    esc = EscalationOut(
        id=uuid4(), message_id=uuid4(), customer_first_name="Ali", question="Dose?",
        reason="personal_dosing", status="pending", created_at=now, sources=[],
    )
    data = esc.model_dump(mode="json", by_alias=True, exclude_none=True)

    assert data["createdAt"] == "2026-10-12T09:30:00Z"
    assert data["customerFirstName"] == "Ali"
    assert "reply" not in data and "answeredAt" not in data
