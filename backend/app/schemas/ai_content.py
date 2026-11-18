"""AI content generation request and response schemas."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel

AIPostTopic = Literal["all", "health", "sports", "travel", "technology", "entertainment"]
AIPostHours = Literal[1, 4, 12, 24]


class AIPostPreviewRequest(CamelModel):
    topic: AIPostTopic
    hours: AIPostHours
    exclude_source_urls: list[str] = Field(default_factory=list, max_length=10)


class AIPostPublishRequest(AIPostPreviewRequest):
    source_url: str = Field(min_length=8, max_length=2048)
    title: str = Field(min_length=8, max_length=180)
    content: str = Field(min_length=40, max_length=1600)


class AIPostPreview(CamelModel):
    topic: AIPostTopic
    hours: AIPostHours
    title: str
    content: str
    source_url: str
    source_title: str
    source_description: str
    source_published_at: datetime
