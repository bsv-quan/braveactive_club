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
from app.schemas.community import AuthorOut, CommentOut, LinkPreviewOut, PostOut, PostPage
from app.services import uploads
from app.services.link_preview import extract_first_url, get_link_preview, normalize_url

MAX_POST_LENGTH = 2000
PAGE_SIZE_MAX = 30


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
        image_url=image_url(post.image_name),
        link_preview=preview,
        like_count=row.like_count,
        comment_count=row.comment_count,
        liked_by_me=bool(row.liked_by_me) if viewer else False,
        created_at=post.created_at,
    )


def _encode_cursor(post: Post) -> str:
    return f"{post.created_at.isoformat()}|{post.id}"


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        created, post_id = cursor.split("|", 1)
        return datetime.fromisoformat(created), uuid.UUID(post_id)
    except ValueError:
        raise AppError("Con trỏ phân trang không hợp lệ.", 400) from None


async def list_posts(db: AsyncSession, viewer: User | None, cursor: str | None, limit: int) -> PostPage:
    limit = max(1, min(limit, PAGE_SIZE_MAX))
    query = _select_posts(viewer).order_by(Post.created_at.desc(), Post.id.desc()).limit(limit + 1)
    if cursor:
        created_at, post_id = _decode_cursor(cursor)
        query = query.where(or_(Post.created_at < created_at, and_(Post.created_at == created_at, Post.id < post_id)))
    rows = (await db.execute(query)).all()
    page = rows[:limit]
    next_cursor = _encode_cursor(page[-1][0]) if len(rows) > limit else None
    return PostPage(posts=[to_post_out(row, viewer) for row in page], next_cursor=next_cursor)


async def get_post_out(db: AsyncSession, post_id: uuid.UUID, viewer: User | None) -> PostOut:
    row = (await db.execute(_select_posts(viewer).where(Post.id == post_id))).first()
    if not row:
        raise AppError("Không tìm thấy bài đăng.", 404)
    return to_post_out(row, viewer)


async def create_post(
    db: AsyncSession,
    user: User,
    content: str,
    link_url: str | None,
    skip_preview: bool,
    image: UploadFile | None,
) -> PostOut:
    content = content.strip()
    if len(content) > MAX_POST_LENGTH:
        raise AppError(f"Nội dung tối đa {MAX_POST_LENGTH} ký tự.", 400)
    has_image = image is not None and bool(image.filename)
    if not content and not has_image:
        raise AppError("Hãy nhập nội dung hoặc chọn một ảnh.", 400)

    post = Post(author_id=user.id, content=content)

    # Link preview is skipped when the user dismissed it or attached an image.
    if not has_image and not skip_preview:
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

    if has_image:
        post.image_name = await uploads.save_image(image)
    try:
        db.add(post)
        await db.commit()
    except Exception:
        uploads.delete_image(post.image_name)
        raise
    return await get_post_out(db, post.id, user)


async def delete_post(db: AsyncSession, user: User, post_id: uuid.UUID) -> None:
    post = await db.get(Post, post_id)
    if not post:
        raise AppError("Không tìm thấy bài đăng.", 404)
    if not can_manage(user, post.author_id):
        raise AppError("Bạn không có quyền xóa bài đăng này.", 403)
    image_name = post.image_name
    await db.delete(post)
    await db.commit()
    uploads.delete_image(image_name)


async def update_post(db: AsyncSession, user: User, post_id: uuid.UUID, content: str) -> PostOut:
    post = await db.get(Post, post_id)
    if not post:
        raise AppError("Không tìm thấy bài đăng.", 404)
    if not can_manage(user, post.author_id):
        raise AppError("Bạn không có quyền sửa bài đăng này.", 403)
    content = content.strip()
    if len(content) > MAX_POST_LENGTH:
        raise AppError(f"Nội dung tối đa {MAX_POST_LENGTH} ký tự.", 400)
    if not content and not post.image_name:
        raise AppError("Bài đăng cần có nội dung hoặc ảnh.", 400)

    post.content = content
    post.link_url = None
    post.link_title = None
    post.link_description = None
    post.link_image = None
    post.link_site = None
    if not post.image_name:
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
    if not await db.scalar(select(Post.id).where(Post.id == post_id)):
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
    if not await db.scalar(select(Post.id).where(Post.id == post_id)):
        raise AppError("Không tìm thấy bài đăng.", 404)
    rows = await db.scalars(
        select(PostComment).where(PostComment.post_id == post_id).order_by(PostComment.created_at).limit(500)
    )
    return [to_comment_out(comment) for comment in rows.unique()]


async def add_comment(db: AsyncSession, user: User, post_id: uuid.UUID, content: str) -> tuple[CommentOut, int]:
    if not await db.scalar(select(Post.id).where(Post.id == post_id)):
        raise AppError("Không tìm thấy bài đăng.", 404)
    comment = PostComment(post_id=post_id, author_id=user.id, content=content)
    db.add(comment)
    await db.commit()
    await db.refresh(comment, attribute_names=["author"])
    count = await db.scalar(select(func.count()).select_from(PostComment).where(PostComment.post_id == post_id))
    return to_comment_out(comment), count or 0


async def delete_comment(db: AsyncSession, user: User, post_id: uuid.UUID, comment_id: uuid.UUID) -> int:
    comment = await db.scalar(
        select(PostComment).where(PostComment.id == comment_id, PostComment.post_id == post_id)
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
        select(PostComment).where(PostComment.id == comment_id, PostComment.post_id == post_id)
    )
    if not comment:
        raise AppError("Không tìm thấy bình luận.", 404)
    if not can_manage(user, comment.author_id):
        raise AppError("Bạn không có quyền sửa bình luận này.", 403)
    comment.content = content.strip()
    await db.commit()
    await db.refresh(comment, attribute_names=["author"])
    return to_comment_out(comment)
