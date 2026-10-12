"""Route dependencies shared by the routers."""

from typing import Annotated

from fastapi import Depends
from supabase import AsyncClient

from app.db.client import get_db
from app.repositories import Repos


def get_repos(db: Annotated[AsyncClient, Depends(get_db)]) -> Repos:
    """All repositories bound to the app's Supabase client (tests override this or get_db)."""
    return Repos(db)
