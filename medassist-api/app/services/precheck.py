"""Keyword pre-check that runs BEFORE any retrieval: risky questions go straight to a pharmacist.

Temporary: the safety-guard stage (LLM classifier + emergency check) replaces these keyword rules.
Matched case-insensitively as substrings; the first matching rule wins.
"""

from app.schemas.common import EscalationReason

ESCALATION_TEXT = (
    "This question needs a pharmacist, so I have sent it to one. Their reply will appear in this "
    "chat.\n\n(Is sawal ke liye pharmacist ki zaroorat hai, is liye maine usay bhej diya hai. "
    "Un ka jawab isi chat mein aa jayega.)"
)

_ESCALATION_RULES: list[tuple[tuple[str, ...], EscalationReason]] = [
    (("dose", "kitni"), "personal_dosing"),
    (("pregnant", "hamil"), "pregnancy_or_child"),
]


def escalation_reason(question: str) -> EscalationReason | None:
    """The reason to escalate (personal dosing, pregnancy), or None to answer with RAG."""
    q = question.lower()
    for words, reason in _ESCALATION_RULES:
        if any(w in q for w in words):
            return reason
    return None
