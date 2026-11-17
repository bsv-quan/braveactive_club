"""Reusable FastAPI dependencies: DB session, current user, CSRF, ownership checks."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.middleware import SAFE_METHODS
from app.core.security import csrf_token_for, safe_equals
from app.db.session import get_db
from app.models import User
from app.services.auth import get_user_by_session

SESSION_COOKIE = "ba_session"
CSRF_HEADER = "x-csrf-token"

DbSession = Annotated[AsyncSession, Depends(get_db)]


@dataclass
class AuthContext:
    user: User
    session_token: str


async def get_auth_context(request: Request, db: DbSession) -> AuthContext | None:
    """Resolve the session cookie to a user (``None`` for guests).

    For state-changing methods the CSRF header bound to the session is mandatory, so
    a forged cross-site request carrying only the ambient cookie is rejected.
    """
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    user = await get_user_by_session(db, token)
    if not user:
        return None
    if request.method not in SAFE_METHODS:
        supplied = request.headers.get(CSRF_HEADER, "")
        if not safe_equals(supplied, csrf_token_for(token)):
            raise AppError("Phiên làm việc không hợp lệ (CSRF). Vui lòng tải lại trang.", 403)
    return AuthContext(user=user, session_token=token)


OptionalAuth = Annotated[AuthContext | None, Depends(get_auth_context)]


async def require_auth(auth: OptionalAuth) -> AuthContext:
    if auth is None:
        raise AppError("Vui lòng đăng nhập để tiếp tục.", 401)
    return auth


RequiredAuth = Annotated[AuthContext, Depends(require_auth)]


async def require_user(auth: RequiredAuth) -> User:
    if auth.user.must_change_password:
        raise AppError("Đổi mật khẩu tạm thời trước khi tiếp tục.", 403)
    return auth.user


async def optional_user(auth: OptionalAuth) -> User | None:
    return auth.user if auth else None


CurrentUser = Annotated[User, Depends(require_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]
