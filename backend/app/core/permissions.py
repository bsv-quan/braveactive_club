"""Authorisation rules shared by services."""

from app.models import User


def can_manage(user: User, owner_id) -> bool:
    """Owners and admins may modify/delete a resource."""
    return user.role == "admin" or (owner_id is not None and owner_id == user.id)
