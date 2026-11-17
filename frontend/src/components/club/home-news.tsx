"use client";

import { memo } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/i18n-provider";
import type { ClubAnnouncement } from "@/lib/content";
import { categoryColor, categoryLabel, formatDate } from "@/lib/club-ui";

type HomeNewsProps = {
  announcements: ClubAnnouncement[];
  contentLoaded: boolean;
  contentError: string;
  onRetryContent: () => void;
};

function HomeNewsSectionBase({
  announcements,
  contentLoaded,
  contentError,
  onRetryContent,
}: HomeNewsProps) {
  const { t, intlLocale } = useI18n();
  return (
    <section className="home-news-section">
      <div className="home-news-heading">
        <div>
          <span className="section-kicker">{t("club.news.kicker")}</span>
          <h2>{t("club.news.title")}</h2>
        </div>
        <Link className="text-link" href="/activities">
          {t("club.news.viewAll")} <span>↗</span>
        </Link>
      </div>
      <div className="home-news-columns">
        <section className="home-news-column" aria-labelledby="home-announcements-title">
          {contentError ? (
            <div className="home-news-message" role="alert">
              <p>{contentError}</p>
              <button className="button-quiet" onClick={onRetryContent}>
                {t("club.retry")}
              </button>
            </div>
          ) : !contentLoaded ? (
            <div className="home-news-message">{t("club.news.loading")}</div>
          ) : announcements.length ? (
            <div className="home-news-list">
              {announcements.map((announcement) => (
                <article
                  className={`home-news-item home-news-${announcement.color}`}
                  key={announcement.id}
                >
                  <span className="home-news-item-icon">✳</span>
                  <div>
                    <span className={`category-label ${categoryColor(announcement.category)}`}>
                      {categoryLabel(t, announcement.category)}
                    </span>
                    <h4>{announcement.title}</h4>
                    <p>{announcement.description}</p>
                    <time dateTime={announcement.date}>
                      {formatDate(new Date(`${announcement.date}T00:00:00`), intlLocale, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="home-news-message">{t("club.news.empty")}</div>
          )}
        </section>
      </div>
    </section>
  );
}

export const HomeNewsSection = memo(HomeNewsSectionBase);
