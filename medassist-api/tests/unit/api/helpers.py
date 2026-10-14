"""Shared helpers for the route tests (FakeSupabase as the database, real app)."""

import json

REPLY = {"reply": "Please take it after food, twice a day."}


def ask(client, headers, question="What is paracetamol?", **body):
    return client.post("/ask", json={"question": question, **body}, headers=headers)


def parse_sse(text: str) -> list[tuple[str, object]]:
    """[(event, data)] from an SSE body; comment lines (pings) are ignored."""
    events = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        name, data = None, []
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[len("event:") :].strip()
            elif line.startswith("data:"):
                data.append(line[len("data:") :].strip())
        if name:
            events.append((name, json.loads("\n".join(data))))
    return events


def messages_of(db, session_id: str) -> list[dict]:
    return [m for m in db.rows("chat_messages") if m["session_id"] == session_id]


def assistant_message(db, client, headers) -> dict:
    """Ask once and return the stored assistant message row."""
    session_id = ask(client, headers).json()["meta"]["sessionId"]
    return next(m for m in messages_of(db, session_id) if m["role"] == "assistant")


def escalate(db, client, headers, pharmacy_id: str | None = None) -> dict:
    """Ask a dosing question (optionally at a pharmacy) and return the escalation row it created."""
    body = {"pharmacyId": pharmacy_id} if pharmacy_id else {}
    ask(client, headers, "Mujhe kitni dose leni chahiye?", **body)
    return db.rows("escalations")[-1]


def vendor_with_pharmacy(db, make_user, name: str = "Sara") -> tuple[str, dict, str]:
    """A vendor who owns one pharmacy: (vendor_id, headers, pharmacy_id)."""
    vendor_id, headers = make_user("vendor", name=name)
    pharmacy = db.seed("pharmacies", vendor_id=vendor_id, name=f"{name} Pharmacy")
    return vendor_id, headers, pharmacy["id"]
