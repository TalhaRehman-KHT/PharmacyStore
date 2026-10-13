"""FastAPI application: lifespan, CORS, routers, /health and error handlers."""

# FastAPI app, CORS, routers
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import routes
from app.config import get_settings
from app.db import client as db_client
from app.errors import Conflict, NotFound
from app.rate_limit import limiter, retry_after_seconds

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger("medassist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create shared resources once at startup."""
    settings = get_settings()
    app.state.db = await db_client.create_db(settings)
    logger.info("MedAssist API %s started (env=%s)", settings.app_version, settings.app_env)
    if settings.auth_mode == "app_user_id":
        logger.warning(
            "auth_mode=app_user_id: user id is trusted from the client (same level as the main app)"
        )
    yield


def _error(
    status: int, message: str, headers: dict | None = None, **extra: object
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"status": status, "message": message, **extra},
        headers=headers,
    )


def create_app() -> FastAPI:
    """Build the FastAPI app from current settings."""
    settings = get_settings()
    app = FastAPI(title="MedAssist API", version=settings.app_version, lifespan=lifespan)
    app.state.limiter = limiter

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["X-User-Id", "Content-Type", "Authorization"],
    )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error(exc.status_code, str(exc.detail), getattr(exc, "headers", None))

    @app.exception_handler(NotFound)
    async def not_found(_: Request, exc: NotFound) -> JSONResponse:
        return _error(404, exc.message)

    @app.exception_handler(Conflict)
    async def conflict(_: Request, exc: Conflict) -> JSONResponse:
        return _error(409, exc.message)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limited(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        retry_after = retry_after_seconds(request, exc)
        return _error(
            429,
            "Too many questions. Please try again later.",
            headers={"Retry-After": str(retry_after)},
            retryAfterSec=retry_after,
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

    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        """Liveness check. Does not touch the database."""
        return {"status": "ok", "version": settings.app_version, "env": settings.app_env}

    app.include_router(routes.router)
    return app


app = create_app()
