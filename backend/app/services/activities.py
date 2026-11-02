"""Activity business logic: validation, recurrence expansion, participation, polls, comments."""

import calendar
import logging
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.permissions import can_manage
from app.models import (
    Activity,
    ActivityComment,
    ActivityParticipant,
    ActivityRecurrence,
    ActivityVote,
    User,
)
from app.schemas.club import ActivityCommentOut, ActivityCreate, ActivityOut

logger = logging.getLogger("app.activities")

CATEGORIES = ("CẦU LÔNG", "TỪ THIỆN", "THỂ THAO")
INTERVALS = ("daily", "weekly", "monthly")
END_TYPES = ("never", "count", "until")
HORIZON_DAYS = 90
MAX_OCCURRENCES_PER_RUN = 100
RECURRENCE_LOCK_ID = 727301  # arbitrary advisory-lock key for the recurrence job


# ----------------------------------------------------------------- helpers
def normalize_text(value: str) -> str:
    """NFC-normalise, trim and collapse whitespace."""
    return " ".join(unicodedata.normalize("NFC", value).split())


def name_key(name: str) -> str:
    """Case-insensitive identity for participants/voters (same rule as the old app)."""
    return normalize_text(name).lower()


def parse_day(value: object) -> date | None:
    """Parse a strict YYYY-MM-DD string, returning ``None`` when invalid."""
    if not isinstance(value, str) or len(value) != 10:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str) or len(value) < 11 or value[10] != "T":
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def next_activity_day(day: date, interval: str, anchor_day: int) -> date:
    """Next occurrence date; monthly repeats keep the original day-of-month when possible."""
    if interval == "daily":
        return day + timedelta(days=1)
    if interval == "weekly":
        return day + timedelta(days=7)
    year, month = (day.year + 1, 1) if day.month == 12 else (day.year, day.month + 1)
    return date(year, month, min(anchor_day, calendar.monthrange(year, month)[1]))


def is_complete(rec: ActivityRecurrence) -> bool:
    if rec.end_type == "count":
        return rec.occurrence_count >= (rec.count or 0)
    if rec.end_type == "until":
        return rec.until is not None and rec.next_day > rec.until
    return False


def repeat_config(rec: ActivityRecurrence) -> dict:
    config: dict = {"interval": rec.interval, "endType": rec.end_type}
    if rec.count is not None:
        config["count"] = rec.count
    if rec.until is not None:
        config["until"] = rec.until.isoformat()
    return config


def to_activity_out(activity: Activity, repeat_by_series: dict[uuid.UUID, dict]) -> ActivityOut:
    votes: dict[str, list[str]] = {}
    for vote in activity.votes:
        for day in vote.dates:
            votes.setdefault(day, []).append(vote.name)
    repeat = repeat_by_series.get(activity.recurrence_series_id) if activity.recurrence_series_id else None
    return ActivityOut(
        id=activity.id,
        kind=activity.kind,
        recurrence_series_id=activity.recurrence_series_id,
        repeat=repeat or activity.repeat,
        title=activity.title,
        description=activity.description,
        category=activity.category,
        schedule_type=activity.schedule_type,
        date=activity.date,
        day=activity.day,
        created_at=activity.created_at,
        creator=activity.creator,
        participants=[p.name for p in activity.participants],
        votes=votes,
        comments=[ActivityCommentOut.model_validate(c) for c in activity.comments],
    )


async def get_activity_or_404(db: AsyncSession, activity_id: uuid.UUID) -> Activity:
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise AppError("Không tìm thấy hoạt động.", 404)
    return activity


def validate_person_name(raw: str, message: str = "Tên cần từ 2 đến 40 ký tự.") -> str:
    name = normalize_text(raw)
    if not 2 <= len(name) <= 40:
        raise AppError(message, 400)
    return name


# ----------------------------------------------------------------- queries
async def list_activities(db: AsyncSession) -> list[ActivityOut]:
    activities = (await db.scalars(select(Activity).order_by(Activity.created_at.desc()))).all()
    recurrences = (await db.scalars(select(ActivityRecurrence))).all()
    repeat_by_series = {rec.id: repeat_config(rec) for rec in recurrences}
    return [to_activity_out(activity, repeat_by_series) for activity in activities]


# ------------------------------------------------------------------ create
def _validate_repeat(raw: dict | None, day: date | None) -> dict | None:
    if raw is None:
        return None
    if raw.get("interval") not in INTERVALS or raw.get("endType") not in END_TYPES:
        raise AppError("Cấu hình lặp lại không hợp lệ.", 400)
    config: dict = {"interval": raw["interval"], "endType": raw["endType"]}
    if raw["endType"] == "count":
        count = raw.get("count")
        if not isinstance(count, int) or isinstance(count, bool) or not 2 <= count <= 100:
            raise AppError("Ngày kết thúc hoặc số lần lặp không hợp lệ.", 400)
        config["count"] = count
    if raw["endType"] == "until":
        until = parse_day(raw.get("until"))
        if until is None or day is None or until <= day:
            raise AppError("Ngày kết thúc hoặc số lần lặp không hợp lệ.", 400)
        config["until"] = until.isoformat()
    return config


