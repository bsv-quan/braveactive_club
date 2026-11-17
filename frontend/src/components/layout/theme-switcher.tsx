"use client";

import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { useTheme } from "@/theme/theme-provider";

export function ThemeSwitcher() {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useI18n();
  const label = isDark ? t("theme.switchToLight") : t("theme.switchToDark");
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      className="theme-switcher"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={toggleTheme}
    >
      <Icon size={17} aria-hidden />
    </button>
  );
}
