import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionFactory
from app.models import User
from app.services import ai_content
from tests.conftest import register


SOURCE_URL = "https://www.who.int/news/item/2026-01-01-health-information"
ARTICLE = {
    "title": "Thông tin sức khỏe đáng tin cậy",
    "content": (
        "Tổ chức Y tế Thế giới vừa công bố thông tin cập nhật về sức khỏe cộng đồng. "
        "Bài viết trình bày dữ kiện chính, giải thích bối cảnh và nêu những điểm người đọc "
        "có thể tham khảo trong sinh hoạt hằng ngày. Nội dung chỉ nhằm cung cấp kiến thức "
        "chung và khuyến khích người đọc tìm hiểu thêm từ nguồn chính thức."
    ),
}


def article_response(article=ARTICLE):
    return {
        "output": [{
            "type": "message",
            "content": [{"type": "output_text", "text": json.dumps(article, ensure_ascii=False)}],
        }]
    }


def candidate(url=SOURCE_URL, published_at=None):
    return ai_content.RSSCandidate(
        topic="health",
        title="World Health Organization article",
        url=url,
        description="A trusted public health update.",
        published_at=published_at or datetime.now(timezone.utc),
        source_domain="www.who.int",
    )


async def test_detect_activity_location_uses_structured_ai_output(monkeypatch):
    location = "Nhà văn hóa Thanh Niên, TP. Hồ Chí Minh"
    request = AsyncMock(return_value=article_response({"location": location}))
    monkeypatch.setattr(ai_content, "_request_response", request)

    detected = await ai_content.detect_activity_location(
        "Giao lưu cầu lông",
        "Gặp nhau tại Nhà văn hóa Thanh Niên, TP. Hồ Chí Minh.",
    )

    assert detected == location
    request.assert_awaited_once()
    request_args = request.await_args.kwargs
    assert request_args["schema_name"] == "activity_location"
    assert request_args["json_schema"]["required"] == ["location"]
    assert request_args["json_schema"]["additionalProperties"] is False


async def configure_preview(monkeypatch, candidates=None):
    monkeypatch.setattr(
        ai_content,
        "_rss_candidates",
        AsyncMock(return_value=[candidate()] if candidates is None else candidates),
    )
    monkeypatch.setattr(ai_content, "_request_response", AsyncMock(return_value=article_response()))


async def create_ai_post(client, headers, monkeypatch):
    await configure_preview(monkeypatch)
    preview = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=headers,
    )
    assert preview.status_code == 200, preview.text
    data = preview.json()
    posted = await client.post(
        "/api/admin/ai-posts/publish",
        json={
            "topic": data["topic"],
            "hours": data["hours"],
            "sourceUrl": data["sourceUrl"],
            "title": data["title"],
            "content": data["content"],
        },
        headers=headers,
    )
    assert posted.status_code == 201, posted.text
    return posted


async def test_admin_can_preview_edit_and_publish_pending_ai_post(client, monkeypatch):
    admin_csrf = await register(client)
    async with SessionFactory() as db:
        admin = await db.scalar(select(User).where(User.email == "a@bravesoft.com.vn"))
        admin.role = "admin"
        await db.commit()
    await configure_preview(monkeypatch)

    preview = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )

    assert preview.status_code == 200, preview.text
    data = preview.json()
    assert data["sourceUrl"] == SOURCE_URL
    assert data["sourceTitle"] == "World Health Organization article"
    assert data["hours"] == 4
    assert (await client.get("/api/posts")).json()["posts"] == []

    published = await client.post(
        "/api/admin/ai-posts/publish",
        json={
            "topic": data["topic"],
            "hours": data["hours"],
            "sourceUrl": data["sourceUrl"],
            "title": "Tiêu đề do admin chỉnh sửa",
            "content": "Nội dung đã được quản trị viên biên tập trước khi gửi đi duyệt. " * 3,
        },
        headers=admin_csrf,
    )

    assert published.status_code == 201, published.text
    post = published.json()
    assert post["author"]["displayName"] == "braveActive AI"
    assert post["approved"] is False
    assert post["content"].startswith("Tiêu đề do admin chỉnh sửa\n\n")
    assert post["linkPreview"]["url"] == SOURCE_URL
    assert (await client.get("/api/posts")).json()["posts"] == []


