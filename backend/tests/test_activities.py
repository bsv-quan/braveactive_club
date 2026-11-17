from tests.conftest import register
from app.core.security import hash_password
from app.db.session import SessionFactory
from app.models import User

ACTIVITY = {
    "title": "Cầu lông tối thứ Ba",
    "description": "Giao lưu cầu lông cho mọi trình độ",
    "category": "CẦU LÔNG",
    "scheduleType": "scheduled",
    "day": "2026-11-03",
    "date": "2026-11-03T12:00:00.000Z",
    "creator": "An",
}


async def test_all_activity_creation_requires_login(client):
    assert (await client.post("/api/activities", json=ACTIVITY)).status_code == 401
    quick = await client.post("/api/activities", json={"kind": "quick-signup", "title": "Chạy bộ", "day": "2026-11-04"})
    assert quick.status_code == 401
    legacy_signup = await client.post("/api/badminton", json={"date": "2026-11-04", "name": "Guest"})
    assert legacy_signup.status_code == 401
    legacy_cancel = await client.request("DELETE", "/api/badminton", json={"date": "2026-11-04", "name": "Guest"})
    assert legacy_cancel.status_code == 401


async def test_activity_lifecycle_and_duplicate(client):
    csrf = await register(client)
    created = await client.post("/api/activities", json=ACTIVITY, headers=csrf)
    assert created.status_code == 201
    activity_id = created.json()["activity"]["id"]
    assert (await client.post("/api/activities", json=ACTIVITY, headers=csrf)).status_code == 409
    quick = await client.post(
        "/api/activities",
        json={"kind": "quick-signup", "title": "Chạy bộ", "day": "2026-11-04"},
        headers=csrf,
    )
    assert quick.status_code == 400

    session_cookie = client.cookies.get("ba_session")
    client.cookies.clear()
    assert (await client.post(f"/api/activities/{activity_id}/join")).status_code == 401
    assert (await client.post(f"/api/activities/{activity_id}/comments", json={"message": "Guest"})).status_code == 401
    assert (await client.post(f"/api/activities/{activity_id}/votes", json={"name": "Guest", "dates": ["2026-11-05"]})).status_code == 404
    assert (await client.request("DELETE", f"/api/activities/{activity_id}/join")).status_code == 401
    assert (await client.delete(f"/api/activities/{activity_id}")).status_code == 401
    client.cookies.set("ba_session", session_cookie)
    joined = await client.post(f"/api/activities/{activity_id}/join", json={"name": "Bình"}, headers=csrf)
    assert joined.status_code == 201 and joined.json()["name"] == "Alice"
    assert (await client.post(f"/api/activities/{activity_id}/join", json={"name": "Bình"}, headers=csrf)).status_code == 409
    comment = await client.post(
        f"/api/activities/{activity_id}/comments",
        json={"message": "Hẹn gặp", "authorName": "Bình"},
        headers=csrf,
    )
    assert comment.status_code == 201
    assert comment.json()["comment"]["authorName"] == "Alice"

    listed = (await client.get("/api/activities")).json()["activities"]
    scheduled = next(activity for activity in listed if activity["id"] == activity_id)
    assert scheduled["participants"] == ["Alice"]
    assert scheduled["comments"][0]["message"] == "Hẹn gặp"
    assert scheduled["comments"][0]["authorName"] == "Alice"
    assert scheduled["scheduleType"] == "scheduled" and scheduled["day"] == "2026-11-03"
    assert "votes" not in scheduled

    left = await client.request("DELETE", f"/api/activities/{activity_id}/join", json={"name": "Bình"}, headers=csrf)
    assert left.status_code == 200 and left.json()["name"] == "Alice"
    assert (await client.delete(f"/api/activities/{activity_id}", headers=csrf)).json()["deletedOccurrences"] == 1


async def test_activity_sharing_and_creator_use_account_name(client):
    csrf = await register(client, name="Organizer")
    shared = await client.post(
        "/api/activities",
        json={**ACTIVITY, "title": "Giao lưu tháng 11", "creator": "Someone else", "shareToCommunity": True},
        headers=csrf,
    )
    assert shared.status_code == 201, shared.text
    result = shared.json()
    assert result["activity"]["creator"] == "Organizer"
    activity_url = result["communityPost"]["linkPreview"]["url"]
    assert activity_url.endswith(f"/activities/{result['activity']['id']}")
    assert result["communityPost"]["content"] == (
        "Hoạt động mới: Giao lưu tháng 11\n"
        "Nội dung:\n"
        f"{ACTIVITY['description']}\n\n"
        f"Loại hoạt động: {ACTIVITY['category']}\n"
        "Thời gian: 03/11/2026 19:00\n"
        f"Chi tiết và đăng ký:\n{activity_url}"
    )

    not_shared = await client.post(
        "/api/activities",
        json={**ACTIVITY, "title": "Không đăng lên cộng đồng"},
        headers=csrf,
    )
    assert not_shared.status_code == 201, not_shared.text
    assert not_shared.json()["communityPost"] is None
    posts = await client.get("/api/posts")
    assert [post["id"] for post in posts.json()["posts"]] == [result["communityPost"]["id"]]


