"""Public external news response schemas."""

from datetime import datetime

from app.schemas.base import CamelModel


class ExternalNewsOut(CamelModel):
    category: str
    title: str
    summary: str | None
    url: str
    image_url: str | None
    published_at: datetime | None
    fetched_at: datetime


class ExternalNewsPage(CamelModel):
    items: list[ExternalNewsOut]
    updated_at: datetime | None
