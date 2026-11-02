"""Community endpoints: feed, posts, likes, comments, link preview, media and live updates."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from app.api.deps import SESSION_COOKIE, DbSession, CurrentUser, OptionalUser
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.rate_limit import enforce_limit, rate_limit
from app.schemas.community import (
    CommentCreate,
    CommentCreated,
    CommentOut,
    LikeOut,
    LinkPreviewOut,
    PostOut,
    PostPage,
    PostUpdate,
    CommentUpdate,
)
from app.schemas.notifications import MarkNotificationsRead, NotificationPage
from app.schemas.auth import MessageOut
from app.services import community, notifications, uploads
from app.services.link_preview import get_link_preview, normalize_url
from app.services.realtime import manager, publish, publish_to_user
from app.db.session import SessionFactory
from app.services.auth import get_user_by_session
from app.core.security import hash_token

logger = logging.getLogger("app.community")

router = APIRouter(tags=["community"])
media_router = APIRouter(tags=["media"])
ws_router = APIRouter()


@router.get("/posts", response_model=PostPage)
async def list_posts(
    db: DbSession,
    viewer: OptionalUser,
    cursor: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=10, ge=1, le=30),
):
    """Public feed (guests can read everything)."""
    return await community.list_posts(db, viewer, cursor, limit)


@router.get("/notifications", response_model=NotificationPage)
async def list_notifications(
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(default=30, ge=1, le=50),
):
    return await notifications.list_for_user(db, user.id, limit)


@router.post("/notifications/read")
async def mark_notifications_read(body: MarkNotificationsRead, db: DbSession, user: CurrentUser):
    unread_count = await notifications.mark_read(db, user.id, body.ids)
    return {"unreadCount": unread_count}


@router.get("/presence")
async def list_presence(
    user_ids: list[uuid.UUID] = Query(default=[], alias="userIds"),
):
    if len(user_ids) > 100:
        raise AppError("Yêu cầu tối đa 100 trạng thái cùng lúc.", 400)
    requested = {str(user_id) for user_id in user_ids}
    return {"onlineUserIds": sorted(requested & manager.online_user_ids)}


@router.get("/admin/posts", response_model=PostPage)
async def list_posts_for_admin(
    db: DbSession,
    user: CurrentUser,
    cursor: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=30),
):
    if user.role != "admin":
        raise AppError("Bạn không có quyền truy cập trang quản lý.", 403)
    return await community.list_posts(db, user, cursor, limit)


@router.delete("/admin/posts/{post_id}", response_model=MessageOut)
async def admin_delete_post(post_id: uuid.UUID, db: DbSession, user: CurrentUser):
    if user.role != "admin":
        raise AppError("Bạn không có quyền xóa bài viết này.", 403)
    await community.delete_post(db, user, post_id)
    await publish("post.deleted", postId=str(post_id))
    return MessageOut(message="Đã xóa bài đăng.")


@router.post("/posts", response_model=PostOut, status_code=201)
async def create_post(
    db: DbSession,
    user: CurrentUser,
    content: Annotated[str, Form(max_length=4000)] = "",
    link_url: Annotated[str | None, Form(max_length=2048)] = None,
    skip_preview: Annotated[bool, Form()] = False,
    image: Annotated[UploadFile | None, File()] = None,
):
    enforce_limit(f"post:{user.id}", 20, 3600)
    post = await community.create_post(db, user, content, link_url, skip_preview, image)
    notice_recipients = await notifications.notify_post_created(db, user, post.id)
    for recipient_id, unread_count in notice_recipients:
        await publish_to_user(str(recipient_id), "notification.created", unreadCount=unread_count)
    await publish("post.created", post=post.model_dump(mode="json", by_alias=True))
    return post


@router.get("/posts/{post_id}", response_model=PostOut)
async def get_post(post_id: uuid.UUID, db: DbSession, viewer: OptionalUser):
    return await community.get_post_out(db, post_id, viewer)


@router.delete("/posts/{post_id}", response_model=MessageOut)
async def delete_post(post_id: uuid.UUID, db: DbSession, user: CurrentUser):
    await community.delete_post(db, user, post_id)
    await publish("post.deleted", postId=str(post_id))
    return MessageOut(message="Đã xóa bài đăng.")


@router.put("/posts/{post_id}", response_model=PostOut)
async def update_post(post_id: uuid.UUID, body: PostUpdate, db: DbSession, user: CurrentUser):
    post = await community.update_post(db, user, post_id, body.content)
    await publish("post.updated", post=post.model_dump(mode="json", by_alias=True))
    return post


@router.put("/posts/{post_id}/like", response_model=LikeOut)
async def like_post(post_id: uuid.UUID, db: DbSession, user: CurrentUser):
    enforce_limit(f"like:{user.id}", 120, 60)
    count, liked, added = await community.set_like(db, user, post_id, True)
    if added:
        notice_recipients = await notifications.notify_post_liked(db, user, post_id)
        for recipient_id, unread_count in notice_recipients:
            await publish_to_user(str(recipient_id), "notification.created", unreadCount=unread_count)
    await publish("post.liked", postId=str(post_id), likeCount=count)
    return LikeOut(post_id=post_id, like_count=count, liked_by_me=liked)


@router.delete("/posts/{post_id}/like", response_model=LikeOut)
async def unlike_post(post_id: uuid.UUID, db: DbSession, user: CurrentUser):
    enforce_limit(f"like:{user.id}", 120, 60)
    count, liked, _ = await community.set_like(db, user, post_id, False)
    await publish("post.liked", postId=str(post_id), likeCount=count)
    return LikeOut(post_id=post_id, like_count=count, liked_by_me=liked)


@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
async def list_comments(post_id: uuid.UUID, db: DbSession):
    return await community.list_comments(db, post_id)


@router.post("/posts/{post_id}/comments", response_model=CommentCreated, status_code=201)
async def create_comment(post_id: uuid.UUID, body: CommentCreate, db: DbSession, user: CurrentUser):
    enforce_limit(f"comment:{user.id}", 60, 3600)
    comment, count = await community.add_comment(db, user, post_id, body.content)
    notice_recipients = await notifications.notify_comment_created(db, user, post_id, body.content)
    for recipient_id, unread_count in notice_recipients:
        await publish_to_user(str(recipient_id), "notification.created", unreadCount=unread_count)
    await publish(
        "comment.created",
        postId=str(post_id),
        commentCount=count,
        comment=comment.model_dump(mode="json", by_alias=True),
    )
    return CommentCreated(comment=comment, comment_count=count)


@router.delete("/posts/{post_id}/comments/{comment_id}")
async def delete_comment(post_id: uuid.UUID, comment_id: uuid.UUID, db: DbSession, user: CurrentUser):
    count = await community.delete_comment(db, user, post_id, comment_id)
    await publish("comment.deleted", postId=str(post_id), commentId=str(comment_id), commentCount=count)
    return {"commentCount": count}


@router.put("/posts/{post_id}/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    post_id: uuid.UUID,
    comment_id: uuid.UUID,
    body: CommentUpdate,
    db: DbSession,
    user: CurrentUser,
):
    comment = await community.update_comment(db, user, post_id, comment_id, body.content)
    await publish(
        "comment.updated",
        postId=str(post_id),
        comment=comment.model_dump(mode="json", by_alias=True),
    )
    return comment


@router.get(
    "/link-preview",
    response_model=LinkPreviewOut,
    dependencies=[Depends(rate_limit("link-preview", 30, 60))],
)
async def link_preview(user: CurrentUser, url: Annotated[str, Query(min_length=8, max_length=2048)]):
    """Preview metadata for the composer. Login required to limit abuse of the fetcher."""
    preview = await get_link_preview(normalize_url(url))
    return LinkPreviewOut(
        url=preview.url, title=preview.title, description=preview.description, image=preview.image, site=preview.site
    )


@media_router.get("/media/{name}")
async def get_media(name: str):
    """Serve uploaded images. Names are validated against a strict whitelist pattern."""
    path = uploads.image_path(name)
    if path is None:
        raise AppError("Không tìm thấy ảnh.", 404)
    return FileResponse(
        path,
        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"},
    )


@ws_router.websocket("/ws/feed")
async def feed_socket(websocket: WebSocket):
    """Read-only live channel: server pushes feed events; client messages are ignored."""
    origin = websocket.headers.get("origin")
    # Browsers always send Origin on WebSocket handshakes; reject foreign sites.
    if origin is not None and origin not in get_settings().frontend_origins:
        await websocket.close(code=1008)
        return
    if not manager.can_accept():
        await websocket.close(code=1013)
        return

    user_id = None
    session_hash = None
    session_token = websocket.cookies.get(SESSION_COOKIE)
    if session_token:
        session_hash = hash_token(session_token)
        async with SessionFactory() as db:
            user = await get_user_by_session(db, session_token)
            if user and not user.must_change_password:
                user_id = str(user.id)
            else:
                session_hash = None

    if user_id and session_hash:
        await manager.connect(websocket, user_id, session_hash)
    else:
        await manager.connect(websocket)
    try:
        while True:
            # Keeps the connection open and lets us notice disconnects; payloads are capped.
            message = await websocket.receive_text()
            if len(message) > 256:
                await websocket.close(code=1009)
                break
            if message == "ping":
                if user_id and session_token:
                    async with SessionFactory() as db:
                        user = await get_user_by_session(db, session_token)
                    if not user or user.must_change_password:
                        await websocket.close(code=1008)
                        break
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        logger.debug("WebSocket closed with error", exc_info=True)
    finally:
        await manager.disconnect(websocket)
