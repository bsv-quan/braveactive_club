"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";
import { communityApi, type CommunityPost } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";
import { PostCard } from "./post-card";

export function AdminPostsPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cursorRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  const loadPage = useCallback(async (nextCursor: string | null, replace: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError("");
    try {
      const page = await communityApi.listAdminPosts(nextCursor);
      setPosts((existing) => {
        const merged = replace ? page.posts : [...existing, ...page.posts];
        return [...new Map(merged.map((post) => [post.id, post])).values()];
      });
      cursorRef.current = page.nextCursor;
      setCursor(page.nextCursor);
    } catch (err) {
      setError(errorMessage(err, t("community.admin.loadError")));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (user?.role === "admin") void loadPage(null, true);
  }, [loadPage, user?.id, user?.role]);

  const patchPost = useCallback((postId: string, patch: Partial<CommunityPost>) => {
    setPosts((items) => items.map((post) => (post.id === postId ? { ...post, ...patch } : post)));
  }, []);

  const removePost = useCallback((postId: string) => {
    setPosts((items) => items.filter((post) => post.id !== postId));
  }, []);

  if (authLoading) return <p className="feed-note">{t("common.loading")}</p>;
  if (!user || user.role !== "admin") {
    return (
      <section className="community">
        <div className="community-head">
          <h1>{t("community.admin.postsTitle")}</h1>
          <p className="muted">{t("community.admin.accessDenied")}</p>
        </div>
        <Link className="ui-button ui-button-primary" href="/login?next=/admin/posts">
          {t("auth.login.submit")}
        </Link>
      </section>
    );
  }

  return (
    <section className="community admin-posts">
      <div className="community-head">
        <h1>{t("community.admin.postsTitle")}</h1>
        <p className="muted">{t("community.admin.postsSubtitle")}</p>
      </div>
      {posts.length === 0 && !loading && !error ? <p className="feed-note">{t("community.admin.empty")}</p> : null}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          viewerId={user.id}
          isAdmin
          deleteRequest={communityApi.deleteAdminPost}
          onPatch={patchPost}
          onRemove={removePost}
        />
      ))}
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? (
        <span className="feed-note"><Loader2 className="ui-spin" size={16} aria-hidden /> {t("community.admin.loadingMore")}</span>
      ) : error ? (
        <Button
          variant="secondary"
          onClick={() => void loadPage(posts.length > 0 ? cursorRef.current : null, posts.length === 0)}
        >
          {t("common.retry")}
        </Button>
      ) : cursor ? (
        <Button variant="secondary" onClick={() => void loadPage(cursorRef.current, false)}>
          {t("community.admin.loadMore")}
        </Button>
      ) : posts.length > 0 ? (
        <p className="feed-note">{t("community.admin.end")}</p>
      ) : null}
    </section>
  );
}
