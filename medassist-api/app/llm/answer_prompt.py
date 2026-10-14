"""Build the answer prompt: system rules (app/prompts/answer.txt), earlier turns of the chat, and
a human message with the numbered context + question (app/prompts/answer_user.txt).

Context block n is the n-th retrieved chunk, so a citation [n] in the answer maps back to
chunks[n - 1] (its chunk_id goes into chat_messages.citations later).
"""

import re
from collections.abc import Sequence
from functools import cache
from pathlib import Path

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from app.rag.search import SearchHit
from app.services.language import Language

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
NO_CONTEXT = "(no context found)"
LANGUAGE_NAMES: dict[Language, str] = {"en": "English", "roman_urdu": "Roman Urdu"}
HISTORY_CHARS = 600  # earlier messages are cut to this length (tokens are the Groq limit)

Turn = tuple[str, str]  # (role, content): role = "user" | "assistant" | "pharmacist"
_MARKER = re.compile(r"\s*\[\d+\]")


@cache
def load_prompt(name: str) -> str:
    """Text of app/prompts/<name>.txt (read once)."""
    return (PROMPTS_DIR / f"{name}.txt").read_text("utf-8")


def format_context(chunks: Sequence[SearchHit]) -> str:
    """'[1] drug / section\\ntext' blocks separated by blank lines, numbered from 1."""
    if not chunks:
        return NO_CONTEXT
    return "\n\n".join(
        f"[{n}] {c.drug_name} / {c.section}\n{c.content.strip()}" for n, c in enumerate(chunks, 1)
    )


def history_messages(history: Sequence[Turn]) -> list[BaseMessage]:
    """Earlier turns as chat messages. Old [n] markers are removed (they pointed at the context of
    an earlier turn, not at this one) and long messages are shortened."""
    out: list[BaseMessage] = []
    for role, content in history:
        text = _MARKER.sub("", content).strip()
        if len(text) > HISTORY_CHARS:
            text = text[:HISTORY_CHARS].rsplit(" ", 1)[0] + " ..."
        if role == "user":
            out.append(HumanMessage(content=text))
        elif role == "pharmacist":
            out.append(AIMessage(content=f"(Pharmacist reply) {text}"))
        else:
            out.append(AIMessage(content=text))
    return out


def answer_messages(
    question: str,
    chunks: Sequence[SearchHit],
    history: Sequence[Turn] = (),
    language: Language = "en",
) -> list[BaseMessage]:
    """System message = rules only (answer.txt); then the earlier turns; last the human message with
    the numbered context, the question and the reply language (answer_user.txt).
    str.replace, not str.format: label text may contain { }."""
    user = (
        load_prompt("answer_user")
        .replace("{context}", format_context(chunks))
        .replace("{question}", question.strip())
        .replace("{language}", LANGUAGE_NAMES[language])
    )
    return [
        SystemMessage(content=load_prompt("answer")),
        *history_messages(history),
        HumanMessage(content=user),
    ]
