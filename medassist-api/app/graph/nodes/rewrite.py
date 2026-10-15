"""Rewrite node: turn the customer's message into a standalone English search query.

Why: the FDA labels are English and use generic names. "Panadol ke side effects" finds little,
"acetaminophen side effects" finds the Adverse Reactions chunk.

1. Brands / local generics -> US label names from drug_synonyms (Panadol -> acetaminophen),
   no LLM needed (graph/drugs.py, cached).
2. The fast LLM writes the English query ({"query", "drugs"}) only when it is needed:
   Roman Urdu / Urdu, a follow-up in a chat with history ("is it safe for kids?"), or a retry.
   A plain English first question is kept as it is, plus the generic names -> one Groq call saved.
   Unparseable LLM reply -> the same no-LLM query (never an empty query).
3. drug_names = every drug asked about; drug_filter = the ONE loaded drug (drug_documents) to
   search in, so chunks of other drugs cannot crowd it out. Two drugs, an unknown drug, or a retry
   (rewrite_count >= 1: "search broader") -> no filter.
"""

import time
from collections.abc import Awaitable, Callable

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.graph.drugs import CatalogCache, DrugCatalog
from app.graph.nodes.router import keyword_language
from app.graph.state import AgentState, add_timing
from app.graph.structured import ask_json, format_history
from app.llm.answer_prompt import load_prompt


class RewriteReply(BaseModel):
    query: str
    drugs: list[str] = Field(default_factory=list)


def plain_query(question: str, names: list[str]) -> str:
    """The question itself plus the generic names it does not contain yet:
    "Is Augmentin in stock?" -> "Is Augmentin in stock? (amoxicillin and clavulanate potassium)"."""
    question = " ".join(question.split())
    missing = [n for n in names if n not in question.lower()]
    return f"{question} ({', '.join(missing)})" if missing else question


def needs_llm(state: AgentState) -> bool:
    """Translate / resolve / broaden: not English, earlier chat, or a retry."""
    language = state.get("language") or keyword_language(state["question"])
    return language != "en" or bool(state.get("history")) or state.get("rewrite_count", 0) >= 1


def rewrite_messages(state: AgentState, names: list[str]) -> list:
    """System rules (prompts/rewrite.txt) + earlier chat + message + known generic names."""
    parts = []
    if history := format_history(state.get("history") or []):
        parts.append(f"Earlier chat:\n{history}")
    parts.append(f"Message: {state['question']}")
    if names:
        parts.append(f"Generic names of drugs in the message: {', '.join(names)}")
    if state.get("rewrite_count", 0) >= 1 and state.get("rewritten_query"):
        parts.append(
            f'The search query "{state["rewritten_query"]}" found nothing relevant. '
            "Write a BROADER query: other words, related label sections."
        )
    return [SystemMessage(load_prompt("rewrite")), HumanMessage("\n\n".join(parts))]


async def rewrite(state: AgentState, *, llm, catalog: DrugCatalog) -> dict:
    """Partial update: rewritten_query, drug_names, drug_filter, rewrite_count, tokens,
    timings["rewrite"]."""
    start = time.perf_counter()
    question = state["question"]
    count = state.get("rewrite_count", 0)
    found = catalog.mentioned(question)

    query, llm_drugs, tokens = None, [], 0
    if needs_llm(state):
        reply, tokens = await ask_json(llm, rewrite_messages(state, found), RewriteReply)
        if reply is not None and reply.query.strip():
            query, llm_drugs = " ".join(reply.query.split()), reply.drugs
    if query is None:
        query = plain_query(question, found)

    names = catalog.unique([*found, *llm_drugs, *catalog.mentioned(query)])
    loaded = catalog.loaded_of(names)
    # filter only when the question is about exactly one drug and it is loaded
    drug_filter = loaded[0] if len(loaded) == 1 and len(names) == 1 and count == 0 else None

    ms = round((time.perf_counter() - start) * 1000)
    return {
        "rewritten_query": query,
        "drug_names": names,
        "drug_filter": drug_filter,
        "rewrite_count": count + 1,
        "tokens": tokens,
        "timings": add_timing(state, "rewrite", ms),
    }


def make_rewrite(
    llm_factory: Callable, db, cache: CatalogCache
) -> Callable[[AgentState], Awaitable[dict]]:
    """The LangGraph node: cached catalog + a new fast LLM per call."""

    async def rewrite_node(state: AgentState) -> dict:
        """Rewrite node (see module docstring)."""
        return await rewrite(state, llm=llm_factory(), catalog=await cache.get(db))

    return rewrite_node
