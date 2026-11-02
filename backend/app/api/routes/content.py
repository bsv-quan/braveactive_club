"""Club content endpoints: home feed and announcements."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.club import AnnouncementBody, ContentOut
from app.services import announcements as service

router = APIRouter(tags=["content"])


@router.get("/content", response_model=ContentOut)
async def get_content(db: DbSession):
    return await service.get_content(db)


@router.post("/announcements", status_code=201)
async def create_announcement(body: AnnouncementBody, db: DbSession, user: CurrentUser):
    return {"announcement": await service.create_announcement(db, user, body)}


@router.patch("/announcements/{announcement_id}")
async def update_announcement(announcement_id: str, body: AnnouncementBody, db: DbSession, user: CurrentUser):
    return {"announcement": await service.update_announcement(db, user, announcement_id, body)}


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, db: DbSession, user: CurrentUser):
    await service.delete_announcement(db, user, announcement_id)
    return {"deleted": True}
