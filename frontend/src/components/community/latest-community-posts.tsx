"use client";

import { MessageCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { communityApi, type CommunityPost } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";
import { formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/i18n/i18n-provider";
import { usePresence } from "@/lib/use-presence";

function LatestCommunityPostsBase() {
  const { t, intlLocale } = useI18n();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const presence = usePresence(posts.map((post) => post.author.id));

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await communityApi.listPosts(null, 3);
      setPosts(page.posts.slice(0, 3));
    } catch (reason) {
      setError(errorMessage(reason, t("club.latestPosts.loadError")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  return (
    <section className="latest-community-section" aria-labelledby="latest-community-title">
      <div className="latest-community-heading">
        <div>
          <span className="section-kicker">{t("club.latestPosts.kicker")}</span>
          <h2 id="latest-community-title">{t("club.latestPosts.title")}</h2>
        </div>
        <Link className="text-link" href="/community">
          {t("club.latestPosts.viewAll")} <span>↗</span>
        </Link>
      </div>

      {loading ? (
        <div className="latest-community-state" aria-busy="true">{t("club.latestPosts.loading")}</div>
      ) : error ? (
        <div className="latest-community-state" role="alert">
          <span>{error}</span>
          <button type="button" className="button-quiet" onClick={() => void loadPosts()}>
            <RefreshCw size={14} aria-hidden /> {t("common.retry")}
          </button>
        </div>
      ) : posts.length ? (
        <div className="latest-community-list">
          {posts.map((post) => (
            <Link className="latest-community-post" href="/community" key={post.id}>
              <UserAvatar
                name={post.author.displayName}
                avatarUrl={post.author.avatarUrl}
                online={presence.statusFor(post.author.id)}
                size={38}
              />
              <span className="latest-community-copy">
                <span className="latest-community-meta">
                  <strong>{post.author.displayName}</strong>
                  <time dateTime={post.createdAt}>
                    {formatRelativeTime(post.createdAt, intlLocale) ?? t("community.post.justNow")}
                  </time>
                </span>
                <span className="latest-community-text">
                  {post.content || t("club.latestPosts.photoPost")}
                </span>
                {post.imageUrl || post.linkPreview ? (
                  <span className="latest-community-attachment">
                    {post.imageUrl
                      ? t("club.latestPosts.photoPost")
                      : post.linkPreview?.title ?? post.linkPreview?.site ?? post.linkPreview?.url}
                  </span>
                ) : null}
                <span className="latest-community-stats">
                  <span><MessageCircle size={13} aria-hidden /> {post.commentCount}</span>
                  <span>{t("community.post.likes", { count: post.likeCount })}</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="latest-community-state">{t("club.latestPosts.empty")}</div>
      )}
    </section>
  );
}

export const LatestCommunityPosts = memo(LatestCommunityPostsBase);
