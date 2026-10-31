"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ActivityComment, ClubActivity } from "@/lib/activities";
import { ClubFooter, ClubHeader } from "@/components/club/site-chrome";
import { MonthGrid } from "@/components/club/month-grid";
import { categoryColor, dateKey, formatDate, formatMonth } from "@/lib/club-ui";

type ActivityResponse = {
  activities?: ClubActivity[];
  error?: string;
};

export default function ActivityDetailPage({
  activityId,
}: {
  activityId: string;
}) {
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
    const response = await fetch("/api/activities", { cache: "no-store" });
    const data = (await response.json()) as ActivityResponse;
    if (!response.ok) {
      throw new Error(data.error ?? "Không thể tải hoạt động.");
    }

    const allActivities = data.activities ?? [];
    const foundActivity = allActivities.find(
      (item) => item.id === activityId,
    );
    if (!foundActivity) throw new Error("Không tìm thấy hoạt động.");
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
          const message =
            error instanceof Error ? error.message : "Không thể tải hoạt động.";
          if (initial) setPageError(message);
          else setRefreshError(message);
        }
      } finally {
        if (active && initial) setLoading(false);
      }
    };

    void refresh(true);
    const intervalId = window.setInterval(() => void refresh(false), 5000);
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
      setJoinError("Vui lòng chọn ngày muốn tham gia.");
      return;
    }
    setJoinError("");
    setJoinLoading(true);
    try {
      const response = await fetch(`/api/activities/${targetActivity.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: participantName }),
      });
      const data = (await response.json()) as { name?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể tham gia.");
      if (!data.name) throw new Error("Máy chủ không xác nhận đăng ký.");
      setParticipantName("");
      setJoiningOccurrenceId(null);
      await loadActivity();
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Không thể tham gia.");
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
      const response = await fetch(`/api/activities/${activity.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as {
        comment?: ActivityComment;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Không thể gửi tin nhắn.");
      const createdComment = data.comment;
      if (!createdComment) throw new Error("Máy chủ không trả về tin nhắn.");
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
      setChatError(error instanceof Error ? error.message : "Không thể gửi tin nhắn.");
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
      const response = await fetch(`/api/activities/${activity.id}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: voterName, dates: selectedDates }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể gửi bình chọn.");
      setVoterName("");
      setSelectedDates([]);
      await loadActivity();
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : "Không thể gửi bình chọn.");
    } finally {
      setVoteLoading(false);
    }
  }

  async function removeParticipant(
    name: string,
    occurrenceId = activity?.id,
  ) {
    if (!activity || !window.confirm(`Xóa ${name} khỏi hoạt động?`)) return;
    if (!occurrenceId) return;
    setActionError("");
    setActionLoading(true);
    try {
      const response = await fetch(`/api/activities/${occurrenceId}/join`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa thành viên.");
      await loadActivity();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Không thể xóa thành viên.");
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteActivity() {
    if (!activity || !window.confirm(`Xóa hoạt động "${activity.title}"?`)) return;
    setActionError("");
    setActionLoading(true);
    try {
      const response = await fetch(`/api/activities/${activity.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa hoạt động.");
      window.location.assign("/activities");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Không thể xóa hoạt động.");
      setActionLoading(false);
    }
  }

  function moveMonth(direction: number) {
    setAnchorDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  const period = Array.from({ length: 42 }, (_, index) => {
    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  const todayKey = dateKey(new Date());
  const recurringOccurrences = activity?.recurrenceSeriesId
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
    : [];
  const occurrencesWithParticipants = recurringOccurrences.filter(
    (item) => item.participants.length > 0,
  );

  return (
    <main>
      <div className="page-shell">
        <ClubHeader currentPage="activities" />
        <section className="activity-social-page">
          <Link className="text-link activity-back-link" href="/activities">
            ← Quay lại hoạt động
          </Link>
          {loading ? (
            <div className="loading-panel">Đang tải hoạt động...</div>
          ) : pageError ? (
            <div className="error-panel" role="alert">
              <span>{pageError}</span>
              <Link className="button-secondary" href="/activities">Về danh sách hoạt động</Link>
            </div>
          ) : activity ? (
            <>
              <header className="activity-social-hero">
                <div className="activity-social-avatar" aria-hidden="true">✳</div>
                <div className="activity-social-title">
                  <span className={`category-label ${categoryColor(activity.category)}`}>
                    {activity.kind === "quick-signup" ? "ĐĂNG KÝ NHANH" : activity.category}
                  </span>
                  <h1>{activity.title}</h1>
                  <p>{activity.description || "Cùng tham gia và kết nối với câu lạc bộ."}</p>
                  <div className="activity-social-meta">
                    <span>
                      {activity.recurrenceSeriesId && activity.repeat
                        ? `Lặp ${activity.repeat.interval === "daily" ? "hằng ngày" : activity.repeat.interval === "weekly" ? "hằng tuần" : "hằng tháng"}`
                        : activity.scheduleType === "poll" || !activity.date
                        ? "Chưa chốt lịch"
                        : formatDate(new Date(activity.date), {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            ...(activity.kind === "quick-signup"
                              ? {}
                              : { hour: "2-digit", minute: "2-digit" }),
                          })}
                    </span>
                    <span>Khởi tạo bởi {activity.creator}</span>
                  </div>
                </div>
                <button
                  className="button-secondary activity-delete-button"
                  type="button"
                  onClick={() => void deleteActivity()}
                  disabled={actionLoading}
                >
                  {activity.recurrenceSeriesId
                    ? "Xóa cả chuỗi lặp"
                    : "Xóa hoạt động"}
                </button>
              </header>

              <div className="activity-social-layout">
                <section className="activity-social-main">
                  {refreshError && (
                    <p className="activity-refresh-error" role="status">
                      {refreshError} Đang thử cập nhật lại...
                    </p>
                  )}
                  {activity.scheduleType === "poll" ? (
                    <section className="social-card activity-vote-card">
                      <div className="social-card-heading">
                        <div>
                          <span className="section-kicker">CÙNG CHỌN LỊCH</span>
                          <h2>Bạn rảnh ngày nào?</h2>
                        </div>
                      </div>
                      <form className="activity-form" onSubmit={voteForActivity}>
                        <div className="poll-month-navigation">
                          <button className="button-secondary" type="button" onClick={() => moveMonth(-1)}>‹ Tháng trước</button>
                          <strong>{formatMonth(anchorDate)}</strong>
                          <button className="button-secondary" type="button" onClick={() => moveMonth(1)}>Tháng sau ›</button>
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
                        <label htmlFor="detail-voter-name">Tên của bạn</label>
                        <input
                          id="detail-voter-name"
                          value={voterName}
                          onChange={(event) => setVoterName(event.target.value)}
                          placeholder="Nhập tên để bình chọn"
                          minLength={2}
                          maxLength={40}
                          required
                        />
                        {voteError && <p className="modal-error" role="alert">{voteError}</p>}
                        <button className="button-primary" disabled={voteLoading || !selectedDates.length}>
                          {voteLoading ? "Đang gửi..." : `Gửi bình chọn (${selectedDates.length} ngày)`}
                        </button>
                      </form>
                      <div className="activity-vote-results">
                        {Object.entries(activity.votes ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([date, voters]) => (
                          <p key={date}>
                            <strong>{formatDate(new Date(`${date}T00:00:00`), { weekday: "short", day: "numeric", month: "short" })}</strong>
                            <span>{voters.length} người</span>
                          </p>
                        ))}
                        {!Object.keys(activity.votes ?? {}).length && <p>Chưa có bình chọn.</p>}
                      </div>
                    </section>
                  ) : activity.recurrenceSeriesId ? (
                    <section className="social-card social-join-card">
                      <div>
                        <span className="section-kicker">THAM GIA CÙNG MỌI NGƯỜI</span>
                        <h2>Chọn ngày tham gia</h2>
                        <p className="repeat-join-help">
                          Mỗi ngày có danh sách đăng ký riêng. Chọn ngày bạn muốn tham gia.
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
                        {showRepeatDatePicker ? "Ẩn ngày đăng ký" : "Đăng ký tham gia"}
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
                                        ? `${occurrence.participants.length} người đã đăng ký`
                                        : "Chưa có người đăng ký"}
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
                                    {selected ? "Đã chọn" : "Chọn ngày"}
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="social-empty-members">
                              Chưa có ngày diễn ra nào sắp tới.
                            </p>
                          )}
                        </div>
                      )}
                      {joiningOccurrenceId && (
                        <form className="activity-form repeat-join-form" onSubmit={joinActivity}>
                          <label htmlFor="repeat-participant-name">
                            Tên đăng ký cho ngày đã chọn
                          </label>
                          <div className="social-join-row">
                            <input
                              id="repeat-participant-name"
                              value={participantName}
                              onChange={(event) =>
                                setParticipantName(event.target.value)
                              }
                              placeholder="Nhập tên của bạn"
                              minLength={2}
                              maxLength={40}
                              required
                            />
                            <button
                              className="button-primary"
                              type="submit"
                              disabled={joinLoading}
                            >
                              {joinLoading ? "Đang đăng ký..." : "Xác nhận"}
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
                        <span className="section-kicker">THAM GIA CÙNG MỌI NGƯỜI</span>
                        <h2>Đăng ký tham gia</h2>
                      </div>
                      <div className="social-join-row">
                        <input
                          aria-label="Tên của bạn"
                          value={participantName}
                          onChange={(event) => setParticipantName(event.target.value)}
                          placeholder="Nhập tên của bạn"
                          minLength={2}
                          maxLength={40}
                          required
                        />
                        <button className="button-primary" type="submit" disabled={joinLoading}>
                          {joinLoading ? "Đang đăng ký..." : "Tham gia"}
                        </button>
                      </div>
                      {joinError && <p className="modal-error" role="alert">{joinError}</p>}
                    </form>
                  )}

                  <section className="social-card activity-chat-card">
                    <div className="social-card-heading">
                      <div>
                        <span className="section-kicker">KHÔNG GIAN CHUNG</span>
                        <h2>Trò chuyện</h2>
                      </div>
                      <span className="activity-chat-live"><i /> Cập nhật trực tiếp</span>
                    </div>
                    <div className="activity-chat-messages" aria-live="polite">
                      {activity.comments?.length ? (
                        [...activity.comments]
                          .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
                          .map((comment) => (
                            <article className="activity-chat-message" key={comment.id}>
                              <p>{comment.message}</p>
                              <time dateTime={comment.createdAt}>
                                {formatDate(new Date(comment.createdAt), {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </time>
                            </article>
                          ))
                      ) : (
                        <p className="activity-chat-empty">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!</p>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    {chatError && <p className="modal-error" role="alert">{chatError}</p>}
                    <form className="activity-chat-form" onSubmit={sendMessage}>
                      <textarea
                        aria-label="Tin nhắn"
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="Viết tin nhắn cho mọi người..."
                        minLength={2}
                        maxLength={1000}
                        rows={2}
                        required
                      />
                      <button className="button-primary" type="submit" disabled={chatLoading}>
                        {chatLoading ? "Đang gửi..." : "Gửi"}
                      </button>
                    </form>
                  </section>
                </section>

                <aside className="activity-social-sidebar">
                  <section className="social-card">
                    <div className="social-card-heading">
                      <div>
                        <span className="section-kicker">CỘNG ĐỒNG</span>
                        <h2>
                          {activity.recurrenceSeriesId
                            ? "Ngày đã có đăng ký"
                            : "Người tham gia"}
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
                                      <button
                                        className="remove-member-button"
                                        type="button"
                                        aria-label={`Xóa ${participant} khỏi ngày ${occurrenceDay}`}
                                        disabled={actionLoading}
                                        onClick={() =>
                                          void removeParticipant(
                                            participant,
                                            occurrence.id,
                                          )
                                        }
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="social-empty-members">
                          Chưa có ngày nào có người đăng ký.
                        </p>
                      )
                    ) : activity.participants.length ? (
                      <ul className="social-member-list">
                        {activity.participants.map((participant, index) => (
                          <li key={`${activity.id}-${participant}`}>
                            <span className={`member-avatar member-avatar-${index % 4}`}>
                              {participant.charAt(0).toLocaleUpperCase("vi")}
                            </span>
                            <span>{participant}</span>
                            <button
                              className="remove-member-button"
                              type="button"
                              aria-label={`Xóa ${participant} khỏi hoạt động`}
                              disabled={actionLoading}
                              onClick={() => void removeParticipant(participant)}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="social-empty-members">Chưa có thành viên đăng ký.</p>
                    )}
                    {actionError && <p className="modal-error" role="alert">{actionError}</p>}
                  </section>
                  <section className="social-card activity-social-about">
                    <span className="section-kicker">VỀ HOẠT ĐỘNG</span>
                    <p>{activity.description || "Hoạt động cộng đồng Brave Active."}</p>
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
                      lượt đăng ký từ hôm nay
                    </div>
                    <div><strong>{activity.comments?.length ?? 0}</strong> tin nhắn</div>
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
