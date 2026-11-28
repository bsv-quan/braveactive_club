"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  Award,
  CheckCircle2,
  Compass,
  Crown,
  Flame,
  Gamepad2,
  LogIn,
  Medal,
  Play,
  Sparkles,
  Swords,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { GameZoneIllustration } from "@/components/games/illustrations/game-zone-illustration";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useI18n } from "@/i18n/i18n-provider";
import {
  communityApi,
  type AchievementBadgeId,
  type GameAchievements,
  type GameLeaderboard,
  type GameLeaderboardPeriod,
  type LeaderboardScope,
} from "@/lib/api/community";
import type { GuestStreakState } from "@/lib/games/guest-progress";
import { ARCADE_GAMES, type ArcadeGameSlug } from "@/lib/games/registry";

const BADGE_ICONS: Record<AchievementBadgeId, typeof Trophy> = {
  first_round: Sparkles,
  streak_3: Flame,
  streak_7: Medal,
  explorer: Compass,
  tactician: Swords,
  points_1000: Crown,
};

const LEADERBOARD_SCOPES: readonly LeaderboardScope[] = [
  "all",
  "dev_vs_ai",
  "word_search",
  "chess",
  "xiangqi",
  "go",
];

const LEADERBOARD_PERIODS: readonly GameLeaderboardPeriod[] = ["week", "month", "all"];

type ArcadeAchievementsViewProps = {
  achievements: GameAchievements | null;
  achievementsLoading: boolean;
  isMember: boolean;
  currentUserId: string | null;
  guestStreak: GuestStreakState | null;
  refreshToken: number;
  onSelectZone: (slug: ArcadeGameSlug) => void;
};

