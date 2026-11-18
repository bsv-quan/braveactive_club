"""Database-independent guards for administrator inputs."""

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.api.routes.admin import AdminUserCreate, AdminUserUpdate, require_admin
from app.core.errors import AppError


async def test_admin_dependency_rejects_members():
    with pytest.raises(AppError) as error:
        await require_admin(SimpleNamespace(role="user"))
    assert error.value.status_code == 403
    admin = SimpleNamespace(role="admin")
    assert await require_admin(admin) is admin


def test_admin_user_input_validates_domain_role_and_name():
    valid = AdminUserCreate(email="member@bravesoft.com.vn", displayName="  Test   User ",
                            password="SafePass123", role="user")
    assert valid.display_name == "Test User"
    new_domain = AdminUserCreate(email="member@bravesoft.vn", displayName="New Domain User",
                                 password="TestPass123")
    assert new_domain.email == "member@bravesoft.vn"
    with pytest.raises(ValidationError):
        AdminUserCreate(email="member@example.com", displayName="User", password="SafePass123")
    with pytest.raises(ValidationError):
        AdminUserUpdate(displayName="  ", role="admin")
    with pytest.raises(ValidationError):
        AdminUserUpdate(displayName="User", role="owner")
