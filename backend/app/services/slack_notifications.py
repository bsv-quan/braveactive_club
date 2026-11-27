"""Database-backed activity notification schedules for one configured Slack webhook."""

import calendar
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.permissions import can_manage
from app.db.session import SessionFactory
from app.models import Activity, ActivitySlackDelivery, ActivitySlackSchedule, User
from app.schemas.club import SlackScheduleInput
from app.services.activities import get_activity_or_404

logger = logging.getLogger("app.slack_notifications")
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
RETRY_DELAY = timedelta(minutes=5)


def webhook_configured() -> bool:
    parsed = urlparse(get_settings().slack_webhook_url)
    return parsed.scheme == "https" and parsed.netloc == "hooks.slack.com" and parsed.path.startswith("/services/") and not parsed.query and not parsed.fragment


def next_scheduled_at(schedule: ActivitySlackSchedule, after: datetime) -> datetime:
    """Find the next local slot, clamping monthly dates to the last day."""
    local_after = after.astimezone(VIETNAM_TZ)
    day = max(schedule.start_date, local_after.date())
    for offset in range(400):
        candidate_day = day + timedelta(days=offset)
        if schedule.interval == "weekly" and candidate_day.weekday() != schedule.weekday:
            continue
        if schedule.interval == "monthly" and candidate_day.day != min(
            schedule.month_day or 1, calendar.monthrange(candidate_day.year, candidate_day.month)[1]
        ):
            continue
        candidate = datetime.combine(candidate_day, schedule.send_time, tzinfo=VIETNAM_TZ)
        if candidate > local_after:
            return candidate.astimezone(timezone.utc)
    raise ValueError("Could not calculate next Slack notification")


async def managed_activity(db: AsyncSession, activity_id: uuid.UUID, user: User) -> Activity:
    activity = await get_activity_or_404(db, activity_id, include_pending=True)
    if not can_manage(user, activity.created_by):
        raise AppError("Bạn không có quyền quản lý thông báo hoạt động này.", 403)
    return activity


async def list_schedules(db: AsyncSession, activity_id: uuid.UUID, user: User) -> list[ActivitySlackSchedule]:
    await managed_activity(db, activity_id, user)
    return list((await db.scalars(
        select(ActivitySlackSchedule).where(ActivitySlackSchedule.activity_id == activity_id, ActivitySlackSchedule.cancelled.is_(False))
        .order_by(ActivitySlackSchedule.next_attempt_at, ActivitySlackSchedule.id)
    )).all())


async def create_schedule(db: AsyncSession, activity_id: uuid.UUID, user: User, body: SlackScheduleInput) -> ActivitySlackSchedule:
    activity = await managed_activity(db, activity_id, user)
    schedule = ActivitySlackSchedule(
        activity_id=activity_id,
        activity_title=activity.title,
        message=body.message.strip(),
        interval=body.interval,
        start_date=body.start_date,
        send_time=body.send_time,
        weekday=body.weekday,
        month_day=body.month_day,
    )
    schedule.next_attempt_at = next_scheduled_at(schedule, datetime.now(timezone.utc))
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


async def delete_schedule(db: AsyncSession, activity_id: uuid.UUID, schedule_id: uuid.UUID, user: User) -> None:
    await managed_activity(db, activity_id, user)
    schedule = await db.scalar(
        select(ActivitySlackSchedule).where(
            ActivitySlackSchedule.id == schedule_id,
            ActivitySlackSchedule.activity_id == activity_id,
            ActivitySlackSchedule.cancelled.is_(False),
        ).with_for_update()
    )
    if schedule is None:
        raise AppError("Không tìm thấy lịch thông báo.", 404)
    schedule.cancelled = True
    schedule.paused = True
    await db.commit()


async def _send_webhook(text: str) -> None:
    request = httpx.Request(
        "POST",
        get_settings().slack_webhook_url,
        content=json.dumps({"text": text}, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        extensions={"timeout": {"connect": 10, "read": 10, "write": 10, "pool": 10}},
    )
    async with httpx.AsyncHTTPTransport() as transport:
        response = await transport.handle_async_request(request)
        try:
            content = await response.aread()
            if response.status_code != 200 or content.strip() != b"ok":
                raise RuntimeError(f"Slack HTTP {response.status_code}")
        finally:
            await response.aclose()


async def _message_for(db: AsyncSession, activity: Activity, message: str, now: datetime) -> str:
    displayed = activity
    no_upcoming = False
    if activity.recurrence_series_id:
        occurrence = await db.scalar(
            select(Activity).where(
                Activity.recurrence_series_id == activity.recurrence_series_id,
                Activity.approved.is_(True),
                Activity.day >= now.astimezone(VIETNAM_TZ).date(),
            ).order_by(Activity.day, Activity.id).limit(1)
        )
        if occurrence:
            displayed = occurrence
        else:
            no_upcoming = True
    when = (
        "Chưa có lịch sắp tới" if no_upcoming else
        displayed.date.astimezone(VIETNAM_TZ).strftime("%d/%m/%Y %H:%M") if displayed.date else "Chưa chốt lịch"
    )
    link = f"{get_settings().frontend_base_url.rstrip('/')}/activities/{activity.id}"
    return f"Hoạt động: {displayed.title}\n{message}\nThời gian: {when} (Asia/Ho_Chi_Minh)\nChi tiết: {link}"


async def run_due_slack_notifications(now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Scheduler time must be timezone-aware")
    processed = 0
    for _ in range(50):
        async with SessionFactory() as db:
            schedule = await db.scalar(
                select(ActivitySlackSchedule)
                .where(
                    ActivitySlackSchedule.next_attempt_at <= now,
                    ActivitySlackSchedule.paused.is_(False),
                    ActivitySlackSchedule.cancelled.is_(False),
                    ActivitySlackSchedule.activity_id.is_not(None),
                )
                .order_by(ActivitySlackSchedule.next_attempt_at, ActivitySlackSchedule.id)
                .with_for_update(skip_locked=True)
                .limit(1)
            )
            if schedule is None:
                break
            activity = await db.get(Activity, schedule.activity_id, with_for_update=True)
            if activity is None:
                await db.rollback()
                continue
            if not activity.approved:
                schedule.next_attempt_at = next_scheduled_at(schedule, now)
                schedule.last_error = None
            elif not webhook_configured():
                schedule.next_attempt_at = now + RETRY_DELAY
                if schedule.last_error != "webhook_not_configured":
                    db.add(ActivitySlackDelivery(schedule_id=schedule.id, attempted_at=now, status="failed", error="webhook_not_configured"))
                schedule.last_error = "webhook_not_configured"
            else:
                message = await _message_for(db, activity, schedule.message, now)
                try:
                    await _send_webhook(message)
                except (httpx.HTTPError, RuntimeError) as error:
                    schedule.next_attempt_at = now + RETRY_DELAY
                    schedule.last_error = "delivery_failed"
                    db.add(ActivitySlackDelivery(schedule_id=schedule.id, attempted_at=now, status="failed", message=message, error="delivery_failed"))
                    logger.warning("Slack delivery failed: schedule_id=%s error_type=%s", schedule.id, type(error).__name__)
                else:
                    schedule.last_sent_at = now
                    schedule.last_error = None
                    schedule.next_attempt_at = next_scheduled_at(schedule, now)
                    db.add(ActivitySlackDelivery(schedule_id=schedule.id, attempted_at=now, status="sent", message=message))
            await db.commit()
            processed += 1
    return processed
