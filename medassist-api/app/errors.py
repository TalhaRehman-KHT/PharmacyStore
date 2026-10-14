"""Domain errors raised by repositories and services; main.py maps them to HTTP responses.

Messages are generic on purpose: "not found" is also used for rows owned by another user, so a
caller can never tell whether someone else's id exists.
"""

# Sent with HTTP 429 when every LLM provider is busy (llm.providers.AllProvidersBusy).
BUSY_MESSAGE = "MedAssist is busy right now. Please try again in a moment."


class NotFound(Exception):
    """The row does not exist or does not belong to the caller (HTTP 404)."""

    def __init__(self, message: str = "Not found") -> None:
        super().__init__(message)
        self.message = message


class Conflict(Exception):
    """The row is in a state that forbids the action, e.g. already answered (HTTP 409)."""

    def __init__(self, message: str = "Conflict") -> None:
        super().__init__(message)
        self.message = message
