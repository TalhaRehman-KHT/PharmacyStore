"""Auth in supabase mode: tokens signed with the test secret, roles read from public.users (fake).

The default mode (app_user_id) is tested in test_auth_user_id.py.
"""

from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app import config
from app.security import auth
from tests.conftest import bearer, make_token

INVALID = {"status": 401, "message": "Invalid or expired token"}
FORBIDDEN = {"status": 403, "message": "Pharmacist access required"}
SESSIONS = "/sessions"
ESCALATIONS = "/escalations"
REPLY = {"reply": "x" * 20}


@pytest.fixture(autouse=True)
def _supabase(supabase_mode):
    """Every test in this file runs in supabase (JWT) mode."""


def test_no_header_returns_401(client):
    res = client.get(SESSIONS)

    assert res.status_code == 401
    assert res.json() == {"status": 401, "message": "Missing bearer token"}
    assert res.headers["www-authenticate"] == "Bearer"


def test_non_bearer_scheme_returns_401(client):
    res = client.get(SESSIONS, headers={"Authorization": "Basic abc"})

    assert res.status_code == 401


@pytest.mark.parametrize(
    "token",
    [
        make_token(exp_in=-10),
        make_token(aud="anon"),
        make_token(secret="some-other-secret-that-is-32-bytes-long"),
        "not-a-jwt",
        make_token(sub="not-a-uuid"),
    ],
    ids=["expired", "wrong-audience", "wrong-secret", "garbage", "bad-sub"],
)
def test_bad_token_returns_401(client, token):
    res = client.get(SESSIONS, headers=bearer(token))

    assert res.status_code == 401
    assert res.json() == INVALID


def test_valid_token_returns_200(client):
    res = client.get(SESSIONS, headers=bearer(make_token()))

    assert res.status_code == 200
    assert res.json() == []


def test_token_sub_selects_the_callers_data(client, db):
    """The verified `sub` is the user id every query is filtered by."""
    sub, other = uuid4(), uuid4()
    mine = db.seed("chat_sessions", user_id=str(sub), title="mine")
    db.seed("chat_sessions", user_id=str(other), title="not mine")

    res = client.get(SESSIONS, headers=bearer(make_token(sub, email="a@b.test")))

    assert [s["id"] for s in res.json()] == [mine["id"]]


def test_health_needs_no_token(client):
    assert client.get("/health").status_code == 200


# ---------- roles (read from public.users, never from the token) ----------


@pytest.mark.parametrize("role", ["user"])
def test_customer_roles_on_escalations_return_403(client, make_user, role):
    _, headers = make_user(role)

    assert client.get(ESCALATIONS, headers=headers).status_code == 403
    res = client.post(f"{ESCALATIONS}/{uuid4()}/reply", json=REPLY, headers=headers)
    assert res.status_code == 403
    assert res.json() == FORBIDDEN


def test_unknown_user_on_escalations_returns_403(client):
    headers = bearer(make_token())  # valid token, no public.users row

    assert client.get(ESCALATIONS, headers=headers).status_code == 403
    res = client.post(f"{ESCALATIONS}/{uuid4()}/reply", json=REPLY, headers=headers)
    assert res.json() == FORBIDDEN


@pytest.mark.parametrize("role", ["vendor", "admin"])
def test_inactive_staff_on_escalations_returns_403(client, make_user, role):
    _, headers = make_user(role, is_active=False)

    assert client.get(ESCALATIONS, headers=headers).status_code == 403
    res = client.post(f"{ESCALATIONS}/{uuid4()}/reply", json=REPLY, headers=headers)
    assert res.json() == FORBIDDEN


@pytest.mark.parametrize("role", ["vendor", "admin", "doctor"])
def test_active_staff_on_escalations_returns_200(client, make_user, role):
    _, headers = make_user(role)

    assert client.get(ESCALATIONS, headers=headers).status_code == 200


def test_token_role_claim_is_ignored(client):
    """A forged role claim does not grant staff access; only public.users.role counts."""
    headers = bearer(make_token(role="admin", app_role="vendor"))

    assert client.get(ESCALATIONS, headers=headers).status_code == 403


def test_role_lookup_can_be_mocked(client, set_role):
    set_role("admin")

    assert client.get(ESCALATIONS, headers=bearer(make_token())).status_code == 200


def test_escalations_without_token_returns_401_not_403(client, set_role):
    set_role("admin")

    assert client.get(ESCALATIONS).status_code == 401


# Customer routes authenticate by token alone today: an unknown or inactive public.users row
# still reaches them. Checking the row on every request belongs to Step 3.2 (auth redesign).
def test_inactive_customer_still_reaches_customer_routes_until_3_2(client, make_user):
    _, headers = make_user("user", is_active=False)

    assert client.get(SESSIONS, headers=headers).status_code == 200


# ---------- JWKS (no shared secret) ----------


def test_jwks_used_when_no_secret(client, monkeypatch):
    """Without SUPABASE_JWT_SECRET the key comes from the project's JWKS endpoint."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode(
        {"sub": str(uuid4()), "aud": "authenticated", "exp": 9_999_999_999},
        private_key,
        algorithm="RS256",
    )

    class FakeJwks:
        def get_signing_key_from_jwt(self, _token):
            return jwt.PyJWK.from_dict(
                {**jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True),
                 "alg": "RS256"}
            )

    requested = []
    monkeypatch.delenv("SUPABASE_JWT_SECRET")
    monkeypatch.setattr(auth, "_jwks_client", lambda url: requested.append(url) or FakeJwks())
    config.get_settings.cache_clear()
    try:
        res = client.get(SESSIONS, headers=bearer(token))
    finally:
        config.get_settings.cache_clear()

    assert res.status_code == 200
    assert requested == ["http://supabase.test"]
