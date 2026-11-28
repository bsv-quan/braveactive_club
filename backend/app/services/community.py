"""Community feed business logic: queries, post/comment/like mutations."""

import uuid
from datetime import datetime

from fastapi import UploadFile
from sqlalchemy import and_, delete, exists, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.permissions import can_manage
from app.models import Post, PostComment, PostLike, User
from app.schemas.community import (
    POST_CATEGORIES,
    AuthorOut,
    CommentOut,
    LinkPreviewOut,
    PostCategory,
    PostOut,
    PostPage,
)
from app.services import uploads
from app.services.link_preview import extract_first_url, get_link_preview, normalize_url

MAX_POST_LENGTH = 2000
PAGE_SIZE_MAX = 30
MAX_POST_IMAGES = 4
MAX_SEARCH_TOKENS = 6

_VN_LOWER = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ"
_VN_UPPER = _VN_LOWER.upper()
_VN_ASCII = (
    "a" * 17
    + "e" * 11
    + "i" * 5
    + "o" * 17
    + "u" * 11
    + "y" * 5
    + "d"
)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _sql_casefold(column):
    return func.translate(func.lower(func.coalesce(column, "")), _VN_UPPER, _VN_LOWER)


def _sql_unaccent(column):
    return func.translate(
        func.lower(func.coalesce(column, "")),
        _VN_LOWER + _VN_UPPER,
        _VN_ASCII + _VN_ASCII,
    )


def _build_search_filter(raw_query: str):
    tokens = [token for token in raw_query.strip().split() if token][:MAX_SEARCH_TOKENS]
    if not tokens:
        return None
    token_clauses = []
    for token in tokens:
        lowered = token.lower()
        escaped = _escape_like(lowered)
        pattern = f"%{escaped}%"
        transform = _sql_unaccent if lowered.isascii() else _sql_casefold
        token_clauses.append(
            or_(
                transform(Post.content).like(pattern, escape="\\"),
                transform(Post.link_title).like(pattern, escape="\\"),
                transform(Post.link_description).like(pattern, escape="\\"),
                transform(Post.link_site).like(pattern, escape="\\"),
                Post.author.has(transform(User.display_name).like(pattern, escape="\\")),
            )
        )
    return and_(*token_clauses)


async def _assign_post_category(post: Post) -> None:
    from app.services import ai_content

    detected_category, checked_at = await ai_content.classify_post_category(
        post.content,
        link_url=post.link_url,
        link_title=post.link_title,
        link_description=post.link_description,
        link_site=post.link_site,
    )
    post.category = detected_category
    post.category_checked_at = checked_at


def image_url(name: str | None) -> str | None:
    return f"/media/{name}" if name else None


def _like_count_query():
    return select(func.count()).select_from(PostLike).where(PostLike.post_id == Post.id).scalar_subquery()


def _comment_count_query():
    return select(func.count()).select_from(PostComment).where(PostComment.post_id == Post.id).scalar_subquery()


def _liked_by_query(user: User | None):
    if user is None:
        return None
    return exists().where(and_(PostLike.post_id == Post.id, PostLike.user_id == user.id))


def _select_posts(viewer: User | None):
    liked = _liked_by_query(viewer)
    columns = [Post, _like_count_query().label("like_count"), _comment_count_query().label("comment_count")]
    if liked is not None:
        columns.append(liked.label("liked_by_me"))
    return select(*columns)


def to_post_out(row, viewer: User | None) -> PostOut:
    post: Post = row[0]
    preview = (
        LinkPreviewOut(
            url=post.link_url,
            title=post.link_title,
            description=post.link_description,
            image=post.link_image,
            site=post.link_site,
        )
        if post.link_url and (post.link_title or post.link_image or post.link_description)
        else None
    )
    return PostOut(
        id=post.id,
        author=AuthorOut(
            id=post.author.id,
            display_name=post.author.display_name,
            avatar_url=post.author.avatar_url,
        ),
        content=post.content,
        category=post.category if post.category in POST_CATEGORIES else None,
        image_url=(
            image_url((post.image_names or [post.image_name])[0])
            if (post.image_names or post.image_name)
            else None
        ),
        image_urls=[
            url
            for name in (post.image_names or ([post.image_name] if post.image_name else []))
            if (url := image_url(name)) is not None
        ],
        link_preview=preview,
        like_count=row.like_count,
        comment_count=row.comment_count,
        liked_by_me=bool(row.liked_by_me) if viewer else False,
        created_at=post.created_at,
        approved=post.approved,
        hidden=post.hidden,
    )


