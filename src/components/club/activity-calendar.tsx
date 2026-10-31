"use client";

import { useState } from "react";
import type { ClubActivity } from "@/lib/activities";
import {
  categoryColor,
  dateKey,
  formatDate,
  formatMonth,
  weekdayLong,
} from "@/lib/club-ui";
import { MonthGrid } from "./month-grid";

type ActivityCalendarProps = {
  anchorDate: Date;
  period: Date[];
  selectedDate: string;
  activities: ClubActivity[];
  activitiesForSelectedDate: ClubActivity[];
  activitiesError: string;
  activitiesLoading: boolean;
  onMoveMonth: (direction: number) => void;
  onSelectDate: (date: string, outsideMonth: boolean, day: Date) => void;
  onRetryActivities: () => void;
  onCreateActivity: () => void;
  onCreateQuickSignup: () => void;
  onOpenActivity: (activity: ClubActivity) => void;
  onActivityJoined: (activityId: string, name: string) => void;
};

export function ActivityCalendarSection({
  anchorDate,
  period,
  selectedDate,
  activities,
  activitiesForSelectedDate,
  activitiesError,
  activitiesLoading,
  onMoveMonth,
  onSelectDate,
  onRetryActivities,
  onCreateActivity,
  onCreateQuickSignup,
  onOpenActivity,
  onActivityJoined,
}: ActivityCalendarProps) {
  const [joiningActivityId, setJoiningActivityId] = useState<string | null>(null);
  const [joiningName, setJoiningName] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  async function joinSelectedDay(
    event: React.FormEvent<HTMLFormElement>,
    activity: ClubActivity,
  ) {
    event.preventDefault();
    setJoinError("");
    setJoinLoading(true);
    try {
      const response = await fetch(`/api/activities/${activity.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joiningName }),
      });
      const data = (await response.json()) as { name?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể đăng ký.");
      if (!data.name) throw new Error("Máy chủ không xác nhận đăng ký.");
      onActivityJoined(activity.id, data.name);
      setJoiningName("");
      setJoiningActivityId(null);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Không thể đăng ký.");
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <section className="activity-calendar-section">
      <div className="scheduled-heading">
        <div>
          <span className="section-kicker">LỊCH CÂU LẠC BỘ</span>
          <h2>Hoạt động trong tháng<span className="hero-period">.</span></h2>
        </div>
        <button className="button-primary" type="button" onClick={onCreateActivity}>
          <span className="create-button-plus">+</span> Tạo hoạt động
        </button>
      </div>
      {activitiesError && (
        <div className="error-panel" role="alert">
          <span>Chưa thể tải hoạt động</span>
          <p>{activitiesError}</p>
          <button className="button-quiet" onClick={onRetryActivities}>
            Thử tải lại ↻
          </button>
        </div>
      )}
      <div className="calendar-layout">
        <section className="calendar-panel">
          <div className="calendar-toolbar">
            <div className="month-navigation">
              <button
                className="icon-button"
                aria-label="Tháng trước"
                onClick={() => onMoveMonth(-1)}
              >
                ‹
              </button>
              <h2>{formatMonth(anchorDate)}</h2>
              <button
                className="icon-button"
                aria-label="Tháng sau"
                onClick={() => onMoveMonth(1)}
              >
                ›
              </button>
            </div>
          </div>
          <MonthGrid
            days={period}
            className="calendar-grid month"
            renderDay={(day) => {
              const key = dateKey(day);
              const hasActivities = activities.some(
                (activity) =>
                  activity.scheduleType !== "poll" &&
                  activity.date !== null &&
                  (activity.day ?? dateKey(new Date(activity.date))) === key,
              );
              const hasRepeatingActivity = activities.some(
                (activity) =>
                  activity.scheduleType !== "poll" &&
                  activity.recurrenceSeriesId !== undefined &&
                  activity.date !== null &&
                  (activity.day ?? dateKey(new Date(activity.date))) === key,
              );
              const hasPollVotes = activities.some(
                (activity) => (activity.votes?.[key]?.length ?? 0) > 0,
              );
              const dayStatus = [
                hasActivities
                  ? hasRepeatingActivity
                    ? "có hoạt động lặp lại"
                    : "có hoạt động"
                  : "",
                hasPollVotes ? "có bình chọn" : "",
              ]
                .filter(Boolean)
                .join(", ");
              const outsideMonth = day.getMonth() !== anchorDate.getMonth();
              return (
                <button
                  key={key}
                  className={`day-cell ${selectedDate === key ? "day-selected" : ""} ${outsideMonth ? "day-outside" : ""} ${key === dateKey(new Date()) ? "day-today" : ""}`}
                  onClick={() => onSelectDate(key, outsideMonth, day)}
                  aria-pressed={selectedDate === key}
                  aria-label={`${weekdayLong[(day.getDay() + 6) % 7]}, ${formatDate(day, { day: "numeric", month: "long" })}, ${dayStatus || "chưa có hoạt động"}`}
                >
                  <span>{day.getDate()}</span>
                  {hasActivities && (
                    <i
                      className={`day-indicator ${hasRepeatingActivity ? "repeat-indicator" : ""}`}
                      aria-hidden="true"
                    />
                  )}
                  {hasPollVotes && (
                    <i className="day-indicator poll-indicator" aria-hidden="true" />
                  )}
                </button>
              );
            }}
          />
          <div className="calendar-legend">
            <span><i className="legend-dot active-dot" /> Ngày đã chọn</span>
            <span><i className="legend-dot registered-dot" /> Có hoạt động</span>
            <span><i className="legend-dot repeat-legend-dot" /> Có hoạt động lặp</span>
            <span><i className="legend-dot poll-legend-dot" /> Có bình chọn</span>
          </div>
        </section>

        <aside className="signup-panel">
          <div className="signup-date">
            <span className="section-kicker">HOẠT ĐỘNG TRONG NGÀY</span>
            <h2>{formatDate(new Date(`${selectedDate}T00:00:00`), { day: "2-digit" })}</h2>
            <div>
              <strong>{weekdayLong[(new Date(`${selectedDate}T00:00:00`).getDay() + 6) % 7]}</strong>
              <span>{formatDate(new Date(`${selectedDate}T00:00:00`), { month: "long", year: "numeric" })}</span>
            </div>
          </div>
          <button
            className="button-primary selected-day-create-button"
            type="button"
            onClick={onCreateQuickSignup}
          >
            + Tạo đăng ký nhanh
          </button>
          {activitiesLoading ? (
            <div className="loading-panel">Đang tải hoạt động...</div>
          ) : activitiesForSelectedDate.length ? (
            <div className="selected-day-activities">
              {activitiesForSelectedDate.map((activity) => (
                <article
                  className="selected-day-activity"
                  key={activity.id}
                >
                  <span className={`category-label ${categoryColor(activity.category)}`}>
                    {activity.kind === "quick-signup" ? "ĐĂNG KÝ NHANH" : activity.category}
                  </span>
                  <strong>{activity.title}</strong>
                  {activity.repeat && (
                    <span className="selected-day-repeat">
                      Lặp{" "}
                      {activity.repeat.interval === "daily"
                        ? "hằng ngày"
                        : activity.repeat.interval === "weekly"
                          ? "hằng tuần"
                          : "hằng tháng"}
                      {" · đăng ký ngày "}
                      {formatDate(new Date(`${selectedDate}T00:00:00`), {
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  )}
                  <span>
                    {activity.kind !== "quick-signup" &&
                      (activity.date
                        ? `${formatDate(new Date(activity.date), { hour: "2-digit", minute: "2-digit" })} · `
                        : "Chưa chốt giờ · ")}
                    {activity.participants.length} người đăng ký
                  </span>
                  <div className="selected-day-activity-actions">
                    <button
                      className="button-secondary selected-day-open-button"
                      type="button"
                      onClick={() => onOpenActivity(activity)}
                    >
                      Xem chi tiết
                    </button>
                    <button
                      className="button-primary selected-day-join-toggle"
                      type="button"
                      aria-label={`Đăng ký ${activity.title} ngày ${selectedDate}`}
                      aria-expanded={joiningActivityId === activity.id}
                      onClick={() => {
                        setJoinError("");
                        setJoiningActivityId((current) =>
                          current === activity.id ? null : activity.id,
                        );
                      }}
                    >
                      +
                    </button>
                  </div>
                  {joiningActivityId === activity.id && (
                    <form
                      className="selected-day-join-form"
                      onSubmit={(event) => void joinSelectedDay(event, activity)}
                    >
                      <label htmlFor={`quick-join-${activity.id}`}>
                        Đăng ký ngày{" "}
                        {formatDate(new Date(`${selectedDate}T00:00:00`), {
                          day: "numeric",
                          month: "long",
                        })}
                      </label>
                      <div>
                        <input
                          id={`quick-join-${activity.id}`}
                          value={joiningName}
                          onChange={(event) => setJoiningName(event.target.value)}
                          placeholder="Nhập tên của bạn"
                          minLength={2}
                          maxLength={40}
                          required
                        />
                        <button className="button-primary" disabled={joinLoading}>
                          {joinLoading ? "..." : "Đăng ký"}
                        </button>
                      </div>
                      {joinError && <p className="modal-error" role="alert">{joinError}</p>}
                    </form>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-day-activities">
              Chưa có đăng ký hoạt động trong ngày này. Hãy tạo hoạt động để mọi người cùng tham gia.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
