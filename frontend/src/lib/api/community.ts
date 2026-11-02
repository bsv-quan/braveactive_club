import { ApiError, apiFetch, apiJson } from "./client";

export type PostAuthor = { id: string; displayName: string; avatarUrl: string | null };

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
};

export type CommunityPost = {
  id: string;
  author: PostAuthor;
  content: string;
  imageUrl: string | null;
  linkPreview: LinkPreview | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
};

export type PostComment = {
  id: string;
  postId: string;
  author: PostAuthor;
  content: string;
  createdAt: string;
};

export type PostPage = { posts: CommunityPost[]; nextCursor: string | null };
export type UserNotification = {
  id: string;
  actorName: string;
  kind:
    | "new_post"
    | "post_liked_own"
    | "post_liked_followed"
    | "post_commented_own"
    | "post_commented_followed";
  postId: string | null;
  context: string;
  createdAt: string;
  readAt: string | null;
};
export type NotificationPage = { notifications: UserNotification[]; unreadCount: number };

/** Events pushed by the backend over WebSocket. */
export type FeedEvent =
  | { type: "post.created"; post: CommunityPost }
  | { type: "post.updated"; post: CommunityPost }
  | { type: "post.deleted"; postId: string }
  | { type: "post.liked"; postId: string; likeCount: number }
  | { type: "comment.created"; postId: string; commentCount: number; comment: PostComment }
  | { type: "comment.updated"; postId: string; comment: PostComment }
  | { type: "comment.deleted"; postId: string; commentId: string; commentCount: number }
  | { type: "notification.created"; unreadCount: number }
  | { type: "presence.changed"; userId: string; online: boolean };

export type NewPostInput = {
  content: string;
  image?: File | null;
  linkUrl?: string | null;
  skipPreview?: boolean;
};

export const communityApi = {
  getPresence: (userIds: string[]) => {
    const query = new URLSearchParams();
    userIds.slice(0, 100).forEach((id) => query.append("userIds", id));
    return apiJson<{ onlineUserIds: string[] }>(`/api/presence?${query}`, { cache: "no-store" });
  },
  listNotifications: () =>
    apiJson<NotificationPage>("/api/notifications?limit=30", { cache: "no-store" }),
  markNotificationsRead: (ids: string[]) =>
    apiJson<{ unreadCount: number }>("/api/notifications/read", { method: "POST", json: { ids } }),
  listPosts: (cursor?: string | null, limit = 10) =>
    apiJson<PostPage>(`/api/posts?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {
      cache: "no-store",
    }),

  listAdminPosts: (cursor?: string | null) =>
    apiJson<PostPage>(`/api/admin/posts?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {
      cache: "no-store",
    }),

  /** Multipart upload: the image (if any) is validated and re-encoded server side. */
  async createPost(input: NewPostInput): Promise<CommunityPost> {
    const form = new FormData();
    form.set("content", input.content);
    if (input.image) form.set("image", input.image);
    if (input.linkUrl) form.set("link_url", input.linkUrl);
    if (input.skipPreview) form.set("skip_preview", "true");
    const response = await apiFetch("/api/posts", { method: "POST", body: form });
    const data = (await response.json().catch(() => ({}))) as CommunityPost & { error?: string };
    if (!response.ok) throw new ApiError(data.error ?? "", response.status);
    return data;
  },

  deletePost: (postId: string) => apiJson<{ message: string }>(`/api/posts/${postId}`, { method: "DELETE" }),
  updatePost: (postId: string, content: string) =>
    apiJson<CommunityPost>(`/api/posts/${postId}`, { method: "PUT", json: { content } }),
  deleteAdminPost: (postId: string) =>
    apiJson<{ message: string }>(`/api/admin/posts/${postId}`, { method: "DELETE" }),

  setLike: (postId: string, liked: boolean) =>
    apiJson<{ postId: string; likeCount: number; likedByMe: boolean }>(`/api/posts/${postId}/like`, {
      method: liked ? "PUT" : "DELETE",
    }),

  listComments: (postId: string) => apiJson<PostComment[]>(`/api/posts/${postId}/comments`, { cache: "no-store" }),

  addComment: (postId: string, content: string) =>
    apiJson<{ comment: PostComment; commentCount: number }>(`/api/posts/${postId}/comments`, {
      method: "POST",
      json: { content },
    }),

  deleteComment: (postId: string, commentId: string) =>
    apiJson<{ commentCount: number }>(`/api/posts/${postId}/comments/${commentId}`, { method: "DELETE" }),
  updateComment: (postId: string, commentId: string, content: string) =>
    apiJson<PostComment>(`/api/posts/${postId}/comments/${commentId}`, {
      method: "PUT",
      json: { content },
    }),

  linkPreview: (url: string) => apiJson<LinkPreview>(`/api/link-preview?url=${encodeURIComponent(url)}`),
};
