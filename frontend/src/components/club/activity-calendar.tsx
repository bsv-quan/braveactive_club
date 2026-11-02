"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/i18n-provider";
import { apiJson, errorMessage } from "@/lib/api/client";
import type { ClubActivity } from "@/lib/activities";
import {
  categoryColor,
  categoryLabel,
  dateKey,
  formatDate,
  formatMonth,
  mondayIndex,
  repeatIntervalKeys,
  weekdayLongKeys,
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
  canInteract: boolean;
  loginHref: string;
  onMoveMonth: (direction: number) => void;
  onSelectDate: (date: string, outsideMonth: boolean, day: Date) => void;
  onRetryActivities: () => void;
  onCreateActivity: () => void;
  onCreateQuickSignup: () => void;
  onOpenActivity: (activity: ClubActivity) => void;
  onActivityJoined: (activityId: string, name: string) => void;
};

function ActivityCalendarSectionBase({
  anchorDate,
  period,
  selectedDate,
  activities,
  activitiesForSelectedDate,
  activitiesError,
  activitiesLoading,
  canInteract,
  loginHref,
  onMoveMonth,
  onSelectDate,
  onRetryActivities,
  onCreateActivity,
  onCreateQuickSignup,
  onOpenActivity,
  onActivityJoined,
}: ActivityCalendarProps) {
  const { t, intlLocale } = useI18n();
  const [joiningActivityId, setJoiningActivityId] = useState<string | null>(null);
  const [joiningName, setJoiningName] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const selectedDay = new Date(`${selectedDate}T00:00:00`);
  const selectedDayLabel = formatDate(selectedDay, intlLocale, {
    day: "numeric",
    month: "long",
  });

  async function joinSelectedDay(
    event: React.FormEvent<HTMLFormElement>,
    activity: ClubActivity,
  ) {
    event.preventDefault();
    setJoinError("");
    setJoinLoading(true);
    try {
      const data = await apiJson<{ name?: string }>(
        `/api/activities/${activity.id}/join`,
        { method: "POST", json: { name: joiningName } },
      );
      if (!data.name) throw new Error(t("club.calendar.joinNotConfirmed"));
      onActivityJoined(activity.id, data.name);
      setJoiningName("");
      setJoiningActivityId(null);
    } catch (error) {
      setJoinError(errorMessage(error, t("club.calendar.joinFailed")));
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <section className="activity-calendar-section">
      <div className="scheduled-heading">
        <div>
          <span className="section-kicker">{t("club.calendar.kicker")}</span>
          <h2>{t("club.calendar.title")}<span className="hero-period">.</span></h2>
        </div>
        {canInteract ? (
          <button className="button-primary" type="button" onClick={onCreateActivity}>
            <span className="create-button-plus">+</span> {t("club.calendar.createActivity")}
          </button>
        ) : (
          <Link className="button-primary" href={loginHref}>
            <span className="create-button-plus">+</span> {t("club.calendar.createActivity")}
          </Link>
        )}
      </div>
      {activitiesError && (
        <div className="error-panel" role="alert">
          <span>{t("club.calendar.loadErrorTitle")}</span>
          <p>{activitiesError}</p>
          <button className="button-quiet" onClick={onRetryActivities}>
            {t("club.retry")}
          </button>
        </div>
      )}
      <div className="calendar-layout">
        <section className="calendar-panel">
          <div className="calendar-toolbar">
            <div className="month-navigation">
              <button
                className="icon-button"
                aria-label={t("club.calendar.prevMonth")}
                onClick={() => onMoveMonth(-1)}
              >
                ‹
              </button>
              <h2>{formatMonth(anchorDate, intlLocale)}</h2>
              <button
                className="icon-button"
                aria-label={t("club.calendar.nextMonth")}
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
                  activity.recurrenceSeriesId != null &&
                  activity.date !== null &&
                  (activity.day ?? dateKey(new Date(activity.date))) === key,
              );
              const hasPollVotes = activities.some(
                (activity) => (activity.votes?.[key]?.length ?? 0) > 0,
              );
              const dayStatus = [
                hasActivities
                  ? hasRepeatingActivity
                    ? t("club.calendar.dayStatus.hasRepeat")
                    : t("club.calendar.dayStatus.hasActivity")
                  : "",
                hasPollVotes ? t("club.calendar.dayStatus.hasPoll") : "",
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
                  aria-label={`${t(weekdayLongKeys[mondayIndex(day)])}, ${formatDate(day, intlLocale, { day: "numeric", month: "long" })}, ${dayStatus || t("club.calendar.dayStatus.none")}`}
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
            <span><i className="legend-dot active-dot" /> {t("club.calendar.legend.selected")}</span>
            <span><i className="legend-dot registered-dot" /> {t("club.calendar.legend.hasActivity")}</span>
            <span><i className="legend-dot repeat-legend-dot" /> {t("club.calendar.legend.hasRepeat")}</span>
            <span><i className="legend-dot poll-legend-dot" /> {t("club.calendar.legend.hasPoll")}</span>
          </div>
        </section>

        <aside className="signup-panel">
          <div className="signup-date">
            <span className="section-kicker">{t("club.calendar.dayKicker")}</span>
            <h2>{formatDate(selectedDay, intlLocale, { day: "2-digit" })}</h2>
            <div>
              <strong>{t(weekdayLongKeys[mondayIndex(selectedDay)])}</strong>
              <span>{formatDate(selectedDay, intlLocale, { month: "long", year: "numeric" })}</span>
            </div>
          </div>
          {canInteract ? (
            <button
              className="button-primary selected-day-create-button"
              type="button"
              onClick={onCreateQuickSignup}
            >
              {t("club.calendar.quickCreate")}
            </button>
          ) : (
            <Link className="button-primary selected-day-create-button" href={loginHref}>
              {t("club.calendar.quickCreate")}
            </Link>
          )}
          {activitiesLoading ? (
            <div className="loading-panel">{t("club.calendar.loading")}</div>
          ) : activitiesForSelectedDate.length ? (
            <div className="selected-day-activities">
              {activitiesForSelectedDate.map((activity) => (
                <article
                  className="selected-day-activity"
                  key={activity.id}
                >
                  <span className={`category-label ${categoryColor(activity.category)}`}>
                    {activity.kind === "quick-signup"
                      ? t("club.categories.quickSignup")
                      : categoryLabel(t, activity.category)}
                  </span>
                  <strong>{activity.title}</strong>
                  {activity.repeat && (
                    <span className="selected-day-repeat">
                      {t("club.repeat.labelOnDay", {
                        interval: t(repeatIntervalKeys[activity.repeat.interval]),
                        date: selectedDayLabel,
                      })}
                    </span>
                  )}
                  <span>
                    {activity.kind !== "quick-signup" &&
                      (activity.date
                        ? `${formatDate(new Date(activity.date), intlLocale, { hour: "2-digit", minute: "2-digit" })} · `
                        : `${t("club.calendar.timeUnset")} · `)}
                    {t("club.calendar.participants", { count: activity.participants.length })}
                  </span>
                  <div className="selected-day-activity-actions">
                    <button
                      className="button-secondary selected-day-open-button"
                      type="button"
                      onClick={() => onOpenActivity(activity)}
                    >
                      {t("club.calendar.viewDetail")}
                    </button>
                    {canInteract ? (
                      <button
                        className="button-primary selected-day-join-toggle"
                        type="button"
                        aria-label={t("club.calendar.joinAria", {
                          title: activity.title,
                          date: selectedDayLabel,
                        })}
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
                    ) : (
                      <Link
                        className="button-primary selected-day-join-toggle"
                        href={loginHref}
                        aria-label={t("club.auth.loginToParticipate")}
                      >
                        +
                      </Link>
                    )}
                  </div>
                  {joiningActivityId === activity.id && (
                    <form
                      className="selected-day-join-form"
                      onSubmit={(event) => void joinSelectedDay(event, activity)}
                    >
                      <label htmlFor={`quick-join-${activity.id}`}>
                        {t("club.calendar.joinOnDay", { date: selectedDayLabel })}
                      </label>
                      <div>
                        <input
                          id={`quick-join-${activity.id}`}
                          value={joiningName}
                          onChange={(event) => setJoiningName(event.target.value)}
                          placeholder={t("club.calendar.namePlaceholder")}
                          minLength={2}
                          maxLength={40}
                          required
                        />
                        <button className="button-primary" disabled={joinLoading}>
                          {joinLoading ? "..." : t("club.calendar.register")}
                        </button>
                      </div>
                      {joinError && <p className="modal-error" role="alert">{joinError}</p>}
                    </form>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-day-activities">{t("club.calendar.empty")}</p>
          )}
        </aside>
      </div>
    </section>
  );
}

export const ActivityCalendarSection = memo(ActivityCalendarSectionBase);
