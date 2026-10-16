"""HTTP routes for the client.

Every route needs a caller (app/security/auth.py); /escalations and /insights also need staff.
Customer data is always filtered by the verified token's user id (the service key bypasses RLS).

Responses serialize by alias (camelCase) and drop None fields, so optional fields are
absent in JSON, matching the client's optional properties.
"""

# /ask, /ask/stream, /feedback, /escalations
import json
import logging
from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sse_starlette.sse import EventSourceResponse, ServerSentEvent

from app.api.deps import get_rag, get_repos
from app.errors import BUSY_MESSAGE, Conflict, NotFound
from app.llm.providers import AllProvidersBusy
from app.observability import audit_logger, set_request_fields
from app.rag.deps import RagDeps
from app.rate_limit import ask_quota, ip_guard
from app.repositories import Repos
from app.repositories.escalations import EscalationScope
from app.schemas.chat import AskRequest, AskResponse, ChatMessageOut, ChatSessionOut, FeedbackIn
from app.schemas.common import EscalationStatus
from app.schemas.escalation import EscalationOut, EscalationReplyIn, InsightsOut
from app.security.auth import CurrentUser, get_current_user, require_staff
from app.services import chat

logger = logging.getLogger(__name__)


async def _log_user(user: Annotated[CurrentUser, Depends(get_current_user)]) -> None:
    """Dependency: put the caller's id on the request's access log line."""
    set_request_fields(user_id=str(user.id))


# ip_guard first: a flood is stopped before any database lookup.
router = APIRouter(
    dependencies=[Depends(ip_guard), Depends(get_current_user), Depends(_log_user)],
    responses={401: {"description": "Missing, invalid or expired token"}},
)
_STAFF = {"responses": {403: {"description": "Pharmacist access required"}}}
_ASK = {"responses": {429: {"description": "Rate limit exceeded (see Retry-After)"}}}

_OUT = {"response_model_by_alias": True, "response_model_exclude_none": True}

User = Annotated[CurrentUser, Depends(get_current_user)]
Staff = Annotated[CurrentUser, Depends(require_staff)]
ReposDep = Annotated[Repos, Depends(get_repos)]
RagDep = Annotated[RagDeps, Depends(get_rag)]


async def get_scope(staff: Staff, repos: ReposDep) -> EscalationScope:
    """Dependency: the staff caller's escalation scope (loaded once per request)."""
    return await repos.escalation_scope(staff.id, staff.role)


Scope = Annotated[EscalationScope, Depends(get_scope)]


async def _check_pharmacy(repos: Repos, body: AskRequest) -> None:
    if body.pharmacy_id is not None and not await repos.pharmacy_exists(body.pharmacy_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "pharmacyId: unknown pharmacy")


@router.post(
    "/ask",
    response_model=AskResponse,
    tags=["chat"],
    dependencies=[Depends(ask_quota)],
    **_OUT,
    **_ASK,
)
async def ask(
    body: AskRequest,
    user: User,
    repos: ReposDep,
    rag: RagDep,
) -> AskResponse:
    """Answer a question in one response (the LangGraph agent)."""
    await _check_pharmacy(repos, body)
    session_id = await chat.resolve_session(repos, user.id, body)
    return await chat.answer_question(repos, rag, user.id, session_id, body)


def _event(name: str, data) -> ServerSentEvent:
    return ServerSentEvent(event=name, data=json.dumps(data, separators=(",", ":")))


