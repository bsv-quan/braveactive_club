"use client";

import { memo, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  HeartHandshake,
  Layers,
  type LucideIcon,
  MapPin,
  Repeat,
  RotateCcw,
  Search,
  Trophy,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { apiJson, errorMessage } from "@/lib/api/client";
import { upcomingDayOffset, type ClubActivity } from "@/lib/activities";
import { foldSearchText } from "@/lib/community-filters";
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

const CATEGORY_FILTER_ICONS: Record<CategoryFilter, LucideIcon> = {
  ALL: Layers,
  "CẦU LÔNG": Trophy,
  "THỂ THAO": Activity,
  "TỪ THIỆN": HeartHandshake,
  "GIẢI TRÍ": Clapperboard,
  "CÂU LẠC BỘ": Users,
};

const CATEGORY_ACCENT_CLASS: Record<CategoryFilter, string> = {
  ALL: "is-all",
  "CẦU LÔNG": "is-sports",
  "THỂ THAO": "is-lifestyle",
  "TỪ THIỆN": "is-society",
  "GIẢI TRÍ": "is-entertainment",
  "CÂU LẠC BỘ": "is-technology",
};

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

function matchesActivityQuery(activity: ClubActivity, rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean).slice(0, 6);
  const rawHaystack = [
    activity.title,
    activity.description,
    activity.location ?? "",
    activity.creator,
    activity.category,
  ]
    .join(" ")
    .toLowerCase();
  const foldedHaystack = foldSearchText(rawHaystack);
  return tokens.every((token) => {
    const lowered = token.toLowerCase();
    const isAscii = [...lowered].every((ch) => ch.charCodeAt(0) <= 127);
    return isAscii
      ? foldedHaystack.includes(foldSearchText(lowered))
      : rawHaystack.includes(lowered);
  });
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
  const searchInputId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
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
      .filter((activity) => selectedCategory === "ALL" || activity.category === selectedCategory)
      .filter((activity) => matchesActivityQuery(activity, searchQuery));
  }, [activities, selectedCategory, searchQuery]);

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

  const hasAnyFilter =
    selectedCategory !== "ALL" || searchQuery.trim().length > 0 || dateFilterActive;

  function resetAllFilters() {
    setSelectedCategory("ALL");
    setSearchQuery("");
    if (dateFilterActive) onClearDateFilter();
  }

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
      <search className="community-discovery activities-discovery" aria-label={t("club.activities.title")}>
        <form
          className="community-search-form"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor={searchInputId} className="community-sr-only">
            {t("club.agenda.searchPlaceholder")}
          </label>
          <span className="community-search-icon" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            ref={searchInputRef}
            id={searchInputId}
            className="community-search-input"
            type="search"
            name="q"
            value={searchQuery}
            maxLength={100}
            placeholder={t("club.agenda.searchPlaceholder")}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229) return;
              if (event.key === "Escape" && searchQuery) {
                event.preventDefault();
                setSearchQuery("");
              }
            }}
          />
          {searchQuery ? (
            <button
              type="button"
              className="community-search-clear"
              aria-label={t("club.agenda.clearSearch")}
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </form>

        <div className="community-section-strip" role="group" aria-label={t("club.activities.title")}>
          {FILTER_CATEGORIES.map((category) => {
            const selected = selectedCategory === category;
            const CategoryIcon = CATEGORY_FILTER_ICONS[category];
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                className={`community-section-tab ${CATEGORY_ACCENT_CLASS[category]}${selected ? " is-active" : ""}`}
                onClick={() => setSelectedCategory(category)}
              >
                <CategoryIcon size={14} className="community-section-tab-icon" aria-hidden="true" />
                <span className="community-section-tab-label">
                  {category === "ALL" ? t("club.agenda.allCategories") : categoryLabel(t, category)}
                </span>
              </button>
            );
          })}
        </div>
      </search>

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
            {hasAnyFilter && (
              <button
                type="button"
                className="agenda-clear-date"
                onClick={resetAllFilters}
              >
                <RotateCcw size={13} aria-hidden="true" />{" "}
                {dateFilterActive ? t("club.agenda.clearDateFilter") : t("club.agenda.resetFilters")}
              </button>
            )}
          </div>

          {activitiesLoading ? (
            <div className="feed-skeletons" aria-busy="true">
              {[0, 1, 2].map((index) => (
                <div key={index} className="post-skeleton" />
              ))}
            </div>
          ) : visibleActivities.length ? (
            <div className="agenda-list">
              {visibleActivities.map((activity) => {
                const dayStr = activityDayKey(activity) ?? todayKey;
                const dayObj = new Date(`${dayStr}T00:00:00`);
                const isPast = dayStr < todayKey;
                const dayOffset = upcomingDayOffset(dayStr);
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

                const urgencyLabel = isPast
                  ? t("club.agenda.pastBadge")
                  : dayOffset === 0
                    ? t("community.sideRail.todayBadge")
                    : dayOffset === 1
                      ? t("community.sideRail.tomorrowBadge")
                      : dayOffset > 1 && dayOffset <= 7
                        ? t("community.sideRail.inDaysBadge", { count: dayOffset })
                        : null;

                return (
                  <article
                    key={activity.id}
                    className={`agenda-card${isPast ? " is-past" : ""}${dayOffset === 0 ? " is-today-event" : ""}`}
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
                        {urgencyLabel ? (
                          <span
                            className={`agenda-urgency-pill${
                              dayOffset === 0
                                ? " is-today"
                                : dayOffset === 1
                                  ? " is-soon"
                                  : isPast
                                    ? " is-past"
                                    : ""
                            }`}
                          >
                            {urgencyLabel}
                          </span>
                        ) : null}
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
                        {activity.location ? (
                          <span className="agenda-card-location">
                            <MapPin size={13} aria-hidden="true" /> {activity.location}
                          </span>
                        ) : null}
                        <span>
                          <Users size={13} aria-hidden="true" />{" "}
                          {t("club.calendar.participants", { count: activity.participants.length })}
                        </span>
                        <span>
                          <User size={13} aria-hidden="true" /> {activity.creator}
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
            <div className="feed-empty-card agenda-empty-state">
              <span className="feed-empty-icon" aria-hidden="true">
                <CalendarDays size={24} />
              </span>
              <strong>
                {dateFilterActive
                  ? t("club.calendar.empty")
                  : hasAnyFilter
                    ? t("club.agenda.emptyFilter")
                    : t("club.agenda.emptyUpcoming")}
              </strong>
              {hasAnyFilter && (
                <button
                  type="button"
                  className="button-secondary agenda-action-btn"
                  onClick={resetAllFilters}
                >
                  <RotateCcw size={14} aria-hidden="true" />{" "}
                  {dateFilterActive ? t("club.agenda.clearDateFilter") : t("club.agenda.resetFilters")}
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
