"""Structured output from a fast LLM: ask for one JSON object, check it with a Pydantic model.

Our LLM chain (Groq -> Groq backup -> Gemini) only streams text, so instead of a provider-specific
"tool call" mode the prompt asks for JSON and we validate it here. Models sometimes wrap the JSON
in ``` fences or add a sentence, so the first {...} block is taken.
"""

import re
from collections.abc import Sequence

from langchain_core.messages import BaseMessage
from pydantic import BaseModel, ValidationError

_OBJECT = re.compile(r"\{.*\}", re.DOTALL)
HISTORY_TURNS = 4  # earlier messages shown to a fast step (enough for "it" / "and for kids?")
HISTORY_CHARS = 300  # each cut to this length (the fast model has a small token budget)


def format_history(history: Sequence[tuple[str, str]]) -> str:
    """The last HISTORY_TURNS messages as 'role: text' lines, '' for a new chat."""
    return "\n".join(
        f"{role}: {' '.join(text.split())[:HISTORY_CHARS]}"
        for role, text in list(history)[-HISTORY_TURNS:]
    )


class ParseError(ValueError):
    """The LLM reply was not the JSON object we asked for."""


def parse_json[M: BaseModel](text: str, model: type[M]) -> M:
    """The first {...} in `text` as `model`; ParseError when missing or invalid."""
    m = _OBJECT.search(text or "")
    if not m:
        raise ParseError(f"no JSON object in reply: {text[:80]!r}")
    try:
        return model.model_validate_json(m.group(0))
    except ValidationError as exc:
        raise ParseError(str(exc)) from exc


async def ask_json[M: BaseModel](
    llm, messages: Sequence[BaseMessage], model: type[M]
) -> tuple[M | None, int]:
    """(parsed reply or None on ParseError, tokens used). Busy errors (AllProvidersBusy) are
    NOT caught: the API turns them into HTTP 429."""
    text = await llm.ainvoke(messages)
    usage = llm.last_usage
    tokens = usage.input_tokens + usage.output_tokens if usage else 0
    try:
        return parse_json(text, model), tokens
    except ParseError:
        return None, tokens
