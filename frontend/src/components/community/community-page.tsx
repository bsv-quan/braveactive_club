"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useI18n } from "@/i18n/i18n-provider";
import { useCommunityFeed } from "@/lib/use-community-feed";
import { GuestPrompt } from "./guest-prompt";
import { PostComposer } from "./post-composer";
import { PostList } from "./post-list";
import { CommunitySideRail } from "./community-side-rail";

/** Community screen: editorial masthead, composer on top, live feed and sticky feature rail. */
export function CommunityPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, intlLocale } = useI18n();
  const feed = useCommunityFeed();

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [intlLocale],
  );

  return (
    <section className="community-layout">
      <div className="community">
        <header className="community-masthead">
          <div className="community-masthead-meta">
            <span className="community-masthead-kicker">{t("community.editorial.kicker")}</span>
            <time className="community-masthead-date">{todayLabel}</time>
          </div>
          <h1>{t("community.editorial.title")}</h1>
          <p>{t("community.subtitle")}</p>
        </header>

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
      </div>
      <CommunitySideRail />
    </section>
  );
}
