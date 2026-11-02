"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useI18n } from "@/i18n/i18n-provider";
import { useCommunityFeed } from "@/lib/use-community-feed";
import { GuestPrompt } from "./guest-prompt";
import { PostComposer } from "./post-composer";
import { PostList } from "./post-list";
import { UpcomingActivity } from "./upcoming-activity";

/** Community screen: composer (or login prompt) above a live, paginated feed. */
export function CommunityPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const feed = useCommunityFeed();

  return (
    <section className="community">
      <div className="community-head">
        <h1>{t("community.title")}</h1>
        <p className="muted">{t("community.subtitle")}</p>
      </div>

      <UpcomingActivity />

      {authLoading ? null : user ? (
        <PostComposer
          displayName={user.displayName}
          avatarUrl={user.avatarUrl}
          onPosted={feed.addLocalPost}
        />
      ) : (
        <GuestPrompt />
      )}

      <PostList
        posts={feed.posts}
        loading={feed.loading}
        error={feed.error}
        hasMore={feed.hasMore}
        viewerId={user?.id ?? null}
        isAdmin={user?.role === "admin"}
        onLoadMore={feed.loadMore}
        onPatch={feed.patchPost}
        onRemove={feed.removePost}
      />
    </section>
  );
}
