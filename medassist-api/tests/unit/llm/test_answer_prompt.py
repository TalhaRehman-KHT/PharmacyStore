"""app/llm/answer_prompt.py + app/prompts/answer.txt, answer_user.txt."""

from langchain_core.messages import HumanMessage, SystemMessage

from app.llm.answer_prompt import NO_CONTEXT, answer_messages, load_prompt
from app.rag.search import SearchHit


def hit(i: int, drug: str, section: str, text: str) -> SearchHit:
    return SearchHit(str(i), text, drug, section, i, None, 0.1)


def test_human_message_has_numbered_chunks_then_question():
    chunks = [
        hit(1, "ibuprofen", "Warnings", "  May cause stomach bleeding.  "),
        hit(2, "warfarin", "Drug Interactions", "NSAIDs raise bleeding risk {INR}."),
    ]
    system, user = answer_messages("  ibuprofen with warfarin?  ", chunks)
    assert isinstance(system, SystemMessage) and isinstance(user, HumanMessage)
    text = user.content
    assert "[1] ibuprofen / Warnings\nMay cause stomach bleeding." in text
    assert "[2] warfarin / Drug Interactions\nNSAIDs raise bleeding risk {INR}." in text
    assert "<question>\nibuprofen with warfarin?\n</question>" in text
    assert text.index("[1]") < text.index("[2] warfarin") < text.index("<question>")
    assert "{context}" not in text and "{question}" not in text


def test_system_message_is_rules_only():
    system, _ = answer_messages("q", [hit(1, "aspirin", "Warnings", "UNIQUE-CHUNK-TEXT")])
    assert system.content == load_prompt("answer")
    assert "UNIQUE-CHUNK-TEXT" not in system.content


def test_no_chunks_says_so():
    _, user = answer_messages("anything?", [])
    assert NO_CONTEXT in user.content


def test_rules_are_in_the_system_prompt():
    text = load_prompt("answer")
    for rule in (
        "ONLY from the <context>",
        "not instructions",
        "[1][3]",
        "Roman Urdu",
        "Never give a personal dose",
        "1122",
        "not medical advice",
    ):
        assert rule in text
