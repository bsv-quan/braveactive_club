"use client";

import { memo } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/i18n-provider";
import type { ClubActivity } from "@/lib/activities";
import type { ClubAnnouncement } from "@/lib/content";
import { categoryColor, categoryLabel, formatDate } from "@/lib/club-ui";

type PollCardProps = {
  activity: ClubActivity;
  index: number;
  onSelect: (activity: ClubActivity) => void;
};

const PollCard = memo(function PollCard({ activity, index, onSelect }: PollCardProps) {
  const { t } = useI18n();
  return (
    <button
      className="activity-feed-card activity-feed-button"
      type="button"
      onClick={() => onSelect(activity)}
    >
      <span className="feed-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="feed-card-main">
        <span className="feed-card-meta">
          <span className={`category-label ${categoryColor(activity.category)}`}>
            {categoryLabel(t, activity.category)}
          </span>
          <span className="feed-kind">{t("club.poll.kind")}</span>
        </span>
        <strong className="activity-feed-title">{activity.title}</strong>
        <span className="activity-feed-description">{activity.description}</span>
        <span className="feed-card-footer">
          <span>{t("club.poll.createdBy", { name: activity.creator })}</span>
          <span>
            {t("club.poll.daysProposed", { count: Object.keys(activity.votes ?? {}).length })}
          </span>
          <span>
            {t("club.poll.voters", {
              count: new Set(Object.values(activity.votes ?? {}).flat()).size,
            })}
          </span>
        </span>
      </span>
      <span className="feed-card-action" aria-hidden="true">↗</span>
    </button>
  );
});

type PollActivitiesProps = {
  activities: ClubActivity[];
  loading: boolean;
  onSelect: (activity: ClubActivity) => void;
};

function PollActivitiesSectionBase({
  activities,
  loading,
  onSelect,
}: PollActivitiesProps) {
  const { t } = useI18n();
  return (
    <section className="poll-activities-section">
      <div className="scheduled-heading">
        <div>
          <span className="section-kicker">{t("club.poll.kicker")}</span>
          <h2>{t("club.poll.title")}<span className="hero-period">.</span></h2>
        </div>
      </div>
      {loading ? (
        <div className="loading-panel">{t("club.poll.loading")}</div>
      ) : activities.length ? (
        <div className="activity-feed">
          {activities.map((activity, index) => (
            <PollCard key={activity.id} activity={activity} index={index} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <div className="empty-feed">
          <span>✳</span>
          <strong>{t("club.poll.emptyTitle")}</strong>
          <p>{t("club.poll.emptyText")}</p>
        </div>
      )}
    </section>
  );
}

export const PollActivitiesSection = memo(PollActivitiesSectionBase);

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
  /** The API does not expose an owner, so any signed-in user sees the buttons; the backend enforces owner-or-admin. */
  canManage: boolean;
  createHref: string;
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
  createHref,
  onRetry,
  onEdit,
  onDelete,
}: AnnouncementFeedProps) {
  const { t } = useI18n();
  return (
    <section className="activity-notifications">
      <div className="scheduled-heading">
        <div>
          <span className="section-kicker">{t("club.announcements.kicker")}</span>
          <h2>{t("club.announcements.title")}<span className="hero-period">.</span></h2>
        </div>
        <Link className="button-primary" href={createHref}>
          <span className="create-button-plus">+</span> {t("club.announcements.create")}
        </Link>
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
