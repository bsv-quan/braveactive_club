import { cookies } from "next/headers";
import { isThemePreference, THEME_COOKIE, type ThemePreference } from "./config";

/** Reads the saved theme preference so the server can render it without a flash. */
export async function getServerTheme(): Promise<ThemePreference | null> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isThemePreference(value) ? value : null;
}
