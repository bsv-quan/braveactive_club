import { COMMUNITY_CATEGORIES, type PostCategory } from "@/lib/community-filters";
import { ApiError, apiFetch, apiJson } from "./client";

export { COMMUNITY_CATEGORIES, type PostCategory };

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
  category?: PostCategory | null;
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
export type GameLeaderboardPeriod = "week" | "month" | "all";
export type GameType = "word_search" | "chess" | "xiangqi" | "go" | "caro" | "sudoku" | "dev_vs_ai";
export type LeaderboardScope = "all" | GameType;
export type BoardGameApiType = "chess" | "xiangqi" | "go" | "caro";
export type GameDifficulty = "easy" | "medium" | "hard";
export type ArcadeRankTier = "rookie" | "challenger" | "master" | "grandmaster" | "legend";
export type GameLeaderboard = {
  period: GameLeaderboardPeriod;
  gameType: LeaderboardScope;
  entries: {
    rank: number;
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    score: number;
    roundsPlayed?: number;
  }[];
  updatedAt: string;
};
export type GameStatus = {
  streakDays: number;
  longestStreakDays?: number;
  playedToday: boolean;
  freeHintsRemaining: number;
  wordSearchPoints: number;
  totalPoints?: number;
  totalRounds?: number;
};
export type MiniGameStat = {
  gameType: GameType;
  roundsPlayed: number;
  wins: number;
  totalScore: number;
  bestScore: number;
};
export type AchievementBadgeId =
  | "first_round"
  | "streak_3"
  | "streak_7"
  | "explorer"
  | "tactician"
  | "points_1000";
export type AchievementBadge = {
  id: AchievementBadgeId;
  unlocked: boolean;
  progress: number;
  target: number;
};
export type PersonalAchievements = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  rank: number | null;
  tier: ArcadeRankTier;
  nextTierPoints: number | null;
  totalPoints: number;
  totalRounds: number;
  totalWins: number;
  streakDays: number;
  longestStreakDays: number;
  activeDays: number;
  playedToday: boolean;
  gamesExplored: number;
  perGame: MiniGameStat[];
  badges: AchievementBadge[];
};
export type GameAchievements = {
  me: PersonalAchievements | null;
  club: {
    totalPlayers: number;
    totalRounds: number;
    totalPoints: number;
  };
  updatedAt: string;
};
export type BoardGameState = {
  board: string[][];
  turn: string;
  result: "ongoing" | "white_win" | "black_win" | "red_win" | "x_win" | "o_win" | "draw";
  last_move?: Record<string, unknown> | null;
  winning_line?: [number, number][] | null;
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
export type SudokuStateResponse = {
  roundId: string | null;
  difficulty: GameDifficulty;
  puzzle: number[][];
  board: number[][];
  hintedCells: [number, number][];
  solution?: number[][] | null;
  completed: boolean;
  score: number;
  scoreAwarded: number;
};
export type SudokuHintResponse = {
  row: number | null;
  col: number | null;
  value: number | null;
  board: number[][];
  hintedCells: [number, number][];
  completed: boolean;
  score: number;
  scoreAwarded: number;
  freeHintsRemaining: number;
  totalPoints: number;
};
export type PostLiker = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  likedAt: string;
};