def _encode_cursor(post: Post, pending_first: bool = False) -> str:
    prefix = f"{int(post.approved)}|" if pending_first else ""
    return f"{prefix}{post.created_at.isoformat()}|{post.id}"


def _decode_cursor(cursor: str, pending_first: bool = False) -> tuple[bool | None, datetime, uuid.UUID]:
    try:
        if pending_first:
            approved, created, post_id = cursor.split("|", 2)
            if approved not in {"0", "1"}:
                raise ValueError
            return approved == "1", datetime.fromisoformat(created), uuid.UUID(post_id)
        created, post_id = cursor.split("|", 1)
        return None, datetime.fromisoformat(created), uuid.UUID(post_id)
    except ValueError:
        raise AppError("Con trỏ phân trang không hợp lệ.", 400) from None


async def list_posts(
    db: AsyncSession,
    viewer: User | None,
    cursor: str | None,
    limit: int,
    include_hidden: bool = False,
    include_unapproved: bool = False,
    pending_first: bool = False,
    category: PostCategory | None = None,
    search_query: str | None = None,
) -> PostPage:
    limit = max(1, min(limit, PAGE_SIZE_MAX))
    query = _select_posts(viewer)
    if not include_hidden:
        query = query.where(Post.hidden.is_(False))
    if not include_unapproved:
        query = query.where(Post.approved.is_(True))
    if category is not None:
        query = query.where(Post.category == category)
    if search_query:
        search_clause = _build_search_filter(search_query)
        if search_clause is not None:
            query = query.where(search_clause)
    if cursor:
        approved, created_at, post_id = _decode_cursor(cursor, pending_first)
        after_cursor = or_(Post.created_at < created_at, and_(Post.created_at == created_at, Post.id < post_id))
        if pending_first and approved is not None:
            if approved:
                query = query.where(and_(Post.approved.is_(True), after_cursor))
            else:
                query = query.where(
                    or_(
                        Post.approved.is_(True),
                        and_(Post.approved.is_(False), after_cursor),
                    )
                )
        else:
            query = query.where(after_cursor)
    if pending_first:
        query = query.order_by(Post.approved.asc(), Post.created_at.desc(), Post.id.desc())
    else:
        query = query.order_by(Post.created_at.desc(), Post.id.desc())
    query = query.limit(limit + 1)
    rows = (await db.execute(query)).all()
    page = rows[:limit]
    next_cursor = _encode_cursor(page[-1][0], pending_first) if len(rows) > limit else None
    return PostPage(posts=[to_post_out(row, viewer) for row in page], next_cursor=next_cursor)


async def get_post_out(
    db: AsyncSession,
    post_id: uuid.UUID,
    viewer: User | None,
    include_hidden: bool = False,
) -> PostOut:
    query = _select_posts(viewer).where(Post.id == post_id)
    if not include_hidden:
        query = query.where(Post.hidden.is_(False))
    row = (await db.execute(query)).first()
    if not row:
        raise AppError("Không tìm thấy bài đăng.", 404)
    post: Post = row[0]
    if not post.approved and not (
        viewer and (viewer.role == "admin" or viewer.id == post.author_id)
    ):
        raise AppError("Không tìm thấy bài đăng.", 404)
    return to_post_out(row, viewer)


