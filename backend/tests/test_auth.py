from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionFactory
from app.models import AccountRequest, User
from tests.conftest import register


async def admin_login(client):
    async with SessionFactory() as db:
        db.add(User(email="admin@bravesoft.com.vn", display_name="Admin", role="admin",
                    password_hash=hash_password("TestPass123")))
        await db.commit()
    result = await client.post("/api/auth/login", json={"email": "admin@bravesoft.com.vn", "password": "TestPass123"})
    assert result.status_code == 200
    return {"X-CSRF-Token": result.json()["csrfToken"]}


async def test_register_approval_first_login_and_reset(client):
    email = "new@bravesoft.com.vn"
    response = await client.post("/api/auth/register", json={"email": email, "displayName": "New User"})
    assert response.status_code == 202
    assert (await client.post("/api/auth/login", json={"email": email, "password": "TestPass123"})).status_code == 401
    admin = await admin_login(client)
    requests = (await client.get("/api/admin/requests")).json()["requests"]
    assert len(requests) == 1 and requests[0]["purpose"] == "register"
    approved = await client.post(f"/api/admin/requests/{requests[0]['id']}/approve", json={"password": "TempPass123"}, headers=admin)
    assert approved.status_code == 200
    assert (await client.post(f"/api/admin/requests/{requests[0]['id']}/approve", json={"password": "TempPass123"}, headers=admin)).status_code == 404
    login = await client.post("/api/auth/login", json={"email": email, "password": "TempPass123"})
    assert login.status_code == 200 and login.json()["user"]["mustChangePassword"]
    csrf = {"X-CSRF-Token": login.json()["csrfToken"]}
    assert (await client.post("/api/posts", data={"content": "blocked"}, headers=csrf)).status_code == 403
    assert (await client.post("/api/auth/change-password", json={"password": "NewPass123"}, headers=csrf)).status_code == 200
    unknown = await client.post("/api/auth/forgot-password", json={"email": "missing@bravesoft.com.vn"})
    known = await client.post("/api/auth/forgot-password", json={"email": email})
    assert unknown.json() == known.json()
    assert (await client.get("/api/auth/me")).json()["user"] is not None
    admin_login_response = await client.post("/api/auth/login", json={"email": "admin@bravesoft.com.vn", "password": "TestPass123"})
    admin = {"X-CSRF-Token": admin_login_response.json()["csrfToken"]}
    requests = (await client.get("/api/admin/requests")).json()["requests"]
    assert len(requests) == 1 and requests[0]["purpose"] == "reset"
    assert (await client.post(f"/api/admin/requests/{requests[0]['id']}/approve", json={"password": "SecondPass123"}, headers=admin)).status_code == 200
    assert (await client.post("/api/auth/login", json={"email": email, "password": "NewPass123"})).status_code == 401
    login = await client.post("/api/auth/login", json={"email": email, "password": "SecondPass123"})
    assert login.status_code == 200 and login.json()["user"]["mustChangePassword"]


async def test_admin_permissions_and_last_admin_protection(client):
    assert (await client.get("/api/admin/users")).status_code == 401
    member = await register(client)
    assert (await client.get("/api/admin/users")).status_code == 403
    assert (await client.post("/api/admin/users", json={"email": "bad@bravesoft.com.vn", "displayName": "Bad", "password": "TestPass123"}, headers=member)).status_code == 403
    admin = await admin_login(client)
    users = (await client.get("/api/admin/users")).json()["users"]
    own_id = next(u["id"] for u in users if u["role"] == "admin")
    assert (await client.delete(f"/api/admin/users/{own_id}", headers=admin)).status_code == 400
    assert (await client.patch(f"/api/admin/users/{own_id}", json={"displayName": "Admin", "role": "user"}, headers=admin)).status_code == 400


