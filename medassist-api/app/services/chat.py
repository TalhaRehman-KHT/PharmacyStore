"""One question -> stored session, user message, assistant message and (maybe) escalation."""

import re
import time
from collections.abc import AsyncIterator
from uuid import UUID

from app.baseline import naive
from app.rag.deps import RagDeps
from app.repositories import Repos
from app.schemas.chat import AnswerMeta, AskRequest, AskResponse
from app.schemas.common import Variant
from app.services import precheck
from app.services.language import detect_language

TITLE_LENGTH = 40
HISTORY_MESSAGES = 4  # the last 2 question/answer pairs go into the prompt


async def resolve_session(repos: Repos, user_id: UUID, body: AskRequest) -> UUID:
    """The session for this turn.

    A given sessionId must belong to the caller (else NotFound); without one a new session is
    created, titled with the first 40 characters of the question.
    """
    if body.session_id is not None:
        await repos.assert_session_owned(user_id, body.session_id)
        return body.session_id
    session = await repos.create_session(user_id, body.question[:TITLE_LENGTH])
    return session.id


def words(text: str) -> list[str]:
    """Split into word pieces that keep their trailing whitespace, so they join back exactly."""
    return re.findall(r"\S+\s*", text)


async def answer_stream(
    repos: Repos,
    rag: RagDeps,
    user_id: UUID,
    session_id: UUID,
    body: AskRequest,
    variant: Variant = "naive",
) -> AsyncIterator[str | AskResponse]:
    """Answer one turn in an already resolved session: text pieces (str) while the answer is
    written, then the stored AskResponse. Both messages are persisted."""
    started = time.perf_counter()
    # Earlier turns of this chat (read BEFORE the new question is stored).
    history = await repos.recent_messages(session_id, HISTORY_MESSAGES)
    await repos.add_message(
        session_id=session_id, user_id=user_id, role="user", content=body.question
    )

    # Keyword pre-check first: risky questions are escalated without retrieval or LLM.
    reason = precheck.escalation_reason(body.question)
    result: naive.RagAnswer | None = None
    if reason is not None:
        text = precheck.ESCALATION_TEXT[detect_language(body.question)]
        for piece in words(text):
            yield piece
        result = naive.RagAnswer(text, "escalated")
    else:
        async for item in naive.answer_stream(body.question, rag, history):
            if isinstance(item, naive.RagAnswer):
                result = item
            else:
                yield item
    assert result is not None  # naive.answer_stream always ends with its RagAnswer
    latency_ms = int((time.perf_counter() - started) * 1000)

    message = await repos.add_message(
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=result.text,
        route=result.route,
        citations=result.citations,
        variant=variant,
        latency_ms=latency_ms,
        tokens=result.tokens,
    )

    if reason is not None:
        await repos.create_escalation(
            message_id=message["id"],
            session_id=session_id,
            user_id=user_id,
            question=body.question,
            reason=reason,
            pharmacy_id=body.pharmacy_id,
        )

    meta = AnswerMeta(
        message_id=message["id"],
        session_id=session_id,
        route=result.route,
        escalated=reason is not None,
        escalation_reason=reason,
        escalation_status="pending" if reason else None,
        latency_ms=latency_ms,
        tokens=result.tokens,
    )
    yield AskResponse(answer=result.text, citations=result.citations, meta=meta)


async def answer_question(
    repos: Repos,
    rag: RagDeps,
    user_id: UUID,
    session_id: UUID,
    body: AskRequest,
    variant: Variant = "naive",
) -> AskResponse:
    """The same turn as answer_stream, returned in one piece (POST /ask)."""
    async for item in answer_stream(repos, rag, user_id, session_id, body, variant):
        if isinstance(item, AskResponse):
            return item
    raise RuntimeError("answer_stream ended without a response")
