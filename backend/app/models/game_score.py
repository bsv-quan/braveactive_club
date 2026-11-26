"""Persist scored entertainment-game rounds."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class GameRound(Base):
    __tablename__ = "game_rounds"
    __table_args__ = (
        Index("ix_game_rounds_created_score", "created_at", "score"),
        Index("ix_game_rounds_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    game_type: Mapped[str] = mapped_column(String(32))
    state: Mapped[str] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GameDailyActivity(Base):
    __tablename__ = "game_daily_activities"
    __table_args__ = (
        UniqueConstraint("user_id", "activity_date", name="uq_game_daily_activity_user_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
    )
    activity_date: Mapped[date] = mapped_column(Date, nullable=False)
    free_hints_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    attended: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
