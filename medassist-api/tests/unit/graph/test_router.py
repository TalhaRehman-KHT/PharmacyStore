"""graph/nodes/router.py with a fake fast LLM."""

import pytest

from app.graph.nodes.router import RouterDecision, keyword_language, make_router, route
from app.graph.structured import ParseError, parse_json
from app.llm.providers import AllProvidersBusy
from tests.fakes.llm import FakeFastLLM


def reply(route_: str, language: str) -> str:
    return f'{{"route": "{route_}", "language": "{language}"}}'


@pytest.mark.parametrize(
    ("question", "llm_reply", "expected"),
    [
        ("Panadol ke side effects", reply("knowledge", "roman_urdu"), ("knowledge", "roman_urdu")),
        (
            "Brufen aur Panadol ek saath le sakte hain?",
            reply("knowledge", "roman_urdu"),
            ("knowledge", "roman_urdu"),
        ),
        ("Is Augmentin in stock?", reply("product", "en"), ("product", "en")),
        ("weather today", reply("out_of_scope", "en"), ("out_of_scope", "en")),
        ("Is metformin for diabetes and what is the price?", reply("both", "en"), ("both", "en")),
    ],
)
async def test_route_and_language_from_the_llm(question, llm_reply, expected):
    llm = FakeFastLLM(llm_reply)
    update = await route({"question": question}, llm=llm)
    assert (update["route"], update["language"]) == expected
    assert update["tokens"] == 120
    assert set(update["timings"]) == {"router"}
    assert question in llm.prompt()


@pytest.mark.parametrize(
    "bad_reply",
    [
        "Sure! This is a knowledge question.",  # no JSON
        '{"route": "shopping", "language": "en"}',  # unknown route
        '{"route": "product"}',  # language missing
        "",
    ],
)
async def test_unparseable_reply_falls_back_to_knowledge(bad_reply):
    update = await route({"question": "Panadol ke side effects"}, llm=FakeFastLLM(bad_reply))
    assert update["route"] == "knowledge"
    assert update["language"] == "roman_urdu"  # from the keyword detector


async def test_json_inside_fences_and_text_is_accepted():
    text = 'Here you go:\n```json\n{"route": "product", "language": "en"}\n```'
    update = await route({"question": "Is Augmentin in stock?"}, llm=FakeFastLLM(text))
    assert update["route"] == "product"


async def test_urdu_script_wins_over_the_model():
    update = await route(
        {"question": "پیناڈول کے سائیڈ ایفیکٹس"}, llm=FakeFastLLM(reply("knowledge", "roman_urdu"))
    )
    assert update["language"] == "urdu"


async def test_history_goes_into_the_prompt():
    llm = FakeFastLLM(reply("product", "en"))
    state = {
        "question": "and is it in stock?",
        "history": [("user", "What is Augmentin for?"), ("assistant", "It treats infections.")],
    }
    await route(state, llm=llm)
    assert "Earlier chat:" in llm.prompt() and "user: What is Augmentin for?" in llm.prompt()


async def test_busy_llm_is_not_swallowed():
    with pytest.raises(AllProvidersBusy):
        await route({"question": "x"}, llm=FakeFastLLM(error=AllProvidersBusy(5)))


async def test_make_router_uses_a_new_llm_per_call():
    made: list[FakeFastLLM] = []

    def factory():
        made.append(FakeFastLLM(reply("knowledge", "en")))
        return made[-1]

    node = make_router(factory)
    await node({"question": "a"})
    await node({"question": "b"})
    assert len(made) == 2 and all(len(m.calls) == 1 for m in made)


def test_keyword_language():
    assert keyword_language("What is ibuprofen?") == "en"
    assert keyword_language("kya ibuprofen safe hai?") == "roman_urdu"
    assert keyword_language("آئبوپروفین کیا ہے") == "urdu"


def test_parse_json_errors():
    with pytest.raises(ParseError):
        parse_json("no json", RouterDecision)
    with pytest.raises(ParseError):
        parse_json('{"route": 1}', RouterDecision)
