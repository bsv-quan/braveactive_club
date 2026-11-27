import asyncio
import json
from datetime import date, datetime, time, timedelta, timezone

import httpx
import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionFactory
from app.models import Activity, ActivitySlackDelivery, ActivitySlackSchedule
from app.services import activities as activities_service
from app.services import slack_notifications as slack
from tests.conftest import register
from tests.test_activities import ACTIVITY, login_as_admin


@pytest.fixture(autouse=True)
def mock_location(monkeypatch):
    async def no_location(_title, _description):
        return None

    monkeypatch.setattr(activities_service, "detect_activity_location", no_location)


async def test_schedule_permissions_validation_and_archive(client):
    owner_csrf = await register(client, name="Owner")
    created = await client.post("/api/activities", json=ACTIVITY, headers=owner_csrf)
    activity_id = created.json()["activity"]["id"]
    owner_session = client.cookies.get("ba_session")
    admin_csrf = await login_as_admin(client)
    await client.post(f"/api/admin/activities/{activity_id}/approve", headers=admin_csrf)
    endpoint = f"/api/activities/{activity_id}/slack-schedules"
    payload = {"message": "Đăng ký nhé", "interval": "weekly", "startDate": "2026-01-01", "sendTime": "09:30", "weekday": 2}

    assert (await client.post(endpoint, json=payload, headers=admin_csrf)).status_code == 201
    client.cookies.clear()
    assert (await client.get(endpoint)).status_code == 401
    other_csrf = await register(client, email="other@bravesoft.com.vn", name="Other")
    assert (await client.get(endpoint)).status_code == 403
    assert (await client.post(endpoint, json=payload, headers=other_csrf)).status_code == 403
    client.cookies.clear()
    client.cookies.set("ba_session", owner_session)
    assert (await client.post(endpoint, json={**payload, "weekday": 7}, headers=owner_csrf)).status_code == 400
    assert (await client.post(endpoint, json={**payload, "message": "  "}, headers=owner_csrf)).status_code == 400
    assert (await client.post(endpoint, json={**payload, "interval": "daily"}, headers=owner_csrf)).status_code == 400
    added = await client.post(endpoint, json={**payload, "interval": "monthly", "weekday": None, "monthDay": 31}, headers=owner_csrf)
    assert added.status_code == 201, added.text
    data = (await client.get(endpoint)).json()
    assert len(data["schedules"]) == 2
    assert data["configured"] is False
    assert (await client.delete(f"{endpoint}/{added.json()['schedule']['id']}", headers=owner_csrf)).status_code == 200
    assert len((await client.get(endpoint)).json()["schedules"]) == 1
    assert (await client.delete(f"/api/activities/{activity_id}", headers=owner_csrf)).status_code == 200
    async with SessionFactory() as db:
        archived = (await db.scalars(select(ActivitySlackSchedule))).all()
        assert len(archived) == 2
        assert all(item.activity_id is None for item in archived)
        assert all(item.activity_title == ACTIVITY["title"] for item in archived)


def test_next_slot_respects_vietnam_time_and_month_end():
    schedule = ActivitySlackSchedule(interval="monthly", start_date=date(2026, 1, 1), send_time=time(9), month_day=31)
    assert slack.next_scheduled_at(schedule, datetime(2026, 2, 1, tzinfo=timezone.utc)) == datetime(2026, 2, 28, 2, tzinfo=timezone.utc)
    assert slack.next_scheduled_at(schedule, datetime(2026, 2, 28, 2, tzinfo=timezone.utc)) == datetime(2026, 3, 31, 2, tzinfo=timezone.utc)
    schedule.interval = "weekly"
    schedule.weekday = 0
    assert slack.next_scheduled_at(schedule, datetime(2026, 11, 22, 23, tzinfo=timezone.utc)) == datetime(2026, 11, 23, 2, tzinfo=timezone.utc)


async def test_webhook_payload_and_response(monkeypatch):
    monkeypatch.setattr(get_settings(), "slack_webhook_url", "https://hooks.slack.com/services/test/test/test")
    requests = []

    class Transport:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def handle_async_request(self, request):
            requests.append(request)
            return httpx.Response(200, content=b"ok")

    monkeypatch.setattr(slack.httpx, "AsyncHTTPTransport", Transport)
    await slack._send_webhook("Xin chào")
    assert requests[0].method == "POST"
    assert json.loads(requests[0].content) == {"text": "Xin chào"}
    assert requests[0].headers["Content-Type"] == "application/json"
    assert slack.webhook_configured()
    monkeypatch.setattr(get_settings(), "slack_webhook_url", "https://example.com/services/test")
    assert not slack.webhook_configured()


