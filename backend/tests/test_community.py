import io
from unittest.mock import AsyncMock

from PIL import Image
from sqlalchemy import select

from app.db.session import SessionFactory
from app.models import User
from app.services import community
from app.services.link_preview import LinkPreview
from tests.conftest import register


async def promote_to_admin(email="a@bravesoft.com.vn"):
    async with SessionFactory() as db:
        user = await db.scalar(select(User).where(User.email == email))
        user.role = "admin"
        await db.commit()


def png_bytes(size=(40, 30)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buffer, "PNG")
    return buffer.getvalue()


async def test_guest_can_read_but_not_write(client):
    assert (await client.get("/api/posts")).json() == {"posts": [], "nextCursor": None}
    assert (await client.post("/api/posts", data={"content": "hi"})).status_code == 401


async def test_guest_can_open_shared_post_and_comments(client):
    csrf = await register(client)
    await promote_to_admin()
    post = await client.post("/api/posts", data={"content": "Shared post"}, headers=csrf)
    post_id = post.json()["id"]
    await client.post(
        f"/api/posts/{post_id}/comments",
        json={"content": "Visible shared comment"},
        headers=csrf,
    )
    await client.post("/api/auth/logout", headers=csrf)

    shared_post = await client.get(f"/api/posts/{post_id}")
    comments = await client.get(f"/api/posts/{post_id}/comments")
    assert shared_post.status_code == 200
    assert shared_post.json()["content"] == "Shared post"
    assert comments.status_code == 200
    assert [comment["content"] for comment in comments.json()] == ["Visible shared comment"]


async def test_post_like_comment_flow(client):
    csrf = await register(client)
    await promote_to_admin()
    created = await client.post("/api/posts", data={"content": "Hello club"}, headers=csrf)
    assert created.status_code == 201
    post_id = created.json()["id"]

    like = await client.put(f"/api/posts/{post_id}/like", headers=csrf)
    again = await client.put(f"/api/posts/{post_id}/like", headers=csrf)
    assert like.json()["likeCount"] == again.json()["likeCount"] == 1  # idempotent

    comment = await client.post(f"/api/posts/{post_id}/comments", json={"content": "Nice"}, headers=csrf)
    assert comment.status_code == 201 and comment.json()["commentCount"] == 1

    feed = (await client.get("/api/posts")).json()["posts"][0]
    assert feed["likeCount"] == 1 and feed["commentCount"] == 1 and feed["likedByMe"] is True

    unliked = await client.delete(f"/api/posts/{post_id}/like", headers=csrf)
    assert unliked.json()["likeCount"] == 0


async def test_created_post_returns_youtube_preview(client, monkeypatch):
    csrf = await register(client)
    url = "https://www.youtube.com/watch?v=dNuI6ViswoE"
    monkeypatch.setattr(
        community,
        "get_link_preview",
        AsyncMock(
            return_value=LinkPreview(
                url=url,
                title="Video title",
                description="Brave Active",
                image="https://i.ytimg.com/vi/dNuI6ViswoE/hqdefault.jpg",
                site="YouTube",
            )
        ),
    )

    response = await client.post(
        "/api/posts",
        data={"content": f"Watch this: {url}"},
        headers=csrf,
    )

    assert response.status_code == 201
    assert response.json()["linkPreview"] == {
        "url": url,
        "title": "Video title",
        "description": "Brave Active",
        "image": "https://i.ytimg.com/vi/dNuI6ViswoE/hqdefault.jpg",
        "site": "YouTube",
    }


async def test_only_owner_can_delete(client):
    owner = await register(client, "o@bravesoft.com.vn", "Owner")
    post_id = (await client.post("/api/posts", data={"content": "mine"}, headers=owner)).json()["id"]
    await client.post("/api/auth/logout", headers=owner)

    other = await register(client, "x@bravesoft.com.vn", "Other")
    assert (await client.delete(f"/api/posts/{post_id}", headers=other)).status_code == 403


