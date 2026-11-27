"use client";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Repeat, UserPlus, Users, X } from "lucide-react";
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
  weekdayShortKeys,
} from "@/lib/club-ui";
import { MonthGrid } from "./month-grid";

const FILTER_CATEGORIES = [
  "ALL",
  "CẦU LÔNG",
  "THỂ THAO",
  "TỪ THIỆN",
  "GIẢI TRÍ",
  "CÂU LẠC BỘ",
] as const;

type CategoryFilter = (typeof FILTER_CATEGORIES)[number];

type ActivityCalendarProps = {
  anchorDate: Date;
  period: Date[];
  selectedDate: string;
  dateFilterActive: boolean;
  activities: ClubActivity[];
  activitiesError: string;
  activitiesLoading: boolean;
  canInteract: boolean;
  loginHref: string;
  announcementsNode?: React.ReactNode;
  onMoveMonth: (direction: number) => void;
  onGoToToday: () => void;
  onSelectDate: (date: string, outsideMonth: boolean, day: Date) => void;
  onClearDateFilter: () => void;
  onRetryActivities: () => void;
  onOpenActivity: (activity: ClubActivity) => void;
  onActivityJoined: (activityId: string, name: string) => void;
};

function activityDayKey(activity: ClubActivity): string | null {
  if (activity.scheduleType === "poll" || activity.date === null) return null;
  return activity.day ?? dateKey(new Date(activity.date));
}

