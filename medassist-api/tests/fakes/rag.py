"""Fake RAG dependencies (no network): embedder, reranker, answer LLM, hybrid_search rows."""

from app.llm.providers import Usage
from app.rag.deps import RagDeps
from tests.fakes.llm import FakeFastLLM

REPLY = ("Paracetamol can cause ", "skin reactions [1]. ", "Stop it and see a doctor.")
# One JSON that every fast step of the agent accepts: router -> knowledge / en, rewrite -> empty
# query (= the question itself is searched), grade -> wrong count (= every chunk is kept).
FAST_REPLY = '{"route": "knowledge", "language": "en", "query": "", "grades": []}'


def chunk_row(i: int, drug: str = "acetaminophen", section: str = "Warnings", text: str = ""):
    """One hybrid_search RPC row (dict)."""
    return {
        "chunk_id": f"chunk-{i}",
        "content": text or f"Drug: {drug} | Section: {section}\nLabel text {i}.",
        "drug_name": drug,
        "section": section,
        "vector_rank": i,
        "keyword_rank": None,
        "rrf_score": 1 / (60 + i),
    }


class FakeEmbedder:
    model = "fake-embed"

    def __init__(self) -> None:
        self.calls: list[str] = []

    async def embed_query(self, text: str) -> list[float]:
        self.calls.append(text)
        return [0.1, 0.2, 0.3]


class FakeReranker:
    async def rerank(self, query, hits, top_n=None):
        return hits[: top_n or 5]


class FakeLLM:
    """Streams `pieces`; raises `error` after `fail_after` pieces; usage like Groq's."""

    def __init__(self, pieces, error: Exception | None = None, fail_after: int = 0) -> None:
        self.pieces, self.error, self.fail_after = list(pieces), error, fail_after
        self.messages = None
        self.last_usage: Usage | None = None

    async def astream(self, messages):
        self.messages = messages
        for i, piece in enumerate(self.pieces):
            if self.error is not None and i == self.fail_after:
                raise self.error
            yield piece
        if self.error is not None and self.fail_after >= len(self.pieces):
            raise self.error
        self.last_usage = Usage("groq", "fake-model", 100, 20)


class FakeRag:
    """Set `rows` (search results), `reply` (LLM pieces) or `error`, then use `deps()`.
    `fast_replies` are the agent's fast-LLM replies, in call order (the last one repeats).

    Registers the hybrid_search RPC on the FakeSupabase `db`; `llms` lists every answer LLM
    created, `fast_llms` every fast one.
    """

    def __init__(self, db) -> None:
        self.db = db
        self.rows: list[dict] = [chunk_row(1)]
        self.reply = REPLY
        self.error: Exception | None = None
        self.fail_after = 0
        self.embedder = FakeEmbedder()
        self.llms: list[FakeLLM] = []
        self.fast_replies: list[str] = [FAST_REPLY]
        self.fast_llms: list[FakeFastLLM] = []
        self.searches: list[dict] = []
        self.mode = "vector"  # RagDeps.retrieval_mode (the app default)
        db.rpc_handlers["hybrid_search"] = self._search

    def _search(self, params: dict) -> list[dict]:
        self.searches.append(params)
        return self.rows[: params["match_count"]]

    def _new_llm(self) -> FakeLLM:
        llm = FakeLLM(self.reply, self.error, self.fail_after)
        self.llms.append(llm)
        return llm

    def _new_fast_llm(self) -> FakeFastLLM:
        reply = self.fast_replies.pop(0) if len(self.fast_replies) > 1 else self.fast_replies[0]
        llm = FakeFastLLM(reply)
        self.fast_llms.append(llm)
        return llm

    def deps(self) -> RagDeps:
        return RagDeps(
            self.db,
            self.embedder,
            FakeReranker(),
            self._new_llm,
            self.mode,
            fast_llm=self._new_fast_llm,
        )