async def test_admin_can_delete_other_posts_only_from_admin_endpoint(client):
    owner = await register(client, "owner@bravesoft.com.vn", "Owner")
    post_id = (await client.post("/api/posts", data={"content": "owner post"}, headers=owner)).json()["id"]
    await client.post("/api/auth/logout", headers=owner)

    admin = await register(client, "admin@bravesoft.com.vn", "Admin")
    await promote_to_admin("admin@bravesoft.com.vn")

    community_delete = await client.delete(f"/api/posts/{post_id}", headers=admin)
    assert community_delete.status_code == 403

    admin_delete = await client.delete(f"/api/admin/posts/{post_id}", headers=admin)
    assert admin_delete.status_code == 200


async def test_owner_can_edit_post_text_without_replacing_attachment(client):
    csrf = await register(client)
    created = await client.post(
        "/api/posts",
        data={"content": "original"},
        files={"image": ("pic.png", png_bytes(), "image/png")},
        headers=csrf,
    )
    post_id = created.json()["id"]
    original_image = created.json()["imageUrl"]

    updated = await client.put(
        f"/api/posts/{post_id}",
        json={"content": "edited text"},
        headers=csrf,
    )
    assert updated.status_code == 200
    assert updated.json()["content"] == "edited text"
    assert updated.json()["imageUrl"] == original_image


async def test_only_owner_can_edit_post_and_comment(client):
    owner = await register(client, "owner@bravesoft.com.vn", "Owner")
    await promote_to_admin("owner@bravesoft.com.vn")
    post_id = (await client.post("/api/posts", data={"content": "original"}, headers=owner)).json()["id"]
    comment = await client.post(
        f"/api/posts/{post_id}/comments",
        json={"content": "original comment"},
        headers=owner,
    )
    comment_id = comment.json()["comment"]["id"]
    await client.post("/api/auth/logout", headers=owner)

    other = await register(client, "other@bravesoft.com.vn", "Other")
    assert (await client.put(f"/api/posts/{post_id}", json={"content": "no"}, headers=other)).status_code == 403
    assert (
        await client.put(
            f"/api/posts/{post_id}/comments/{comment_id}",
            json={"content": "no"},
            headers=other,
        )
    ).status_code == 403


async def test_owner_can_edit_comment(client):
    csrf = await register(client)
    await promote_to_admin()
    post_id = (await client.post("/api/posts", data={"content": "post"}, headers=csrf)).json()["id"]
    created = await client.post(
        f"/api/posts/{post_id}/comments",
        json={"content": "before"},
        headers=csrf,
    )
    comment_id = created.json()["comment"]["id"]

    updated = await client.put(
        f"/api/posts/{post_id}/comments/{comment_id}",
        json={"content": "after"},
        headers=csrf,
    )
    assert updated.status_code == 200 and updated.json()["content"] == "after"
    assert updated.json()["author"]["displayName"] == "Alice"


async def test_admin_cannot_edit_another_users_post(client):
    author_csrf = await register(client, "author@bravesoft.com.vn", "Author")
    post = await client.post("/api/posts", data={"content": "Author's text"}, headers=author_csrf)
    await client.post("/api/auth/logout", headers=author_csrf)

    admin_csrf = await register(client, "admin@bravesoft.com.vn", "Admin")
    await promote_to_admin("admin@bravesoft.com.vn")
    response = await client.put(
        f"/api/posts/{post.json()['id']}",
        json={"content": "Changed by admin"},
        headers=admin_csrf,
    )

    assert response.status_code == 403
    assert response.json()["error"] == "Bạn không có quyền sửa bài đăng này."


