"""Temporary answerer used until the agent exists.

TODO(agent): replaced by the LangGraph agent (app/graph/build.py). Keyword rules only; no LLM,
no retrieval, no citations.
"""

from dataclasses import dataclass

from app.schemas.common import EscalationReason, Route

ANSWER = "MedAssist backend is connected. AI answers are not enabled yet."

# First matching rule wins. Matched case-insensitively as substrings.
_ESCALATION_RULES: list[tuple[tuple[str, ...], EscalationReason]] = [
    (("dose", "kitni"), "personal_dosing"),
    (("pregnant", "hamil"), "pregnancy_or_child"),
]


@dataclass(frozen=True)
class PlaceholderAnswer:
    text: str
    route: Route
    escalation_reason: EscalationReason | None = None


def answer(question: str) -> PlaceholderAnswer:
    """Fixed text; escalate personal dosing and pregnancy questions to a pharmacist."""
    q = question.lower()
    for words, reason in _ESCALATION_RULES:
        if any(w in q for w in words):
            return PlaceholderAnswer(ANSWER, "escalated", reason)
    return PlaceholderAnswer(ANSWER, "knowledge")
