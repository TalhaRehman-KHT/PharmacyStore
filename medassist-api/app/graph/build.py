"""Graph wiring: the nodes and edges of the LangGraph agent, compiled ONCE, and the runners.

    START -> guard -+-> emergency -> END                    (fixed text, no LLM)
                    +-> router -+-> out_of_scope -> END     (weather, jokes ...)
                                +-> rewrite -+-> retrieve -> grade -+-> generate ---+-> END
                                             |                      +-> rewrite     |
                                             |                      +-> no_evidence +-> escalate
                                             +-> tools -+-> generate (product)   (risky) -> END
                                                        +-> END (both / knowledge)

  grade -> rewrite is the one retry; "both / knowledge": the retrieve path answers.

- guard (V1) runs first: rules, then the fast LLM. A risky question (personal dosing,
  prescription-only, pregnancy or child) still takes the normal path for GENERAL cited label info;
  escalate then adds the pharmacist note, and services/chat.py writes the escalation row. A risky
  question is never refused as out of scope.

- rewrite comes before tools too: tools needs the drug names (Panadol -> acetaminophen).
- "both", and "knowledge" about a named drug, fan out: tools and retrieve run in the SAME step
  (in parallel). The tools branch then ends; generate / no_evidence on the retrieve path read its
  product_results from the state. On the retry (rewrite_count 2) only retrieve runs again.
- Cards under a knowledge answer only when the answer is cited (a no-evidence answer gets no
  "Add to cart"); "both" always keeps them (the customer asked about stock). Only "product" and
  "both" get the product TEXT; a knowledge answer stays purely medical.
- Nodes are the pure functions of graph/nodes/; the wrappers below only hand them their
  dependencies. Those (DB, LLMs, catalog) are NOT built into the graph: they come per run in
  the LangGraph runtime `context` (AgentContext), so the same compiled graph serves the app and
  the tests (fakes) alike.

Runners: stream_agent() yields answer text pieces, then one RagAnswer (the shape the naive
baseline returns, so services/chat.py treats both variants the same); run_agent() returns only
the RagAnswer. LLM text streams live from the generate node (custom stream events); fixed texts
(product list, no evidence, out of scope, emergency, escalation note) are sent word by word when
the graph has finished.

Tracing: with LANGSMITH_API_KEY set, enable_tracing() switches LangSmith on, and LangGraph traces
every node of every run (project LANGSMITH_PROJECT).
"""

import logging
import os
import re
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from functools import cache
from typing import Literal

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime

from app.baseline.naive import RagAnswer
from app.config import Settings
from app.graph.nodes.escalate import escalate
from app.graph.nodes.generate import generate
from app.graph.nodes.grade import after_grade, grade
from app.graph.nodes.guard import RISKY, emergency, guard
from app.graph.nodes.no_evidence import no_evidence
from app.graph.nodes.out_of_scope import out_of_scope
from app.graph.nodes.retrieve import retrieve
from app.graph.nodes.rewrite import rewrite
from app.graph.nodes.router import route
from app.graph.nodes.tools import tools
from app.graph.state import AgentState
from app.llm.answer_prompt import Turn
from app.rag.deps import RagDeps

logger = logging.getLogger(__name__)
_PIECES = re.compile(r"\s*\S+\s*")  # words with their spaces / blank lines (join back exactly)


@dataclass(frozen=True)
class AgentContext:
    """What the nodes need at run time (LangGraph runtime context)."""

    deps: RagDeps


Ctx = Runtime[AgentContext]


# ---------- nodes: wrappers that hand the pure node functions their dependencies ----------


async def guard_node(state: AgentState, runtime: Ctx) -> dict:
    """Guard (graph/nodes/guard.py): safety category + escalation reason."""
    return await guard(state, llm_factory=runtime.context.deps.fast_llm)


async def router_node(state: AgentState, runtime: Ctx) -> dict:
    """Router (graph/nodes/router.py): route + language."""
    return await route(state, llm=runtime.context.deps.fast_llm())


async def rewrite_node(state: AgentState, runtime: Ctx) -> dict:
    """Rewrite (graph/nodes/rewrite.py): English search query + drug names."""
    deps = runtime.context.deps
    return await rewrite(state, llm=deps.fast_llm(), catalog=await deps.catalog.get(deps.db))


async def retrieve_node(state: AgentState, runtime: Ctx) -> dict:
    """Retrieve (graph/nodes/retrieve.py): candidate label chunks."""
    return await retrieve(state, deps=runtime.context.deps)


async def grade_node(state: AgentState, runtime: Ctx) -> dict:
    """Grade (graph/nodes/grade.py): keep the chunks that help."""
    return await grade(state, llm=runtime.context.deps.fast_llm())


async def tools_node(state: AgentState, runtime: Ctx) -> dict:
    """Tools (graph/nodes/tools.py): read-only shop product cards."""
    deps = runtime.context.deps
    catalog = await deps.catalog.get(deps.db)
    return await tools(state, db=deps.db, catalog=catalog, currency=deps.shop_currency)


async def generate_node(state: AgentState, runtime: Ctx) -> dict:
    """Generate (graph/nodes/generate.py): cited answer + product text, LLM text streamed."""
    deps, write = runtime.context.deps, runtime.stream_writer
    return await generate(
        state, llm_factory=deps.answer_llm, db=deps.db, emit=lambda t: write({"token": t})
    )


# ---------- edges ----------


def after_guard(state: AgentState) -> Literal["emergency", "router"]:
    """An emergency gets the fixed emergency text at once; everything else goes on."""
    return "emergency" if state.get("safety") == "emergency" else "router"


