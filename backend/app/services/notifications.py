"""Persistent notification creation, listing and read-state management."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification, Post, PostComment, PostLike, User
from app.schemas.notifications import NotificationOut, NotificationPage

MAX_VISIBLE_NOTIFICATIONS = 50


def _out(item: Notification) -> NotificationOut:
    return NotificationOut.model_validate(item)


async def unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    return int(
        await db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.recipient_id == user_id, Notification.read_at.is_(None))
        )
        or 0
    )


async def list_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 10,
    offset: int = 0,
) -> NotificationPage:
    limit = max(1, min(limit, MAX_VISIBLE_NOTIFICATIONS))
    result = await db.scalars(
        select(Notification)
        .where(Notification.recipient_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset(max(0, offset))
        .limit(limit + 1)
    )
    rows = list(result)
    return NotificationPage(
        notifications=[_out(item) for item in rows[:limit]],
        unread_count=await unread_count(db, user_id),
        has_more=len(rows) > limit,
    )


async def mark_read(db: AsyncSession, user_id: uuid.UUID, notification_ids: list[uuid.UUID]) -> int:
    if not notification_ids:
        return await unread_count(db, user_id)
    await db.execute(
        update(Notification)
        .where(
            Notification.recipient_id == user_id,
            Notification.id.in_(notification_ids[:MAX_VISIBLE_NOTIFICATIONS]),
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return await unread_count(db, user_id)


async def create_for_recipients(
    db: AsyncSession,
    recipient_ids: set[uuid.UUID],
    actor: User,
    kind: str,
    post_id: uuid.UUID | None,
    context: str,
) -> list[tuple[uuid.UUID, int]]:
    recipient_ids.discard(actor.id)
    if not recipient_ids:
        return []
    records = [
        Notification(
            recipient_id=recipient_id,
            actor_id=actor.id,
            actor_name=actor.display_name,
            kind=kind,
            post_id=post_id,
            context=context[:240],
        )
        for recipient_id in recipient_ids
    ]
    db.add_all(records)
    await db.commit()
    counts = await db.execute(
        select(Notification.recipient_id, func.count())
        .where(Notification.recipient_id.in_(recipient_ids), Notification.read_at.is_(None))
        .group_by(Notification.recipient_id)
    )
    unread_by_user = dict(counts.all())
    return [(recipient_id, unread_by_user.get(recipient_id, 0)) for recipient_id in recipient_ids]


async def notify_post_created(
    db: AsyncSession,
    actor: User,
    post_id: uuid.UUID,
) -> list[tuple[uuid.UUID, int]]:
    post = await db.get(Post, post_id)
    if not post:
        return []
    recipients = set(
        await db.scalars(
            select(User.id).where(User.id != actor.id, User.is_active.is_(True))
        )
    )
    context = post.content.strip() or "photo"
    return await create_for_recipients(db, recipients, actor, "new_post", post.id, context)


async def _post_audience(db: AsyncSession, post_id: uuid.UUID, actor_id: uuid.UUID) -> tuple[uuid.UUID | None, set[uuid.UUID]]:
    post = await db.get(Post, post_id)
    if not post:
        return None, set()
    audience = {post.author_id}
    audience.update(
        await db.scalars(select(PostLike.user_id).where(PostLike.post_id == post_id))
    )
    audience.update(
        await db.scalars(select(PostComment.author_id).where(PostComment.post_id == post_id))
    )
    audience.discard(actor_id)
    return post.author_id, audience


async def notify_post_liked(
    db: AsyncSession,
    actor: User,
    post_id: uuid.UUID,
) -> list[tuple[uuid.UUID, int]]:
    owner_id, audience = await _post_audience(db, post_id, actor.id)
    if owner_id is None:
        return []
    post = await db.get(Post, post_id)
    context = (post.content.strip() if post else "") or "photo"
    own_post = {owner_id} & audience
    followed_post = audience - own_post
    return (
        await create_for_recipients(db, own_post, actor, "post_liked_own", post_id, context)
        + await create_for_recipients(db, followed_post, actor, "post_liked_followed", post_id, context)
    )


async def notify_comment_created(
    db: AsyncSession,
    actor: User,
    post_id: uuid.UUID,
    content: str,
) -> list[tuple[uuid.UUID, int]]:
    owner_id, audience = await _post_audience(db, post_id, actor.id)
    if owner_id is None:
        return []
    own_post = {owner_id} & audience
    followed_post = audience - own_post
    return (
        await create_for_recipients(
            db, own_post, actor, "post_commented_own", post_id, content
        )
        + await create_for_recipients(
            db, followed_post, actor, "post_commented_followed", post_id, content
        )
    )


async def _create_for_admins(
    db: AsyncSession,
    actor_id: uuid.UUID | None,
    actor_name: str,
    kind: str,
    post_id: uuid.UUID | None,
    context: str,
) -> list[tuple[uuid.UUID, int]]:
    admin_ids = set(
        await db.scalars(
            select(User.id).where(User.role == "admin", User.is_active.is_(True))
        )
    )
    if actor_id is not None:
        admin_ids.discard(actor_id)
    if not admin_ids:
        return []
    safe_actor_name = (actor_name.strip() or "Member")[:40]
    records = [
        Notification(
            recipient_id=admin_id,
            actor_id=actor_id,
            actor_name=safe_actor_name,
            kind=kind,
            post_id=post_id,
            context=context.strip()[:240],
        )
        for admin_id in admin_ids
    ]
    db.add_all(records)
    await db.commit()
    counts = await db.execute(
        select(Notification.recipient_id, func.count())
        .where(Notification.recipient_id.in_(admin_ids), Notification.read_at.is_(None))
        .group_by(Notification.recipient_id)
    )
    unread_by_user = dict(counts.all())
    return [(admin_id, unread_by_user.get(admin_id, 0)) for admin_id in admin_ids]


async def notify_admins_pending_post(
    db: AsyncSession,
    actor: User,
    post_id: uuid.UUID,
    context: str,
) -> list[tuple[uuid.UUID, int]]:
    return await _create_for_admins(
        db,
        actor.id,
        actor.display_name,
        "admin_pending_post",
        post_id,
        context.strip() or "photo",
    )


async def notify_admins_pending_request(
    db: AsyncSession,
    actor_name: str,
    email: str,
    purpose: str,
) -> list[tuple[uuid.UUID, int]]:
    label = f"{purpose}:{email}" if purpose else email
    return await _create_for_admins(
        db,
        None,
        actor_name or email.split("@", 1)[0],
        "admin_pending_request",
        None,
        label,
    )


async def notify_admins_pending_activity(
    db: AsyncSession,
    actor: User,
    title: str,
) -> list[tuple[uuid.UUID, int]]:
    return await _create_for_admins(
        db,
        actor.id,
        actor.display_name,
        "admin_pending_activity",
        None,
        title,
    )
