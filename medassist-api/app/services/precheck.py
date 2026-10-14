"""Keyword pre-check that runs BEFORE any retrieval: risky questions go straight to a pharmacist.

Temporary: the safety-guard stage (LLM classifier + emergency check) replaces these keyword rules.
Rules are regexes with word boundaries (so "overdose" never matches "dose"), checked on the
lowercased question; the first matching rule wins.
"""

import re

from app.schemas.common import EscalationReason
from app.services.language import Language

# Shown instead of an answer, in the language of the question.
ESCALATION_TEXT: dict[Language, str] = {
    "en": "This question needs a pharmacist, so I have sent it to one. Their reply will appear in "
    "this chat.",
    "roman_urdu": "Is sawal ke liye pharmacist ki zaroorat hai, is liye maine usay bhej diya hai. "
    "Un ka jawab isi chat mein aa jayega.",
}

# The question is about the asker or their own child: "I", "my", "mujhe", "bachay ko", ...
_PERSONAL = re.compile(
    r"\b(i|i'm|im|me|my|mujhe|mujhy|muje|mera|meri|mere|hum|hamein|humein)\b"
    r"|\b(bachay|bache|bachy|bachon|bachi|beta|betay|beti|baby)\s+ko\b"
)

# Words that ask for an amount or a schedule. "overdose" is NOT here: it is general information.
_AMOUNT = re.compile(
    r"\b(dose|doses|dosage|dosing)\b"
    r"|\bhow\s+(much|many|often)\b"
)

# Roman Urdu "kitni dose / kitni goliyan / kitni dafa / kitna lena": always an amount for the asker.
# "kitni der" (how long) is not in the list, so "kitni der mein asar karti hai?" stays general.
_KITNI = re.compile(
    r"\bkitn[ia]\b(\s+\w+){0,2}?\s+"
    r"(dose|doses|goli|goliyan|goliyaan|tablet|tablets|capsule|mg|ml|chamach|spoon|"
    r"leni|lena|lun|loon|deni|dena|dun|doon|dafa|daffa|bar|baar|martaba)\b"
    r"|\bdose\b.{0,20}\bkitn[ia]\b"
)

_PREGNANCY = re.compile(
    r"\bpregnan\w*|\bhamil\w*|\bhaamil\w*|\bbreast[\s-]?feed\w*|\b(doodh|dudh)\s+pila\w*"
)


def _is_personal_dosing(q: str) -> bool:
    """Personal amount questions ("how much should I take?"), not general ("usual adult dose?")."""
    if _KITNI.search(q):
        return True
    return bool(_AMOUNT.search(q) and _PERSONAL.search(q))


def escalation_reason(question: str) -> EscalationReason | None:
    """The reason to escalate (personal dosing, pregnancy), or None to answer with RAG."""
    q = question.lower()
    if _is_personal_dosing(q):
        return "personal_dosing"
    if _PREGNANCY.search(q):
        return "pregnancy_or_child"
    return None
