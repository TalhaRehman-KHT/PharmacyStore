"""Route stubs: mounted, validate input, and return 501 in the shared error shape."""

from uuid import uuid4

import pytest

from tests.conftest import bearer, make_token

SID = uuid4()

STUBS = [
    ("post", "/ask?variant=naive", {"question": "What is paracetamol?"}),
    ("post", "/ask/stream", {"question": "What is paracetamol?"}),
    ("get", "/sessions", None),
    ("get", f"/sessions/{SID}/messages", None),
    ("delete", "/sessions", None),
    ("post", f"/messages/{SID}/feedback", {"rating": 1}),
    ("get", "/escalations?status=answered", None),
    ("post", f"/escalations/{SID}/reply", {"reply": "Take it after food, twice a day."}),
]


@pytest.mark.parametrize(("method", "path", "body"), STUBS)
def test_stub_returns_501(client, set_role, method, path, body):
    set_role("vendor")
    res = client.request(method, path, json=body, headers=bearer(make_token()))

    assert res.status_code == 501
    assert res.json() == {"status": 501, "message": "Not implemented yet"}


def test_invalid_body_returns_422(client):
    res = client.post("/ask", json={"question": "   "}, headers=bearer(make_token()))

    assert res.status_code == 422
    assert res.json()["status"] == 422


def test_invalid_query_returns_422(client, set_role):
    set_role("admin")
    auth = bearer(make_token())
    res = client.post("/ask?variant=magic", json={"question": "hi"}, headers=auth)
    assert res.status_code == 422
    assert client.get("/escalations?status=closed", headers=auth).status_code == 422
