"""Reliable, database-backed scheduling for AI community posts."""

import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import SessionFactory
from app.models import AIPostScheduleRun, Post
from app.services import ai_content

logger = logging.getLogger("app.ai_post_scheduler")

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
FRESHNESS_HOURS = 4
SLOT_GRACE = timedelta(hours=1)
RETRY_DELAY = timedelta(minutes=5)
RUN_LEASE = timedelta(minutes=20)
MAX_ATTEMPTS = 3


@dataclass(frozen=True)
class ScheduledSlot:
    key: str
    scheduled_time: time
    topics: tuple[str, ...]
    ai_technology_only: bool = False


SCHEDULED_SLOTS = (
    ScheduledSlot("technology-ai-1730", time(17, 30), ("technology",), ai_technology_only=True),
    ScheduledSlot("technology-0800", time(8, 0), ("technology",)),
    ScheduledSlot("technology-0830", time(8, 30), ("technology",)),
    ScheduledSlot("midday-1200", time(12, 0), ("travel", "sports", "entertainment")),
    ScheduledSlot("afternoon-1600", time(16, 0), ("sports", "entertainment", "technology")),
)


def _due_slot_date(slot: ScheduledSlot, now: datetime) -> date | None:
    local_now = now.astimezone(VIETNAM_TZ)
    scheduled_at = datetime.combine(local_now.date(), slot.scheduled_time, tzinfo=VIETNAM_TZ)
    if scheduled_at <= local_now < scheduled_at + SLOT_GRACE:
        return local_now.date()
    return None


async def _claim_slot(db: AsyncSession, slot_date: date, slot: ScheduledSlot, now: datetime) -> uuid.UUID | None:
    statement = (
        pg_insert(AIPostScheduleRun)
        .values(
            id=uuid.uuid4(),
            slot_date=slot_date,
            slot_key=slot.key,
            status="running",
            attempt_count=1,
            started_at=now,
        )
        .on_conflict_do_nothing(constraint="uq_ai_post_schedule_slot_date_key")
        .returning(AIPostScheduleRun.id)
    )
    run_id = await db.scalar(statement)
    if run_id is not None:
        await db.commit()
        return run_id

    run = await db.scalar(
        select(AIPostScheduleRun).where(
            AIPostScheduleRun.slot_date == slot_date,
            AIPostScheduleRun.slot_key == slot.key,
        )
    )
    if run is None or run.status in {"posted", "skipped"} or run.attempt_count >= MAX_ATTEMPTS:
        await db.rollback()
        return None
    if run.status == "failed":
        if run.next_attempt_at is None or run.next_attempt_at > now:
            await db.rollback()
            return None
    elif run.status == "running":
        if run.started_at > now - RUN_LEASE:
            await db.rollback()
            return None
    else:
        await db.rollback()
        logger.error("Unexpected AI post schedule state: slot=%s status=%s", slot.key, run.status)
        return None

    result = await db.execute(
        update(AIPostScheduleRun)
        .where(
            AIPostScheduleRun.id == run.id,
            AIPostScheduleRun.status == run.status,
            AIPostScheduleRun.attempt_count == run.attempt_count,
        )
        .values(
            status="running",
            attempt_count=run.attempt_count + 1,
            started_at=now,
            next_attempt_at=None,
            last_error=None,
        )
        .returning(AIPostScheduleRun.id)
    )
    claimed_id = result.scalar_one_or_none()
    await db.commit()
    return claimed_id


async def _mark_skipped(db: AsyncSession, run_id: uuid.UUID, reason: str) -> None:
    await db.execute(
        update(AIPostScheduleRun)
        .where(AIPostScheduleRun.id == run_id, AIPostScheduleRun.status == "running")
        .values(status="skipped", last_error=reason, next_attempt_at=None)
    )
    await db.commit()
    logger.info("AI post schedule skipped: run_id=%s reason=%s", run_id, reason)


async def _mark_failed(run_id: uuid.UUID, now: datetime, error: Exception) -> None:
    async with SessionFactory() as db:
        message = str(error)[:500] or type(error).__name__
        await db.execute(
            update(AIPostScheduleRun)
            .where(AIPostScheduleRun.id == run_id, AIPostScheduleRun.status == "running")
            .values(
                status="failed",
                next_attempt_at=now + RETRY_DELAY,
                last_error=message,
            )
        )
        await db.commit()
    logger.error(
        "AI post schedule attempt failed: run_id=%s error_type=%s",
        run_id,
        type(error).__name__,
        exc_info=(type(error), error, error.__traceback__),
    )


async def _post_scheduled_article(
    db: AsyncSession,
    run_id: uuid.UUID,
    slot: ScheduledSlot,
    now: datetime,
) -> None:
    candidates = await ai_content._rss_candidates(
        "technology" if len(slot.topics) == 1 else "all",
        FRESHNESS_HOURS,
        now=now,
        topics=slot.topics,
        ai_technology_only=slot.ai_technology_only,
    )
    candidates = await ai_content._unused_candidates(db, candidates)
    if not candidates:
        await _mark_skipped(db, run_id, "No fresh, unused RSS articles in the four-hour window.")
        return

    candidate = candidates[0]
    draft = await ai_content._generate_article(candidate)
    author = await ai_content._get_ai_user(db)
    post = Post(
        author_id=author.id,
        content=f"{draft.title.strip()}\n\n{draft.content.strip()}",
        approved=author.role == "admin",
        link_url=candidate.url,
        link_title=candidate.title[:300],
        link_description=candidate.description[:600]
        or "Bản tóm tắt có AI hỗ trợ. Xem bài viết gốc tại nguồn.",
        link_site=candidate.source_domain,
    )
    db.add(post)
    await db.flush()
    await db.execute(
        update(AIPostScheduleRun)
        .where(AIPostScheduleRun.id == run_id, AIPostScheduleRun.status == "running")
        .values(status="posted", post_id=post.id, next_attempt_at=None, last_error=None)
    )
    await db.commit()
    logger.info(
        "Scheduled AI post created: slot=%s post_id=%s topic=%s source=%s",
        slot.key,
        post.id,
        candidate.topic,
        candidate.url,
    )


async def run_due_ai_post_slots(now: datetime | None = None) -> int:
    """Run due slots once, retry transient failures, and persist every outcome."""
    now = now or datetime.now(VIETNAM_TZ)
    if now.tzinfo is None:
        raise ValueError("Scheduled AI post time must be timezone-aware.")

    completed = 0
    for slot in SCHEDULED_SLOTS:
        slot_date = _due_slot_date(slot, now)
        if slot_date is None:
            continue
        async with SessionFactory() as db:
            run_id = await _claim_slot(db, slot_date, slot, now)
        if run_id is None:
            continue

        try:
            async with SessionFactory() as db:
                await _post_scheduled_article(db, run_id, slot, now)
            completed += 1
        except Exception as error:
            await _mark_failed(run_id, now, error)
    return completed
