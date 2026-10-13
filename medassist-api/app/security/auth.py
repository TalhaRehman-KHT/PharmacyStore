"""FastAPI dependencies that identify the caller (X-User-Id header or Supabase JWT)."""

# Caller identity: app_user_id mode (default) or Supabase JWT mode
import asyncio
import logging
from functools import lru_cache
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from supabase import AsyncClient

from app.config import get_settings
from app.db.client import get_db
from app.repositories.users import get_user

logger = logging.getLogger(__name__)

AUDIENCE = "authenticated"
ASYMMETRIC_ALGORITHMS = ["RS256", "ES256"]
USER_ID_HEADER = "X-User-Id"

# auto_error=False so a missing header returns our own 401 body; both add "Authorize" to /docs.
_bearer = HTTPBearer(auto_error=False, description="supabase mode: `Bearer <jwt>`")
_user_id_header = APIKeyHeader(
    name=USER_ID_HEADER,
    auto_error=False,
    description="app_user_id mode: paste a public.users id",
)


class CurrentUser(BaseModel):
    """The caller. In app_user_id mode name and role come from public.users."""

    id: UUID
    email: str | None = None
    name: str | None = None
    role: str | None = None


def _unauthorized(message: str, scheme: str = "Bearer") -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, message, headers={"WWW-Authenticate": scheme}
    )


def staff_roles() -> set[str]:
    """Roles that may open the escalation routes (from settings)."""
    settings = get_settings()
    return set(settings.staff_all_access_roles) | set(settings.staff_vendor_roles)


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


async def _user_from_header(db: AsyncClient, raw_id: str | None) -> CurrentUser:
    """app_user_id mode: the header must name an existing, active user."""
    if not raw_id:
        raise _unauthorized(f"Missing {USER_ID_HEADER} header", USER_ID_HEADER)
    try:
        user_id = UUID(raw_id)
    except ValueError:
        raise _unauthorized("Invalid user", USER_ID_HEADER) from None
    row = await get_user(db, user_id)
    if row is None or row.get("is_active") is False:
        raise _unauthorized("Invalid user", USER_ID_HEADER)
    # The role ALWAYS comes from the database, never from the request.
    return CurrentUser(id=user_id, name=row.get("name"), role=row.get("role"))


async def _user_from_token(credentials: HTTPAuthorizationCredentials | None) -> CurrentUser:
    """supabase mode: 401 unless the request carries a valid, unexpired bearer token."""
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise _unauthorized("Missing bearer token")
    try:
        claims = await _decode(credentials.credentials)
        # The token's role claim is not the app role; require_staff reads public.users.
        return CurrentUser(id=claims["sub"], email=claims.get("email"))
    except Exception as exc:  # bad signature, expired, wrong audience, JWKS down, bad sub...
        logger.info("Rejected token: %s", type(exc).__name__)
        raise _unauthorized("Invalid or expired token") from None


async def get_current_user(
    request: Request,
    db: Annotated[AsyncClient, Depends(get_db)],
    raw_user_id: Annotated[str | None, Depends(_user_id_header)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    """Dependency: the caller, per settings.auth_mode, or 401.

    Also stores the user id on request.state for the per-user rate limit key.
    """
    if get_settings().auth_mode == "app_user_id":
        user = await _user_from_header(db, raw_user_id)
    else:
        user = await _user_from_token(credentials)
    request.state.user_id = str(user.id)
    return user


async def fetch_user_role(db: AsyncClient, user_id: UUID) -> str | None:
    """Read the app role from public.users (custom auth table).

    None if there is no row or the account is deactivated (is_active = false).
    """
    row = await get_user(db, user_id)
    if row is None or row.get("is_active") is False:
        return None
    return row.get("role")


async def require_staff(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncClient, Depends(get_db)],
) -> CurrentUser:
    """Dependency: 403 unless the caller is an active staff user in public.users."""
    if get_settings().auth_mode == "app_user_id":
        role = user.role  # already read from public.users by get_current_user
    else:
        role = await fetch_user_role(db, user.id)
    if role not in staff_roles():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Pharmacist access required")
    return user.model_copy(update={"role": role})
