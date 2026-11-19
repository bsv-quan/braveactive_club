"""One-time AI backfill for activities created before location detection existed."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Activity
from app.services.ai_content import detect_activity_location


async def backfill_activity_locations(db: AsyncSession) -> tuple[int, int]:
    pending = list(
        (
            await db.scalars(
                select(Activity)
                .where(Activity.location_checked_at.is_(None))
                .order_by(Activity.created_at, Activity.id)
            )
        ).all()
    )
    grouped: dict[str, list[Activity]] = {}
    for activity in pending:
        group_key = (
            f"series:{activity.recurrence_series_id}"
            if activity.recurrence_series_id
            else f"activity:{activity.id}"
        )
        grouped.setdefault(group_key, []).append(activity)

    processed = with_location = 0
    for group in grouped.values():
        activity = group[0]
        location = None
        if activity.recurrence_series_id:
            location = await db.scalar(
                select(Activity.location)
                .where(
                    Activity.recurrence_series_id == activity.recurrence_series_id,
                    Activity.location.is_not(None),
                )
                .limit(1)
            )
        if not location:
            location = await detect_activity_location(activity.title, activity.description)

        checked_at = datetime.now(timezone.utc)
        for occurrence in group:
            if occurrence.location is None:
                occurrence.location = location
            occurrence.location_checked_at = checked_at
        await db.commit()
        processed += len(group)
        if location:
            with_location += len(group)

    return processed, with_location
