"""Escalate node: a risky question (personal dosing, prescription-only, pregnancy or child) gets
the GENERAL label info the normal path found, plus a note that a pharmacist will answer.

Runs after generate / no_evidence when the guard marked the question risky. It does not write the
escalation row itself: that row points at the stored assistant message (escalations.message_id),
which only exists after services/chat.py has saved the answer. So the node leaves what the row
needs in the state (escalation_reason, escalation_pharmacy_id) and the chat service inserts it.

Answer = the cited general info (when there is any), a blank line, the escalation note. The note
comes LAST so the generate node's live-streamed text stays the start of the final answer. Without
citations (no evidence) the answer is the note alone: "ask a pharmacist" is already being done.
The product text of a "both" / "product" question is kept.
"""

from app.graph.nodes.router import keyword_language
from app.graph.state import AgentLanguage, AgentState

ESCALATION_TEXT: dict[AgentLanguage, str] = {
    "en": "This question needs a pharmacist, so I have sent it to one. Their reply will appear in "
    "this chat.",
    "roman_urdu": "Is sawal ke liye pharmacist ki zaroorat hai, is liye maine usay bhej diya hai. "
    "Un ka jawab isi chat mein aa jayega.",
    "urdu": "اس سوال کے لیے فارماسسٹ کی ضرورت ہے، اس لیے میں نے اسے بھیج دیا ہے۔ ان کا جواب اسی "
    "چیٹ میں آ جائے گا۔",
}


def escalation_pharmacy(state: AgentState) -> str | None:
    """The pharmacy that should see the escalation: the customer's (request), else the pharmacy of
    the first product card found for this question, else None (every vendor sees it)."""
    if state.get("pharmacy_id"):
        return state["pharmacy_id"]
    for card in state.get("product_results") or []:
        if card.pharmacy_id:
            return card.pharmacy_id
    return None


def escalate(state: AgentState) -> dict:
    """Partial update: answer (general info + escalation note), route "escalated",
    escalation_pharmacy_id. Keeps escalation_reason (set by the guard) and the citations."""
    language = state.get("language") or keyword_language(state["question"])
    note = ESCALATION_TEXT[language]
    answer = state.get("answer") or ""
    if state.get("route") == "no_evidence":
        # drop the no-evidence words (the note says it better); a product text after them stays
        _, _, answer = answer.partition("\n\n")
    return {
        "answer": f"{answer}\n\n{note}" if answer else note,
        "route": "escalated",
        "escalation_pharmacy_id": escalation_pharmacy(state),
    }
