"""Retrieve node: search the FDA label chunks with the rewritten query.

rewritten_query (English, generic names, from the rewrite node) -> Gemini query vector ->
app/rag/retrieve (the S4 mode: vector by default, hybrid / hybrid_rerank by settings), only in
the chunks of `drug_filter` when the rewrite node set one.

It fetches CANDIDATES chunks, a few more than the answer uses (TOP_K): the grader drops the
irrelevant ones, and enough should be left for the answer.
"""

import time
from collections.abc import Awaitable, Callable

from app.graph.state import AgentState, add_timing
from app.rag.deps import RagDeps
from app.rag.retrieve import retrieve as rag_retrieve

CANDIDATES = 6  # chunks shown to the grader (each <= 1200 chars, ~300 tokens)


async def retrieve(state: AgentState, *, deps: RagDeps) -> dict:
    """Partial update: candidates (SearchHit, best first), timings["retrieve"]."""
    start = time.perf_counter()
    query = state.get("rewritten_query") or state["question"]
    vector = await deps.embedder.embed_query(query)
    hits = await rag_retrieve(
        deps.db,
        deps.reranker,
        query,
        vector,
        mode=deps.retrieval_mode,
        top_k=CANDIDATES,
        embed_model=deps.embedder.model,
        drug_filter=state.get("drug_filter"),
    )
    ms = round((time.perf_counter() - start) * 1000)
    return {"candidates": hits, "timings": add_timing(state, "retrieve", ms)}


def make_retrieve(deps: RagDeps) -> Callable[[AgentState], Awaitable[dict]]:
    """The LangGraph node with the app's RAG dependencies."""

    async def retrieve_node(state: AgentState) -> dict:
        """Retrieve node (see module docstring)."""
        return await retrieve(state, deps=deps)

    return retrieve_node
