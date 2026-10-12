"""FastAPI dependency that verifies the Supabase JWT and returns the caller."""

# Supabase JWT verification
import asyncio
import logging
from functools import lru_cache
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from supabase import AsyncClient

from app.config import get_settings
from app.db.client import get_db

logger = logging.getLogger(__name__)

AUDIENCE = "authenticated"
ASYMMETRIC_ALGORITHMS = ["RS256", "ES256"]
# Roles in public.users that may answer escalations ("pharmacist" kept for a future role).
STAFF_ROLES = {"pharmacist", "vendor", "admin"}

# auto_error=False so a missing header returns our own 401 body; also adds "Authorize" to /docs.
_bearer = HTTPBearer(auto_error=False, description="Access token: `Bearer <jwt>`")


class CurrentUser(BaseModel):
    """The authenticated caller, taken from verified token claims."""

    id: UUID
    email: str | None = None
    role: str | None = None


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, message, headers={"WWW-Authenticate": "Bearer"}
    )


@lru_cache
def _jwks_client(supabase_url: str) -> jwt.PyJWKClient:
    """One cached JWKS client per project; it also caches the fetched keys."""
    url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=600)


async def _decode(token: str) -> dict:
    """Verify signature, audience and expiry. Raises jwt.PyJWTError on any problem."""
    settings = get_settings()
    options = {"require": ["exp", "sub"]}
    if settings.supabase_jwt_secret is not None:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            audience=AUDIENCE,
            options=options,
        )
    # PyJWKClient fetches over blocking HTTP, so keep it off the event loop.
    signing_key = await asyncio.to_thread(
        _jwks_client(settings.supabase_url).get_signing_key_from_jwt, token
    )
    return jwt.decode(
        token, signing_key.key, algorithms=ASYMMETRIC_ALGORITHMS, audience=AUDIENCE, options=options
    )


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    """Dependency: 401 unless the request carries a valid, unexpired bearer token.

    Also stores the user id on request.state for the per-user rate limit key.
    """
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise _unauthorized("Missing bearer token")
    try:
        claims = await _decode(credentials.credentials)
        user = CurrentUser(id=claims["sub"], email=claims.get("email"), role=claims.get("role"))
    except Exception as exc:  # bad signature, expired, wrong audience, JWKS down, bad sub...
        logger.info("Rejected token: %s", type(exc).__name__)
        raise _unauthorized("Invalid or expired token") from None
    request.state.user_id = str(user.id)
    return user


async def fetch_user_role(db: AsyncClient, user_id: UUID) -> str | None:
    """Read the app role from public.users (custom auth table).

    None if there is no row or the account is deactivated (is_active = false).
    """
    res = await (
        db.table("users").select("role, is_active").eq("id", str(user_id)).maybe_single().execute()
    )
    if not res or not res.data or res.data.get("is_active") is False:
        return None
    return res.data.get("role")


async def require_staff(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncClient, Depends(get_db)],
) -> CurrentUser:
    """Dependency: 403 unless the caller is an active vendor or admin in public.users."""
    role = await fetch_user_role(db, user.id)
    if role not in STAFF_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Pharmacist access required")
    return user