export function ArcadeAchievementsView({
  achievements,
  achievementsLoading,
  isMember,
  currentUserId,
  guestStreak,
  refreshToken,
  onSelectZone,
}: ArcadeAchievementsViewProps) {
  const { t } = useI18n();
  const tableCaptionId = useId();
  const [scope, setScope] = useState<LeaderboardScope>("all");
  const [period, setPeriod] = useState<GameLeaderboardPeriod>("week");
  const [leaderboard, setLeaderboard] = useState<GameLeaderboard | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(false);

  useEffect(() => {
    let active = true;
    setLeaderboardLoading(true);
    setLeaderboardError(false);
    communityApi
      .getGameLeaderboard(period, scope)
      .then((result) => {
        if (active) setLeaderboard(result);
      })
      .catch(() => {
        if (active) setLeaderboardError(true);
      })
      .finally(() => {
        if (active) setLeaderboardLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period, scope, refreshToken]);

  const me = achievements?.me ?? null;
  const club = achievements?.club ?? null;
  const entries = leaderboard?.entries ?? [];
  const topThree = entries.slice(0, 3);
  const podiumOrder =
    topThree.length === 3
      ? [topThree[1], topThree[0], topThree[2]]
      : topThree;

  const tierProgressPercent =
    me && me.nextTierPoints
      ? Math.min(100, Math.round((Math.max(0, me.totalPoints) / me.nextTierPoints) * 100))
      : 100;

  const perGameMap = new Map((me?.perGame ?? []).map((stat) => [stat.gameType, stat]));

  return (
    <div className="arcade-achievements-page">
      {/* 1. Personal Achievement Profile */}
      <section className="arcade-personal-section" aria-labelledby="arcade-personal-heading">
        <div className="arcade-section-head">
          <h2 id="arcade-personal-heading">
            <Award size={19} aria-hidden="true" /> {t("community.games.arcade.personalHeading")}
          </h2>
          {club ? (
            <div className="arcade-club-summary-pills">
              <span>
                <Users size={13} aria-hidden="true" />{" "}
                {t("community.games.arcade.clubSummaryPlayers", { count: club.totalPlayers })}
              </span>
              <span>
                <Gamepad2 size={13} aria-hidden="true" />{" "}
                {t("community.games.arcade.clubSummaryRounds", { count: club.totalRounds })}
              </span>
              <span>
                <Sparkles size={13} aria-hidden="true" />{" "}
                {t("community.games.arcade.clubSummaryPoints", { count: club.totalPoints })}
              </span>
            </div>
          ) : null}
        </div>

        {!isMember ? (
          <div className="arcade-guest-profile-card">
            <div className="arcade-guest-profile-copy">
              <div className="arcade-guest-streak-pill">
                <Flame size={16} aria-hidden="true" />
                <span>
                  {t("community.games.arcade.sharedStreakLabel")}:{" "}
                  <strong>
                    {t("community.games.arcade.daysUnit", { count: guestStreak?.streakDays ?? 0 })}
                  </strong>
                </span>
              </div>
              <h3>{t("community.games.arcade.guestBannerTitle")}</h3>
              <p>{t("community.games.arcade.guestBannerDesc")}</p>
            </div>
            <div className="arcade-guest-profile-actions">
              <Link className="ui-button ui-button-primary" href="/login">
                <LogIn size={16} aria-hidden="true" /> {t("auth.login.submit")}
              </Link>
              <Link className="ui-button ui-button-secondary" href="/register">
                <UserPlus size={16} aria-hidden="true" /> {t("auth.register.submit")}
              </Link>
            </div>
          </div>
        ) : achievementsLoading && !me ? (
          <p className="community-games-leaderboard-state">{t("common.loading")}</p>
        ) : me ? (
          <>
            <div className="arcade-hero-profile-card">
              <div className="arcade-hero-identity">
                <UserAvatar name={me.displayName} avatarUrl={me.avatarUrl} size={58} />
                <div className="arcade-hero-identity-copy">
                  <div className="arcade-hero-name-row">
                    <h3>{me.displayName}</h3>
                    <span className={`arcade-tier-pill tier-${me.tier}`}>
                      <Crown size={13} aria-hidden="true" />
                      {t(`community.games.arcade.tiers.${me.tier}`)}
                    </span>
                    <span className="arcade-rank-chip">
                      {t("community.games.arcade.clubRankLabel")}:{" "}
                      <strong>{me.rank ? `#${me.rank}` : t("community.games.arcade.unranked")}</strong>
                    </span>
                  </div>
                  <div className="arcade-tier-progress-wrap">
                    <div className="arcade-tier-progress-bar" aria-hidden="true">
                      <span style={{ width: `${tierProgressPercent}%` }} />
                    </div>
                    <small>
                      {me.nextTierPoints
                        ? t("community.games.arcade.nextTierProgress", {
                            current: Math.max(0, me.totalPoints),
                            next: me.nextTierPoints,
                          })
                        : t("community.games.arcade.maxTierReached")}
                    </small>
                  </div>
                </div>
              </div>

              <div className="arcade-personal-kpis">
                <div className="arcade-kpi-box is-points">
                  <span>{t("community.games.arcade.statTotalPoints")}</span>
                  <strong>{t("community.games.score.points", { score: me.totalPoints })}</strong>
                </div>
                <div className="arcade-kpi-box is-streak">
                  <span>{t("community.games.arcade.statCurrentStreak")}</span>
                  <strong>
                    {t("community.games.arcade.daysUnit", { count: me.streakDays })}
                  </strong>
                </div>
                <div className="arcade-kpi-box">
                  <span>{t("community.games.arcade.statBestStreak")}</span>
                  <strong>
                    {t("community.games.arcade.daysUnit", { count: me.longestStreakDays })}
                  </strong>
                </div>
                <div className="arcade-kpi-box">
                  <span>{t("community.games.arcade.statWinsRounds")}</span>
                  <strong>
                    {me.totalWins} / {me.totalRounds}
                  </strong>
                </div>
              </div>
            </div>

            {/* 2. Unlockable Conquest Badges */}
            <div className="arcade-subsection">
              <h3>{t("community.games.arcade.badgesHeading")}</h3>
              <div className="arcade-badges-grid">
                {me.badges.map((badge) => {
                  const Icon = BADGE_ICONS[badge.id] ?? Award;
                  const pct =
                    badge.target > 0
                      ? Math.min(100, Math.round((badge.progress / badge.target) * 100))
                      : 0;
                  return (
                    <article
                      key={badge.id}
                      className={`arcade-badge-card${badge.unlocked ? " is-unlocked" : " is-locked"}`}
                    >
                      <div className="arcade-badge-top">
                        <span className="arcade-badge-emblem" aria-hidden="true">
                          <Icon size={20} />
                        </span>
                        <span className="arcade-badge-progress-num">
                          {badge.unlocked ? (
                            <CheckCircle2 size={15} aria-hidden="true" />
                          ) : null}
                          {badge.progress}/{badge.target}
                        </span>
                      </div>
                      <strong>{t(`community.games.arcade.badges.${badge.id}.title`)}</strong>
                      <p>{t(`community.games.arcade.badges.${badge.id}.desc`)}</p>
                      <div className="arcade-badge-meter" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* 3. Per-Zone Mastery Breakdown */}
            <div className="arcade-subsection">
              <h3>{t("community.games.arcade.perGameHeading")}</h3>
              <div className="arcade-mastery-grid">
                {ARCADE_GAMES.map((zone) => {
                  const stat = perGameMap.get(zone.apiType);
                  const rounds = stat?.roundsPlayed ?? 0;
                  const wins = stat?.wins ?? 0;
                  const totalScore = stat?.totalScore ?? 0;
                  const bestScore = stat?.bestScore ?? 0;
                  return (
                    <article key={zone.slug} className={`arcade-mastery-card tone-${zone.tone}`}>
                      <div className="arcade-mastery-thumb">
                        <GameZoneIllustration slug={zone.slug} />
                      </div>
                      <div className="arcade-mastery-body">
                        <strong>{t(`community.games.${zone.i18nKey}.title`)}</strong>
                        <div className="arcade-mastery-stats">
                          <span>{t("community.games.arcade.roundsUnit", { count: rounds })}</span>
                          <span>·</span>
                          <span>{t("community.games.arcade.winsUnit", { count: wins })}</span>
                          <span>·</span>
                          <span>{t("community.games.score.points", { score: totalScore })}</span>
                        </div>
                        {bestScore > 0 ? (
                          <small>
                            {t("community.games.arcade.bestScoreLabel", { score: bestScore })}
                          </small>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="ui-button ui-button-secondary ui-button-sm"
                        onClick={() => onSelectZone(zone.slug)}
                      >
                        <Play size={14} aria-hidden="true" /> {t("community.games.arcade.playNow")}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </section>

      {/* 4. All-Members Club Hall of Fame Leaderboard */}
      <section className="arcade-leaderboard-section" aria-labelledby="arcade-hall-heading">
        <div className="arcade-leaderboard-header">
          <div>
            <h2 id="arcade-hall-heading">
              <Trophy size={19} aria-hidden="true" />{" "}
              {t("community.games.arcade.leaderboardHeading")}
            </h2>
            <p>{t("community.games.arcade.leaderboardSubtitle")}</p>
          </div>
          <div
            className="arcade-period-chips"
            role="group"
            aria-label={t("community.games.score.period")}
          >
            {LEADERBOARD_PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                className={`training-filter-chip${period === option ? " is-active" : ""}`}
                aria-pressed={period === option}
                onClick={() => setPeriod(option)}
              >
                {t(`community.games.score.periods.${option}`)}
              </button>
            ))}
          </div>
        </div>

        <div
          className="arcade-scope-chips"
          role="group"
          aria-label={t("community.games.score.game")}
        >
          {LEADERBOARD_SCOPES.map((item) => (
            <button
              key={item}
              type="button"
              className={`training-filter-chip${scope === item ? " is-active" : ""}`}
              aria-pressed={scope === item}
              onClick={() => setScope(item)}
            >
              {t(`community.games.score.games.${item}`)}
            </button>
          ))}
        </div>

        <p className="arcade-rule-note">{t(`community.games.score.rules.${scope}`)}</p>

        {!isMember ? (
          <p className="community-games-leaderboard-note">
            {t("community.games.score.membersOnly")}
          </p>
        ) : null}

        {leaderboardLoading ? (
          <p className="community-games-leaderboard-state">{t("community.games.score.loading")}</p>
        ) : leaderboardError ? (
          <p className="community-games-leaderboard-state" role="alert">
            {t("community.games.score.loadError")}
          </p>
        ) : entries.length === 0 ? (
          <p className="community-games-leaderboard-state">{t("community.games.score.empty")}</p>
        ) : (
          <>
            {/* Top-3 Visual Podium */}
            <div className="arcade-podium-grid">
              {podiumOrder.map((entry) => (
                <div
                  key={entry.userId}
                  className={`arcade-podium-card rank-${entry.rank}${
                    currentUserId === entry.userId ? " is-self" : ""
                  }`}
                >
                  <span className={`community-games-leaderboard-rank rank-${entry.rank}`}>
                    {entry.rank === 1 ? <Crown size={14} aria-hidden="true" /> : `#${entry.rank}`}
                  </span>
                  <UserAvatar
                    name={entry.displayName}
                    avatarUrl={entry.avatarUrl ?? null}
                    size={entry.rank === 1 ? 52 : 44}
                  />
                  <strong>{entry.displayName}</strong>
                  <span className="arcade-podium-score">
                    {t("community.games.score.points", { score: entry.score })}
                  </span>
                  {typeof entry.roundsPlayed === "number" ? (
                    <small>
                      {t("community.games.arcade.roundsUnit", { count: entry.roundsPlayed })}
                    </small>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Full Accessible Responsive Ranking Table */}
            <div
              tabIndex={0}
              role="region"
              aria-labelledby={tableCaptionId}
              className="arcade-table-wrapper"
              style={
                {
                  "--col-rounds": `"${t("community.games.arcade.colRounds")}: "`,
                  "--col-score": `"${t("community.games.arcade.colScore")}: "`,
                } as React.CSSProperties
              }
            >
              <table className="arcade-ranking-table">
                <caption id={tableCaptionId} className="community-sr-only">
                  {t("community.games.arcade.leaderboardHeading")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t("community.games.arcade.colRank")}</th>
                    <th scope="col">{t("community.games.arcade.colPlayer")}</th>
                    <th scope="col">{t("community.games.arcade.colRounds")}</th>
                    <th scope="col">{t("community.games.arcade.colScore")}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const isSelf = currentUserId === entry.userId;
                    return (
                      <tr key={entry.userId} className={isSelf ? "is-self" : undefined}>
                        <td>
                          <span
                            className={`community-games-leaderboard-rank${
                              entry.rank <= 3 ? ` rank-${entry.rank}` : ""
                            }`}
                          >
                            {entry.rank}
                          </span>
                        </td>
                        <th scope="row">
                          <span className="arcade-player-cell">
                            <UserAvatar
                              name={entry.displayName}
                              avatarUrl={entry.avatarUrl ?? null}
                              size={28}
                            />
                            <span>{entry.displayName}</span>
                            {isSelf ? (
                              <span className="arcade-you-pill">
                                {t("community.games.arcade.youTag")}
                              </span>
                            ) : null}
                          </span>
                        </th>
                        <td data-col="rounds">
                          {t("community.games.arcade.roundsUnit", {
                            count: entry.roundsPlayed ?? 0,
                          })}
                        </td>
                        <td data-col="score">
                          <strong>{t("community.games.score.points", { score: entry.score })}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
