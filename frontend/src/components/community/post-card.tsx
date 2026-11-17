"use client";

import { Check, ChevronLeft, ChevronRight, EllipsisVertical, FileText, MessageCircle, Pencil, Share2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserAvatar } from "@/components/ui/user-avatar";
import { EmojiTextField } from "@/components/ui/emoji-text-field";
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
  initialCommentsOpen?: boolean;
  loginNext?: string;
  showFullContent?: boolean;
  onPatch: (postId: string, patch: Partial<CommunityPost>) => void;
  onRemove: (postId: string) => void;
};

/** Post text with URLs turned into safe external links (no HTML injection). */
function PostText({
  content,
  expanded,
  onExpandedChange,
  showFullContent = false,
}: {
  content: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  showFullContent?: boolean;
}) {
  const { t } = useI18n();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLParagraphElement>(null);
  const [visibleLength, setVisibleLength] = useState(content.length);
  const [canExpand, setCanExpand] = useState(false);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const measurement = measurementRef.current;
    if (showFullContent || !wrapper || !measurement) return;

    const measure = () => {
      const suffix = document.createElement("span");
      suffix.className = "post-text-measurement-suffix";
      suffix.textContent = `… ${t("community.post.seeMore")}`;

      const fits = (length: number) => {
        measurement.replaceChildren(
          document.createTextNode(content.slice(0, length).trimEnd()),
          suffix.cloneNode(true),
        );
        return measurement.scrollHeight <= measurement.clientHeight + 1;
      };

      if (fits(content.length)) {
        setVisibleLength(content.length);
        setCanExpand(false);
        return;
      }

      let low = 0;
      let high = content.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (fits(middle)) low = middle;
        else high = middle - 1;
      }
      setVisibleLength(low);
      setCanExpand(true);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [content, showFullContent, t]);

  const isExpanded = expanded || showFullContent;
  const visibleContent = isExpanded ? content : content.slice(0, visibleLength).trimEnd();
  const parts = useMemo(() => splitLinks(visibleContent), [visibleContent]);

  return (
    <div ref={wrapperRef} className={isExpanded ? "post-text-wrap expanded" : "post-text-wrap"}>
      <p className="post-text">
        {parts.map((part, index) =>
          part.url ? (
            <a key={index} href={part.url} target="_blank" rel="noopener noreferrer nofollow ugc">
              {part.text}
            </a>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
        {!isExpanded && canExpand ? (
          <>
            {"… "}
            <button type="button" className="post-text-toggle" onClick={() => onExpandedChange(true)}>
              {t("community.post.seeMore")}
            </button>
          </>
        ) : null}
      </p>
      <p ref={measurementRef} className="post-text post-text-measurement" aria-hidden="true" />
    </div>
  );
}

function PostCardBase({
  post,
  viewerId,
  isAdmin,
  online,
  deleteRequest,
  initialCommentsOpen = false,
  loginNext = "/community",
  showFullContent = false,
  onPatch,
  onRemove,
}: Props) {
  const { t, intlLocale } = useI18n();
  const router = useRouter();
  const [showComments, setShowComments] = useState(initialCommentsOpen);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [postTextExpanded, setPostTextExpanded] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [imageViewerIndex, setImageViewerIndex] = useState<number | null>(null);
  const [imageOrientation, setImageOrientation] = useState<"landscape" | "portrait">("landscape");
  const imageTriggerRef = useRef<HTMLButtonElement>(null);
  const imageCloseRef = useRef<HTMLButtonElement>(null);
  const postMenuRef = useRef<HTMLDivElement>(null);
  const postImages = post.imageUrls?.length ? post.imageUrls : post.imageUrl ? [post.imageUrl] : [];

  useEffect(() => {
    if (!showPostMenu) return;
    function handlePointerDown(event: PointerEvent) {
      if (!postMenuRef.current?.contains(event.target as Node)) setShowPostMenu(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowPostMenu(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPostMenu]);

  useEffect(() => {
    if (imageViewerIndex === null) return;
    imageCloseRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImageViewerIndex(null);
        imageTriggerRef.current?.focus();
      } else if (event.key === "ArrowRight" && postImages.length > 1) {
        setImageViewerIndex((index) => (index === null ? 0 : (index + 1) % postImages.length));
      } else if (event.key === "ArrowLeft" && postImages.length > 1) {
        setImageViewerIndex((index) =>
          index === null ? 0 : (index - 1 + postImages.length) % postImages.length,
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [imageViewerIndex, postImages.length]);

  async function toggleLike() {
    if (!viewerId) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
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

  async function handleShare() {
    setShowPostMenu(false);
    setShareNotice("");
    const url = new URL(`/community/posts/${encodeURIComponent(post.id)}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: post.content.slice(0, 100), text: post.content, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareNotice(t("community.post.linkCopied"));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(errorMessage(err, t("common.genericError")));
    }
  }

  const canManage = viewerId !== null && (viewerId === post.author.id || isAdmin);

  return (
    <article className="post-card">
      <header className="post-header">
        <UserAvatar name={post.author.displayName} avatarUrl={post.author.avatarUrl} online={online} />
        <div className="post-byline">
          <strong>{post.author.displayName}</strong>
          <small>{formatRelativeTime(post.createdAt, intlLocale) ?? t("community.post.justNow")}</small>
        </div>
        <div className="post-menu-wrap" ref={postMenuRef}>
          <IconButton
            icon={EllipsisVertical}
            label={t("community.post.moreActions")}
            aria-haspopup="menu"
            aria-expanded={showPostMenu}
            onClick={() => setShowPostMenu((visible) => !visible)}
          />
          {showPostMenu ? (
            <div className="post-menu" role="menu">
              {canManage ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowPostMenu(false);
                      setDraft(post.content);
                      setEditing(true);
                    }}
                  >
                    <Pencil size={16} aria-hidden /> {t("community.post.edit")}
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setShowPostMenu(false); void handleDelete(); }}>
                    <Trash2 size={16} aria-hidden /> {t("community.post.delete")}
                  </button>
                </>
              ) : null}
              {!showFullContent ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowPostMenu(false);
                    router.push(`/community/posts/${encodeURIComponent(post.id)}`);
                  }}
                >
                  <FileText size={16} aria-hidden /> {t("community.post.details")}
                </button>
              ) : null}
              <button type="button" role="menuitem" onClick={() => void handleShare()}>
                <Share2 size={16} aria-hidden /> {t("community.post.share")}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {shareNotice ? <Alert tone="success">{shareNotice}</Alert> : null}
      {editing ? (
        <form className="post-edit-form" onSubmit={(event) => void handleUpdate(event)}>
          <EmojiTextField
            value={draft}
            onChange={setDraft}
            maxLength={2000}
            multiline
            rows={4}
            aria-label={t("community.post.edit")}
          />
          {postImages.length ? <small>{t("community.post.imageEditNotice")}</small> : null}
          <div className="post-edit-actions">
            <button type="button" className="ui-button ui-button-ghost ui-button-sm" onClick={() => setEditing(false)}>
              <X size={15} aria-hidden /> {t("community.post.cancelEdit")}
            </button>
            <button
              type="submit"
              className="ui-button ui-button-primary ui-button-sm"
              disabled={saving || (!draft.trim() && !postImages.length)}
            >
              <Check size={15} aria-hidden /> {saving ? t("community.post.saving") : t("community.post.save")}
            </button>
          </div>
        </form>
      ) : post.content ? (
        <PostText
          content={post.content}
          expanded={postTextExpanded}
          onExpandedChange={setPostTextExpanded}
          showFullContent={showFullContent}
        />
      ) : null}

      {postImages.length ? (
        <>
          <div
            className="post-image-gallery"
            data-count={postImages.length}
            data-orientation={imageOrientation}
          >
            {postImages.map((imageUrl, index) => (
              <button
                key={imageUrl}
                ref={index === 0 ? imageTriggerRef : undefined}
                className="post-image-button"
                type="button"
                aria-label={t("community.post.viewImage", { name: post.author.displayName })}
                onClick={() => setImageViewerIndex(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="post-image"
                  src={imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onLoad={(event) => {
                    if (index === 0) {
                      const image = event.currentTarget;
                      setImageOrientation(image.naturalHeight > image.naturalWidth ? "portrait" : "landscape");
                    }
                  }}
                />
              </button>
            ))}
          </div>
          {imageViewerIndex !== null && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="post-image-viewer-backdrop"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("community.post.viewImage", { name: post.author.displayName })}
                  onClick={() => {
                    setImageViewerIndex(null);
                    imageTriggerRef.current?.focus();
                  }}
                >
                  <button
                    ref={imageCloseRef}
                    type="button"
                    className="post-image-viewer-close"
                    aria-label={t("common.close")}
                    title={t("common.close")}
                    onClick={() => {
                      setImageViewerIndex(null);
                      imageTriggerRef.current?.focus();
                    }}
                  >
                    <X size={20} aria-hidden />
                  </button>
                  {postImages.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className="post-image-viewer-nav post-image-viewer-prev"
                        aria-label={t("community.post.previousImage")}
                        onClick={(event) => {
                          event.stopPropagation();
                          setImageViewerIndex((index) =>
                            index === null ? 0 : (index - 1 + postImages.length) % postImages.length,
                          );
                        }}
                      >
                        <ChevronLeft size={28} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="post-image-viewer-nav post-image-viewer-next"
                        aria-label={t("community.post.nextImage")}
                        onClick={(event) => {
                          event.stopPropagation();
                          setImageViewerIndex((index) => (index === null ? 0 : (index + 1) % postImages.length));
                        }}
                      >
                        <ChevronRight size={28} aria-hidden />
                      </button>
                      <span className="post-image-viewer-count">
                        {imageViewerIndex + 1} / {postImages.length}
                      </span>
                    </>
                  ) : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="post-image-viewer"
                    src={postImages[imageViewerIndex]}
                    alt={t("community.post.imageAlt", { name: post.author.displayName })}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>,
                document.body,
              )
            : null}
        </>
      ) : null}
      {!showFullContent && !editing && post.content && postTextExpanded ? (
        <button
          type="button"
          className="post-text-toggle post-text-collapse"
          onClick={() => setPostTextExpanded(false)}
        >
          {t("community.post.seeLess")}
        </button>
      ) : null}
      {!postImages.length && post.linkPreview ? (
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
          loginNext={loginNext}
          onCountChange={(count) => onPatch(post.id, { commentCount: count })}
        />
      ) : null}
    </article>
  );
}

/** Memoized so live updates to one post do not re-render the whole feed. */
export const PostCard = memo(PostCardBase);
