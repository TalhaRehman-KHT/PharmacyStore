"""Guard node: the safety check that runs FIRST, before the router and any search.

safety   emergency | personal_dosing | prescription_only | pregnancy_or_child | safe

Two layers:
1. Rules (app/safety/keywords.yaml): word-boundary regexes, English + Roman Urdu. A hit decides at
   once, with no LLM call: fast, free, and the same answer every time.
2. Fast-LLM classifier (prompts/guard.txt) for everything the rules did not catch, with structured
   output ({"category": ...} checked by a Pydantic model). If the reply cannot be parsed the
   question counts as "safe": the rules found nothing, and the answer prompt itself never gives a
   personal dose.

What happens next (graph/build.py): emergency -> the emergency node (fixed text, no LLM);
personal_dosing / prescription_only / pregnancy_or_child -> the normal path for general cited label
info, then the escalate node (graph/nodes/escalate.py); safe -> the normal path.
"""

import re
import time
from collections.abc import Callable, Sequence
from functools import cache
from pathlib import Path
from typing import Literal, get_args

import yaml
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.graph.nodes.router import keyword_language
from app.graph.state import AgentLanguage, AgentState
from app.graph.structured import ask_json, format_history
from app.llm.answer_prompt import Turn, load_prompt
from app.schemas.common import EscalationReason

Safety = Literal["emergency", "personal_dosing", "prescription_only", "pregnancy_or_child", "safe"]
RISKY: tuple[EscalationReason, ...] = ("personal_dosing", "prescription_only", "pregnancy_or_child")
KEYWORDS_FILE = Path(__file__).resolve().parents[2] / "safety" / "keywords.yaml"

# A rule = the regexes that must ALL match (a plain string in the YAML is a rule of one).
Rule = tuple[re.Pattern, ...]

EMERGENCY_TEXT: dict[AgentLanguage, str] = {
    "en": "This may be a medical emergency. Call 1122 (Rescue) or go to the nearest emergency "
    "department now. Do not wait for an online reply.",
    "roman_urdu": "Ye medical emergency ho sakti hai. Abhi 1122 (Rescue) par call karein ya "
    "qareebi hospital ki emergency mein jayen. Online jawab ka intezar na karein.",
    "urdu": "یہ میڈیکل ایمرجنسی ہو سکتی ہے۔ ابھی 1122 (ریسکیو) پر کال کریں یا قریبی ہسپتال کی "
    "ایمرجنسی میں جائیں۔ آن لائن جواب کا انتظار نہ کریں۔",
}


class GuardDecision(BaseModel):
    category: Safety


@cache
def load_rules() -> dict[Safety, list[Rule]]:
    """keywords.yaml compiled once: category -> rules, in the file's order."""
    data = yaml.safe_load(KEYWORDS_FILE.read_text("utf-8"))
    markers: dict[str, str] = data.pop("markers", {})

    def compile_one(pattern: str) -> re.Pattern:
        for name, value in markers.items():
            pattern = pattern.replace(f"${name}", value)
        return re.compile(rf"\b(?:{pattern})\b")

    rules: dict[Safety, list[Rule]] = {}
    for category, entries in data.items():
        if category not in get_args(Safety):
            raise ValueError(f"keywords.yaml: unknown category {category!r}")
        rules[category] = [
            tuple(compile_one(p) for p in (e if isinstance(e, list) else [e])) for e in entries
        ]
    return rules


def rule_category(question: str) -> Safety | None:
    """Layer 1: the first category with a matching rule, or None (the LLM decides)."""
    q = " ".join(question.lower().split())
    for category, rules in load_rules().items():
        if any(all(p.search(q) for p in rule) for rule in rules):
            return category
    return None


def guard_messages(question: str, history: Sequence[Turn]) -> list:
    """System rules (prompts/guard.txt) + the earlier chat + the new message."""
    earlier = format_history(history)
    earlier = f"Earlier chat:\n{earlier}\n\n" if earlier else ""
    return [
        SystemMessage(load_prompt("guard")),
        HumanMessage(f"{earlier}Message: {question}"),
    ]


async def classify(
    question: str, history: Sequence[Turn] = (), *, llm_factory: Callable | None = None
) -> tuple[Safety, int]:
    """(category, tokens). Rules first; a fast LLM is made (llm_factory) and asked only when no
    rule matched. Without a factory only the rules run."""
    category = rule_category(question)
    if category is not None or llm_factory is None:
        return category or "safe", 0
    messages = guard_messages(question, history)
    decision, tokens = await ask_json(llm_factory(), messages, GuardDecision)
    return (decision.category if decision else "safe"), tokens


async def guard(state: AgentState, *, llm_factory: Callable | None) -> dict:
    """Partial update: safety, escalation_reason (a RISKY category, else None), tokens,
    timings["guard"]. `llm_factory` makes the fast LLM, called only when no rule matched."""
    start = time.perf_counter()
    history = state.get("history") or []
    category, tokens = await classify(state["question"], history, llm_factory=llm_factory)
    ms = round((time.perf_counter() - start) * 1000)
    return {
        "safety": category,
        "escalation_reason": category if category in RISKY else None,
        "tokens": tokens,
        "timings": {"guard": ms},
    }


def emergency(state: AgentState) -> dict:
    """Emergency node. Partial update: answer (fixed emergency text in the question's language),
    citations [], route "emergency". No search and no LLM text."""
    language = state.get("language") or keyword_language(state["question"])
    return {"answer": EMERGENCY_TEXT[language], "citations": [], "route": "emergency"}
