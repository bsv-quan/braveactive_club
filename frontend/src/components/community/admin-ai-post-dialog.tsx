"use client";

import { ChevronDown, Loader2, Search, Send, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  communityApi,
  type AIPostHours,
  type AIPostPreview,
  type AIPostTopic,
  type CommunityPost,
} from "@/lib/api/community";

type Props = { onPostCreated: (post: CommunityPost) => void };

export function AdminAiPostDialog({ onPostCreated }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<AIPostTopic>("technology");
  const [hours, setHours] = useState<AIPostHours>(4);
  const [preview, setPreview] = useState<AIPostPreview | null>(null);
  const [excludedSourceUrls, setExcludedSourceUrls] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  async function loadPreview(
    nextTopic = topic,
    nextHours = hours,
    excluded = excludedSourceUrls,
  ) {
    setLoadingPreview(true);
    setError("");
    try {
      const nextPreview = await communityApi.previewAiPost(nextTopic, nextHours, excluded);
      setPreview(nextPreview);
      setExcludedSourceUrls((items) =>
        items.includes(nextPreview.sourceUrl) ? items : [...items, nextPreview.sourceUrl].slice(-10),
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) {
        setError(t("community.admin.aiNoFreshArticle"));
      } else {
        setError(errorMessage(reason, t("community.admin.aiGenerateError")));
      }
    } finally {
      setLoadingPreview(false);
    }
  }

  async function publish() {
    if (!preview || preview.topic !== topic || preview.hours !== hours) return;
    setPublishing(true);
    setError("");
    try {
      const post = await communityApi.publishAiPost({
        topic: preview.topic,
        hours: preview.hours,
        title: preview.title,
        content: preview.content,
        sourceUrl: preview.sourceUrl,
      });
      onPostCreated(post);
      setOpen(false);
      setPreview(null);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        setError(t("community.admin.aiSourceConflict"));
      } else {
        setError(errorMessage(reason, t("community.admin.aiGenerateError")));
      }
    } finally {
      setPublishing(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loadingPreview && !publishing) setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadingPreview, open, publishing]);

  const selectionChanged = !!preview && (preview.topic !== topic || preview.hours !== hours);

  return (
    <>
      <Button
        type="button"
        icon={Sparkles}
        className="admin-ai-trigger"
        onClick={() => {
          setOpen(true);
          setPreview(null);
          setExcludedSourceUrls([]);
          setTopic("technology");
          setHours(4);
          setError("");
        }}
      >
        {t("community.admin.aiGenerate")}
      </Button>
      {open ? (
        <div
          className="admin-ai-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loadingPreview && !publishing) setOpen(false);
          }}
        >
          <section className="admin-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-ai-title">
            <button
              className="feedback-close"
              type="button"
              aria-label={t("common.close")}
              onClick={() => setOpen(false)}
              disabled={loadingPreview || publishing}
            >
              <X size={19} aria-hidden />
            </button>
            <h2 id="admin-ai-title">{t("community.admin.aiDialogTitle")}</h2>
            <p className="admin-ai-dialog-intro">{t("community.admin.aiDialogIntro")}</p>
            <div className="admin-ai-fields">
              <label>
                <span>{t("community.admin.aiTopic")}</span>
                <span className="admin-ai-select-wrap">
                  <select
                    value={topic}
                    onChange={(event) => setTopic(event.target.value as AIPostTopic)}
                    disabled={loadingPreview || publishing}
                  >
                    <option value="all">{t("community.admin.aiTopics.all")}</option>
                    <option value="technology">{t("community.admin.aiTopics.technology")}</option>
                    <option value="sports">{t("community.admin.aiTopics.sports")}</option>
                    <option value="travel">{t("community.admin.aiTopics.travel")}</option>
                    <option value="entertainment">{t("community.admin.aiTopics.entertainment")}</option>
                    <option value="health">{t("community.admin.aiTopics.health")}</option>
                  </select>
                  <ChevronDown size={18} aria-hidden />
                </span>
              </label>
              <label>
                <span>{t("community.admin.aiTimeWindow")}</span>
                <span className="admin-ai-select-wrap">
                  <select
                    value={hours}
                    onChange={(event) => setHours(Number(event.target.value) as AIPostHours)}
                    disabled={loadingPreview || publishing}
                  >
                    <option value={1}>{t("community.admin.aiHours", { hours: 1 })}</option>
                    <option value={4}>{t("community.admin.aiHours", { hours: 4 })}</option>
                    <option value={12}>{t("community.admin.aiHours", { hours: 12 })}</option>
                    <option value={24}>{t("community.admin.aiHours", { hours: 24 })}</option>
                  </select>
                  <ChevronDown size={18} aria-hidden />
                </span>
              </label>
              <Button
                type="button"
                variant="secondary"
                icon={Search}
                className="admin-ai-search"
                loading={loadingPreview}
                disabled={publishing}
                onClick={() => void loadPreview()}
              >
                {t("community.admin.aiSearch")}
              </Button>
            </div>
            {!preview && !loadingPreview && !error ? (
              <p className="admin-ai-hint">{t("community.admin.aiSearchHint")}</p>
            ) : null}
            {selectionChanged ? <p className="admin-ai-hint">{t("community.admin.aiReloadRequired")}</p> : null}
            {loadingPreview ? (
              <div className="admin-ai-loading" role="status">
                <Loader2 className="ui-spin" size={20} aria-hidden />
                {t("community.admin.aiLoadingPreview")}
              </div>
            ) : preview ? (
              <div className="admin-ai-preview">
                <div className="admin-ai-source">
                  <span>{t("community.admin.aiSource")}</span>
                  <a href={preview.sourceUrl} target="_blank" rel="noreferrer">
                    {preview.sourceTitle}
                  </a>
                  {preview.sourceDescription ? <p>{preview.sourceDescription}</p> : null}
                  <time dateTime={preview.sourcePublishedAt}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                      new Date(preview.sourcePublishedAt),
                    )}
                  </time>
                </div>
                <label>
                  <span>{t("community.admin.aiTitleField")}</span>
                  <input
                    value={preview.title}
                    onChange={(event) => setPreview({ ...preview, title: event.target.value })}
                    minLength={8}
                    maxLength={180}
                    disabled={publishing}
                  />
                </label>
                <label>
                  <span>{t("community.admin.aiContentField")}</span>
                  <textarea
                    value={preview.content}
                    onChange={(event) => setPreview({ ...preview, content: event.target.value })}
                    rows={8}
                    minLength={40}
                    maxLength={1600}
                    disabled={publishing}
                  />
                </label>
                <p className="admin-ai-approval-note">{t("community.admin.aiPendingApproval")}</p>
              </div>
            ) : null}
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <div className="admin-ai-dialog-actions">
              <Button
                type="button"
                icon={publishing ? Loader2 : Send}
                loading={publishing}
                disabled={
                  !preview ||
                  selectionChanged ||
                  loadingPreview ||
                  preview.title.trim().length < 8 ||
                  preview.content.trim().length < 40
                }
                onClick={() => void publish()}
              >
                {publishing ? t("community.admin.aiPublishing") : t("community.admin.aiPublish")}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
