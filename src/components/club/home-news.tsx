"use client";

import Link from "next/link";
import type { ClubAnnouncement } from "@/lib/content";
import { categoryColor, formatDate } from "@/lib/club-ui";

type HomeNewsProps = {
  announcements: ClubAnnouncement[];
  contentLoaded: boolean;
  contentError: string;
  onRetryContent: () => void;
};

export function HomeNewsSection({
  announcements,
  contentLoaded,
  contentError,
  onRetryContent,
}: HomeNewsProps) {
  return (
    <section className="home-news-section">
      <div className="home-news-heading">
        <div>
          <span className="section-kicker">CẬP NHẬT TỪ CÂU LẠC BỘ</span>
          <h2>Bản tin</h2>
        </div>
        <Link className="text-link" href="/activities">
          Xem tất cả <span>↗</span>
        </Link>
      </div>
      <div className="home-news-columns">
        <section className="home-news-column" aria-labelledby="home-announcements-title">
          {contentError ? (
            <div className="home-news-message" role="alert">
              <p>{contentError}</p>
              <button className="button-quiet" onClick={onRetryContent}>
                Thử tải lại ↻
              </button>
            </div>
          ) : !contentLoaded ? (
            <div className="home-news-message">Đang tải thông báo...</div>
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
                      {announcement.category}
                    </span>
                    <h4>{announcement.title}</h4>
                    <p>{announcement.description}</p>
                    <time dateTime={announcement.date}>
                      {formatDate(new Date(`${announcement.date}T00:00:00`), {
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
            <div className="home-news-message">Chưa có thông báo mới.</div>
          )}
        </section>
      </div>
    </section>
  );
}
