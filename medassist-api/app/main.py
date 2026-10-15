"""FastAPI application: lifespan, CORS, routers, /health + /ready and error handlers.

Every path lives under API_PREFIX ("" by default, e.g. "/medassist" behind a load balancer).
"""

import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import routes
from app.config import Settings, get_settings
from app.db import client as db_client
from app.errors import BUSY_MESSAGE, Conflict, NotFound, TooManyRequests
from app.graph.build import agent_graph, enable_tracing
from app.llm.providers import AllProvidersBusy
from app.observability import REQUEST_ID_HEADER, RequestContextMiddleware, configure_logging
from app.rag.deps import create_rag_deps

logger = logging.getLogger("medassist")
READY_TIMEOUT_S = 5  # /ready must answer fast, also when the database hangs


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create shared resources once at startup."""
    settings: Settings = app.state.settings
    app.state.db = await db_client.create_db(settings)
    # query embeddings (Gemini); LLM timeouts are in llm/providers.py, Supabase's in db/client.py
    http = httpx.AsyncClient(timeout=30)
    app.state.rag = create_rag_deps(app.state.db, settings, http)
    agent_graph()  # compile the agent once, at startup
    tracing = enable_tracing(settings)
    logger.info(
        "MedAssist API %s started (env=%s, langsmith=%s)",
        settings.app_version,
        settings.app_env,
        "on" if tracing else "off",
    )
    if settings.auth_mode == "app_user_id":
        logger.warning(
            "auth_mode=app_user_id: user id is trusted from the client (same level as the main app)"
        )
    try:
        yield
    finally:
        await http.aclose()


def _error(
    status: int, message: str, headers: dict | None = None, **extra: object
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"status": status, "message": message, **extra},
        headers=headers,
    )


async def _ready(app: FastAPI) -> list[str]:
    """Problems that make this instance unable to serve (empty list = ready)."""
    problems = []
    settings: Settings = app.state.settings
    required = {"SUPABASE_URL": settings.supabase_url, "SUPABASE_SERVICE_KEY":
                settings.supabase_service_key.get_secret_value(), "GROQ_API_KEY":
                settings.groq_api_key.get_secret_value(), "GEMINI_API_KEY":
                settings.gemini_api_key.get_secret_value()}
    problems += [f"{name} missing" for name, value in required.items() if not value]
    db = getattr(app.state, "db", None)
    if db is None:
        return [*problems, "database client not started"]
    try:  # one cheap query: a single id of a small table
        await asyncio.wait_for(
            db.table("drug_synonyms").select("id").limit(1).execute(), READY_TIMEOUT_S
        )
    except Exception as exc:  # timeout, network, auth: the type is enough (no secrets, no text)
        problems.append(f"database: {type(exc).__name__}")
    return problems


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI app (from .env unless `settings` is given, e.g. by live checks)."""
    settings = settings or get_settings()
    configure_logging(settings.log_level, prod=settings.app_env == "prod")
    prefix = settings.api_prefix
    docs = settings.docs_enabled
    app = FastAPI(
        title="MedAssist API",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url=f"{prefix}/docs" if docs else None,
        redoc_url=None,
        openapi_url=f"{prefix}/openapi.json" if docs else None,
    )
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["X-User-Id", "Content-Type", "Authorization", REQUEST_ID_HEADER],
        # the browser may read these (Retry-After for the 429 countdown)
        expose_headers=["Retry-After", REQUEST_ID_HEADER],
    )
    app.add_middleware(RequestContextMiddleware)  # outermost: its id is on every response

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error(exc.status_code, str(exc.detail), getattr(exc, "headers", None))

    @app.exception_handler(NotFound)
    async def not_found(_: Request, exc: NotFound) -> JSONResponse:
        return _error(404, exc.message)

    @app.exception_handler(Conflict)
    async def conflict(_: Request, exc: Conflict) -> JSONResponse:
        return _error(409, exc.message)

    @app.exception_handler(TooManyRequests)
    async def rate_limited(_: Request, exc: TooManyRequests) -> JSONResponse:
        return _error(
            429,
            exc.message,
            headers={"Retry-After": str(exc.retry_after_s)},
            retryAfterSec=exc.retry_after_s,
        )

    @app.exception_handler(AllProvidersBusy)
    async def llm_busy(_: Request, exc: AllProvidersBusy) -> JSONResponse:
        logger.warning("All LLM providers busy; Retry-After %s s", exc.retry_after_s)
        return _error(
            429,
            BUSY_MESSAGE,
            headers={"Retry-After": str(exc.retry_after_s)},
            retryAfterSec=exc.retry_after_s,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(p) for p in first.get("loc", []))
        return _error(422, f"{field}: {first.get('msg', 'Invalid request')}".strip(": "))

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _error(500, "Internal server error")

    meta = APIRouter(tags=["meta"])

    @meta.get("/health")
    async def health() -> dict:
        """Liveness: the process answers. Touches no dependency."""
        return {"status": "ok", "version": settings.app_version, "env": settings.app_env}

    @meta.get("/ready", responses={503: {"description": "Not ready (see problems)"}})
    async def ready(request: Request) -> JSONResponse:
        """Readiness: required settings present and one cheap database query works; else 503."""
        problems = await _ready(request.app)
        if problems:
            logger.warning("not ready", extra={"fields": {"problems": problems}})
            return _error(503, "Not ready", problems=problems)
        return JSONResponse({"status": "ready"})

    app.include_router(meta, prefix=prefix)
    app.include_router(routes.router, prefix=prefix)
    return app


app = create_app()
