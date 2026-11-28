"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { communityApi, type CommunityPost, type FeedEvent } from "@/lib/api/community";
import {
  matchesCommunityPostFilter,
  type CommunityFeedFilter,
} from "@/lib/community-filters";
import { useFeedEvents } from "@/lib/use-feed-events";

type FeedState = {
  posts: CommunityPost[];
  nextCursor: string | null;
  loading: boolean;
  error: boolean;
};

export type CommunityFeedOptions = {
  category?: CommunityFeedFilter;
  query?: string;
};

/** Merge posts by id, keeping newest-first order and the freshest copy of duplicates. */
function mergePosts(existing: CommunityPost[], incoming: CommunityPost[]): CommunityPost[] {
  const byId = new Map(existing.map((post) => [post.id, post]));
  for (const post of incoming) byId.set(post.id, { ...byId.get(post.id), ...post });
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

function applyEvent(
  posts: CommunityPost[],
  event: FeedEvent,
  category: CommunityFeedFilter,
  query: string,
): CommunityPost[] {
  switch (event.type) {
    case "post.created": {
      if (!matchesCommunityPostFilter(event.post, category, query)) return posts;
      return posts.some((p) => p.id === event.post.id)
        ? posts
        : mergePosts(posts, [{ ...event.post, likedByMe: false }]);
    }
    case "post.updated": {
      if (!matchesCommunityPostFilter(event.post, category, query)) {
        return posts.filter((post) => post.id !== event.post.id);
      }
      const existing = posts.find((post) => post.id === event.post.id);
      if (existing) {
        return posts.map((post) =>
          post.id === event.post.id ? { ...event.post, likedByMe: post.likedByMe } : post,
        );
      }
      return mergePosts(posts, [{ ...event.post, likedByMe: false }]);
    }
    case "post.deleted":
      return posts.filter((p) => p.id !== event.postId);
    case "post.liked":
      return posts.map((p) => (p.id === event.postId ? { ...p, likeCount: event.likeCount } : p));
    case "comment.created":
    case "comment.deleted":
      return posts.map((p) => (p.id === event.postId ? { ...p, commentCount: event.commentCount } : p));
    case "comment.updated":
    case "notification.created":
    case "presence.changed":
      return posts;
  }
}

/**
 * Cursor-paginated community feed with server-side category & search filtering and live updates.
 */
export function useCommunityFeed(options: CommunityFeedOptions = {}) {
  const activeCategory = options.category ?? "all";
  const normalizedQuery = options.query?.trim() ?? "";
  const [state, setState] = useState<FeedState>({
    posts: [],
    nextCursor: null,
    loading: true,
    error: false,
  });
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  // undefined = nothing loaded for current filter yet; null = reached the end.
  const cursorRef = useRef<string | null | undefined>(undefined);
  const filtersRef = useRef({ category: activeCategory, query: normalizedQuery });
  filtersRef.current = { category: activeCategory, query: normalizedQuery };

  const fetchPage = useCallback(
    async (cursor: string | null, mode: "reset" | "append" | "refresh") => {
      if (mode === "append" && loadingMoreRef.current) return;
      const requestId = ++requestIdRef.current;
      if (mode === "append") loadingMoreRef.current = true;
      setState((current) => ({
        posts: mode === "reset" ? [] : current.posts,
        nextCursor: mode === "reset" ? null : current.nextCursor,
        loading: true,
        error: false,
      }));
      try {
        const page = await communityApi.listPosts(cursor, 10, {
          category: activeCategory === "all" ? null : activeCategory,
          q: normalizedQuery || null,
        });
        if (requestId !== requestIdRef.current) return;
        if (mode !== "refresh" || cursorRef.current === undefined) {
          cursorRef.current = page.nextCursor;
        }
        setState((current) => ({
          posts: mode === "reset" ? page.posts : mergePosts(current.posts, page.posts),
          nextCursor: cursorRef.current ?? null,
          loading: false,
          error: false,
        }));
      } catch {
        if (requestId !== requestIdRef.current) return;
        setState((current) => ({ ...current, loading: false, error: true }));
      } finally {
        if (mode === "append") loadingMoreRef.current = false;
      }
    },
    [activeCategory, normalizedQuery],
  );

  useEffect(() => {
    cursorRef.current = undefined;
    loadingMoreRef.current = false;
    void fetchPage(null, "reset");
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (cursorRef.current === undefined) {
      void fetchPage(null, "reset");
    } else if (cursorRef.current) {
      void fetchPage(cursorRef.current, "append");
    }
  }, [fetchPage]);

  // After a WebSocket reconnect, refresh the newest page matching active filters.
  const refresh = useCallback(() => {
    void fetchPage(null, "refresh");
  }, [fetchPage]);

  useFeedEvents((event) => {
    const { category, query } = filtersRef.current;
    setState((s) => ({ ...s, posts: applyEvent(s.posts, event, category, query) }));
  }, refresh);

  const addLocalPost = useCallback((post: CommunityPost) => {
    if (!post.approved) return;
    const { category, query } = filtersRef.current;
    if (!matchesCommunityPostFilter(post, category, query)) return;
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
