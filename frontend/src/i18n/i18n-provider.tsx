"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  LOCALE_COOKIE,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
} from "./config";
import { loadMessages } from "./loader";
import type { MessageKey, Messages } from "./messages/types";

type Params = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  /** BCP-47 tag for Intl formatters, e.g. "vi-VN". */
  intlLocale: string;
  setLocale: (locale: Locale) => void;
  /** Translate a key; `{name}` placeholders are replaced from `params`. */
  t: (key: MessageKey, params?: Params) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function resolve(messages: Messages, key: string): string {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : key;
}

function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be blocked (private mode); the cookie still works.
  }
}

type ProviderProps = {
  /** Locale and dictionary resolved on the server from the cookie. */
  initialLocale: Locale;
  initialMessages: Messages;
  children: React.ReactNode;
};

export function I18nProvider({ initialLocale, initialMessages, children }: ProviderProps) {
  const [state, setState] = useState({ locale: initialLocale, messages: initialMessages });

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next);
    void loadMessages(next).then((messages) => {
      document.documentElement.lang = LOCALE_LABELS[next].htmlLang;
      setState({ locale: next, messages });
    });
  }, []);

  // Restore the choice from localStorage if the cookie was cleared.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored) && stored !== initialLocale) setLocale(stored);
    } catch {
      // Ignore blocked storage.
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const { locale, messages } = state;
    return {
      locale,
      intlLocale: LOCALE_LABELS[locale].intl,
      setLocale,
      t: (key, params) => {
        const text = resolve(messages, key);
        if (!params) return text;
        return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
      },
    };
  }, [state, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>.");
  return context;
}
