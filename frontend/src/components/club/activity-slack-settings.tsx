"use client";

import { useCallback, useEffect, useState } from "react";
import { useDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/i18n/i18n-provider";
import { apiJson, errorMessage } from "@/lib/api/client";

type Schedule = {
  id: string;
  paused: boolean;
  message: string;
  interval: "daily" | "weekly" | "monthly";
  startDate: string;
  sendTime: string;
  weekday: number | null;
  monthDay: number | null;
  nextAttemptAt: string;
  lastError: string | null;
};

function vietnamToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function ActivitySlackSettings({ activityId }: { activityId: string }) {
  const { t, intlLocale } = useI18n();
  const { confirm } = useDialog();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [interval, setInterval] = useState<Schedule["interval"]>("daily");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endpoint = `/api/activities/${encodeURIComponent(activityId)}/slack-schedules`;
  const load = useCallback(async () => {
    const data = await apiJson<{ schedules: Schedule[]; configured: boolean }>(endpoint, { cache: "no-store" });
    setSchedules(data.schedules);
    setConfigured(data.configured);
  }, [endpoint]);

  useEffect(() => {
    let active = true;
    load().catch((err) => {
      if (active) setError(errorMessage(err, t("club.detail.slack.loadError")));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [load, t]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await apiJson<{ schedule: Schedule }>(endpoint, {
        method: "POST",
        json: {
          message: String(form.get("message") ?? ""),
          interval,
          startDate: String(form.get("startDate") ?? ""),
          sendTime: String(form.get("sendTime") ?? ""),
          weekday: interval === "weekly" ? Number(form.get("weekday")) : null,
          monthDay: interval === "monthly" ? Number(form.get("monthDay")) : null,
        },
      });
      formElement.reset();
      setInterval("daily");
      setSchedules((current) => [...current, data.schedule]);
      setNotice(t("club.detail.slack.created"));
    } catch (err) {
      setError(errorMessage(err, t("club.detail.slack.saveError")));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (
      !(await confirm({
        title: t("common.confirmTitle"),
        message: t("club.detail.slack.confirmCancel"),
        confirmLabel: t("common.confirm"),
        tone: "danger",
      }))
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiJson(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
      setSchedules((current) => current.filter((item) => item.id !== id));
      setNotice(t("club.detail.slack.cancelled"));
    } catch (err) {
      setError(errorMessage(err, t("club.detail.slack.cancelError")));
    } finally {
      setBusy(false);
    }
  }

  const weekdays = [
    t("club.detail.slack.monday"), t("club.detail.slack.tuesday"),
    t("club.detail.slack.wednesday"), t("club.detail.slack.thursday"),
    t("club.detail.slack.friday"), t("club.detail.slack.saturday"), t("club.detail.slack.sunday"),
  ];

  return (
    <section className="activity-slack-settings" aria-labelledby="slack-settings-title">
      <h3 id="slack-settings-title">{t("club.detail.slack.title")}</h3>
      <p className="modal-intro">{t("club.detail.slack.intro")}</p>
      {configured === false && <p className="modal-error" role="status">{t("club.detail.slack.notConfigured")}</p>}
      {loading ? <p>{t("club.detail.slack.loading")}</p> : (
        <>
          {schedules.map((schedule) => (
            <div className="activity-slack-schedule" key={schedule.id}>
              <strong>{schedule.message}</strong>
              <span>
                {t(`club.detail.slack.${schedule.interval}`)}{" "}
                {schedule.interval === "weekly" && schedule.weekday !== null ? weekdays[schedule.weekday] : ""}
                {schedule.interval === "monthly" ? ` ${schedule.monthDay}` : ""}
                {" · "}{schedule.sendTime.slice(0, 5)} · Asia/Ho_Chi_Minh
              </span>
              {schedule.paused ? <span>{t("admin.slackManagement.paused")}</span> : <span>{t("club.detail.slack.next", { date: new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(schedule.nextAttemptAt)) })}</span>}
              {schedule.lastError && <span className="modal-error">{schedule.lastError === "webhook_not_configured" ? t("club.detail.slack.notConfigured") : t("club.detail.slack.deliveryFailed")}</span>}
              <button className="button-secondary" type="button" disabled={busy} onClick={() => void cancel(schedule.id)}>{t("club.detail.slack.cancel")}</button>
            </div>
          ))}
          <form className="activity-form" onSubmit={create}>
            <label htmlFor="slack-message">{t("club.detail.slack.message")}</label>
            <textarea id="slack-message" name="message" rows={3} maxLength={1000} required />
            <label htmlFor="slack-start">{t("club.detail.slack.startDate")}</label>
            <input id="slack-start" name="startDate" type="date" defaultValue={vietnamToday()} required />
            <label htmlFor="slack-time">{t("club.detail.slack.time")}</label>
            <input id="slack-time" name="sendTime" type="time" defaultValue="09:00" required />
            <label htmlFor="slack-interval">{t("club.detail.slack.repeat")}</label>
            <select id="slack-interval" className="ui-select" value={interval} onChange={(event) => {
              const value = event.target.value;
              if (value === "daily" || value === "weekly" || value === "monthly") setInterval(value);
            }}>
              <option value="daily">{t("club.detail.slack.daily")}</option>
              <option value="weekly">{t("club.detail.slack.weekly")}</option>
              <option value="monthly">{t("club.detail.slack.monthly")}</option>
            </select>
            {interval === "weekly" && (
              <>
                <label htmlFor="slack-weekday">{t("club.detail.slack.weekday")}</label>
                <select id="slack-weekday" name="weekday" className="ui-select">{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select>
              </>
            )}
            {interval === "monthly" && (
              <>
                <label htmlFor="slack-month-day">{t("club.detail.slack.monthDay")}</label>
                <input id="slack-month-day" name="monthDay" type="number" min={1} max={31} defaultValue={1} required />
                <p className="modal-intro">{t("club.detail.slack.monthEnd")}</p>
              </>
            )}
            <button type="submit" className="button-primary modal-submit" disabled={busy}>{t("club.detail.slack.add")}</button>
          </form>
        </>
      )}
      {error && <p className="modal-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
