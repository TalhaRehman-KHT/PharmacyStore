"""Grade node: keep only the retrieved chunks that can help answer the question.

ONE fast-LLM call for all candidates (not one call per chunk: saves Groq tokens and time). The
model sees the question, the English search query and the chunks [1]..[n], and replies
{"grades": ["yes", "no", ...]}. Kept chunks stay in search order; the best TOP_K go on.

The prompt (prompts/grade.txt) is lenient on purpose ("when unsure, yes"): in Stage 6 the real
problem was RIGHT chunks being dropped (TEST_REPORT P1, P11), and the answer step still needs a
[n] citation for every claim. So an unparseable reply, or a wrong number of grades, keeps ALL
chunks instead of throwing evidence away.

after_grade() is the conditional edge: chunks left -> generate; none -> rewrite again (broader,
no drug filter) while rewrite_count < MAX_REWRITES; otherwise -> no_evidence.
"""

import time
from collections.abc import Awaitable, Callable
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.graph.state import AgentState, add_timing
from app.graph.structured import ask_json
from app.llm.answer_prompt import format_context, load_prompt
from app.rag.retrieve import TOP_K

MAX_REWRITES = 2  # rewrite runs at most twice: the first query + one broader retry
NextStep = Literal["generate", "rewrite", "no_evidence"]


class GradeReply(BaseModel):
    grades: list[Literal["yes", "no"]]


def grade_messages(state: AgentState, chunks: list) -> list:
    """System rules (prompts/grade.txt) + question + search query + numbered chunks."""
    parts = [f"Question: {state['question']}"]
    query = state.get("rewritten_query")
    if query and query != state["question"]:
        parts.append(f"English search query: {query}")
    parts.append(f"Excerpts:\n{format_context(chunks)}")
    return [SystemMessage(load_prompt("grade")), HumanMessage("\n\n".join(parts))]


async def grade(state: AgentState, *, llm) -> dict:
    """Partial update: graded_chunks (at most TOP_K), tokens, timings["grade"]."""
    start = time.perf_counter()
    chunks = list(state.get("candidates") or [])
    kept, tokens = [], 0
    if chunks:  # nothing found: no LLM call needed
        reply, tokens = await ask_json(llm, grade_messages(state, chunks), GradeReply)
        if reply is None or len(reply.grades) != len(chunks):
            kept = chunks  # cannot tell: keep everything (see module docstring)
        else:
            kept = [c for c, g in zip(chunks, reply.grades, strict=True) if g == "yes"]
    ms = round((time.perf_counter() - start) * 1000)
    return {
        "graded_chunks": kept[:TOP_K],
        "tokens": tokens,
        "timings": add_timing(state, "grade", ms),
    }


def after_grade(state: AgentState) -> NextStep:
    """Conditional edge after grade. The loop cannot run more than MAX_REWRITES times."""
    if state.get("graded_chunks"):
        return "generate"
    if state.get("rewrite_count", 0) < MAX_REWRITES:
        return "rewrite"
    return "no_evidence"


def make_grade(llm_factory: Callable) -> Callable[[AgentState], Awaitable[dict]]:
    """The LangGraph node: a new fast LLM per call."""

    async def grade_node(state: AgentState) -> dict:
        """Grade node (see module docstring)."""
        return await grade(state, llm=llm_factory())

    return grade_node
