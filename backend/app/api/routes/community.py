"""Community endpoints: feed, posts, likes, comments, link preview, media and live updates."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy.exc import SQLAlchemyError

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
from app.schemas.feedback import FeedbackCreate, FeedbackOut
from app.schemas.notifications import MarkNotificationsRead, NotificationPage
from app.schemas.ai_content import WordSearchPuzzle, WordSearchRequest
from app.schemas.game_score import (
    BoardGameBotTurnRequest,
    BoardGameForfeitRequest,
    BoardGameMoveRequest,
    BoardGameResponse,
    BoardGameStartRequest,
    BoardGameType,
    GameStatus,
    GameType,
    GameRoundStarted,
    LeaderboardOut,
    LeaderboardPeriod,
    StrategyAnswerRequest,
    StrategyAnswerResult,
    WordSearchGuessRequest,
    WordSearchGuessResult,
    WordSearchHintResult,
)
from app.schemas.auth import MessageOut
from app.services import ai_content, community, game_scores, notifications, uploads
from app.services.link_preview import get_link_preview, normalize_url
from app.services.realtime import manager, publish, publish_to_user
from app.db.session import SessionFactory
from app.services.auth import get_user_by_session
from app.core.security import hash_token
from app.models import Feedback, Post
from pydantic import BaseModel

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


@router.post(
    "/games/word-search",
    response_model=WordSearchPuzzle,
    dependencies=[Depends(rate_limit("word-search-generation", 5, 3600))],
)
async def create_word_search(body: WordSearchRequest, db: DbSession, user: OptionalUser):
    puzzle = await ai_content.generate_word_search(body)
    if user is not None:
        game_round = await game_scores.start_word_search_round(
            db,
            user,
            puzzle.grid,
            [word.answer for word in puzzle.words],
            body.difficulty,
        )
        puzzle.round_id = game_round.id
    return puzzle


@router.post(
    "/games/word-search/{round_id}/guess",
    response_model=WordSearchGuessResult,
)
async def guess_word_search_word(
    round_id: uuid.UUID,
    body: WordSearchGuessRequest,
    db: DbSession,
    user: CurrentUser,
):
    return await game_scores.submit_word_search_guess(db, user, round_id, body.cells)


@router.post(
    "/games/word-search/{round_id}/hint",
    response_model=WordSearchHintResult,
)
async def hint_word_search_word(
    round_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
):
    return await game_scores.use_word_search_hint(db, user, round_id)


@router.post(
    "/games/board/{game_type}/start",
    response_model=BoardGameResponse,
    dependencies=[Depends(rate_limit("board-game-start", 30, 3600))],
)
async def start_board_game(
    game_type: BoardGameType,
    body: BoardGameStartRequest,
    db: DbSession,
    user: OptionalUser,
):
    return await game_scores.start_board_game(db, user, game_type, body.difficulty)


@router.get(
    "/games/board/{game_type}/active",
    response_model=BoardGameResponse | None,
)
async def get_active_board_game(game_type: BoardGameType, db: DbSession, user: CurrentUser):
    return await game_scores.get_active_board_game(db, user, game_type)


@router.delete("/games/board/{game_type}/active")
async def abandon_active_board_game(game_type: BoardGameType, db: DbSession, user: CurrentUser):
    await game_scores.abandon_active_board_game(db, user, game_type)
    return {"ok": True}


@router.post("/games/board/{game_type}/forfeit", response_model=BoardGameResponse)
async def forfeit_board_game(
    game_type: BoardGameType,
    body: BoardGameForfeitRequest,
    db: DbSession,
    user: OptionalUser,
):
    return await game_scores.forfeit_board_game(db, user, game_type, body.round_id, body.state)


@router.post(
    "/games/board/{game_type}/move",
    response_model=BoardGameResponse,
    dependencies=[Depends(rate_limit("board-game-move", 600, 3600))],
)
async def submit_board_game_move(
    game_type: BoardGameType,
    body: BoardGameMoveRequest,
    db: DbSession,
    user: OptionalUser,
):
    return await game_scores.submit_board_game_move(
        db,
        user,
        game_type,
        body.difficulty,
        body.move.as_engine_move(),
        body.round_id,
        body.state,
    )


@router.post(
    "/games/board/{game_type}/bot-turn",
    response_model=BoardGameResponse,
    dependencies=[Depends(rate_limit("board-game-bot-turn", 600, 3600))],
)
async def submit_board_game_bot_turn(
    game_type: BoardGameType,
    body: BoardGameBotTurnRequest,
    db: DbSession,
    user: OptionalUser,
):
    return await game_scores.submit_board_game_bot_turn(
        db,
        user,
        game_type,
        body.difficulty,
        body.round_id,
        body.state,
    )


@router.post("/games/strategy/start", response_model=GameRoundStarted)
async def start_strategy_round(db: DbSession, user: CurrentUser):
    game_round = await game_scores.start_strategy_round(db, user)
    return {"round_id": game_round.id}


@router.get("/games/status", response_model=GameStatus)
async def get_games_status(db: DbSession, user: CurrentUser):
    return await game_scores.get_game_status(db, user)


@router.post(
    "/games/strategy/{round_id}/answer",
    response_model=StrategyAnswerResult,
)
async def answer_strategy_question(
    round_id: uuid.UUID,
    body: StrategyAnswerRequest,
    db: DbSession,
    user: CurrentUser,
):
    return await game_scores.submit_strategy_answer(
        db,
        user,
        round_id,
        body.question_index,
        body.answer_index,
    )


@router.get("/games/leaderboard", response_model=LeaderboardOut)
async def list_game_leaderboard(
    db: DbSession,
    period: LeaderboardPeriod = Query(default="week"),
    game_type: GameType = Query(default="word_search", alias="gameType"),
):
    return await game_scores.get_leaderboard(db, period, game_type)


@router.post(
    "/feedback",
    response_model=FeedbackOut,
    status_code=201,
    dependencies=[Depends(rate_limit("feedback", 5, 3600))],
)
async def submit_feedback(body: FeedbackCreate, db: DbSession, user: OptionalUser):
    feedback = Feedback(
        author_id=user.id if user else None,
        author_name=user.display_name if user else None,
        title=body.title,
        content=body.content,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback


@router.get("/notifications", response_model=NotificationPage)
async def list_notifications(
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
):
    return await notifications.list_for_user(db, user.id, limit, offset)


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
    return await community.list_posts(
        db, user, cursor, limit, include_hidden=True, include_unapproved=True, pending_first=True
    )


class PostVisibility(BaseModel):
    hidden: bool


@router.patch("/admin/posts/{post_id}/visibility")
async def admin_post_visibility(post_id: uuid.UUID, body: PostVisibility, db: DbSession, user: CurrentUser):
    if user.role != "admin":
        raise AppError("Bạn không có quyền truy cập trang quản lý.", 403)
    post = await db.get(Post, post_id)
    if not post:
        raise AppError("Không tìm thấy bài đăng.", 404)
    post.hidden = body.hidden
    await db.commit()
    if body.hidden:
        await publish("post.deleted", postId=str(post_id))
    elif post.approved:
        restored = await community.get_post_out(db, post_id, None)
        await publish("post.created", post=restored.model_dump(mode="json", by_alias=True))
    return {"hidden": body.hidden}


@router.post("/admin/posts/{post_id}/approve", response_model=PostOut)
async def admin_approve_post(post_id: uuid.UUID, db: DbSession, user: CurrentUser):
    if user.role != "admin":
        raise AppError("Bạn không có quyền duyệt bài đăng.", 403)
    post = await db.get(Post, post_id)
    if not post:
        raise AppError("Không tìm thấy bài đăng.", 404)
    newly_approved = not post.approved
    if newly_approved:
        post.approved = True
        await db.commit()
    result = await community.get_post_out(db, post_id, user, include_hidden=True)
    if newly_approved and not post.hidden:
        notice_recipients = await notifications.notify_post_created(db, post.author, post.id)
        for recipient_id, unread_count in notice_recipients:
            await publish_to_user(str(recipient_id), "notification.created", unreadCount=unread_count)
        await publish("post.created", post=result.model_dump(mode="json", by_alias=True))
    return result


@router.delete("/admin/posts/{post_id}", response_model=MessageOut)
async def admin_delete_post(post_id: uuid.UUID, db: DbSession, user: CurrentUser):
    if user.role != "admin":
        raise AppError("Bạn không có quyền xóa bài viết này.", 403)
    await community.delete_post(db, user, post_id, allow_admin=True)
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
    images: Annotated[list[UploadFile] | None, File()] = None,
):
    enforce_limit(f"post:{user.id}", 20, 3600)
    uploaded_images = [*(images or []), *([image] if image else [])]
    post = await community.create_post(db, user, content, link_url, skip_preview, uploaded_images)
    if post.approved:
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
    if post.approved:
        await publish("post.updated", post=post.model_dump(mode="json", by_alias=True))
    else:
        await publish("post.deleted", postId=str(post_id))
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
    try:
        reply = await ai_content.reply_to_comment(db, post_id, user)
    except (AppError, SQLAlchemyError):
        logger.exception("Could not save an AI reply for post_id=%s", post_id)
        reply = None
    if reply:
        ai_comment, count = reply
        await publish(
            "comment.created",
            postId=str(post_id),
            commentCount=count,
            comment=ai_comment.model_dump(mode="json", by_alias=True),
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
