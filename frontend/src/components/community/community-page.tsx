"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useCommunityFeed } from "@/lib/use-community-feed";
import { GuestPrompt } from "./guest-prompt";
import { PostComposer } from "./post-composer";
import { PostList } from "./post-list";

/** Community screen: composer (or login prompt) above a live, paginated feed. */
export function CommunityPage() {
  const { user, loading: authLoading } = useAuth();
  const feed = useCommunityFeed();

  return (
    <section className="community">
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
