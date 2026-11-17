/** Only allow same-site relative redirects after login to avoid open-redirect abuse. */
export function safeNextPath(value: string | null | undefined, fallback = "/community"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
