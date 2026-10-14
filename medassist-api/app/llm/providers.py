"""LLM clients behind one interface: a chain of providers tried in order.

get_llm("fast")   -> small Groq model for guard / router / rewrite / grade steps
get_llm("answer") -> Groq answer model that writes the final answer

Chain (S4): Groq main model -> Groq backup model -> Gemini. Every Groq model has its own free-tier
token bucket (8000 tokens/minute, measured from the x-ratelimit-* headers on 2026-10-14), so the
backup model still has room when the main one is rate-limited.

Every call streams. For each provider in the chain:
  1. Transient errors (connection, 5xx such as Gemini's 503 "high demand") are retried with
     backoff, but only BEFORE the first token: after text has been sent a retry would repeat it.
  2. A 429, a timeout (no next token within the provider's timeout) or a 5xx that is still there
     after the retries -> the next provider in the chain.
  3. Every provider busy -> AllProvidersBusy(retry_after_s); the API turns it into HTTP 429 with
     Retry-After, never a raw 500.
Errors after the first token, and errors such as 400, are raised at once.
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
MAX_TOKENS = {"fast": 200, "answer": 400}  # a short answer; keeps each call well inside the budget
ATTEMPTS = 3  # tries per provider for transient errors
DEFAULT_RETRY_AFTER_S = 30  # when no provider said how long to wait


class AllProvidersBusy(Exception):
    """Every provider in the chain is rate-limited, timed out or overloaded."""

    def __init__(self, retry_after_s: int = DEFAULT_RETRY_AFTER_S) -> None:
        super().__init__(f"All LLM providers are busy; retry in {retry_after_s} s")
        self.retry_after_s = retry_after_s


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
    timeout: float = TIMEOUT_S["answer"]  # max wait for the next token


# ---------- error classification ----------


def _chain(exc: BaseException) -> list[BaseException]:
    """The error and the errors it was raised from (LangChain wraps the SDK errors)."""
    out: list[BaseException] = []
    while exc is not None and exc not in out:
        out.append(exc)
        exc = exc.__cause__ or exc.__context__
    return out


def _status(exc: BaseException) -> int | None:
    """HTTP status of a provider error (groq/openai SDK, httpx, google), if any."""
    for e in _chain(exc):
        for attr in ("status_code", "code"):
            value = getattr(e, attr, None)
            if isinstance(value, int):
                return value
        status = getattr(getattr(e, "response", None), "status_code", None)
        if isinstance(status, int):
            return status
    return None


def is_rate_limit(exc: BaseException) -> bool:
    return _status(exc) == 429 or any("RateLimit" in type(e).__name__ for e in _chain(exc))


def is_timeout(exc: BaseException) -> bool:
    return any(
        isinstance(e, TimeoutError | httpx.TimeoutException) or "Timeout" in type(e).__name__
        for e in _chain(exc)
    )


def is_transient(exc: BaseException) -> bool:
    """Worth a retry on the same provider: connection problems and 5xx (not 429, not timeout)."""
    if is_rate_limit(exc) or is_timeout(exc):
        return False
    status = _status(exc)
    return (status is not None and status >= 500) or any(
        "Connection" in type(e).__name__ for e in _chain(exc)
    )


def is_busy(exc: BaseException) -> bool:
    """Try the next provider: rate limit, timeout, or a 5xx/connection error after the retries."""
    return is_rate_limit(exc) or is_timeout(exc) or is_transient(exc)


def retry_after_s(exc: BaseException) -> int | None:
    """Seconds from a Retry-After header of the error's HTTP response, if any."""
    for e in _chain(exc):
        headers = getattr(getattr(e, "response", None), "headers", None) or {}
        value = headers.get("retry-after") if hasattr(headers, "get") else None
        try:
            return max(1, int(float(value))) if value is not None else None
        except ValueError:
            continue
    return None


# ---------- streaming ----------


