import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import en from "../src/i18n/messages/en.ts";
import ja from "../src/i18n/messages/ja.ts";
import vi from "../src/i18n/messages/vi.ts";
import { selectUpcomingActivities, upcomingDayOffset } from "../src/lib/activities.ts";
import {
  ARCADE_GAMES,
  getArcadeGameByApiType,
  getArcadeGameBySlug,
  isArcadeGameSlug,
} from "../src/lib/games/registry.ts";
import {
  COMMUNITY_CATEGORIES,
  countCommunityPostFilters,
  estimateReadingMinutes,
  extractEditorialArticle,
  extractSourceHost,
  filterCommunityPosts,
  foldSearchText,
  matchesCommunityPostFilter,
  matchesCommunitySearch,
} from "../src/lib/community-filters.ts";

function collectLeafPaths(record, prefix = "") {
  const paths = [];
  for (const [key, value] of Object.entries(record)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      paths.push(...collectLeafPaths(value, next));
    } else {
      assert.equal(typeof value, "string", `${next} must be a string`);
      assert.ok(value.trim().length > 0, `${next} must not be empty`);
      paths.push(next);
    }
  }
  return paths.sort();
}

test("selectUpcomingActivities filters past/non-scheduled items, deduplicates series, and resolves root detailId", () => {
  const now = new Date("2026-11-27T15:00:00+07:00");
  const activities = [
    {
      id: "past-day",
      approved: true,
      title: "Buổi cầu lông tuần trước",
      description: "",
      category: "CẦU LÔNG",
      scheduleType: "scheduled",
      date: "2026-11-20T18:00:00+07:00",
      day: "2026-11-20",
      createdAt: "2026-11-10T00:00:00Z",
      creator: "Admin",
      participants: ["A"],
    },
    {
      id: "past-today",
      approved: true,
      title: "Chạy bộ sáng nay",
      description: "",
      category: "THỂ THAO",
      scheduleType: "scheduled",
      date: "2026-11-27T07:00:00+07:00",
      day: "2026-11-27",
      createdAt: "2026-11-10T00:00:00Z",
      creator: "Admin",
      participants: ["A"],
    },
    {
      id: "poll-future",
      approved: true,
      title: "Khảo sát địa điểm",
      description: "",
      category: "GIẢI TRÍ",
      scheduleType: "poll",
      date: "2026-11-29",
      day: "2026-11-29",
      createdAt: "2026-11-10T00:00:00Z",
      creator: "Admin",
      participants: [],
    },
    {
      id: "unapproved-future",
      approved: false,
      title: "Chờ duyệt",
      description: "",
      category: "THỂ THAO",
      scheduleType: "scheduled",
      date: "2026-11-28T18:00:00+07:00",
      day: "2026-11-28",
      createdAt: "2026-11-10T00:00:00Z",
      creator: "Member",
      participants: [],
    },
    {
      id: "series-root",
      approved: true,
      recurrenceSeriesId: "badminton-weekly",
      title: "Cầu lông thứ Sáu",
      description: "",
      category: "CẦU LÔNG",
      scheduleType: "scheduled",
      date: "2026-11-20T18:30:00+07:00",
      day: "2026-11-20",
      createdAt: "2026-11-01T00:00:00Z",
      creator: "Admin",
      participants: ["A"],
    },
    {
      id: "series-next",
      approved: true,
      recurrenceSeriesId: "badminton-weekly",
      title: "Cầu lông thứ Sáu",
      description: "",
      category: "CẦU LÔNG",
      scheduleType: "scheduled",
      date: "2026-11-27T18:30:00+07:00",
      day: "2026-11-27",
      createdAt: "2026-11-01T00:00:00Z",
      creator: "Admin",
      participants: ["A", "B"],
    },
    {
      id: "series-later",
      approved: true,
      recurrenceSeriesId: "badminton-weekly",
      title: "Cầu lông thứ Sáu",
      description: "",
      category: "CẦU LÔNG",
      scheduleType: "scheduled",
      date: "2026-12-04T18:30:00+07:00",
      day: "2026-12-04",
      createdAt: "2026-11-01T00:00:00Z",
      creator: "Admin",
      participants: [],
    },
    {
      id: "charity-walk",
      approved: true,
      title: "Đi bộ gây quỹ mùa đông",
      description: "",
      location: "Công viên Gia Định",
      category: "TỪ THIỆN",
      scheduleType: "scheduled",
      date: "2026-11-29",
      day: "2026-11-29",
      createdAt: "2026-11-15T00:00:00Z",
      creator: "Admin",
      participants: ["A", "B", "C"],
    },
  ];

  const picked = selectUpcomingActivities(activities, now, 3);
  assert.equal(picked.length, 2);
  assert.equal(picked[0].activity.id, "series-next");
  assert.equal(picked[0].detailId, "series-root");
  assert.equal(picked[0].day, "2026-11-27");
  assert.equal(picked[1].activity.id, "charity-walk");
  assert.equal(picked[1].detailId, "charity-walk");
  assert.equal(picked[1].day, "2026-11-29");
});

