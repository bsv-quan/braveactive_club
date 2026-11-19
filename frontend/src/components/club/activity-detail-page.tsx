"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ActivityComment, ClubActivity } from "@/lib/activities";
import { useAuth } from "@/components/auth/auth-provider";
import { ClubFooter, ClubHeader } from "@/components/layout/site-chrome";
import { useI18n } from "@/i18n/i18n-provider";
import { apiJson, errorMessage } from "@/lib/api/client";
import {
  categoryColor,
  categoryLabel,
  dateKey,
  formatDate,
  repeatIntervalKeys,
} from "@/lib/club-ui";

type ActivityResponse = {
  activity: ClubActivity;
  occurrences: ClubActivity[];
};

function isOwnParticipant(accountName: string, participantName: string) {
  const normalize = (value: string) =>
    value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return normalize(accountName) === normalize(participantName);
}

export default function ActivityDetailPage({
  activityId,
}: {
  activityId: string;
}) {
  const { t, intlLocale } = useI18n();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
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
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [showRepeatDatePicker, setShowRepeatDatePicker] = useState(false);
  const [joiningOccurrenceId, setJoiningOccurrenceId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadActivity = useCallback(async () => {
    const data = await apiJson<ActivityResponse>(`/api/activities/${encodeURIComponent(activityId)}`, {
      cache: "no-store",
    });
    if (!data.activity) throw new Error(tRef.current("club.detail.errors.notFound"));
    setActivities(data.occurrences);
    setActivity(data.activity);
    if (data.activity.id !== activityId) {
      router.replace(`/activities/${encodeURIComponent(data.activity.id)}`, { scroll: false });
    }
    setPageError("");
    setRefreshError("");
  }, [activityId, router]);

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
        { method: "POST" },
      );
      if (!data.name) throw new Error(t("club.detail.errors.joinNotConfirmed"));
      setJoiningOccurrenceId(null);
      await loadActivity();
    } catch (error) {
      setJoinError(errorMessage(error, t("club.detail.errors.joinFailed")));
    } finally {
      setJoinLoading(false);
    }
  }

  async function leaveOwnActivity(occurrenceId = activity?.id) {
    if (!activity || !occurrenceId) return;
    setJoinError("");
    setJoinLoading(true);
    try {
      await apiJson(`/api/activities/${occurrenceId}/join`, { method: "DELETE" });
      setJoiningOccurrenceId(null);
      await loadActivity();
    } catch (error) {
      setJoinError(errorMessage(error, t("club.detail.errors.leaveFailed")));
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
                ) : null}
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
                      <Link className="button-primary activity-login-action" href={loginHref}>
                        {t("club.auth.login")}
                      </Link>
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
                              const registered = Boolean(
                                user &&
                                  occurrence.participants.some((participant) =>
                                    isOwnParticipant(user.displayName, participant),
                                  ),
                              );
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
                                  {registered ? (
                                    <button
                                      className="button-secondary"
                                      type="button"
                                      disabled={joinLoading}
                                      onClick={() => void leaveOwnActivity(occurrence.id)}
                                    >
                                      {joinLoading ? t("club.detail.join.registering") : t("club.detail.join.cancelRegistration")}
                                    </button>
                                  ) : (
                                    <button
                                      className={selected ? "button-secondary" : "button-primary"}
                                      type="button"
                                      onClick={() => {
                                        setJoiningOccurrenceId(occurrence.id);
                                        setJoinError("");
                                      }}
                                    >
                                      {selected ? t("club.detail.join.selected") : t("club.detail.join.chooseDay")}
                                    </button>
                                  )}
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
                          <div className="social-join-row">
                            <span className="activity-join-account">
                              {t("club.detail.join.asAccount", { name: user.displayName })}
                            </span>
                            <button
                              className="button-primary"
                              type="submit"
                              disabled={joinLoading}
                            >
                              {joinLoading ? t("club.detail.join.registering") : t("club.detail.join.confirm")}
                            </button>
                          </div>
                        </form>
                      )}
                      {joinError && <p className="modal-error" role="alert">{joinError}</p>}
                    </section>
                  ) : (
                    <form className="social-card social-join-card" onSubmit={joinActivity}>
                      <div>
                        <span className="section-kicker">{t("club.detail.join.kicker")}</span>
                        <h2>{t("club.detail.join.register")}</h2>
                      </div>
                      <div className="social-join-row">
                        <span className="activity-join-account">
                          {t("club.detail.join.asAccount", { name: user?.displayName ?? "" })}
                        </span>
                        {activity.participants.some((participant) =>
                          isOwnParticipant(user.displayName, participant),
                        ) ? (
                          <button
                            className="button-secondary"
                            type="button"
                            disabled={joinLoading}
                            onClick={() => void leaveOwnActivity()}
                          >
                            {joinLoading
                              ? t("club.detail.join.registering")
                              : t("club.detail.join.cancelRegistration")}
                          </button>
                        ) : (
                          <button className="button-primary" type="submit" disabled={joinLoading}>
                            {joinLoading ? t("club.detail.join.registering") : t("club.detail.join.join")}
                          </button>
                        )}
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
                              <strong className="activity-chat-author">
                                {comment.authorName ?? t("club.detail.chat.unknownAuthor")}
                              </strong>
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
                    ) : null}
                  </section>
                </section>

                <aside className="activity-social-sidebar">
                  <section className="social-card">
                    <div className="social-card-heading">
                      <div>
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
                                      {user && isOwnParticipant(user.displayName, participant) && <button
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
                            {user && isOwnParticipant(user.displayName, participant) && <button
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
                  {activity.location ? (
                    <section className="social-card activity-map-card" aria-labelledby="activity-map-title">
                      <h2 id="activity-map-title">{t("club.detail.locationMap")}</h2>
                      <p>{activity.location}</p>
                      <iframe
                        title={t("club.detail.locationMap")}
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(activity.location)}&output=embed`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </section>
                  ) : null}
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
