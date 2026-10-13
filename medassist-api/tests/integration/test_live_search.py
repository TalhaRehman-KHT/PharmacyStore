"""hybrid_search against the REAL database (read-only).

Run: RUN_INTEGRATION=1 pytest -m integration -q   (the known-question test makes 1 Gemini call)
"""

import httpx
import pytest
from postgrest.exceptions import APIError

from app.rag.embed import Embedder
from app.rag.search import hybrid_search

pytestmark = pytest.mark.integration


async def test_known_question_returns_chunks(live_db, real_settings):
    question = "ibuprofen side effects"
    async with httpx.AsyncClient(timeout=60) as client:
        embedder = Embedder(
            client,
            real_settings.gemini_api_key.get_secret_value(),
            real_settings.gemini_embed_model,
            real_settings.embed_dim,
            cache_dir=None,
        )
        vector = await embedder.embed_query(question)

    hits = await hybrid_search(live_db, vector, question)

    assert len(hits) >= 1
    assert all(h.vector_rank is not None or h.keyword_rank is not None for h in hits)
    assert [h.rrf_score for h in hits] == sorted((h.rrf_score for h in hits), reverse=True)


async def test_anon_cannot_execute_hybrid_search(anon_db, real_settings):
    try:
        res = await anon_db.rpc(
            "hybrid_search",
            {
                "query_embedding": [0.0] * real_settings.embed_dim,
                "query_text": "ibuprofen",
                "match_count": 1,
                "drug_filter": None,
            },
        ).execute()
    except APIError:
        return  # permission denied: expected
    pytest.fail(f"anon key could call hybrid_search (returned {len(res.data or [])} rows)")