async def _stream_one(
    provider: Provider, messages: Sequence[BaseMessage]
) -> AsyncIterator[AIMessageChunk]:
    """Chunks from one provider; no chunk within provider.timeout raises TimeoutError."""
    stream = provider.chat.astream(list(messages)).__aiter__()
    while True:
        try:
            chunk = await asyncio.wait_for(stream.__anext__(), provider.timeout)
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
    """Streaming chat over a provider chain. One instance per request (last_usage is per call)."""

    def __init__(
        self, providers: Sequence[Provider], *, attempts: int = ATTEMPTS, retry_wait: float = 0.5
    ) -> None:
        if not providers:
            raise ValueError("LLM needs at least one provider")
        self.providers = list(providers)
        self.attempts, self.retry_wait = attempts, retry_wait
        self.last_usage: Usage | None = None
        self._started = False

    async def astream(self, messages: Sequence[BaseMessage]) -> AsyncIterator[str]:
        """Answer text piece by piece from the first provider that is not busy."""
        self._started = False
        wait: int | None = None
        for provider in self.providers:
            try:
                async for text in self._with_retry(provider, messages):
                    yield text
                return
            except Exception as exc:
                if self._started or not is_busy(exc):
                    raise
                wait = retry_after_s(exc) or wait  # remember the provider's own hint
        raise AllProvidersBusy(wait or DEFAULT_RETRY_AFTER_S)

    async def ainvoke(self, messages: Sequence[BaseMessage]) -> str:
        """The whole answer as one string (for fast steps that need no streaming)."""
        return "".join([t async for t in self.astream(messages)])

    async def _with_retry(
        self, provider: Provider, messages: Sequence[BaseMessage]
    ) -> AsyncIterator[str]:
        """_run with retries + backoff for transient errors, as long as nothing was yielded yet."""

        def retry_allowed(exc: BaseException) -> bool:
            return not self._started and is_transient(exc)

        async for attempt in AsyncRetrying(
            retry=retry_if_exception(retry_allowed),
            stop=stop_after_attempt(self.attempts),
            wait=wait_exponential(multiplier=self.retry_wait, max=5),
            reraise=True,
        ):
            with attempt:
                async for text in self._run(provider, messages):
                    self._started = True
                    yield text

    async def _run(self, provider: Provider, messages: Sequence[BaseMessage]) -> AsyncIterator[str]:
        """Stream one provider and record its token usage."""
        total: AIMessageChunk | None = None
        async for chunk in _stream_one(provider, messages):
            total = chunk if total is None else total + chunk
            # .text joins text blocks: Gemini sends content as a list of blocks, Groq as a string.
            if text := chunk.text:
                yield text
        self.last_usage = _usage(provider, total)


# ---------- factory ----------


def _reasoning_kwargs(model: str) -> dict:
    """Keep the hidden 'thinking' of reasoning models short: it counts against max_tokens and
    the token budget, and low effort answered just as well in the S4 comparison."""
    if "gpt-oss" in model:
        return {"reasoning_effort": "low"}
    if "qwen" in model:
        return {"reasoning_format": "hidden"}
    return {}


def _groq(settings: Settings, model: str, role: Role) -> Provider:
    from langchain_groq import ChatGroq

    chat = ChatGroq(
        model=model,
        api_key=settings.groq_api_key,
        temperature=TEMPERATURE[role],
        max_tokens=MAX_TOKENS[role],
        timeout=TIMEOUT_S[role],
        max_retries=0,  # retries are ours (tenacity), so a 429 moves on at once
        **_reasoning_kwargs(model),
    )
    return Provider("groq", model, chat, TIMEOUT_S[role])


def _gemini(settings: Settings, role: Role) -> Provider:
    from langchain_google_genai import ChatGoogleGenerativeAI

    model = settings.gemini_fallback_model
    chat = ChatGoogleGenerativeAI(
        model=model,
        google_api_key=settings.gemini_api_key,
        temperature=TEMPERATURE[role],
        max_output_tokens=MAX_TOKENS[role] * 4,  # Gemini's thinking also counts here
        timeout=FALLBACK_TIMEOUT_S,
        max_retries=0,  # our tenacity retries 503 with backoff
    )
    return Provider("gemini", model, chat, FALLBACK_TIMEOUT_S)


def get_llm(role: Role, settings: Settings | None = None) -> LLM:
    """Groq main model -> Groq backup model -> Gemini, models from settings."""
    settings = settings or get_settings()
    main = settings.groq_fast_model if role == "fast" else settings.groq_answer_model
    chain = [_groq(settings, main, role)]
    if settings.groq_backup_model and settings.groq_backup_model != main:
        chain.append(_groq(settings, settings.groq_backup_model, role))
    chain.append(_gemini(settings, role))
    return LLM(chain)
