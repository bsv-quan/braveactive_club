"use client";

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

  const loadPage = useCallback(async (nextOffset: number) => {
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
  }, [t]);

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  return (
    <section className="admin-feedback">
      <h2>{t("feedback.adminTitle")}</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {error ? <Button variant="secondary" onClick={() => void loadPage(offset)}>{t("common.retry")}</Button> : null}
      {loading ? <p className="feed-note">{t("common.loading")}</p> : null}
      {!loading && !error && feedback.length === 0 ? <p className="feed-note">{t("feedback.empty")}</p> : null}
      {feedback.map((item) => (
        <article className="admin-feedback-item" key={item.id}>
          <h3>{item.title}</h3>
          <p>{item.content}</p>
          <small>
            {item.authorName || t("feedback.anonymous")} ·{" "}
            <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(intlLocale)}</time>
          </small>
        </article>
      ))}
      <div className="admin-pagination">
        <Button
          variant="secondary"
          disabled={loading || offset === 0}
          onClick={() => void loadPage(Math.max(0, offset - PAGE_SIZE))}
        >
          {t("admin.previous")}
        </Button>
        <Button
          variant="secondary"
          disabled={loading || !hasMore}
          onClick={() => void loadPage(offset + PAGE_SIZE)}
        >
          {t("admin.next")}
        </Button>
      </div>
    </section>
  );
}
