"use client";

import { Check, Clock3, Eye, EyeOff, FileText, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/i18n/i18n-provider";
import { communityApi, type CommunityPost } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";
import { AdminAiPostDialog } from "./admin-ai-post-dialog";
import { PostCard } from "./post-card";

type ModerationFilter = "all" | "pending" | "hidden";

type Props = {
  embedded?: boolean;
  onPendingCountChange?: (count: number) => void;
};

export function AdminPostsPage({ embedded = false, onPendingCountChange }: Props) {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [filter, setFilter] = useState<ModerationFilter>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionPostId, setActionPostId] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  const loadPage = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
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
    },
    [t],
  );

  useEffect(() => {
    if (user?.role === "admin") void loadPage(null, true);
  }, [loadPage, user?.id, user?.role]);

  const pendingCount = useMemo(
    () => posts.filter((post) => !post.approved).length,
    [posts],
  );
  const hiddenCount = useMemo(
    () => posts.filter((post) => post.hidden).length,
    [posts],
  );

  useEffect(() => {
    onPendingCountChange?.(pendingCount);
  }, [onPendingCountChange, pendingCount]);

  const visiblePosts = useMemo(() => {
    if (filter === "pending") return posts.filter((post) => !post.approved);
    if (filter === "hidden") return posts.filter((post) => post.hidden);
    return posts;
  }, [posts, filter]);

  const patchPost = useCallback((postId: string, patch: Partial<CommunityPost>) => {
    setPosts((items) =>
      items
        .map((post) => (post.id === postId ? { ...post, ...patch } : post))
        .sort(
          (left, right) =>
            Number(left.approved) - Number(right.approved) ||
            right.createdAt.localeCompare(left.createdAt) ||
            right.id.localeCompare(left.id),
        ),
    );
  }, []);

  const addGeneratedPost = useCallback((post: CommunityPost) => {
    setPosts((items) =>
      [...items.filter((item) => item.id !== post.id), post].sort(
        (left, right) =>
          Number(left.approved) - Number(right.approved) ||
          right.createdAt.localeCompare(left.createdAt) ||
          right.id.localeCompare(left.id),
      ),
    );
  }, []);

  const removePost = useCallback((postId: string) => {
    setPosts((items) => items.filter((post) => post.id !== postId));
  }, []);

  if (authLoading) return <p className="feed-note">{t("common.loading")}</p>;
  if (!user || user.role !== "admin") {
    return (
      <section className="community">
        <div className="community-head">
          <p className="muted">{t("community.admin.accessDenied")}</p>
        </div>
        <Link className="ui-button ui-button-primary" href="/login?next=/admin/posts">
          {t("auth.login.submit")}
        </Link>
      </section>
    );
  }

  return (
    <section className={`admin-posts${embedded ? " is-embedded" : " admin-posts-standalone"}`}>
      {!embedded ? (
        <header className="editorial-folio-masthead">
          <div className="editorial-folio-top">
            <div className="community-dateline">
              <span className="community-edition-tag">{t("admin.kicker")}</span>
              {pendingCount > 0 ? (
                <span className="editorial-folio-stat is-alert">
                  <Clock3 size={13} aria-hidden="true" />
                  {t("admin.pendingBadge", { count: pendingCount })}
                </span>
              ) : null}
            </div>
          </div>
          <div className="editorial-folio-main">
            <div className="editorial-folio-copy">
              <h1>{t("admin.posts")}</h1>
              <p>{t("admin.subtitle")}</p>
            </div>
          </div>
        </header>
      ) : null}

      <div className="admin-posts-header-bar">
        <AdminAiPostDialog onPostCreated={addGeneratedPost} />
        <div className="admin-posts-filter-group" role="group" aria-label={t("admin.posts")}>
          <button
            type="button"
            aria-pressed={filter === "all"}
            className={`training-filter-chip${filter === "all" ? " is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {t("admin.postFilters.all")} ({posts.length})
          </button>
          <button
            type="button"
            aria-pressed={filter === "pending"}
            className={`training-filter-chip${filter === "pending" ? " is-active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            {t("admin.postFilters.pending")} ({pendingCount})
          </button>
          <button
            type="button"
            aria-pressed={filter === "hidden"}
            className={`training-filter-chip${filter === "hidden" ? " is-active" : ""}`}
            onClick={() => setFilter("hidden")}
          >
            {t("admin.postFilters.hidden")} ({hiddenCount})
          </button>
        </div>
      </div>

      {visiblePosts.length === 0 && !loading && !error ? (
        <div className="feed-empty-card admin-empty-inline">
          <span className="feed-empty-icon" aria-hidden="true">
            <FileText size={22} />
          </span>
          <strong>{t("community.admin.empty")}</strong>
        </div>
      ) : null}

      <div className="admin-posts-list">
        {visiblePosts.map((post) => (
          <div
            className={`admin-post-item${!post.approved ? " is-pending" : ""}${
              post.hidden ? " is-hidden" : ""
            }`}
            key={post.id}
          >
            <div className="admin-post-toolbar">
              <span
                className={`admin-status-pill ${
                  !post.approved
                    ? "is-warning"
                    : post.hidden
                      ? "is-muted"
                      : "is-success"
                }`}
              >
                {!post.approved
                  ? t("community.admin.pending")
                  : post.hidden
                    ? t("admin.statusHidden")
                    : t("admin.statusApproved")}
              </span>

              <div className="admin-post-actions">
                {!post.approved ? (
                  <button
                    className="admin-post-action approve"
                    type="button"
                    title={t("community.admin.approve")}
                    aria-label={t("community.admin.approve")}
                    disabled={actionPostId === post.id}
                    onClick={() => {
                      setActionPostId(post.id);
                      setError("");
                      void communityApi
                        .approvePost(post.id)
                        .then((approvedPost) => patchPost(post.id, approvedPost))
                        .catch((reason) => setError(errorMessage(reason, t("admin.error"))))
                        .finally(() => setActionPostId(null));
                    }}
                  >
                    <Check size={15} aria-hidden />
                    <span>{t("admin.approve")}</span>
                  </button>
                ) : null}
                <button
                  className="admin-post-action"
                  type="button"
                  title={post.hidden ? t("admin.unhide") : t("admin.hide")}
                  aria-label={post.hidden ? t("admin.unhide") : t("admin.hide")}
                  disabled={actionPostId === post.id}
                  onClick={() => {
                    setActionPostId(post.id);
                    setError("");
                    void communityApi
                      .setPostHidden(post.id, !post.hidden)
                      .then(({ hidden }) => patchPost(post.id, { hidden }))
                      .catch((reason) => setError(errorMessage(reason, t("admin.error"))))
                      .finally(() => setActionPostId(null));
                  }}
                >
                  {post.hidden ? <Eye size={15} aria-hidden /> : <EyeOff size={15} aria-hidden />}
                  <span>{post.hidden ? t("admin.unhide") : t("admin.hide")}</span>
                </button>
                <button
                  className="admin-post-action danger"
                  type="button"
                  title={t("common.delete")}
                  aria-label={t("common.delete")}
                  disabled={actionPostId === post.id}
                  onClick={() => {
                    void confirm({
                      title: t("common.delete"),
                      message: t("community.post.deleteConfirm"),
                      confirmLabel: t("common.delete"),
                      tone: "danger",
                    }).then((ok) => {
                      if (!ok) return;
                      setActionPostId(post.id);
                      setError("");
                      void communityApi
                        .deleteAdminPost(post.id)
                        .then(() => removePost(post.id))
                        .catch((reason) => setError(errorMessage(reason, t("admin.error"))))
                        .finally(() => setActionPostId(null));
                    });
                  }}
                >
                  <Trash2 size={15} aria-hidden />
                  <span>{t("common.delete")}</span>
                </button>
              </div>
            </div>

            <PostCard
              post={post}
              viewerId={user.id}
              isAdmin
              showActionsMenu={false}
              onPatch={patchPost}
              onRemove={removePost}
            />
          </div>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? (
        <span className="feed-note">
          <Loader2 className="ui-spin" size={16} aria-hidden /> {t("community.admin.loadingMore")}
        </span>
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
