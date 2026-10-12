"""Auth dependency tests: tokens are signed with the test secret; role lookup is mocked."""

from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app import config
from app.security import auth
from tests.conftest import bearer, make_token

INVALID = {"status": 401, "message": "Invalid or expired token"}
SESSIONS = "/sessions"
ESCALATIONS = "/escalations"


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


def test_valid_token_reaches_stub(client):
    res = client.get(SESSIONS, headers=bearer(make_token()))

    assert res.status_code == 501


def test_health_needs_no_token(client):
    assert client.get("/health").status_code == 200


@pytest.mark.parametrize("role", ["user", "doctor", None])
def test_customer_on_escalations_returns_403(client, set_role, role):
    set_role(role)
    token = make_token()

    assert client.get(ESCALATIONS, headers=bearer(token)).status_code == 403
    res = client.post(
        f"{ESCALATIONS}/{uuid4()}/reply", json={"reply": "x" * 20}, headers=bearer(token)
    )
    assert res.status_code == 403
    assert res.json() == {"status": 403, "message": "Pharmacist access required"}


@pytest.mark.parametrize("role", ["vendor", "admin"])
def test_pharmacist_on_escalations_reaches_stub(client, set_role, role):
    set_role(role)

    assert client.get(ESCALATIONS, headers=bearer(make_token())).status_code == 501


def test_escalations_without_token_returns_401_not_403(client, set_role):
    set_role("admin")

    assert client.get(ESCALATIONS).status_code == 401


async def test_current_user_from_claims():
    sub = uuid4()
    creds = auth.HTTPAuthorizationCredentials(
        scheme="Bearer", credentials=make_token(sub, email="a@b.test")
    )

    user = await auth.get_current_user(creds)

    assert user.id == sub
    assert user.email == "a@b.test"
    assert user.role == "authenticated"


async def test_jwks_used_when_no_secret(monkeypatch):
    """Without SUPABASE_JWT_SECRET the key comes from the project's JWKS endpoint."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    sub = uuid4()
    token = jwt.encode(
        {"sub": str(sub), "aud": "authenticated", "exp": 9_999_999_999},
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
        creds = auth.HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = await auth.get_current_user(creds)
    finally:
        config.get_settings.cache_clear()

    assert user.id == sub
    assert requested == ["http://supabase.test"]