test("upcomingDayOffset computes calendar day offset accurately", () => {
  const now = new Date(2026, 10, 27, 23, 30, 0);
  assert.equal(upcomingDayOffset("2026-11-27", now), 0);
  assert.equal(upcomingDayOffset("2026-11-28", now), 1);
  assert.equal(upcomingDayOffset("2026-12-04", now), 7);
  assert.equal(upcomingDayOffset("2026-11-26", now), -1);
  assert.equal(upcomingDayOffset("invalid", now), -1);
});

test("community categories cover all six required sections and filter/search without mutating input", () => {
  assert.deepEqual(COMMUNITY_CATEGORIES, [
    "culture",
    "society",
    "entertainment",
    "lifestyle",
    "sports",
    "technology",
  ]);

  const posts = [
    {
      id: "p1",
      author: { id: "u1", displayName: "Minh" },
      content: "Tối nay giao lưu cầu lông tại sân Phú Thọ nhé mọi người!",
      category: "sports",
      imageUrl: null,
      imageUrls: [],
      linkPreview: null,
      likeCount: 1,
      commentCount: 0,
      createdAt: "2026-11-27T12:00:00Z",
    },
    {
      id: "p2",
      author: { id: "ai", displayName: "braveActive AI" },
      content: "Mô hình suy luận thế hệ mới\n\nOpenAI công bố cải tiến về tốc độ xử lý tác vụ lập trình.",
      category: "technology",
      imageUrl: null,
      imageUrls: [],
      linkPreview: {
        url: "https://techcrunch.com/ai",
        title: "OpenAI reasoning update",
        description: "Developer tooling news",
        site: "techcrunch.com",
      },
      likeCount: 3,
      commentCount: 1,
      createdAt: "2026-11-27T11:00:00Z",
    },
    {
      id: "p3",
      author: { id: "u2", displayName: "Lan" },
      content: "Triển lãm di sản văn hoá Việt Nam cuối tuần này rất đáng xem.",
      category: "culture",
      imageUrl: "/media/photo1.jpg",
      imageUrls: ["/media/photo1.jpg"],
      linkPreview: null,
      likeCount: 2,
      commentCount: 3,
      createdAt: "2026-11-27T10:00:00Z",
    },
  ];

  assert.deepEqual(countCommunityPostFilters(posts), {
    all: 3,
    culture: 1,
    society: 0,
    entertainment: 0,
    lifestyle: 0,
    sports: 1,
    technology: 1,
  });

  assert.equal(foldSearchText("Văn hoá Đời sống"), "van hoa doi song");
  assert.equal(matchesCommunitySearch(posts[0], "cau long"), true);
  assert.equal(matchesCommunitySearch(posts[0], "cầu lông"), true);
  assert.equal(matchesCommunitySearch(posts[1], "techcrunch"), true);
  assert.equal(matchesCommunitySearch(posts[2], "Lan di san"), true);
  assert.equal(matchesCommunityPostFilter(posts[1], "technology", "openai"), true);
  assert.equal(matchesCommunityPostFilter(posts[1], "sports", "openai"), false);

  assert.deepEqual(
    filterCommunityPosts(posts, "all", "cau long").map((post) => post.id),
    ["p1"],
  );
  assert.deepEqual(
    filterCommunityPosts(posts, "culture").map((post) => post.id),
    ["p3"],
  );
  assert.deepEqual(
    posts.map((post) => post.id),
    ["p1", "p2", "p3"],
  );
});

