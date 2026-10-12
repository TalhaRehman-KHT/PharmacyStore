"""Per-user rate limit for /ask and /ask/stream (slowapi, in-memory).

Keyed by the verified user id, which get_current_user stores on request.state; route
dependencies run before slowapi's check, so the id is always there. In-memory storage resets on
restart and is per process; move to Redis before running several replicas.
"""

import math
import time

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings

ASK_SCOPE = "ask"


def user_key(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    return f"user:{user_id}" if user_id else f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=user_key, storage_uri="memory://")

# /ask and /ask/stream share one budget per user.
ask_limit = limiter.shared_limit(lambda: get_settings().rate_limit, scope=ASK_SCOPE)


def retry_after_seconds(request: Request, exc: RateLimitExceeded) -> int:
    """Seconds until the caller's window frees a slot (at least 1)."""
    current = getattr(request.state, "view_rate_limit", None)
    if current is None:
        return int(exc.limit.limit.get_expiry())
    reset_at, _remaining = limiter.limiter.get_window_stats(current[0], *current[1])
    return max(1, math.ceil(reset_at - time.time()))
