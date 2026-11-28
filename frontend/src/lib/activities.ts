export const activityCategories = [
  "CẦU LÔNG",
  "TỪ THIỆN",
  "THỂ THAO",
  "GIẢI TRÍ",
] as const;

export type ActivityCategory = (typeof activityCategories)[number];

export type ActivityComment = {
  id: string;
  authorName: string | null;
  message: string;
  createdAt: string;
};

export type ActivityRepeatInterval = "daily" | "weekly" | "monthly";
export type ActivityRepeatEndType = "never" | "count" | "until";

export type ActivityRepeatConfig = {
  interval: ActivityRepeatInterval;
  endType: ActivityRepeatEndType;
  count?: number;
  until?: string;
};

export type ActivityRecurrence = ActivityRepeatConfig & {
  id: string;
  nextDay: string;
  occurrenceCount: number;
  anchorDay: number;
  template: Pick<
    ClubActivity,
    | "kind"
    | "title"
    | "description"
    | "location"
    | "category"
    | "scheduleType"
    | "creator"
    | "date"
    | "repeat"
  >;
};

export type ClubActivity = {
  id: string;
  approved: boolean;
  kind?: "activity" | "quick-signup";
  recurrenceSeriesId?: string | null;
  repeat?: ActivityRepeatConfig | null;
  title: string;
  description: string;
  location?: string | null;
  category: ActivityCategory;
  scheduleType: "scheduled" | "poll";
  date: string | null;
  day?: string | null;
  createdAt: string;
  creator: string;
  participants: string[];
  comments?: ActivityComment[];
};

export function activityDay(
  activity: Pick<ClubActivity, "day" | "date">,
) {
  if (activity.day) return activity.day;
  return activity.date ? activity.date.slice(0, 10) : null;
}

export function activityDetailId(activity: ClubActivity, activities: ClubActivity[]) {
  if (!activity.recurrenceSeriesId) return activity.id;
  const seriesRoot = activities
    .filter((item) => item.recurrenceSeriesId === activity.recurrenceSeriesId)
    .sort((first, second) =>
      (activityDay(first) ?? "").localeCompare(activityDay(second) ?? ""),
    )[0];
  return seriesRoot?.id ?? activity.id;
}

export function isActivityCategory(value: unknown): value is ActivityCategory {
  return (
    typeof value === "string" &&
    activityCategories.some((category) => category === value)
  );
}

export type UpcomingActivityItem = {
  activity: ClubActivity;
  day: string;
  detailId: string;
};

/** Whole calendar days from local `now` to a `YYYY-MM-DD` activity day (`0` = today, `1` = tomorrow). */
export function upcomingDayOffset(day: string, now: Date = new Date()): number {
  const parts = day.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return -1;
  const targetUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((targetUtc - todayUtc) / 86_400_000);
}

export function selectUpcomingActivities(
  activities: ClubActivity[],
  now: Date = new Date(),
  limit = 3,
): UpcomingActivityItem[] {
  if (limit <= 0) return [];
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const candidates = activities
    .filter((item) => {
      if (item.approved === false || item.scheduleType !== "scheduled") return false;
      const day = activityDay(item);
      if (!day || day < todayKey) return false;
      if (item.date?.includes("T")) {
        const timestamp = new Date(item.date).getTime();
        if (Number.isFinite(timestamp) && timestamp < now.getTime()) return false;
      }
      return true;
    })
    .sort((first, second) => {
      const firstDay = activityDay(first) ?? "";
      const secondDay = activityDay(second) ?? "";
      if (firstDay !== secondDay) return firstDay.localeCompare(secondDay);
      const firstTime = first.date ?? firstDay;
      const secondTime = second.date ?? secondDay;
      if (firstTime !== secondTime) return firstTime.localeCompare(secondTime);
      return first.title.localeCompare(second.title);
    });

  const seenSeries = new Set<string>();
  const picked: UpcomingActivityItem[] = [];
  for (const activity of candidates) {
    if (activity.recurrenceSeriesId) {
      if (seenSeries.has(activity.recurrenceSeriesId)) continue;
      seenSeries.add(activity.recurrenceSeriesId);
    }
    const day = activityDay(activity);
    if (!day) continue;
    picked.push({
      activity,
      day,
      detailId: activityDetailId(activity, activities),
    });
    if (picked.length >= limit) break;
  }
  return picked;
}