async def create_post(
    db: AsyncSession,
    user: User,
    content: str,
    link_url: str | None,
    skip_preview: bool,
    images: list[UploadFile],
) -> PostOut:
    content = content.strip()
    if len(content) > MAX_POST_LENGTH:
        raise AppError(f"Nội dung tối đa {MAX_POST_LENGTH} ký tự.", 400)
    image_uploads = [image for image in images if image.filename]
    if len(image_uploads) > MAX_POST_IMAGES:
        raise AppError(f"Mỗi bài đăng chỉ được đính kèm tối đa {MAX_POST_IMAGES} ảnh.", 400)
    if not content and not image_uploads:
        raise AppError("Hãy nhập nội dung hoặc chọn một ảnh.", 400)

    post = Post(author_id=user.id, content=content, approved=user.role == "admin")

    # Link preview is skipped when the user dismissed it or attached an image.
    if not image_uploads and not skip_preview:
        raw_url = link_url or extract_first_url(content)
        if raw_url:
            try:
                preview = await get_link_preview(normalize_url(raw_url))
            except AppError:
                preview = None  # A failing preview must never block posting.
            if preview:
                post.link_url = preview.url
                post.link_title = preview.title
                post.link_description = preview.description
                post.link_image = preview.image
                post.link_site = preview.site

    await _assign_post_category(post)

    saved_images: list[str] = []
    try:
        for image in image_uploads:
            saved_images.append(await uploads.save_image(image))
        post.image_names = saved_images
        db.add(post)
        await db.commit()
    except Exception:
        for name in saved_images:
            uploads.delete_image(name)
        raise
    return await get_post_out(db, post.id, user)


async def delete_post(
    db: AsyncSession,
    user: User,
    post_id: uuid.UUID,
    *,
    allow_admin: bool = False,
) -> None:
    post = await db.get(Post, post_id)
    if not post or (post.hidden and user.role != "admin"):
        raise AppError("Không tìm thấy bài đăng.", 404)
    if post.author_id != user.id and not (allow_admin and user.role == "admin"):
        raise AppError("Bạn không có quyền xóa bài đăng này.", 403)
    image_names = list(dict.fromkeys([*(post.image_names or []), post.image_name]))
    await db.delete(post)
    await db.commit()
    for image_name in image_names:
        uploads.delete_image(image_name)


async def update_post(db: AsyncSession, user: User, post_id: uuid.UUID, content: str) -> PostOut:
    post = await db.get(Post, post_id)
    if not post or post.hidden:
        raise AppError("Không tìm thấy bài đăng.", 404)
    if user.id != post.author_id:
        raise AppError("Bạn không có quyền sửa bài đăng này.", 403)
    content = content.strip()
    if len(content) > MAX_POST_LENGTH:
        raise AppError(f"Nội dung tối đa {MAX_POST_LENGTH} ký tự.", 400)
    has_images = bool(post.image_names or post.image_name)
    if not content and not has_images:
        raise AppError("Bài đăng cần có nội dung hoặc ảnh.", 400)

    post.content = content
    if user.role != "admin":
        post.approved = False
    post.link_url = None
    post.link_title = None
    post.link_description = None
    post.link_image = None
    post.link_site = None
    if not has_images:
        raw_url = extract_first_url(content)
        if raw_url:
            try:
                preview = await get_link_preview(normalize_url(raw_url))
            except AppError:
                preview = None
            if preview:
                post.link_url = preview.url
                post.link_title = preview.title
                post.link_description = preview.description
                post.link_image = preview.image
                post.link_site = preview.site
    await _assign_post_category(post)
    await db.commit()
    return await get_post_out(db, post_id, user)


async def _like_count(db: AsyncSession, post_id: uuid.UUID) -> int:
    return await db.scalar(select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)) or 0


async def set_like(
    db: AsyncSession,
    user: User,
    post_id: uuid.UUID,
    liked: bool,
) -> tuple[int, bool, bool]:
    """Idempotently like/unlike a post; returns count, current state, and whether it was newly liked."""
    if not await db.scalar(
        select(Post.id).where(Post.id == post_id, Post.hidden.is_(False), Post.approved.is_(True))
    ):
        raise AppError("Không tìm thấy bài đăng.", 404)
    if liked:
        result = await db.execute(
            pg_insert(PostLike)
            .values(post_id=post_id, user_id=user.id)
            .on_conflict_do_nothing()
            .returning(PostLike.user_id)
        )
        added = result.scalar_one_or_none() is not None
    else:
        await db.execute(delete(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id))
        added = False
    await db.commit()
    return await _like_count(db, post_id), liked, added


