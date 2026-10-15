"""Generate node: the final answer from graded label chunks and / or shop product cards.

What it writes depends on what the earlier nodes found:
1. graded_chunks (route knowledge / both): the S1 answer prompt (prompts/answer.txt, reply in
   en / roman_urdu / urdu) streamed from the answer LLM, with [n] citations for chunks only.
   Hold-back rule: nothing is shown until the first valid [n], and an
   answer without one is replaced by the no-evidence text (route no_evidence).
2. product_results (route product / both): a short FIXED text over the cards (tools.product_text),
   not written by the LLM, so prices and stock cannot be invented. The cards themselves go to the
   client in meta.products and are drawn under the answer.
3. both: text 1, a blank line, text 2.
A knowledge answer may have cards too (graph/build.py runs tools for named drugs) but no product
text; when it ends as no evidence its cards are dropped.

`emit` gets every piece of LLM text the moment it may be shown (graph/build.py passes the
LangGraph stream writer, which feeds the SSE `token` events).
"""

import time
from collections.abc import Callable

from app.graph.answer import build_citations, used_numbers
from app.graph.nodes.no_evidence import no_evidence_text
from app.graph.nodes.router import keyword_language
from app.graph.nodes.tools import product_text
from app.graph.state import AgentLanguage, AgentState, add_timing
from app.llm.answer_prompt import answer_messages

Emit = Callable[[str], None]


def _ignore(_piece: str) -> None:
    pass


async def cited_answer(
    state: AgentState, chunks: list, language: AgentLanguage, llm, emit: Emit
) -> tuple[str | None, int]:
    """(answer text, tokens). Text is None when the model cited no chunk: it must not be shown."""
    messages = answer_messages(state["question"], chunks, state.get("history") or [], language)
    text, live = "", False
    async for piece in llm.astream(messages):
        text += piece
        if live:
            emit(piece)
        elif used_numbers(text, len(chunks)):
            live = True
            emit(text)  # everything held back so far, in one piece
    usage = llm.last_usage
    tokens = usage.input_tokens + usage.output_tokens if usage else 0
    return (text if live else None), tokens


async def generate(
    state: AgentState, *, llm_factory: Callable, db, emit: Emit = _ignore
) -> dict:
    """Partial update: answer, citations, route, tokens, timings["generate"]."""
    start = time.perf_counter()
    language = state.get("language") or keyword_language(state["question"])
    chunks = list(state.get("graded_chunks") or [])
    route = state.get("route") or "knowledge"
    parts: list[str] = []
    citations, tokens = [], 0

    if chunks:
        text, tokens = await cited_answer(state, chunks, language, llm_factory(), emit)
        if text is None:
            route = "no_evidence"
            parts.append(no_evidence_text(language))
        else:
            parts.append(text)
            citations = await build_citations(db, chunks, used_numbers(text, len(chunks)))

    if state.get("route") in ("product", "both"):
        products = state.get("product_results") or []
        asked = bool(state.get("drug_names"))
        parts.append(product_text(products, language, asked=asked))

    if not parts:  # nothing to say (should not happen: the edges send no-chunk cases elsewhere)
        route = "no_evidence"
        parts.append(no_evidence_text(language))

    ms = round((time.perf_counter() - start) * 1000)
    update = {
        "answer": "\n\n".join(parts),
        "citations": citations,
        "route": route,
        "tokens": tokens,
        "timings": add_timing(state, "generate", ms),
    }
    if route == "no_evidence" and state.get("route") != "both":
        update["product_results"] = []  # no "Add to cart" under an unanswered knowledge question
    return update
