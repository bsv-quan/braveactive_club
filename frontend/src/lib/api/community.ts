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
  imageUrls: string[];
  linkPreview: LinkPreview | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  approved: boolean;
  hidden: boolean;
};

export type PostComment = {
  id: string;
  postId: string;
  author: PostAuthor;
  content: string;
  createdAt: string;
};

export type PostPage = { posts: CommunityPost[]; nextCursor: string | null };
export type FeedbackItem = {
  id: string;
  authorName: string | null;
  title: string;
  content: string;
  createdAt: string;
};
export type FeedbackPage = { feedback: FeedbackItem[]; hasMore: boolean };
export type AIPostTopic = "all" | "health" | "sports" | "travel" | "technology" | "entertainment";
export type AIPostHours = 1 | 4 | 12 | 24;
export type AIPostPreview = {
  topic: AIPostTopic;
  hours: AIPostHours;
  title: string;
  content: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceDescription: string;
  sourcePublishedAt: string;
};
export type WordSearchPuzzle = {
  grid: string[][];
  words: { answer: string; displayAnswer: string; clue: string }[];
  size: number;
  roundId: string | null;
};
export type WordSearchDifficulty = "easy" | "medium" | "hard";
export type GameLeaderboardPeriod = "week" | "month";
export type GameType = "word_search" | "chess" | "xiangqi" | "go";
export type GameDifficulty = "easy" | "medium" | "hard";
export type GameLeaderboard = {
  period: GameLeaderboardPeriod;
  gameType: GameType;
  entries: { rank: number; userId: string; displayName: string; score: number }[];
  updatedAt: string;
};
export type GameStatus = {
  streakDays: number;
  playedToday: boolean;
  freeHintsRemaining: number;
  wordSearchPoints: number;
};
export type BoardGameState = {
  board: string[][];
  turn: string;
  result: "ongoing" | "white_win" | "black_win" | "red_win" | "draw";
  last_move?: Record<string, unknown> | null;
  [key: string]: unknown;
};
export type BoardMove = {
  from?: [number, number];
  to?: [number, number];
  at?: [number, number];
  pass?: boolean;
  promotion?: "q" | "r" | "b" | "n";
};
export type BoardGameResponse = {
  roundId: string | null;
  state: BoardGameState;
  score: number;
  scoreAwarded: number;
};
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
export type NotificationPage = {
  notifications: UserNotification[];
  unreadCount: number;
  hasMore: boolean;
};

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
  images?: File[];
  linkUrl?: string | null;
  skipPreview?: boolean;
};

