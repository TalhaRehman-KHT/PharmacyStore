"""One question -> stored session, user message, assistant message and (maybe) escalation."""

import time
from uuid import UUID

from app.repositories import Repos
from app.schemas.chat import AnswerMeta, AskRequest, AskResponse
from app.schemas.common import Variant
from app.services import placeholder

TITLE_LENGTH = 40


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


async def answer_question(
    repos: Repos, user_id: UUID, session_id: UUID, body: AskRequest, variant: Variant = "agent"
) -> AskResponse:
    """Answer one turn in an already resolved session and persist both messages."""
    started = time.perf_counter()

    await repos.add_message(
        session_id=session_id, user_id=user_id, role="user", content=body.question
    )

    # TODO(agent): the LangGraph agent replaces the placeholder (variant selects the pipeline).
    result = placeholder.answer(body.question)
    latency_ms = int((time.perf_counter() - started) * 1000)

    message = await repos.add_message(
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=result.text,
        route=result.route,
        citations=[],
        variant=variant,
        latency_ms=latency_ms,
    )

    escalated = result.escalation_reason is not None
    if escalated:
        await repos.create_escalation(
            message_id=message["id"],
            session_id=session_id,
            user_id=user_id,
            question=body.question,
            reason=result.escalation_reason,
            pharmacy_id=body.pharmacy_id,
        )

    meta = AnswerMeta(
        message_id=message["id"],
        session_id=session_id,
        route=result.route,
        escalated=escalated,
        escalation_reason=result.escalation_reason,
        escalation_status="pending" if escalated else None,
        latency_ms=latency_ms,
    )
    return AskResponse(answer=result.text, citations=[], meta=meta)
