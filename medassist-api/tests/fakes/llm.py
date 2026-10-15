"""Fake fast LLM for graph nodes: ainvoke() returns a fixed reply (or replies in turn)."""

from app.llm.providers import Usage


class FakeFastLLM:
    def __init__(self, *replies: str, error: Exception | None = None) -> None:
        self.replies, self.error = list(replies), error
        self.calls: list[list] = []  # messages of every call
        self.last_usage: Usage | None = None

    async def ainvoke(self, messages) -> str:
        self.calls.append(list(messages))
        if self.error is not None:
            raise self.error
        self.last_usage = Usage("groq", "fake-fast", 100, 20)
        return self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]

    def prompt(self, call: int = -1) -> str:
        """Text of the human message of a call."""
        return self.calls[call][-1].content
