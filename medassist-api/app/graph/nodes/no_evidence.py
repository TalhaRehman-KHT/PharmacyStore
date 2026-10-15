"""No-evidence node: the safe fixed answer when no relevant label chunk was found.

Reached after the grader kept nothing twice (first query + one broader retry). No LLM call:
a fixed text cannot invent anything. Same words as the naive baseline (en / roman_urdu), plus
an Urdu-script version for the agent's third language.
"""

from app.baseline.naive import NO_EVIDENCE_TEXT
from app.graph.nodes.router import keyword_language
from app.graph.state import AgentLanguage, AgentState

URDU_NO_EVIDENCE = (
    "یہ معلومات میرے پاس موجود دوائیوں کے لیبلز میں نہیں ہے، اس لیے میں اس کا محفوظ جواب نہیں "
    "دے سکتا۔ براہ کرم فارماسسٹ یا اپنے ڈاکٹر سے پوچھیں۔"
)


def no_evidence_text(language: AgentLanguage) -> str:
    """The standard no-evidence answer in `language`."""
    return URDU_NO_EVIDENCE if language == "urdu" else NO_EVIDENCE_TEXT[language]


def no_evidence(state: AgentState) -> dict:
    """Partial update: answer (fixed text), citations [], route "no_evidence"."""
    language = state.get("language") or keyword_language(state["question"])
    return {"answer": no_evidence_text(language), "citations": [], "route": "no_evidence"}