async def test_scheduler_retries_pauses_and_sends_only_once(client, monkeypatch):
    csrf = await login_as_admin(client)
    created = await client.post("/api/activities", json=ACTIVITY, headers=csrf)
    activity_id = created.json()["activity"]["id"]
    endpoint = f"/api/activities/{activity_id}/slack-schedules"
    result = await client.post(endpoint, json={
        "message": "Cùng đăng ký", "interval": "daily", "startDate": "2026-01-01", "sendTime": "09:00"
    }, headers=csrf)
    assert result.status_code == 201, result.text
    schedule_id = result.json()["schedule"]["id"]
    now = datetime.now(timezone.utc)
    async with SessionFactory() as db:
        schedule = await db.get(ActivitySlackSchedule, schedule_id)
        schedule.next_attempt_at = now - timedelta(minutes=1)
        await db.commit()
    monkeypatch.setattr(get_settings(), "slack_webhook_url", "")
    assert await slack.run_due_slack_notifications(now) == 1
    async with SessionFactory() as db:
        schedule = await db.get(ActivitySlackSchedule, schedule_id)
        assert schedule.last_error == "webhook_not_configured"
        assert schedule.next_attempt_at == now + slack.RETRY_DELAY

    monkeypatch.setattr(get_settings(), "slack_webhook_url", "https://hooks.slack.com/services/test/test/test")
    messages = []

    async def fail(_message):
        raise httpx.ConnectError("unavailable")

    monkeypatch.setattr(slack, "_send_webhook", fail)
    retry_time = now + slack.RETRY_DELAY
    assert await slack.run_due_slack_notifications(retry_time) == 1
    async with SessionFactory() as db:
        schedule = await db.get(ActivitySlackSchedule, schedule_id)
        assert schedule.last_error == "delivery_failed"
        activity = await db.get(Activity, activity_id)
        activity.approved = False
        await db.commit()

    async def send(message):
        messages.append(message)
        await asyncio.sleep(0.05)

    monkeypatch.setattr(slack, "_send_webhook", send)
    assert await slack.run_due_slack_notifications(retry_time + slack.RETRY_DELAY) == 1
    assert not messages
    async with SessionFactory() as db:
        activity = await db.get(Activity, activity_id)
        activity.approved = True
        schedule = await db.get(ActivitySlackSchedule, schedule_id)
        schedule.next_attempt_at = now - timedelta(minutes=1)
        await db.commit()
    await asyncio.gather(slack.run_due_slack_notifications(now), slack.run_due_slack_notifications(now))
    assert len(messages) == 1
    assert "Cùng đăng ký" in messages[0] and ACTIVITY["title"] in messages[0]
    assert f"/activities/{activity_id}" in messages[0] and "Asia/Ho_Chi_Minh" in messages[0]
    async with SessionFactory() as db:
        schedule = await db.get(ActivitySlackSchedule, schedule_id)
        assert schedule.last_sent_at == now
        assert schedule.last_error is None
        assert schedule.next_attempt_at > now
        deliveries = (await db.scalars(select(ActivitySlackDelivery).where(ActivitySlackDelivery.schedule_id == schedule.id))).all()
        assert sorted(item.status for item in deliveries) == ["failed", "failed", "sent"]
        assert next(item.message for item in deliveries if item.status == "sent") == messages[0]


async def test_admin_pause_resume_and_preserved_history(client, monkeypatch):
    csrf = await login_as_admin(client)
    created = await client.post("/api/activities", json=ACTIVITY, headers=csrf)
    activity_id = created.json()["activity"]["id"]
    endpoint = f"/api/activities/{activity_id}/slack-schedules"
    result = await client.post(endpoint, json={
        "message": "Tham gia nhé", "interval": "daily", "startDate": "2026-01-01", "sendTime": "09:00"
    }, headers=csrf)
    schedule_id = result.json()["schedule"]["id"]
    admin_session = client.cookies.get("ba_session")
    admin_endpoint = f"/api/admin/slack-schedules/{schedule_id}"
    now = datetime.now(timezone.utc)
    async with SessionFactory() as db:
        schedule = await db.get(ActivitySlackSchedule, schedule_id)
        schedule.next_attempt_at = now - timedelta(minutes=1)
        await db.commit()
    paused = await client.patch(admin_endpoint, json={"paused": True}, headers=csrf)
    assert paused.status_code == 200
    assert paused.json()["schedule"]["paused"] is True
    assert (await client.get(endpoint)).json()["schedules"][0]["paused"] is True
    assert await slack.run_due_slack_notifications(now) == 0
    resumed = await client.patch(admin_endpoint, json={"paused": False}, headers=csrf)
    assert resumed.status_code == 200
    assert datetime.fromisoformat(resumed.json()["schedule"]["nextAttemptAt"].replace("Z", "+00:00")) > now
    assert await slack.run_due_slack_notifications(now) == 0

    async with SessionFactory() as db:
        schedule = await db.get(ActivitySlackSchedule, schedule_id)
        schedule.next_attempt_at = now - timedelta(minutes=1)
        await db.commit()
    monkeypatch.setattr(get_settings(), "slack_webhook_url", "https://hooks.slack.com/services/test/test/test")

    async def send(_message):
        return None

    monkeypatch.setattr(slack, "_send_webhook", send)
    assert await slack.run_due_slack_notifications(now) == 1
    history = await client.get(f"{admin_endpoint}/history")
    assert history.status_code == 200
    assert history.json()["history"][0]["status"] == "sent"
    assert "Tham gia nhé" in history.json()["history"][0]["message"]
    client.cookies.clear()
    other_csrf = await register(client, email="other@bravesoft.com.vn")
    assert (await client.get("/api/admin/slack-schedules")).status_code == 403
    assert (await client.get(f"{admin_endpoint}/history")).status_code == 403
    assert (await client.patch(admin_endpoint, json={"paused": True}, headers=other_csrf)).status_code == 403
    client.cookies.clear()
    client.cookies.set("ba_session", admin_session)
    assert (await client.delete(f"{endpoint}/{schedule_id}", headers=csrf)).status_code == 200
    assert (await client.patch(admin_endpoint, json={"paused": False}, headers=csrf)).status_code == 409
    assert (await client.delete(f"/api/activities/{activity_id}", headers=csrf)).status_code == 200
    listed = (await client.get("/api/admin/slack-schedules")).json()["schedules"]
    assert listed[0]["activityId"] is None and listed[0]["cancelled"] is True
    assert listed[0]["activityTitle"] == ACTIVITY["title"]
    assert len((await client.get(f"{admin_endpoint}/history")).json()["history"]) == 1
