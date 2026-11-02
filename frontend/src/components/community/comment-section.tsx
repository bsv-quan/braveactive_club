"use client";

import { Check, Pencil, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, IconButton } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { communityApi, type PostComment } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";
import { formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/i18n/i18n-provider";
import { useFeedEvents } from "@/lib/use-feed-events";
import { usePresence } from "@/lib/use-presence";

type Props = {
  postId: string;
  /** Server-side comment count; a mismatch with the loaded list triggers a refresh (live updates). */
  commentCount: number;
  onCountChange: (count: number) => void;
};

/** Comment list and input for a single post; loaded lazily when first opened. */
export function CommentSection({ postId, commentCount, onCountChange }: Props) {
  const { t, intlLocale } = useI18n();
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
    if (!window.confirm(t("community.comments.deleteConfirm"))) return;
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
      setComments((current) => current?.map((comment) => comment.id === commentId ? updated : comment) ?? current);
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
      {comments?.length === 0 ? <p className="muted">{t("community.comments.empty")}</p> : null}
      <ul className="comment-list">
        {comments?.map((comment) => (
          <li key={comment.id} className="comment-item">
            <UserAvatar
              name={comment.author.displayName}
              avatarUrl={comment.author.avatarUrl}
              online={presence.statusFor(comment.author.id)}
              size={32}
            />
            <div className="comment-bubble">
              <strong>{comment.author.displayName}</strong>
              {editingId === comment.id ? (
                <form
                  className="comment-edit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleUpdate(comment.id);
                  }}
                >
                  <textarea
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    maxLength={1000}
                    aria-label={t("community.comments.edit")}
                    autoFocus
                  />
                  <div className="comment-edit-actions">
                    <button type="button" onClick={() => setEditingId(null)}>
                      <X size={14} aria-hidden /> {t("community.comments.cancelEdit")}
                    </button>
                    <button type="submit" disabled={!editDraft.trim() || savingEdit}>
                      <Check size={14} aria-hidden /> {savingEdit ? t("community.comments.saving") : t("community.comments.save")}
                    </button>
                  </div>
                </form>
              ) : <p>{comment.content}</p>}
              <small>{formatRelativeTime(comment.createdAt, intlLocale) ?? t("community.post.justNow")}</small>
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
      {error ? <p className="form-error">{error}</p> : null}
      {user ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("community.comments.placeholder")}
            maxLength={1000}
            aria-label={t("community.comments.placeholder")}
          />
          <Button type="submit" icon={Send} size="sm" loading={sending} disabled={!draft.trim()}>
            {t("community.comments.send")}
          </Button>
        </form>
      ) : (
        <p className="muted">
          <Link href="/login?next=/community">{t("community.comments.loginToComment")}</Link>
        </p>
      )}
    </div>
  );
}
