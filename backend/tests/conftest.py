import os

# Must be set before the app is imported so settings pick up the test database.
os.environ["DATABASE_URL"] = "postgresql+asyncpg://braveactive:braveactive@localhost:5432/braveactive_test"
os.environ["UPLOAD_DIR"] = "/tmp/braveactive-test-uploads"
os.environ["ENVIRONMENT"] = "development"
os.environ["CRON_SECRET"] = "cron-test-secret"

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.rate_limit import limiter  # noqa: E402
from app.db.session import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

ORIGIN = {"Origin": "http://localhost:3000"}
TEMP_PASSWORDS: dict[str, str] = {}


_schema_ready = False


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    """Recreate the schema once per run, then truncate all tables before each test."""
    global _schema_ready
    async with engine.begin() as conn:
        if not _schema_ready:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            _schema_ready = True
        tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        await conn.execute(text(f"TRUNCATE {tables} CASCADE"))
    limiter.reset()
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=ORIGIN) as c:
        yield c


@pytest.fixture(autouse=True)
def capture_temporary_password(monkeypatch):
    TEMP_PASSWORDS.clear()

    async def fake_send(to: str, display_name: str, password: str) -> None:
        TEMP_PASSWORDS[to] = password

    monkeypatch.setattr("app.services.auth.send_temporary_password_email", fake_send)


async def register(client: AsyncClient, email="a@bravesoft.com.vn", name="Alice"):
    """Create an account, exchange its emailed temporary password, and finish setup."""
    response = await client.post("/api/auth/register", json={"email": email, "displayName": name})
    assert response.status_code == 202, response.text
    login = await client.post("/api/auth/login", json={"email": email, "password": TEMP_PASSWORDS[email]})
    assert login.status_code == 200, login.text
    csrf = {"X-CSRF-Token": login.json()["csrfToken"]}
    changed = await client.post(
        "/api/auth/change-password",
        json={"password": "TestPass123"},
        headers=csrf,
    )
    assert changed.status_code == 200, changed.text
    return csrf


@pytest.fixture
def make_user():
    return register
