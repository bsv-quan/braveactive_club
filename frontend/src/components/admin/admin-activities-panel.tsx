"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/i18n/i18n-provider";
import { type ClubActivity } from "@/lib/activities";
import { apiJson, errorMessage } from "@/lib/api/client";

const PAGE_SIZE = 50;

export function AdminActivitiesPanel() {
  const { user } = useAuth();
  const { t, intlLocale } = useI18n();
  const { confirm } = useDialog();
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [pendingActivities, setPendingActivities] = useState<ClubActivity[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pendingHasMore, setPendingHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadPage = useCallback(async (offset: number, replace: boolean) => {
    setLoading(true);
    setError("");
    try {
      const page = await apiJson<{ activities: ClubActivity[]; hasMore: boolean }>(
        `/api/admin/activities?offset=${offset}&limit=${PAGE_SIZE}`,
        { cache: "no-store" },
      );
      setActivities((current) => {
        const merged = replace ? page.activities : [...current, ...page.activities];
        return [...new Map(merged.map((activity) => [activity.id, activity])).values()];
      });
      setHasMore(page.hasMore);
    } catch (reason) {
      setError(errorMessage(reason, t("admin.error")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadPending = useCallback(async (offset = 0, replace = true) => {
    setPendingLoading(true);
    setError("");
    try {
      const page = await apiJson<{ activities: ClubActivity[]; hasMore: boolean }>(
        `/api/admin/activities/pending?offset=${offset}&limit=${PAGE_SIZE}`,
        { cache: "no-store" },
      );
      setPendingActivities((current) => {
        const merged = replace ? page.activities : [...current, ...page.activities];
        return [...new Map(merged.map((activity) => [activity.id, activity])).values()];
      });
      setPendingHasMore(page.hasMore);
    } catch (reason) {
      setError(errorMessage(reason, t("admin.error")));
    } finally {
      setPendingLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (user?.role === "admin") {
      void loadPage(0, true);
      void loadPending();
    }
  }, [loadPage, loadPending, user?.id, user?.role]);

  async function approveActivity(activity: ClubActivity) {
    setApproving(activity.id);
    setError("");
    try {
      await apiJson(`/api/admin/activities/${encodeURIComponent(activity.id)}/approve`, { method: "POST" });
      setPendingActivities((items) => items.filter((item) => item.id !== activity.id));
      await Promise.all([loadPage(0, true), loadPending(0, true)]);
    } catch (reason) {
      setError(errorMessage(reason, t("admin.error")));
    } finally {
      setApproving(null);
    }
  }

  async function deleteActivity(activity: ClubActivity) {
    if (
      !(await confirm({
        title: t("common.delete"),
        message: t("admin.deleteActivityConfirm", { title: activity.title }),
        confirmLabel: t("common.delete"),
        tone: "danger",
      }))
    ) {
      return;
    }
    setDeleting(activity.id);
    setError("");
    try {
      await apiJson(`/api/activities/${activity.id}`, { method: "DELETE" });
      setActivities((current) => current.filter((item) => (
        activity.recurrenceSeriesId
          ? item.recurrenceSeriesId !== activity.recurrenceSeriesId
          : item.id !== activity.id
      )));
    } catch (reason) {
      setError(errorMessage(reason, t("admin.error")));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="admin-activities">
      <section className="admin-pending-activities" aria-labelledby="pending-activities-title">
        <h2 id="pending-activities-title">{t("admin.pendingActivities")}</h2>
        {pendingLoading ? <p>{t("common.loading")}</p> : pendingActivities.length === 0 ? (
          <p>{t("admin.noPendingActivities")}</p>
        ) : pendingActivities.map((activity) => (
          <article className="admin-row admin-pending-activity" key={activity.id}>
            <div className="admin-activity-details">
              <strong>{activity.title}</strong>
              <p>{activity.description}</p>
              <span>
                {activity.date
                  ? new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.date))
                  : activity.day ?? ""}
                {" · "}{activity.category}{" · "}{activity.creator}
              </span>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={approving !== null}
              loading={approving === activity.id}
              onClick={() => void approveActivity(activity)}
            >
              {t("admin.approveActivity")}
            </Button>
          </article>
        ))}
        {pendingHasMore && !pendingLoading ? (
          <Button variant="secondary" onClick={() => void loadPending(pendingActivities.length, false)}>
            {t("community.admin.loadMore")}
          </Button>
        ) : null}
      </section>
      {activities.length === 0 && !loading && !error && <p>{t("admin.noActivities")}</p>}
      {activities.map((activity) => (
        <article className="admin-row" key={activity.id}>
          <div className="admin-activity-details">
            <strong>{activity.title}</strong>
            <p>{activity.description}</p>
            <span>
              {activity.date
                ? new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.date))
                : activity.day ?? ""}
              {" · "}{activity.category}{" · "}{activity.creator}
            </span>
          </div>
          <div className="admin-row-actions">
            <Link
              className="button-secondary admin-row-action"
              href={`/activities/${encodeURIComponent(activity.id)}`}
            >
              {t("admin.viewActivity")}
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="admin-row-action"
              disabled={deleting !== null}
              loading={deleting === activity.id}
              onClick={() => void deleteActivity(activity)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </article>
      ))}
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? (
        <p>{t("common.loading")}</p>
      ) : error ? (
        <Button variant="secondary" onClick={() => void loadPage(activities.length, activities.length === 0)}>
          {t("common.retry")}
        </Button>
      ) : hasMore ? (
        <Button variant="secondary" onClick={() => void loadPage(activities.length, false)}>
          {t("community.admin.loadMore")}
        </Button>
      ) : activities.length > 0 ? (
        <p className="feed-note">{t("admin.activitiesEnd")}</p>
      ) : null}
    </section>
  );
}
