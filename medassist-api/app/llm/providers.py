"""LLM clients: Groq as primary, Gemini as fallback, behind one interface.

get_llm("fast")   -> small Groq model for guard / router / rewrite / grade steps
get_llm("answer") -> bigger Groq model that writes the final answer

Every call streams. Order of events for one call:
  1. Groq. Transient errors (connection, 5xx) are retried with tenacity, but only BEFORE the first
     token: after text has been sent to the user a retry would repeat it.
  2. Groq answers 429 (rate limit) or does not send the next token within `timeout` seconds
     -> switch to Gemini (settings.gemini_fallback_model) for the same messages; it gets a longer
     timeout (FALLBACK_TIMEOUT_S) because it is the last resort and slow to send its first token.
Token usage of the call (input/output tokens, provider, model) is kept in `LLM.last_usage`.
"""

import asyncio
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from langchain_core.messages import AIMessageChunk, BaseMessage
from tenacity import AsyncRetrying, retry_if_exception, stop_after_attempt, wait_exponential

from app.config import Settings, get_settings

Role = Literal["fast", "answer"]
TIMEOUT_S = {"fast": 10.0, "answer": 30.0}  # max wait for the next Groq token
FALLBACK_TIMEOUT_S = 60.0  # Gemini is the last resort and slow to start (~20 s measured)
TEMPERATURE = {"fast": 0.0, "answer": 0.2}
ATTEMPTS = 3  # Groq tries for transient errors before giving up


class FallbackNeeded(Exception):
    """Groq is rate-limited or too slow: use the fallback model."""


@dataclass(frozen=True)
class Usage:
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass(frozen=True)
class Provider:
    """One chat model plus the names we report for it."""

    name: str  # "groq" | "gemini"
    model: str
    chat: Any  # a LangChain chat model (anything with astream(messages))


# ---------- error classification ----------


def _status(exc: BaseException) -> int | None:
    """HTTP status of a provider error (groq/openai SDK, httpx, google), if any."""
    for attr in ("status_code", "code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    response = getattr(exc, "response", None)
    return getattr(response, "status_code", None)


def is_rate_limit(exc: BaseException) -> bool:
    return _status(exc) == 429 or "RateLimit" in type(exc).__name__


def is_timeout(exc: BaseException) -> bool:
    return isinstance(exc, TimeoutError | httpx.TimeoutException) or "Timeout" in type(exc).__name__


def is_transient(exc: BaseException) -> bool:
    """Worth a retry on the same provider: connection problems and 5xx (not 429, not timeout)."""
    if is_rate_limit(exc) or is_timeout(exc):
        return False
    status = _status(exc)
    return (status is not None and status >= 500) or "Connection" in type(exc).__name__


# ---------- streaming ----------


async def _stream_one(
    provider: Provider, messages: Sequence[BaseMessage], timeout: float
) -> AsyncIterator[AIMessageChunk]:
    """Chunks from one provider; waiting longer than `timeout` for any chunk raises TimeoutError."""
    stream = provider.chat.astream(list(messages)).__aiter__()
    while True:
        try:
            chunk = await asyncio.wait_for(stream.__anext__(), timeout)
        except StopAsyncIteration:
            return
        yield chunk


def _usage(provider: Provider, total: AIMessageChunk | None) -> Usage:
    meta = (total.usage_metadata if total is not None else None) or {}
    return Usage(
        provider.name,
        provider.model,
        meta.get("input_tokens", 0),
        meta.get("output_tokens", 0),
    )


class LLM:
    """Streaming chat with retry + fallback. One instance per request (last_usage is per call)."""

    def __init__(
        self,
        primary: Provider,
        fallback: Provider | None,
        *,
        timeout: float,
        fallback_timeout: float = FALLBACK_TIMEOUT_S,
        attempts: int = ATTEMPTS,
        retry_wait: float = 0.5,
    ) -> None:
        self.primary, self.fallback = primary, fallback
        self.timeout, self.fallback_timeout = timeout, fallback_timeout
        self.attempts, self.retry_wait = attempts, retry_wait
        self.last_usage: Usage | None = None

    async def astream(self, messages: Sequence[BaseMessage]) -> AsyncIterator[str]:
        """Answer text piece by piece. Falls back to Gemini on a Groq 429 or timeout."""
        try:
            async for text in self._with_retry(self.primary, messages):
                yield text
        except FallbackNeeded:
            if self.fallback is None:
                raise
            async for text in self._run(self.fallback, messages, self.fallback_timeout):
                yield text

    async def ainvoke(self, messages: Sequence[BaseMessage]) -> str:
        """The whole answer as one string (for fast steps that need no streaming)."""
        return "".join([t async for t in self.astream(messages)])

    async def _with_retry(
        self, provider: Provider, messages: Sequence[BaseMessage]
    ) -> AsyncIterator[str]:
        """_run with tenacity retries for transient errors, as long as nothing was yielded yet."""
        started = False

        def retry_allowed(exc: BaseException) -> bool:
            return not started and is_transient(exc)

        async for attempt in AsyncRetrying(
            retry=retry_if_exception(retry_allowed),
            stop=stop_after_attempt(self.attempts),
            wait=wait_exponential(multiplier=self.retry_wait, max=5),
            reraise=True,
        ):
            with attempt:
                try:
                    async for text in self._run(provider, messages, self.timeout):
                        started = True
                        yield text
                except Exception as exc:
                    if not started and (is_rate_limit(exc) or is_timeout(exc)):
                        raise FallbackNeeded(type(exc).__name__) from exc
                    raise

    async def _run(
        self, provider: Provider, messages: Sequence[BaseMessage], timeout: float
    ) -> AsyncIterator[str]:
        """Stream one provider and record its token usage."""
        total: AIMessageChunk | None = None
        async for chunk in _stream_one(provider, messages, timeout):
            total = chunk if total is None else total + chunk
            # .text joins text blocks: Gemini sends content as a list of blocks, Groq as a string.
            if text := chunk.text:
                yield text
        self.last_usage = _usage(provider, total)


# ---------- factory ----------


def _groq(settings: Settings, role: Role) -> Provider:
    from langchain_groq import ChatGroq

    model = settings.groq_fast_model if role == "fast" else settings.groq_answer_model
    chat = ChatGroq(
        model=model,
        api_key=settings.groq_api_key,
        temperature=TEMPERATURE[role],
        timeout=TIMEOUT_S[role],
        max_retries=0,  # retries are ours (tenacity), so a 429 reaches the fallback at once
    )
    return Provider("groq", model, chat)


def _gemini(settings: Settings, role: Role) -> Provider:
    from langchain_google_genai import ChatGoogleGenerativeAI

    model = settings.gemini_fallback_model
    chat = ChatGoogleGenerativeAI(
        model=model,
        google_api_key=settings.gemini_api_key,
        temperature=TEMPERATURE[role],
        timeout=FALLBACK_TIMEOUT_S,
        max_retries=0,  # last resort: a slow retry would only double the wait
    )
    return Provider("gemini", model, chat)


def get_llm(role: Role, settings: Settings | None = None) -> LLM:
    """Groq model for this role with Gemini as fallback. Models come from settings."""
    settings = settings or get_settings()
    return LLM(_groq(settings, role), _gemini(settings, role), timeout=TIMEOUT_S[role])
