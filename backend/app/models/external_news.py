"""Cached metadata for selected external news sources."""

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ExternalNews(Base):
    __tablename__ = "external_news"
    __table_args__ = (
        Index("ix_external_news_published_at", "published_at"),
        Index("ix_external_news_category_published_at", "category", "published_at"),
    )

    url: Mapped[str] = mapped_column(String(2048), primary_key=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(2048))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
