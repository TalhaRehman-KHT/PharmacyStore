"""Out-of-scope node: a polite fixed refusal for messages that are not about medicines.

The router sent the message here (weather, jokes, homework ...). No search and no answer LLM:
nothing to cite, and a fixed text costs no tokens.
"""

from app.graph.nodes.router import keyword_language
from app.graph.state import AgentLanguage, AgentState

OUT_OF_SCOPE_TEXT: dict[AgentLanguage, str] = {
    "en": "I can only help with medicines: what they are used for, side effects, interactions, "
    "and what our shop has in stock. Please ask me a medicine question.",
    "roman_urdu": "Main sirf dawaon ke baare mein madad kar sakta hoon: un ka istemal, side "
    "effects, interactions aur hamari shop ka stock. Meharbani kar ke dawa se mutaliq sawal "
    "poochein.",
    "urdu": "میں صرف دوائیوں کے بارے میں مدد کر سکتا ہوں: ان کا استعمال، سائیڈ ایفیکٹس، "
    "انٹریکشنز اور ہماری شاپ کا اسٹاک۔ براہ کرم دوا سے متعلق سوال پوچھیں۔",
}


def out_of_scope(state: AgentState) -> dict:
    """Partial update: answer (fixed refusal in the user's language), citations []."""
    language = state.get("language") or keyword_language(state["question"])
    return {"answer": OUT_OF_SCOPE_TEXT[language], "citations": []}