test("extractEditorialArticle separates news headlines from casual SNS statuses", () => {
  const aiArticle = extractEditorialArticle(
    "OpenAI ra mắt mô hình suy luận thế hệ mới\n\nBản cập nhật tập trung vào tốc độ phản hồi và độ chính xác khi xử lý tác vụ phức tạp.",
    true,
  );
  assert.equal(aiArticle.headline, "OpenAI ra mắt mô hình suy luận thế hệ mới");
  assert.equal(
    aiArticle.body,
    "Bản cập nhật tập trung vào tốc độ phản hồi và độ chính xác khi xử lý tác vụ phức tạp.",
  );

  const casualSns = extractEditorialArticle("Tối nay sân cầu lông Phú Thọ còn trống 2 slot nhé anh em!", false);
  assert.equal(casualSns.headline, null);
  assert.equal(casualSns.body, "Tối nay sân cầu lông Phú Thọ còn trống 2 slot nhé anh em!");

  const shortTwoLiner = extractEditorialArticle("Chào buổi sáng!\n\nHẹn gặp mọi người tối nay.", false);
  assert.equal(shortTwoLiner.headline, null);

  assert.equal(estimateReadingMinutes("word ".repeat(420)), 2);
  assert.equal(extractSourceHost(null, "https://www.vnexpress.net/suc-khoe/bai-viet.html"), "vnexpress.net");
});

test("community translations stay synchronized across vi, en and ja", () => {
  const viKeys = collectLeafPaths(vi);
  const enKeys = collectLeafPaths(en);
  const jaKeys = collectLeafPaths(ja);
  assert.deepEqual(enKeys, viKeys);
  assert.deepEqual(jaKeys, viKeys);
});

