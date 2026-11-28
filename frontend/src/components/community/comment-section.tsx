"use client";

import { Check, Pencil, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, IconButton } from "@/components/ui/button";
import { useDialog } from "@/components/ui/confirm-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { EmojiTextField } from "@/components/ui/emoji-text-field";
import { communityApi, type PostComment } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";
import { formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/i18n/i18n-provider";
import { useFeedEvents } from "@/lib/use-feed-events";
import { usePresence } from "@/lib/use-presence";

type Props = {
  postId: string;
  loginNext?: string;
  /** Server-side comment count; a mismatch with the loaded list triggers a refresh (live updates). */
  commentCount: number;
  onCountChange: (count: number) => void;
};

/** Comment list and input for a single post; loaded lazily when first opened. */
export function CommentSection({ postId, commentCount, loginNext = "/community", onCountChange }: Props) {
  const { t, intlLocale } = useI18n();
  const { confirm } = useDialog();
  const { user } = useAuth();
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const loadingRef = useRef(false);
  const commenterIds = (comments ?? []).map((comment) => comment.author.id);
  const presence = usePresence(commenterIds);

  useFeedEvents((event) => {
    if (event.type === "comment.updated" && event.postId === postId) {
      setComments((current) =>
        current?.map((comment) => (comment.id === event.comment.id ? event.comment : comment)) ?? current,
      );
    }
    if (event.type === "comment.deleted" && event.postId === postId) {
      setComments((current) => current?.filter((comment) => comment.id !== event.commentId) ?? current);
    }
  });

  useEffect(() => {
    if (loadingRef.current) return;
    if (comments !== null && comments.length === commentCount) return;
    loadingRef.current = true;
    communityApi
      .listComments(postId)
      .then(setComments)
      .catch(() => setError(t("community.comments.loadError")))
      .finally(() => {
        loadingRef.current = false;
      });
  }, [postId, commentCount, comments, t]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    setError("");
    try {
      const result = await communityApi.addComment(postId, content);
      setComments((current) => [...(current ?? []), result.comment]);
      onCountChange(result.commentCount);
      setDraft("");
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(comment: PostComment) {
    if (
      !(await confirm({
        title: t("common.delete"),
        message: t("community.comments.deleteConfirm"),
        confirmLabel: t("common.delete"),
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      const result = await communityApi.deleteComment(postId, comment.id);
      setComments((current) => (current ?? []).filter((item) => item.id !== comment.id));
      onCountChange(result.commentCount);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    }
  }

  async function handleUpdate(commentId: string) {
    setSavingEdit(true);
    setError("");
    try {
      const updated = await communityApi.updateComment(postId, commentId, editDraft);
      setComments((current) => current?.map((comment) => (comment.id === commentId ? updated : comment)) ?? current);
      setEditingId(null);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="comment-section">
      {comments === null && !error ? <p className="muted">{t("common.loading")}</p> : null}
      {comments?.length === 0 ? <p className="muted comment-empty-note">{t("community.comments.empty")}</p> : null}
      {comments && comments.length > 0 ? (
        <ul className="comment-list" role="list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment-item">
              <UserAvatar
                name={comment.author.displayName}
                avatarUrl={comment.author.avatarUrl}
                online={presence.statusFor(comment.author.id)}
                size={32}
              />
              <div className="comment-bubble">
                <div className="comment-meta-row">
                  <strong>{comment.author.displayName}</strong>
                  <small>
                    <time dateTime={comment.createdAt}>
                      {formatRelativeTime(comment.createdAt, intlLocale) ?? t("community.post.justNow")}
                    </time>
                  </small>
                </div>
                {editingId === comment.id ? (
                  <form
                    className="comment-edit-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleUpdate(comment.id);
                    }}
                  >
                    <EmojiTextField
                      value={editDraft}
                      onChange={setEditDraft}
                      maxLength={1000}
                      aria-label={t("community.comments.edit")}
                      autoFocus
                      multiline
                      rows={3}
                    />
                    <div className="comment-edit-actions">
                      <button type="button" onClick={() => setEditingId(null)}>
                        <X size={14} aria-hidden="true" /> {t("community.comments.cancelEdit")}
                      </button>
                      <button type="submit" disabled={!editDraft.trim() || savingEdit}>
                        <Check size={14} aria-hidden="true" />{" "}
                        {savingEdit ? t("community.comments.saving") : t("community.comments.save")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p>{comment.content}</p>
                )}
              </div>
              {user && (user.id === comment.author.id || user.role === "admin") ? (
                <div className="comment-owner-actions">
                  <IconButton
                    icon={Pencil}
                    label={t("community.comments.edit")}
                    onClick={() => {
                      setEditDraft(comment.content);
                      setEditingId(comment.id);
                    }}
                  />
                  <IconButton
                    icon={Trash2}
                    label={t("community.comments.delete")}
                    onClick={() => void handleDelete(comment)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {user ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <EmojiTextField
            value={draft}
            onChange={setDraft}
            placeholder={t("community.comments.placeholder")}
            maxLength={1000}
            aria-label={t("community.comments.placeholder")}
            multiline
            rows={1}
            autoResize
          />
          <Button type="submit" icon={Send} size="sm" loading={sending} disabled={!draft.trim()}>
            {t("community.comments.send")}
          </Button>
        </form>
      ) : (
        <p className="muted comment-login-note">
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`}>{t("community.comments.loginToComment")}</Link>
        </p>
      )}
    </div>
  );
}
