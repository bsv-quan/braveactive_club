"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Crown,
  Flame,
  Map as MapIcon,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ArcadeAchievementsView } from "@/components/games/arcade-achievements-view";
import { BoardGameArena } from "@/components/games/boards/board-game-arena";
import { SudokuArena } from "@/components/games/boards/sudoku-arena";
import { WordSearchArena } from "@/components/games/boards/word-search-arena";
import { DevVsAiShell } from "@/components/games/dev-vs-ai/dev-vs-ai-shell";
import { GameGuideDialog } from "@/components/games/game-guide-dialog";
import { GameZoneIllustration } from "@/components/games/illustrations/game-zone-illustration";
import { AppShell } from "@/components/layout/app-shell";
import { useDialog } from "@/components/ui/confirm-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useI18n } from "@/i18n/i18n-provider";
import {
  communityApi,
  type BoardGameApiType,
  type GameAchievements,
  type GameDifficulty,
  type GameLeaderboard,
  type GameLeaderboardPeriod,
  type GameStatus,
} from "@/lib/api/community";
import {
  loadGuestStreak,
  recordGuestRoundAttendance,
  type GuestStreakState,
} from "@/lib/games/guest-progress";
import {
  ARCADE_GAMES,
  getArcadeGameBySlug,
  isArcadeGameSlug,
  type ArcadeGameSlug,
} from "@/lib/games/registry";

export type ArcadeHubMode = "lobby" | "achievements" | "play";

type ArcadeHubProps = {
  initialGame?: ArcadeGameSlug | null;
  initialMode?: "lobby" | "achievements";
};

