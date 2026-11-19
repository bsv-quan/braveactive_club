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
