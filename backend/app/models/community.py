"""Community (social feed) models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.user import User


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        Index("ix_posts_created_at_id", "created_at", "id"),
        Index("ix_posts_category_created_at_id", "category", "created_at", "id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(32))
    category_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    image_name: Mapped[str | None] = mapped_column(String(80))  # file name inside UPLOAD_DIR
    image_names: Mapped[list[str]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb"), nullable=False
    )
    link_url: Mapped[str | None] = mapped_column(String(2048))
    link_title: Mapped[str | None] = mapped_column(String(300))
    link_description: Mapped[str | None] = mapped_column(String(600))
    link_image: Mapped[str | None] = mapped_column(String(2048))
    link_site: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    author: Mapped[User] = relationship(lazy="joined")


class PostLike(Base):
    __tablename__ = "post_likes"

    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PostComment(Base):
    __tablename__ = "post_comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    author: Mapped[User] = relationship(lazy="joined")


class Feedback(Base):
    __tablename__ = "feedback"
    __table_args__ = (Index("ix_feedback_created_at_id", "created_at", "id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    author_name: Mapped[str | None] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(160))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