def after_router(state: AgentState) -> Literal["out_of_scope", "rewrite"]:
    """Out of scope stops here (never for a risky question: the guard found a medicine risk);
    every medicine question needs the rewrite (drug names) first."""
    if state.get("route") == "out_of_scope" and not state.get("escalation_reason"):
        return "out_of_scope"
    return "rewrite"


def after_rewrite(state: AgentState) -> list[str]:
    """product -> tools; both, or knowledge about a named drug -> tools AND retrieve in parallel
    (first pass only: the retry does not search the shop again); else retrieve."""
    route = state.get("route")
    if route == "product":
        return ["tools"]
    first_pass = state.get("rewrite_count", 0) <= 1
    if first_pass and (route == "both" or (route == "knowledge" and state.get("drug_names"))):
        return ["tools", "retrieve"]
    return ["retrieve"]


def after_answer(state: AgentState) -> str:
    """generate / no_evidence -> escalate for a risky question, else the end."""
    return "escalate" if state.get("escalation_reason") in RISKY else END


def after_tools(state: AgentState) -> str:
    """product -> generate; both / knowledge -> this branch ends (the retrieve branch answers)."""
    return "generate" if state.get("route") == "product" else END


@cache
def agent_graph():
    """The compiled agent graph (built once per process)."""
    g = StateGraph(AgentState, context_schema=AgentContext)
    g.add_node("guard", guard_node)
    g.add_node("emergency", emergency)
    g.add_node("router", router_node)
    g.add_node("out_of_scope", out_of_scope)
    g.add_node("rewrite", rewrite_node)
    g.add_node("retrieve", retrieve_node)
    g.add_node("grade", grade_node)
    g.add_node("tools", tools_node)
    g.add_node("generate", generate_node)
    g.add_node("no_evidence", no_evidence)
    g.add_node("escalate", escalate)

    g.add_edge(START, "guard")
    g.add_conditional_edges("guard", after_guard, ["emergency", "router"])
    g.add_conditional_edges("router", after_router, ["out_of_scope", "rewrite"])
    g.add_conditional_edges("rewrite", after_rewrite, ["tools", "retrieve"])
    g.add_edge("retrieve", "grade")
    g.add_conditional_edges("grade", after_grade, ["generate", "rewrite", "no_evidence"])
    g.add_conditional_edges("tools", after_tools, ["generate", END])
    g.add_conditional_edges("generate", after_answer, ["escalate", END])
    g.add_conditional_edges("no_evidence", after_answer, ["escalate", END])
    g.add_edge("escalate", END)
    g.add_edge("emergency", END)
    g.add_edge("out_of_scope", END)
    return g.compile(name="medassist-agent")


# ---------- runners ----------


def enable_tracing(settings: Settings) -> bool:
    """Switch LangSmith tracing on when LANGSMITH_API_KEY is set (LangChain reads os.environ).
    Values already in the environment win. True when tracing is on."""
    if settings.langsmith_api_key is None:
        return False
    os.environ.setdefault("LANGSMITH_TRACING", "true")
    os.environ.setdefault("LANGSMITH_API_KEY", settings.langsmith_api_key.get_secret_value())
    os.environ.setdefault("LANGSMITH_PROJECT", settings.langsmith_project)
    return True


def initial_state(
    question: str,
    history: Sequence[Turn] = (),
    *,
    user_id: str | None = None,
    pharmacy_id: str | None = None,
) -> AgentState:
    """The input of one run."""
    return {
        "question": question,
        "history": list(history),
        "user_id": user_id or "",
        "pharmacy_id": pharmacy_id,
        "rewrite_count": 0,
        "tokens": 0,
        "timings": {},
    }


async def stream_agent(
    question: str,
    deps: RagDeps,
    history: Sequence[Turn] = (),
    *,
    user_id: str | None = None,
    pharmacy_id: str | None = None,
) -> AsyncIterator[str | RagAnswer]:
    """Answer text pieces (str) as they may be shown, then one RagAnswer with the full result."""
    state = initial_state(question, history, user_id=user_id, pharmacy_id=pharmacy_id)
    streamed, final = "", {}
    async for mode, data in agent_graph().astream(
        state,
        context=AgentContext(deps),
        stream_mode=["custom", "values"],
        config={"run_name": "medassist-agent", "metadata": {"user_id": user_id or ""}},
    ):
        if mode == "custom":
            streamed += data["token"]
            yield data["token"]
        else:
            final = data  # the whole state after each step; the last one is the result

    answer = final.get("answer", "")
    if answer.startswith(streamed):
        for piece in _PIECES.findall(answer[len(streamed) :]):
            yield piece
    else:  # cannot happen with the hold-back rule; the stored answer is still the full one
        logger.warning("agent answer does not continue the streamed text")
    logger.info(
        "agent route=%s safety=%s tokens=%s timings=%s",
        final.get("route"),
        final.get("safety"),
        final.get("tokens"),
        final.get("timings"),
    )
    escalated = final.get("route") == "escalated"
    yield RagAnswer(
        text=answer,
        route=final.get("route", "no_evidence"),
        citations=final.get("citations") or [],
        tokens=final.get("tokens") or None,  # 0 = no LLM call
        products=final.get("product_results") or [],
        escalation_reason=final.get("escalation_reason") if escalated else None,
        pharmacy_id=final.get("escalation_pharmacy_id"),
    )


async def run_agent(
    question: str,
    deps: RagDeps,
    history: Sequence[Turn] = (),
    *,
    user_id: str | None = None,
    pharmacy_id: str | None = None,
) -> RagAnswer:
    """The same run as stream_agent, only the finished answer."""
    async for item in stream_agent(
        question, deps, history, user_id=user_id, pharmacy_id=pharmacy_id
    ):
        if isinstance(item, RagAnswer):
            return item
    raise RuntimeError("stream_agent ended without an answer")
