import type { MessageKey } from "@/i18n/messages/types";

export type Translate = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;

export const weekdayShortKeys = [
  "club.weekdays.short.mon",
  "club.weekdays.short.tue",
  "club.weekdays.short.wed",
  "club.weekdays.short.thu",
  "club.weekdays.short.fri",
  "club.weekdays.short.sat",
  "club.weekdays.short.sun",
] as const satisfies readonly MessageKey[];

export const weekdayLongKeys = [
  "club.weekdays.long.mon",
  "club.weekdays.long.tue",
  "club.weekdays.long.wed",
  "club.weekdays.long.thu",
  "club.weekdays.long.fri",
  "club.weekdays.long.sat",
  "club.weekdays.long.sun",
] as const satisfies readonly MessageKey[];

/** Weekday index with Monday = 0. */
export function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatMonth(date: Date, intlLocale: string) {
  return new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDate(
  date: Date,
  intlLocale: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat(intlLocale, options).format(date);
}

/** Categories are stored by their Vietnamese value; the label comes from the dictionary. */
const categoryLabelKeys: Record<string, MessageKey> = {
  "CẦU LÔNG": "club.categories.badminton",
  "TỪ THIỆN": "club.categories.charity",
  "THỂ THAO": "club.categories.sport",
  "CÂU LẠC BỘ": "club.categories.club",
};

export function categoryLabel(t: Translate, category: string) {
  const key = categoryLabelKeys[category];
  return key ? t(key) : category;
}

export const repeatIntervalKeys = {
  daily: "club.repeat.daily",
  weekly: "club.repeat.weekly",
  monthly: "club.repeat.monthly",
} as const satisfies Record<string, MessageKey>;

export function categoryColor(category: string) {
  if (category === "CẦU LÔNG") return "coral";
  if (category === "TỪ THIỆN") return "violet";
  return "green";
}
