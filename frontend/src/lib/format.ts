/**
 * Locale-aware relative time ("5 minutes ago"); falls back to a date after a week.
 * Returns null for "just now" so the caller can show its own translated label.
 */
export function formatRelativeTime(iso: string, intlLocale: string, now: number = Date.now()): string | null {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return null;
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-Math.max(1, minutes), "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  return new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

/** First http(s) URL in free text, without trailing punctuation. */
export function findFirstUrl(text: string): string | null {
  const match = URL_PATTERN.exec(text);
  return match ? match[0].replace(/[.,;:!?)\]}]+$/, "") : null;
}

/** Split text into plain and URL parts so links can be rendered as safe anchors. */
export function splitLinks(text: string): Array<{ text: string; url?: string }> {
  const parts: Array<{ text: string; url?: string }> = [];
  const pattern = new RegExp(URL_PATTERN.source, "gi");
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const url = raw.replace(/[.,;:!?)\]}]+$/, "");
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index) });
    parts.push({ text: url, url });
    last = index + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