async def create_activity(db: AsyncSession, body: ActivityCreate, user: User | None) -> tuple[Activity, dict | None, int]:
    """Validate and create an activity (plus generated repeats). Returns (activity, recurrence, extra)."""
    quick = body.kind == "quick-signup"
    if body.kind not in (None, "activity", "quick-signup"):
        raise AppError("Loại đăng ký không hợp lệ.", 400)
    if not quick and (
        body.description is None
        or body.category is None
        or body.schedule_type not in ("scheduled", "poll")
        or body.creator is None
    ):
        raise AppError("Vui lòng nhập nội dung, loại, lịch và tên người tạo.", 400)

    title = body.title.strip()
    description = "Đăng ký nhanh theo ngày." if quick else (body.description or "").strip()
    creator = "Cộng đồng" if quick else normalize_text(body.creator or "")
    category = "THỂ THAO" if quick else body.category
    schedule_type = "scheduled" if quick else body.schedule_type

    when: datetime | None = None
    day: date | None = None
    if quick:
        day = parse_day(body.day)
        when = datetime(day.year, day.month, day.day, 12, tzinfo=timezone.utc) if day else None
    elif schedule_type == "scheduled":
        when = parse_datetime(body.date)
        day = parse_day(body.day) or (when.date() if when else None)

    invalid = (
        len(title) < (2 if quick else 3)
        or len(title) > 120
        or not 5 <= len(description) <= 1000
        or not 2 <= len(creator) <= 40
        or category not in CATEGORIES
        or (schedule_type == "scheduled" and (when is None or day is None))
        or (schedule_type == "poll" and body.date is not None)
    )
    if invalid:
        raise AppError("Thông tin hoạt động chưa hợp lệ. Vui lòng kiểm tra lại các trường.", 400)

    repeat = _validate_repeat(body.repeat, day) if body.repeat is not None else None
    if repeat and (quick or schedule_type != "scheduled"):
        raise AppError("Cấu hình lặp lại không hợp lệ.", 400)

    series_id = uuid.uuid4() if repeat else None
    activity = Activity(
        kind="quick-signup" if quick else "activity",
        recurrence_series_id=series_id,
        repeat=repeat,
        title=title,
        title_key=name_key(title),
        description=description,
        category=category,
        schedule_type=schedule_type,
        date=when,
        day=day,
        creator=creator,
        created_by=user.id if user else None,
    )
    db.add(activity)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise AppError("Đã có hoạt động cùng tên trong ngày này.", 409) from None

    recurrence_out: dict | None = None
    generated = 0
    if repeat and day and when:
        anchor = day.day
        rec = ActivityRecurrence(
            id=series_id,
            interval=repeat["interval"],
            end_type=repeat["endType"],
            count=repeat.get("count"),
            until=parse_day(repeat.get("until")),
            next_day=next_activity_day(day, repeat["interval"], anchor),
            occurrence_count=1,
            anchor_day=anchor,
            template={
                "kind": activity.kind,
                "title": title,
                "description": description,
                "category": category,
                "creator": creator,
                "createdBy": str(user.id) if user else None,
                "time": when.astimezone(timezone.utc).strftime("%H:%M:%S"),
                "repeat": repeat,
            },
        )
        horizon = day + timedelta(days=HORIZON_DAYS)
        generated, _ = await expand_series(db, rec, horizon, MAX_OCCURRENCES_PER_RUN - 1)
        if not is_complete(rec):
            db.add(rec)
            recurrence_out = {"id": str(rec.id), **repeat_config(rec)}

    await db.commit()
    await db.refresh(activity)
    return activity, recurrence_out, generated


async def expand_series(db: AsyncSession, rec: ActivityRecurrence, horizon: date, max_new: int) -> tuple[int, int]:
    """Create due occurrences up to ``horizon``; returns (created, skipped_duplicates).

    Shared by the create endpoint and the scheduled job so both behave identically.
    """
    created = skipped = processed = 0
    template = rec.template
    while not is_complete(rec) and rec.next_day <= horizon and processed < max_new:
        day = rec.next_day
        hour, minute, second = (int(part) for part in template.get("time", "12:00:00").split(":"))
        statement = (
            pg_insert(Activity)
            .values(
                id=uuid.uuid4(),
                kind=template.get("kind", "activity"),
                recurrence_series_id=rec.id,
                repeat=template.get("repeat"),
                title=template["title"],
                title_key=name_key(template["title"]),
                description=template["description"],
                category=template["category"],
                schedule_type="scheduled",
                date=datetime(day.year, day.month, day.day, hour, minute, second, tzinfo=timezone.utc),
                day=day,
                creator=template["creator"],
                created_by=uuid.UUID(template["createdBy"]) if template.get("createdBy") else None,
            )
            .on_conflict_do_nothing(index_elements=["day", "title_key"], index_where=text("day IS NOT NULL"))
            .returning(Activity.id)
        )
        if await db.scalar(statement):
            created += 1
        else:
            skipped += 1
            logger.warning("Skipped repeat '%s' on %s: duplicate", template["title"], day)
        processed += 1
        rec.occurrence_count += 1
        rec.next_day = next_activity_day(day, rec.interval, rec.anchor_day)
    return created, skipped


