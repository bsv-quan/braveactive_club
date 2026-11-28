"use client";

import { Loader2, MessageSquareHeart, RotateCcw, SearchX } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { CommunityPost, PostCategory } from "@/lib/api/community";
import type { CommunityFeedFilter } from "@/lib/community-filters";
import { useI18n } from "@/i18n/i18n-provider";
import { reportGlobalError } from "@/lib/api/client";
import { PostCard } from "./post-card";
import { usePresence } from "@/lib/use-presence";

type Props = {
  posts: CommunityPost[];
  activeFilter?: CommunityFeedFilter;
  searchQuery?: string;
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  viewerId: string | null;
  isAdmin: boolean;
  onLoadMore: () => void;
  onResetFilter?: () => void;
  onSelectCategory?: (category: PostCategory) => void;
  onPatch: (postId: string, patch: Partial<CommunityPost>) => void;
  onRemove: (postId: string) => void;
};

/** Pre-load the next page when the sentinel is this close to the viewport. */
const PRELOAD_MARGIN = "800px";

/** Feed with infinite scroll; a button remains as a fallback (and after errors). */
export function PostList({
  posts,
  activeFilter = "all",
  searchQuery = "",
  loading,
  error,
  hasMore,
  viewerId,
  isAdmin,
  onLoadMore,
  onResetFilter,
  onSelectCategory,
  onPatch,
  onRemove,
}: Props) {
  const { t } = useI18n();
  const sentinel = useRef<HTMLDivElement>(null);
  const authorIds = posts.map((post) => post.author.id);
  const presence = usePresence(authorIds);
  const trimmedSearch = searchQuery.trim();
  const hasActiveCriteria = activeFilter !== "all" || trimmedSearch.length > 0;

  useEffect(() => {
    if (error) reportGlobalError(t("community.feed.loadError"));
  }, [error, t]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading || error) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onLoadMore(), {
      rootMargin: PRELOAD_MARGIN,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, error, onLoadMore, posts.length]);

  if (posts.length === 0 && loading) {
    return (
      <div className="feed-skeletons" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="post-skeleton" />
        ))}
      </div>
    );
  }

  if (posts.length === 0 && hasActiveCriteria && !error) {
    const activeCategoryLabel =
      activeFilter !== "all" ? t(`community.categories.${activeFilter}`) : "";
    return (
      <div className="feed-empty-card">
        <span className="feed-empty-icon" aria-hidden="true">
          <SearchX size={24} />
        </span>
        <strong>
          {trimmedSearch
            ? t("community.search.emptyTitle")
            : t("community.filters.emptyFiltered", { category: activeCategoryLabel })}
        </strong>
        <p>
          {trimmedSearch
            ? t("community.search.emptyHint")
            : t("community.filters.emptyFilteredHint")}
        </p>
        {onResetFilter ? (
          <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onResetFilter}>
            {trimmedSearch ? t("community.search.clearAll") : t("community.filters.resetFilter")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (posts.length === 0 && !error) {
    return (
      <div className="feed-empty-card">
        <span className="feed-empty-icon" aria-hidden="true">
          <MessageSquareHeart size={24} />
        </span>
        <strong>{t("community.feed.empty")}</strong>
        <p>{t("community.feed.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="feed" aria-label={t("community.editorial.feedHeading")}>
      {posts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          featured={index === 0 && activeFilter === "all" && !trimmedSearch}
          viewerId={viewerId}
          isAdmin={isAdmin}
          online={presence.statusFor(post.author.id)}
          onSelectCategory={onSelectCategory}
          onPatch={onPatch}
          onRemove={onRemove}
        />
      ))}

      <div ref={sentinel} className="feed-footer">
        {error ? (
          <>
            <p className="form-error">{t("community.feed.loadError")}</p>
            <Button variant="secondary" onClick={onLoadMore}>
              {t("common.retry")}
            </Button>
          </>
        ) : loading ? (
          <span className="feed-note">
            <Loader2 className="ui-spin" size={16} aria-hidden="true" /> {t("community.feed.loadingMore")}
          </span>
        ) : hasMore ? (
          <Button variant="secondary" onClick={onLoadMore}>
            {t("community.feed.loadMore")}
          </Button>
        ) : (
          <span className="feed-note">{t("community.feed.end")}</span>
        )}
      </div>
    </div>
  );
}
