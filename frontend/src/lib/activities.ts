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
  recurrenceSeriesId?: string | null;
  repeat?: ActivityRepeatConfig | null;
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