async def run_recurrence_job(db: AsyncSession) -> dict[str, int]:
    """Generate upcoming occurrences for every active series (safe to run on many workers)."""
    locked = await db.scalar(text("SELECT pg_try_advisory_xact_lock(:id)"), {"id": RECURRENCE_LOCK_ID})
    if not locked:
        return {"created": 0, "skippedDuplicates": 0, "completedSeries": 0, "skipped": 1}

    horizon = datetime.now(timezone.utc).date() + timedelta(days=HORIZON_DAYS)
    created = skipped = completed = 0
    for rec in (await db.scalars(select(ActivityRecurrence))).all():
        if not is_complete(rec):
            new, dup = await expand_series(db, rec, horizon, MAX_OCCURRENCES_PER_RUN)
            created += new
            skipped += dup
        if is_complete(rec):
            await db.delete(rec)
            completed += 1
    await db.commit()
    return {"created": created, "skippedDuplicates": skipped, "completedSeries": completed, "skipped": 0}


# ------------------------------------------------------------------ delete
async def delete_activity(db: AsyncSession, user: User, activity_id: uuid.UUID) -> int:
    """Delete an activity (or the whole repeating series). Returns number of removed rows."""
    activity = await get_activity_or_404(db, activity_id)
    if not can_manage(user, activity.created_by):
        raise AppError("Bạn không có quyền xóa hoạt động này.", 403)

    targets = [activity]
    if activity.recurrence_series_id:
        targets = list(
            (await db.scalars(select(Activity).where(Activity.recurrence_series_id == activity.recurrence_series_id))).all()
        )
        rec = await db.get(ActivityRecurrence, activity.recurrence_series_id)
        if rec:
            await db.delete(rec)
    for target in targets:
        await db.delete(target)
    await db.commit()
    return len(targets)


# ------------------------------------------------- participation and polls
async def join_activity(db: AsyncSession, activity_id: uuid.UUID, raw_name: str) -> str:
    name = validate_person_name(raw_name)
    await get_activity_or_404(db, activity_id)
    statement = (
        pg_insert(ActivityParticipant)
        .values(activity_id=activity_id, name_key=name_key(name), name=name)
        .on_conflict_do_nothing()
        .returning(ActivityParticipant.name_key)
    )
    if not await db.scalar(statement):
        raise AppError("Tên này đã tham gia hoạt động rồi.", 409)
    await db.commit()
    return name


async def leave_activity(db: AsyncSession, activity_id: uuid.UUID, raw_name: str) -> str:
    name = validate_person_name(raw_name, "Tên người tham gia không hợp lệ.")
    await get_activity_or_404(db, activity_id)
    participant = await db.get(ActivityParticipant, (activity_id, name_key(name)))
    if not participant:
        raise AppError("Không tìm thấy người tham gia cần xóa.", 404)
    await db.delete(participant)
    await db.commit()
    return name


async def submit_vote(db: AsyncSession, activity_id: uuid.UUID, raw_name: str, raw_dates: list[str]) -> tuple[str, list[str]]:
    name = normalize_text(raw_name)
    dates = sorted(set(raw_dates))
    if (
        not 2 <= len(name) <= 40
        or not 1 <= len(dates) <= 14
        or any(parse_day(day) is None for day in dates)
    ):
        raise AppError("Tên hoặc ngày bình chọn không hợp lệ (chọn từ 1 đến 14 ngày).", 400)
    activity = await get_activity_or_404(db, activity_id)
    if activity.schedule_type != "poll":
        raise AppError("Hoạt động này đã có lịch cố định, không nhận bình chọn.", 409)

    key = name_key(name)
    vote = await db.get(ActivityVote, (activity_id, key))
    if vote:
        vote.name, vote.dates = name, dates
    else:
        db.add(ActivityVote(activity_id=activity_id, name_key=key, name=name, dates=dates))
    await db.commit()
    return name, dates


async def add_activity_comment(db: AsyncSession, activity_id: uuid.UUID, raw_message: str) -> ActivityCommentOut:
    message = raw_message.strip()
    if not 2 <= len(message) <= 1000:
        raise AppError("Nội dung bình luận cần từ 2 đến 1000 ký tự.", 400)
    await get_activity_or_404(db, activity_id)
    comment = ActivityComment(activity_id=activity_id, message=message)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return ActivityCommentOut.model_validate(comment)
