"""Naive RAG baseline against the REAL database, Gemini (query embedding) and Groq (answer).

Read-only: writes no rows. Run: RUN_INTEGRATION=1 pytest -m integration -q
Uses amoxicillin, one of the drugs already loaded (R16 PARTIAL).
"""

import httpx
import pytest

from app.baseline import naive
from app.rag.deps import create_rag_deps

pytestmark = pytest.mark.integration


async def test_question_about_a_loaded_drug_is_cited(live_db, real_settings):
    async with httpx.AsyncClient(timeout=60) as http:
        deps = create_rag_deps(live_db, real_settings, http)
        items = [
            i async for i in naive.answer_stream("What are the side effects of amoxicillin?", deps)
        ]

    result = items[-1]
    assert isinstance(result, naive.RagAnswer)
    assert result.route == "knowledge", result.text[:200]
    assert len(result.citations) >= 1
    assert any(c.drug == "amoxicillin" for c in result.citations)
    assert "".join(items[:-1]) == result.text
