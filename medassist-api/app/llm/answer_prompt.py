"""Build the answer prompt: system rules (app/prompts/answer.txt) and a human message with the
numbered context + question (app/prompts/answer_user.txt).

Context block n is the n-th retrieved chunk, so a citation [n] in the answer maps back to
chunks[n - 1] (its chunk_id goes into chat_messages.citations later).
"""

from collections.abc import Sequence
from functools import cache
from pathlib import Path

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from app.rag.search import SearchHit

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
NO_CONTEXT = "(no context found)"


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


def answer_messages(question: str, chunks: Sequence[SearchHit]) -> list[BaseMessage]:
    """System message = rules only (answer.txt); human message = numbered context + question
    (answer_user.txt). str.replace, not str.format: label text may contain { }."""
    user = (
        load_prompt("answer_user")
        .replace("{context}", format_context(chunks))
        .replace("{question}", question.strip())
    )
    return [SystemMessage(content=load_prompt("answer")), HumanMessage(content=user)]
