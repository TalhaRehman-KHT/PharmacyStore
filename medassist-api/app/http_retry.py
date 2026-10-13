"""Shared retry rule for outgoing HTTP calls (Gemini, openFDA)."""

import httpx


def is_retryable(exc: BaseException) -> bool:
    """Retry on network errors, 429 (rate limit / quota per minute) and 5xx."""
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return code == 429 or code >= 500
    return isinstance(exc, httpx.TransportError)
