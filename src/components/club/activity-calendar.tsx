"use client";

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
}: ActivityCalendarProps) {
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
              const hasPollVotes = activities.some(
                (activity) => (activity.votes?.[key]?.length ?? 0) > 0,
              );
              const outsideMonth = day.getMonth() !== anchorDate.getMonth();
              return (
                <button
                  key={key}
                  className={`day-cell ${selectedDate === key ? "day-selected" : ""} ${outsideMonth ? "day-outside" : ""} ${key === dateKey(new Date()) ? "day-today" : ""}`}
                  onClick={() => onSelectDate(key, outsideMonth, day)}
                  aria-pressed={selectedDate === key}
                  aria-label={`${weekdayLong[(day.getDay() + 6) % 7]}, ${formatDate(day, { day: "numeric", month: "long" })}, ${hasActivities ? "có hoạt động" : "chưa có hoạt động"}`}
                >
                  <span>{day.getDate()}</span>
                  {(hasActivities || hasPollVotes) && (
                    <i
                      className={`day-indicator ${hasPollVotes ? "poll-indicator" : ""}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            }}
          />
          <div className="calendar-legend">
            <span><i className="legend-dot active-dot" /> Ngày đã chọn</span>
            <span><i className="legend-dot registered-dot" /> Có hoạt động</span>
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
                <button
                  className="selected-day-activity"
                  key={activity.id}
                  type="button"
                  onClick={() => onOpenActivity(activity)}
                >
                  <span className={`category-label ${categoryColor(activity.category)}`}>
                    {activity.kind === "quick-signup" ? "ĐĂNG KÝ NHANH" : activity.category}
                  </span>
                  <strong>{activity.title}</strong>
                  <span>
                    {activity.kind !== "quick-signup" &&
                      (activity.date
                        ? `${formatDate(new Date(activity.date), { hour: "2-digit", minute: "2-digit" })} · `
                        : "Chưa chốt giờ · ")}
                    {activity.participants.length} người đăng ký
                  </span>
                </button>
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
