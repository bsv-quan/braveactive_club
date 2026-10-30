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

export type ClubActivity = {
  id: string;
  kind?: "activity" | "quick-signup";
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

export function activityParticipantsKey(id: string) {
  return `braveactive:activity:${id}:participants`;
}

export function activityVotesKey(id: string) {
  return `braveactive:activity:${id}:votes`;
}

export function activityCommentsKey(id: string) {
  return `braveactive:activity:${id}:comments`;
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