function ActivityCalendarSectionBase({
  anchorDate,
  period,
  selectedDate,
  dateFilterActive,
  activities,
  activitiesError,
  activitiesLoading,
  canInteract,
  loginHref,
  announcementsNode,
  onMoveMonth,
  onGoToToday,
  onSelectDate,
  onClearDateFilter,
  onRetryActivities,
  onOpenActivity,
  onActivityJoined,
}: ActivityCalendarProps) {
  const { t, intlLocale } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("ALL");
  const [showPast, setShowPast] = useState(false);
  const [joiningActivityId, setJoiningActivityId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  const todayKey = dateKey(new Date());
  const selectedDay = new Date(`${selectedDate}T00:00:00`);
  const selectedDayLabel = formatDate(selectedDay, intlLocale, {
    day: "numeric",
    month: "long",
  });

  const scheduledActivities = useMemo(() => {
    return activities
      .filter((activity) => activityDayKey(activity) !== null)
      .filter((activity) => selectedCategory === "ALL" || activity.category === selectedCategory);
  }, [activities, selectedCategory]);

  const { visibleActivities, pastCount } = useMemo(() => {
    if (dateFilterActive) {
      const forDay = scheduledActivities
        .filter((activity) => activityDayKey(activity) === selectedDate)
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
      return { visibleActivities: forDay, pastCount: 0 };
    }

    const upcoming: ClubActivity[] = [];
    const past: ClubActivity[] = [];
    for (const activity of scheduledActivities) {
      const key = activityDayKey(activity);
      if (key && key >= todayKey) {
        upcoming.push(activity);
      } else {
        past.push(activity);
      }
    }
    upcoming.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    past.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    return {
      visibleActivities: showPast ? [...upcoming, ...past] : upcoming,
      pastCount: past.length,
    };
  }, [scheduledActivities, dateFilterActive, selectedDate, todayKey, showPast]);

  async function joinActivity(
    event: React.FormEvent<HTMLFormElement>,
    activity: ClubActivity,
  ) {
    event.preventDefault();
    setJoinError("");
    setJoinLoading(true);
    try {
      const data = await apiJson<{ name?: string }>(
        `/api/activities/${activity.id}/join`,
        { method: "POST" },
      );
      if (!data.name) throw new Error(t("club.calendar.joinNotConfirmed"));
      onActivityJoined(activity.id, data.name);
      setJoiningActivityId(null);
    } catch (error) {
      setJoinError(errorMessage(error, t("club.calendar.joinFailed")));
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <section className="agenda-hub">
      <div className="agenda-filter-bar" role="region" aria-label={t("club.activities.title")}>
        <div className="agenda-category-pills" role="tablist">
          {FILTER_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={selectedCategory === category}
              className={`agenda-pill${selectedCategory === category ? " active" : ""}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category === "ALL" ? t("club.agenda.allCategories") : categoryLabel(t, category)}
            </button>
          ))}
        </div>
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

      <div className="agenda-layout">
        <div className="agenda-main">
          <div className="agenda-section-head">
            <h2>
              <CalendarDays size={18} aria-hidden="true" />
              {dateFilterActive
                ? t("club.agenda.dayHeading", { date: selectedDayLabel })
                : t("club.agenda.upcomingHeading")}
            </h2>
            {dateFilterActive && (
              <button
                type="button"
                className="agenda-clear-date"
                onClick={onClearDateFilter}
              >
                <X size={14} aria-hidden="true" /> {t("club.agenda.clearDateFilter")}
              </button>
            )}
          </div>

          {activitiesLoading ? (
            <div className="loading-panel">{t("club.calendar.loading")}</div>
          ) : visibleActivities.length ? (
            <div className="agenda-list">
              {visibleActivities.map((activity) => {
                const dayStr = activityDayKey(activity) ?? todayKey;
                const dayObj = new Date(`${dayStr}T00:00:00`);
                const isPast = dayStr < todayKey;
                const activityDayLabel = formatDate(dayObj, intlLocale, {
                  day: "numeric",
                  month: "long",
                });
                const timeLabel = activity.date
                  ? formatDate(new Date(activity.date), intlLocale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : t("club.calendar.timeUnset");

                return (
                  <article
                    key={activity.id}
                    className={`agenda-card${isPast ? " is-past" : ""}`}
                  >
                    <div className="agenda-date-badge" aria-hidden="true">
                      <span className="agenda-date-weekday">
                        {t(weekdayShortKeys[mondayIndex(dayObj)])}
                      </span>
                      <strong className="agenda-date-day">
                        {formatDate(dayObj, intlLocale, { day: "2-digit" })}
                      </strong>
                      <span className="agenda-date-month">
                        {formatDate(dayObj, intlLocale, { month: "short" })}
                      </span>
                    </div>

                    <div className="agenda-card-body">
                      <div className="agenda-card-tags">
                        <span className={`category-label ${categoryColor(activity.category)}`}>
                          {activity.kind === "quick-signup"
                            ? t("club.categories.quickSignup")
                            : categoryLabel(t, activity.category)}
                        </span>
                        {activity.repeat && (
                          <span className="agenda-repeat-pill">
                            <Repeat size={11} aria-hidden="true" />
                            {t("club.repeat.label", {
                              interval: t(repeatIntervalKeys[activity.repeat.interval]),
                            })}
                          </span>
                        )}
                      </div>

                      <h3 className="agenda-card-title">
                        <button type="button" onClick={() => onOpenActivity(activity)}>
                          {activity.title}
                        </button>
                      </h3>

                      {activity.description && (
                        <p className="agenda-card-desc">{activity.description}</p>
                      )}

                      <div className="agenda-card-meta">
                        {activity.kind !== "quick-signup" && (
                          <span>
                            <Clock size={13} aria-hidden="true" /> {timeLabel}
                          </span>
                        )}
                        <span>
                          <Users size={13} aria-hidden="true" />{" "}
                          {t("club.calendar.participants", { count: activity.participants.length })}
                        </span>
                      </div>

                      <div className="agenda-card-actions">
                        <button
                          className="button-secondary agenda-action-btn"
                          type="button"
                          onClick={() => onOpenActivity(activity)}
                        >
                          {t("club.calendar.viewDetail")}
                        </button>
                        {!isPast &&
                          (canInteract ? (
                            <button
                              className="button-primary agenda-action-btn"
                              type="button"
                              aria-label={t("club.calendar.joinAria", {
                                title: activity.title,
                                date: activityDayLabel,
                              })}
                              aria-expanded={joiningActivityId === activity.id}
                              onClick={() => {
                                setJoinError("");
                                setJoiningActivityId((current) =>
                                  current === activity.id ? null : activity.id,
                                );
                              }}
                            >
                              <UserPlus size={14} aria-hidden="true" /> {t("club.agenda.join")}
                            </button>
                          ) : (
                            <Link
                              className="button-primary agenda-action-btn"
                              href={loginHref}
                              aria-label={t("club.auth.loginToParticipate")}
                            >
                              <UserPlus size={14} aria-hidden="true" /> {t("club.agenda.join")}
                            </Link>
                          ))}
                      </div>

                      {joiningActivityId === activity.id && (
                        <form
                          className="selected-day-join-form"
                          onSubmit={(event) => void joinActivity(event, activity)}
                        >
                          <p>{t("club.calendar.joinOnDay", { date: activityDayLabel })}</p>
                          <div>
                            <button className="button-primary" disabled={joinLoading}>
                              {joinLoading ? "..." : t("club.calendar.register")}
                            </button>
                          </div>
                          {joinError && (
                            <p className="modal-error" role="alert">
                              {joinError}
                            </p>
                          )}
                        </form>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="agenda-empty-card">
              <p>
                {dateFilterActive
                  ? t("club.calendar.empty")
                  : selectedCategory !== "ALL"
                    ? t("club.agenda.emptyFilter")
                    : t("club.agenda.emptyUpcoming")}
              </p>
              {dateFilterActive && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={onClearDateFilter}
                >
                  {t("club.agenda.clearDateFilter")}
                </button>
              )}
            </div>
          )}

          {!dateFilterActive && !activitiesLoading && pastCount > 0 && (
            <div className="agenda-past-toggle">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setShowPast((current) => !current)}
              >
                {showPast
                  ? t("club.agenda.pastToggleHide")
                  : t("club.agenda.pastToggleShow", { count: pastCount })}
              </button>
            </div>
          )}
        </div>

        <aside className="agenda-sidebar">
          <section className="agenda-calendar-card">
            <div className="agenda-calendar-head">
              <div className="agenda-calendar-nav">
                <button
                  type="button"
                  className="calendar-mini-nav"
                  aria-label={t("club.calendar.prevMonth")}
                  onClick={() => onMoveMonth(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <strong>{formatMonth(anchorDate, intlLocale)}</strong>
                <button
                  type="button"
                  className="calendar-mini-nav"
                  aria-label={t("club.calendar.nextMonth")}
                  onClick={() => onMoveMonth(1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button type="button" className="agenda-today-btn" onClick={onGoToToday}>
                {t("club.agenda.today")}
              </button>
            </div>

            <MonthGrid
              days={period}
              className="calendar-grid month agenda-month-grid"
              renderDay={(day) => {
                const key = dateKey(day);
                const hasActivities = scheduledActivities.some(
                  (activity) => activityDayKey(activity) === key,
                );
                const hasRepeatingActivity = scheduledActivities.some(
                  (activity) =>
                    activity.recurrenceSeriesId != null && activityDayKey(activity) === key,
                );
                const dayStatus = hasActivities
                  ? hasRepeatingActivity
                    ? t("club.calendar.dayStatus.hasRepeat")
                    : t("club.calendar.dayStatus.hasActivity")
                  : t("club.calendar.dayStatus.none");
                const outsideMonth = day.getMonth() !== anchorDate.getMonth();
                const isSelected = dateFilterActive && selectedDate === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`day-cell ${isSelected ? "day-selected" : ""} ${outsideMonth ? "day-outside" : ""} ${key === todayKey ? "day-today" : ""}`}
                    onClick={() => onSelectDate(key, outsideMonth, day)}
                    aria-pressed={isSelected}
                    aria-label={`${t(weekdayLongKeys[mondayIndex(day)])}, ${formatDate(day, intlLocale, { day: "numeric", month: "long" })}, ${dayStatus}`}
                  >
                    <span>{day.getDate()}</span>
                    {hasActivities && (
                      <i
                        className={`day-indicator ${hasRepeatingActivity ? "repeat-indicator" : ""}`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              }}
            />
            <div className="calendar-legend agenda-calendar-legend">
              <span>
                <i className="legend-dot active-dot" /> {t("club.calendar.legend.selected")}
              </span>
              <span>
                <i className="legend-dot registered-dot" /> {t("club.calendar.legend.hasActivity")}
              </span>
              <span>
                <i className="legend-dot repeat-legend-dot" /> {t("club.calendar.legend.hasRepeat")}
              </span>
            </div>
          </section>

          {announcementsNode}
        </aside>
      </div>
    </section>
  );
}

export const ActivityCalendarSection = memo(ActivityCalendarSectionBase);
