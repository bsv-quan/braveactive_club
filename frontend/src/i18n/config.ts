export const LOCALES = ["vi", "en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";

/** Cookie read on the server (no language flash on first paint) and mirrored to localStorage. */
export const LOCALE_COOKIE = "ba_lang";
export const LOCALE_STORAGE_KEY = "ba_lang";

/** Native names are shown in the language switcher. */
export const LOCALE_LABELS: Record<Locale, { short: string; native: string; htmlLang: string; intl: string }> = {
  vi: { short: "VI", native: "Tiếng Việt", htmlLang: "vi", intl: "vi-VN" },
  en: { short: "EN", native: "English", htmlLang: "en", intl: "en-US" },
  ja: { short: "JA", native: "日本語", htmlLang: "ja", intl: "ja-JP" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
