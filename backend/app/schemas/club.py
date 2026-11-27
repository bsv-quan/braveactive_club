"""Club content schemas (activities, announcements, content feed). JSON is camelCase."""

import uuid
from datetime import date, datetime, time
from typing import Literal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.base import CamelModel
from app.schemas.community import PostOut


class ActivityCommentOut(CamelModel):
    id: uuid.UUID
    author_name: str | None = None
    message: str
    created_at: datetime


class ActivityOut(CamelModel):
    id: uuid.UUID
    approved: bool = True
    kind: str
    recurrence_series_id: uuid.UUID | None = None
    repeat: dict[str, Any] | None = None
    title: str
    description: str
    location: str | None = None
    category: str
    schedule_type: str
    date: datetime | None
    day: date | None
    created_at: datetime
    creator: str
    participants: list[str]
    comments: list[ActivityCommentOut]


class ActivityList(CamelModel):
    activities: list[ActivityOut]


class ActivityDetail(CamelModel):
    activity: ActivityOut
    occurrences: list[ActivityOut]
    can_manage: bool


class ActivityCreated(CamelModel):
    activity: ActivityOut
    recurrence: dict[str, Any] | None = None
    generated_occurrences: int
    community_post: PostOut | None = None


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
    repeat: dict[str, Any] | None = None
    share_to_community: bool = False


class ActivityEdit(CamelModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    date: str
    day: str


class SlackScheduleInput(CamelModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=1000)
    interval: Literal["daily", "weekly", "monthly"]
    start_date: date
    send_time: time
    weekday: int | None = Field(default=None, ge=0, le=6)
    month_day: int | None = Field(default=None, ge=1, le=31)

    @model_validator(mode="after")
    def validate_schedule(self):
        if not self.message.strip() or self.send_time.tzinfo or self.send_time.second or self.send_time.microsecond:
            raise ValueError("Invalid message or time")
        if (self.interval == "weekly") != (self.weekday is not None):
            raise ValueError("Weekday is required only for weekly schedules")
        if (self.interval == "monthly") != (self.month_day is not None):
            raise ValueError("Month day is required only for monthly schedules")
        return self


class SlackScheduleOut(CamelModel):
    id: uuid.UUID
    paused: bool
    message: str
    interval: str
    start_date: date
    send_time: time
    weekday: int | None
    month_day: int | None
    next_attempt_at: datetime
    last_sent_at: datetime | None
    last_error: str | None


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
