"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { communityApi, type CommunityPost, type FeedEvent } from "@/lib/api/community";
import { useFeedEvents } from "@/lib/use-feed-events";

type FeedState = {
  posts: CommunityPost[];
  nextCursor: string | null;
  loading: boolean;
  error: boolean;
};

/** Merge posts by id, keeping newest-first order and the freshest copy of duplicates. */
function mergePosts(existing: CommunityPost[], incoming: CommunityPost[]): CommunityPost[] {
  const byId = new Map(existing.map((post) => [post.id, post]));
  for (const post of incoming) byId.set(post.id, { ...byId.get(post.id), ...post });
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

function applyEvent(posts: CommunityPost[], event: FeedEvent): CommunityPost[] {
  switch (event.type) {
    case "post.created":
      // Skip posts we already added locally.
      return posts.some((p) => p.id === event.post.id)
        ? posts
        : mergePosts(posts, [{ ...event.post, likedByMe: false }]);
    case "post.updated":
      return posts.map((post) =>
        post.id === event.post.id ? { ...event.post, likedByMe: post.likedByMe } : post,
      );
    case "post.deleted":
      return posts.filter((p) => p.id !== event.postId);
    case "post.liked":
      return posts.map((p) => (p.id === event.postId ? { ...p, likeCount: event.likeCount } : p));
    case "comment.created":
    case "comment.deleted":
      return posts.map((p) => (p.id === event.postId ? { ...p, commentCount: event.commentCount } : p));
    case "comment.updated":
      return posts;
    case "notification.created":
    case "presence.changed":
      return posts;
  }
}

/**
 * Cursor-paginated community feed with live updates.
 * The first page is fetched on mount; `loadMore` appends older posts.
 */
export function useCommunityFeed() {
  const [state, setState] = useState<FeedState>({ posts: [], nextCursor: null, loading: true, error: false });
  const inFlight = useRef(false);
  // undefined = nothing loaded yet; null = reached the end.
  const cursorRef = useRef<string | null | undefined>(undefined);

  const fetchPage = useCallback(async (cursor: string | null, isRefresh: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const page = await communityApi.listPosts(cursor);
      // A refresh of the newest page must not rewind a user who already paged deeper.
      if (!isRefresh || cursorRef.current === undefined) cursorRef.current = page.nextCursor;
      setState((s) => ({
        posts: mergePosts(s.posts, page.posts),
        nextCursor: cursorRef.current ?? null,
        loading: false,
        error: false,
      }));
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchPage(null, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (cursorRef.current === undefined) {
      void fetchPage(null, true);
    } else if (cursorRef.current) {
      void fetchPage(cursorRef.current, false);
    }
  }, [fetchPage]);

  // After a WebSocket reconnect, refresh the newest page to catch up on missed events.
  const refresh = useCallback(() => {
    void fetchPage(null, true);
  }, [fetchPage]);

  useFeedEvents((event) => {
    setState((s) => ({ ...s, posts: applyEvent(s.posts, event) }));
  }, refresh);

  const addLocalPost = useCallback((post: CommunityPost) => {
    setState((s) => ({ ...s, posts: mergePosts(s.posts, [post]) }));
  }, []);

  const patchPost = useCallback((postId: string, patch: Partial<CommunityPost>) => {
    setState((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, ...patch } : p)) }));
  }, []);

  const removePost = useCallback((postId: string) => {
    setState((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== postId) }));
  }, []);

  return {
    posts: state.posts,
    loading: state.loading,
    error: state.error,
    hasMore: state.nextCursor !== null,
    loadMore,
    addLocalPost,
    patchPost,
    removePost,
  };
}