async def test_entertainment_activity_category_is_supported(client):
    csrf = await register(client)
    response = await client.post(
        "/api/activities",
        json={**ACTIVITY, "title": "Xem phim cuối tuần", "category": "GIẢI TRÍ"},
        headers=csrf,
    )

    assert response.status_code == 201, response.text
    assert response.json()["activity"]["category"] == "GIẢI TRÍ"


async def test_admin_can_list_and_delete_any_activity(client):
    member_csrf = await register(client, email="member@bravesoft.com.vn")
    created = await client.post(
        "/api/activities",
        json={**ACTIVITY, "repeat": {"interval": "weekly", "endType": "count", "count": 3}},
        headers=member_csrf,
    )
    activity_id = created.json()["activity"]["id"]
    occurrence_ids = [
        activity["id"] for activity in (await client.get("/api/activities")).json()["activities"]
    ]
    assert len(occurrence_ids) == 3
    assert (await client.get("/api/admin/activities")).status_code == 403

    async with SessionFactory() as db:
        db.add(
            User(
                email="admin@bravesoft.com.vn",
                display_name="Admin",
                role="admin",
                password_hash=hash_password("AdminPass123"),
            )
        )
        await db.commit()
    login = await client.post(
        "/api/auth/login",
        json={"email": "admin@bravesoft.com.vn", "password": "AdminPass123"},
    )
    assert login.status_code == 200
    admin_csrf = {"X-CSRF-Token": login.json()["csrfToken"]}
    listed = await client.get("/api/admin/activities")
    assert listed.status_code == 200
    assert [activity["id"] for activity in listed.json()["activities"]] == [activity_id]
    for occurrence_id in occurrence_ids:
        detail = await client.get(f"/api/activities/{occurrence_id}")
        assert detail.status_code == 200
        assert detail.json()["activity"]["id"] == activity_id
        assert len(detail.json()["occurrences"]) == 3
    removed = await client.delete(f"/api/activities/{occurrence_ids[-1]}", headers=admin_csrf)
    assert removed.status_code == 200
    assert removed.json()["deletedOccurrences"] == 3
    assert (await client.get("/api/activities")).json()["activities"] == []


async def test_date_polls_are_no_longer_supported(client):
    csrf = await register(client)
    poll = {**ACTIVITY, "scheduleType": "poll", "day": None, "date": None, "title": "Chọn ngày"}
    response = await client.post("/api/activities", json=poll, headers=csrf)
    assert response.status_code == 400
    quick_signup = await client.post("/api/activities", json={
        "kind": "quick-signup", "title": "Chạy bộ", "day": "2026-11-04",
    }, headers=csrf)
    assert quick_signup.status_code == 400


async def test_weekly_repeat_generates_occurrences(client):
    csrf = await register(client)
    body = {**ACTIVITY, "repeat": {"interval": "weekly", "endType": "count", "count": 4}}
    created = await client.post("/api/activities", json=body, headers=csrf)
    assert created.status_code == 201
    assert created.json()["generatedOccurrences"] == 3
    days = sorted(a["day"] for a in (await client.get("/api/activities")).json()["activities"])
    assert days == ["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]
    # Deleting one occurrence removes the entire series.
    first = (await client.get("/api/activities")).json()["activities"][0]["id"]
    assert (await client.delete(f"/api/activities/{first}", headers=csrf)).json()["deletedOccurrences"] == 4


async def test_announcements_and_content(client):
    csrf = await register(client)
    body = {"title": "Giải đấu mới", "description": "Đăng ký tham gia nhé", "category": "CẦU LÔNG"}
    assert (await client.post("/api/announcements", json=body)).status_code == 403  # cookie without CSRF header
    created = await client.post("/api/announcements", json=body, headers=csrf)
    assert created.status_code == 201
    content = (await client.get("/api/content")).json()
    assert [a["id"] for a in content["announcements"]][0] == "welcome"
    assert len(content["announcements"]) == 2 and len(content["posts"]) == 3

    ann_id = created.json()["announcement"]["id"]
    edited = await client.patch(f"/api/announcements/{ann_id}", json={**body, "title": "Giải đấu 2"}, headers=csrf)
    assert edited.json()["announcement"]["title"] == "Giải đấu 2"
    assert (await client.delete(f"/api/announcements/{ann_id}", headers=csrf)).status_code == 200


async def test_cron_requires_secret(client):
    assert (await client.get("/api/cron/activity-recurrences")).status_code == 401
    ok = await client.get("/api/cron/activity-recurrences", headers={"Authorization": "Bearer cron-test-secret"})
    assert ok.status_code == 200
