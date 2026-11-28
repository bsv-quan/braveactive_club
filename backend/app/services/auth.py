"""Authentication service: registration, login, sessions and password reset."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.rate_limit import enforce_limit
from app.core.security import hash_password, hash_token, needs_rehash, new_token, verify_password
from app.models import AccountRequest, User, UserSession

MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15
INVALID_CREDENTIALS = "Email hoặc mật khẩu không đúng."


def now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def register_user(db: AsyncSession, email: str, display_name: str) -> bool:
    """Queue an account request without disclosing whether the email is registered."""
    email = normalize_email(email)
    enforce_limit(f"account-request:register:{hash_token(email)}", 5, 900)
    if not await db.scalar(select(User.id).where(User.email == email)):
        inserted = await db.scalar(
            pg_insert(AccountRequest)
            .values(email=email, purpose="register", display_name=display_name)
            .on_conflict_do_nothing(constraint="uq_account_requests_email_purpose")
            .returning(AccountRequest.id)
        )
        await db.commit()
        return inserted is not None
    return False


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    """Verify credentials with brute-force lockout; errors never reveal which part failed."""
    user = await db.scalar(select(User).where(User.email == normalize_email(email)))
    if user and user.locked_until and user.locked_until > now():
        raise AppError("Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau.", 429)

    valid = verify_password(password, user.password_hash if user else None)
    if not user or not valid or not user.is_active:
        if user:
            user.failed_logins += 1
            if user.failed_logins >= MAX_FAILED_LOGINS:
                user.locked_until = now() + timedelta(minutes=LOCK_MINUTES)
                user.failed_logins = 0
            await db.commit()
        raise AppError(INVALID_CREDENTIALS, 401)

    user.failed_logins = 0
    user.locked_until = None
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    await db.commit()
    return user


async def create_session(db: AsyncSession, user: User, user_agent: str | None) -> str:
    """Create a server-side session and return the raw cookie token."""
    token = new_token()
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=now() + timedelta(days=get_settings().session_ttl_days),
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    # Opportunistic cleanup of expired sessions.
    await db.execute(delete(UserSession).where(UserSession.expires_at < now()))
    await db.commit()
    return token


async def get_user_by_session(db: AsyncSession, token: str) -> User | None:
    row = await db.execute(
        select(User)
        .join(UserSession, UserSession.user_id == User.id)
        .where(UserSession.token_hash == hash_token(token), UserSession.expires_at > now(), User.is_active)
    )
    return row.scalar_one_or_none()


async def destroy_session(db: AsyncSession, token: str) -> None:
    await db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
    await db.commit()


async def request_password_reset(db: AsyncSession, email: str) -> str | None:
    """Queue a reset for an existing user without changing their credentials. Returns display_name if newly queued."""
    email = normalize_email(email)
    enforce_limit(f"account-request:reset:{hash_token(email)}", 5, 900)
    user = await db.scalar(select(User).where(User.email == email, User.is_active))
    if user:
        inserted = await db.scalar(
            pg_insert(AccountRequest)
            .values(email=email, purpose="reset", display_name=user.display_name)
            .on_conflict_do_nothing(constraint="uq_account_requests_email_purpose")
            .returning(AccountRequest.id)
        )
        await db.commit()
        if inserted is not None:
            return user.display_name
    return None


async def change_password(db: AsyncSession, user: User, new_password: str) -> None:
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    user.failed_logins = 0
    user.locked_until = None
    await db.commit()
