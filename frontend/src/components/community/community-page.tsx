"use client";

import {
  Activity,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Gamepad2,
  Layers,
  Loader2,
  type LucideIcon,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useI18n } from "@/i18n/i18n-provider";
import { selectUpcomingActivities, upcomingDayOffset, type ClubActivity } from "@/lib/activities";
import { apiJson } from "@/lib/api/client";
import {
  COMMUNITY_CATEGORIES,
  communityApi,
  type GameStatus,
  type PostCategory,
} from "@/lib/api/community";
import {
  matchesCommunityPostFilter,
  type CommunityFeedFilter,
} from "@/lib/community-filters";
import { useCommunityFeed } from "@/lib/use-community-feed";
import { GuestPrompt } from "./guest-prompt";
import { POST_CATEGORY_ICONS } from "./post-card";
import { PostComposer } from "./post-composer";
import { PostList } from "./post-list";
import { CommunitySideRail } from "./community-side-rail";

const SEARCH_DEBOUNCE_MS = 280;

/** Community screen: broadsheet folio, SNS composer, search + 6-category discovery bar, and hybrid news/SNS feed. */
export function CommunityPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, intlLocale } = useI18n();
  const searchInputId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [activeFilter, setActiveFilter] = useState<CommunityFeedFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === debouncedQuery) return;
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, trimmed ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [searchInput, debouncedQuery]);

  // Allow pressing "/" anywhere outside text inputs to jump straight into Community search.
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.isComposing
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchInputRef.current?.focus();
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  const feed = useCommunityFeed({
    category: activeFilter,
    query: debouncedQuery,
  });

  useEffect(() => {
    let active = true;
    void apiJson<{ activities?: ClubActivity[] }>("/api/activities", { cache: "no-store" })
      .then((result) => {
        if (active) setActivities(result.activities ?? []);
      })
      .catch(() => {
        if (active) setActivities([]);
      })
      .finally(() => {
        if (active) setActivitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setGameStatus(null);
      return;
    }
    let active = true;
    void communityApi
      .getGameStatus()
      .then((status) => {
        if (active) setGameStatus(status);
      })
      .catch(() => {
        if (active) setGameStatus(null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [intlLocale],
  );

  const nextUpcoming = useMemo(() => selectUpcomingActivities(activities, new Date(), 1)[0] ?? null, [activities]);
  const nextUpcomingDateLabel = useMemo(() => {
    if (!nextUpcoming) return "";
    const offset = upcomingDayOffset(nextUpcoming.day);
    if (offset === 0) return t("community.sideRail.todayBadge");
    if (offset === 1) return t("community.sideRail.tomorrowBadge");
    return new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(
      new Date(`${nextUpcoming.day}T00:00:00`),
    );
  }, [intlLocale, nextUpcoming, t]);

  const sectionTabs = useMemo<{ id: CommunityFeedFilter; label: string; icon: LucideIcon }[]>(
    () => [
      { id: "all", label: t("community.filters.all"), icon: Layers },
      ...COMMUNITY_CATEGORIES.map((category) => ({
        id: category,
        label: t(`community.categories.${category}`),
        icon: POST_CATEGORY_ICONS[category],
      })),
    ],
    [t],
  );

  const handleSelectCategory = useCallback((category: PostCategory) => {
    setActiveFilter((current) => (current === category ? "all" : category));
  }, []);

  const handleResetAll = useCallback(() => {
    setActiveFilter("all");
    setSearchInput("");
    setDebouncedQuery("");
  }, []);

  const isSearchPending = searchInput.trim() !== debouncedQuery || (feed.loading && Boolean(debouncedQuery));
  const hasActiveDiscovery = activeFilter !== "all" || debouncedQuery.length > 0;

  return (
    <section className="community-layout">
      <div className="community">
        <header className="community-masthead">
          <div className="community-dateline-row">
            <div className="community-dateline">
              <span className="community-edition-tag">{t("community.editorial.kicker")}</span>
              <span className="community-dateline-sep" aria-hidden="true">·</span>
              <time className="community-masthead-date">{todayLabel}</time>
            </div>
            {nextUpcoming ? (
              <Link
                className="community-bulletin-link"
                href={`/activities/${encodeURIComponent(nextUpcoming.detailId)}`}
              >
                <span className="community-bulletin-dot" aria-hidden="true" />
                <span className="community-bulletin-label">{t("community.editorial.nextSessionLabel")}</span>
                <strong className="community-bulletin-title">{nextUpcoming.activity.title}</strong>
                <span className="community-bulletin-date">{nextUpcomingDateLabel}</span>
              </Link>
            ) : null}
          </div>

          <div className="community-folio-row">
            <h1>{t("community.editorial.title")}</h1>
            <p>{t("community.subtitle")}</p>
          </div>

          <nav className="community-mobile-strip" aria-label={t("community.editorial.mobileQuickAria")}>
            {nextUpcoming ? (
              <Link
                className="community-quick-pill is-activity"
                href={`/activities/${encodeURIComponent(nextUpcoming.detailId)}`}
              >
                <CalendarClock size={15} aria-hidden="true" />
                <span className="community-quick-pill-text">{nextUpcoming.activity.title}</span>
                <span className="community-quick-pill-meta">{nextUpcomingDateLabel}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            ) : (
              <Link className="community-quick-pill is-activity" href="/activities">
                <CalendarDays size={15} aria-hidden="true" />
                <span className="community-quick-pill-text">{t("nav.activities")}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            )}
            <Link className="community-quick-pill is-training" href="/training">
              <Activity size={15} aria-hidden="true" />
              <span className="community-quick-pill-text">{t("nav.training")}</span>
            </Link>
            <Link className="community-quick-pill is-games" href="/games">
              <Gamepad2 size={15} aria-hidden="true" />
              <span className="community-quick-pill-text">{t("community.games.tab")}</span>
              {gameStatus && gameStatus.streakDays > 0 ? (
                <span className="community-quick-pill-meta is-streak">
                  {t("community.sideRail.streakActive", { count: gameStatus.streakDays })}
                </span>
              ) : null}
            </Link>
          </nav>
        </header>

        <div className="community-control-deck">
          {authLoading ? null : user ? (
            <PostComposer
              displayName={user.displayName}
              avatarUrl={user.avatarUrl}
              onPosted={(post) => {
                if (!matchesCommunityPostFilter(post, activeFilter, debouncedQuery)) {
                  handleResetAll();
                }
                feed.addLocalPost(post);
              }}
            />
          ) : (
            <GuestPrompt />
          )}

          <search className="community-discovery" aria-label={t("community.search.landmarkAria")}>
            <form
              className="community-search-form"
              onSubmit={(event) => {
                event.preventDefault();
                setDebouncedQuery(searchInput.trim());
              }}
            >
              <label htmlFor={searchInputId} className="community-sr-only">
                {t("community.search.label")}
              </label>
              <span className="community-search-icon" aria-hidden="true">
                {isSearchPending ? <Loader2 size={16} className="ui-spin" /> : <Search size={16} />}
              </span>
              <input
                ref={searchInputRef}
                id={searchInputId}
                className="community-search-input"
                type="search"
                name="q"
                value={searchInput}
                maxLength={120}
                placeholder={t("community.search.placeholder")}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                  if (event.key === "Escape" && searchInput) {
                    event.preventDefault();
                    setSearchInput("");
                    setDebouncedQuery("");
                  }
                }}
              />
              {searchInput ? (
                <button
                  type="button"
                  className="community-search-clear"
                  aria-label={t("community.search.clear")}
                  onClick={() => {
                    setSearchInput("");
                    setDebouncedQuery("");
                    searchInputRef.current?.focus();
                  }}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              ) : (
                <kbd className="community-search-kbd" aria-hidden="true">/</kbd>
              )}
            </form>

            <div className="community-section-strip" role="group" aria-label={t("community.filters.ariaLabel")}>
              {sectionTabs.map(({ id, label, icon: TabIcon }) => {
                const selected = activeFilter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`community-section-tab is-${id}${selected ? " is-active" : ""}`}
                    aria-pressed={selected}
                    onClick={() => setActiveFilter(id)}
                  >
                    <TabIcon size={14} className="community-section-tab-icon" aria-hidden="true" />
                    <span className="community-section-tab-label">{label}</span>
                  </button>
                );
              })}
            </div>

            {hasActiveDiscovery && (feed.posts.length > 0 || feed.loading) ? (
              <div className="community-active-filter-bar" aria-live="polite">
                <div className="community-active-filter-pills">
                  {activeFilter !== "all" ? (
                    <span className={`community-active-pill is-${activeFilter}`}>
                      {t("community.search.activeCategory", {
                        category: t(`community.categories.${activeFilter}`),
                      })}
                    </span>
                  ) : null}
                  {debouncedQuery ? (
                    <span className="community-active-pill is-query">
                      {t("community.search.activeQuery", { query: debouncedQuery })}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="community-filter-reset-inline"
                  onClick={handleResetAll}
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>{t("community.search.clearAll")}</span>
                </button>
              </div>
            ) : null}
          </search>
        </div>

        <PostList
          posts={feed.posts}
          activeFilter={activeFilter}
          searchQuery={debouncedQuery}
          loading={feed.loading}
          error={feed.error}
          hasMore={feed.hasMore}
          viewerId={user?.id ?? null}
          isAdmin={user?.role === "admin"}
          onLoadMore={feed.loadMore}
          onResetFilter={handleResetAll}
          onSelectCategory={handleSelectCategory}
          onPatch={feed.patchPost}
          onRemove={feed.removePost}
        />
      </div>
      <CommunitySideRail
        activities={activities}
        loading={activitiesLoading}
        streakDays={gameStatus?.streakDays ?? null}
      />
    </section>
  );
}