export type UserNotification = {
  id: string;
  actorName: string;
  kind:
    | "new_post"
    | "post_liked_own"
    | "post_liked_followed"
    | "post_commented_own"
    | "post_commented_followed"
    | "admin_pending_post"
    | "admin_pending_request"
    | "admin_pending_activity";
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
  listPosts: (
    cursor?: string | null,
    limit = 10,
    filters?: { category?: PostCategory | null; q?: string | null },
  ) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    if (filters?.category) params.set("category", filters.category);
    const trimmedQuery = filters?.q?.trim();
    if (trimmedQuery) params.set("q", trimmedQuery);
    return apiJson<PostPage>(`/api/posts?${params.toString()}`, {
      cache: "no-store",
    });
  },
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
      totalPoints?: number;
    }>(
      `/api/games/word-search/${encodeURIComponent(roundId)}/hint`,
      { method: "POST" },
    ),
  getGameStatus: () => apiJson<GameStatus>("/api/games/status", { cache: "no-store" }),
  getGameAchievements: () => apiJson<GameAchievements>("/api/games/achievements", { cache: "no-store" }),
  startDevVsAiRound: (stageId: string) =>
    apiJson<{ roundId: string }>("/api/games/dev-vs-ai/start", {
      method: "POST",
      json: { stageId },
    }),
  completeDevVsAiRound: (
    roundId: string,
    input: { status: "victory" | "defeat"; starsEarned: number; endlessWave: number },
  ) =>
    apiJson<{
      scoreAwarded: number;
      score: number;
      totalPoints: number;
      streakDays: number;
      playedToday: boolean;
    }>(`/api/games/dev-vs-ai/${encodeURIComponent(roundId)}/complete`, {
      method: "POST",
      json: input,
    }),
  startBoardGame: (
    gameType: BoardGameApiType,
    difficulty: GameDifficulty,
  ) =>
    apiJson<BoardGameResponse>(`/api/games/board/${gameType}/start`, {
      method: "POST",
      json: { difficulty },
    }),
  getActiveBoardGame: (gameType: BoardGameApiType) =>
    apiJson<BoardGameResponse | null>(`/api/games/board/${gameType}/active`, { cache: "no-store" }),
  abandonActiveBoardGame: (gameType: BoardGameApiType) =>
    apiJson<{ ok: boolean }>(`/api/games/board/${gameType}/active`, { method: "DELETE" }),
  forfeitBoardGame: (
    gameType: BoardGameApiType,
    roundId: string | null,
    state: BoardGameState,
  ) =>
    apiJson<BoardGameResponse>(`/api/games/board/${gameType}/forfeit`, {
      method: "POST",
      json: { roundId, state: roundId ? undefined : state },
    }),
  submitBoardMove: (
    gameType: BoardGameApiType,
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
    gameType: BoardGameApiType,
    difficulty: GameDifficulty,
    roundId: string | null,
    state: BoardGameState,
  ) =>
    apiJson<BoardGameResponse>(`/api/games/board/${gameType}/bot-turn`, {
      method: "POST",
      json: { difficulty, roundId, state: roundId ? undefined : state },
    }),
  startSudoku: (difficulty: GameDifficulty) =>
    apiJson<SudokuStateResponse>("/api/games/sudoku/start", {
      method: "POST",
      json: { difficulty },
    }),
  getActiveSudoku: () =>
    apiJson<SudokuStateResponse | null>("/api/games/sudoku/active", { cache: "no-store" }),
  abandonActiveSudoku: () =>
    apiJson<{ ok: boolean }>("/api/games/sudoku/active", { method: "DELETE" }),
  syncSudoku: (roundId: string, board: number[][]) =>
    apiJson<SudokuStateResponse>(`/api/games/sudoku/${encodeURIComponent(roundId)}/sync`, {
      method: "POST",
      json: { board },
    }),
  useSudokuHint: (roundId: string, input: { row?: number; col?: number; board?: number[][] } = {}) =>
    apiJson<SudokuHintResponse>(`/api/games/sudoku/${encodeURIComponent(roundId)}/hint`, {
      method: "POST",
      json: input,
    }),
  startStrategyRound: () =>
    apiJson<{ roundId: string }>("/api/games/strategy/start", { method: "POST" }),
  submitStrategyAnswer: (roundId: string, questionIndex: number, answerIndex: number) =>
    apiJson<{ correct: boolean; scoreAwarded: number; score: number; complete: boolean }>(
      `/api/games/strategy/${encodeURIComponent(roundId)}/answer`,
      { method: "POST", json: { questionIndex, answerIndex } },
    ),
  getGameLeaderboard: (period: GameLeaderboardPeriod, gameType: LeaderboardScope) =>
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

  listPostLikes: (postId: string) =>
    apiJson<PostLiker[]>(`/api/posts/${encodeURIComponent(postId)}/likes`, { cache: "no-store" }),

  sharePostToSlack: (postId: string, message: string) =>
    apiJson<{ message: string }>(`/api/posts/${encodeURIComponent(postId)}/share-slack`, {
      method: "POST",
      json: { message },
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
