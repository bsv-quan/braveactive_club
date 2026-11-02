import io

from PIL import Image
from sqlalchemy import select

from app.db.session import SessionFactory
from app.models import User
from tests.conftest import register


def png_bytes(size=(40, 30)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buffer, "PNG")
    return buffer.getvalue()


async def test_guest_can_read_but_not_write(client):
    assert (await client.get("/api/posts")).json() == {"posts": [], "nextCursor": None}
    assert (await client.post("/api/posts", data={"content": "hi"})).status_code == 401


async def test_post_like_comment_flow(client):
    csrf = await register(client)
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


async def test_only_owner_can_delete(client):
    owner = await register(client, "o@bravesoft.com.vn", "Owner")
    post_id = (await client.post("/api/posts", data={"content": "mine"}, headers=owner)).json()["id"]
    await client.post("/api/auth/logout", headers=owner)

    other = await register(client, "x@bravesoft.com.vn", "Other")
    assert (await client.delete(f"/api/posts/{post_id}", headers=other)).status_code == 403


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
    for i in range(5):
        await client.post("/api/posts", data={"content": f"post {i}"}, headers=csrf)
    first = (await client.get("/api/posts", params={"limit": 3})).json()
    assert len(first["posts"]) == 3 and first["nextCursor"]
    second = (await client.get("/api/posts", params={"limit": 3, "cursor": first["nextCursor"]})).json()
    assert len(second["posts"]) == 2 and second["nextCursor"] is None


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
