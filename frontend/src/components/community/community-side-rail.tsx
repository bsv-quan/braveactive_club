"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ClubActivity } from "@/lib/activities";
import { activityDay } from "@/lib/activities";
import { apiJson } from "@/lib/api/client";
import { useI18n } from "@/i18n/i18n-provider";
import { dateKey } from "@/lib/club-ui";

export function CommunitySideRail() {
  const { t, intlLocale } = useI18n();
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    let active = true;
    void apiJson<{ activities?: ClubActivity[] }>("/api/activities", { cache: "no-store" })
      .then((result) => {
        if (active) setActivities(result.activities ?? []);
      })
      .catch(() => {
        if (active) setActivities([]);
      });
    return () => { active = false; };
  }, []);

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

  const monthLabel = new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(month);

  function moveMonth(direction: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  return (
    <aside className="community-side-rail" aria-label={t("community.sideRail.label")}>
      <div className="community-calendar-banner">
        <div className="community-calendar-banner-head">
          <button type="button" className="calendar-mini-nav" onClick={() => moveMonth(-1)} aria-label={t("community.sideRail.prevMonth")}> <ChevronLeft size={14} /> </button>
          <strong>{monthLabel}</strong>
          <button type="button" className="calendar-mini-nav" onClick={() => moveMonth(1)} aria-label={t("community.sideRail.nextMonth")}> <ChevronRight size={14} /> </button>
        </div>
        <div className="community-mini-calendar" aria-label={t("community.sideRail.calendarAria")}>
          {days.map((day) => {
            const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
            const outside = day.getMonth() !== month.getMonth();
            return (
              <Link
                key={key}
                href={`/activities?date=${key}`}
                className={`${outside ? "outside" : ""} ${eventDays.has(key) ? "has-event" : ""}`}
                aria-label={key}
              >
                {day.getDate()}
              </Link>
            );
          })}
        </div>
        <Link className="community-calendar-open" href={`/activities?date=${dateKey(new Date())}`}><CalendarDays size={15} /> {t("community.sideRail.openCalendar")}</Link>
      </div>

      <nav className="community-accordion-rail" aria-label={t("community.sideRail.quickLinks")}>
        <Link className="community-accordion-tab" href="/training" aria-label={t("nav.training")}>
          <Dumbbell className="community-accordion-symbol" size={21} />
          <span className="community-accordion-label">{t("nav.training")}</span>
        </Link>
      </nav>
    </aside>
  );
}
