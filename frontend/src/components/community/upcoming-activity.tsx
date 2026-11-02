"use client";

import { CalendarClock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClubActivity } from "@/lib/activities";
import { activityDay } from "@/lib/activities";
import { apiJson, errorMessage } from "@/lib/api/client";
import { useI18n } from "@/i18n/i18n-provider";
import { dateKey } from "@/lib/club-ui";

export function UpcomingActivity() {
  const { t, intlLocale } = useI18n();
  const [activity, setActivity] = useState<ClubActivity | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await apiJson<{ activities?: ClubActivity[] }>("/api/activities", {
          cache: "no-store",
        });
        const now = new Date();
        const startDay = dateKey(now);
        const lastDay = new Date(now);
        lastDay.setDate(lastDay.getDate() + 7);
        const endDay = dateKey(lastDay);
        const nextActivity = (result.activities ?? [])
          .filter((item) => {
            const day = activityDay(item);
            if (!day || item.scheduleType !== "scheduled" || day < startDay || day > endDay) return false;
            if (item.date?.includes("T") && new Date(item.date) < now) return false;
            return true;
          })
          .sort((first, second) =>
            (activityDay(first) ?? "").localeCompare(activityDay(second) ?? ""),
          )[0] ?? null;
        if (active) setActivity(nextActivity);
      } catch (reason) {
        if (active) setError(errorMessage(reason, t("community.upcoming.loadError")));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [t]);

  if (error || !activity) return null;

  const day = activityDay(activity);
  const formattedDate = day
    ? new Intl.DateTimeFormat(intlLocale, { weekday: "short", month: "short", day: "numeric" }).format(
        new Date(`${day}T00:00:00`),
      )
    : "";
  const formattedTime = activity.date?.includes("T")
    ? new Intl.DateTimeFormat(intlLocale, { hour: "numeric", minute: "2-digit" }).format(new Date(activity.date))
    : "";

  return (
    <aside className="community-upcoming-sticky" aria-label={t("community.upcoming.title")}>
      <Link
        className="community-upcoming-card"
        href={`/activities/${encodeURIComponent(activity.id)}`}
      >
        <span className="community-upcoming-icon" aria-hidden>
          <CalendarClock size={19} />
        </span>
        <span className="community-upcoming-copy">
          <span className="community-upcoming-kicker">{t("community.upcoming.title")}</span>
          <strong>{activity.title}</strong>
          <span className="community-upcoming-meta">
            {formattedDate}{formattedTime ? ` · ${formattedTime}` : ""}
          </span>
        </span>
        <span className="community-upcoming-cta">
          {t("community.upcoming.view")} <ChevronRight size={17} aria-hidden />
        </span>
      </Link>
    </aside>
  );
}
