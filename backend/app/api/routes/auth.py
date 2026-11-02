"""Authentication endpoints: register, login, logout, me, forgot/reset password."""

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile

from app.api.deps import SESSION_COOKIE, DbSession, OptionalAuth, RequiredAuth
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.rate_limit import rate_limit
from app.core.security import csrf_token_for
from app.core.security import hash_token
from app.schemas.auth import (
    ForgotPasswordRequest,
    EmailCheckOut,
    EmailCheckRequest,
    ChangePasswordRequest,
    LoginRequest,
    MessageOut,
    ProfileUpdate,
    RegisterRequest,
    ResetPasswordRequest,
    SessionOut,
    UserOut,
)
from app.services import auth as auth_service
from app.services.realtime import manager
from app.services import uploads

router = APIRouter(prefix="/auth", tags=["auth"])


def _session_payload(user, token: str) -> SessionOut:
    return SessionOut(user=UserOut.model_validate(user), csrf_token=csrf_token_for(token))


def _is_company_email(email: str) -> bool:
    return email.rsplit("@", 1)[-1].lower() == "bravesoft.com.vn"


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_ttl_days * 86400,
        httponly=True,  # not readable by JavaScript
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/check-email", response_model=EmailCheckOut, dependencies=[Depends(rate_limit("email-check", 20, 60))])
async def check_email(body: EmailCheckRequest):
    return EmailCheckOut(allowed=_is_company_email(str(body.email)))


@router.post("/register", response_model=MessageOut, status_code=202, dependencies=[Depends(rate_limit("register", 10, 3600))])
async def register(body: RegisterRequest, db: DbSession):
    await auth_service.register_user(db, body.email, body.display_name)
    return MessageOut(message="Nếu tài khoản có thể được tạo, mật khẩu tạm thời sẽ được gửi qua email công ty.")


@router.post("/login", response_model=SessionOut, dependencies=[Depends(rate_limit("login", 10, 60))])
async def login(body: LoginRequest, request: Request, response: Response, db: DbSession):
    user = await auth_service.authenticate(db, body.email, body.password)
    token = await auth_service.create_session(db, user, request.headers.get("user-agent"))
    _set_session_cookie(response, token)
    return _session_payload(user, token)


@router.post("/logout", response_model=MessageOut)
async def logout(response: Response, auth: OptionalAuth, db: DbSession):
    if auth:
        await auth_service.destroy_session(db, auth.session_token)
        await manager.invalidate_session(hash_token(auth.session_token))
    response.delete_cookie(SESSION_COOKIE, path="/")
    return MessageOut(message="Đã đăng xuất.")


@router.get("/me", response_model=SessionOut)
async def me(auth: OptionalAuth):
    """Return the current user (or ``user: null`` for guests) plus the CSRF token."""
    if not auth:
        return SessionOut(user=None)
    return _session_payload(auth.user, auth.session_token)


@router.patch("/profile", response_model=SessionOut)
async def update_profile(body: ProfileUpdate, auth: RequiredAuth, db: DbSession):
    if auth.user.must_change_password:
        raise AppError("Đổi mật khẩu tạm thời trước khi tiếp tục.", 403)
    auth.user.display_name = body.display_name
    await db.commit()
    await db.refresh(auth.user)
    return _session_payload(auth.user, auth.session_token)


@router.put("/avatar", response_model=SessionOut)
async def upload_avatar(
    auth: RequiredAuth,
    db: DbSession,
    image: UploadFile = File(...),
):
    if auth.user.must_change_password:
        raise AppError("Đổi mật khẩu tạm thời trước khi tiếp tục.", 403)
    new_name = await uploads.save_image(image)
    old_name = auth.user.avatar_name
    try:
        auth.user.avatar_name = new_name
        await db.commit()
        await db.refresh(auth.user)
    except Exception:
        uploads.delete_image(new_name)
        raise
    uploads.delete_image(old_name)
    return _session_payload(auth.user, auth.session_token)


@router.delete("/avatar", response_model=SessionOut)
async def delete_avatar(auth: RequiredAuth, db: DbSession):
    if auth.user.must_change_password:
        raise AppError("Đổi mật khẩu tạm thời trước khi tiếp tục.", 403)
    old_name = auth.user.avatar_name
    auth.user.avatar_name = None
    await db.commit()
    await db.refresh(auth.user)
    uploads.delete_image(old_name)
    return _session_payload(auth.user, auth.session_token)


@router.post("/change-password", response_model=SessionOut)
async def change_password(body: ChangePasswordRequest, auth: RequiredAuth, db: DbSession):
    if not auth.user.must_change_password:
        raise AppError("Không có mật khẩu tạm thời cần thay đổi.", 400)
    await auth_service.change_password(db, auth.user, body.password)
    return _session_payload(auth.user, auth.session_token)


@router.post("/forgot-password", response_model=MessageOut, dependencies=[Depends(rate_limit("forgot", 5, 900))])
async def forgot_password(body: ForgotPasswordRequest, db: DbSession):
    await auth_service.request_password_reset(db, body.email)
    # Same answer whether or not the email exists.
    return MessageOut(message="Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.")


@router.post("/reset-password", response_model=MessageOut, dependencies=[Depends(rate_limit("reset", 10, 900))])
async def reset_password(body: ResetPasswordRequest, db: DbSession):
    await auth_service.reset_password(db, body.token, body.password)
    return MessageOut(message="Đặt lại mật khẩu thành công. Hãy đăng nhập lại.")
