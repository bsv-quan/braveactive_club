import type { Locale } from "./config";
import type { Messages } from "./messages/types";

/**
 * Loads one dictionary on demand so users only download the language they use.
 * `vi` is the source of truth for the key structure (see messages/vi.ts).
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case "en":
      return (await import("./messages/en")).default;
    case "ja":
      return (await import("./messages/ja")).default;
    default:
      return (await import("./messages/vi")).default;
  }
}