async def test_feedback_submission_and_admin_listing(client):
    anonymous = await client.post(
        "/api/feedback",
        json={"title": "  A suggestion  ", "content": "  Let us share ideas.  "},
    )
    assert anonymous.status_code == 201
    assert anonymous.json()["title"] == "A suggestion"
    assert anonymous.json()["content"] == "Let us share ideas."
    assert anonymous.json()["authorName"] is None

    member_csrf = await register(client, "member@bravesoft.com.vn", "Member")
    member_feedback = await client.post(
        "/api/feedback",
        json={"title": "Member suggestion", "content": "A member idea."},
        headers=member_csrf,
    )
    assert member_feedback.status_code == 201
    assert member_feedback.json()["authorName"] == "Member"
    assert (await client.get("/api/admin/feedback")).status_code == 403

    await promote_to_admin("member@bravesoft.com.vn")
    first = await client.get("/api/admin/feedback", params={"limit": 1})
    assert first.status_code == 200
    assert len(first.json()["feedback"]) == 1
    assert first.json()["hasMore"] is True
    second = await client.get("/api/admin/feedback", params={"limit": 1, "offset": 1})
    assert len(second.json()["feedback"]) == 1
    assert second.json()["hasMore"] is False


async def test_feedback_requires_nonblank_title_and_content(client):
    response = await client.post("/api/feedback", json={"title": "   ", "content": "Message"})
    assert response.status_code == 400


async def test_profile_avatar_upload_and_profile_update(client):
    csrf = await register(client)
    uploaded = await client.put(
        "/api/auth/avatar",
        files={"image": ("avatar.png", png_bytes(), "image/png")},
        headers=csrf,
    )
    assert uploaded.status_code == 200
    avatar_url = uploaded.json()["user"]["avatarUrl"]
    assert avatar_url and (await client.get(avatar_url)).status_code == 200

    updated = await client.patch("/api/auth/profile", json={"displayName": "Alice Updated"}, headers=csrf)
    assert updated.status_code == 200
    assert updated.json()["user"]["displayName"] == "Alice Updated"
    assert updated.json()["user"]["avatarUrl"] == avatar_url

    removed = await client.delete("/api/auth/avatar", headers=csrf)
    assert removed.status_code == 200 and removed.json()["user"]["avatarUrl"] is None


async def test_notifications_are_persisted_for_post_audience_and_mark_read(client):
    owner_csrf = await register(client, "owner@bravesoft.com.vn", "Owner")
    await promote_to_admin("owner@bravesoft.com.vn")
    post = await client.post("/api/posts", data={"content": "My post"}, headers=owner_csrf)
    post_id = post.json()["id"]
    assert (await client.get("/api/notifications")).json()["notifications"] == []
    await client.post("/api/auth/logout", headers=owner_csrf)

    commenter_csrf = await register(client, "commenter@bravesoft.com.vn", "Commenter")
    await client.put(f"/api/posts/{post_id}/like", headers=commenter_csrf)
    await client.post(
        f"/api/posts/{post_id}/comments",
        json={"content": "A useful comment"},
        headers=commenter_csrf,
    )
    # The actor does not get notifications for their own actions.
    assert (await client.get("/api/notifications")).json()["notifications"] == []
    await client.post("/api/auth/logout", headers=commenter_csrf)

    login = await client.post(
        "/api/auth/login",
        json={"email": "owner@bravesoft.com.vn", "password": "TestPass123"},
    )
    owner_csrf = {"X-CSRF-Token": login.json()["csrfToken"]}
    first_page = (await client.get("/api/notifications", params={"limit": 1, "offset": 0})).json()
    second_page = (await client.get("/api/notifications", params={"limit": 1, "offset": 1})).json()
    assert len(first_page["notifications"]) == 1 and first_page["hasMore"] is True
    assert len(second_page["notifications"]) == 1 and second_page["hasMore"] is False
    assert first_page["notifications"][0]["id"] != second_page["notifications"][0]["id"]
    page = (await client.get("/api/notifications")).json()
    assert page["unreadCount"] == 2
    assert {item["kind"] for item in page["notifications"]} == {
        "post_liked_own",
        "post_commented_own",
    }

    marked = await client.post(
        "/api/notifications/read",
        json={"ids": [item["id"] for item in page["notifications"]]},
        headers=owner_csrf,
    )
    assert marked.json()["unreadCount"] == 0

    # A user interacting with their own post does not create self-notifications.
    await client.put(f"/api/posts/{post_id}/like", headers=owner_csrf)
    await client.post(
        f"/api/posts/{post_id}/comments",
        json={"content": "My own comment"},
        headers=owner_csrf,
    )
    assert (await client.get("/api/notifications")).json()["unreadCount"] == 0