async def list_post_likes(
    db: AsyncSession,
    post_id: uuid.UUID,
    viewer: User | None,
) -> list[dict]:
    """Return members who liked a visible post, newest likes first."""
    post = await db.get(Post, post_id)
    if not post:
        raise AppError("Không tìm thấy bài đăng.", 404)
    is_admin = bool(viewer and viewer.role == "admin")
    is_owner = bool(viewer and viewer.id == post.author_id)
    if post.hidden and not is_admin:
        raise AppError("Không tìm thấy bài đăng.", 404)
    if not post.approved and not (is_admin or is_owner):
        raise AppError("Không tìm thấy bài đăng.", 404)

    rows = await db.execute(
        select(
            User.id,
            User.display_name,
            User.avatar_name,
            PostLike.created_at,
        )
        .join(PostLike, PostLike.user_id == User.id)
        .where(PostLike.post_id == post_id)
        .order_by(PostLike.created_at.desc(), User.display_name.asc())
        .limit(200)
    )
    return [
        {
            "id": row.id,
            "display_name": row.display_name,
            "avatar_url": f"/media/{row.avatar_name}" if row.avatar_name else None,
            "liked_at": row.created_at,
        }
        for row in rows
    ]


def to_comment_out(comment: PostComment) -> CommentOut:
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        author=AuthorOut(
            id=comment.author.id,
            display_name=comment.author.display_name,
            avatar_url=comment.author.avatar_url,
        ),
        content=comment.content,
        created_at=comment.created_at,
    )


async def list_comments(db: AsyncSession, post_id: uuid.UUID) -> list[CommentOut]:
    if not await db.scalar(
        select(Post.id).where(Post.id == post_id, Post.hidden.is_(False), Post.approved.is_(True))
    ):
        raise AppError("Không tìm thấy bài đăng.", 404)
    rows = await db.scalars(
        select(PostComment).where(PostComment.post_id == post_id).order_by(PostComment.created_at).limit(500)
    )
    return [to_comment_out(comment) for comment in rows.unique()]


async def add_comment(db: AsyncSession, user: User, post_id: uuid.UUID, content: str) -> tuple[CommentOut, int]:
    if not await db.scalar(
        select(Post.id).where(Post.id == post_id, Post.hidden.is_(False), Post.approved.is_(True))
    ):
        raise AppError("Không tìm thấy bài đăng.", 404)
    comment = PostComment(post_id=post_id, author_id=user.id, content=content)
    db.add(comment)
    await db.commit()
    await db.refresh(comment, attribute_names=["author"])
    count = await db.scalar(select(func.count()).select_from(PostComment).where(PostComment.post_id == post_id))
    return to_comment_out(comment), count or 0


async def delete_comment(db: AsyncSession, user: User, post_id: uuid.UUID, comment_id: uuid.UUID) -> int:
    comment = await db.scalar(
        select(PostComment).join(Post, Post.id == PostComment.post_id).where(PostComment.id == comment_id, PostComment.post_id == post_id, Post.hidden.is_(False))
    )
    if not comment:
        raise AppError("Không tìm thấy bình luận.", 404)
    if not can_manage(user, comment.author_id):
        raise AppError("Bạn không có quyền xóa bình luận này.", 403)
    await db.delete(comment)
    await db.commit()
    count = await db.scalar(select(func.count()).select_from(PostComment).where(PostComment.post_id == post_id))
    return count or 0


async def update_comment(
    db: AsyncSession,
    user: User,
    post_id: uuid.UUID,
    comment_id: uuid.UUID,
    content: str,
) -> CommentOut:
    comment = await db.scalar(
        select(PostComment).join(Post, Post.id == PostComment.post_id).where(PostComment.id == comment_id, PostComment.post_id == post_id, Post.hidden.is_(False))
    )
    if not comment:
        raise AppError("Không tìm thấy bình luận.", 404)
    if not can_manage(user, comment.author_id):
        raise AppError("Bạn không có quyền sửa bình luận này.", 403)
    comment.content = content.strip()
    await db.commit()
    await db.refresh(comment, attribute_names=["author"])
    return to_comment_out(comment)
