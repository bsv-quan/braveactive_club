"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { THEME_COOKIE, THEME_STORAGE_KEY, type ThemePreference, isThemePreference } from "./config";

type ThemeContextValue = {
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function applyTheme(preference: ThemePreference) {
  if (preference === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = preference;
  }
}

function persistTheme(preference: ThemePreference) {
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The cookie still preserves the preference when browser storage is unavailable.
  }
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemePreference | null;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<ThemePreference>(initialTheme ?? "system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  const chooseTheme = useCallback((next: ThemePreference) => {
    persistTheme(next);
    applyTheme(next);
    setTheme(next);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => setSystemPrefersDark(mediaQuery.matches);
    updateSystemTheme();
    mediaQuery.addEventListener("change", updateSystemTheme);

    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (initialTheme === null && isThemePreference(saved)) {
        applyTheme(saved);
        setTheme(saved);
      } else {
        applyTheme(initialTheme ?? "system");
      }
    } catch {
      applyTheme(initialTheme ?? "system");
    }

    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, [initialTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    isDark: theme === "dark" || (theme === "system" && systemPrefersDark),
    toggleTheme: () => chooseTheme(theme === "dark" || (theme === "system" && systemPrefersDark) ? "light" : "dark"),
  }), [chooseTheme, systemPrefersDark, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return context;
}