async def test_ai_preview_requires_admin_and_openai_key(client, monkeypatch):
    member_csrf = await register(client)
    denied = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=member_csrf,
    )
    assert denied.status_code == 403

    async with SessionFactory() as db:
        member = await db.scalar(select(User).where(User.email == "a@bravesoft.com.vn"))
        member.role = "admin"
        await db.commit()
    monkeypatch.setattr(ai_content, "_rss_candidates", AsyncMock(return_value=[candidate()]))
    settings = get_settings()
    monkeypatch.setattr(ai_content, "get_settings", lambda: settings.model_copy(update={"openai_api_key": ""}))
    response = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=member_csrf,
    )
    assert response.status_code == 503


async def test_preview_rejects_sources_outside_the_selected_feed_domains(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    await configure_preview(monkeypatch, [candidate("https://example.invalid/article")])

    response = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )

    assert response.status_code == 404


async def test_preview_skips_duplicate_urls_with_tracking_parameters(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    await configure_preview(monkeypatch)
    await create_ai_post(client, admin_csrf, monkeypatch)
    await configure_preview(monkeypatch, [candidate(f"{SOURCE_URL}?utm_source=newsletter#top")])

    response = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )

    assert response.status_code == 404


async def test_reload_excludes_sources_already_shown_in_the_dialog(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    older = candidate("https://www.who.int/news/older", datetime.now(timezone.utc) - timedelta(minutes=10))
    newest = candidate("https://www.who.int/news/newest", datetime.now(timezone.utc))
    await configure_preview(monkeypatch, [newest, older])

    first = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )
    second = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4, "excludeSourceUrls": [newest.url]},
        headers=admin_csrf,
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["sourceUrl"] == newest.url
    assert second.json()["sourceUrl"] == older.url


