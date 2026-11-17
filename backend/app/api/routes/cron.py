"""Maintenance endpoints protected by a shared secret (for external schedulers)."""

from fastapi import APIRouter, Request

from app.api.deps import DbSession
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import safe_equals
from app.services.activities import run_recurrence_job

router = APIRouter(prefix="/cron", tags=["cron"])


@router.get("/activity-recurrences")
async def activity_recurrences(request: Request, db: DbSession):
    secret = get_settings().cron_secret
    if not secret:
        raise AppError("Chưa cấu hình CRON_SECRET cho tác vụ lặp hoạt động.", 503)
    if not safe_equals(request.headers.get("authorization", ""), f"Bearer {secret}"):
        raise AppError("Không được phép.", 401)
    return await run_recurrence_job(db)
