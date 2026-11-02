"""Auth request/response schemas."""

import re
import uuid
from typing import Annotated

from pydantic import AfterValidator, EmailStr, Field, field_validator

from app.schemas.base import CamelModel


def validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Mật khẩu cần tối thiểu 8 ký tự.")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Mật khẩu cần có cả chữ và số.")
    return value


Password = Annotated[str, Field(max_length=128), AfterValidator(validate_password_strength)]
CORPORATE_EMAIL_DOMAIN = "bravesoft.com.vn"


def validate_corporate_email(value: str) -> str:
    email = str(value).strip().lower()
    if email.rsplit("@", 1)[-1] != CORPORATE_EMAIL_DOMAIN:
        raise ValueError(f"Chỉ chấp nhận email @{CORPORATE_EMAIL_DOMAIN}.")
    return email


CorporateEmail = Annotated[EmailStr, AfterValidator(validate_corporate_email)]


class RegisterRequest(CamelModel):
    email: CorporateEmail
    display_name: str = Field(min_length=2, max_length=40)

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = re.sub(r"\s+", " ", value).strip()
        if len(value) < 2:
            raise ValueError("Tên hiển thị cần từ 2 ký tự.")
        return value


class LoginRequest(CamelModel):
    email: CorporateEmail
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(CamelModel):
    email: CorporateEmail


class ResetPasswordRequest(CamelModel):
    token: str = Field(min_length=20, max_length=200)
    password: Password


class ChangePasswordRequest(CamelModel):
    password: Password


class ProfileUpdate(CamelModel):
    display_name: str = Field(min_length=2, max_length=40)

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = re.sub(r"\s+", " ", value).strip()
        if len(value) < 2:
            raise ValueError("Tên hiển thị cần từ 2 ký tự.")
        return value


class EmailCheckRequest(CamelModel):
    email: EmailStr


class EmailCheckOut(CamelModel):
    allowed: bool


class UserOut(CamelModel):
    id: uuid.UUID
    email: str
    display_name: str
    avatar_url: str | None = None
    role: str
    must_change_password: bool


class SessionOut(CamelModel):
    """Current auth state. ``csrf_token`` must be echoed in ``X-CSRF-Token`` on writes."""

    user: UserOut | None
    csrf_token: str | None = None


class MessageOut(CamelModel):
    message: str
