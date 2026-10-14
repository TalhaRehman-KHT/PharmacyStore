"""app/llm/providers.py with fake chat models (no network)."""

import asyncio

import pytest
from langchain_core.messages import AIMessageChunk, HumanMessage
from pydantic import SecretStr

from app.config import Settings
from app.llm import providers as p

MESSAGES = [HumanMessage(content="hi")]


class StatusError(Exception):
    def __init__(self, status_code: int) -> None:
        super().__init__(f"HTTP {status_code}")
        self.status_code = status_code


class FakeChat:
    """Streams `parts`; each call first raises the next of `errors`; usage comes last."""

    def __init__(self, parts=("Hel", "lo"), errors=(), fail_after: int | None = None, delay=0.0):
        self.parts, self.errors = list(parts), list(errors)
        self.fail_after, self.delay = fail_after, delay
        self.calls = 0

    async def astream(self, messages):
        self.calls += 1
        if self.errors:
            raise self.errors.pop(0)
        for i, part in enumerate(self.parts):
            if self.fail_after is not None and i == self.fail_after:
                raise StatusError(503)
            await asyncio.sleep(self.delay)
            yield AIMessageChunk(content=part)
        yield AIMessageChunk(
            content="",
            usage_metadata={"input_tokens": 7, "output_tokens": 3, "total_tokens": 10},
        )


def make_llm(primary: FakeChat, fallback: FakeChat | None = None, timeout=1.0) -> p.LLM:
    fb = p.Provider("gemini", "gem-flash", fallback) if fallback else None
    return p.LLM(p.Provider("groq", "gpt-oss", primary), fb, timeout=timeout, retry_wait=0)


async def collect(llm: p.LLM) -> list[str]:
    return [t async for t in llm.astream(MESSAGES)]


async def test_streaming_yields_text_and_records_usage():
    llm = make_llm(FakeChat(parts=("Ibu", "profen", " [1]")))
    assert await collect(llm) == ["Ibu", "profen", " [1]"]
    assert llm.last_usage == p.Usage("groq", "gpt-oss", 7, 3)


async def test_content_blocks_are_streamed_as_text():
    class BlockChat(FakeChat):
        async def astream(self, messages):
            yield AIMessageChunk(content=[{"type": "text", "text": "po"}])
            yield AIMessageChunk(content=[{"type": "text", "text": "ng"}])

    assert await collect(make_llm(BlockChat())) == ["po", "ng"]


async def test_429_falls_back_to_gemini_without_retrying_groq():
    groq = FakeChat(errors=[StatusError(429)])
    gemini = FakeChat(parts=("from ", "gemini"))
    llm = make_llm(groq, gemini)
    assert "".join(await collect(llm)) == "from gemini"
    assert groq.calls == 1 and gemini.calls == 1
    assert llm.last_usage.provider == "gemini" and llm.last_usage.model == "gem-flash"


async def test_timeout_falls_back_to_gemini():
    llm = make_llm(FakeChat(delay=0.2), FakeChat(parts=("ok",)), timeout=0.05)
    assert await collect(llm) == ["ok"]
    assert llm.last_usage.provider == "gemini"


async def test_transient_error_is_retried_on_groq():
    groq = FakeChat(errors=[StatusError(503), StatusError(502)])
    gemini = FakeChat(parts=("never",))
    llm = make_llm(groq, gemini)
    assert "".join(await collect(llm)) == "Hello"
    assert groq.calls == 3 and gemini.calls == 0


async def test_no_retry_or_fallback_after_text_was_sent():
    groq = FakeChat(parts=("a", "b", "c"), fail_after=1)
    gemini = FakeChat(parts=("never",))
    llm = make_llm(groq, gemini)
    seen = []
    with pytest.raises(StatusError):
        async for t in llm.astream(MESSAGES):
            seen.append(t)
    assert seen == ["a"] and groq.calls == 1 and gemini.calls == 0  # no repeated text


async def test_other_errors_are_raised():
    llm = make_llm(FakeChat(errors=[StatusError(400)]), FakeChat())
    with pytest.raises(StatusError):
        await llm.ainvoke(MESSAGES)


async def test_429_without_fallback_raises():
    llm = make_llm(FakeChat(errors=[StatusError(429)]))
    with pytest.raises(p.FallbackNeeded):
        await llm.ainvoke(MESSAGES)


async def test_ainvoke_joins_the_stream():
    assert await make_llm(FakeChat()).ainvoke(MESSAGES) == "Hello"


def test_error_classification():
    assert p.is_rate_limit(StatusError(429))
    assert p.is_timeout(TimeoutError())
    assert p.is_transient(StatusError(500)) and not p.is_transient(StatusError(429))
    assert not p.is_transient(StatusError(400))


def test_get_llm_uses_models_from_settings():
    settings = Settings(
        supabase_url="https://x.supabase.co",
        supabase_service_key=SecretStr("k"),
        groq_api_key=SecretStr("g"),
        gemini_api_key=SecretStr("m"),
        groq_fast_model="fast-m",
        groq_answer_model="answer-m",
        gemini_fallback_model="fallback-m",
        _env_file=None,
    )
    fast, answer = p.get_llm("fast", settings), p.get_llm("answer", settings)
    assert (fast.primary.model, answer.primary.model) == ("fast-m", "answer-m")
    assert fast.fallback.model == answer.fallback.model == "fallback-m"
    assert fast.timeout < answer.timeout < fast.fallback_timeout
