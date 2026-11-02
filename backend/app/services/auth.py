"""Authentication service: registration, login, sessions and password reset."""

import logging
import secrets
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import hash_password, hash_token, needs_rehash, new_token, verify_password
from app.models import PasswordResetToken, User, UserSession
from app.services.mail import send_temporary_password_email

logger = logging.getLogger("app.auth")

MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15
INVALID_CREDENTIALS = "Email hoặc mật khẩu không đúng."
TEMP_PASSWORD_ALPHABET = string.ascii_letters + string.digits


def now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def new_temporary_password() -> str:
    return "".join(secrets.choice(TEMP_PASSWORD_ALPHABET) for _ in range(8))


async def register_user(db: AsyncSession, email: str, display_name: str) -> User:
    email = normalize_email(email)
    if await db.scalar(select(User.id).where(User.email == email)):
        raise AppError("Email này đã được đăng ký.", 409)
    settings = get_settings()
    temporary_password = new_temporary_password()
    user = User(
        email=email,
        display_name=display_name,
        password_hash=hash_password(temporary_password),
        role="admin" if email in {e.lower() for e in settings.admin_emails} else "user",
        must_change_password=True,
    )
    db.add(user)
    try:
        await db.flush()
        await send_temporary_password_email(user.email, user.display_name, temporary_password)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.exception("Could not complete account registration email delivery")
        raise AppError("Không thể gửi mật khẩu qua email. Vui lòng thử lại sau.", 503) from exc
    return user


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


async def request_password_reset(db: AsyncSession, email: str) -> None:
    """Issue a one-time temporary password without revealing whether an account exists."""
    user = await db.scalar(select(User).where(User.email == normalize_email(email), User.is_active))
    if not user:
        return

    temporary_password = new_temporary_password()
    user.password_hash = hash_password(temporary_password)
    user.must_change_password = True
    user.failed_logins = 0
    user.locked_until = None
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    # Revoke active sessions so a recovery request takes effect immediately.
    await db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    try:
        await db.flush()
        await send_temporary_password_email(user.email, user.display_name, temporary_password)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.exception("Could not complete temporary password email delivery")
        raise AppError("Không thể gửi mật khẩu qua email. Vui lòng thử lại sau.", 503) from exc


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    record = await db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_token(token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now(),
        )
    )
    if not record:
        raise AppError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", 400)

    user = await db.get(User, record.user_id)
    if not user:
        raise AppError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", 400)
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    user.failed_logins = 0
    user.locked_until = None
    record.used_at = now()
    # Sign out everywhere: a reset implies the old credentials may be compromised.
    await db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    await db.commit()


async def change_password(db: AsyncSession, user: User, new_password: str) -> None:
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    user.failed_logins = 0
    user.locked_until = None
    await db.commit()
