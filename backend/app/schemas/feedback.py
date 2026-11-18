"""Feedback request and response schemas."""

import uuid
from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.base import CamelModel


class FeedbackCreate(CamelModel):
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=5000)

    @field_validator("title", "content")
    @classmethod
    def strip_nonempty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Không được để trống.")
        return value


class FeedbackOut(CamelModel):
    id: uuid.UUID
    author_name: str | None
    title: str
    content: str
    created_at: datetime


class FeedbackPage(CamelModel):
    feedback: list[FeedbackOut]
    has_more: bool
