"""Plain retrieve-then-generate RAG, kept as the research baseline (variant "naive").

question -> embed_query -> hybrid_search (20) -> rerank (5) -> prompt with chunks [1]..[5]
-> stream the answer LLM -> keep only the citations the answer really used.

No-evidence rule: no chunk found, or an answer without one valid [n] -> route no_evidence and the
standard NO_EVIDENCE_TEXT instead of the model's words. To never show text that is replaced
later, the stream is HELD BACK until the first valid [n] appears; from then on every piece goes
out at once. So the first token arrives a little later (end of the first cited sentence).
"""

import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from app.llm.answer_prompt import answer_messages
from app.rag.deps import RagDeps
from app.rag.retrieve import retrieve
from app.rag.search import SearchHit
from app.repositories.knowledge import source_urls
from app.schemas.chat import Citation
from app.schemas.common import Route

NO_EVIDENCE_TEXT = (
    "I could not find this in the medicine labels I have, so I cannot answer it safely. "
    "Please ask a pharmacist or your doctor.\n\n(Ye maloomat mere paas mojood labels mein nahi "
    "hai. Pharmacist ya doctor se poochein.)"
)
DAILYMED_SEARCH = "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query={drug}"
_MARKER = re.compile(r"\[(\d+)\]")


@dataclass(frozen=True)
class RagAnswer:
    """The finished answer (last item of answer_stream)."""

    text: str
    route: Route
    citations: list[Citation] = field(default_factory=list)
    tokens: int | None = None  # input + output tokens of the LLM call (None: no call)


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


async def answer_stream(question: str, deps: RagDeps) -> AsyncIterator[str | RagAnswer]:
    """Answer text pieces (str) as they arrive, then one RagAnswer with the full result."""
    vector = await deps.embedder.embed_query(question)
    chunks = await retrieve(
        deps.db, deps.reranker, question, vector, embed_model=deps.embedder.model
    )
    if not chunks:
        yield NO_EVIDENCE_TEXT
        yield RagAnswer(NO_EVIDENCE_TEXT, "no_evidence")
        return

    llm = deps.answer_llm()
    text, live = "", False
    async for piece in llm.astream(answer_messages(question, chunks)):
        text += piece
        if live:
            yield piece
        elif used_numbers(text, len(chunks)):
            live = True
            yield text  # everything held back so far, in one piece
    usage = llm.last_usage
    tokens = usage.input_tokens + usage.output_tokens if usage else None

    if not live:  # the model never cited a chunk: do not show unsupported text
        yield NO_EVIDENCE_TEXT
        yield RagAnswer(NO_EVIDENCE_TEXT, "no_evidence", tokens=tokens)
        return
    citations = await build_citations(deps.db, chunks, used_numbers(text, len(chunks)))
    yield RagAnswer(text, "knowledge", citations, tokens)
