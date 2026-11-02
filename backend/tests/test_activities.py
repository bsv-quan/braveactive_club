from tests.conftest import register

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
    assert quick.status_code == 201

    session_cookie = client.cookies.get("ba_session")
    client.cookies.clear()
    assert (await client.post(f"/api/activities/{activity_id}/join", json={"name": "Guest"})).status_code == 401
    assert (await client.post(f"/api/activities/{activity_id}/comments", json={"message": "Guest"})).status_code == 401
    assert (await client.post(f"/api/activities/{activity_id}/votes", json={"name": "Guest", "dates": ["2026-11-05"]})).status_code == 401
    assert (await client.request("DELETE", f"/api/activities/{activity_id}/join", json={"name": "Guest"})).status_code == 401
    assert (await client.delete(f"/api/activities/{activity_id}")).status_code == 401
    client.cookies.set("ba_session", session_cookie)
    assert (await client.post(f"/api/activities/{activity_id}/join", json={"name": "Bình"}, headers=csrf)).status_code == 201
    assert (await client.post(f"/api/activities/{activity_id}/join", json={"name": "bình"}, headers=csrf)).status_code == 409
    assert (await client.post(f"/api/activities/{activity_id}/comments", json={"message": "Hẹn gặp"}, headers=csrf)).status_code == 201

    listed = (await client.get("/api/activities")).json()["activities"]
    scheduled = next(activity for activity in listed if activity["id"] == activity_id)
    assert scheduled["participants"] == ["Bình"]
    assert scheduled["comments"][0]["message"] == "Hẹn gặp"
    assert scheduled["scheduleType"] == "scheduled" and scheduled["day"] == "2026-11-03"

    assert (await client.request("DELETE", f"/api/activities/{activity_id}/join", json={"name": "Bình"}, headers=csrf)).status_code == 200
    assert (await client.delete(f"/api/activities/{activity_id}", headers=csrf)).json()["deletedOccurrences"] == 1


async def test_poll_votes(client):
    csrf = await register(client)
    poll = {**ACTIVITY, "scheduleType": "poll", "day": None, "date": None, "title": "Chọn ngày"}
    response = await client.post("/api/activities", json=poll, headers=csrf)
    assert response.status_code == 201, response.text
    activity_id = response.json()["activity"]["id"]
    session_cookie = client.cookies.get("ba_session")
    client.cookies.clear()
    assert (await client.post(f"/api/activities/{activity_id}/votes", json={"name": "Guest", "dates": ["2026-11-05"]})).status_code == 401
    client.cookies.set("ba_session", session_cookie)
    vote = await client.post(f"/api/activities/{activity_id}/votes", json={"name": "An", "dates": ["2026-11-05", "2026-11-06"]}, headers=csrf)
    assert vote.status_code == 200
    votes = (await client.get("/api/activities")).json()["activities"][0]["votes"]
    assert votes == {"2026-11-05": ["An"], "2026-11-06": ["An"]}


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
