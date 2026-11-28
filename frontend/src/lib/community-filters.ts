export const COMMUNITY_CATEGORIES = [
  "culture",
  "society",
  "entertainment",
  "lifestyle",
  "sports",
  "technology",
] as const;

export type PostCategory = (typeof COMMUNITY_CATEGORIES)[number];

export type CommunityFeedFilter = "all" | PostCategory;

export type FilterableCommunityPost = {
  id: string;
  author: { id: string; displayName: string };
  content?: string;
  category?: PostCategory | null;
  imageUrl: string | null;
  imageUrls: string[];
  linkPreview?: {
    url: string;
    title: string | null;
    description: string | null;
    site: string | null;
  } | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

export type EditorialArticleParts = {
  headline: string | null;
  body: string;
};

export function isPostCategory(value: string | null | undefined): value is PostCategory {
  return Boolean(value && (COMMUNITY_CATEGORIES as readonly string[]).includes(value));
}

export function isAiCommunityPost(post: Pick<FilterableCommunityPost, "author">): boolean {
  return post.author.displayName.toLowerCase().includes("braveactive ai");
}

export function hasCommunityPostMedia(
  post: Pick<FilterableCommunityPost, "imageUrl" | "imageUrls">,
): boolean {
  return Boolean(post.imageUrls?.length || post.imageUrl);
}

/** Fold Vietnamese diacritics for ASCII-friendly client search matching. */
export function foldSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasNonAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 127) return true;
  }
  return false;
}

export function matchesCommunitySearch(
  post: Pick<FilterableCommunityPost, "author" | "content" | "linkPreview">,
  rawQuery?: string | null,
): boolean {
  const trimmed = rawQuery?.trim() ?? "";
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean).slice(0, 6);
  if (tokens.length === 0) return true;

  const haystackRaw = [
    post.content ?? "",
    post.author.displayName,
    post.linkPreview?.title ?? "",
    post.linkPreview?.description ?? "",
    post.linkPreview?.site ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const haystackFolded = foldSearchText(haystackRaw);

  return tokens.every((token) => {
    const lowered = token.toLowerCase();
    return hasNonAscii(lowered)
      ? haystackRaw.includes(lowered)
      : haystackFolded.includes(foldSearchText(lowered));
  });
}

export function matchesCommunityPostFilter(
  post: Pick<FilterableCommunityPost, "author" | "content" | "category" | "linkPreview">,
  filter: CommunityFeedFilter = "all",
  searchQuery?: string | null,
): boolean {
  if (filter !== "all" && post.category !== filter) return false;
  return matchesCommunitySearch(post, searchQuery);
}

export function countCommunityPostFilters(
  posts: readonly Pick<FilterableCommunityPost, "category">[],
): Record<CommunityFeedFilter, number> {
  const counts: Record<CommunityFeedFilter, number> = {
    all: posts.length,
    culture: 0,
    society: 0,
    entertainment: 0,
    lifestyle: 0,
    sports: 0,
    technology: 0,
  };
  for (const post of posts) {
    if (isPostCategory(post.category)) {
      counts[post.category] += 1;
    }
  }
  return counts;
}

export function filterCommunityPosts<T extends FilterableCommunityPost>(
  posts: readonly T[],
  filter: CommunityFeedFilter,
  searchQuery?: string | null,
): T[] {
  return posts.filter((post) => matchesCommunityPostFilter(post, filter, searchQuery));
}

/**
 * Splits structured editorial posts (`Title\n\nSummary...`) into a display headline and body.
 * Short casual status updates remain untouched (`headline: null`).
 */
export function extractEditorialArticle(
  content: string,
  isEditorialSource = false,
): EditorialArticleParts {
  const trimmed = content.trim();
  if (!trimmed) return { headline: null, body: "" };

  const separatorMatch = /\r?\n\s*\r?\n/.exec(trimmed);
  if (!separatorMatch || separatorMatch.index <= 0) {
    return { headline: null, body: content };
  }

  const rawFirstBlock = trimmed.slice(0, separatorMatch.index).trim();
  const restBody = trimmed.slice(separatorMatch.index + separatorMatch[0].length).trim();
  if (!rawFirstBlock || !restBody || rawFirstBlock.includes("\n") || /https?:\/\//i.test(rawFirstBlock)) {
    return { headline: null, body: content };
  }

  const cleanedHeadline = rawFirstBlock
    .replace(/^#{1,3}\s+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim();

  if (!cleanedHeadline || cleanedHeadline.length > 160) {
    return { headline: null, body: content };
  }

  if (!isEditorialSource && (cleanedHeadline.length < 12 || restBody.length < 70)) {
    return { headline: null, body: content };
  }

  return { headline: cleanedHeadline, body: restBody };
}

export function estimateReadingMinutes(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 1;
  const cjkChars = (trimmed.match(/[\u3040-\u30ff\u3400-\u9fff]/g) ?? []).length;
  const latinWords = trimmed
    .replace(/[\u3040-\u30ff\u3400-\u9fff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const effectiveWords = latinWords + cjkChars / 2.2;
  return Math.max(1, Math.round(effectiveWords / 200));
}

export function extractSourceHost(site?: string | null, url?: string | null): string | null {
  const candidate = site?.trim();
  if (candidate) return candidate.replace(/^www\./i, "");
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}
