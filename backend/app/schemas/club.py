"""Club content schemas (activities, announcements, content feed). JSON is camelCase."""

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.schemas.base import CamelModel


class ActivityCommentOut(CamelModel):
    id: uuid.UUID
    message: str
    created_at: datetime


class ActivityOut(CamelModel):
    id: uuid.UUID
    kind: str
    recurrence_series_id: uuid.UUID | None = None
    repeat: dict[str, Any] | None = None
    title: str
    description: str
    category: str
    schedule_type: str
    date: datetime | None
    day: date | None
    created_at: datetime
    creator: str
    participants: list[str]
    votes: dict[str, list[str]]
    comments: list[ActivityCommentOut]


class ActivityList(CamelModel):
    activities: list[ActivityOut]


class ActivityCreated(CamelModel):
    activity: ActivityOut
    recurrence: dict[str, Any] | None = None
    generated_occurrences: int


class ActivityCreate(CamelModel):
    """Loose input model: detailed validation (with Vietnamese messages) lives in the service."""

    model_config = ConfigDict(extra="ignore")

    kind: str | None = None
    title: str
    description: str | None = None
    category: str | None = None
    schedule_type: str | None = None
    date: str | None = None
    day: str | None = None
    creator: str | None = None
    repeat: dict[str, Any] | None = None


class NameBody(CamelModel):
    name: str


class VoteBody(CamelModel):
    name: str
    dates: list[str]


class MessageBody(CamelModel):
    message: str


class AnnouncementBody(CamelModel):
    title: str
    description: str
    category: str


class AnnouncementOut(CamelModel):
    id: str
    category: str
    title: str
    description: str
    date: str
    color: str


class PostSummaryOut(CamelModel):
    id: str
    category: str
    title: str
    description: str
    date: str
    read_time: str


class ContentOut(CamelModel):
    announcements: list[AnnouncementOut]
    posts: list[PostSummaryOut]


class BadmintonBody(CamelModel):
    date: str
    name: str
