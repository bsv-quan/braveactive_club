"use client";

import { Check, MessageCircle, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { IconButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/form-controls";
import { communityApi, type CommunityPost } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";
import { formatRelativeTime, splitLinks } from "@/lib/format";
import { useI18n } from "@/i18n/i18n-provider";
import { CommentSection } from "./comment-section";
import { LikeButton } from "./like-button";
import { LinkPreviewCard } from "./link-preview-card";

type Props = {
  post: CommunityPost;
  viewerId: string | null;
  isAdmin: boolean;
  online?: boolean;
  deleteRequest?: (postId: string) => Promise<unknown>;
  onPatch: (postId: string, patch: Partial<CommunityPost>) => void;
  onRemove: (postId: string) => void;
};

/** Post text with URLs turned into safe external links (no HTML injection). */
function PostText({ content }: { content: string }) {
  const parts = useMemo(() => splitLinks(content), [content]);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () => setCanExpand(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content]);

  const { t } = useI18n();
  return (
    <div className={expanded ? "post-text-wrap expanded" : "post-text-wrap"}>
      <p className={expanded ? "post-text" : "post-text post-text-clamped"} ref={textRef}>
        {parts.map((part, index) =>
          part.url ? (
            <a key={index} href={part.url} target="_blank" rel="noopener noreferrer nofollow ugc">
              {part.text}
            </a>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
      {canExpand ? (
        <button
          type="button"
          className="post-text-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("community.post.seeLess") : t("community.post.seeMore")}
        </button>
      ) : null}
    </div>
  );
}

function PostCardBase({ post, viewerId, isAdmin, online, deleteRequest, onPatch, onRemove }: Props) {
  const { t, intlLocale } = useI18n();
  const router = useRouter();
  const [showComments, setShowComments] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [saving, setSaving] = useState(false);

  async function toggleLike() {
    if (!viewerId) {
      router.push("/login?next=/community");
      return;
    }
    const liked = !post.likedByMe;
    // Optimistic update; rolled back if the request fails.
    onPatch(post.id, { likedByMe: liked, likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)) });
    try {
      const result = await communityApi.setLike(post.id, liked);
      onPatch(post.id, { likedByMe: result.likedByMe, likeCount: result.likeCount });
    } catch {
      onPatch(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("community.post.deleteConfirm"))) return;
    try {
      setError("");
      await (deleteRequest ?? communityApi.deletePost)(post.id);
      onRemove(post.id);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    }
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await communityApi.updatePost(post.id, draft);
      onPatch(post.id, updated);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    } finally {
      setSaving(false);
    }
  }

  const canDelete = viewerId !== null && (viewerId === post.author.id || isAdmin);

  return (
    <article className="post-card">
      <header className="post-header">
        <UserAvatar name={post.author.displayName} avatarUrl={post.author.avatarUrl} online={online} />
        <div className="post-byline">
          <strong>{post.author.displayName}</strong>
          <small>{formatRelativeTime(post.createdAt, intlLocale) ?? t("community.post.justNow")}</small>
        </div>
        {canDelete ? (
          <div className="post-owner-actions">
            <IconButton
              icon={Pencil}
              label={t("community.post.edit")}
              onClick={() => {
                setDraft(post.content);
                setEditing(true);
              }}
            />
            <IconButton icon={Trash2} label={t("community.post.delete")} onClick={() => void handleDelete()} />
          </div>
        ) : null}
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {editing ? (
        <form className="post-edit-form" onSubmit={(event) => void handleUpdate(event)}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            rows={4}
            aria-label={t("community.post.edit")}
          />
          {post.imageUrl ? <small>{t("community.post.imageEditNotice")}</small> : null}
          <div className="post-edit-actions">
            <button type="button" className="ui-button ui-button-ghost ui-button-sm" onClick={() => setEditing(false)}>
              <X size={15} aria-hidden /> {t("community.post.cancelEdit")}
            </button>
            <button
              type="submit"
              className="ui-button ui-button-primary ui-button-sm"
              disabled={saving || (!draft.trim() && !post.imageUrl)}
            >
              <Check size={15} aria-hidden /> {saving ? t("community.post.saving") : t("community.post.save")}
            </button>
          </div>
        </form>
      ) : post.content ? <PostText content={post.content} /> : null}

      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="post-image"
          src={post.imageUrl}
          alt={t("community.post.imageAlt", { name: post.author.displayName })}
          loading="lazy"
          decoding="async"
        />
      ) : post.linkPreview ? (
        <LinkPreviewCard preview={post.linkPreview} />
      ) : null}

      {post.likeCount > 0 || post.commentCount > 0 ? (
        <div className="post-stats">
          <span>{post.likeCount > 0 ? t("community.post.likes", { count: post.likeCount }) : ""}</span>
          <span>{post.commentCount > 0 ? t("community.post.comments", { count: post.commentCount }) : ""}</span>
        </div>
      ) : null}

      <footer className="post-actions">
        <LikeButton
          liked={post.likedByMe}
          count={0}
          label={post.likedByMe ? t("community.post.unlike") : t("community.post.like")}
          onToggle={() => void toggleLike()}
        />
        <button
          type="button"
          className={showComments ? "post-action active" : "post-action"}
          aria-expanded={showComments}
          onClick={() => setShowComments((open) => !open)}
        >
          <MessageCircle size={18} aria-hidden />
          <span>{t("community.post.comment")}</span>
        </button>
      </footer>

      {showComments ? (
        <CommentSection
          postId={post.id}
          commentCount={post.commentCount}
          onCountChange={(count) => onPatch(post.id, { commentCount: count })}
        />
      ) : null}
    </article>
  );
}

/** Memoized so live updates to one post do not re-render the whole feed. */
export const PostCard = memo(PostCardBase);
