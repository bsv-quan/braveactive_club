"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ActivityComment, ClubActivity } from "@/lib/activities";
import { useAuth } from "@/components/auth/auth-provider";
import { ClubFooter, ClubHeader } from "@/components/layout/site-chrome";
import { MonthGrid } from "@/components/club/month-grid";
import { useI18n } from "@/i18n/i18n-provider";
import { apiJson, errorMessage } from "@/lib/api/client";
import {
  categoryColor,
  categoryLabel,
  dateKey,
  formatDate,
  formatMonth,
  repeatIntervalKeys,
} from "@/lib/club-ui";

type ActivityResponse = {
  activities?: ClubActivity[];
};

export default function ActivityDetailPage({
  activityId,
}: {
  activityId: string;
}) {
  const { t, intlLocale } = useI18n();
  const { user } = useAuth();
  const pathname = usePathname();
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const [activity, setActivity] = useState<ClubActivity | null>(null);
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [showRepeatDatePicker, setShowRepeatDatePicker] = useState(false);
  const [joiningOccurrenceId, setJoiningOccurrenceId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [voterName, setVoterName] = useState("");
  const [voteError, setVoteError] = useState("");
  const [voteLoading, setVoteLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadActivity = useCallback(async () => {
    const data = await apiJson<ActivityResponse>("/api/activities", {
      cache: "no-store",
    });

    const allActivities = data.activities ?? [];
    const foundActivity = allActivities.find(
      (item) => item.id === activityId,
    );
    if (!foundActivity) throw new Error(tRef.current("club.detail.errors.notFound"));
    setActivities(allActivities);
    setActivity(foundActivity);
    setPageError("");
    setRefreshError("");
  }, [activityId]);

  useEffect(() => {
    let active = true;
    const refresh = async (initial: boolean) => {
      if (initial) setLoading(true);
      try {
        await loadActivity();
      } catch (error) {
        if (active) {
          const message = errorMessage(error, tRef.current("club.detail.errors.load"));
          if (initial) setPageError(message);
          else setRefreshError(message);
        }
      } finally {
        if (active && initial) setLoading(false);
      }
    };

    void refresh(true);
    // Skip polling while the tab is hidden to avoid needless requests.
    const intervalId = window.setInterval(() => {
      if (!document.hidden) void refresh(false);
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadActivity]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activity?.comments?.length]);

  async function joinActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activity) return;
    const targetActivity = activity.recurrenceSeriesId
      ? activities.find((item) => item.id === joiningOccurrenceId)
      : activity;
    if (!targetActivity) {
      setJoinError(t("club.detail.errors.pickDay"));
      return;
    }
    setJoinError("");
    setJoinLoading(true);
    try {
      const data = await apiJson<{ name?: string }>(
        `/api/activities/${targetActivity.id}/join`,
        { method: "POST", json: { name: participantName } },
      );
      if (!data.name) throw new Error(t("club.detail.errors.joinNotConfirmed"));
      setParticipantName("");
      setJoiningOccurrenceId(null);
      await loadActivity();
    } catch (error) {
      setJoinError(errorMessage(error, t("club.detail.errors.joinFailed")));
    } finally {
      setJoinLoading(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activity) return;
    setChatError("");
    setChatLoading(true);
    try {
      const data = await apiJson<{ comment?: ActivityComment }>(
        `/api/activities/${activity.id}/comments`,
        { method: "POST", json: { message } },
      );
      const createdComment = data.comment;
      if (!createdComment) throw new Error(t("club.detail.errors.noMessage"));
      setActivity((current) =>
        current
          ? {
              ...current,
              comments: [...(current.comments ?? []), createdComment],
            }
          : current,
      );
      setMessage("");
    } catch (error) {
      setChatError(errorMessage(error, t("club.detail.errors.sendFailed")));
    } finally {
      setChatLoading(false);
    }
  }

  async function voteForActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activity || selectedDates.length === 0) return;
    setVoteError("");
    setVoteLoading(true);
    try {
      await apiJson(`/api/activities/${activity.id}/votes`, {
        method: "POST",
        json: { name: voterName, dates: selectedDates },
      });
      setVoterName("");
      setSelectedDates([]);
      await loadActivity();
    } catch (error) {
      setVoteError(errorMessage(error, t("club.detail.errors.voteFailed")));
    } finally {
      setVoteLoading(false);
    }
  }

  async function removeParticipant(
    name: string,
    occurrenceId = activity?.id,
  ) {
    if (
      !activity ||
      !window.confirm(t("club.detail.confirm.removeParticipant", { name }))
    ) {
      return;
    }
    if (!occurrenceId) return;
    setActionError("");
    setActionLoading(true);
    try {
      await apiJson(`/api/activities/${occurrenceId}/join`, {
        method: "DELETE",
        json: { name },
      });
      await loadActivity();
    } catch (error) {
      setActionError(errorMessage(error, t("club.detail.errors.removeFailed")));
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteActivity() {
    if (
      !activity ||
      !window.confirm(t("club.detail.confirm.deleteActivity", { title: activity.title }))
    ) {
      return;
    }
    setActionError("");
    setActionLoading(true);
    try {
      await apiJson(`/api/activities/${activity.id}`, { method: "DELETE" });
      window.location.assign("/activities");
    } catch (error) {
      setActionError(errorMessage(error, t("club.detail.errors.deleteFailed")));
      setActionLoading(false);
    }
  }

  function moveMonth(direction: number) {
    setAnchorDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  const period = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => {
        const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
        const start = new Date(first);
        start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return day;
      }),
    [anchorDate],
  );
  const todayKey = dateKey(new Date());
  const recurringOccurrences = useMemo(
    () =>
      activity?.recurrenceSeriesId
        ? activities
            .filter(
              (item) =>
                item.recurrenceSeriesId === activity.recurrenceSeriesId &&
                (item.day ?? (item.date ? dateKey(new Date(item.date)) : "")) >=
                  todayKey,
            )
            .sort((first, second) =>
              (first.day ?? first.date ?? "").localeCompare(
                second.day ?? second.date ?? "",
              ),
            )
        : [],
    [activities, activity?.recurrenceSeriesId, todayKey],
  );
  const occurrencesWithParticipants = recurringOccurrences.filter(
    (item) => item.participants.length > 0,
  );

  return (
    <main>
      <div className="page-shell">
        <ClubHeader currentPage="activities" />
        <section className="activity-social-page">
          <Link className="text-link activity-back-link" href="/activities">
            {t("club.detail.back")}
          </Link>
          {loading ? (
            <div className="loading-panel">{t("club.detail.loading")}</div>
          ) : pageError ? (
            <div className="error-panel" role="alert">
              <span>{pageError}</span>
              <Link className="button-secondary" href="/activities">{t("club.detail.backToList")}</Link>
            </div>
          ) : activity ? (
            <>
              <header className="activity-social-hero">
                <div className="activity-social-avatar" aria-hidden="true">✳</div>
                <div className="activity-social-title">
                  <span className={`category-label ${categoryColor(activity.category)}`}>
                    {activity.kind === "quick-signup" ? t("club.categories.quickSignup") : categoryLabel(t, activity.category)}
                  </span>
                  <h1>{activity.title}</h1>
                  <p>{activity.description || t("club.detail.defaultDescription")}</p>
                  <div className="activity-social-meta">
                    <span>
                      {activity.recurrenceSeriesId && activity.repeat
                        ? t("club.repeat.label", { interval: t(repeatIntervalKeys[activity.repeat.interval]) })
                        : activity.scheduleType === "poll" || !activity.date
                        ? t("club.detail.scheduleUndecided")
                        : formatDate(new Date(activity.date), intlLocale, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            ...(activity.kind === "quick-signup"
                              ? {}
                              : { hour: "2-digit", minute: "2-digit" }),
                          })}
                    </span>
                    <span>{t("club.detail.createdBy", { name: activity.creator })}</span>
                  </div>
                </div>
                {user ? (
                  <button
                    className="button-secondary activity-delete-button"
                    type="button"
                    onClick={() => void deleteActivity()}
                    disabled={actionLoading}
                  >
                    {activity.recurrenceSeriesId
                      ? t("club.detail.deleteSeries")
                      : t("club.detail.deleteActivity")}
                  </button>
                ) : (
                  <Link
                    className="button-secondary activity-delete-button"
                    href={loginHref}
                  >
                    {t("club.auth.loginToParticipate")}
                  </Link>
                )}
              </header>

              <div className="activity-social-layout">
                <section className="activity-social-main">
                  {refreshError && (
                    <p className="activity-refresh-error" role="status">
                      {t("club.detail.refreshError", { error: refreshError })}
                    </p>
                  )}
                  {!user ? (
                    <section className="social-card activity-login-card">
                      <span className="section-kicker">{t("club.auth.loginRequired")}</span>
                      <Link className="button-primary" href={loginHref}>
                        {t("club.auth.loginToParticipate")}
                      </Link>
                    </section>
                  ) : activity.scheduleType === "poll" ? (
                    <section className="social-card activity-vote-card">
                      <div className="social-card-heading">
                        <div>
                          <span className="section-kicker">{t("club.detail.poll.kicker")}</span>
                          <h2>{t("club.detail.poll.title")}</h2>
                        </div>
                      </div>
                      <form className="activity-form" onSubmit={voteForActivity}>
                        <div className="poll-month-navigation">
                          <button className="button-secondary" type="button" onClick={() => moveMonth(-1)}>{t("club.detail.poll.prevMonth")}</button>
                          <strong>{formatMonth(anchorDate, intlLocale)}</strong>
                          <button className="button-secondary" type="button" onClick={() => moveMonth(1)}>{t("club.detail.poll.nextMonth")}</button>
                        </div>
                        <MonthGrid
                          days={period}
                          className="poll-calendar"
                          renderDay={(day) => {
                            const key = dateKey(day);
                            const selected = selectedDates.includes(key);
                            const count = activity.votes?.[key]?.length ?? 0;
                            return (
                              <button
                                className={`poll-date-option ${selected ? "selected" : ""} ${day.getMonth() !== anchorDate.getMonth() ? "day-outside" : ""}`}
                                key={key}
                                type="button"
                                aria-pressed={selected}
                                onClick={() =>
                                  setSelectedDates((current) =>
                                    current.includes(key)
                                      ? current.filter((date) => date !== key)
                                      : current.length < 14
                                        ? [...current, key]
                                        : current,
                                  )
                                }
                              >
                                <span>{day.getDate()}</span>
                                {count > 0 && <small>{count}</small>}
                              </button>
                            );
                          }}
                        />
                        <label htmlFor="detail-voter-name">{t("club.detail.poll.nameLabel")}</label>
                        <input
                          id="detail-voter-name"
                          value={voterName}
                          onChange={(event) => setVoterName(event.target.value)}
                          placeholder={t("club.detail.poll.namePlaceholder")}
                          minLength={2}
                          maxLength={40}
                          required
                        />
                        {voteError && <p className="modal-error" role="alert">{voteError}</p>}
                        <button className="button-primary" disabled={voteLoading || !selectedDates.length}>
                          {voteLoading ? t("club.detail.poll.sending") : t("club.detail.poll.submit", { count: selectedDates.length })}
                        </button>
                      </form>
                      <div className="activity-vote-results">
                        {Object.entries(activity.votes ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([date, voters]) => (
                          <p key={date}>
                            <strong>{formatDate(new Date(`${date}T00:00:00`), intlLocale, { weekday: "short", day: "numeric", month: "short" })}</strong>
                            <span>{t("club.detail.poll.people", { count: voters.length })}</span>
                          </p>
                        ))}
                        {!Object.keys(activity.votes ?? {}).length && <p>{t("club.detail.poll.none")}</p>}
                      </div>
                    </section>
                  ) : activity.recurrenceSeriesId ? (
                    <section className="social-card social-join-card">
                      <div>
                        <span className="section-kicker">{t("club.detail.join.kicker")}</span>
                        <h2>{t("club.detail.join.pickDayTitle")}</h2>
                        <p className="repeat-join-help">
                          {t("club.detail.join.pickDayHelp")}
                        </p>
                      </div>
                      <button
                        className="button-primary repeat-date-picker-toggle"
                        type="button"
                        aria-expanded={showRepeatDatePicker}
                        onClick={() => {
                          setShowRepeatDatePicker((current) => !current);
                          setJoiningOccurrenceId(null);
                          setJoinError("");
                        }}
                      >
                        {showRepeatDatePicker ? t("club.detail.join.hideDates") : t("club.detail.join.register")}
                      </button>
                      {showRepeatDatePicker && (
                        <div className="repeat-date-picker">
                          {recurringOccurrences.length ? (
                            recurringOccurrences.map((occurrence) => {
                              const occurrenceDay =
                                occurrence.day ??
                                dateKey(new Date(occurrence.date as string));
                              const selected =
                                joiningOccurrenceId === occurrence.id;
                              return (
                                <div
                                  className={`repeat-date-option ${selected ? "selected" : ""}`}
                                  key={occurrence.id}
                                >
                                  <div>
                                    <strong>
                                      {formatDate(
                                        new Date(`${occurrenceDay}T00:00:00`),
                                        intlLocale,
                                        {
                                          weekday: "long",
                                          day: "numeric",
                                          month: "long",
                                          year: "numeric",
                                        },
                                      )}
                                    </strong>
                                    <span>
                                      {occurrence.participants.length
                                        ? t("club.detail.join.registeredCount", { count: occurrence.participants.length })
                                        : t("club.detail.join.noRegistered")}
                                    </span>
                                  </div>
                                  <button
                                    className={
                                      selected
                                        ? "button-secondary"
                                        : "button-primary"
                                    }
                                    type="button"
                                    onClick={() => {
                                      setJoiningOccurrenceId(occurrence.id);
                                      setJoinError("");
                                    }}
                                  >
                                    {selected ? t("club.detail.join.selected") : t("club.detail.join.chooseDay")}
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="social-empty-members">
                              {t("club.detail.join.noUpcoming")}
                            </p>
                          )}
                        </div>
                      )}
                      {joiningOccurrenceId && (
                        <form className="activity-form repeat-join-form" onSubmit={joinActivity}>
                          <label htmlFor="repeat-participant-name">
                            {t("club.detail.join.nameForDay")}
                          </label>
                          <div className="social-join-row">
                            <input
                              id="repeat-participant-name"
                              value={participantName}
                              onChange={(event) =>
                                setParticipantName(event.target.value)
                              }
                              placeholder={t("club.detail.join.namePlaceholder")}
                              minLength={2}
                              maxLength={40}
                              required
                            />
                            <button
                              className="button-primary"
                              type="submit"
                              disabled={joinLoading}
                            >
                              {joinLoading ? t("club.detail.join.registering") : t("club.detail.join.confirm")}
                            </button>
                          </div>
                          {joinError && (
                            <p className="modal-error" role="alert">{joinError}</p>
                          )}
                        </form>
                      )}
                    </section>
                  ) : (
                    <form className="social-card social-join-card" onSubmit={joinActivity}>
                      <div>
                        <span className="section-kicker">{t("club.detail.join.kicker")}</span>
                        <h2>{t("club.detail.join.register")}</h2>
                      </div>
                      <div className="social-join-row">
                        <input
                          aria-label={t("club.detail.join.nameLabel")}
                          value={participantName}
                          onChange={(event) => setParticipantName(event.target.value)}
                          placeholder={t("club.detail.join.namePlaceholder")}
                          minLength={2}
                          maxLength={40}
                          required
                        />
                        <button className="button-primary" type="submit" disabled={joinLoading}>
                          {joinLoading ? t("club.detail.join.registering") : t("club.detail.join.join")}
                        </button>
                      </div>
                      {joinError && <p className="modal-error" role="alert">{joinError}</p>}
                    </form>
                  )}

                  <section className="social-card activity-chat-card">
                    <div className="social-card-heading">
                      <div>
                        <span className="section-kicker">{t("club.detail.chat.kicker")}</span>
                        <h2>{t("club.detail.chat.title")}</h2>
                      </div>
                      <span className="activity-chat-live"><i /> {t("club.detail.chat.live")}</span>
                    </div>
                    <div className="activity-chat-messages" aria-live="polite">
                      {activity.comments?.length ? (
                        [...activity.comments]
                          .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
                          .map((comment) => (
                            <article className="activity-chat-message" key={comment.id}>
                              <p>{comment.message}</p>
                              <time dateTime={comment.createdAt}>
                                {formatDate(new Date(comment.createdAt), intlLocale, {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </time>
                            </article>
                          ))
                      ) : (
                        <p className="activity-chat-empty">{t("club.detail.chat.empty")}</p>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    {user ? (
                      <>
                        {chatError && <p className="modal-error" role="alert">{chatError}</p>}
                        <form className="activity-chat-form" onSubmit={sendMessage}>
                          <textarea
                            aria-label={t("club.detail.chat.messageLabel")}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            placeholder={t("club.detail.chat.placeholder")}
                            minLength={2}
                            maxLength={1000}
                            rows={2}
                            required
                          />
                          <button className="button-primary" type="submit" disabled={chatLoading}>
                            {chatLoading ? t("club.detail.chat.sending") : t("club.detail.chat.send")}
                          </button>
                        </form>
                      </>
                    ) : (
                      <Link className="button-secondary activity-login-link" href={loginHref}>
                        {t("club.auth.loginToParticipate")}
                      </Link>
                    )}
                  </section>
                </section>

                <aside className="activity-social-sidebar">
                  <section className="social-card">
                    <div className="social-card-heading">
                      <div>
                        <span className="section-kicker">{t("club.detail.sidebar.kicker")}</span>
                        <h2>
                          {activity.recurrenceSeriesId
                            ? t("club.detail.sidebar.daysWithRegistrations")
                            : t("club.detail.sidebar.participants")}
                        </h2>
                      </div>
                      <strong className="social-member-count">
                        {activity.recurrenceSeriesId
                          ? occurrencesWithParticipants.length
                          : activity.participants.length}
                      </strong>
                    </div>
                    {activity.recurrenceSeriesId ? (
                      occurrencesWithParticipants.length ? (
                        <ul className="social-member-list repeat-participant-days">
                          {occurrencesWithParticipants.map((occurrence) => {
                            const occurrenceDay =
                              occurrence.day ??
                              dateKey(new Date(occurrence.date as string));
                            return (
                              <li
                                className="repeat-participant-day"
                                key={occurrence.id}
                              >
                                <strong>
                                  {formatDate(
                                    new Date(`${occurrenceDay}T00:00:00`),
                                    intlLocale,
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )}
                                </strong>
                                <span className="repeat-participant-names">
                                  {occurrence.participants.map((participant) => (
                                    <span key={participant}>
                                      {participant}
                                      {user && <button
                                        className="remove-member-button"
                                        type="button"
                                        aria-label={t("club.detail.sidebar.removeFromDay", { name: participant, day: occurrenceDay })}
                                        disabled={actionLoading}
                                        onClick={() =>
                                          void removeParticipant(
                                            participant,
                                            occurrence.id,
                                          )
                                        }
                                      >
                                        ×
                                      </button>}
                                    </span>
                                  ))}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="social-empty-members">
                          {t("club.detail.sidebar.noDays")}
                        </p>
                      )
                    ) : activity.participants.length ? (
                      <ul className="social-member-list">
                        {activity.participants.map((participant, index) => (
                          <li key={`${activity.id}-${participant}`}>
                            <span className={`member-avatar member-avatar-${index % 4}`}>
                              {participant.charAt(0).toLocaleUpperCase(intlLocale)}
                            </span>
                            <span>{participant}</span>
                            {user && <button
                              className="remove-member-button"
                              type="button"
                              aria-label={t("club.detail.sidebar.removeFromActivity", { name: participant })}
                              disabled={actionLoading}
                              onClick={() => void removeParticipant(participant)}
                            >
                              ×
                            </button>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="social-empty-members">{t("club.detail.sidebar.noMembers")}</p>
                    )}
                    {actionError && <p className="modal-error" role="alert">{actionError}</p>}
                  </section>
                  <section className="social-card activity-social-about">
                    <span className="section-kicker">{t("club.detail.about.kicker")}</span>
                    <p>{activity.description || t("club.detail.about.defaultDescription")}</p>
                    <div>
                      <strong>
                        {activity.recurrenceSeriesId
                          ? recurringOccurrences.reduce(
                              (total, occurrence) =>
                                total + occurrence.participants.length,
                              0,
                            )
                          : activity.participants.length}
                      </strong>{" "}
                      {t("club.detail.about.registrations")}
                    </div>
                    <div><strong>{activity.comments?.length ?? 0}</strong> {t("club.detail.about.messages")}</div>
                  </section>
                </aside>
              </div>
            </>
          ) : null}
        </section>
        <ClubFooter />
      </div>
    </main>
  );
}
