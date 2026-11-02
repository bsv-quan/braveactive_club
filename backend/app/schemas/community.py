"""Community request/response schemas."""

import uuid
from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.base import CamelModel


class AuthorOut(CamelModel):
    id: uuid.UUID
    display_name: str
    avatar_url: str | None = None


class LinkPreviewOut(CamelModel):
    url: str
    title: str | None = None
    description: str | None = None
    image: str | None = None
    site: str | None = None


class PostOut(CamelModel):
    id: uuid.UUID
    author: AuthorOut
    content: str
    image_url: str | None = None
    link_preview: LinkPreviewOut | None = None
    like_count: int = 0
    comment_count: int = 0
    liked_by_me: bool = False
    created_at: datetime


class PostPage(CamelModel):
    posts: list[PostOut]
    next_cursor: str | None = None


class CommentOut(CamelModel):
    id: uuid.UUID
    post_id: uuid.UUID
    author: AuthorOut
    content: str
    created_at: datetime


class CommentCreate(CamelModel):
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("content")
    @classmethod
    def strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nội dung bình luận không được để trống.")
        return value


class PostUpdate(CamelModel):
    content: str = Field(max_length=2000)

    @field_validator("content")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class CommentUpdate(CamelModel):
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("content")
    @classmethod
    def strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nội dung bình luận không được để trống.")
        return value


class LikeOut(CamelModel):
    post_id: uuid.UUID
    like_count: int
    liked_by_me: bool


class CommentCreated(CamelModel):
    comment: CommentOut
    comment_count: int
