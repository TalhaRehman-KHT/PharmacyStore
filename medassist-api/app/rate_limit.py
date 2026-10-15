"""Rate limits.

1. Per-user question limit (RATE_LIMIT, default 20/hour) for /ask and /ask/stream, counted from
   the user's own questions in chat_messages (role 'user') inside the window. The count lives in
   the database, so it survives restarts and every container sees the same number.
   Retry-After = when the oldest of the last <n> questions leaves the window.
   Two questions sent at the very same moment can both pass (check, then insert): a few extra
   questions at most, fine for a guard against overuse.
2. Per-IP abuse guard (IP_RATE_LIMIT, default 60/minute) on every API route. In memory, per
   process: it only stops floods, the real limit is 1.
"""

import math
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, Request
from limits import parse
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import AsyncClient

from app.config import get_settings
from app.db.client import get_db
from app.errors import TooManyRequests
from app.repositories.messages import recent_question_times
from app.security.auth import CurrentUser, get_current_user

ASK_MESSAGE = "Too many questions. Please try again later."
IP_MESSAGE = "Too many requests. Please slow down."

# slowapi's limiter object only as an in-memory moving-window counter for the IP guard.
_ip_limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")


def ip_guard(request: Request) -> None:
    """Dependency: 429 when this IP sent more than IP_RATE_LIMIT requests."""
    item = parse(get_settings().ip_rate_limit)
    ip = get_remote_address(request)
    window = _ip_limiter.limiter
    if not window.hit(item, "ip", ip):
        reset_at, _ = window.get_window_stats(item, "ip", ip)
        raise TooManyRequests(max(1, math.ceil(reset_at - datetime.now(UTC).timestamp())),
                              IP_MESSAGE)


def retry_after_s(times: list[datetime], limit: int, window_s: int, now: datetime) -> int | None:
    """None when another question is allowed, else seconds until one is.
    `times` = the newest questions in the window, newest first, at most `limit` of them."""
    if len(times) < limit:
        return None
    frees_at = times[limit - 1] + timedelta(seconds=window_s)
    return max(1, math.ceil((frees_at - now).total_seconds()))


async def ask_quota(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncClient, Depends(get_db)],
) -> None:
    """Dependency of /ask and /ask/stream: 429 + Retry-After when RATE_LIMIT is used up."""
    item = parse(get_settings().rate_limit)
    window_s = item.get_expiry()
    now = datetime.now(UTC)
    times = await recent_question_times(db, user.id, now - timedelta(seconds=window_s),
                                        item.amount)
    wait = retry_after_s(times, item.amount, window_s, now)
    if wait is not None:
        raise TooManyRequests(wait, ASK_MESSAGE)
