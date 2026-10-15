"""JSON logs, a request id per request, and one access line per request.

Privacy rule: health questions are sensitive, so NO log line may contain question or answer text,
and never a secret. Only ids, numbers and fixed words are logged:
  access line: request_id, method, path, status, latency_ms, user_id, route, tokens
  other lines: message + request_id / user_id of the request they belong to
In prod an exception is logged by type and stack only: its message may quote user text.

httpx logs every outgoing URL at INFO; Supabase filter URLs can hold words of the question
(product search), so the httpx / httpcore loggers are set to WARNING.
"""

import json
import logging
import re
import time
import traceback
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "X-Request-Id"
_VALID_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")  # a caller's id is kept only if it looks safe

# Per-request fields. One dict per request, filled while it runs (user id by auth, route and
# tokens by the chat service). Tasks started inside the request see the same dict.
_context: ContextVar[dict | None] = ContextVar("medassist_request", default=None)

access_logger = logging.getLogger("medassist.access")
audit_logger = logging.getLogger("medassist.audit")


def set_request_fields(**fields: object) -> None:
    """Add fields (user_id, route, tokens, ...) to the current request's access line."""
    ctx = _context.get()
    if ctx is not None:
        ctx.update({k: v for k, v in fields.items() if v is not None})


class JsonFormatter(logging.Formatter):
    """One JSON object per line: time, level, logger, message, request fields, extra fields."""

    def __init__(self, show_exception_text: bool = True) -> None:
        super().__init__()
        self.show_exception_text = show_exception_text

    def format(self, record: logging.LogRecord) -> str:
        out: dict = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        ctx = _context.get()
        if ctx:
            out["request_id"] = ctx.get("request_id")
            if ctx.get("user_id"):
                out["user_id"] = ctx["user_id"]
        out.update(getattr(record, "fields", None) or {})  # logger.info(..., extra={"fields": {}})
        if record.exc_info and record.exc_info[0] is not None:
            exc_type, exc, tb = record.exc_info
            out["exc_type"] = exc_type.__name__
            if self.show_exception_text:
                out["exc"] = "".join(traceback.format_exception(exc_type, exc, tb))
            else:
                out["stack"] = "".join(traceback.format_tb(tb))
        return json.dumps(out, default=str)


def configure_logging(level: str = "INFO", *, prod: bool = False) -> None:
    """JSON lines on stderr for every logger (also uvicorn's). Safe to call more than once."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter(show_exception_text=not prod))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).handlers[:] = []  # use the root handler, in JSON
        logging.getLogger(name).propagate = True
    logging.getLogger("uvicorn.access").disabled = True  # our access line replaces it
    for name in ("httpx", "httpcore", "hpack"):
        logging.getLogger(name).setLevel(logging.WARNING)


class RequestContextMiddleware:
    """Pure ASGI middleware (streams SSE untouched): sets the request id, returns it in the
    X-Request-Id header, and logs the access line when the response has been fully sent."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        incoming = dict(scope["headers"]).get(REQUEST_ID_HEADER.lower().encode(), b"").decode()
        request_id = incoming if _VALID_ID.match(incoming) else uuid.uuid4().hex
        ctx = {"request_id": request_id}
        token = _context.set(ctx)
        start = time.perf_counter()
        status = 500

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.encode(), request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            fields = {
                "method": scope["method"],
                "path": scope["path"],  # path only: the query string is not logged
                "status": status,
                "latency_ms": round((time.perf_counter() - start) * 1000),
                **{k: ctx[k] for k in ("route", "tokens") if k in ctx},
            }
            access_logger.info("request", extra={"fields": fields})
            _context.reset(token)
