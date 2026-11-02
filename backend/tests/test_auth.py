from tests.conftest import TEMP_PASSWORDS, register


async def test_register_login_me_logout(client):
    csrf = await register(client)
    me = (await client.get("/api/auth/me")).json()
    assert me["user"]["email"] == "a@bravesoft.com.vn"
    assert me["csrfToken"] == csrf["X-CSRF-Token"]

    assert (await client.post("/api/auth/logout", headers=csrf)).status_code == 200
    assert (await client.get("/api/auth/me")).json()["user"] is None


async def test_guest_me_is_null(client):
    assert (await client.get("/api/auth/me")).json() == {"user": None, "csrfToken": None}


async def test_email_check_and_auth_are_company_domain_only(client):
    allowed = await client.post("/api/auth/check-email", json={"email": "person@bravesoft.com.vn"})
    denied = await client.post("/api/auth/check-email", json={"email": "person@example.com"})
    assert allowed.json() == {"allowed": True}
    assert denied.json() == {"allowed": False}
    login = await client.post("/api/auth/login", json={"email": "person@example.com", "password": "Anything1"})
    assert login.status_code == 400


async def test_duplicate_email_and_corporate_domain(client):
    await register(client)
    dup = await client.post("/api/auth/register", json={"email": "A@bravesoft.com.vn", "displayName": "Bob"})
    assert dup.status_code == 409
    invalid = await client.post("/api/auth/register", json={"email": "b@example.com", "displayName": "Bob"})
    assert invalid.status_code == 400


async def test_wrong_password_is_generic_and_locks_after_repeated_failures(client):
    await register(client)
    await client.post("/api/auth/logout", headers={})
    for _ in range(5):
        response = await client.post("/api/auth/login", json={"email": "a@bravesoft.com.vn", "password": "wrong-pass1"})
        assert response.status_code == 401
    locked = await client.post("/api/auth/login", json={"email": "a@bravesoft.com.vn", "password": TEMP_PASSWORDS["a@bravesoft.com.vn"]})
    assert locked.status_code == 429


async def test_login_rate_limited_per_ip(client):
    statuses = [
        (await client.post("/api/auth/login", json={"email": f"x{i}@bravesoft.com.vn", "password": "whatever1"})).status_code
        for i in range(12)
    ]
    assert statuses[:10] == [401] * 10
    assert statuses[10:] == [429, 429]


async def test_csrf_header_required_for_authenticated_writes(client):
    csrf = await register(client)
    denied = await client.post("/api/posts/", data={"content": "hello"})
    assert denied.status_code in (403, 404, 307)  # trailing slash variants
    no_csrf = await client.post("/api/posts", data={"content": "hello"})
    assert no_csrf.status_code == 403
    ok = await client.post("/api/posts", data={"content": "hello"}, headers=csrf)
    assert ok.status_code == 201


async def test_foreign_origin_is_rejected(client):
    response = await client.post(
        "/api/auth/login",
        json={"email": "a@bravesoft.com.vn", "password": "x"},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403


async def test_session_cookie_flags(client):
    response = await client.post(
        "/api/auth/register", json={"email": "c@bravesoft.com.vn", "displayName": "Cara"}
    )
    assert response.status_code == 202
    assert response.headers.get("set-cookie") is None


async def test_forgot_password_emails_temp_password_and_forces_change(client):
    await register(client)

    unknown = await client.post("/api/auth/forgot-password", json={"email": "nobody@bravesoft.com.vn"})
    known = await client.post("/api/auth/forgot-password", json={"email": "a@bravesoft.com.vn"})
    assert unknown.status_code == known.status_code == 200
    assert unknown.json() == known.json()  # no user enumeration

    assert (await client.get("/api/auth/me")).json()["user"] is None
    temporary_password = TEMP_PASSWORDS["a@bravesoft.com.vn"]
    assert len(temporary_password) == 8
    login = await client.post(
        "/api/auth/login",
        json={"email": "a@bravesoft.com.vn", "password": temporary_password},
    )
    assert login.status_code == 200
    assert login.json()["user"]["mustChangePassword"] is True
    csrf = {"X-CSRF-Token": login.json()["csrfToken"]}
    blocked = await client.post("/api/posts", data={"content": "blocked"}, headers=csrf)
    assert blocked.status_code == 403
    changed = await client.post(
        "/api/auth/change-password",
        json={"password": "NewPassw0rd"},
        headers=csrf,
    )
    assert changed.status_code == 200
    assert changed.json()["user"]["mustChangePassword"] is False
