"""The agent's finished answer and the citation helpers shared by its nodes.

RagAnswer is the last item of build.stream_agent(); services/chat.py stores it.
Citations: the answer LLM writes [n] markers; only markers that point at a real chunk count,
and each one becomes a Citation that links to the label's DailyMed page.
"""

import re
from dataclasses import dataclass, field

from app.rag.search import SearchHit
from app.repositories.knowledge import source_urls
from app.schemas.chat import Citation, ProductCard
from app.schemas.common import EscalationReason, Route
from app.services.language import Language

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
    """The finished answer of one agent run."""

    text: str
    route: Route
    citations: list[Citation] = field(default_factory=list)
    tokens: int | None = None  # input + output tokens of all LLM calls (None: no call)
    products: list[ProductCard] = field(default_factory=list)  # shop cards
    # set when the answer must go to a pharmacist (services/chat.py writes the escalation row)
    escalation_reason: EscalationReason | None = None
    pharmacy_id: str | None = None  # the pharmacy found for the escalation


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
