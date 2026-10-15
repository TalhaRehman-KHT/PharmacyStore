"""AgentState: the one dict every LangGraph node reads, and returns a partial update of.

A node returns only the keys it changed; LangGraph merges them into the state. Two keys add up
instead of being replaced (see the Annotated reducers): `tokens` (LLM tokens of all steps) and
`timings` (milliseconds per node), so every node can report its own share.
"""

import operator
from typing import Annotated, Literal, TypedDict

from app.llm.answer_prompt import Turn
from app.schemas.common import Route

# What the router decides. The state's `route` (schemas.common.Route, stored on the message) can
# later also become emergency / escalated / no_evidence; those are set by other nodes.
AgentRoute = Literal["knowledge", "product", "both", "out_of_scope"]
AgentLanguage = Literal["en", "roman_urdu", "urdu"]  # urdu = Urdu script


def merge_timings(old: dict[str, int], new: dict[str, int]) -> dict[str, int]:
    """Reducer for `timings`: keep the old entries, add / overwrite the new ones."""
    return {**(old or {}), **(new or {})}


def add_timing(state: "AgentState", node: str, ms: int) -> dict[str, int]:
    """`timings` update for a node that may run twice (the retry loop): the times add up."""
    return {node: (state.get("timings") or {}).get(node, 0) + ms}


class AgentState(TypedDict, total=False):
    # input (set by the caller)
    question: str
    language: AgentLanguage
    history: list[Turn]  # earlier messages of this chat, oldest first
    user_id: str
    pharmacy_id: str | None

    # router
    route: Route  # router: an AgentRoute; later nodes may set no_evidence, escalated ...

    # rewrite
    rewritten_query: str  # standalone English search query
    drug_names: list[str]  # generic names of the drugs asked about (loaded or not)
    drug_filter: str | None  # the ONE loaded drug to search in (hybrid_search), else None
    rewrite_count: int  # how often rewrite ran (the retry loop stops at 2)

    # retrieve / grade / tools (G2, G3)
    candidates: list  # SearchHit from retrieve (best first)
    graded_chunks: list  # SearchHit the grader kept (best first, at most rag.retrieve.TOP_K)
    product_results: list  # rows from graph/nodes/tools.py

    # answer (G4 / V1)
    answer: str
    citations: list
    safety: str | None
    escalation_reason: str | None

    # bookkeeping (added up, see the reducers)
    tokens: Annotated[int, operator.add]
    timings: Annotated[dict[str, int], merge_timings]