export function ArcadeHub({ initialGame = null, initialMode = "lobby" }: ArcadeHubProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { confirm } = useDialog();

  const [mode, setMode] = useState<ArcadeHubMode>(initialGame ? "play" : initialMode);
  const [activeSlug, setActiveSlug] = useState<ArcadeGameSlug>(initialGame ?? "dev-vs-ai");
  const [gameInProgress, setGameInProgress] = useState(false);
  const [difficulty, setDifficulty] = useState<GameDifficulty>("medium");
  const [roundScore, setRoundScore] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);

  const [status, setStatus] = useState<GameStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [achievements, setAchievements] = useState<GameAchievements | null>(null);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [guestStreak, setGuestStreak] = useState<GuestStreakState | null>(null);
  const [guestStreakError, setGuestStreakError] = useState(false);

  const [sidePeriod, setSidePeriod] = useState<GameLeaderboardPeriod>("week");
  const [sideLeaderboard, setSideLeaderboard] = useState<GameLeaderboard | null>(null);
  const [sideLeaderboardLoading, setSideLeaderboardLoading] = useState(true);
  const [sideLeaderboardError, setSideLeaderboardError] = useState(false);
  const [weeklyAllTop, setWeeklyAllTop] = useState<GameLeaderboard | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const tabRefs = useRef<Record<"lobby" | "achievements", HTMLButtonElement | null>>({
    lobby: null,
    achievements: null,
  });

  // Sync URL query `?tab=achievements` or `?play=<slug>` on initial mount when on `/games`
  useEffect(() => {
    if (initialGame) return;
    const params = new URLSearchParams(window.location.search);
    const playParam = params.get("play");
    const tabParam = params.get("tab");
    if (isArcadeGameSlug(playParam)) {
      setActiveSlug(playParam);
      setMode("play");
    } else if (tabParam === "achievements") {
      setMode("achievements");
    }
  }, [initialGame]);

  const syncBrowserUrl = useCallback((nextMode: ArcadeHubMode, nextSlug?: ArcadeGameSlug) => {
    if (typeof window === "undefined") return;
    const targetUrl =
      nextMode === "play" && nextSlug
        ? `/games/${nextSlug}`
        : nextMode === "achievements"
          ? "/games?tab=achievements"
          : "/games";
    if (window.location.pathname + window.location.search !== targetUrl) {
      window.history.pushState(null, "", targetUrl);
    }
  }, []);

  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const slugMatch = path.match(/^\/games\/([^/?#]+)/);
      if (slugMatch && isArcadeGameSlug(slugMatch[1])) {
        setActiveSlug(slugMatch[1]);
        setMode("play");
        return;
      }
      const playParam = params.get("play");
      if (isArcadeGameSlug(playParam)) {
        setActiveSlug(playParam);
        setMode("play");
        return;
      }
      if (params.get("tab") === "achievements") {
        setMode("achievements");
        return;
      }
      setMode("lobby");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const refreshMemberData = useCallback(async () => {
    setAchievementsLoading(true);
    try {
      const [achData, statusData] = await Promise.all([
        communityApi.getGameAchievements(),
        user ? communityApi.getGameStatus() : Promise.resolve(null),
      ]);
      setAchievements(achData);
      if (statusData) {
        setStatus(statusData);
        setStatusError(false);
      }
    } catch {
      if (user) setStatusError(true);
    } finally {
      setAchievementsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshMemberData();
    if (!user) {
      const loaded = loadGuestStreak();
      setGuestStreak(loaded.status);
      setGuestStreakError(loaded.error);
    }
  }, [user, refreshMemberData, refreshToken]);

  // Fetch Weekly All-Games Top preview for the Lobby
  useEffect(() => {
    let active = true;
    communityApi
      .getGameLeaderboard("week", "all")
      .then((res) => {
        if (active) setWeeklyAllTop(res);
      })
      .catch(() => {
        if (active) setWeeklyAllTop(null);
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

  const activeZone = getArcadeGameBySlug(activeSlug);

  // Fetch live side-rail leaderboard while inside Play mode
  useEffect(() => {
    if (mode !== "play" || activeZone.slug === "dev-vs-ai") return;
    let active = true;
    setSideLeaderboardLoading(true);
    setSideLeaderboardError(false);
    communityApi
      .getGameLeaderboard(sidePeriod, activeZone.apiType)
      .then((res) => {
        if (active) setSideLeaderboard(res);
      })
      .catch(() => {
        if (active) setSideLeaderboardError(true);
      })
      .finally(() => {
        if (active) setSideLeaderboardLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, activeZone.slug, activeZone.apiType, sidePeriod, refreshToken]);

  const handleRoundCompleted = useCallback(() => {
    if (!user) {
      const updated = recordGuestRoundAttendance();
      setGuestStreak(updated.status);
      setGuestStreakError(updated.error);
    }
    setRefreshToken((prev) => prev + 1);
  }, [user]);

  const guardActiveRoundTransition = useCallback(
    async (proceed: () => void) => {
      if (!gameInProgress) {
        proceed();
        return;
      }
      const ok = await confirm({
        title: t("community.games.switchConfirmTitle"),
        message: t("community.games.switchConfirmMessage"),
        confirmLabel: t("community.games.switchConfirmAction"),
        tone: "danger",
      });
      if (!ok) return;
      if (user && activeZone.kind === "board") {
        try {
          await communityApi.abandonActiveBoardGame(activeZone.apiType as BoardGameApiType);
        } catch {
          // Proceed even if abandoning server round fails.
        }
      }
      setGameInProgress(false);
      proceed();
    },
    [gameInProgress, confirm, t, user, activeZone.kind, activeZone.apiType],
  );

  const openZone = useCallback(
    (slug: ArcadeGameSlug) => {
      if (mode === "play" && slug === activeSlug) return;
      void guardActiveRoundTransition(() => {
        setActiveSlug(slug);
        setRoundScore(0);
        setMode("play");
        syncBrowserUrl("play", slug);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    },
    [mode, activeSlug, guardActiveRoundTransition, syncBrowserUrl],
  );

  const switchHubTab = useCallback(
    (nextTab: "lobby" | "achievements") => {
      if (mode === nextTab) return;
      void guardActiveRoundTransition(() => {
        setMode(nextTab);
        syncBrowserUrl(nextTab);
      });
    },
    [mode, guardActiveRoundTransition, syncBrowserUrl],
  );

  const sharedPoints = status?.totalPoints ?? status?.wordSearchPoints ?? achievements?.me?.totalPoints ?? 0;
  const activeStreakDays = user ? (status?.streakDays ?? achievements?.me?.streakDays ?? 0) : (guestStreak?.streakDays ?? 0);
  const playedToday = user ? Boolean(status?.playedToday ?? achievements?.me?.playedToday) : Boolean(guestStreak?.playedToday);

  const perGameStats = new Map(
    (achievements?.me?.perGame ?? []).map((item) => [item.gameType, item]),
  );

  const featuredZone = ARCADE_GAMES[0];
  const secondaryZones = ARCADE_GAMES.slice(1);
  const featuredStats = perGameStats.get(featuredZone.apiType);

  return (
    <AppShell currentPage="games">
      <div className="arcade-hub-page">
        {/* Unified Editorial × Arcade Meta-Masthead */}
        <header className="editorial-folio-masthead arcade-masthead">
          <div className="editorial-folio-top">
            <div className="community-dateline">
              <span className="community-edition-tag">{t("community.games.arcade.kicker")}</span>
              {user && achievements?.me ? (
                <span className={`arcade-tier-pill tier-${achievements.me.tier}`}>
                  <Crown size={12} aria-hidden="true" />
                  {t(`community.games.arcade.tiers.${achievements.me.tier}`)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="editorial-folio-main arcade-masthead-main">
            <div className="editorial-folio-copy">
              <h1>{t("community.games.arcade.title")}</h1>
              <p>{t("community.games.arcade.subtitle")}</p>
            </div>

            {/* Shared Points & Streak Meta-HUD */}
            <div className="arcade-shared-hud" role="region" aria-label={t("nav.games")}>
              <div className="arcade-hud-tile is-wallet">
                <span className="arcade-hud-icon" aria-hidden="true">
                  <Sparkles size={17} />
                </span>
                <div>
                  <span className="arcade-hud-label">{t("community.games.arcade.sharedWalletLabel")}</span>
                  <strong>{t("community.games.score.points", { score: sharedPoints })}</strong>
                </div>
              </div>

              <div
                className={`arcade-hud-tile is-streak${playedToday ? " is-checked-in" : ""}`}
                role={statusError || guestStreakError ? "alert" : undefined}
              >
                <span className="arcade-hud-icon" aria-hidden="true">
                  <Flame size={17} />
                </span>
                <div>
                  <span className="arcade-hud-label">{t("community.games.arcade.sharedStreakLabel")}</span>
                  <strong>
                    {t("community.games.arcade.daysUnit", { count: activeStreakDays })}
                  </strong>
                  <small>
                    {playedToday
                      ? t("community.games.arcade.checkedInToday")
                      : t("community.games.arcade.notCheckedInToday")}
                  </small>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Deck: Mode Tabs in Lobby/Achievements OR Active Zone Command Bar in Play */}
        {mode !== "play" ? (
          <div
            className="admin-tabs arcade-mode-tabs"
            role="tablist"
            aria-label={t("nav.games")}
          >
            {(
              [
                { id: "lobby" as const, label: t("community.games.arcade.tabLobby"), Icon: MapIcon },
                {
                  id: "achievements" as const,
                  label: t("community.games.arcade.tabAchievements"),
                  Icon: Trophy,
                },
              ] as const
            ).map(({ id, label, Icon }, idx, arr) => {
              const selected = mode === id;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    tabRefs.current[id] = el;
                  }}
                  id={`arcade-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`admin-tab-btn${selected ? " active" : ""}`}
                  onClick={() => switchHubTab(id)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                    event.preventDefault();
                    const nextIdx =
                      event.key === "ArrowRight"
                        ? (idx + 1) % arr.length
                        : (idx - 1 + arr.length) % arr.length;
                    const nextId = arr[nextIdx].id;
                    switchHubTab(nextId);
                    tabRefs.current[nextId]?.focus();
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="admin-tab-label">{label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="arcade-play-command-bar">
            <button
              type="button"
              className="ui-button ui-button-secondary ui-button-sm"
              onClick={() => switchHubTab("lobby")}
            >
              <ArrowLeft size={15} aria-hidden="true" /> {t("community.games.arcade.backToLobby")}
            </button>

            <nav className="game-switcher-bar arcade-zone-pills" aria-label={t("community.games.chooseGame")}>
              {ARCADE_GAMES.map((zone) => {
                const isActive = zone.slug === activeSlug;
                return (
                  <button
                    key={zone.slug}
                    type="button"
                    className={`game-switcher-pill${isActive ? " active" : ""}`}
                    aria-pressed={isActive}
                    onClick={() => openZone(zone.slug)}
                  >
                    <span className="arcade-pill-zone-num">0{zone.zoneIndex}</span>
                    <span>{t(`community.games.${zone.i18nKey}.title`)}</span>
                  </button>
                );
              })}
            </nav>

            <div className="arcade-play-command-actions">
              <button
                type="button"
                className="ui-button ui-button-ghost ui-button-sm"
                onClick={() => switchHubTab("achievements")}
              >
                <Trophy size={15} aria-hidden="true" />
                <span>{t("community.games.arcade.tabAchievements")}</span>
              </button>
              <button
                type="button"
                className="ui-button ui-button-secondary ui-button-sm"
                onClick={() => setGuideOpen(true)}
              >
                <CircleHelp size={15} aria-hidden="true" />
                <span>{t("community.games.guide.open")}</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 1: 5-Zone Illustrated World Selector ("1 trò chơi lớn với nhiều trò chơi nhỏ") */}
        {mode === "lobby" ? (
          <div
            role="tabpanel"
            aria-labelledby="arcade-tab-lobby"
            className="arcade-lobby-panel"
          >
            {/* Flagship Featured Zone 01 (Dev vs AI) */}
            <article className={`arcade-featured-zone tone-${featuredZone.tone}`}>
              <div
                className="arcade-featured-art"
                onClick={() => openZone(featuredZone.slug)}
                role="presentation"
              >
                <GameZoneIllustration slug={featuredZone.slug} />
              </div>

              <div className="arcade-featured-content">
                <div className="arcade-zone-meta-row">
                  <span className="arcade-zone-tag">{t(featuredZone.zoneTagKey)}</span>
                  <span className="arcade-zone-reward">{t(featuredZone.rewardKey)}</span>
                </div>

                <h2>{t(`community.games.${featuredZone.i18nKey}.title`)}</h2>
                <p>{t(`community.games.${featuredZone.i18nKey}.description`)}</p>

                <div className="arcade-zone-footer">
                  <span className="arcade-zone-progress-pill">
                    {user && featuredStats && featuredStats.roundsPlayed > 0
                      ? t("community.games.arcade.zoneStatsPlayed", {
                          rounds: featuredStats.roundsPlayed,
                          points: featuredStats.totalScore,
                        })
                      : t("community.games.arcade.zoneStatsFresh")}
                  </span>

                  <button
                    type="button"
                    className="ui-button ui-button-primary arcade-enter-btn"
                    onClick={() => openZone(featuredZone.slug)}
                  >
                    {t("community.games.arcade.enterZone")}{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>

            {/* Zones 02–05 Illustrated Bento Grid */}
            <div className="arcade-zones-bento">
              {secondaryZones.map((zone) => {
                const zStat = perGameStats.get(zone.apiType);
                return (
                  <article key={zone.slug} className={`arcade-zone-card tone-${zone.tone}`}>
                    <div
                      className="arcade-zone-art-wrap"
                      onClick={() => openZone(zone.slug)}
                      role="presentation"
                    >
                      <GameZoneIllustration slug={zone.slug} />
                    </div>

                    <div className="arcade-zone-body">
                      <div className="arcade-zone-meta-row">
                        <span className="arcade-zone-tag">{t(zone.zoneTagKey)}</span>
                        <span className="arcade-zone-reward">{t(zone.rewardKey)}</span>
                      </div>

                      <h3>{t(`community.games.${zone.i18nKey}.title`)}</h3>
                      <p>{t(`community.games.${zone.i18nKey}.description`)}</p>

                      <footer className="arcade-zone-footer">
                        <span className="arcade-zone-progress-pill">
                          {user && zStat && zStat.roundsPlayed > 0
                            ? t("community.games.arcade.zoneStatsPlayed", {
                                rounds: zStat.roundsPlayed,
                                points: zStat.totalScore,
                              })
                            : t("community.games.arcade.zoneStatsFresh")}
                        </span>

                        <button
                          type="button"
                          className="arcade-zone-cta-btn"
                          onClick={() => openZone(zone.slug)}
                        >
                          {t("community.games.arcade.enterZone")}{" "}
                          <ArrowRight size={15} aria-hidden="true" />
                        </button>
                      </footer>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Live Club Top Scores Preview Strip */}
            <section className="arcade-lobby-hall-preview" aria-labelledby="arcade-lobby-top-heading">
              <div className="arcade-lobby-hall-head">
                <h2 id="arcade-lobby-top-heading">
                  <Trophy size={18} aria-hidden="true" />{" "}
                  {t("community.games.arcade.topClubHeading")}
                </h2>
                <button
                  type="button"
                  className="community-panel-link arcade-link-btn"
                  onClick={() => switchHubTab("achievements")}
                >
                  {t("community.games.arcade.viewFullLeaderboard")}{" "}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>

              {weeklyAllTop && weeklyAllTop.entries.length > 0 ? (
                <ol className="arcade-mini-top-list">
                  {weeklyAllTop.entries.slice(0, 5).map((entry) => (
                    <li
                      key={entry.userId}
                      className={user?.id === entry.userId ? "is-self" : undefined}
                    >
                      <span
                        className={`community-games-leaderboard-rank${
                          entry.rank <= 3 ? ` rank-${entry.rank}` : ""
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <UserAvatar
                        name={entry.displayName}
                        avatarUrl={entry.avatarUrl ?? null}
                        size={28}
                      />
                      <strong>{entry.displayName}</strong>
                      <span className="arcade-mini-top-pts">
                        {t("community.games.score.points", { score: entry.score })}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="community-games-leaderboard-state">
                  {t("community.games.score.empty")}
                </p>
              )}
            </section>
          </div>
        ) : null}

        {/* VIEW 2: Personal Achievements & All-Members Leaderboard */}
        {mode === "achievements" ? (
          <div role="tabpanel" aria-labelledby="arcade-tab-achievements">
            <ArcadeAchievementsView
              achievements={achievements}
              achievementsLoading={achievementsLoading}
              isMember={Boolean(user)}
              currentUserId={user?.id ?? null}
              guestStreak={guestStreak}
              refreshToken={refreshToken}
              onSelectZone={openZone}
            />
          </div>
        ) : null}

        {/* VIEW 3: Unified Mini-Game Play Stage */}
        {mode === "play" ? (
          <div className="arcade-play-stage">
            {activeZone.slug === "dev-vs-ai" ? (
              <DevVsAiShell
                embedded
                isMember={Boolean(user)}
                onActiveChange={setGameInProgress}
                onRoundCompleted={() => handleRoundCompleted()}
              />
            ) : (
              <div className="game-screen-layout">
                <section className="game-screen-play-area">
                  {activeZone.slug === "word-search" ? (
                    <WordSearchArena
                      difficulty={difficulty}
                      onDifficultyChange={setDifficulty}
                      score={roundScore}
                      onScoreChange={setRoundScore}
                      onCompleted={handleRoundCompleted}
                      onHintUsed={() => void refreshMemberData()}
                      onActiveChange={setGameInProgress}
                      freeHintsRemaining={status?.freeHintsRemaining ?? 2}
                      pointsBalance={sharedPoints}
                      isMember={Boolean(user)}
                    />
                  ) : activeZone.slug === "sudoku" ? (
                    <SudokuArena
                      difficulty={difficulty}
                      onDifficultyChange={setDifficulty}
                      score={roundScore}
                      onScoreChange={setRoundScore}
                      onCompleted={handleRoundCompleted}
                      onHintUsed={() => void refreshMemberData()}
                      onActiveChange={setGameInProgress}
                      freeHintsRemaining={status?.freeHintsRemaining ?? 2}
                      pointsBalance={sharedPoints}
                      isMember={Boolean(user)}
                    />
                  ) : (
                    <BoardGameArena
                      gameType={activeZone.apiType as BoardGameApiType}
                      difficulty={difficulty}
                      onDifficultyChange={setDifficulty}
                      score={roundScore}
                      onScoreChange={setRoundScore}
                      isMember={Boolean(user)}
                      onCompleted={handleRoundCompleted}
                      onActiveChange={setGameInProgress}
                    />
                  )}
                </section>

                <aside className="game-screen-scoreboard">
                  <section className="game-screen-score-card">
                    <h2>{t("community.games.score.currentRound")}</h2>
                    <strong>{t("community.games.score.points", { score: roundScore })}</strong>
                    {user ? (
                      <p>{t("community.games.wordSearch.pointBalance", { count: sharedPoints })}</p>
                    ) : null}
                  </section>

                  <section
                    className="community-games-leaderboard"
                    aria-labelledby="arcade-side-leaderboard-title"
                  >
                    <div className="community-games-leaderboard-heading">
                      <div>
                        <h2 id="arcade-side-leaderboard-title">
                          {t("community.games.score.leaderboard")}
                        </h2>
                        <p>{t(`community.games.score.rules.${activeZone.apiType}`)}</p>
                      </div>
                      <div
                        className="community-games-leaderboard-tabs"
                        role="group"
                        aria-label={t("community.games.score.period")}
                      >
                        {(["week", "month"] as const).map((option) => (
                          <button
                            type="button"
                            key={option}
                            className={sidePeriod === option ? "active" : ""}
                            aria-pressed={sidePeriod === option}
                            onClick={() => setSidePeriod(option)}
                          >
                            {t(`community.games.score.periods.${option}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {!user ? (
                      <p className="community-games-leaderboard-note">
                        {t("community.games.score.membersOnly")}
                      </p>
                    ) : null}

                    {sideLeaderboardLoading ? (
                      <p className="community-games-leaderboard-state">
                        {t("community.games.score.loading")}
                      </p>
                    ) : sideLeaderboardError ? (
                      <p className="community-games-leaderboard-state" role="alert">
                        {t("community.games.score.loadError")}
                      </p>
                    ) : sideLeaderboard?.entries.length ? (
                      <ol className="community-games-leaderboard-list">
                        {sideLeaderboard.entries.slice(0, 10).map((entry) => (
                          <li
                            key={entry.userId}
                            className={user?.id === entry.userId ? "is-self" : undefined}
                          >
                            <span
                              className={`community-games-leaderboard-rank${
                                entry.rank <= 3 ? ` rank-${entry.rank}` : ""
                              }`}
                            >
                              {entry.rank}
                            </span>
                            <strong>{entry.displayName}</strong>
                            <span>
                              {t("community.games.score.points", { score: entry.score })}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="community-games-leaderboard-state">
                        {t("community.games.score.empty")}
                      </p>
                    )}

                    <button
                      type="button"
                      className="community-panel-link arcade-link-btn arcade-side-full-link"
                      onClick={() => switchHubTab("achievements")}
                    >
                      {t("community.games.arcade.viewFullLeaderboard")}{" "}
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </section>
                </aside>
              </div>
            )}
          </div>
        ) : null}

        {guideOpen ? (
          <GameGuideDialog
            game={activeSlug}
            gameTitle={t(`community.games.${activeZone.i18nKey}.title`)}
            onClose={() => setGuideOpen(false)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
