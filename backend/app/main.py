"""FastAPI application factory."""

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.routes import activities, admin, auth, badminton, community, content, cron
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging_config import configure_logging
from app.core.middleware import BodySizeLimitMiddleware, OriginCheckMiddleware, SecurityHeadersMiddleware
from app.db.session import SessionFactory
from app.services.activities import run_recurrence_job
from app.services.ai_post_scheduler import run_due_ai_post_slots

logger = logging.getLogger("app")
RECURRENCE_INTERVAL_SECONDS = 6 * 3600
AI_POST_SCHEDULE_INTERVAL_SECONDS = 30


async def _recurrence_loop() -> None:
    """Periodically materialise upcoming occurrences of repeating activities."""
    while True:
        try:
            async with SessionFactory() as db:
                result = await run_recurrence_job(db)
            logger.info("Recurrence job: %s", result)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("Recurrence job failed")
        await asyncio.sleep(RECURRENCE_INTERVAL_SECONDS)


async def _ai_post_schedule_loop() -> None:
    """Run scheduled AI posts shortly after their configured Vietnam-time slots."""
    logger.info("AI post scheduler started: timezone=Asia/Ho_Chi_Minh")
    while True:
        try:
            await run_due_ai_post_slots()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("AI post scheduler tick failed")
        await asyncio.sleep(AI_POST_SCHEDULE_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    settings.validate_for_runtime()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    tasks = [
        asyncio.create_task(_recurrence_loop()),
        asyncio.create_task(_ai_post_schedule_loop()),
    ]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    app = FastAPI(
        title="Brave Active API",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    register_exception_handlers(app)

    # Order matters: the last middleware added is the outermost (CORS must see everything).
    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(OriginCheckMiddleware)
    # Compress JSON responses (images are already compressed and below the threshold rule).
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
        max_age=600,
    )

    api = APIRouter(prefix="/api")
    for module in (auth, admin, activities, content, badminton, community, cron):
        api.include_router(module.router)
    app.include_router(api)
    app.include_router(community.media_router)
    app.include_router(community.ws_router)

    @app.get("/health", include_in_schema=False)
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
