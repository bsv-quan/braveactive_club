"use client";

import { Languages } from "lucide-react";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { useI18n } from "@/i18n/i18n-provider";

/** Compact EN / VI / JA selector shown in the header. */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="lang-switcher" role="group" aria-label={t("language.label")}>
      <Languages size={16} aria-hidden />
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={code === locale ? "lang-option active" : "lang-option"}
          aria-pressed={code === locale}
          title={LOCALE_LABELS[code].native}
          onClick={() => setLocale(code)}
        >
          {LOCALE_LABELS[code].short}
        </button>
      ))}
    </div>
  );
}
