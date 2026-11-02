"""Club content models: activities, participation, announcements."""

import uuid
import datetime as dt
from datetime import datetime

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (
        # A normalized title can only be scheduled once per day.
        Index(
            "uq_activities_day_title",
            "day",
            "title_key",
            unique=True,
            postgresql_where="day IS NOT NULL",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(16), default="activity")  # "activity" | "quick-signup"
    recurrence_series_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    repeat: Mapped[dict | None] = mapped_column(JSON)
    title: Mapped[str] = mapped_column(String(120))
    title_key: Mapped[str] = mapped_column(String(400))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32))
    schedule_type: Mapped[str] = mapped_column(String(16))  # "scheduled" | "poll"
    date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    day: Mapped[dt.date | None] = mapped_column(Date)
    creator: Mapped[str] = mapped_column(String(40))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    participants: Mapped[list["ActivityParticipant"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="ActivityParticipant.created_at"
    )
    votes: Mapped[list["ActivityVote"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    comments: Mapped[list["ActivityComment"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="ActivityComment.created_at"
    )


class ActivityParticipant(Base):
    __tablename__ = "activity_participants"

    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True)
    name_key: Mapped[str] = mapped_column(String(160), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActivityVote(Base):
    __tablename__ = "activity_votes"

    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True)
    name_key: Mapped[str] = mapped_column(String(160), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))
    dates: Mapped[list[str]] = mapped_column(JSON)  # ISO days, e.g. ["2026-11-02"]


class ActivityComment(Base):
    __tablename__ = "activity_comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActivityRecurrence(Base):
    """A repeating series that still has future occurrences to generate."""

    __tablename__ = "activity_recurrences"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)  # equals Activity.recurrence_series_id
    interval: Mapped[str] = mapped_column(String(16))  # daily | weekly | monthly
    end_type: Mapped[str] = mapped_column(String(16))  # never | count | until
    count: Mapped[int | None] = mapped_column(Integer)
    until: Mapped[dt.date | None] = mapped_column(Date)
    next_day: Mapped[dt.date] = mapped_column(Date)
    occurrence_count: Mapped[int] = mapped_column(Integer)
    anchor_day: Mapped[int] = mapped_column(Integer)
    template: Mapped[dict] = mapped_column(JSON)


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    color: Mapped[str] = mapped_column(String(16))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BadmintonRegistration(Base):
    """Legacy per-day badminton sign-up list (kept for API parity)."""

    __tablename__ = "badminton_registrations"

    day: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    name_key: Mapped[str] = mapped_column(String(160), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))
