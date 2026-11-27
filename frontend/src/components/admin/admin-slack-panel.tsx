"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";
import { apiJson, errorMessage } from "@/lib/api/client";

type Schedule = {
  id: string;
  activityId: string | null;
  activityTitle: string;
  message: string;
  interval: "daily" | "weekly" | "monthly";
  weekday: number | null;
  monthDay: number | null;
  sendTime: string;
  nextAttemptAt: string;
  paused: boolean;
  cancelled: boolean;
  lastError: string | null;
};
type Delivery = {
  id: string;
  attemptedAt: string;
  status: "sent" | "failed";
  message: string | null;
  error: string | null;
};
const PAGE_SIZE = 50;

export function AdminSlackPanel() {
  const { t, intlLocale } = useI18n();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<Delivery[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyMore, setHistoryMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError("");
    try {
      const page = await apiJson<{ schedules: Schedule[]; hasMore: boolean; configured: boolean }>(
        `/api/admin/slack-schedules?offset=${nextOffset}&limit=${PAGE_SIZE}`, { cache: "no-store" },
      );
      setSchedules(page.schedules);
      setMore(page.hasMore);
      setConfigured(page.configured);
      setOffset(nextOffset);
      setSelected(null);
    } catch (reason) {
      setError(errorMessage(reason, t("admin.slackManagement.loadError")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(0); }, [load]);

  async function toggle(schedule: Schedule) {
    setBusy(schedule.id);
    setError("");
    try {
      const data = await apiJson<{ schedule: Pick<Schedule, "paused" | "nextAttemptAt" | "lastError"> }>(
        `/api/admin/slack-schedules/${encodeURIComponent(schedule.id)}`,
        { method: "PATCH", json: { paused: !schedule.paused } },
      );
      setSchedules((items) => items.map((item) => item.id === schedule.id ? { ...item, ...data.schedule } : item));
    } catch (reason) {
      setError(errorMessage(reason, t("admin.slackManagement.updateError")));
    } finally {
      setBusy(null);
    }
  }

  async function loadHistory(id: string, nextOffset: number) {
    if (selected !== id) {
      setHistory([]);
      setHistoryOffset(0);
      setHistoryMore(false);
    }
    setSelected(id);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const page = await apiJson<{ history: Delivery[]; hasMore: boolean }>(
        `/api/admin/slack-schedules/${encodeURIComponent(id)}/history?offset=${nextOffset}&limit=${PAGE_SIZE}`,
        { cache: "no-store" },
      );
      setHistory(page.history);
      setHistoryOffset(nextOffset);
      setHistoryMore(page.hasMore);
    } catch (reason) {
      setHistoryError(errorMessage(reason, t("admin.slackManagement.historyError")));
    } finally {
      setHistoryLoading(false);
    }
  }

  function dateTime(value: string) {
    return new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
  }
  const days = [
    t("club.detail.slack.monday"), t("club.detail.slack.tuesday"), t("club.detail.slack.wednesday"),
    t("club.detail.slack.thursday"), t("club.detail.slack.friday"), t("club.detail.slack.saturday"), t("club.detail.slack.sunday"),
  ];

  return (
    <section>
      <h2>{t("admin.slackManagement.title")}</h2>
      <p className="feed-note">{t("admin.slackManagement.historyNote")}</p>
      {!configured && <p className="form-error" role="status">{t("club.detail.slack.notConfigured")}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p>{t("common.loading")}</p> : schedules.length === 0 && !error ? <p>{t("admin.slackManagement.empty")}</p> : null}
      {schedules.map((schedule) => (
        <article className="admin-slack-item" key={schedule.id}>
          <div className="admin-activity-details">
            <strong>{schedule.activityTitle}</strong>
            <p className="admin-slack-message">{schedule.message}</p>
            <span>{t(`club.detail.slack.${schedule.interval}`)}{" "}
              {schedule.interval === "weekly" && schedule.weekday !== null ? days[schedule.weekday] : ""}
              {schedule.interval === "monthly" ? schedule.monthDay : ""}
              {" · "}{schedule.sendTime.slice(0, 5)} · Asia/Ho_Chi_Minh
            </span>
            <span>{schedule.cancelled ? t("admin.slackManagement.cancelled") : !schedule.activityId ? t("admin.slackManagement.deletedActivity") : schedule.paused ? t("admin.slackManagement.paused") : t("admin.slackManagement.running")}</span>
            {!schedule.cancelled && schedule.activityId && !schedule.paused && <span>{t("club.detail.slack.next", { date: dateTime(schedule.nextAttemptAt) })}</span>}
            {schedule.lastError && <span className="form-error">{schedule.lastError === "webhook_not_configured" ? t("club.detail.slack.notConfigured") : t("club.detail.slack.deliveryFailed")}</span>}
          </div>
          <div className="admin-row-actions">
            {schedule.activityId && <Link className="button-secondary admin-row-action" href={`/activities/${encodeURIComponent(schedule.activityId)}`}>{t("admin.viewActivity")}</Link>}
            {!schedule.cancelled && schedule.activityId && <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void toggle(schedule)}>{schedule.paused ? t("admin.slackManagement.resume") : t("admin.slackManagement.pause")}</Button>}
            <Button variant="secondary" size="sm" onClick={() => selected === schedule.id ? setSelected(null) : void loadHistory(schedule.id, 0)}>
              {selected === schedule.id ? t("admin.slackManagement.hideHistory") : t("admin.slackManagement.history")}
            </Button>
          </div>
          {selected === schedule.id && (
            <section className="admin-slack-history" aria-label={t("admin.slackManagement.history")}>
              {historyLoading ? <p>{t("common.loading")}</p> : historyError ? <p className="form-error" role="alert">{historyError}</p> : history.length === 0 ? <p>{t("admin.slackManagement.noHistory")}</p> : history.map((entry) => (
                <article className="admin-slack-delivery" key={entry.id}>
                  <strong>{entry.status === "sent" ? t("admin.slackManagement.sent") : t("admin.slackManagement.failed")}</strong>{" · "}
                  <time dateTime={entry.attemptedAt}>{dateTime(entry.attemptedAt)}</time>
                  {entry.error && <p>{entry.error === "webhook_not_configured" ? t("club.detail.slack.notConfigured") : t("club.detail.slack.deliveryFailed")}</p>}
                  {entry.message && <p className="admin-slack-message">{entry.message}</p>}
                </article>
              ))}
              {historyError && <Button variant="secondary" onClick={() => void loadHistory(schedule.id, historyOffset)}>{t("common.retry")}</Button>}
              {(historyOffset > 0 || historyMore) && <div className="admin-pagination">
                {historyOffset > 0 && <Button variant="secondary" disabled={historyLoading} onClick={() => void loadHistory(schedule.id, Math.max(0, historyOffset - PAGE_SIZE))}>{t("admin.previous")}</Button>}
                {historyMore && <Button variant="secondary" disabled={historyLoading} onClick={() => void loadHistory(schedule.id, historyOffset + PAGE_SIZE)}>{t("admin.next")}</Button>}
              </div>}
            </section>
          )}
        </article>
      ))}
      {error && <Button variant="secondary" onClick={() => void load(offset)}>{t("common.retry")}</Button>}
      {(offset > 0 || more) && <div className="admin-pagination">
        {offset > 0 && <Button variant="secondary" disabled={loading} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}>{t("admin.previous")}</Button>}
        {more && <Button variant="secondary" disabled={loading} onClick={() => void load(offset + PAGE_SIZE)}>{t("admin.next")}</Button>}
      </div>}
    </section>
  );
}
