"use client";

import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";
import { communityApi, type FeedbackItem } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";

const PAGE_SIZE = 50;

export function AdminFeedbackPanel() {
  const { t, intlLocale } = useI18n();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const page = await communityApi.listAdminFeedback(nextOffset, PAGE_SIZE);
        setFeedback(page.feedback);
        setHasMore(page.hasMore);
        setOffset(nextOffset);
      } catch (reason) {
        setError(errorMessage(reason, t("feedback.loadError")));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  return (
    <section className="admin-feedback">
      <div className="admin-subpanel-head">
        <h2>{t("feedback.adminTitle")}</h2>
        {feedback.length > 0 ? (
          <span className="training-group-count">{feedback.length}</span>
        ) : null}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {error ? (
        <Button variant="secondary" onClick={() => void loadPage(offset)}>
          {t("common.retry")}
        </Button>
      ) : null}
      {loading ? <p className="feed-note">{t("common.loading")}</p> : null}
      {!loading && !error && feedback.length === 0 ? (
        <div className="feed-empty-card admin-empty-inline">
          <span className="feed-empty-icon" aria-hidden="true">
            <MessageSquare size={22} />
          </span>
          <strong>{t("feedback.empty")}</strong>
        </div>
      ) : null}
      <div className="admin-list">
        {feedback.map((item) => {
          const authorLabel = item.authorName || t("feedback.anonymous");
          return (
            <article className="admin-feedback-item admin-card-row" key={item.id}>
              <div className="admin-feedback-head">
                <span className="admin-user-initial" aria-hidden="true">
                  {authorLabel.charAt(0).toUpperCase()}
                </span>
                <div className="admin-user-meta">
                  <strong>{item.title}</strong>
                  <span className="admin-user-email">
                    {authorLabel} ·{" "}
                    <time dateTime={item.createdAt}>
                      {new Intl.DateTimeFormat(intlLocale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(item.createdAt))}
                    </time>
                  </span>
                </div>
              </div>
              <p>{item.content}</p>
            </article>
          );
        })}
      </div>
      {(offset > 0 || hasMore) && (
        <div className="admin-pagination">
          {offset > 0 && (
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void loadPage(Math.max(0, offset - PAGE_SIZE))}
            >
              {t("admin.previous")}
            </Button>
          )}
          {hasMore && (
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void loadPage(offset + PAGE_SIZE)}
            >
              {t("admin.next")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