async def test_new_post_notifies_existing_members(client):
    existing_csrf = await register(client, "existing@bravesoft.com.vn", "Existing")
    await client.post("/api/auth/logout", headers=existing_csrf)

    author_csrf = await register(client, "author@bravesoft.com.vn", "Author")
    await promote_to_admin("author@bravesoft.com.vn")
    await client.post("/api/posts", data={"content": "Hello everyone"}, headers=author_csrf)
    await client.post("/api/auth/logout", headers=author_csrf)
    await client.post(
        "/api/auth/login",
        json={"email": "existing@bravesoft.com.vn", "password": "TestPass123"},
    )
    page = (await client.get("/api/notifications")).json()
    assert page["unreadCount"] == 1
    assert page["notifications"][0]["kind"] == "new_post"


async def test_pagination(client):
    csrf = await register(client)
    await promote_to_admin()
    for i in range(5):
        await client.post("/api/posts", data={"content": f"post {i}"}, headers=csrf)
    first = (await client.get("/api/posts", params={"limit": 3})).json()
    assert len(first["posts"]) == 3 and first["nextCursor"]
    second = (await client.get("/api/posts", params={"limit": 3, "cursor": first["nextCursor"]})).json()
    assert len(second["posts"]) == 2 and second["nextCursor"] is None


async def test_admin_post_queue_prioritizes_pending_posts_across_pages(client):
    csrf = await register(client)
    pending = await client.post("/api/posts", data={"content": "Needs review"}, headers=csrf)
    await promote_to_admin()
    approved = await client.post("/api/posts", data={"content": "Already approved"}, headers=csrf)

    first = await client.get("/api/admin/posts", params={"limit": 1})
    assert first.status_code == 200
    assert first.json()["posts"][0]["id"] == pending.json()["id"]
    assert first.json()["posts"][0]["approved"] is False
    assert first.json()["nextCursor"]

    second = await client.get(
        "/api/admin/posts",
        params={"limit": 1, "cursor": first.json()["nextCursor"]},
    )
    assert second.json()["posts"][0]["id"] == approved.json()["id"]


async def test_admin_post_management_requires_admin_role(client):
    csrf = await register(client)
    assert (await client.get("/api/admin/posts")).status_code == 403
    async with SessionFactory() as db:
        user = await db.scalar(select(User).where(User.email == "a@bravesoft.com.vn"))
        user.role = "admin"
        await db.commit()

    created = await client.post("/api/posts", data={"content": "moderate me"}, headers=csrf)
    post_id = created.json()["id"]
    page = await client.get("/api/admin/posts")
    assert page.status_code == 200 and page.json()["posts"][0]["id"] == post_id
    deleted = await client.delete(f"/api/admin/posts/{post_id}", headers=csrf)
    assert deleted.status_code == 200
    assert (await client.get(f"/api/posts/{post_id}")).status_code == 404


