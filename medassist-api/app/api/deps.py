"""Route dependencies shared by the routers."""

from typing import Annotated

from fastapi import Depends, Request
from supabase import AsyncClient

from app.db.client import get_db
from app.rag.deps import RagDeps
from app.repositories import Repos


def get_repos(db: Annotated[AsyncClient, Depends(get_db)]) -> Repos:
    """All repositories bound to the app's Supabase client."""
    return Repos(db)


def get_rag(request: Request) -> RagDeps:
    """Embedder, reranker and answer LLM created in the lifespan."""
    return request.app.state.rag
