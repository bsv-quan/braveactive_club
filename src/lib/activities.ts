export const activityCategories = [
  "CẦU LÔNG",
  "TỪ THIỆN",
  "THỂ THAO",
] as const;

export type ActivityCategory = (typeof activityCategories)[number];

export type ClubActivity = {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  date: string;
  createdAt: string;
  creator: string;
  participants: string[];
};

export const activitiesKey = "braveactive:activities";

export function activityParticipantsKey(id: string) {
  return `braveactive:activity:${id}:participants`;
}

export function isActivityCategory(value: unknown): value is ActivityCategory {
  return (
    typeof value === "string" &&
    activityCategories.some((category) => category === value)
  );
}
