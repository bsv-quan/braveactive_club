"""Administrator-only account management and manual request approval."""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import Field, field_validator
from sqlalchemy import delete, func, select, text

from app.api.deps import CurrentUser, DbSession
from app.core.errors import AppError
from app.core.security import hash_password
from app.models import AccountRequest, Post, User, UserSession
from app.schemas.auth import CorporateEmail, Password
from app.schemas.base import CamelModel
from app.services import activities as activity_service
from app.services import uploads
from app.services.realtime import manager, publish

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise AppError("Bạn không có quyền truy cập trang quản lý.", 403)
    return user


Admin = Annotated[User, Depends(require_admin)]


@router.get("/activities")
async def list_activities(
    db: DbSession,
    _: Admin,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    activities, has_more = await activity_service.list_activity_page(db, offset, limit)
    return {"activities": activities, "hasMore": has_more}


class AdminUserCreate(CamelModel):
    email: CorporateEmail
    display_name: str | None = Field(default=None, min_length=2, max_length=40)
    password: Password
    role: Literal["user", "admin"] = "user"

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Tên hiển thị cần từ 2 ký tự.")
        return value


class AdminUserUpdate(CamelModel):
    display_name: str = Field(min_length=2, max_length=40)
    role: Literal["user", "admin"]

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Tên hiển thị cần từ 2 ký tự.")
        return value


class Approval(CamelModel):
    password: Password


async def _revoke_sessions(db: DbSession, user_id: uuid.UUID) -> list[str]:
    hashes = list(await db.scalars(select(UserSession.token_hash).where(UserSession.user_id == user_id)))
    await db.execute(delete(UserSession).where(UserSession.user_id == user_id))
    return hashes


async def _disconnect(hashes: list[str]) -> None:
    for session_hash in hashes:
        await manager.invalidate_session(session_hash)


async def _protect_last_admin(db: DbSession, target: User) -> None:
    # Serialize concurrent demotions/deletions so two admins cannot remove each other.
    await db.execute(text("SELECT pg_advisory_xact_lock(724352617)"))
    if target.role == "admin":
        count = await db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.is_active))
        if count is not None and count <= 1:
            raise AppError("Không thể xóa hoặc hạ quyền quản trị viên cuối cùng.", 409)


@router.get("/users")
async def list_users(db: DbSession, _: Admin, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100)):
    rows = (await db.scalars(select(User).order_by(User.created_at.desc(), User.id).offset(offset).limit(limit + 1))).all()
    return {"users": [{"id": str(u.id), "email": u.email, "displayName": u.display_name, "role": u.role}
                      for u in rows[:limit]], "hasMore": len(rows) > limit}


@router.post("/users", status_code=201)
async def create_user(body: AdminUserCreate, db: DbSession, _: Admin):
    if await db.scalar(select(User.id).where(User.email == body.email)):
        raise AppError("Email đã được đăng ký.", 409)
    # Admin-created users can set their own display name later from their profile.
    display_name = body.display_name.strip() if body.display_name else str(body.email).split("@", 1)[0][:40]
    user = User(email=body.email, display_name=display_name, role=body.role,
                password_hash=hash_password(body.password), must_change_password=True)
    db.add(user)
    await db.execute(delete(AccountRequest).where(AccountRequest.email == body.email, AccountRequest.purpose == "register"))
    await db.commit()
    return {"id": str(user.id)}


@router.patch("/users/{user_id}")
async def update_user(user_id: uuid.UUID, body: AdminUserUpdate, db: DbSession, admin: Admin):
    await db.execute(text("SELECT pg_advisory_xact_lock(724352617)"))
    user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not user:
        raise AppError("Không tìm thấy người dùng.", 404)
    if user.id == admin.id and body.role != "admin":
        raise AppError("Không thể tự hạ quyền.", 400)
    if user.role == "admin" and body.role != "admin":
        await _protect_last_admin(db, user)
    user.display_name = body.display_name.strip()
    user.role = body.role
    await db.commit()
    return {"updated": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: uuid.UUID, db: DbSession, admin: Admin):
    await db.execute(text("SELECT pg_advisory_xact_lock(724352617)"))
    user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not user:
        raise AppError("Không tìm thấy người dùng.", 404)
    if user.id == admin.id:
        raise AppError("Không thể tự xóa tài khoản.", 400)
    await _protect_last_admin(db, user)
    posts = (await db.scalars(select(Post).where(Post.author_id == user.id))).unique().all()
    post_ids = [str(post.id) for post in posts]
    images = [
        name
        for post in posts
        for name in [*(post.image_names or []), post.image_name]
    ] + [user.avatar_name]
    hashes = await _revoke_sessions(db, user.id)
    await db.execute(delete(AccountRequest).where(AccountRequest.email == user.email))
    await db.delete(user)
    await db.commit()
    await _disconnect(hashes)
    for image in images:
        uploads.delete_image(image)
    for post_id in post_ids:
        await publish("post.deleted", postId=post_id)
    return {"deleted": True}


@router.get("/requests")
async def list_requests(db: DbSession, _: Admin, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100)):
    rows = (await db.scalars(select(AccountRequest).order_by(AccountRequest.created_at, AccountRequest.id).offset(offset).limit(limit + 1))).all()
    return {"requests": [{"id": str(r.id), "email": r.email, "purpose": r.purpose,
                          "displayName": r.display_name, "createdAt": r.created_at.isoformat()}
                         for r in rows[:limit]], "hasMore": len(rows) > limit}


@router.post("/requests/{request_id}/approve")
async def approve_request(request_id: uuid.UUID, body: Approval, db: DbSession, _: Admin):
    """Approve only after the administrator has verified the requester out of band."""
    request = await db.scalar(select(AccountRequest).where(AccountRequest.id == request_id).with_for_update())
    if not request:
        raise AppError("Không tìm thấy yêu cầu.", 404)
    user = await db.scalar(select(User).where(User.email == request.email).with_for_update())
    hashes: list[str] = []
    if request.purpose == "register":
        if user or not request.display_name:
            raise AppError("Tài khoản đã tồn tại hoặc yêu cầu không hợp lệ.", 409)
        db.add(User(email=request.email, display_name=request.display_name, role="user",
                    password_hash=hash_password(body.password), must_change_password=True))
    elif request.purpose == "reset":
        if not user or not user.is_active:
            raise AppError("Không tìm thấy người dùng.", 404)
        user.password_hash = hash_password(body.password)
        user.must_change_password = True
        user.failed_logins = 0
        user.locked_until = None
        hashes = await _revoke_sessions(db, user.id)
    else:
        raise AppError("Yêu cầu không hợp lệ.", 400)
    await db.delete(request)
    await db.commit()
    await _disconnect(hashes)
    return {"approved": True}


@router.delete("/requests/{request_id}")
async def reject_request(request_id: uuid.UUID, db: DbSession, _: Admin):
    request = await db.get(AccountRequest, request_id)
    if not request:
        raise AppError("Không tìm thấy yêu cầu.", 404)
    await db.delete(request)
    await db.commit()
    return {"deleted": True}
