"""Plain retrieve-then-generate RAG, kept as the research baseline (variant "naive").

question -> embed_query -> retrieve (default: vector search, top 4; settings RETRIEVAL_MODE /
RERANK_ENABLED) -> prompt with chunks [1]..[4] -> stream the answer LLM
-> keep only the citations the answer really used.
Earlier turns of the chat go into the prompt (so "it" / "and for children?" make sense) and the
previous customer question is added to the search text.

No-evidence rule: no chunk found, or an answer without one valid [n] -> route no_evidence and the
standard NO_EVIDENCE_TEXT instead of the model's words. To never show text that is replaced
later, the stream is HELD BACK until the first valid [n] appears; from then on every piece goes
out at once. So the first token arrives a little later (end of the first cited sentence).
"""

import re
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field

from app.llm.answer_prompt import Turn, answer_messages
from app.rag.deps import RagDeps
from app.rag.retrieve import retrieve
from app.rag.search import SearchHit
from app.repositories.knowledge import source_urls
from app.schemas.chat import Citation, ProductCard
from app.schemas.common import Route
from app.services.language import Language, detect_language

# Shown instead of an uncited answer, in the language of the question.
NO_EVIDENCE_TEXT: dict[Language, str] = {
    "en": "I could not find this in the medicine labels I have, so I cannot answer it safely. "
    "Please ask a pharmacist or your doctor.",
    "roman_urdu": "Ye maloomat mere paas maujood medicine labels mein nahi hai, is liye main is ka "
    "jawab mehfooz tareeqe se nahi de sakta. Pharmacist ya doctor se poochein.",
}
DAILYMED_SEARCH = "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query={drug}"
_MARKER = re.compile(r"\[(\d+)\]")


@dataclass(frozen=True)
class RagAnswer:
    """The finished answer (last item of answer_stream)."""

    text: str
    route: Route
    citations: list[Citation] = field(default_factory=list)
    tokens: int | None = None  # input + output tokens of the LLM call (None: no call)
    products: list[ProductCard] = field(default_factory=list)  # agent only (shop cards)


def used_numbers(text: str, n_chunks: int) -> list[int]:
    """The [n] markers in `text` that point at a real chunk (1..n_chunks), first use first."""
    seen: list[int] = []
    for m in _MARKER.finditer(text):
        n = int(m.group(1))
        if 1 <= n <= n_chunks and n not in seen:
            seen.append(n)
    return seen


async def build_citations(db, chunks: list[SearchHit], numbers: list[int]) -> list[Citation]:
    """One Citation per used [n], sorted by n; url = the label's DailyMed page."""
    used = [(n, chunks[n - 1]) for n in sorted(numbers)]
    urls = await source_urls(db, [c.drug_name for _, c in used])
    return [
        Citation(
            n=n,
            drug=c.drug_name,
            section=c.section,
            url=urls.get(c.drug_name) or DAILYMED_SEARCH.format(drug=c.drug_name),
        )
        for n, c in used
    ]


def search_text(question: str, history: Sequence[Turn]) -> str:
    """What is embedded and searched: the question, plus the previous customer question when the
    chat has one, so a follow-up ("and for children?") still finds the drug talked about before."""
    previous = next((text for role, text in reversed(history) if role == "user"), None)
    return f"{previous}\n{question}" if previous else question


async def answer_stream(
    question: str, deps: RagDeps, history: Sequence[Turn] = ()
) -> AsyncIterator[str | RagAnswer]:
    """Answer text pieces (str) as they arrive, then one RagAnswer with the full result.
    `history` = earlier messages of this chat, oldest first (see answer_prompt.Turn)."""
    language = detect_language(question)
    query = search_text(question, history)
    vector = await deps.embedder.embed_query(query)
    chunks = await retrieve(
        deps.db,
        deps.reranker,
        query,
        vector,
        mode=deps.retrieval_mode,
        embed_model=deps.embedder.model,
    )
    no_evidence = NO_EVIDENCE_TEXT[language]
    if not chunks:
        yield no_evidence
        yield RagAnswer(no_evidence, "no_evidence")
        return

    llm = deps.answer_llm()
    text, live = "", False
    messages = answer_messages(question, chunks, history, language)
    async for piece in llm.astream(messages):
        text += piece
        if live:
            yield piece
        elif used_numbers(text, len(chunks)):
            live = True
            yield text  # everything held back so far, in one piece
    usage = llm.last_usage
    tokens = usage.input_tokens + usage.output_tokens if usage else None

    if not live:  # the model never cited a chunk: do not show unsupported text
        yield no_evidence
        yield RagAnswer(no_evidence, "no_evidence", tokens=tokens)
        return
    citations = await build_citations(deps.db, chunks, used_numbers(text, len(chunks)))
    yield RagAnswer(text, "knowledge", citations, tokens)
