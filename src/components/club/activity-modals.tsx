"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { ActivityComment, ClubActivity } from "@/lib/activities";
import type { ClubAnnouncement } from "@/lib/content";
import {
  categoryColor,
  dateKey,
  formatDate,
  formatMonth,
} from "@/lib/club-ui";
import { MonthGrid } from "./month-grid";

type ModalFrameProps = {
  labelledBy: string;
  className?: string;
  closeDisabled?: boolean;
  backdropCloseDisabled?: boolean;
  onClose: () => void;
  children: ReactNode;
};

function ModalFrame({
  labelledBy,
  className = "",
  closeDisabled = false,
  backdropCloseDisabled = closeDisabled,
  onClose,
  children,
}: ModalFrameProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !backdropCloseDisabled) onClose();
      }}
    >
      <section
        className={`activity-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Đóng"
          disabled={closeDisabled}
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </section>
    </div>
  );
}

type CreateActivityModalProps = {
  scheduleType: "scheduled" | "poll";
  defaultDateTime: string;
  error: string;
  loading: boolean;
  onScheduleTypeChange: (value: "scheduled" | "poll") => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

type QuickSignupModalProps = {
  defaultTitle: string;
  error: string;
  loading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function QuickSignupModal({
  defaultTitle,
  error,
  loading,
  onSubmit,
  onClose,
}: QuickSignupModalProps) {
  return (
    <ModalFrame labelledBy="quick-signup-title" onClose={onClose}>
      <span className="section-kicker">ĐĂNG KÝ THEO NGÀY</span>
      <h2 id="quick-signup-title">Tạo đăng ký nhanh<span className="hero-period">.</span></h2>
      <p className="modal-intro">
        Nhập tên hoạt động. Thành viên sẽ đăng ký tham gia riêng cho hoạt động này.
      </p>
      <form className="activity-form" onSubmit={onSubmit}>
        <label htmlFor="quick-signup-name">Tên hoạt động</label>
        <input
          id="quick-signup-name"
          name="title"
          defaultValue={defaultTitle}
          placeholder="Ví dụ: Cầu lông, đá banh, hoạt động từ thiện"
          minLength={2}
          maxLength={120}
          autoFocus
          required
        />
        {error && <p className="modal-error" role="alert">{error}</p>}
        <button className="button-primary modal-submit" type="submit" disabled={loading}>
          {loading ? "Đang tạo..." : "Tạo hoạt động"}
        </button>
      </form>
    </ModalFrame>
  );
}

export function CreateActivityModal({
  scheduleType,
  defaultDateTime,
  error,
  loading,
  onScheduleTypeChange,
  onSubmit,
  onClose,
}: CreateActivityModalProps) {
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatEndType, setRepeatEndType] =
    useState<"never" | "count" | "until">("never");
  const earliestRepeatEndDate = new Date(`${defaultDateTime.slice(0, 10)}T00:00:00`);
  earliestRepeatEndDate.setDate(earliestRepeatEndDate.getDate() + 1);

  return (
    <ModalFrame labelledBy="create-activity-title" onClose={onClose}>
      <span className="section-kicker">THÊM VÀO LỊCH CÂU LẠC BỘ</span>
      <h2 id="create-activity-title">Tạo hoạt động<span className="hero-period">.</span></h2>
      <p className="modal-intro">Chia sẻ kế hoạch của bạn để mọi người cùng tham gia.</p>
      <form className="activity-form" onSubmit={onSubmit}>
        <label htmlFor="activity-title">Tên hoạt động</label>
        <input id="activity-title" name="title" placeholder="Ví dụ: Giao lưu cầu lông cuối tuần" minLength={3} maxLength={120} required />
        <label htmlFor="activity-description">Nội dung hoạt động</label>
        <textarea id="activity-description" name="description" placeholder="Mô tả hoạt động, địa điểm hoặc điều cần chuẩn bị..." minLength={5} maxLength={1000} rows={4} required />
        <label htmlFor="activity-category">Loại hoạt động</label>
        <select id="activity-category" name="category" defaultValue="THỂ THAO">
          <option value="CẦU LÔNG">Cầu lông</option>
          <option value="TỪ THIỆN">Từ thiện</option>
          <option value="THỂ THAO">Thể thao</option>
        </select>
        <label htmlFor="activity-schedule-type">Lịch hoạt động</label>
        <select
          id="activity-schedule-type"
          name="scheduleType"
          value={scheduleType}
          onChange={(event) =>
            onScheduleTypeChange(event.target.value as "scheduled" | "poll")
          }
        >
          <option value="scheduled">Đã chốt ngày và giờ</option>
          <option value="poll">Chưa chốt — để mọi người bình chọn ngày</option>
        </select>
        {scheduleType === "scheduled" ? (
          <>
            <label htmlFor="activity-date">Lịch diễn ra</label>
            <input
              id="activity-date"
              name="date"
              type="datetime-local"
              defaultValue={defaultDateTime}
              required
            />
            <label className="activity-repeat-toggle">
              <input
                type="checkbox"
                name="repeatEnabled"
                checked={repeatEnabled}
                onChange={(event) => setRepeatEnabled(event.target.checked)}
              />
              <span>Lặp lại hoạt động tự động</span>
            </label>
            {repeatEnabled && (
              <>
                <label htmlFor="activity-repeat-interval">Chu kỳ lặp</label>
                <select id="activity-repeat-interval" name="repeatInterval" defaultValue="weekly">
                  <option value="daily">Hằng ngày</option>
                  <option value="weekly">Hằng tuần</option>
                  <option value="monthly">Hằng tháng</option>
                </select>
                <label htmlFor="activity-repeat-end">Kết thúc lặp</label>
                <select
                  id="activity-repeat-end"
                  name="repeatEndType"
                  value={repeatEndType}
                  onChange={(event) =>
                    setRepeatEndType(event.target.value as "never" | "count" | "until")
                  }
                >
                  <option value="never">Không giới hạn</option>
                  <option value="count">Sau số lần diễn ra</option>
                  <option value="until">Đến ngày cụ thể</option>
                </select>
                {repeatEndType === "count" && (
                  <>
                    <label htmlFor="activity-repeat-count">
                      Tổng số lần diễn ra (bao gồm lần đầu)
                    </label>
                    <input
                      id="activity-repeat-count"
                      name="repeatCount"
                      type="number"
                      min={2}
                      max={100}
                      defaultValue={4}
                      required
                    />
                  </>
                )}
                {repeatEndType === "until" && (
                  <>
                    <label htmlFor="activity-repeat-until">Ngày kết thúc</label>
                    <input
                      id="activity-repeat-until"
                      name="repeatUntil"
                      type="date"
                      min={dateKey(earliestRepeatEndDate)}
                      required
                    />
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <p className="schedule-poll-help">
            Thành viên sẽ tự chọn một hoặc nhiều ngày mình có thể tham gia trên lịch tháng.
          </p>
        )}
        <label htmlFor="activity-creator">Tên người tạo hoạt động</label>
        <input id="activity-creator" name="creator" placeholder="Tên bạn" minLength={2} maxLength={40} required />
        {error && <p className="modal-error" role="alert">{error}</p>}
        <button className="button-primary modal-submit" type="submit" disabled={loading}>
          {loading ? "Đang tạo..." : "Tạo hoạt động"}
        </button>
      </form>
    </ModalFrame>
  );
}

type EditAnnouncementModalProps = {
  announcement: ClubAnnouncement;
  error: string;
  loading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function EditAnnouncementModal({
  announcement,
  error,
  loading,
  onSubmit,
  onClose,
}: EditAnnouncementModalProps) {
  return (
    <ModalFrame
      labelledBy="edit-announcement-title"
      closeDisabled={loading}
      onClose={onClose}
    >
      <span className="section-kicker">CẬP NHẬT BẢNG TIN</span>
      <h2 id="edit-announcement-title">Sửa thông báo<span className="hero-period">.</span></h2>
      <form className="activity-form" onSubmit={onSubmit}>
        <label htmlFor="edit-announcement-category">Loại hoạt động</label>
        <select
          id="edit-announcement-category"
          name="category"
          defaultValue={announcement.category}
        >
          <option value="CÂU LẠC BỘ">Câu lạc bộ</option>
          <option value="CẦU LÔNG">Cầu lông</option>
          <option value="TỪ THIỆN">Từ thiện</option>
          <option value="THỂ THAO">Thể thao</option>
        </select>
        <label htmlFor="edit-announcement-title">Tiêu đề thông báo</label>
        <input
          id="edit-announcement-title"
          name="title"
          defaultValue={announcement.title}
          minLength={3}
          maxLength={120}
          required
        />
        <label htmlFor="edit-announcement-description">Nội dung thông báo</label>
        <textarea
          id="edit-announcement-description"
          name="description"
          defaultValue={announcement.description}
          minLength={5}
          maxLength={1000}
          rows={5}
          required
        />
        {error && <p className="modal-error" role="alert">{error}</p>}
        <div className="announcement-form-actions">
          <button
            className="button-secondary"
            type="button"
            disabled={loading}
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="button-primary" type="submit" disabled={loading}>
            {loading ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

type ActivityDetailsModalProps = {
  activity: ClubActivity;
  anchorDate: Date;
  period: Date[];
  pollName: string;
  selectedPollDates: string[];
  participantName: string;
  actionError: string;
  actionNotice: string;
  actionLoading: boolean;
  deletingParticipantName: string;
  commentMessage: string;
  commentError: string;
  commentLoading: boolean;
  onMoveMonth: (direction: number) => void;
  onPollNameChange: (name: string) => void;
  onTogglePollDate: (date: string) => void;
  onParticipantNameChange: (name: string) => void;
  onVoteSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onJoinSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDeleteParticipant: (name: string) => void;
  onCommentMessageChange: (message: string) => void;
  onCommentSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDeleteActivity: () => void;
  onClose: () => void;
};

export function ActivityDetailsModal({
  activity,
  anchorDate,
  period,
  pollName,
  selectedPollDates,
  participantName,
  actionError,
  actionNotice,
  actionLoading,
  deletingParticipantName,
  commentMessage,
  commentError,
  commentLoading,
  onMoveMonth,
  onPollNameChange,
  onTogglePollDate,
  onParticipantNameChange,
  onVoteSubmit,
  onJoinSubmit,
  onDeleteParticipant,
  onCommentMessageChange,
  onCommentSubmit,
  onDeleteActivity,
  onClose,
}: ActivityDetailsModalProps) {
  return (
    <ModalFrame
      labelledBy="activity-detail-title"
      className="activity-detail-modal"
      closeDisabled={commentLoading}
      backdropCloseDisabled={actionLoading || commentLoading}
      onClose={onClose}
    >
      <span className={`category-label ${categoryColor(activity.category)}`}>
        {activity.category}
      </span>
      <h2 id="activity-detail-title">{activity.title}</h2>
      <p className="activity-detail-description">{activity.description}</p>
      <div className="activity-detail-meta">
        <div>
          <span>{activity.scheduleType === "poll" ? "LỊCH DIỄN RA" : "LỊCH ĐÃ CHỐT"}</span>
          <strong>
            {activity.scheduleType === "poll" || !activity.date
              ? "Chưa chốt — đang bình chọn"
              : formatDate(
                  new Date(activity.date),
                  activity.kind === "quick-signup"
                    ? {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }
                    : {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                )}
          </strong>
        </div>
        <div><span>NGƯỜI TẠO</span><strong>{activity.creator}</strong></div>
      </div>
      {activity.scheduleType === "poll" ? (
        <form className="activity-form join-activity-form poll-vote-form" onSubmit={onVoteSubmit}>
          <p className="poll-vote-instructions">
            Chọn tất cả ngày bạn có thể tham gia. Gửi lại bình chọn sẽ thay thế lựa chọn trước đó.
          </p>
          <MonthGrid
            days={period}
            className="poll-calendar"
            renderDay={(day) => {
              const key = dateKey(day);
              const selected = selectedPollDates.includes(key);
              const voters = activity.votes?.[key] ?? [];
              return (
                <button
                  className={`poll-date-option ${selected ? "selected" : ""} ${day.getMonth() !== anchorDate.getMonth() ? "day-outside" : ""}`}
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onTogglePollDate(key)}
                >
                  <span>{day.getDate()}</span>
                  {voters.length > 0 && <small>{voters.length}</small>}
                </button>
              );
            }}
          />
          <div className="poll-month-navigation">
            <button className="button-secondary" type="button" onClick={() => onMoveMonth(-1)}>‹ Tháng trước</button>
            <strong>{formatMonth(anchorDate)}</strong>
            <button className="button-secondary" type="button" onClick={() => onMoveMonth(1)}>Tháng sau ›</button>
          </div>
          <label htmlFor="poll-voter-name">Tên của bạn</label>
          <input
            id="poll-voter-name"
            value={pollName}
            onChange={(event) => onPollNameChange(event.target.value)}
            placeholder="Nhập tên để bình chọn"
            minLength={2}
            maxLength={40}
            required
          />
          <button
            className="button-primary"
            type="submit"
            disabled={actionLoading || selectedPollDates.length === 0}
          >
            {actionLoading ? "Đang gửi..." : `Gửi bình chọn (${selectedPollDates.length} ngày)`}
          </button>
          <div className="poll-results">
            <strong>Kết quả bình chọn</strong>
            {Object.entries(activity.votes ?? {})
              .sort(([first], [second]) => first.localeCompare(second))
              .map(([date, voters]) => (
                <div className="poll-result-row" key={date}>
                  <span>{formatDate(new Date(`${date}T00:00:00`), { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span>{voters.length} vote{voters.length === 1 ? "" : "s"}</span>
                </div>
              ))}
            {Object.keys(activity.votes ?? {}).length === 0 && (
              <p>Chưa có ngày nào được bình chọn.</p>
            )}
          </div>
        </form>
      ) : (
        <form className="activity-form join-activity-form" onSubmit={onJoinSubmit}>
          <label htmlFor="participant-name">Tên của bạn để tham gia</label>
          <div className="join-activity-row">
            <input
              id="participant-name"
              value={participantName}
              onChange={(event) => onParticipantNameChange(event.target.value)}
              placeholder="Nhập tên của bạn"
              minLength={2}
              maxLength={40}
              required
            />
            <button className="button-primary" type="submit" disabled={actionLoading}>
              {actionLoading ? "..." : "Tham gia hoạt động"}
            </button>
          </div>
        </form>
      )}
      {actionNotice && <p className="activity-action-notice" role="status">{actionNotice}</p>}
      {actionError && <p className="modal-error" role="alert">{actionError}</p>}
      <div className="activity-participants">
        <div className="participants-heading">
          <strong>Thành viên tham gia</strong>
          <span>{activity.participants.length}</span>
        </div>
        {activity.participants.length ? (
          <ul>
            {activity.participants.map((participant, index) => (
              <li key={`${activity.id}-${participant}`}>
                <span className={`member-avatar member-avatar-${index % 4}`}>
                  {participant.charAt(0).toLocaleUpperCase("vi")}
                </span>
                <span className="participant-name">{participant}</span>
                <button
                  className="remove-member-button"
                  type="button"
                  aria-label={`Xóa ${participant} khỏi hoạt động`}
                  title={`Xóa ${participant} khỏi hoạt động`}
                  disabled={deletingParticipantName === participant || actionLoading}
                  onClick={() => onDeleteParticipant(participant)}
                >
                  {deletingParticipantName === participant ? "…" : "×"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-activity-participants">Chưa có ai tham gia. Bạn sẽ là người đầu tiên chứ?</p>
        )}
      </div>
      <section className="activity-comments" aria-labelledby="activity-comments-title">
        <div className="participants-heading">
          <strong id="activity-comments-title">Bình luận</strong>
          <span>{activity.comments?.length ?? 0}</span>
        </div>
        <form className="activity-form activity-comment-form" onSubmit={onCommentSubmit}>
          <label htmlFor="activity-comment-message">Nội dung bình luận</label>
          <textarea
            id="activity-comment-message"
            value={commentMessage}
            onChange={(event) => onCommentMessageChange(event.target.value)}
            placeholder="Viết bình luận..."
            minLength={2}
            maxLength={1000}
            rows={3}
            required
          />
          {commentError && <p className="modal-error" role="alert">{commentError}</p>}
          <button
            className="button-primary"
            type="submit"
            disabled={commentLoading}
          >
            {commentLoading ? "Đang gửi..." : "Gửi bình luận"}
          </button>
        </form>
        {activity.comments?.length ? (
          <ul className="activity-comment-list">
            {[...activity.comments]
              .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
              .map((comment: ActivityComment) => (
                <li key={comment.id}>
                  <div className="activity-comment-meta">
                    <time dateTime={comment.createdAt}>
                      {formatDate(new Date(comment.createdAt), {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p>{comment.message}</p>
                </li>
              ))}
          </ul>
        ) : (
          <p className="no-activity-comments">Chưa có bình luận nào.</p>
        )}
      </section>
      <div className="activity-delete-row">
        <span>Ai cũng có thể xóa hoạt động này.</span>
        <button
          className="delete-activity-button"
          type="button"
          onClick={onDeleteActivity}
          disabled={actionLoading}
        >
          Xóa hoạt động
        </button>
      </div>
    </ModalFrame>
  );
}
