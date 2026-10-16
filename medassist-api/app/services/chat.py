"""One question -> stored session, user message, assistant message and (maybe) escalation."""

import time
from collections.abc import AsyncIterator
from uuid import UUID

from app.graph import build
from app.graph.answer import RagAnswer
from app.observability import set_request_fields
from app.rag.deps import RagDeps
from app.repositories import Repos
from app.schemas.chat import AnswerMeta, AskRequest, AskResponse
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


async def answer_stream(
    repos: Repos,
    rag: RagDeps,
    user_id: UUID,
    session_id: UUID,
    body: AskRequest,
) -> AsyncIterator[str | AskResponse]:
    """Answer one turn in an already resolved session: text pieces (str) while the answer is
    written, then the stored AskResponse. Both messages are persisted."""
    started = time.perf_counter()
    # Earlier turns of this chat (read BEFORE the new question is stored).
    history = await repos.recent_messages(session_id, HISTORY_MESSAGES)
    await repos.add_message(
        session_id=session_id, user_id=user_id, role="user", content=body.question
    )

    pipeline = build.stream_agent(  # the safety guard is the graph's first node
        body.question,
        rag,
        history,
        user_id=str(user_id),
        pharmacy_id=str(body.pharmacy_id) if body.pharmacy_id else None,
    )
    result: RagAnswer | None = None
    async for item in pipeline:
        if isinstance(item, RagAnswer):
            result = item
        else:
            yield item
    assert result is not None  # the agent always ends with its RagAnswer
    set_request_fields(route=result.route, tokens=result.tokens)  # access log line
    reason = result.escalation_reason
    latency_ms = int((time.perf_counter() - started) * 1000)

    message = await repos.add_message(
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=result.text,
        route=result.route,
        citations=result.citations,
        products=result.products,
        variant="agent",
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
            pharmacy_id=body.pharmacy_id or result.pharmacy_id,
        )

    meta = AnswerMeta(
        message_id=message["id"],
        session_id=session_id,
        route=result.route,
        escalated=reason is not None,
        escalation_reason=reason,
        escalation_status="pending" if reason else None,
        products=result.products or None,
        latency_ms=latency_ms,
        tokens=result.tokens,
        language=detect_language(result.text),
    )
    yield AskResponse(answer=result.text, citations=result.citations, meta=meta)


async def answer_question(
    repos: Repos,
    rag: RagDeps,
    user_id: UUID,
    session_id: UUID,
    body: AskRequest,
) -> AskResponse:
    """The same turn as answer_stream, returned in one piece (POST /ask)."""
    async for item in answer_stream(repos, rag, user_id, session_id, body):
        if isinstance(item, AskResponse):
            return item
    raise RuntimeError("answer_stream ended without a response")
