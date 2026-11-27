"use client";

import { memo } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/i18n-provider";
import type { ClubAnnouncement } from "@/lib/content";
import { categoryColor, categoryLabel, formatDate } from "@/lib/club-ui";

type AnnouncementCardProps = {
  announcement: ClubAnnouncement;
  canManage: boolean;
  actionLoading: boolean;
  onEdit: (announcement: ClubAnnouncement) => void;
  onDelete: (announcement: ClubAnnouncement) => void;
};

const AnnouncementCard = memo(function AnnouncementCard({
  announcement,
  canManage,
  actionLoading,
  onEdit,
  onDelete,
}: AnnouncementCardProps) {
  const { t, intlLocale } = useI18n();
  return (
    <article className={`activity-feed-card feed-${announcement.color}`}>
      <span className="feed-index">✳</span>
      <div className="feed-card-main">
        <div className="feed-card-meta">
          <span className={`category-label ${categoryColor(announcement.category)}`}>
            {categoryLabel(t, announcement.category)}
          </span>
          <span className="feed-kind">{t("club.announcements.newKind")}</span>
        </div>
        <h2>{announcement.title}</h2>
        <p>{announcement.description}</p>
        <div className="feed-card-footer">
          <time dateTime={announcement.date}>
            {formatDate(new Date(`${announcement.date}T00:00:00`), intlLocale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </div>
      </div>
      {canManage && (
        <div className="announcement-actions">
          <button
            className="announcement-action edit"
            type="button"
            onClick={() => onEdit(announcement)}
          >
            {t("club.announcements.edit")}
          </button>
          <button
            className="announcement-action delete"
            type="button"
            disabled={actionLoading}
            onClick={() => onDelete(announcement)}
          >
            {t("club.announcements.delete")}
          </button>
        </div>
      )}
    </article>
  );
});

type AnnouncementFeedProps = {
  welcomeAnnouncement?: ClubAnnouncement;
  announcements: ClubAnnouncement[];
  contentError: string;
  actionError: string;
  actionLoading: boolean;
  /** The API does not expose an owner, so signed-in users see edit/delete controls; the backend enforces owner-or-admin. */
  canManage: boolean;
  canCreate: boolean;
  compact?: boolean;
  onRetry: () => void;
  onEdit: (announcement: ClubAnnouncement) => void;
  onDelete: (announcement: ClubAnnouncement) => void;
};

function AnnouncementFeedSectionBase({
  welcomeAnnouncement,
  announcements,
  contentError,
  actionError,
  actionLoading,
  canManage,
  canCreate,
  compact = false,
  onRetry,
  onEdit,
  onDelete,
}: AnnouncementFeedProps) {
  const { t, intlLocale } = useI18n();
  const visibleAnnouncements = announcements.filter(
    (announcement) => announcement.id !== "welcome",
  );

  if (compact) {
    return (
      <section className="agenda-announcements-card" aria-label={t("club.announcements.title")}>
        <div className="agenda-announcements-head">
          <div>
            <span className="community-calendar-kicker">{t("club.announcements.kicker")}</span>
            <h2>{t("club.announcements.title")}</h2>
          </div>
          {canCreate && (
            <Link
              className="agenda-announcement-add"
              href="/activities/announcements/new"
              aria-label={t("club.announcements.create")}
              title={t("club.announcements.create")}
            >
              +
            </Link>
          )}
        </div>

        {contentError ? (
          <div className="error-panel" role="alert">
            <span>{t("club.announcements.loadErrorTitle")}</span>
            <p>{contentError}</p>
            <button className="button-quiet" onClick={onRetry}>
              {t("club.retry")}
            </button>
          </div>
        ) : (
          <div className="agenda-announcements-list">
            {welcomeAnnouncement && (
              <article className="agenda-announcement-item is-welcome">
                <span className="category-label green">
                  {categoryLabel(t, welcomeAnnouncement.category)}
                </span>
                <h3>{welcomeAnnouncement.title}</h3>
                <p>{welcomeAnnouncement.description}</p>
              </article>
            )}
            {visibleAnnouncements.map((announcement) => (
              <article key={announcement.id} className="agenda-announcement-item">
                <div className="agenda-announcement-meta">
                  <span className={`category-label ${categoryColor(announcement.category)}`}>
                    {categoryLabel(t, announcement.category)}
                  </span>
                  <time dateTime={announcement.date}>
                    {formatDate(new Date(`${announcement.date}T00:00:00`), intlLocale, {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                </div>
                <h3>{announcement.title}</h3>
                <p>{announcement.description}</p>
                {canManage && (
                  <div className="agenda-announcement-actions">
                    <button
                      className="announcement-action edit"
                      type="button"
                      onClick={() => onEdit(announcement)}
                    >
                      {t("club.announcements.edit")}
                    </button>
                    <button
                      className="announcement-action delete"
                      type="button"
                      disabled={actionLoading}
                      onClick={() => onDelete(announcement)}
                    >
                      {t("club.announcements.delete")}
                    </button>
                  </div>
                )}
              </article>
            ))}
            {actionError && (
              <p className="announcement-action-error" role="alert">
                {actionError}
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="activity-notifications">
      <div className="scheduled-heading">
        <div>
          <span className="section-kicker">{t("club.announcements.kicker")}</span>
          <h2>{t("club.announcements.title")}<span className="hero-period">.</span></h2>
        </div>
        {canCreate && (
          <Link className="button-primary" href="/activities/announcements/new">
            <span className="create-button-plus">+</span> {t("club.announcements.create")}
          </Link>
        )}
      </div>
      <div className="activity-feed">
        {welcomeAnnouncement && (
          <article className="activity-feed-card feed-mint welcome-feed-card">
            <span className="feed-index">✳</span>
            <div className="feed-card-main">
              <div className="feed-card-meta">
                <span className="category-label green">
                  {categoryLabel(t, welcomeAnnouncement.category)}
                </span>
                <span className="feed-kind">{t("club.announcements.welcomeKind")}</span>
              </div>
              <h2>{welcomeAnnouncement.title}</h2>
              <p>{welcomeAnnouncement.description}</p>
            </div>
          </article>
        )}
        {contentError ? (
          <div className="error-panel" role="alert">
            <span>{t("club.announcements.loadErrorTitle")}</span>
            <p>{contentError}</p>
            <button className="button-quiet" onClick={onRetry}>{t("club.retry")}</button>
          </div>
        ) : (
          <>
            {announcements
              .filter((announcement) => announcement.id !== "welcome")
              .map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  canManage={canManage}
                  actionLoading={actionLoading}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            {actionError && (
              <p className="announcement-action-error" role="alert">{actionError}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export const AnnouncementFeedSection = memo(AnnouncementFeedSectionBase);
