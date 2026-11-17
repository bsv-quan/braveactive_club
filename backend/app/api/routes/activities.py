"""Activity endpoints. Guests can browse activities; all changes require an account."""

import uuid

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, DbSession
from app.core.rate_limit import enforce_limit, rate_limit
from app.schemas.club import (
    ActivityCreate,
    ActivityCreated,
    ActivityDetail,
    ActivityList,
    MessageBody,
)
from app.services import activities as service
from app.services import community, notifications
from app.services.realtime import publish, publish_to_user

router = APIRouter(prefix="/activities", tags=["activities"])
activity_write_limit = Depends(rate_limit("activity-write", 60, 60))


@router.get("", response_model=ActivityList)
async def list_activities(db: DbSession):
    return ActivityList(activities=await service.list_activities(db))


@router.get("/{activity_id}", response_model=ActivityDetail)
async def get_activity_detail(activity_id: uuid.UUID, db: DbSession):
    activity, occurrences = await service.get_activity_detail(db, activity_id)
    return ActivityDetail(activity=activity, occurrences=occurrences)


@router.post("", response_model=ActivityCreated, status_code=201, dependencies=[activity_write_limit])
async def create_activity(body: ActivityCreate, db: DbSession, user: CurrentUser):
    """Create any activity type, requiring a fully authenticated account."""
    if body.share_to_community:
        enforce_limit(f"post:{user.id}", 20, 3600)
    activity, recurrence, generated, community_post_id = await service.create_activity(db, body, user)
    community_post = None
    if community_post_id:
        community_post = await community.get_post_out(db, community_post_id, user)
        recipients = await notifications.notify_post_created(db, user, community_post_id)
        for recipient_id, unread_count in recipients:
            await publish_to_user(str(recipient_id), "notification.created", unreadCount=unread_count)
        await publish("post.created", post=community_post.model_dump(mode="json", by_alias=True))
    return ActivityCreated(
        activity=service.to_activity_out(activity, {}),
        recurrence=recurrence,
        generated_occurrences=generated,
        community_post=community_post,
    )


@router.delete("/{activity_id}")
async def delete_activity(activity_id: uuid.UUID, db: DbSession, user: CurrentUser):
    removed = await service.delete_activity(db, user, activity_id)
    return {"deleted": True, "deletedOccurrences": removed}


@router.post("/{activity_id}/join", status_code=201, dependencies=[activity_write_limit])
async def join(activity_id: uuid.UUID, db: DbSession, user: CurrentUser):
    """Register the signed-in account using its profile display name."""
    return {"name": await service.join_activity(db, activity_id, user)}


@router.delete("/{activity_id}/join", dependencies=[activity_write_limit])
async def leave(activity_id: uuid.UUID, db: DbSession, user: CurrentUser):
    """Remove the signed-in account from an activity."""
    return {"name": await service.leave_activity(db, activity_id, user), "deleted": True}


@router.post("/{activity_id}/comments", status_code=201, dependencies=[activity_write_limit])
async def comment(activity_id: uuid.UUID, body: MessageBody, db: DbSession, user: CurrentUser):
    """Add a comment attributed to the signed-in account."""
    return {"comment": await service.add_activity_comment(db, activity_id, body.message, user)}
