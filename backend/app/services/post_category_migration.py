"""One-time / idempotent AI category backfill for existing community posts and sources."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models import Post
from app.services.ai_content import detect_post_category, infer_post_category_fallback

logger = logging.getLogger("app.post_category_migration")


async def backfill_post_categories(
    db: AsyncSession,
    *,
    allow_fallback: bool = False,
) -> tuple[int, int]:
    """Scan posts without an AI category check and assign one of the six canonical categories."""
    pending = list(
        (
            await db.scalars(
                select(Post)
                .where(Post.category_checked_at.is_(None))
                .order_by(Post.created_at, Post.id)
            )
        ).all()
    )

    processed = categorized = 0
    for post in pending:
        try:
            detected = await detect_post_category(
                post.content,
                link_url=post.link_url,
                link_title=post.link_title,
                link_description=post.link_description,
                link_site=post.link_site,
            )
            post.category = detected
            post.category_checked_at = datetime.now(timezone.utc)
        except AppError as error:
            if not allow_fallback:
                raise
            logger.info(
                "AI unavailable during post category backfill for post_id=%s (%s); applying fallback",
                post.id,
                error.status_code,
            )
            post.category = infer_post_category_fallback(
                post.content,
                link_url=post.link_url,
                link_title=post.link_title,
                link_description=post.link_description,
                link_site=post.link_site,
            )
        await db.commit()
        processed += 1
        if post.category:
            categorized += 1

    return processed, categorized
