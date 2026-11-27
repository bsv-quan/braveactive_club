"""Persistent activity Slack notification schedules."""

import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ActivitySlackSchedule(Base):
    __tablename__ = "activity_slack_schedules"
    __table_args__ = (Index("ix_activity_slack_schedules_next_attempt", "next_attempt_at"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    activity_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("activities.id", ondelete="SET NULL"), index=True)
    activity_title: Mapped[str] = mapped_column(String(120))
    paused: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    message: Mapped[str] = mapped_column(Text)
    interval: Mapped[str] = mapped_column(String(16))
    start_date: Mapped[date] = mapped_column(Date)
    send_time: Mapped[time] = mapped_column(Time)
    weekday: Mapped[int | None] = mapped_column(Integer)
    month_day: Mapped[int | None] = mapped_column(Integer)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(200))


class ActivitySlackDelivery(Base):
    __tablename__ = "activity_slack_deliveries"
    __table_args__ = (Index("ix_activity_slack_deliveries_schedule_time", "schedule_id", "attempted_at", "id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activity_slack_schedules.id", ondelete="CASCADE"))
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(32))
    message: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(String(200))