async def test_publish_revalidates_source_and_rejects_already_used_url(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    await configure_preview(monkeypatch)
    await create_ai_post(client, admin_csrf, monkeypatch)
    await configure_preview(monkeypatch, [candidate(f"{SOURCE_URL}?utm_campaign=duplicate")])

    response = await client.post(
        "/api/admin/ai-posts/publish",
        json={
            "topic": "health",
            "hours": 4,
            "sourceUrl": f"{SOURCE_URL}?utm_source=tracking",
            "title": ARTICLE["title"],
            "content": ARTICLE["content"],
        },
        headers=admin_csrf,
    )

    assert response.status_code == 409


async def test_rss_parser_extracts_article_metadata():
    now = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
    xml = b"""<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <item>
        <title>New AI update</title>
        <description><![CDATA[<p>A <b>new</b> product update.</p>]]></description>
        <link>https://techcrunch.com/article?utm_source=rss</link>
        <pubDate>Wed, 18 Nov 2026 11:30:00 +0000</pubDate>
      </item>
      <item>
        <title>Old update</title><link>https://techcrunch.com/old</link>
        <description>Older article summary.</description>
        <pubDate>Wed, 18 Nov 2026 07:00:00 +0000</pubDate>
      </item>
      <item>
        <title>Untrusted URL</title><link>https://evil.example/article</link>
        <pubDate>Wed, 18 Nov 2026 11:55:00 +0000</pubDate>
      </item>
    </channel></rss>"""

    items = ai_content._parse_feed(
        xml,
        "technology",
        "https://techcrunch.com/category/artificial-intelligence/feed/",
        now,
    )

    assert len(items) == 2
    assert items[0].title == "New AI update"
    assert items[0].description == "A new product update."
    assert items[0].published_at == datetime(2026, 11, 18, 11, 30, tzinfo=timezone.utc)


async def test_rss_candidate_filter_uses_item_published_time(monkeypatch):
    now = datetime.now(timezone.utc)
    recent = candidate("https://www.who.int/news/recent", now - timedelta(hours=2))
    old = candidate("https://www.who.int/news/old", now - timedelta(hours=6))
    monkeypatch.setattr(
        ai_content,
        "_fetch_feed",
        AsyncMock(return_value=[recent, old]),
    )

    items = await ai_content._rss_candidates("health", 4, now=now)

    assert [item.url for item in items] == [recent.url]


def test_source_url_normalization_only_removes_tracking_and_fragment():
    assert ai_content.normalize_source_url(
        "https://Example.com/article?utm_source=rss&id=5&fbclid=tracking#section"
    ) == "https://example.com/article?id=5"


async def test_openai_request_uses_configured_model_and_schema(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(
        ai_content,
        "get_settings",
        lambda: settings.model_copy(update={"openai_api_key": "test-key"}),
    )
    captured = {}

    class FakeResponse:
        is_error = False

        def json(self):
            return {"output": []}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, url, **kwargs):
            captured.update(kwargs["json"])
            return FakeResponse()

    monkeypatch.setattr(ai_content.httpx, "AsyncClient", lambda **_: FakeClient())

    await ai_content._request_response(
        "Summarize this RSS article.",
        json_schema={"type": "object", "properties": {"title": {"type": "string"}}},
    )

    assert captured["model"] == settings.openai_model
    assert captured["text"]["format"]["type"] == "json_schema"
    assert "tools" not in captured


async def test_comment_on_approved_ai_post_gets_automatic_ai_reply(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    generated = await create_ai_post(client, admin_csrf, monkeypatch)
    post_id = generated.json()["id"]
    approved = await client.post(f"/api/admin/posts/{post_id}/approve", headers=admin_csrf)
    assert approved.status_code == 200

    await client.post("/api/auth/logout", headers=admin_csrf)
    member_csrf = await register(client, "member@bravesoft.com.vn", "Member")
    settings = get_settings()
    monkeypatch.setattr(ai_content, "get_settings", lambda: settings.model_copy(update={"openai_api_key": "test-key"}))
    monkeypatch.setattr(
        ai_content,
        "_request_response",
        AsyncMock(
            return_value={
                "output": [{
                    "type": "message",
                    "content": [{"type": "output_text", "text": "Cảm ơn bạn đã đặt câu hỏi! Đây là thông tin hữu ích."}],
                }]
            }
        ),
    )

    response = await client.post(
        f"/api/posts/{post_id}/comments",
        json={"content": "Bạn có thể chia sẻ thêm thông tin không?"},
        headers=member_csrf,
    )
    assert response.status_code == 201, response.text
    assert response.json()["commentCount"] == 2
    comments = (await client.get(f"/api/posts/{post_id}/comments")).json()
    assert [comment["author"]["displayName"] for comment in comments] == ["Member", "braveActive AI"]


async def test_regular_post_comments_do_not_call_openai(client, monkeypatch):
    member_csrf = await register(client)
    await promote_admin()
    post = await client.post("/api/posts", data={"content": "A member post"}, headers=member_csrf)
    request = AsyncMock()
    monkeypatch.setattr(ai_content, "_request_response", request)

    response = await client.post(
        f"/api/posts/{post.json()['id']}/comments",
        json={"content": "Nice post."},
        headers=member_csrf,
    )

    assert response.status_code == 201
    request.assert_not_awaited()


async def test_comment_on_ai_post_succeeds_when_openai_key_is_missing(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    generated = await create_ai_post(client, admin_csrf, monkeypatch)
    post_id = generated.json()["id"]
    await client.post(f"/api/admin/posts/{post_id}/approve", headers=admin_csrf)
    monkeypatch.setattr(
        ai_content,
        "get_settings",
        lambda: get_settings().model_copy(update={"openai_api_key": ""}),
    )

    response = await client.post(
        f"/api/posts/{post_id}/comments",
        json={"content": "Cảm ơn bài viết."},
        headers=admin_csrf,
    )

    assert response.status_code == 201
    comments = (await client.get(f"/api/posts/{post_id}/comments")).json()
    assert len(comments) == 1


async def promote_admin():
    async with SessionFactory() as db:
        user = await db.scalar(select(User).where(User.email == "a@bravesoft.com.vn"))
        user.role = "admin"
        await db.commit()