test("community, activities, training and admin share the Editorial Folio design system and modern web semantics", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const postCardTsx = readFileSync(
    new URL("../src/components/community/post-card.tsx", import.meta.url),
    "utf8",
  );
  const communityPageTsx = readFileSync(
    new URL("../src/components/community/community-page.tsx", import.meta.url),
    "utf8",
  );
  const composerTsx = readFileSync(
    new URL("../src/components/community/post-composer.tsx", import.meta.url),
    "utf8",
  );
  const activityCalendarTsx = readFileSync(
    new URL("../src/components/club/activity-calendar.tsx", import.meta.url),
    "utf8",
  );
  const trainingLibraryTsx = readFileSync(
    new URL("../src/components/training/training-library.tsx", import.meta.url),
    "utf8",
  );
  const adminPageTsx = readFileSync(
    new URL("../src/components/admin/admin-page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(css, /\.post-rubric-source/);
  assert.doesNotMatch(postCardTsx, /post-rubric-source/);
  assert.match(postCardTsx, /post-category-tag/);
  assert.match(communityPageTsx, /<search className="community-discovery"/);
  assert.match(activityCalendarTsx, /<search className="community-discovery activities-discovery"/);
  assert.match(trainingLibraryTsx, /<search className="community-discovery training-discovery"/);
  assert.match(adminPageTsx, /role="tablist"/);
  assert.match(adminPageTsx, /role="tabpanel"/);

  assert.doesNotMatch(css, /\.community-side-rail\s*\{[^}]*order:\s*-1/);
  assert.doesNotMatch(css, /\.event-detail-sidebar\s*\{[^}]*order:\s*-1/);
  assert.match(css, /\.editorial-folio-masthead\s*\{[^}]*border-block-end:\s*3px double/);
  assert.match(css, /\.admin-tab-btn\[aria-selected="true"\]::after\s*\{[^}]*border-block-end:/);
  assert.match(css, /\.training-dialog::backdrop\s*\{[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*contain/);
  assert.match(css, /\.admin-ai-dialog::backdrop\s*\{[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*contain/);
  assert.match(css, /Newsreader/);
  assert.match(css, /--font-editorial:\s*"Newsreader"/);
  assert.match(css, /--cat-culture:/);
  assert.match(css, /--cat-technology:/);
  assert.match(css, /\.post-category-tag\s*\{/);
  assert.match(css, /\.community-search-input\s*\{\s*font-size:\s*1rem;\s*\}/);
  assert.match(css, /\.link-preview\s*\{[^}]*container:\s*link-card\s*\/\s*inline-size/);
  assert.match(css, /@container\s+link-card\s*\(inline-size\s*>\s*30rem\)/);
  assert.match(css, /\.link-preview-link:has\(>\s*\.link-preview-image-frame\)/);
  assert.match(css, /color-mix\(in oklab,/);
  assert.match(css, /\.community-section-strip\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.community-section-tab\[aria-pressed="true"\]::after\s*\{[^}]*border-block-end:/);
  assert.match(css, /\.post-image-dialog::backdrop\s*\{[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*contain/);
  assert.match(css, /\.community-games-dialog::backdrop\s*\{[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*contain/);
  assert.doesNotMatch(postCardTsx, /document\.body\.style\.overflow/);
  assert.doesNotMatch(composerTsx, /composer-prompts/);
});

test("workday movement feature ('Vận động') provides trilingual labels, guided routines, break timer, and /movement alias", () => {
  assert.equal(vi.nav.training, "Vận động");
  assert.equal(en.nav.training, "Movement");
  assert.equal(ja.nav.training, "リフレッシュ");

  for (const dict of [vi, en, ja]) {
    assert.ok(dict.training.randomBreak);
    assert.ok(dict.training.routines.neckFocus.title);
    assert.ok(dict.training.routines.wristFocus.title);
    assert.ok(dict.training.routines.afternoonBoost.title);
    assert.ok(dict.training.timer.start);
    assert.ok(dict.training.timer.done);
    assert.ok(dict.training.timer.nextMovement);
    assert.ok(dict.training.timer.finishRoutine);
  }

  const siteChromeTsx = readFileSync(
    new URL("../src/components/layout/site-chrome.tsx", import.meta.url),
    "utf8",
  );
  const trainingLibraryTsx = readFileSync(
    new URL("../src/components/training/training-library.tsx", import.meta.url),
    "utf8",
  );
  const exerciseAnimationTsx = readFileSync(
    new URL("../src/components/training/exercise-animation.tsx", import.meta.url),
    "utf8",
  );
  const movementPageTsx = readFileSync(
    new URL("../src/app/movement/page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(siteChromeTsx, /Dumbbell/);
  assert.doesNotMatch(trainingLibraryTsx, /Dumbbell/);
  assert.match(trainingLibraryTsx, /WORKDAY_ROUTINES/);
  assert.match(trainingLibraryTsx, /openRandomOneMinuteBreak/);
  assert.match(exerciseAnimationTsx, /training-timer-card/);
  assert.match(exerciseAnimationTsx, /training-routine-strip/);
  assert.match(movementPageTsx, /<TrainingLibrary \/>/);
});

test("unified Arcade Hub, Profile v3, Admin moderation notifications, and Post Likers dialog are wired cleanly", () => {
  assert.equal(ARCADE_GAMES.length, 7);
  assert.deepEqual(
    ARCADE_GAMES.map((g) => g.slug),
    ["dev-vs-ai", "word-search", "chess", "xiangqi", "go", "caro", "sudoku"],
  );
  assert.equal(isArcadeGameSlug("dev-vs-ai"), true);
  assert.equal(isArcadeGameSlug("caro"), true);
  assert.equal(isArcadeGameSlug("sudoku"), true);
  assert.equal(isArcadeGameSlug("unknown"), false);
  assert.equal(getArcadeGameBySlug("chess").apiType, "chess");
  assert.equal(getArcadeGameBySlug("caro").apiType, "caro");
  assert.equal(getArcadeGameBySlug("sudoku").apiType, "sudoku");
  assert.equal(getArcadeGameByApiType("dev_vs_ai")?.slug, "dev-vs-ai");

  const arcadeHubTsx = readFileSync(
    new URL("../src/components/games/arcade-hub.tsx", import.meta.url),
    "utf8",
  );
  const achievementsTsx = readFileSync(
    new URL("../src/components/games/arcade-achievements-view.tsx", import.meta.url),
    "utf8",
  );
  const profileTsx = readFileSync(
    new URL("../src/components/auth/profile-page.tsx", import.meta.url),
    "utf8",
  );
  const bellTsx = readFileSync(
    new URL("../src/components/layout/notification-bell.tsx", import.meta.url),
    "utf8",
  );
  const adminTsx = readFileSync(
    new URL("../src/components/admin/admin-page.tsx", import.meta.url),
    "utf8",
  );
  const likeButtonTsx = readFileSync(
    new URL("../src/components/community/like-button.tsx", import.meta.url),
    "utf8",
  );
  const likersDialogTsx = readFileSync(
    new URL("../src/components/community/post-likers-dialog.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(arcadeHubTsx, /GameZoneIllustration/);
  assert.match(arcadeHubTsx, /ArcadeAchievementsView/);
  assert.match(arcadeHubTsx, /SudokuArena/);
  assert.match(achievementsTsx, /role="region"/);
  assert.match(achievementsTsx, /arcade-ranking-table/);
  assert.match(css, /@container\s*\(width < 520px\)/);
  assert.match(css, /\.board-game-caro/);
  assert.match(css, /\.sudoku-grid/);

  const illustrationTsx = readFileSync(
    new URL("../src/components/games/illustrations/game-zone-illustration.tsx", import.meta.url),
    "utf8",
  );
  const sudokuArenaTsx = readFileSync(
    new URL("../src/components/games/boards/sudoku-arena.tsx", import.meta.url),
    "utf8",
  );
  assert.match(illustrationTsx, /function CaroScene/);
  assert.match(illustrationTsx, /function SudokuScene/);
  assert.match(sudokuArenaTsx, /communityApi\.startSudoku/);
  assert.match(sudokuArenaTsx, /communityApi\.syncSudoku/);

  assert.match(profileTsx, /profile-page-v3/);
  assert.match(profileTsx, /<dialog[\s\S]*className="avatar-crop-dialog"/);
  assert.match(css, /\.avatar-crop-dialog::backdrop\s*\{[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*contain/);

  assert.match(bellTsx, /\/admin\?tab=requests/);
  assert.match(bellTsx, /\/admin\?tab=posts/);
  assert.match(bellTsx, /\/admin\?tab=activities/);
  assert.match(adminTsx, /searchParams\.get\("tab"\)/);

  assert.match(likeButtonTsx, /post-like-count-btn/);
  assert.match(likersDialogTsx, /className="post-likers-dialog"/);
  assert.match(css, /\.post-likers-dialog::backdrop\s*\{[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*contain/);

  const shareSlackTsx = readFileSync(
    new URL("../src/components/community/post-share-slack-dialog.tsx", import.meta.url),
    "utf8",
  );
  assert.match(shareSlackTsx, /className="post-share-slack-dialog"/);
  assert.match(shareSlackTsx, /sharePostToSlack/);
  assert.match(css, /\.post-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.post-share-slack-dialog::backdrop\s*\{[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*contain/);
});