export const communityApi = {
  submitFeedback: (input: { title: string; content: string }) =>
    apiJson<FeedbackItem>("/api/feedback", { method: "POST", json: input }),
  listAdminFeedback: (offset = 0, limit = 50) =>
    apiJson<FeedbackPage>(`/api/admin/feedback?limit=${limit}&offset=${offset}`, { cache: "no-store" }),
  getPresence: (userIds: string[]) => {
    const query = new URLSearchParams();
    userIds.slice(0, 100).forEach((id) => query.append("userIds", id));
    return apiJson<{ onlineUserIds: string[] }>(`/api/presence?${query}`, { cache: "no-store" });
  },
  listNotifications: (offset = 0, limit = 10) =>
    apiJson<NotificationPage>(`/api/notifications?limit=${limit}&offset=${offset}`, { cache: "no-store" }),
  markNotificationsRead: (ids: string[]) =>
    apiJson<{ unreadCount: number }>("/api/notifications/read", { method: "POST", json: { ids } }),
  listPosts: (cursor?: string | null, limit = 10) =>
    apiJson<PostPage>(`/api/posts?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {
      cache: "no-store",
    }),
  getPost: (postId: string) =>
    apiJson<CommunityPost>(`/api/posts/${encodeURIComponent(postId)}`, { cache: "no-store" }),

  listAdminPosts: (cursor?: string | null) =>
    apiJson<PostPage>(`/api/admin/posts?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {
      cache: "no-store",
    }),
  previewAiPost: (topic: AIPostTopic, hours: AIPostHours, excludeSourceUrls: string[] = []) =>
    apiJson<AIPostPreview>("/api/admin/ai-posts/preview", {
      method: "POST",
      json: { topic, hours, excludeSourceUrls },
    }),
  generateWordSearch: (input: {
    difficulty: WordSearchDifficulty;
    locale: "vi" | "en" | "ja";
  }) =>
    apiJson<WordSearchPuzzle>("/api/games/word-search", {
      method: "POST",
      json: input,
    }),
  submitWordSearchGuess: (roundId: string, cells: number[]) =>
    apiJson<{ correct: boolean; foundWords: number[]; scoreAwarded: number; score: number; complete: boolean }>(
      `/api/games/word-search/${encodeURIComponent(roundId)}/guess`,
      { method: "POST", json: { cells } },
    ),
  useWordSearchHint: (roundId: string) =>
    apiJson<{
      cell: number | null;
      scoreAwarded: number;
      score: number;
      freeHintsRemaining: number;
      wordSearchPoints: number;
    }>(
      `/api/games/word-search/${encodeURIComponent(roundId)}/hint`,
      { method: "POST" },
    ),
  getGameStatus: () => apiJson<GameStatus>("/api/games/status", { cache: "no-store" }),
  startBoardGame: (
    gameType: Exclude<GameType, "word_search">,
    difficulty: GameDifficulty,
  ) =>
    apiJson<BoardGameResponse>(`/api/games/board/${gameType}/start`, {
      method: "POST",
      json: { difficulty },
    }),
  getActiveBoardGame: (gameType: Exclude<GameType, "word_search">) =>
    apiJson<BoardGameResponse | null>(`/api/games/board/${gameType}/active`, { cache: "no-store" }),
  abandonActiveBoardGame: (gameType: Exclude<GameType, "word_search">) =>
    apiJson<{ ok: boolean }>(`/api/games/board/${gameType}/active`, { method: "DELETE" }),
  forfeitBoardGame: (
    gameType: Exclude<GameType, "word_search">,
    roundId: string | null,
    state: BoardGameState,
  ) =>
    apiJson<BoardGameResponse>(`/api/games/board/${gameType}/forfeit`, {
      method: "POST",
      json: { roundId, state: roundId ? undefined : state },
    }),
  submitBoardMove: (
    gameType: Exclude<GameType, "word_search">,
    difficulty: GameDifficulty,
    move: BoardMove,
    roundId: string | null,
    state: BoardGameState,
  ) =>
    apiJson<BoardGameResponse>(`/api/games/board/${gameType}/move`, {
      method: "POST",
      json: { difficulty, move, roundId, state: roundId ? undefined : state },
    }),
  submitBoardBotTurn: (
    gameType: Exclude<GameType, "word_search">,
    difficulty: GameDifficulty,
    roundId: string | null,
    state: BoardGameState,
  ) =>
    apiJson<BoardGameResponse>(`/api/games/board/${gameType}/bot-turn`, {
      method: "POST",
      json: { difficulty, roundId, state: roundId ? undefined : state },
    }),
  startStrategyRound: () =>
    apiJson<{ roundId: string }>("/api/games/strategy/start", { method: "POST" }),
  submitStrategyAnswer: (roundId: string, questionIndex: number, answerIndex: number) =>
    apiJson<{ correct: boolean; scoreAwarded: number; score: number; complete: boolean }>(
      `/api/games/strategy/${encodeURIComponent(roundId)}/answer`,
      { method: "POST", json: { questionIndex, answerIndex } },
    ),
  getGameLeaderboard: (period: GameLeaderboardPeriod, gameType: GameType) =>
    apiJson<GameLeaderboard>(
      `/api/games/leaderboard?period=${period}&gameType=${gameType}`,
      { cache: "no-store" },
    ),
  publishAiPost: (input: Pick<AIPostPreview, "topic" | "hours" | "title" | "content" | "sourceUrl">) =>
    apiJson<CommunityPost>("/api/admin/ai-posts/publish", { method: "POST", json: input }),

  /** Multipart upload: the image (if any) is validated and re-encoded server side. */
  async createPost(input: NewPostInput): Promise<CommunityPost> {
    const form = new FormData();
    form.set("content", input.content);
    input.images?.forEach((image) => form.append("images", image));
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
  setPostHidden: (postId: string, hidden: boolean) =>
    apiJson<{ hidden: boolean }>(`/api/admin/posts/${postId}/visibility`, { method: "PATCH", json: { hidden } }),
  approvePost: (postId: string) =>
    apiJson<CommunityPost>(`/api/admin/posts/${postId}/approve`, { method: "POST" }),

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
