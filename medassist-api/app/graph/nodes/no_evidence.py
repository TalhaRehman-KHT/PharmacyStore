"""No-evidence node: the safe fixed answer when no relevant label chunk was found.

Reached after the grader kept nothing twice (first query + one broader retry). No LLM call:
a fixed text cannot invent anything. en / roman_urdu come from graph/answer.py, plus an
Urdu-script version for the router's third language. For a "both" question the shop part
still works, so the product text (graph/nodes/tools.py) follows the no-evidence text.
"""

from app.graph.answer import NO_EVIDENCE_TEXT
from app.graph.nodes.router import keyword_language
from app.graph.nodes.tools import product_text
from app.graph.state import AgentLanguage, AgentState

URDU_NO_EVIDENCE = (
    "یہ معلومات میرے پاس موجود دوائیوں کے لیبلز میں نہیں ہے، اس لیے میں اس کا محفوظ جواب نہیں "
    "دے سکتا۔ براہ کرم فارماسسٹ یا اپنے ڈاکٹر سے پوچھیں۔"
)


def no_evidence_text(language: AgentLanguage) -> str:
    """The standard no-evidence answer in `language`."""
    return URDU_NO_EVIDENCE if language == "urdu" else NO_EVIDENCE_TEXT[language]


def no_evidence(state: AgentState) -> dict:
    """Partial update: answer (fixed text, + product text for "both"), citations [],
    route "no_evidence", product_results [] unless "both" (no cards under an unanswered
    knowledge question)."""
    language = state.get("language") or keyword_language(state["question"])
    answer = no_evidence_text(language)
    if state.get("route") != "both":
        return {"answer": answer, "citations": [], "route": "no_evidence", "product_results": []}
    products = state.get("product_results") or []
    answer += "\n\n" + product_text(products, language, asked=bool(state.get("drug_names")))
    return {"answer": answer, "citations": [], "route": "no_evidence"}
