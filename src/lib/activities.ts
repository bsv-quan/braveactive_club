export const activityCategories = [
  "CẦU LÔNG",
  "TỪ THIỆN",
  "THỂ THAO",
] as const;

export type ActivityCategory = (typeof activityCategories)[number];

export type ActivityComment = {
  id: string;
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
    | "category"
    | "scheduleType"
    | "creator"
    | "date"
    | "repeat"
  >;
};

export type ClubActivity = {
  id: string;
  kind?: "activity" | "quick-signup";
  recurrenceSeriesId?: string;
  repeat?: ActivityRepeatConfig;
  title: string;
  description: string;
  category: ActivityCategory;
  scheduleType: "scheduled" | "poll";
  date: string | null;
  day?: string | null;
  createdAt: string;
  creator: string;
  participants: string[];
  votes: Record<string, string[]>;
  comments?: ActivityComment[];
};

export const activitiesKey = "braveactive:activities";
export const activityRecurrencesKey = "braveactive:activity-recurrences";
export const activityRecurrenceLockKey = "braveactive:activity-recurrences:lock";

export function activityParticipantsKey(id: string) {
  return `braveactive:activity:${id}:participants`;
}

export function activityVotesKey(id: string) {
  return `braveactive:activity:${id}:votes`;
}

export function activityCommentsKey(id: string) {
  return `braveactive:activity:${id}:comments`;
}

export function nextActivityDay(
  day: string,
  interval: ActivityRepeatInterval,
  anchorDay: number,
) {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  if (interval === "daily") date.setUTCDate(date.getUTCDate() + 1);
  if (interval === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (interval === "monthly") {
    const nextMonth = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(
      Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0),
    ).getUTCDate();
    nextMonth.setUTCDate(Math.min(anchorDay, lastDay));
    return nextMonth.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

export function activityNameDayKey(day: string, title: string) {
  const normalizedTitle = normalizeActivityTitle(title);
  return `braveactive:activity-name-day:${day}:${encodeURIComponent(normalizedTitle)}`;
}

export function normalizeActivityTitle(title: string) {
  return title
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi");
}

export function activityDay(
  activity: Pick<ClubActivity, "day" | "date">,
) {
  if (activity.day) return activity.day;
  return activity.date ? activity.date.slice(0, 10) : null;
}

export function isActivityCategory(value: unknown): value is ActivityCategory {
  return (
    typeof value === "string" &&
    activityCategories.some((category) => category === value)
  );
}
