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
    chain = [p.Provider("groq", "gpt-oss", primary, timeout)]
    if fallback:
        chain.append(p.Provider("gemini", "gem-flash", fallback, timeout))
    return p.LLM(chain, retry_wait=0)


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


class RetryAfterError(StatusError):
    def __init__(self, seconds: str) -> None:
        super().__init__(429)
        self.response = type("R", (), {"headers": {"retry-after": seconds}, "status_code": 429})()


async def test_every_provider_busy_raises_all_busy_with_retry_after():
    llm = make_llm(FakeChat(errors=[RetryAfterError("12")]), FakeChat(errors=[StatusError(429)]))
    with pytest.raises(p.AllProvidersBusy) as info:
        await llm.ainvoke(MESSAGES)
    assert info.value.retry_after_s == 12


async def test_all_busy_default_retry_after():
    llm = make_llm(FakeChat(errors=[StatusError(429)]))
    with pytest.raises(p.AllProvidersBusy) as info:
        await llm.ainvoke(MESSAGES)
    assert info.value.retry_after_s == p.DEFAULT_RETRY_AFTER_S


async def test_three_provider_chain_backup_model_then_gemini():
    main = FakeChat(errors=[StatusError(429)])
    backup = FakeChat(errors=[StatusError(429)])
    gemini = FakeChat(parts=("ok",))
    llm = p.LLM(
        [
            p.Provider("groq", "qwen", main, 1.0),
            p.Provider("groq", "gpt-oss-20b", backup, 1.0),
            p.Provider("gemini", "flash", gemini, 1.0),
        ],
        retry_wait=0,
    )
    assert await llm.ainvoke(MESSAGES) == "ok"
    assert (main.calls, backup.calls, gemini.calls) == (1, 1, 1)
    assert llm.last_usage.model == "flash"


async def test_gemini_503_is_retried_with_backoff_then_answers():
    gemini = FakeChat(parts=("late",), errors=[StatusError(503), StatusError(503)])
    llm = make_llm(FakeChat(errors=[StatusError(429)]), gemini)
    assert await llm.ainvoke(MESSAGES) == "late"
    assert gemini.calls == 3


async def test_5xx_that_stays_moves_on_and_ends_busy():
    llm = make_llm(FakeChat(errors=[StatusError(503)] * 3), FakeChat(errors=[StatusError(503)] * 3))
    with pytest.raises(p.AllProvidersBusy):
        await llm.ainvoke(MESSAGES)


def test_wrapped_errors_are_classified_by_their_cause():
    try:
        try:
            raise StatusError(503)
        except StatusError as inner:
            raise RuntimeError("wrapped by langchain") from inner
    except RuntimeError as outer:
        assert p.is_transient(outer) and p.is_busy(outer)


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
        groq_backup_model="backup-m",
        gemini_fallback_model="fallback-m",
        _env_file=None,
    )
    fast, answer = p.get_llm("fast", settings), p.get_llm("answer", settings)
    assert [x.model for x in answer.providers] == ["answer-m", "backup-m", "fallback-m"]
    assert [x.model for x in fast.providers] == ["fast-m", "backup-m", "fallback-m"]
    assert [x.name for x in answer.providers] == ["groq", "groq", "gemini"]
    assert fast.providers[0].timeout < answer.providers[0].timeout < answer.providers[-1].timeout
    assert answer.providers[0].chat.max_tokens == p.MAX_TOKENS["answer"]


def test_backup_same_as_main_is_not_repeated():
    settings = Settings(
        supabase_url="https://x.supabase.co",
        supabase_service_key=SecretStr("k"),
        groq_api_key=SecretStr("g"),
        gemini_api_key=SecretStr("m"),
        groq_fast_model="same",
        groq_backup_model="same",
        _env_file=None,
    )
    assert [x.model for x in p.get_llm("fast", settings).providers][:2] != ["same", "same"]


def test_reasoning_kwargs():
    assert p._reasoning_kwargs("openai/gpt-oss-20b") == {"reasoning_effort": "low"}
    assert p._reasoning_kwargs("qwen/qwen3.8-27b") == {"reasoning_format": "hidden"}
    assert p._reasoning_kwargs("allam-2-7b") == {}
