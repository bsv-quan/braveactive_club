"use client";

import { ArrowUpRight, ExternalLink, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/i18n-provider";
import { apiJson, errorMessage } from "@/lib/api/client";

type WiredNewsItem = {
  category: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
};

type WiredNewsPage = { items: WiredNewsItem[]; updatedAt: string | null };
const NEWS_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export function WiredNewsStrip() {
  const { t } = useI18n();
  const [items, setItems] = useState<WiredNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadNews() {
      try {
        const page = await apiJson<WiredNewsPage>("/api/news/wired", { cache: "no-store" });
        if (active) {
          setItems(page.items);
          setError("");
        }
      } catch (reason) {
        if (active) setError(errorMessage(reason, t("community.wiredNews.loadError")));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadNews();
    const timer = window.setInterval(() => void loadNews(), NEWS_REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [t]);

  if (error || (!loading && items.length === 0)) return null;

  return (
    <section className="wired-news-strip" aria-label={t("community.wiredNews.source")}>
      <header className="wired-news-heading">
        <div>
          <span className="wired-news-kicker"><Newspaper size={14} aria-hidden /> {t("community.wiredNews.source")}</span>
        </div>
        <a href="https://www.wired.com/" target="_blank" rel="noopener noreferrer">
          {t("community.wiredNews.more")} <ArrowUpRight size={15} aria-hidden />
        </a>
      </header>
      {loading && !items.length ? (
        <p className="wired-news-state">{t("community.wiredNews.loading")}</p>
      ) : items.length ? (
        <div className="wired-news-list">
          {items.map((item) => {
            const categoryLabel = item.category === "Security"
              ? t("community.wiredNews.categories.security")
              : item.category === "Politics"
                ? t("community.wiredNews.categories.politics")
                : t("community.wiredNews.categories.bigStory");
            return (
              <a
                className="wired-news-card"
                href={item.url}
                key={item.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="wired-news-image" src={item.imageUrl} alt="" loading="lazy" decoding="async" />
                ) : null}
                <span className="wired-news-category">
                  {categoryLabel}
                </span>
                <strong>{item.title}</strong>
                {item.summary ? <span className="wired-news-summary">{item.summary}</span> : null}
                <ExternalLink className="wired-news-external" size={14} aria-hidden />
              </a>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
