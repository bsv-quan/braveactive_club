"""Legacy per-day badminton sign-up list (kept for API compatibility)."""

from datetime import date, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.api.deps import CurrentUser, DbSession
from app.core.errors import AppError
from app.models import BadmintonRegistration
from app.schemas.club import BadmintonBody
from app.services.activities import name_key, parse_day, validate_person_name

router = APIRouter(prefix="/badminton", tags=["badminton"])


def _day_or_400(value: str) -> date:
    day = parse_day(value)
    if day is None:
        raise AppError("Ngày không hợp lệ.", 400)
    return day


@router.get("")
async def list_registrations(db: DbSession, from_: str = Query(alias="from"), to: str = Query()):
    start, end = parse_day(from_), parse_day(to)
    if start is None or end is None or start > end:
        raise AppError("Khoảng ngày không hợp lệ.", 400)
    if (end - start).days + 1 > 42:
        raise AppError("Mỗi lần chỉ có thể xem tối đa 42 ngày.", 400)
    rows = await db.scalars(
        select(BadmintonRegistration).where(BadmintonRegistration.day.between(start, end)).order_by(BadmintonRegistration.name)
    )
    result = {(start + timedelta(days=i)).isoformat(): [] for i in range((end - start).days + 1)}
    for row in rows:
        result[row.day.isoformat()].append(row.name)
    return {"registrations": result}


@router.post("", status_code=201)
async def register(body: BadmintonBody, db: DbSession, _: CurrentUser):
    """Register for badminton only after the account and CSRF checks pass."""
    day = _day_or_400(body.date)
    name = validate_person_name(body.name)
    inserted = await db.scalar(
        pg_insert(BadmintonRegistration)
        .values(day=day, name_key=name_key(name), name=name)
        .on_conflict_do_nothing()
        .returning(BadmintonRegistration.name_key)
    )
    if not inserted:
        raise AppError("Tên này đã đăng ký cho ngày đã chọn rồi.", 409)
    await db.commit()
    return {"date": body.date, "name": name}


@router.delete("")
async def unregister(body: BadmintonBody, db: DbSession, _: CurrentUser):
    """Remove a badminton registration only for an authenticated account."""
    day = _day_or_400(body.date)
    name = validate_person_name(body.name, "Ngày hoặc tên đăng ký không hợp lệ.")
    row = await db.get(BadmintonRegistration, (day, name_key(name)))
    if not row:
        raise AppError("Không tìm thấy lượt đăng ký cần xóa.", 404)
    await db.delete(row)
    await db.commit()
    return {"date": body.date, "name": name, "deleted": True}
