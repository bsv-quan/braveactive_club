"use client";

import {
  Activity,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Gamepad2,
  MapPin,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ClubActivity } from "@/lib/activities";
import { activityDay, selectUpcomingActivities, upcomingDayOffset } from "@/lib/activities";
import { apiJson } from "@/lib/api/client";
import { useI18n } from "@/i18n/i18n-provider";
import { categoryLabel, dateKey, weekdayShortKeys } from "@/lib/club-ui";

type Props = {
  activities?: ClubActivity[];
  loading?: boolean;
  streakDays?: number | null;
};

export function CommunitySideRail({
  activities: externalActivities,
  loading: externalLoading,
  streakDays,
}: Props = {}) {
  const { t, intlLocale } = useI18n();
  const [fetchedActivities, setFetchedActivities] = useState<ClubActivity[]>([]);
  const [fetchedLoading, setFetchedLoading] = useState(externalActivities === undefined);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    if (externalActivities !== undefined) return;
    let active = true;
    void apiJson<{ activities?: ClubActivity[] }>("/api/activities", { cache: "no-store" })
      .then((result) => {
        if (active) setFetchedActivities(result.activities ?? []);
      })
      .catch(() => {
        if (active) setFetchedActivities([]);
      })
      .finally(() => {
        if (active) setFetchedLoading(false);
      });
    return () => {
      active = false;
    };
  }, [externalActivities]);

  const activities = externalActivities ?? fetchedActivities;
  const isLoading = externalLoading ?? fetchedLoading;
  const todayStr = useMemo(() => dateKey(new Date()), []);

  const upcoming = useMemo(() => selectUpcomingActivities(activities, new Date(), 3), [activities]);

  const eventDays = useMemo(() => {
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    return new Set(
      activities
        .filter((item) => item.scheduleType === "scheduled")
        .map(activityDay)
        .filter((day): day is string => Boolean(day?.startsWith(prefix))),
    );
  }, [activities, month]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [month]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(month),
    [intlLocale, month],
  );
  const fullDayFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    [intlLocale],
  );
  const monthShortFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: "short" }),
    [intlLocale],
  );
  const weekdayTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { weekday: "short", hour: "numeric", minute: "2-digit" }),
    [intlLocale],
  );
  const weekdayOnlyFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { weekday: "short" }),
    [intlLocale],
  );

  function moveMonth(direction: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  return (
    <aside className="community-side-rail" aria-label={t("community.sideRail.label")}>
      <section className="community-upcoming-panel" aria-labelledby="community-upcoming-heading">
        <div className="community-upcoming-panel-head">
          <div className="community-upcoming-panel-title">
            <span className="community-upcoming-panel-icon" aria-hidden="true">
              <CalendarClock size={18} />
            </span>
            <div>
              <span className="community-calendar-kicker">{t("community.sideRail.calendarKicker")}</span>
              <h2 id="community-upcoming-heading">{t("community.sideRail.upcomingHeading")}</h2>
            </div>
          </div>
          <Link className="community-panel-link" href="/activities">
            {t("community.sideRail.viewAllActivities")} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {isLoading ? (
          <div className="community-upcoming-skeletons" aria-busy="true">
            <div className="community-upcoming-skeleton" />
            <div className="community-upcoming-skeleton" />
          </div>
        ) : upcoming.length > 0 ? (
          <ul className="community-upcoming-list" role="list">
            {upcoming.map(({ activity, day, detailId }) => {
              const dayDate = new Date(`${day}T00:00:00`);
              const monthShort = monthShortFormatter.format(dayDate);
              const dayNum = String(dayDate.getDate()).padStart(2, "0");
              const timeLabel = activity.date?.includes("T")
                ? weekdayTimeFormatter.format(new Date(activity.date))
                : weekdayOnlyFormatter.format(dayDate);
              const participantCount = activity.participants?.length ?? 0;
              const offset = upcomingDayOffset(day);
              const urgencyLabel =
                offset === 0
                  ? t("community.sideRail.todayBadge")
                  : offset === 1
                    ? t("community.sideRail.tomorrowBadge")
                    : offset > 1 && offset <= 7
                      ? t("community.sideRail.inDaysBadge", { count: offset })
                      : null;

              return (
                <li key={activity.id}>
                  <Link
                    className={`community-upcoming-item${offset === 0 ? " is-today-event" : ""}`}
                    href={`/activities/${encodeURIComponent(detailId)}`}
                  >
                    <span className="community-date-tile" aria-hidden="true">
                      <span className="community-date-tile-month">{monthShort}</span>
                      <strong className="community-date-tile-day">{dayNum}</strong>
                    </span>
                    <span className="community-upcoming-item-body">
                      <span className="community-upcoming-tags">
                        <span className="community-upcoming-cat">{categoryLabel(t, activity.category)}</span>
                        {urgencyLabel ? (
                          <span
                            className={`community-upcoming-badge${
                              offset === 0 ? " is-today" : offset === 1 ? " is-tomorrow" : ""
                            }`}
                          >
                            {urgencyLabel}
                          </span>
                        ) : null}
                      </span>
                      <strong>{activity.title}</strong>
                      <span className="community-upcoming-item-meta">
                        <span>
                          <Clock size={12} aria-hidden="true" /> {timeLabel}
                        </span>
                        {activity.location ? (
                          <span className="community-upcoming-item-loc">
                            <MapPin size={12} aria-hidden="true" /> {activity.location}
                          </span>
                        ) : null}
                        {participantCount > 0 ? (
                          <span className="community-upcoming-going">
                            <Users size={12} aria-hidden="true" />{" "}
                            {t("community.sideRail.participantsCount", { count: participantCount })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight className="community-upcoming-chevron" size={16} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="community-upcoming-empty">
            <p>{t("community.sideRail.upcomingEmpty")}</p>
          </div>
        )}

        <details className="community-calendar-disclosure">
          <summary className="community-calendar-summary">
            <CalendarDays size={15} aria-hidden="true" />
            <span>{t("community.sideRail.toggleCalendar")}</span>
            <ChevronRight className="community-calendar-summary-chevron" size={15} aria-hidden="true" />
          </summary>
          <div className="community-calendar-drawer">
            <div className="community-calendar-banner-head">
              <button
                type="button"
                className="calendar-mini-nav"
                onClick={() => moveMonth(-1)}
                aria-label={t("community.sideRail.prevMonth")}
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                className="calendar-mini-nav"
                onClick={() => moveMonth(1)}
                aria-label={t("community.sideRail.nextMonth")}
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="community-mini-weekdays" aria-hidden="true">
              {weekdayShortKeys.map((weekdayKey) => (
                <span key={weekdayKey}>{t(weekdayKey)}</span>
              ))}
            </div>
            <div className="community-mini-calendar" role="group" aria-label={t("community.sideRail.calendarAria")}>
              {days.map((day) => {
                const key = dateKey(day);
                const outside = day.getMonth() !== month.getMonth();
                const hasEvent = eventDays.has(key);
                const isToday = key === todayStr;
                const fullDate = fullDayFormatter.format(day);
                const label = hasEvent ? t("community.sideRail.calendarDayWithEvent", { date: fullDate }) : fullDate;
                const classes = [
                  outside ? "outside" : "",
                  isToday ? "is-today" : "",
                  hasEvent ? "has-event" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <Link
                    key={key}
                    href={`/activities?date=${key}`}
                    className={classes}
                    aria-label={label}
                    aria-current={isToday ? "date" : undefined}
                  >
                    {day.getDate()}
                  </Link>
                );
              })}
            </div>
            <Link className="community-calendar-open" href={`/activities?date=${todayStr}`}>
              <CalendarDays size={15} aria-hidden="true" /> {t("community.sideRail.openCalendar")}
            </Link>
          </div>
        </details>
      </section>

      <nav className="community-feature-cards" aria-label={t("community.sideRail.quickLinks")}>
        <Link className="community-feature-card is-training" href="/training">
          <span className="community-feature-icon" aria-hidden="true">
            <Activity size={20} />
          </span>
          <span className="community-feature-copy">
            <span className="community-feature-head">
              <strong>{t("nav.training")}</strong>
              <span className="community-feature-pill is-training">{t("community.sideRail.trainingBadge")}</span>
            </span>
            <span>{t("community.sideRail.trainingDesc")}</span>
            <span className="community-feature-cta">
              {t("community.sideRail.trainingCta")} <ArrowRight size={14} aria-hidden="true" />
            </span>
          </span>
        </Link>
        <Link className="community-feature-card is-games" href="/games">
          <span className="community-feature-icon" aria-hidden="true">
            <Gamepad2 size={20} />
          </span>
          <span className="community-feature-copy">
            <span className="community-feature-head">
              <strong>{t("community.games.tab")}</strong>
              <span className="community-feature-pill is-streak">
                <Flame size={12} aria-hidden="true" />
                {streakDays && streakDays > 0
                  ? t("community.sideRail.streakActive", { count: streakDays })
                  : t("community.sideRail.streakCheckIn")}
              </span>
            </span>
            <span>{t("community.sideRail.gamesDesc")}</span>
            <span className="community-feature-cta">
              {t("community.sideRail.gamesCta")} <ArrowRight size={14} aria-hidden="true" />
            </span>
          </span>
        </Link>
      </nav>
    </aside>
  );
}