async def test_member_posts_require_admin_approval(client):
    member_csrf = await register(client)
    created = await client.post("/api/posts", data={"content": "Waiting for review"}, headers=member_csrf)
    assert created.status_code == 201
    post_id = created.json()["id"]
    assert created.json()["approved"] is False
    assert (await client.get("/api/posts")).json()["posts"] == []
    assert (await client.get(f"/api/posts/{post_id}")).status_code == 200
    assert (await client.get(f"/api/posts/{post_id}/comments")).status_code == 404

    await client.post("/api/auth/logout", headers=member_csrf)
    assert (await client.get(f"/api/posts/{post_id}")).status_code == 404
    admin_csrf = await register(client, "admin@bravesoft.com.vn", "Admin")
    assert (await client.post(f"/api/admin/posts/{post_id}/approve", headers=admin_csrf)).status_code == 403
    await promote_to_admin("admin@bravesoft.com.vn")

    admin_posts = await client.get("/api/admin/posts")
    assert admin_posts.status_code == 200
    assert admin_posts.json()["posts"][0]["approved"] is False
    approved = await client.post(f"/api/admin/posts/{post_id}/approve", headers=admin_csrf)
    assert approved.status_code == 200
    assert approved.json()["approved"] is True
    assert (await client.get("/api/posts")).json()["posts"][0]["id"] == post_id
    assert (await client.get(f"/api/posts/{post_id}")).status_code == 200


async def test_admin_posts_are_automatically_approved(client):
    csrf = await register(client)
    await promote_to_admin()

    created = await client.post("/api/posts", data={"content": "Published immediately"}, headers=csrf)

    assert created.status_code == 201
    assert created.json()["approved"] is True
    assert (await client.get("/api/posts")).json()["posts"][0]["id"] == created.json()["id"]


async def test_image_upload_and_served_via_media(client):
    csrf = await register(client)
    response = await client.post(
        "/api/posts",
        data={"content": "with image"},
        files={"image": ("pic.png", png_bytes(), "image/png")},
        headers=csrf,
    )
    assert response.status_code == 201
    url = response.json()["imageUrl"]
    assert response.json()["linkPreview"] is None
    media = await client.get(url)
    assert media.status_code == 200 and media.headers["x-content-type-options"] == "nosniff"


async def test_multiple_post_images_are_limited_to_four(client):
    csrf = await register(client)
    files = [
        ("images", (f"pic-{index}.png", png_bytes(), "image/png"))
        for index in range(4)
    ]
    response = await client.post("/api/posts", data={"content": "gallery"}, files=files, headers=csrf)

    assert response.status_code == 201, response.text
    data = response.json()
    assert len(data["imageUrls"]) == 4
    assert data["imageUrl"] == data["imageUrls"][0]
    for image_url in data["imageUrls"]:
        media = await client.get(image_url)
        assert media.status_code == 200

    too_many = files + [("images", ("pic-5.png", png_bytes(), "image/png"))]
    rejected = await client.post(
        "/api/posts",
        data={"content": "too many"},
        files=too_many,
        headers=csrf,
    )
    assert rejected.status_code == 400


async def test_non_image_upload_rejected(client):
    csrf = await register(client)
    response = await client.post(
        "/api/posts",
        data={"content": "bad"},
        files={"image": ("evil.png", b"<script>alert(1)</script>", "image/png")},
        headers=csrf,
    )
    assert response.status_code == 415


async def test_media_path_traversal_blocked(client):
    assert (await client.get("/media/..%2f..%2fetc%2fpasswd")).status_code == 404


async def test_link_preview_blocks_private_addresses(client):
    csrf = await register(client)
    for url in ("http://127.0.0.1/", "http://localhost/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "ftp://example.com/x"):
        response = await client.get("/api/link-preview", params={"url": url})
        assert response.status_code == 400, url
    _ = csrf


async def test_link_preview_requires_login(client):
    assert (await client.get("/api/link-preview", params={"url": "https://example.com"})).status_code == 401


async def test_post_with_unsafe_link_still_posts_without_preview(client):
    csrf = await register(client)
    response = await client.post("/api/posts", data={"content": "see http://127.0.0.1:80/admin"}, headers=csrf)
    assert response.status_code == 201
    assert response.json()["linkPreview"] is None
