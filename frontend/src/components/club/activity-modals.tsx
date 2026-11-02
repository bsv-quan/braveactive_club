"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/i18n-provider";
import type { ClubAnnouncement } from "@/lib/content";
import { dateKey } from "@/lib/club-ui";

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
  const { t } = useI18n();
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
          aria-label={t("club.modals.close")}
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
  defaultCreator?: string;
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
  const { t } = useI18n();
  return (
    <ModalFrame labelledBy="quick-signup-title" onClose={onClose}>
      <span className="section-kicker">{t("club.modals.quick.kicker")}</span>
      <h2 id="quick-signup-title">{t("club.modals.quick.title")}<span className="hero-period">.</span></h2>
      <p className="modal-intro">{t("club.modals.quick.intro")}</p>
      <form className="activity-form" onSubmit={onSubmit}>
        <label htmlFor="quick-signup-name">{t("club.modals.quick.nameLabel")}</label>
        <input
          id="quick-signup-name"
          name="title"
          defaultValue={defaultTitle}
          placeholder={t("club.modals.quick.namePlaceholder")}
          minLength={2}
          maxLength={120}
          autoFocus
          required
        />
        {error && <p className="modal-error" role="alert">{error}</p>}
        <button className="button-primary modal-submit" type="submit" disabled={loading}>
          {loading ? t("club.modals.quick.creating") : t("club.modals.quick.submit")}
        </button>
      </form>
    </ModalFrame>
  );
}

export function CreateActivityModal({
  scheduleType,
  defaultDateTime,
  defaultCreator = "",
  error,
  loading,
  onScheduleTypeChange,
  onSubmit,
  onClose,
}: CreateActivityModalProps) {
  const { t } = useI18n();
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatEndType, setRepeatEndType] =
    useState<"never" | "count" | "until">("never");
  const earliestRepeatEndDate = new Date(`${defaultDateTime.slice(0, 10)}T00:00:00`);
  earliestRepeatEndDate.setDate(earliestRepeatEndDate.getDate() + 1);

  return (
    <ModalFrame labelledBy="create-activity-title" onClose={onClose}>
      <span className="section-kicker">{t("club.modals.create.kicker")}</span>
      <h2 id="create-activity-title">{t("club.modals.create.title")}<span className="hero-period">.</span></h2>
      <p className="modal-intro">{t("club.modals.create.intro")}</p>
      <form className="activity-form" onSubmit={onSubmit}>
        <label htmlFor="activity-title">{t("club.modals.create.titleLabel")}</label>
        <input id="activity-title" name="title" placeholder={t("club.modals.create.titlePlaceholder")} minLength={3} maxLength={120} required />
        <label htmlFor="activity-description">{t("club.modals.create.descriptionLabel")}</label>
        <textarea id="activity-description" name="description" placeholder={t("club.modals.create.descriptionPlaceholder")} minLength={5} maxLength={1000} rows={4} required />
        <label htmlFor="activity-category">{t("club.modals.create.categoryLabel")}</label>
        <select id="activity-category" name="category" defaultValue="THỂ THAO">
          <option value="CẦU LÔNG">{t("club.categoryOptions.badminton")}</option>
          <option value="TỪ THIỆN">{t("club.categoryOptions.charity")}</option>
          <option value="THỂ THAO">{t("club.categoryOptions.sport")}</option>
        </select>
        <label htmlFor="activity-schedule-type">{t("club.modals.create.scheduleLabel")}</label>
        <select
          id="activity-schedule-type"
          name="scheduleType"
          value={scheduleType}
          onChange={(event) =>
            onScheduleTypeChange(event.target.value as "scheduled" | "poll")
          }
        >
          <option value="scheduled">{t("club.modals.create.scheduled")}</option>
          <option value="poll">{t("club.modals.create.poll")}</option>
        </select>
        {scheduleType === "scheduled" ? (
          <>
            <label htmlFor="activity-date">{t("club.modals.create.dateLabel")}</label>
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
              <span>{t("club.modals.create.repeatToggle")}</span>
            </label>
            {repeatEnabled && (
              <>
                <label htmlFor="activity-repeat-interval">{t("club.modals.create.repeatInterval")}</label>
                <select id="activity-repeat-interval" name="repeatInterval" defaultValue="weekly">
                  <option value="daily">{t("club.modals.create.daily")}</option>
                  <option value="weekly">{t("club.modals.create.weekly")}</option>
                  <option value="monthly">{t("club.modals.create.monthly")}</option>
                </select>
                <label htmlFor="activity-repeat-end">{t("club.modals.create.repeatEnd")}</label>
                <select
                  id="activity-repeat-end"
                  name="repeatEndType"
                  value={repeatEndType}
                  onChange={(event) =>
                    setRepeatEndType(event.target.value as "never" | "count" | "until")
                  }
                >
                  <option value="never">{t("club.modals.create.never")}</option>
                  <option value="count">{t("club.modals.create.count")}</option>
                  <option value="until">{t("club.modals.create.until")}</option>
                </select>
                {repeatEndType === "count" && (
                  <>
                    <label htmlFor="activity-repeat-count">
                      {t("club.modals.create.countLabel")}
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
                    <label htmlFor="activity-repeat-until">{t("club.modals.create.untilLabel")}</label>
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
          <p className="schedule-poll-help">{t("club.modals.create.pollHelp")}</p>
        )}
        <label htmlFor="activity-creator">{t("club.modals.create.creatorLabel")}</label>
        <input id="activity-creator" name="creator" defaultValue={defaultCreator} placeholder={t("club.modals.create.creatorPlaceholder")} minLength={2} maxLength={40} required />
        {error && <p className="modal-error" role="alert">{error}</p>}
        <button className="button-primary modal-submit" type="submit" disabled={loading}>
          {loading ? t("club.modals.create.creating") : t("club.modals.create.submit")}
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
  const { t } = useI18n();
  return (
    <ModalFrame
      labelledBy="edit-announcement-title"
      closeDisabled={loading}
      onClose={onClose}
    >
      <span className="section-kicker">{t("club.modals.edit.kicker")}</span>
      <h2 id="edit-announcement-title">{t("club.modals.edit.title")}<span className="hero-period">.</span></h2>
      <form className="activity-form" onSubmit={onSubmit}>
        <label htmlFor="edit-announcement-category">{t("club.announcements.form.categoryLabel")}</label>
        <select
          id="edit-announcement-category"
          name="category"
          defaultValue={announcement.category}
        >
          <option value="CÂU LẠC BỘ">{t("club.categoryOptions.club")}</option>
          <option value="CẦU LÔNG">{t("club.categoryOptions.badminton")}</option>
          <option value="TỪ THIỆN">{t("club.categoryOptions.charity")}</option>
          <option value="THỂ THAO">{t("club.categoryOptions.sport")}</option>
        </select>
        <label htmlFor="edit-announcement-title">{t("club.announcements.form.titleLabel")}</label>
        <input
          id="edit-announcement-title"
          name="title"
          defaultValue={announcement.title}
          minLength={3}
          maxLength={120}
          required
        />
        <label htmlFor="edit-announcement-description">{t("club.announcements.form.descriptionLabel")}</label>
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
            {t("club.announcements.form.cancel")}
          </button>
          <button className="button-primary" type="submit" disabled={loading}>
            {loading ? t("club.modals.edit.saving") : t("club.modals.edit.save")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