@router.post(
    "/ask/stream",
    response_class=EventSourceResponse,
    tags=["chat"],
    dependencies=[Depends(ask_quota)],
    **_ASK,
)
async def ask_stream(
    body: AskRequest,
    user: User,
    repos: ReposDep,
    rag: RagDep,
) -> EventSourceResponse:
    """Stream an answer as SSE.

    Events, in order: `token` (data: {"text": piece}, repeated, as the model writes),
    `citations` (data: Citation[]), `meta` (data: AnswerMeta), `done` (data: {}).
    On failure: `error` (data: {status, message}), also after some tokens were sent.
    Session ownership and pharmacyId are checked before the stream starts (plain HTTP errors).
    """
    await _check_pharmacy(repos, body)
    session_id = await chat.resolve_session(repos, user.id, body)

    async def events() -> AsyncIterator[ServerSentEvent]:
        result: AskResponse | None = None
        try:
            async for item in chat.answer_stream(repos, rag, user.id, session_id, body):
                if isinstance(item, AskResponse):
                    result = item
                else:
                    yield _event("token", {"text": item})
        except (NotFound, Conflict) as exc:
            code = 404 if isinstance(exc, NotFound) else 409
            yield _event("error", {"status": code, "message": exc.message})
            return
        except AllProvidersBusy as exc:
            logger.warning("All LLM providers busy; retry in %s s", exc.retry_after_s)
            yield _event(
                "error",
                {"status": 429, "message": BUSY_MESSAGE, "retryAfterSec": exc.retry_after_s},
            )
            return
        except Exception:
            logger.exception("Stream failed for session %s", session_id)
            yield _event("error", {"status": 500, "message": "Internal server error"})
            return
        if result is None:
            yield _event("error", {"status": 500, "message": "Internal server error"})
            return
        yield _event(
            "citations", [c.model_dump(mode="json", by_alias=True) for c in result.citations]
        )
        yield _event("meta", result.meta.model_dump(mode="json", by_alias=True, exclude_none=True))
        yield _event("done", {})

    return EventSourceResponse(events())


@router.get("/sessions", response_model=list[ChatSessionOut], tags=["sessions"], **_OUT)
async def list_sessions(user: User, repos: ReposDep) -> list[ChatSessionOut]:
    """List the caller's chat sessions, newest first."""
    return await repos.list_sessions(user.id)


@router.get(
    "/sessions/{session_id}/messages",
    response_model=list[ChatMessageOut],
    tags=["sessions"],
    responses={404: {"description": "Session not found"}},
    **_OUT,
)
async def get_messages(session_id: UUID, user: User, repos: ReposDep) -> list[ChatMessageOut]:
    """List the messages of one of the caller's sessions, oldest first."""
    return await repos.get_messages(user.id, session_id)


@router.delete("/sessions", status_code=status.HTTP_204_NO_CONTENT, tags=["sessions"])
async def clear_history(user: User, repos: ReposDep) -> None:
    """Delete all of the caller's sessions and messages."""
    await repos.delete_all_sessions(user.id)


@router.post(
    "/messages/{message_id}/feedback",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["feedback"],
    responses={404: {"description": "Message not found"}},
)
async def send_feedback(message_id: UUID, body: FeedbackIn, user: User, repos: ReposDep) -> None:
    """Rate an assistant message (1 helpful, -1 not helpful). Voting again replaces the vote."""
    await repos.upsert_feedback(user.id, message_id, body.rating, body.comment)


@router.get(
    "/escalations", response_model=list[EscalationOut], tags=["escalations"], **_OUT, **_STAFF
)
async def list_escalations(
    scope: Scope,
    repos: ReposDep,
    status_filter: Annotated[EscalationStatus, Query(alias="status")] = "pending",
) -> list[EscalationOut]:
    """List escalations by status: admin/doctor see all, a vendor only their pharmacies'."""
    return await repos.list_escalations(status_filter, scope)


@router.post(
    "/escalations/{escalation_id}/reply",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["escalations"],
    responses={
        **_STAFF["responses"],
        404: {"description": "Escalation not found"},
        409: {"description": "Escalation already answered"},
    },
)
async def reply_escalation(
    escalation_id: UUID, body: EscalationReplyIn, staff: Staff, scope: Scope, repos: ReposDep
) -> None:
    """Answer a pending escalation in your scope; the reply is added to the customer's chat."""
    await repos.answer_escalation(escalation_id, staff.id, body.reply, scope)
    audit_logger.info(
        "escalation_answered",
        extra={
            "fields": {
                "staff_id": str(staff.id),
                "staff_role": staff.role,
                "escalation_id": str(escalation_id),
            }
        },
    )


@router.get("/insights", response_model=InsightsOut, tags=["escalations"], **_OUT, **_STAFF)
async def get_insights(scope: Scope, repos: ReposDep) -> InsightsOut:
    """Pending escalations and unhelpful answers (last 7 days) in the caller's scope."""
    return await repos.get_insights(scope)
