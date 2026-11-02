"""Activity endpoints. Guests can browse activities; all changes require an account."""

import uuid

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, DbSession
from app.core.rate_limit import rate_limit
from app.schemas.club import (
    ActivityCreate,
    ActivityCreated,
    ActivityList,
    MessageBody,
    NameBody,
    VoteBody,
)
from app.services import activities as service

router = APIRouter(prefix="/activities", tags=["activities"])
activity_write_limit = Depends(rate_limit("activity-write", 60, 60))


@router.get("", response_model=ActivityList)
async def list_activities(db: DbSession):
    return ActivityList(activities=await service.list_activities(db))


@router.post("", response_model=ActivityCreated, status_code=201, dependencies=[activity_write_limit])
async def create_activity(body: ActivityCreate, db: DbSession, user: CurrentUser):
    """Create any activity type, requiring a fully authenticated account."""
    activity, recurrence, generated = await service.create_activity(db, body, user)
    return ActivityCreated(
        activity=service.to_activity_out(activity, {}), recurrence=recurrence, generated_occurrences=generated
    )


@router.delete("/{activity_id}")
async def delete_activity(activity_id: uuid.UUID, db: DbSession, user: CurrentUser):
    removed = await service.delete_activity(db, user, activity_id)
    return {"deleted": True, "deletedOccurrences": removed}


@router.post("/{activity_id}/join", status_code=201, dependencies=[activity_write_limit])
async def join(activity_id: uuid.UUID, body: NameBody, db: DbSession, _: CurrentUser):
    """Register a participant only after the account and CSRF checks pass."""
    return {"name": await service.join_activity(db, activity_id, body.name)}


@router.delete("/{activity_id}/join", dependencies=[activity_write_limit])
async def leave(activity_id: uuid.UUID, body: NameBody, db: DbSession, _: CurrentUser):
    """Remove a participant only for an authenticated account."""
    return {"name": await service.leave_activity(db, activity_id, body.name), "deleted": True}


@router.post("/{activity_id}/votes", dependencies=[activity_write_limit])
async def vote(activity_id: uuid.UUID, body: VoteBody, db: DbSession, _: CurrentUser):
    """Submit availability votes only for an authenticated account."""
    name, dates = await service.submit_vote(db, activity_id, body.name, body.dates)
    return {"name": name, "dates": dates}


@router.post("/{activity_id}/comments", status_code=201, dependencies=[activity_write_limit])
async def comment(activity_id: uuid.UUID, body: MessageBody, db: DbSession, _: CurrentUser):
    """Add an activity comment only for an authenticated account."""
    return {"comment": await service.add_activity_comment(db, activity_id, body.message)}
