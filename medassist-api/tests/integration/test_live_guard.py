"""The guard (rules + the REAL fast LLM) on tests/data/guard_cases.csv: precision and recall per
category, printed. Writes nothing. Run: RUN_INTEGRATION=1 pytest -m integration -s -k live_guard
About 20 fast-LLM calls (only the cases no rule catches go to the LLM).
"""

import pytest

from app.llm.providers import get_llm
from tests.unit.graph.test_guard_cases import load_cases, predict_all, report

pytestmark = pytest.mark.integration


async def test_guard_with_the_real_llm(real_settings):
    cases = load_cases()
    predicted = await predict_all(cases, lambda: get_llm("fast", real_settings))
    table = report("guard, rules + fast LLM (layers 1 + 2)", cases, predicted)
    assert table["emergency"][1] == 1.0  # never miss an emergency
    assert table["safe"][0] >= 0.8  # general questions mostly answered, not escalated
