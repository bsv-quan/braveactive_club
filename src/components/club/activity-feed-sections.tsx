"use client";

import Link from "next/link";
import type { ClubActivity } from "@/lib/activities";
import type { ClubAnnouncement } from "@/lib/content";
import { categoryColor, formatDate } from "@/lib/club-ui";

type PollActivitiesProps = {
  activities: ClubActivity[];
  loading: boolean;
  onSelect: (activity: ClubActivity) => void;
};

export function PollActivitiesSection({
  activities,
  loading,
  onSelect,
}: PollActivitiesProps) {
  return (
    <section className="poll-activities-section">
      <div className="scheduled-heading">
        <div>
          <span className="section-kicker">CHƯA CHỐT LỊCH</span>
          <h2>Đang bình chọn ngày<span className="hero-period">.</span></h2>
        </div>
      </div>
      {loading ? (
        <div className="loading-panel">Đang tải hoạt động...</div>
      ) : activities.length ? (
        <div className="activity-feed">
          {activities.map((activity, index) => (
            <button
              className="activity-feed-card activity-feed-button"
              key={activity.id}
              type="button"
              onClick={() => onSelect(activity)}
            >
              <span className="feed-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="feed-card-main">
                <span className="feed-card-meta">
                  <span className={`category-label ${categoryColor(activity.category)}`}>
                    {activity.category}
                  </span>
                  <span className="feed-kind">ĐANG MỞ BÌNH CHỌN</span>
                </span>
                <strong className="activity-feed-title">{activity.title}</strong>
                <span className="activity-feed-description">{activity.description}</span>
                <span className="feed-card-footer">
                  <span>Tạo bởi {activity.creator}</span>
                  <span>{Object.keys(activity.votes ?? {}).length} ngày được đề xuất</span>
                  <span>{new Set(Object.values(activity.votes ?? {}).flat()).size} người đã vote</span>
                </span>
              </span>
              <span className="feed-card-action" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-feed">
          <span>✳</span>
          <strong>Chưa có hoạt động nào cần bình chọn</strong>
          <p>Tạo hoạt động chưa chốt ngày để cùng chọn thời gian phù hợp.</p>
        </div>
      )}
    </section>
  );
}

type AnnouncementFeedProps = {
  welcomeAnnouncement?: ClubAnnouncement;
  announcements: ClubAnnouncement[];
  contentError: string;
  actionError: string;
  actionLoading: boolean;
  onRetry: () => void;
  onEdit: (announcement: ClubAnnouncement) => void;
  onDelete: (announcement: ClubAnnouncement) => void;
};

export function AnnouncementFeedSection({
  welcomeAnnouncement,
  announcements,
  contentError,
  actionError,
  actionLoading,
  onRetry,
  onEdit,
  onDelete,
}: AnnouncementFeedProps) {
  return (
    <section className="activity-notifications">
      <div className="scheduled-heading">
        <div>
          <span className="section-kicker">THÔNG TIN TỪ CÂU LẠC BỘ</span>
          <h2>Thông báo hoạt động<span className="hero-period">.</span></h2>
        </div>
        <Link className="button-primary" href="/activities/announcements/new">
          <span className="create-button-plus">+</span> Tạo thông báo
        </Link>
      </div>
      <div className="activity-feed">
        {welcomeAnnouncement && (
          <article className="activity-feed-card feed-mint welcome-feed-card">
            <span className="feed-index">✳</span>
            <div className="feed-card-main">
              <div className="feed-card-meta">
                <span className="category-label green">{welcomeAnnouncement.category}</span>
                <span className="feed-kind">CHÀO MỪNG</span>
              </div>
              <h2>{welcomeAnnouncement.title}</h2>
              <p>{welcomeAnnouncement.description}</p>
            </div>
          </article>
        )}
        {contentError ? (
          <div className="error-panel" role="alert">
            <span>Chưa thể tải các thông báo mới</span>
            <p>{contentError}</p>
            <button className="button-quiet" onClick={onRetry}>Thử tải lại ↻</button>
          </div>
        ) : (
          <>
            {announcements
              .filter((announcement) => announcement.id !== "welcome")
              .map((announcement) => (
                <article
                  className={`activity-feed-card feed-${announcement.color}`}
                  key={announcement.id}
                >
                  <span className="feed-index">✳</span>
                  <div className="feed-card-main">
                    <div className="feed-card-meta">
                      <span className={`category-label ${categoryColor(announcement.category)}`}>
                        {announcement.category}
                      </span>
                      <span className="feed-kind">THÔNG BÁO MỚI</span>
                    </div>
                    <h2>{announcement.title}</h2>
                    <p>{announcement.description}</p>
                    <div className="feed-card-footer">
                      <time dateTime={announcement.date}>
                        {formatDate(new Date(`${announcement.date}T00:00:00`), {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </time>
                    </div>
                  </div>
                  <div className="announcement-actions">
                    <button
                      className="announcement-action edit"
                      type="button"
                      onClick={() => onEdit(announcement)}
                    >
                      Sửa
                    </button>
                    <button
                      className="announcement-action delete"
                      type="button"
                      disabled={actionLoading}
                      onClick={() => onDelete(announcement)}
                    >
                      Xóa
                    </button>
                  </div>
                </article>
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
