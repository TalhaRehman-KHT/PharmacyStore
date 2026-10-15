"""Router node: decide what kind of question this is, before any search.

route    knowledge (medicine facts -> FDA labels) | product (stock / price -> shop tables) |
         both | out_of_scope (weather, jokes ... -> polite refusal, no search, no answer LLM)
language en | roman_urdu | urdu (the answer is written in it)

One call to the fast LLM (temperature 0) asking for {"route": ..., "language": ...}, checked
with a Pydantic model. If the reply cannot be parsed the router falls back to "knowledge"
(the safe default: the question still gets a cited answer or "no evidence") and the language
from the keyword detector (services/language.py; Urdu script is recognised by its letters).
"urdu" is decided by the letters only: the model sometimes says urdu for Roman Urdu.
The message goes inside <message> tags: it is data, not instructions (prompt injection).
"""

import re
import time
from collections.abc import Awaitable, Callable

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.graph.state import AgentLanguage, AgentRoute, AgentState
from app.graph.structured import ask_json, format_history
from app.llm.answer_prompt import load_prompt
from app.services.language import detect_language

FALLBACK_ROUTE: AgentRoute = "knowledge"
_URDU_SCRIPT = re.compile(r"[؀-ۿ]")
_TAGS = re.compile(r"</?\s*message\s*>", re.IGNORECASE)  # the question cannot close its own tag


class RouterDecision(BaseModel):
    route: AgentRoute
    language: AgentLanguage


def keyword_language(text: str) -> AgentLanguage:
    """Language without an LLM: Urdu letters -> urdu, else en / roman_urdu by keywords."""
    return "urdu" if _URDU_SCRIPT.search(text) else detect_language(text)


def router_messages(state: AgentState) -> list:
    """System rules (prompts/router.txt) + the earlier chat + the new message."""
    history = format_history(state.get("history") or [])
    earlier = f"Earlier chat:\n{history}\n\n" if history else ""
    return [
        SystemMessage(load_prompt("router")),
        HumanMessage(f"{earlier}<message>\n{_TAGS.sub('', state['question'])}\n</message>"),
    ]


async def route(state: AgentState, *, llm) -> dict:
    """Partial update: route, language, tokens, timings["router"]."""
    start = time.perf_counter()
    decision, tokens = await ask_json(llm, router_messages(state), RouterDecision)
    if decision is None:
        update = {"route": FALLBACK_ROUTE, "language": keyword_language(state["question"])}
    else:
        language = decision.language
        if _URDU_SCRIPT.search(state["question"]):
            language = "urdu"  # letters do not lie; the model sometimes says roman_urdu
        elif language == "urdu":
            language = detect_language(state["question"])  # no Urdu letters: en / roman_urdu
        update = {"route": decision.route, "language": language}
    ms = round((time.perf_counter() - start) * 1000)
    return {**update, "tokens": tokens, "timings": {"router": ms}}


def make_router(llm_factory: Callable) -> Callable[[AgentState], Awaitable[dict]]:
    """The LangGraph node: a new fast LLM per call (LLM.last_usage is per call)."""

    async def router_node(state: AgentState) -> dict:
        """Router node (see module docstring)."""
        return await route(state, llm=llm_factory())

    return router_node
