"""Notification inbox schemas."""

import uuid
from datetime import datetime

from app.schemas.base import CamelModel


class NotificationOut(CamelModel):
    id: uuid.UUID
    actor_name: str
    kind: str
    post_id: uuid.UUID | None
    context: str
    created_at: datetime
    read_at: datetime | None


class NotificationPage(CamelModel):
    notifications: list[NotificationOut]
    unread_count: int


class MarkNotificationsRead(CamelModel):
    ids: list[uuid.UUID]
