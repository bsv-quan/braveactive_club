/**
 * Unified registry of all mini-games inside the braveActive Arcade Universe.
 * Kept free of local imports so Node.js native test runner (`node --test`) can import it directly.
 */

export type ArcadeGameSlug = "dev-vs-ai" | "word-search" | "chess" | "xiangqi" | "go";
export type ArcadeGameApiType = "dev_vs_ai" | "word_search" | "chess" | "xiangqi" | "go";
export type ArcadeGameI18nKey = "devVsAi" | "wordSearch" | "chess" | "xiangqi" | "go";

export type ArcadeZoneEntry = {
  slug: ArcadeGameSlug;
  apiType: ArcadeGameApiType;
  i18nKey: ArcadeGameI18nKey;
  zoneIndex: 1 | 2 | 3 | 4 | 5;
  zoneTagKey:
    | "community.games.arcade.zone1Tag"
    | "community.games.arcade.zone2Tag"
    | "community.games.arcade.zone3Tag"
    | "community.games.arcade.zone4Tag"
    | "community.games.arcade.zone5Tag";
  rewardKey:
    | "community.games.arcade.zoneRewardDevVsAi"
    | "community.games.arcade.zoneRewardWordSearch"
    | "community.games.arcade.zoneRewardBoard";
  tone: "cyber" | "emerald" | "amber" | "crimson" | "sky";
  featured: boolean;
  kind: "campaign" | "word_search" | "board";
};

export const ARCADE_GAMES: readonly ArcadeZoneEntry[] = [
  {
    slug: "dev-vs-ai",
    apiType: "dev_vs_ai",
    i18nKey: "devVsAi",
    zoneIndex: 1,
    zoneTagKey: "community.games.arcade.zone1Tag",
    rewardKey: "community.games.arcade.zoneRewardDevVsAi",
    tone: "cyber",
    featured: true,
    kind: "campaign",
  },
  {
    slug: "word-search",
    apiType: "word_search",
    i18nKey: "wordSearch",
    zoneIndex: 2,
    zoneTagKey: "community.games.arcade.zone2Tag",
    rewardKey: "community.games.arcade.zoneRewardWordSearch",
    tone: "emerald",
    featured: false,
    kind: "word_search",
  },
  {
    slug: "chess",
    apiType: "chess",
    i18nKey: "chess",
    zoneIndex: 3,
    zoneTagKey: "community.games.arcade.zone3Tag",
    rewardKey: "community.games.arcade.zoneRewardBoard",
    tone: "amber",
    featured: false,
    kind: "board",
  },
  {
    slug: "xiangqi",
    apiType: "xiangqi",
    i18nKey: "xiangqi",
    zoneIndex: 4,
    zoneTagKey: "community.games.arcade.zone4Tag",
    rewardKey: "community.games.arcade.zoneRewardBoard",
    tone: "crimson",
    featured: false,
    kind: "board",
  },
  {
    slug: "go",
    apiType: "go",
    i18nKey: "go",
    zoneIndex: 5,
    zoneTagKey: "community.games.arcade.zone5Tag",
    rewardKey: "community.games.arcade.zoneRewardBoard",
    tone: "sky",
    featured: false,
    kind: "board",
  },
] as const;

const SLUG_SET = new Set<string>(ARCADE_GAMES.map((item) => item.slug));

export function isArcadeGameSlug(value: string | null | undefined): value is ArcadeGameSlug {
  return typeof value === "string" && SLUG_SET.has(value);
}

export function getArcadeGameBySlug(slug: ArcadeGameSlug): ArcadeZoneEntry {
  return ARCADE_GAMES.find((item) => item.slug === slug) ?? ARCADE_GAMES[0];
}

export function getArcadeGameByApiType(apiType: string): ArcadeZoneEntry | undefined {
  return ARCADE_GAMES.find((item) => item.apiType === apiType);
}
