"""Async Supabase client (service role). Created once in the app lifespan and
injected into routes through the get_db() dependency."""

from fastapi import Request
from supabase import AsyncClient, AsyncClientOptions, acreate_client

from app.config import Settings

DB_TIMEOUT_S = 15  # per table / RPC request (the library default is 120 s)


async def create_db(settings: Settings) -> AsyncClient:
    """Create the async Supabase client with the service role key (server side only)."""
    return await acreate_client(
        settings.supabase_url,
        settings.supabase_service_key.get_secret_value(),
        options=AsyncClientOptions(postgrest_client_timeout=DB_TIMEOUT_S),
    )


def get_db(request: Request) -> AsyncClient:
    """FastAPI dependency: the shared client stored on app.state."""
    return request.app.state.db
