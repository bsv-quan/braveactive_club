"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Cpu,
  EllipsisVertical,
  FileText,
  HeartHandshake,
  Images,
  Landmark,
  type LucideIcon,
  MessageCircle,
  Newspaper,
  Pencil,
  Send,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/ui/user-avatar";
import { EmojiTextField } from "@/components/ui/emoji-text-field";
import { IconButton } from "@/components/ui/button";
import { useDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/form-controls";
import { communityApi, type CommunityPost, type PostCategory } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";
import {
  extractEditorialArticle,
  isAiCommunityPost,
  isPostCategory,
} from "@/lib/community-filters";
import { formatRelativeTime, splitLinks } from "@/lib/format";
import { useI18n } from "@/i18n/i18n-provider";
import { CommentSection } from "./comment-section";
import { LikeButton } from "./like-button";
import { LinkPreviewCard } from "./link-preview-card";
import { PostLikersDialog } from "./post-likers-dialog";
import { PostShareSlackDialog } from "./post-share-slack-dialog";

export const POST_CATEGORY_ICONS: Record<PostCategory, LucideIcon> = {
  culture: Landmark,
  society: Users,
  entertainment: Clapperboard,
  lifestyle: HeartHandshake,
  sports: Trophy,
  technology: Cpu,
};

type Props = {
  post: CommunityPost;
  featured?: boolean;
  viewerId: string | null;
  isAdmin: boolean;
  online?: boolean;
  deleteRequest?: (postId: string) => Promise<unknown>;
  initialCommentsOpen?: boolean;
  loginNext?: string;
  showFullContent?: boolean;
  showActionsMenu?: boolean;
  onSelectCategory?: (category: PostCategory) => void;
  onPatch: (postId: string, patch: Partial<CommunityPost>) => void;
  onRemove: (postId: string) => void;
};

/** Post text with URLs turned into safe external links (no HTML injection). */
function PostText({
  content,
  expanded,
  onExpandedChange,
  showFullContent = false,
  className = "post-text",
}: {
  content: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  showFullContent?: boolean;
  className?: string;
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
      const lineHeight = Number.parseFloat(getComputedStyle(measurement).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;

      const characters = Array.from(content);
      const lineCount = () => Math.ceil(measurement.getBoundingClientRect().height / lineHeight);
      measurement.textContent = content;
      if (lineCount() <= 5) {
        setVisibleLength(content.length);
        setCanExpand(false);
        return;
      }

      const suffix = document.createElement("span");
      suffix.className = "post-text-measurement-suffix";
      suffix.textContent = `…\u00a0${t("community.post.seeMore")}`;

      const fits = (length: number) => {
        const text = characters.slice(0, length).join("").trimEnd();
        measurement.replaceChildren(document.createTextNode(text), suffix.cloneNode(true));
        return lineCount() <= 5;
      };

      let low = 0;
      let high = characters.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (fits(middle)) low = middle;
        else high = middle - 1;
      }

      setVisibleLength(characters.slice(0, low).join("").trimEnd().length);
      setCanExpand(true);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [content, showFullContent, t]);

  const isExpanded = expanded || showFullContent;
  const isClamped = canExpand && !isExpanded;
  const visibleContent = isClamped ? content.slice(0, visibleLength).trimEnd() : content;
  const parts = useMemo(() => splitLinks(visibleContent), [visibleContent]);

  return (
    <div ref={wrapperRef} className={isExpanded ? "post-text-wrap expanded" : "post-text-wrap"}>
      <p className={className}>
        {parts.map((part, index) =>
          part.url ? (
            <a key={index} href={part.url} target="_blank" rel="noopener noreferrer nofollow ugc">
              {part.text}
            </a>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
        {isClamped ? (
          <span className="post-text-more">
            {"…\u00a0"}
            <button type="button" className="post-text-toggle" onClick={() => onExpandedChange(true)}>
              {t("community.post.seeMore")}
            </button>
          </span>
        ) : null}
      </p>
      <p ref={measurementRef} className={`${className} post-text-measurement`} aria-hidden="true" />
    </div>
  );
}

function PostCardBase({
  post,
  featured = false,
  viewerId,
  isAdmin,
  online,
  deleteRequest,
  initialCommentsOpen = false,
  loginNext = "/community",
  showFullContent = false,
  showActionsMenu = true,
  onSelectCategory,
  onPatch,
  onRemove,
}: Props) {
  const { t, intlLocale } = useI18n();
  const { user } = useAuth();
  const { confirm } = useDialog();
  const router = useRouter();
  const [showComments, setShowComments] = useState(initialCommentsOpen);
  const [showLikers, setShowLikers] = useState(false);
  const [showShareSlack, setShowShareSlack] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [postTextExpanded, setPostTextExpanded] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [sharedToSlack, setSharedToSlack] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState<number | null>(null);
  const [imageOrientation, setImageOrientation] = useState<"landscape" | "portrait">("landscape");
  const imageTriggerRef = useRef<HTMLButtonElement>(null);
  const imageDialogRef = useRef<HTMLDialogElement>(null);
  const postMenuRef = useRef<HTMLDivElement>(null);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postImages = post.imageUrls?.length ? post.imageUrls : post.imageUrl ? [post.imageUrl] : [];

  useEffect(() => () => {
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
  }, []);

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
    const dialog = imageDialogRef.current;
    if (imageViewerIndex === null || !dialog) return;
    if (!dialog.open) dialog.showModal();

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isDialogContent) dialog.close();
      };
      dialog.addEventListener("click", handleBackdropClick);
      return () => dialog.removeEventListener("click", handleBackdropClick);
    }
  }, [imageViewerIndex]);

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
    if (
      !(await confirm({
        title: t("community.post.delete"),
        message: t("community.post.deleteConfirm"),
        confirmLabel: t("common.delete"),
        tone: "danger",
      }))
    ) {
      return;
    }
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

  function handleOpenShareSlack() {
    setShowPostMenu(false);
    if (!viewerId) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    setShowShareSlack(true);
  }

  function handleSharedToSlack() {
    setSharedToSlack(true);
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = setTimeout(() => setSharedToSlack(false), 3000);
  }

  const canDelete = viewerId !== null && viewerId === post.author.id;
  const canEdit = viewerId !== null && viewerId === post.author.id;
  const hasMenuActions = canEdit || canDelete || !showFullContent;
  const isAiPost = isAiCommunityPost(post);
  const editorial = useMemo(
    () => extractEditorialArticle(post.content, isAiPost),
    [post.content, isAiPost],
  );
  const isEditorialCard = isAiPost || Boolean(editorial.headline);
  const postCategory = isPostCategory(post.category) ? post.category : null;
  const CategoryIcon = postCategory ? POST_CATEGORY_ICONS[postCategory] : null;
  const categoryLabel = postCategory ? t(`community.categories.${postCategory}`) : "";
  const relativeTime = formatRelativeTime(post.createdAt, intlLocale) ?? t("community.post.justNow");
  const detailHref = `/community/posts/${encodeURIComponent(post.id)}`;

  const cardClasses = [
    "post-card",
    featured ? "post-card-featured" : "",
    isAiPost ? "post-card-ai" : "",
    isEditorialCard ? "post-card-editorial" : "post-card-social",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClasses}>
      {featured || isAiPost || postCategory ? (
        <div className="post-editorial-rubric">
          {featured ? (
            <span className="post-rubric-tag is-lead">
              <span className="post-rubric-square" aria-hidden="true" />
              {t("community.editorial.leadStory")}
            </span>
          ) : null}
          {isAiPost ? (
            <span className="post-rubric-tag is-digest">
              <Newspaper size={13} aria-hidden="true" />
              {t("community.editorial.aiNews")}
            </span>
          ) : null}
          {postCategory && CategoryIcon ? (
            onSelectCategory ? (
              <button
                type="button"
                className={`post-category-tag is-${postCategory}`}
                aria-label={t("community.filters.filterByCategory", { category: categoryLabel })}
                onClick={() => onSelectCategory(postCategory)}
              >
                <CategoryIcon size={12} aria-hidden="true" />
                <span>{categoryLabel}</span>
              </button>
            ) : (
              <span className={`post-category-tag is-${postCategory}`}>
                <CategoryIcon size={12} aria-hidden="true" />
                <span>{categoryLabel}</span>
              </span>
            )
          ) : null}
        </div>
      ) : null}

      <header className="post-header">
        <UserAvatar
          name={post.author.displayName}
          avatarUrl={post.author.avatarUrl}
          online={online}
          size={isEditorialCard && !featured ? 34 : 38}
        />
        <div className="post-byline">
          <strong>{post.author.displayName}</strong>
          {!showFullContent ? (
            <Link
              className="post-timestamp-link"
              href={detailHref}
              aria-label={`${relativeTime} — ${post.author.displayName}`}
            >
              <time dateTime={post.createdAt}>{relativeTime}</time>
            </Link>
          ) : (
            <small>
              <time dateTime={post.createdAt}>{relativeTime}</time>
            </small>
          )}
        </div>
        {showActionsMenu && hasMenuActions ? (
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
                {canEdit ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowPostMenu(false);
                      setDraft(post.content);
                      setEditing(true);
                    }}
                  >
                    <Pencil size={16} aria-hidden="true" /> {t("community.post.edit")}
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowPostMenu(false);
                      void handleDelete();
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" /> {t("community.post.delete")}
                  </button>
                ) : null}
                {!showFullContent ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowPostMenu(false);
                      router.push(detailHref);
                    }}
                  >
                    <FileText size={16} aria-hidden="true" /> {t("community.post.details")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {!post.approved && !isAdmin && viewerId === post.author.id ? (
        <p className="post-pending-notice">{t("community.admin.pending")}</p>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
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
              <X size={15} aria-hidden="true" /> {t("community.post.cancelEdit")}
            </button>
            <button
              type="submit"
              className="ui-button ui-button-primary ui-button-sm"
              disabled={saving || (!draft.trim() && !postImages.length)}
            >
              <Check size={15} aria-hidden="true" /> {saving ? t("community.post.saving") : t("community.post.save")}
            </button>
          </div>
        </form>
      ) : post.content ? (
        <div className="post-editorial-copy">
          {editorial.headline ? (
            <h2 className="post-editorial-headline">
              {!showFullContent ? (
                <Link className="post-editorial-headline-link" href={detailHref}>
                  {editorial.headline}
                </Link>
              ) : (
                editorial.headline
              )}
            </h2>
          ) : null}
          <PostText
            content={editorial.body}
            expanded={postTextExpanded}
            onExpandedChange={setPostTextExpanded}
            showFullContent={showFullContent}
            className={editorial.headline ? "post-text post-editorial-deck" : "post-text"}
          />
        </div>
      ) : null}

      {postImages.length ? (
        <>
          <div className="post-image-gallery-frame">
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
            {postImages.length > 1 ? (
              <span className="post-gallery-count" aria-hidden="true">
                <Images size={13} aria-hidden="true" />
                {t("community.post.photoCount", { count: postImages.length })}
              </span>
            ) : null}
          </div>
          {imageViewerIndex !== null ? (
            <dialog
              ref={imageDialogRef}
              className="post-image-dialog"
              {...({ closedby: "any" } as Record<string, string>)}
              aria-label={t("community.post.viewImage", { name: post.author.displayName })}
              onClose={() => {
                setImageViewerIndex(null);
                imageTriggerRef.current?.focus();
              }}
              onKeyDown={(event) => {
                if (postImages.length <= 1) return;
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setImageViewerIndex((index) => (index === null ? 0 : (index + 1) % postImages.length));
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setImageViewerIndex((index) =>
                    index === null ? 0 : (index - 1 + postImages.length) % postImages.length,
                  );
                }
              }}
            >
              <div className="post-image-dialog-stage">
                <button
                  type="button"
                  className="post-image-viewer-close"
                  aria-label={t("common.close")}
                  onClick={() => imageDialogRef.current?.close()}
                >
                  <X size={20} aria-hidden="true" />
                </button>
                {postImages.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="post-image-viewer-nav post-image-viewer-prev"
                      aria-label={t("community.post.previousImage")}
                      onClick={() =>
                        setImageViewerIndex((index) =>
                          index === null ? 0 : (index - 1 + postImages.length) % postImages.length,
                        )
                      }
                    >
                      <ChevronLeft size={28} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="post-image-viewer-nav post-image-viewer-next"
                      aria-label={t("community.post.nextImage")}
                      onClick={() =>
                        setImageViewerIndex((index) => (index === null ? 0 : (index + 1) % postImages.length))
                      }
                    >
                      <ChevronRight size={28} aria-hidden="true" />
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
                />
              </div>
            </dialog>
          ) : null}
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

      {post.approved ? (
        <footer className="post-actions">
          <LikeButton
            liked={post.likedByMe}
            count={post.likeCount}
            label={post.likedByMe ? t("community.post.unlike") : t("community.post.like")}
            countAriaLabel={t("community.post.viewLikes", { count: post.likeCount })}
            onToggle={() => void toggleLike()}
            onShowLikers={() => setShowLikers(true)}
          />
          <button
            type="button"
            className={showComments ? "post-action active" : "post-action"}
            aria-expanded={showComments}
            onClick={() => setShowComments((open) => !open)}
          >
            <MessageCircle size={18} aria-hidden="true" />
            <span>{t("community.post.comment")}</span>
            {post.commentCount > 0 ? <span className="post-action-count">{post.commentCount}</span> : null}
          </button>
          <button
            type="button"
            className={sharedToSlack ? "post-action shared" : "post-action"}
            aria-haspopup="dialog"
            onClick={handleOpenShareSlack}
          >
            {sharedToSlack ? <Check size={17} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            <span>{sharedToSlack ? t("community.post.sharedSlack") : t("community.post.share")}</span>
          </button>
        </footer>
      ) : null}

      {post.approved && showComments ? (
        <CommentSection
          postId={post.id}
          commentCount={post.commentCount}
          loginNext={loginNext}
          onCountChange={(count) => onPatch(post.id, { commentCount: count })}
        />
      ) : null}

      {showLikers ? (
        <PostLikersDialog
          postId={post.id}
          likeCount={post.likeCount}
          onClose={() => setShowLikers(false)}
        />
      ) : null}

      {showShareSlack ? (
        <PostShareSlackDialog
          post={post}
          sharerName={user?.displayName ?? t("feedback.anonymous")}
          onShared={handleSharedToSlack}
          onClose={() => setShowShareSlack(false)}
        />
      ) : null}
    </article>
  );
}

/** Memoized so live updates to one post do not re-render the whole feed. */
export const PostCard = memo(PostCardBase);