async def test_company_domain_and_deduplicated_requests(client):
    assert (await client.post("/api/auth/check-email", json={"email": "person@example.com"})).json() == {"allowed": False}
    assert (await client.post(
        "/api/auth/check-email",
        json={"email": "person@bravesoft.com.vn"},
        headers={"Origin": "http://localhost:3000"},
    )).status_code == 200
    assert (await client.post(
        "/api/auth/check-email",
        json={"email": "person@bravesoft.com.vn"},
        headers={"Origin": "https://evil.example"},
    )).status_code == 403
    assert (await client.post("/api/auth/register", json={"email": "person@example.com", "displayName": "User"})).status_code == 400
    body = {"email": "a@bravesoft.com.vn", "displayName": "Alice"}
    assert (await client.post("/api/auth/register", json=body)).status_code == 202
    assert (await client.post("/api/auth/register", json=body)).status_code == 202
    async with SessionFactory() as db:
        assert len((await db.scalars(select(AccountRequest))).all()) == 1


async def test_guest_session_csrf_and_origin(client):
    assert (await client.get("/api/auth/me")).json() == {"user": None, "csrfToken": None}
    csrf = await register(client)
    assert (await client.post("/api/posts", data={"content": "hello"})).status_code == 403
    assert (await client.post("/api/posts", data={"content": "hello"}, headers=csrf)).status_code == 201
    assert (await client.post("/api/auth/login", json={"email": "a@bravesoft.com.vn", "password": "x"},
                              headers={"Origin": "https://evil.example"})).status_code == 403
    assert (await client.post("/api/auth/logout", headers=csrf)).status_code == 200
    assert (await client.get("/api/auth/me")).json()["user"] is None


async def test_hidden_posts_are_admin_only(client):
    csrf = await register(client)
    post = await client.post("/api/posts", data={"content": "Visible post"}, headers=csrf)
    post_id = post.json()["id"]
    admin = await admin_login(client)
    assert (await client.patch(f"/api/admin/posts/{post_id}/visibility", json={"hidden": True}, headers=admin)).status_code == 200
    assert (await client.get("/api/posts")).json()["posts"] == []
    assert (await client.get(f"/api/posts/{post_id}")).status_code == 404
    assert (await client.get(f"/api/posts/{post_id}/comments")).status_code == 404
    assert (await client.get("/api/admin/posts")).json()["posts"][0]["hidden"] is True
    assert (await client.patch(f"/api/admin/posts/{post_id}/visibility", json={"hidden": False}, headers=admin)).status_code == 200
    assert (await client.get("/api/posts")).json()["posts"] == []
    assert (await client.get("/api/admin/posts")).json()["posts"][0]["approved"] is False


async def test_login_lockout_and_rate_limit(client):
    await register(client)
    for _ in range(5):
        response = await client.post("/api/auth/login", json={"email": "a@bravesoft.com.vn", "password": "wrong-pass1"})
        assert response.status_code == 401
    locked = await client.post("/api/auth/login", json={"email": "a@bravesoft.com.vn", "password": "TestPass123"})
    assert locked.status_code == 429


async def test_admin_can_create_update_and_delete_user(client):
    csrf = await admin_login(client)
    created = await client.post("/api/admin/users", json={
        "email": "member@bravesoft.com.vn",
        "role": "user", "password": "TempPass123",
    }, headers=csrf)
    assert created.status_code == 201
    user_id = created.json()["id"]
    created_user = next(user for user in (await client.get("/api/admin/users")).json()["users"]
                        if user["id"] == user_id)
    assert created_user["displayName"] == "member"
    updated = await client.patch(f"/api/admin/users/{user_id}", json={
        "displayName": "New Name", "role": "admin",
    }, headers=csrf)
    assert updated.status_code == 200
    assert any(user["id"] == user_id and user["role"] == "admin"
               for user in (await client.get("/api/admin/users")).json()["users"])
    assert (await client.delete(f"/api/admin/users/{user_id}", headers=csrf)).status_code == 200
    assert (await client.post("/api/auth/login", json={
        "email": "member@bravesoft.com.vn", "password": "TempPass123"
    })).status_code == 401
