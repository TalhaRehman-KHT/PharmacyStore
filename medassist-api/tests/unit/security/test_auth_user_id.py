"""Auth in app_user_id mode (default): X-User-Id header; user and role come from public.users."""

from uuid import uuid4

import pytest

from tests.conftest import bearer, make_token

SESSIONS = "/sessions"
ESCALATIONS = "/escalations"
INVALID = {"status": 401, "message": "Invalid user"}


def test_no_header_returns_401(client):
    res = client.get(SESSIONS)

    assert res.status_code == 401
    assert res.json() == {"status": 401, "message": "Missing X-User-Id header"}


@pytest.mark.parametrize("value", ["not-a-uuid", "123", " "])
def test_bad_uuid_returns_401(client, value):
    res = client.get(SESSIONS, headers={"X-User-Id": value})

    assert res.status_code == 401


def test_unknown_user_returns_401(client):
    res = client.get(SESSIONS, headers={"X-User-Id": str(uuid4())})

    assert res.status_code == 401
    assert res.json() == INVALID


def test_inactive_customer_on_sessions_returns_401(client, make_user):
    user_id, _ = make_user("user", is_active=False)

    res = client.get(SESSIONS, headers={"X-User-Id": user_id})

    assert res.status_code == 401
    assert res.json() == INVALID


def test_valid_customer_returns_200(client, make_user):
    user_id, _ = make_user("user")

    res = client.get(SESSIONS, headers={"X-User-Id": user_id})

    assert res.status_code == 200
    assert res.json() == []


def test_header_selects_the_callers_data(client, db, make_user):
    alice, _ = make_user(name="Alice")
    bob, _ = make_user(name="Bob")
    mine = db.seed("chat_sessions", user_id=alice, title="mine")
    db.seed("chat_sessions", user_id=bob, title="not mine")

    res = client.get(SESSIONS, headers={"X-User-Id": alice})

    assert [s["id"] for s in res.json()] == [mine["id"]]


def test_customer_on_escalations_returns_403(client, make_user):
    user_id, _ = make_user("user")

    res = client.get(ESCALATIONS, headers={"X-User-Id": user_id})

    assert res.status_code == 403
    assert res.json() == {"status": 403, "message": "Pharmacist access required"}


@pytest.mark.parametrize("role", ["vendor", "admin", "doctor"])
def test_staff_on_escalations_returns_200(client, make_user, role):
    user_id, _ = make_user(role)

    assert client.get(ESCALATIONS, headers={"X-User-Id": user_id}).status_code == 200


def test_role_claim_anywhere_in_the_request_is_ignored(client, make_user):
    """Only public.users.role counts: a role in a token, header or query string grants nothing."""
    user_id, _ = make_user("user")
    headers = {
        "X-User-Id": user_id,
        "X-User-Role": "admin",
        "X-Role": "vendor",
        **bearer(make_token(user_id, role="admin", app_role="vendor")),
    }

    res = client.get(f"{ESCALATIONS}?role=admin", headers=headers)

    assert res.status_code == 403


def test_bearer_token_alone_is_not_enough(client, make_user):
    """In this mode a JWT without X-User-Id does not identify anyone."""
    user_id, _ = make_user("admin")

    res = client.get(SESSIONS, headers=bearer(make_token(user_id)))

    assert res.status_code == 401


def test_cors_allows_the_user_id_header(client):
    res = client.options(
        SESSIONS,
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-User-Id, Content-Type",
        },
    )

    assert res.status_code == 200
    allowed = res.headers["access-control-allow-headers"].lower()
    assert "x-user-id" in allowed
    assert "content-type" in allowed


def test_cors_rejects_unknown_origin(client):
    res = client.options(
        SESSIONS,
        headers={"Origin": "http://evil.test", "Access-Control-Request-Method": "GET"},
    )

    assert "access-control-allow-origin" not in res.headers


def test_swagger_shows_user_id_header(client):
    schemes = client.get("/openapi.json").json()["components"]["securitySchemes"]

    assert {"type": "apiKey", "in": "header", "name": "X-User-Id"}.items() <= next(
        s for s in schemes.values() if s.get("name") == "X-User-Id"
    ).items()
