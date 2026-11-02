import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { GlobalErrorNotice } from "@/components/layout/global-error-notice";
import { LOCALE_LABELS } from "@/i18n/config";
import { I18nProvider } from "@/i18n/i18n-provider";
import { loadMessages } from "@/i18n/loader";
import { getServerLocale } from "@/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const messages = await loadMessages(await getServerLocale());
  return { title: messages.meta.title, description: messages.meta.description };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();
  const messages = await loadMessages(locale);

  return (
    <html lang={LOCALE_LABELS[locale].htmlLang}>
      <body>
        <I18nProvider initialLocale={locale} initialMessages={messages}>
          <AuthProvider>
            <GlobalErrorNotice />
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
