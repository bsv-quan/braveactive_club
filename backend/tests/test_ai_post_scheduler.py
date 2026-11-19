from datetime import datetime
from unittest.mock import AsyncMock
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.db.session import SessionFactory
from app.models import AIPostScheduleRun, Post, User
from app.services import ai_content, ai_post_scheduler

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def technology_candidate():
    return ai_content.RSSCandidate(
        topic="technology",
        title="New AI technology research",
        url="https://techcrunch.com/2026/11/19/new-ai-research/",
        description="A recent report about artificial intelligence research.",
        published_at=datetime(2026, 11, 19, 5, 15, tzinfo=VIETNAM_TZ),
        source_domain="techcrunch.com",
    )


async def test_ai_scheduler_publishes_the_1730_ai_slot_once(monkeypatch):
    monkeypatch.setattr(
        ai_content,
        "_rss_candidates",
        AsyncMock(return_value=[technology_candidate()]),
    )
    monkeypatch.setattr(
        ai_content,
        "_generate_article",
        AsyncMock(
            return_value=ai_content.ArticleDraft(
                title="Nghiên cứu AI mới",
                content="Một báo cáo mới trình bày nghiên cứu về trí tuệ nhân tạo và các ứng dụng kỹ thuật liên quan. " * 2,
            )
        ),
    )
    now = datetime(2026, 11, 19, 17, 31, tzinfo=VIETNAM_TZ)

    completed = await ai_post_scheduler.run_due_ai_post_slots(now)
    duplicate_run = await ai_post_scheduler.run_due_ai_post_slots(now)

    assert completed == 1
    assert duplicate_run == 0
    ai_content._rss_candidates.assert_awaited_once_with(
        "technology",
        4,
        now=now,
        topics=("technology",),
        ai_technology_only=True,
    )
    async with SessionFactory() as db:
        run = await db.scalar(
            select(AIPostScheduleRun).where(
                AIPostScheduleRun.slot_date == now.date(),
                AIPostScheduleRun.slot_key == "technology-ai-1730",
            )
        )
        posts_count = await db.scalar(select(func.count()).select_from(Post))
        post = await db.scalar(select(Post))
        author = await db.scalar(select(User).where(User.id == post.author_id))

    assert run.status == "posted"
    assert run.post_id == post.id
    assert posts_count == 1
    assert post.approved is False
    assert author.display_name == "braveActive AI"


async def test_ai_scheduler_does_not_run_before_a_slot(monkeypatch):
    fetch = AsyncMock()
    monkeypatch.setattr(ai_content, "_rss_candidates", fetch)

    completed = await ai_post_scheduler.run_due_ai_post_slots(
        datetime(2026, 11, 19, 17, 29, tzinfo=VIETNAM_TZ)
    )

    assert completed == 0
    fetch.assert_not_awaited()


async def test_ai_technology_slot_uses_only_ai_feeds(monkeypatch):
    fetched_urls = []
    now = datetime(2026, 11, 19, 17, 31, tzinfo=VIETNAM_TZ)

    async def fetch(url, topic, requested_now):
        fetched_urls.append(url)
        return []

    monkeypatch.setattr(ai_content, "_fetch_feed", fetch)

    await ai_content._rss_candidates(
        "technology",
        4,
        now=now,
        topics=("technology",),
        ai_technology_only=True,
    )

    assert fetched_urls == list(ai_content.AI_TECH_FEEDS)
