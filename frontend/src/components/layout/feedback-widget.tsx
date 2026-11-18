"use client";

import { LoaderCircle, MessageSquare, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/i18n-provider";
import { communityApi } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";

export function FeedbackWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [footerOffset, setFooterOffset] = useState<number | null>(null);

  useEffect(() => {
    const footer = document.querySelector<HTMLElement>(".app-shell > .footer");
    if (!footer) return;
    const footerElement = footer;

    function updateFooterOffset() {
      const footerTop = footerElement.getBoundingClientRect().top;
      const nextOffset = Math.max(18, Math.ceil(window.innerHeight - footerTop + 16));
      setFooterOffset((current) => current === nextOffset ? current : nextOffset);
    }

    window.addEventListener("scroll", updateFooterOffset, { passive: true });
    window.addEventListener("resize", updateFooterOffset);
    const resizeObserver = new ResizeObserver(updateFooterOffset);
    resizeObserver.observe(footerElement);
    updateFooterOffset();

    return () => {
      window.removeEventListener("scroll", updateFooterOffset);
      window.removeEventListener("resize", updateFooterOffset);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, submitting]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await communityApi.submitFeedback({ title, content });
      setTitle("");
      setContent("");
      setSent(true);
    } catch (reason) {
      setError(errorMessage(reason, t("feedback.submitError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        className="feedback-launcher"
        style={footerOffset === null ? undefined : { bottom: `${footerOffset}px` }}
        type="button"
        onClick={() => {
          setOpen(true);
          setError("");
          setSent(false);
        }}
      >
        <MessageSquare size={18} aria-hidden />
        <span>{t("feedback.button")}</span>
      </button>
      {open ? (
        <div
          className="feedback-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) setOpen(false);
          }}
        >
          <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
            <button
              className="feedback-close"
              type="button"
              aria-label={t("common.close")}
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              <X size={19} aria-hidden />
            </button>
            <h2 id="feedback-title">{t("feedback.title")}</h2>
            <p>{t("feedback.intro")}</p>
            {sent ? (
              <div className="feedback-success" role="status">{t("feedback.success")}</div>
            ) : (
              <form className="feedback-form" onSubmit={(event) => void submit(event)}>
                <label htmlFor="feedback-field-title">{t("feedback.titleField")}</label>
                <input
                  id="feedback-field-title"
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={160}
                  required
                  autoFocus
                />
                <label htmlFor="feedback-field-content">{t("feedback.contentField")}</label>
                <textarea
                  id="feedback-field-content"
                  name="content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={5000}
                  rows={6}
                  required
                />
                {error ? <p className="form-error" role="alert">{error}</p> : null}
                <button className="ui-button ui-button-primary feedback-submit" type="submit" disabled={submitting}>
                  {submitting ? <LoaderCircle className="ui-spin" size={17} aria-hidden /> : <Send size={16} aria-hidden />}
                  {submitting ? t("feedback.submitting") : t("feedback.submit")}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
