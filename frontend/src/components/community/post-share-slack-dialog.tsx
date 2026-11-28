"use client";

import { Check, Copy, Loader2, Send, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/form-controls";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useI18n } from "@/i18n/i18n-provider";
import { ApiError, errorMessage } from "@/lib/api/client";
import { communityApi, type CommunityPost } from "@/lib/api/community";
import { copyToClipboard } from "@/lib/clipboard";

const MAX_SLACK_MESSAGE_LENGTH = 2000;

type PostShareSlackDialogProps = {
  post: CommunityPost;
  sharerName: string;
  onShared: () => void;
  onClose: () => void;
};

function buildPostExcerpt(content: string, photoFallback: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (!cleaned) return photoFallback;
  return cleaned.length > 260 ? `${cleaned.slice(0, 257).trimEnd()}…` : cleaned;
}

/** Native modal dialog allowing members to compose and send a post share to the configured Slack webhook. */
export function PostShareSlackDialog({
  post,
  sharerName,
  onShared,
  onClose,
}: PostShareSlackDialogProps) {
  const { t } = useI18n();
  const textareaId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postUrl =
    typeof window !== "undefined"
      ? new URL(`/community/posts/${encodeURIComponent(post.id)}`, window.location.origin).toString()
      : `/community/posts/${encodeURIComponent(post.id)}`;

  const excerpt = buildPostExcerpt(post.content, t("community.post.shareSlackPhotoFallback"));

  const [message, setMessage] = useState(() =>
    t("community.post.shareSlackDefaultTemplate", {
      sharer: sharerName,
      author: post.author.displayName,
      excerpt,
      url: postUrl,
    }),
  );
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (event: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        );
      };
      const handlePointerDown = (event: PointerEvent) => {
        pressedOutside = isOutside(event);
      };
      const handlePointerUp = (event: PointerEvent) => {
        if (pressedOutside && isOutside(event)) dialog.close();
      };
      dialog.addEventListener("pointerdown", handlePointerDown);
      dialog.addEventListener("pointerup", handlePointerUp);
      return () => {
        dialog.removeEventListener("pointerdown", handlePointerDown);
        dialog.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, []);

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError("");
    try {
      await communityApi.sharePostToSlack(post.id, trimmed);
      onShared();
      dialogRef.current?.close();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 503) {
        setError(t("community.post.shareSlackNotConfigured"));
      } else {
        setError(errorMessage(reason, t("community.post.shareSlackError")));
      }
    } finally {
      setSending(false);
    }
  }

  async function handleCopyLink() {
    try {
      await copyToClipboard(postUrl);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("common.genericError"));
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="post-share-slack-dialog"
      {...({ closedby: "any" } as Record<string, string>)}
      aria-labelledby="post-share-slack-title"
      onClose={onClose}
    >
      <header className="post-share-slack-header">
        <div className="post-share-slack-title-wrap">
          <span className="post-share-slack-badge" aria-hidden="true">
            <Send size={16} />
          </span>
          <div>
            <h1 id="post-share-slack-title">{t("community.post.shareSlackTitle")}</h1>
            <p>{t("community.post.shareSlackSubtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          className="ui-icon-button"
          aria-label={t("common.close")}
          onClick={() => dialogRef.current?.close()}
        >
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="post-share-slack-preview">
        <UserAvatar name={post.author.displayName} avatarUrl={post.author.avatarUrl} size={30} />
        <div className="post-share-slack-preview-copy">
          <strong>{post.author.displayName}</strong>
          <p>{excerpt}</p>
        </div>
      </div>

      <form className="post-share-slack-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="post-share-slack-field">
          <div className="profile-field-label-row">
            <label htmlFor={textareaId}>{t("community.post.shareSlackFieldLabel")}</label>
            <span className="profile-char-counter">
              {message.length}/{MAX_SLACK_MESSAGE_LENGTH}
            </span>
          </div>
          <textarea
            id={textareaId}
            autoFocus
            rows={6}
            maxLength={MAX_SLACK_MESSAGE_LENGTH}
            value={message}
            placeholder={t("community.post.shareSlackPlaceholder")}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229) return;
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <footer className="post-share-slack-footer">
          <button
            type="button"
            className="ui-button ui-button-ghost ui-button-sm"
            onClick={() => void handleCopyLink()}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? t("community.post.copiedShort") : t("community.post.copyLink")}
          </button>

          <div className="post-share-slack-submit-group">
            <button
              type="button"
              className="ui-button ui-button-secondary ui-button-sm"
              onClick={() => dialogRef.current?.close()}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="ui-button ui-button-primary ui-button-sm"
              disabled={sending || !message.trim()}
            >
              {sending ? (
                <Loader2 size={15} className="ui-spin" aria-hidden="true" />
              ) : (
                <Send size={14} aria-hidden="true" />
              )}
              {sending ? t("community.post.shareSlackSending") : t("community.post.shareSlackSend")}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
