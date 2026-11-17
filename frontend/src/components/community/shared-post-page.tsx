"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert } from "@/components/ui/form-controls";
import { useI18n } from "@/i18n/i18n-provider";
import { communityApi, type CommunityPost } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";
import { PostCard } from "./post-card";

export function SharedPostPage({ postId }: { postId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPost(null);
    communityApi
      .getPost(postId)
      .then((result) => {
        if (active) setPost(result);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason, t("community.sharedPost.loadError")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [postId, t]);

  const patchPost = useCallback((id: string, patch: Partial<CommunityPost>) => {
    setPost((current) => current?.id === id ? { ...current, ...patch } : current);
  }, []);

  const removePost = useCallback(() => {
    setPost(null);
    setError(t("community.sharedPost.notFound"));
  }, [t]);

  return (
    <section className="community shared-post-page">
      <Link className="text-link shared-post-back" href="/community">
        {t("community.sharedPost.back")}
      </Link>
      {loading ? (
        <div className="feed-skeletons" aria-busy="true">
          <div className="post-skeleton" />
        </div>
      ) : post ? (
        <PostCard
          post={post}
          viewerId={user?.id ?? null}
          isAdmin={user?.role === "admin"}
          initialCommentsOpen
          loginNext={`/community/posts/${postId}`}
          showFullContent
          onPatch={patchPost}
          onRemove={removePost}
        />
      ) : (
        <Alert tone="error">{error || t("community.sharedPost.notFound")}</Alert>
      )}
    </section>
  );
}
