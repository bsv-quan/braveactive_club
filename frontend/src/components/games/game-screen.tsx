"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Lottie } from "lottie-react";
import { ArrowLeft, CircleAlert, CircleHelp, Crown, Flag, Gamepad2, Grid3X3, LoaderCircle, RotateCcw, Search, Shield, Sparkles, WandSparkles, X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import {
  communityApi,
  type BoardGameResponse,
  type BoardGameState,
  type BoardMove,
  type GameDifficulty,
  type GameLeaderboard,
  type GameLeaderboardPeriod,
  type GameStatus,
  type GameType,
  type WordSearchPuzzle,
} from "@/lib/api/community";
import { updateWordSearchSelection } from "@/lib/word-search";
import { GameGuideDialog } from "@/components/games/game-guide-dialog";
import gameOverAnimation from "@/components/games/animations/game-over.json";
import trophyAnimation from "@/components/games/animations/trophy.json";
import { useAuth } from "@/components/auth/auth-provider";
import { useI18n } from "@/i18n/i18n-provider";
import type { MessageKey } from "@/i18n/messages/types";

export type GameSlug = "word-search" | "chess" | "xiangqi" | "go";

const gameTypeBySlug: Record<GameSlug, GameType> = {
  "word-search": "word_search",
  chess: "chess",
  xiangqi: "xiangqi",
  go: "go",
};

const difficultyOptions: GameDifficulty[] = ["easy", "medium", "hard"];

function isGameDifficulty(value: unknown): value is GameDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

const guestAttendanceStorageKey = "braveactive-game-attendance";
const sideMessageKeys: Record<string, MessageKey> = {
  white: "community.games.board.sides.white",
  black: "community.games.board.sides.black",
  red: "community.games.board.sides.red",
  blue: "community.games.board.sides.blue",
  human: "community.games.board.sides.human",
  ai: "community.games.board.sides.ai",
};
const pieceMessageKeys: Record<Exclude<GameType, "word_search">, Record<string, MessageKey>> = {
  chess: {
    K: "community.games.chess.pieces.K", Q: "community.games.chess.pieces.Q",
    R: "community.games.chess.pieces.R", B: "community.games.chess.pieces.B",
    N: "community.games.chess.pieces.N", P: "community.games.chess.pieces.P",
    k: "community.games.chess.pieces.k", q: "community.games.chess.pieces.q",
    r: "community.games.chess.pieces.r", b: "community.games.chess.pieces.b",
    n: "community.games.chess.pieces.n", p: "community.games.chess.pieces.p",
  },
  xiangqi: {
    K: "community.games.xiangqi.pieces.K", A: "community.games.xiangqi.pieces.A",
    E: "community.games.xiangqi.pieces.E", H: "community.games.xiangqi.pieces.H",
    R: "community.games.xiangqi.pieces.R", C: "community.games.xiangqi.pieces.C",
    P: "community.games.xiangqi.pieces.P", k: "community.games.xiangqi.pieces.k",
    a: "community.games.xiangqi.pieces.a", e: "community.games.xiangqi.pieces.e",
    h: "community.games.xiangqi.pieces.h", r: "community.games.xiangqi.pieces.r",
    c: "community.games.xiangqi.pieces.c", p: "community.games.xiangqi.pieces.p",
  },
  go: {
    B: "community.games.go.pieces.B", W: "community.games.go.pieces.W",
    b: "community.games.go.pieces.b", w: "community.games.go.pieces.w",
  },
};

function vietnamTodayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function guestHintKey() {
  return `braveactive-game-hints:${vietnamTodayKey()}`;
}

function readGuestHints() {
  const used = Number(window.localStorage.getItem(guestHintKey()) ?? 0);
  return Math.max(0, 2 - (Number.isFinite(used) ? used : 0));
}

function dateKeyOffset(dateKey: string, offset: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

function readGuestAttendanceDays() {
  const stored = window.localStorage.getItem(guestAttendanceStorageKey);
  const days: unknown = stored ? JSON.parse(stored) : [];
  if (!Array.isArray(days) || !days.every((day) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day))) {
    throw new Error("Stored guest attendance data is invalid.");
  }
  return [...new Set(days)].sort();
}

function guestAttendanceStatus(days: string[]) {
  const today = vietnamTodayKey();
  const eligibleDays = days.filter((day) => day <= today);
  const dates = new Set(eligibleDays);
  const latest = eligibleDays.at(-1);
  if (!latest || latest < dateKeyOffset(today, -1)) {
    return { playedToday: dates.has(today), streakDays: 0 };
  }
  let streakDays = 0;
  for (let day = latest; dates.has(day); day = dateKeyOffset(day, -1)) {
    streakDays += 1;
  }
  return { playedToday: dates.has(today), streakDays };
}

function getTurnMessageKey(gameType: Exclude<GameType, "word_search">, turn: string): MessageKey {
  if (gameType === "go") {
    if (turn === "black") return "community.games.go.sides.black";
    if (turn === "white") return "community.games.go.sides.white";
  }
  return sideMessageKeys[turn] ?? "community.games.board.sides.human";
}

function recordGuestAttendance() {
  const today = vietnamTodayKey();
  const days = [...new Set([...readGuestAttendanceDays(), today])].sort().slice(-400);
  window.localStorage.setItem(guestAttendanceStorageKey, JSON.stringify(days));
  return guestAttendanceStatus(days);
}

export function GameScreen({ game }: { game: GameSlug }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const gameType = gameTypeBySlug[game];
  const isWordSearch = game === "word-search";
  const [difficulty, setDifficulty] = useState<GameDifficulty>("medium");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<GameLeaderboardPeriod>("week");
  const [leaderboard, setLeaderboard] = useState<GameLeaderboard | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(false);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [guestAttendance, setGuestAttendance] = useState<{ playedToday: boolean; streakDays: number } | null>(null);
  const [guestAttendanceError, setGuestAttendanceError] = useState(false);
  const [roundScore, setRoundScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLeaderboardLoading(true);
    setLeaderboardError(false);
    communityApi.getGameLeaderboard(leaderboardPeriod, gameType)
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
  }, [gameType, leaderboardPeriod, leaderboardRefresh]);

  async function refreshStatus() {
    if (!user) return;
    try {
      setStatus(await communityApi.getGameStatus());
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  }

  useEffect(() => {
    if (user) {
      void refreshStatus();
      return;
    }
    try {
      setGuestAttendance(guestAttendanceStatus(readGuestAttendanceDays()));
      setGuestAttendanceError(false);
    } catch {
      setGuestAttendanceError(true);
    }
  }, [user?.id]);

  function onGameCompleted() {
    setLeaderboardRefresh((value) => value + 1);
    if (user) {
      void refreshStatus();
      return;
    }
    try {
      setGuestAttendance(recordGuestAttendance());
      setGuestAttendanceError(false);
    } catch {
      setGuestAttendanceError(true);
    }
  }

  const name = t(`community.games.${game === "word-search" ? "wordSearch" : game}.title`);
  const DescriptionIcon = game === "word-search" ? Search : game === "chess" ? Crown : game === "xiangqi" ? Shield : Grid3X3;

  return (
    <section className="game-screen">
      <header className="game-screen-header">
        <Link href="/community" className="game-screen-back"><ArrowLeft size={17} /> {t("community.games.backToCommunity")}</Link>
        <div className="game-screen-heading">
          <span className="community-games-option-icon"><DescriptionIcon size={22} aria-hidden="true" /></span>
          <div className="game-screen-heading-copy">
            <p>{t("community.games.kicker")}</p>
            <h1>{name}</h1>
          </div>
          <button
            type="button"
            className="game-guide-open"
            aria-label={t("community.games.guide.open")}
            title={t("community.games.guide.open")}
            onClick={() => setGuideOpen(true)}
          >
            <CircleHelp size={19} aria-hidden="true" />
          </button>
        </div>
        <p className="game-screen-intro">{t(`community.games.${game === "word-search" ? "wordSearch" : game}.description`)}</p>
      </header>
      {guideOpen && <GameGuideDialog game={game} gameTitle={name} onClose={() => setGuideOpen(false)} />}

      <GameStatusBar
        status={status}
        error={statusError}
        isMember={Boolean(user)}
        guestAttendance={guestAttendance}
        guestError={guestAttendanceError}
        t={t}
      />

      <div className="game-screen-layout">
        <section className="game-screen-play-area">
          {isWordSearch ? (
            <WordSearchScreen
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              score={roundScore}
              onScoreChange={setRoundScore}
              onCompleted={onGameCompleted}
              freeHintsRemaining={status?.freeHintsRemaining ?? 2}
              pointsBalance={status?.wordSearchPoints ?? 0}
              isMember={Boolean(user)}
              locale={locale}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              error={error}
              setError={setError}
              t={t}
            />
          ) : (
            <BoardGameScreen
              gameType={gameType as Exclude<GameType, "word_search">}
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              score={roundScore}
              onScoreChange={setRoundScore}
              isMember={Boolean(user)}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              error={error}
              setError={setError}
              onCompleted={onGameCompleted}
              t={t}
            />
          )}
        </section>

        <aside className="game-screen-scoreboard">
          <section className="game-screen-score-card">
            <h2>{t("community.games.score.currentRound")}</h2>
            <strong>{t("community.games.score.points", { score: roundScore })}</strong>
            {user && gameType === "word_search" && (
              <p>{t("community.games.wordSearch.pointBalance", { count: status?.wordSearchPoints ?? 0 })}</p>
            )}
          </section>
          <LeaderboardPanel
            gameType={gameType}
            period={leaderboardPeriod}
            leaderboard={leaderboard}
            loading={leaderboardLoading}
            error={leaderboardError}
            isMember={Boolean(user)}
            onChangePeriod={setLeaderboardPeriod}
            t={t}
          />
        </aside>
      </div>
    </section>
  );
}

function GameStatusBar({
  status,
  error,
  isMember,
  guestAttendance,
  guestError,
  t,
}: {
  status: GameStatus | null;
  error: boolean;
  isMember: boolean;
  guestAttendance: { playedToday: boolean; streakDays: number } | null;
  guestError: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (!isMember) {
    return (
      <div className="game-screen-streak" role={guestError ? "alert" : undefined}>
        <Sparkles size={17} aria-hidden="true" />
        {guestError
          ? t("community.games.streak.loadError")
          : guestAttendance
            ? t(guestAttendance.playedToday ? "community.games.streak.markedWithDays" : "community.games.streak.notMarkedWithDays", { count: guestAttendance.streakDays })
            : t("community.games.streak.loading")}
        <span>{t("community.games.streak.signIn")}</span>
      </div>
    );
  }
  return (
    <div className="game-screen-streak" role={error ? "alert" : undefined}>
      <Sparkles size={17} aria-hidden="true" />
      {error
        ? t("community.games.streak.loadError")
        : status
          ? status.playedToday
            ? t("community.games.streak.markedWithDays", { count: status.streakDays })
            : t("community.games.streak.notMarkedWithDays", { count: status.streakDays })
          : t("community.games.streak.loading")}
    </div>
  );
}

function LeaderboardPanel({
  gameType,
  period,
  leaderboard,
  loading,
  error,
  isMember,
  onChangePeriod,
  t,
}: {
  gameType: GameType;
  period: GameLeaderboardPeriod;
  leaderboard: GameLeaderboard | null;
  loading: boolean;
  error: boolean;
  isMember: boolean;
  onChangePeriod: (period: GameLeaderboardPeriod) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <section className="community-games-leaderboard" aria-labelledby="game-screen-leaderboard-title">
      <div className="community-games-leaderboard-heading">
        <div>
          <h2 id="game-screen-leaderboard-title">{t("community.games.score.leaderboard")}</h2>
          <p>{t(`community.games.score.rules.${gameType}`)}</p>
        </div>
        <div className="community-games-leaderboard-tabs" role="group" aria-label={t("community.games.score.period")}>
          {(["week", "month"] as const).map((option) => (
            <button type="button" key={option} className={period === option ? "active" : ""} aria-pressed={period === option} onClick={() => onChangePeriod(option)}>
              {t(`community.games.score.periods.${option}`)}
            </button>
          ))}
        </div>
      </div>
      {!isMember && <p className="community-games-leaderboard-note">{t("community.games.score.membersOnly")}</p>}
      {loading ? (
        <p className="community-games-leaderboard-state">{t("community.games.score.loading")}</p>
      ) : error ? (
        <p className="community-games-leaderboard-state" role="alert">{t("community.games.score.loadError")}</p>
      ) : leaderboard?.entries.length ? (
        <ol className="community-games-leaderboard-list">
          {leaderboard.entries.map((entry) => (
            <li key={entry.userId}>
              <span className="community-games-leaderboard-rank">{entry.rank}</span>
              <strong>{entry.displayName}</strong>
              <span>{t("community.games.score.points", { score: entry.score })}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="community-games-leaderboard-state">{t("community.games.score.empty")}</p>
      )}
    </section>
  );
}

function DifficultyPicker({
  value,
  onChange,
  game,
  disabled = false,
  showReward = true,
  t,
}: {
  value: GameDifficulty;
  onChange: (value: GameDifficulty) => void;
  game: "wordSearch" | "chess" | "xiangqi" | "go";
  disabled?: boolean;
  showReward?: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <label className="game-difficulty-picker">
      <span>{t("community.games.difficultyLabel")}</span>
      <select className="ui-select" value={value} onChange={(event) => onChange(event.target.value as GameDifficulty)} disabled={disabled}>
        {difficultyOptions.map((option) => (
          <option key={option} value={option}>{t(`community.games.difficulties.${option}`)}</option>
        ))}
      </select>
      {showReward && <small>{t(`community.games.${game}.difficultyPoints.${value}`)}</small>}
    </label>
  );
}

function DifficultyDisplay({
  value,
  game,
  showReward = true,
  t,
}: {
  value: GameDifficulty;
  game: "wordSearch" | "chess" | "xiangqi" | "go";
  showReward?: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="game-difficulty-display" aria-label={`${t("community.games.difficultyLabel")}: ${t(`community.games.difficulties.${value}`)}`}>
      <span>{t("community.games.difficultyLabel")}</span>
      <strong>{t(`community.games.difficulties.${value}`)}</strong>
      {showReward && <small>{t(`community.games.${game}.difficultyPoints.${value}`)}</small>}
    </div>
  );
}

function WordSearchScreen({
  difficulty,
  onDifficultyChange,
  score,
  onScoreChange,
  onCompleted,
  freeHintsRemaining,
  pointsBalance,
  isMember,
  locale,
  isLoading,
  setIsLoading,
  error,
  setError,
  t,
}: {
  difficulty: GameDifficulty;
  onDifficultyChange: (value: GameDifficulty) => void;
  score: number;
  onScoreChange: (value: number | ((current: number) => number)) => void;
  onCompleted: () => void;
  freeHintsRemaining: number;
  pointsBalance: number;
  isMember: boolean;
  locale: "vi" | "en" | "ja";
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  error: string;
  setError: (value: string) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const [puzzle, setPuzzle] = useState<WordSearchPuzzle | null>(null);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [foundWords, setFoundWords] = useState<number[]>([]);
  const [foundCells, setFoundCells] = useState<number[]>([]);
  const [hintedCell, setHintedCell] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | "invalid" | null>(null);
  const [guestHintsRemaining, setGuestHintsRemaining] = useState(2);
  const [roundDifficulty, setRoundDifficulty] = useState<GameDifficulty>("medium");
  const isComplete = Boolean(puzzle && foundWords.length === puzzle.words.length);
  const selectedLetters = useMemo(() => puzzle
    ? selectedCells.map((index) => puzzle.grid[Math.floor(index / puzzle.size)][index % puzzle.size]).join("")
    : "", [puzzle, selectedCells]);

  useEffect(() => {
    if (!isMember) setGuestHintsRemaining(readGuestHints());
  }, [isMember]);

  async function createPuzzle() {
    const selectedDifficulty = difficulty;
    setIsLoading(true);
    setError("");
    try {
      const generated = await communityApi.generateWordSearch({ difficulty: selectedDifficulty, locale });
      setPuzzle(generated);
      setRoundDifficulty(selectedDifficulty);
      setSelectedCells([]);
      setFoundWords([]);
      setFoundCells([]);
      setHintedCell(null);
      setFeedback(null);
      onScoreChange(0);
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 429
        ? t("community.games.wordSearch.rateLimited")
        : reason instanceof ApiError && reason.status === 503
          ? t("community.games.wordSearch.aiUnavailable")
          : t("community.games.wordSearch.generateError"));
    } finally {
      setIsLoading(false);
    }
  }

  function chooseCell(cell: number) {
    if (!puzzle || isLoading || isComplete) return;
    const selection = updateWordSearchSelection(selectedCells, cell, puzzle.size);
    setSelectedCells(selection.path);
    setFeedback(selection.isValid ? null : "invalid");
  }

  async function confirmSelection() {
    if (!puzzle || selectedCells.length < 2 || isLoading) return;
    setIsLoading(true);
    setError("");
    try {
      const selectedWord = selectedLetters;
      const match = puzzle.words.findIndex(({ answer }, index) => answer === selectedWord && !foundWords.includes(index));
      let nextFoundWords: number[];
      if (puzzle.roundId) {
        const result = await communityApi.submitWordSearchGuess(puzzle.roundId, selectedCells);
        onScoreChange(result.score);
        if (!result.correct) {
          setFeedback("incorrect");
          return;
        }
        nextFoundWords = result.foundWords;
      } else {
        if (match < 0) {
          setFeedback("incorrect");
          return;
        }
        nextFoundWords = [...foundWords, match];
        if (nextFoundWords.length === puzzle.words.length) {
          const points = { easy: 100, medium: 250, hard: 500 }[roundDifficulty];
          onScoreChange(points);
        }
      }
      setFoundWords(nextFoundWords);
      setFoundCells((current) => [...new Set([...current, ...selectedCells])]);
      setSelectedCells([]);
      setHintedCell(null);
      setFeedback("correct");
      if (nextFoundWords.length === puzzle.words.length) onCompleted();
    } catch {
      setError(t("community.games.score.saveError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function useHint() {
    if (!puzzle || isLoading || isComplete) return;
    setIsLoading(true);
    setError("");
    try {
      if (puzzle.roundId) {
        const result = await communityApi.useWordSearchHint(puzzle.roundId);
        onScoreChange(result.score);
        if (result.cell !== null) {
          setHintedCell(result.cell);
          setSelectedCells([]);
          setFeedback(null);
        }
      } else {
        if (guestHintsRemaining <= 0) {
          setError(t("community.games.wordSearch.guestHintsUsed"));
          return;
        }
        const nextWord = puzzle.words.find((_, index) => !foundWords.includes(index));
        if (!nextWord) return;
        const cell = findWordStart(puzzle, nextWord.answer);
        if (cell === null) return;
        const remaining = guestHintsRemaining - 1;
        setGuestHintsRemaining(remaining);
        window.localStorage.setItem(guestHintKey(), String(2 - remaining));
        setHintedCell(cell);
        setSelectedCells([]);
        setFeedback(null);
      }
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409
        ? t("community.games.wordSearch.insufficientPoints")
        : t("community.games.score.saveError"));
    } finally {
      setIsLoading(false);
    }
  }

  function findWordStart(data: WordSearchPuzzle, word: string) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
    for (let row = 0; row < data.size; row += 1) {
      for (let column = 0; column < data.size; column += 1) {
        for (const [dr, dc] of directions) {
          const endRow = row + (word.length - 1) * dr;
          const endColumn = column + (word.length - 1) * dc;
          if (endRow < 0 || endRow >= data.size || endColumn < 0 || endColumn >= data.size) continue;
          const cells = Array.from({ length: word.length }, (_, i) =>
            data.grid[row + i * dr][column + i * dc],
          );
          if (cells.join("") === word) return row * data.size + column;
        }
      }
    }
    return null;
  }

  return (
    <div className="game-play-card">
      <div className="game-play-card-header">
        <div>
          <h2>{t("community.games.wordSearch.playTitle")}</h2>
          <p>{t("community.games.wordSearch.playDescription")}</p>
        </div>
        {puzzle && !isComplete ? (
          <DifficultyDisplay value={roundDifficulty} game="wordSearch" t={t} />
        ) : (
          <DifficultyPicker value={difficulty} onChange={onDifficultyChange} game="wordSearch" disabled={isLoading} t={t} />
        )}
      </div>
      {error && <p className="community-word-search-error" role="alert">{error}</p>}
      {!puzzle ? (
        <div className="game-start-panel">
          <WandSparkles size={28} aria-hidden="true" />
          <h3>{t("community.games.wordSearch.customizeTitle")}</h3>
          <p>{t("community.games.wordSearch.customizeIntro")}</p>
          <button type="button" className="community-quiz-primary" onClick={() => void createPuzzle()} disabled={isLoading}>
            {isLoading ? <LoaderCircle className="ui-spin" size={16} /> : <WandSparkles size={16} />}
            {t(isLoading ? "community.games.wordSearch.generating" : "community.games.wordSearch.generate")}
          </button>
        </div>
      ) : (
        <>
          <div className="game-round-meta">
            <span>{t("community.games.wordSearch.found", { found: foundWords.length, total: puzzle.words.length })}</span>
            {isMember && <span>{t("community.games.wordSearch.pointBalance", { count: pointsBalance })}</span>}
            <span>{isMember ? t("community.games.wordSearch.hintsRemaining", { count: freeHintsRemaining, cost: 100 }) : t("community.games.wordSearch.hintsRemaining", { count: guestHintsRemaining, cost: 100 })}</span>
          </div>
          {isComplete ? (
            <div className="game-result-panel game-result-win" role="status">
              <span className="game-result-confetti" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</span>
              <Sparkles className="game-result-icon" size={30} aria-hidden="true" />
              <h3>{t("community.games.wordSearch.complete")}</h3>
              <strong>{t("community.games.score.points", { score })}</strong>
              <ul className="community-word-search-completed-answers">
                {puzzle.words.map(({ displayAnswer, clue }) => <li key={displayAnswer}><span>{clue}</span><strong>{t("community.games.wordSearch.answer", { answer: displayAnswer })}</strong></li>)}
              </ul>
              <button type="button" className="community-quiz-primary" onClick={() => void createPuzzle()} disabled={isLoading}><RotateCcw size={16} /> {t("community.games.playAgain")}</button>
            </div>
          ) : (
            <div className="word-search-screen-layout">
              <div className="community-word-search-grid" style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))`, width: `min(100%, ${Math.min(puzzle.size * 36, 460)}px)` }} role="group" aria-label={t("community.games.wordSearch.board")}>
                {puzzle.grid.flatMap((row, rowIndex) => row.map((letter, columnIndex) => {
                  const index = rowIndex * puzzle.size + columnIndex;
                  const selected = selectedCells.includes(index);
                  const found = foundCells.includes(index);
                  return (
                    <button
                      type="button"
                      key={index}
                      className={`community-word-search-cell${found ? " found" : ""}${hintedCell === index ? " hinted" : ""}${selected ? " selected" : ""}`}
                      aria-label={t(found ? "community.games.wordSearch.foundCell" : "community.games.wordSearch.cell", { row: rowIndex + 1, column: columnIndex + 1, letter })}
                      aria-pressed={selected || found}
                      onClick={() => chooseCell(index)}
                    >{letter}</button>
                  );
                }))}
              </div>
              <div className="word-search-clue-panel">
                <ul className="community-word-search-clues">
                  {puzzle.words.map(({ answer, clue, displayAnswer }, index) => (
                    <li key={`${answer}-${index}`} className={foundWords.includes(index) ? "found" : ""}>
                      <span aria-hidden="true">{foundWords.includes(index) ? "✓" : "·"}</span>
                      <span className="community-word-search-clue-copy">{clue} ({answer.length}){foundWords.includes(index) && <strong className="community-word-search-answer">{t("community.games.wordSearch.answer", { answer: displayAnswer })}</strong>}</span>
                    </li>
                  ))}
                </ul>
                <p>{selectedLetters ? t("community.games.wordSearch.selectionPreview", { letters: selectedLetters, length: selectedLetters.length }) : t("community.games.wordSearch.selectStart")}</p>
                {feedback && <strong className={feedback === "correct" ? "correct" : "incorrect"} role="status">{t(`community.games.wordSearch.${feedback}`)}</strong>}
                {hintedCell !== null && <p className="community-word-search-hint">{t("community.games.wordSearch.hint", { letter: puzzle.grid[Math.floor(hintedCell / puzzle.size)][hintedCell % puzzle.size], row: Math.floor(hintedCell / puzzle.size) + 1, column: hintedCell % puzzle.size + 1 })}</p>}
                <div className="community-word-search-actions">
                  <button type="button" className="community-quiz-primary community-word-search-hint-button" disabled={isLoading || (isMember ? freeHintsRemaining === 0 && pointsBalance < 100 : guestHintsRemaining === 0)} onClick={() => void useHint()}><WandSparkles size={15} /> {t("community.games.wordSearch.hintButton")}</button>
                  <button type="button" className="community-quiz-primary" disabled={selectedCells.length < 2 || isLoading} onClick={() => void confirmSelection()}>{isLoading && <LoaderCircle className="ui-spin" size={15} />}{t("community.games.wordSearch.confirmSelection")}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BoardGameScreen({
  gameType,
  difficulty,
  onDifficultyChange,
  score,
  onScoreChange,
  isMember,
  isLoading,
  setIsLoading,
  error,
  setError,
  onCompleted,
  t,
}: {
  gameType: Exclude<GameType, "word_search">;
  difficulty: GameDifficulty;
  onDifficultyChange: (value: GameDifficulty) => void;
  score: number;
  onScoreChange: (value: number) => void;
  isMember: boolean;
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  error: string;
  setError: (value: string) => void;
  onCompleted: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const [game, setGame] = useState<BoardGameResponse | null>(null);
  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;
  const gameRef = useRef<BoardGameResponse | null>(null);
  gameRef.current = game;
  const botTurnInFlight = useRef(false);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [guestScore, setGuestScore] = useState(0);
  const [botThinking, setBotThinking] = useState(false);
  const [botTurnError, setBotTurnError] = useState(false);
  const [showBoardResultAnimation, setShowBoardResultAnimation] = useState(false);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const titleKey = gameType === "chess" ? "chess" : gameType;
  const title = t(`community.games.${titleKey}.title`);
  const lastMoveCoordinates = gameType === "chess" || gameType === "xiangqi"
    ? getBoardMoveCoordinates(game?.state.last_move)
    : null;
  const resumeError = t("community.games.board.resumeError");
  const grid = game?.state.board ?? [];
  const columns = grid[0]?.length ?? 0;
  const won = game?.state.result.endsWith("_win") && (
    (gameType === "go" && game.state.result === "black_win")
    || (gameType === "xiangqi" && game.state.result === "red_win")
    || (gameType === "chess" && game.state.result === "white_win")
  );
  const finished = Boolean(game && game.state.result !== "ongoing");
  const shouldShowBoardResultAnimation = finished;

  useEffect(() => {
    if (!shouldShowBoardResultAnimation || !game) {
      setShowBoardResultAnimation(false);
      return;
    }

    setShowBoardResultAnimation(true);
    const timeout = window.setTimeout(() => setShowBoardResultAnimation(false), 3400);
    return () => window.clearTimeout(timeout);
  }, [shouldShowBoardResultAnimation, game?.roundId, game?.state.result, game?.state.forfeit]);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [error, setError]);

  const runBotTurn = useCallback(async (currentGame: BoardGameResponse) => {
    if (botTurnInFlight.current) return;
    botTurnInFlight.current = true;
    setBotThinking(true);
    setBotTurnError(false);
    setIsLoading(true);
    setError("");
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const result = await communityApi.submitBoardBotTurn(
        gameType,
        difficultyRef.current,
        currentGame.roundId,
        currentGame.state,
      );
      setGame(result);
      onScoreChange(result.score);
      if (result.state.result !== "ongoing") {
        setGuestScore(result.scoreAwarded);
        onCompletedRef.current();
      }
    } catch {
      setBotTurnError(true);
      setError(t("community.games.board.botTurnError"));
    } finally {
      botTurnInFlight.current = false;
      setBotThinking(false);
      setIsLoading(false);
    }
  }, [gameType, onScoreChange, setError, setIsLoading, t]);

  useEffect(() => {
    if (!isMember || gameRef.current) return;
    let active = true;
    setIsLoading(true);
    void (async () => {
      try {
        const savedGame = await communityApi.getActiveBoardGame(gameType);
        if (!active) return;
        if (!savedGame) {
          setIsLoading(false);
          return;
        }
        setGame(savedGame);
        onScoreChange(savedGame.score);
        const savedDifficulty = savedGame.state.difficulty;
        if (savedDifficulty === "easy" || savedDifficulty === "medium" || savedDifficulty === "hard") {
          onDifficultyChange(savedDifficulty);
        }
        if (savedGame.state.turn === savedGame.state.ai) {
          await runBotTurn(savedGame);
        } else {
          setIsLoading(false);
        }
      } catch {
        if (active) {
          setError(resumeError);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [gameType, isMember, onDifficultyChange, onScoreChange, resumeError, runBotTurn, setError, setIsLoading]);

  async function startGame() {
    setIsLoading(true);
    setError("");
    try {
      const started = await communityApi.startBoardGame(gameType, difficulty);
      setGame(started);
      onScoreChange(started.score);
      setSelectedCell(null);
      setGuestScore(0);
      setBotTurnError(false);
    } catch {
      setError(t("community.games.board.startError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function returnToGameSetup() {
    if (!window.confirm(t("community.games.board.restartConfirm"))) return;
    setIsLoading(true);
    setError("");
    try {
      if (isMember) await communityApi.abandonActiveBoardGame(gameType);
      setGame(null);
      onScoreChange(0);
      setSelectedCell(null);
      setGuestScore(0);
      setBotTurnError(false);
    } catch {
      setError(t("community.games.board.abandonError"));
    } finally {
      setIsLoading(false);
    }
  }

  function returnToDifficultySelection() {
    if (!finished) {
      void returnToGameSetup();
      return;
    }

    setGame(null);
    onScoreChange(0);
    setSelectedCell(null);
    setGuestScore(0);
    setBotTurnError(false);
  }

  async function surrenderGame() {
    if (!window.confirm(t("community.games.board.surrenderConfirm"))) return;
    if (!game) return;
    setIsLoading(true);
    setError("");
    try {
      const forfeited = await communityApi.forfeitBoardGame(
        gameType,
        isMember ? game.roundId : null,
        game.state,
      );
      setGame(forfeited);
      onScoreChange(forfeited.score);
      setGuestScore(0);
      setSelectedCell(null);
      setBotTurnError(false);
      if (isMember) onCompleted();
    } catch {
      setError(t("community.games.board.abandonError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMove(move: BoardMove) {
    if (!game || isLoading || finished || botTurnError || game.state.turn !== game.state.human) return;
    setIsLoading(true);
    setError("");
    let result: BoardGameResponse;
    try {
      result = await communityApi.submitBoardMove(gameType, difficulty, move, game.roundId, game.state);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 0 && game.roundId) {
        try {
          const savedGame = await communityApi.getActiveBoardGame(gameType);
          if (savedGame?.roundId === game.roundId) {
            setGame(savedGame);
            onScoreChange(savedGame.score);
            setSelectedCell(null);
            if (savedGame.state.turn === savedGame.state.ai) {
              await runBotTurn(savedGame);
              return;
            }
          }
        } catch {
          setError(t("community.games.board.moveInterrupted"));
          setIsLoading(false);
          return;
        }
      }
      setError(reason instanceof ApiError && reason.status === 409
        ? t("community.games.board.finishedError")
        : reason instanceof ApiError && reason.status === 0
          ? t("community.games.board.moveInterrupted")
          : game.state.check === true && (gameType === "chess" || gameType === "xiangqi")
            ? t("community.games.board.inCheckIllegalMove")
            : t("community.games.board.illegalMove"));
      setIsLoading(false);
      return;
    }

    setGame(result);
    onScoreChange(result.score);
    setSelectedCell(null);
    if (result.state.result !== "ongoing") {
      setGuestScore(result.scoreAwarded);
      onCompleted();
      setIsLoading(false);
      return;
    }
    await runBotTurn(result);
  }

  function chooseBoardCell(row: number, column: number) {
    if (!game || isLoading || finished || botTurnError || game.state.turn !== game.state.human) return;
    const target = game.state.board[row]?.[column] ?? "";
    const targetOccupied = Boolean(target && target !== "." && target !== "-");
    if (gameType === "go") {
      if (!targetOccupied) void sendMove({ at: [row, column] });
      else setError(t("community.games.board.illegalMove"));
      return;
    }
    if (!selectedCell) {
      if (!targetOccupied || !isHumanSide(gameType, target)) return;
      setSelectedCell([row, column]);
      setError("");
      return;
    }
    if (selectedCell[0] === row && selectedCell[1] === column) {
      setSelectedCell(null);
      return;
    }
    if (targetOccupied && isHumanSide(gameType, target)) {
      setSelectedCell([row, column]);
      setError("");
      return;
    }
    void sendMove({ from: selectedCell, to: [row, column] });
  }

  return (
    <div className="game-play-card board-game-card">
      <div className="game-play-card-header">
        <div>
          <h2>{t(`community.games.${titleKey}.playTitle`)}</h2>
          <p>{t(`community.games.${titleKey}.playDescription`)}</p>
        </div>
        {game && !finished ? (
          <DifficultyDisplay value={isGameDifficulty(game.state.difficulty) ? game.state.difficulty : difficulty} game={titleKey} showReward={false} t={t} />
        ) : (
          <DifficultyPicker value={difficulty} onChange={onDifficultyChange} game={titleKey} disabled={isLoading} showReward={false} t={t} />
        )}
      </div>
      <div className="board-game-points">
        <div className="board-game-stat">
          <span>{t("community.games.score.points", { score: isMember ? score : guestScore })}</span>
        </div>
        <div className="board-game-stat board-game-stat-reward">
          <span>{t(`community.games.${titleKey}.winPoints.${difficulty}`)}</span>
        </div>
      </div>
      {!game ? (
        <div className="game-start-panel">
          <span className="board-game-start-icon"><DescriptionIconForGame game={gameType} /></span>
          <h3>{t(`community.games.${titleKey}.readyTitle`)}</h3>
          <p>{t(`community.games.${titleKey}.readyDescription`)}</p>
          {error && (
            <div className="game-board-warning game-board-warning-start" role="alert" aria-live="assertive">
              <CircleAlert size={18} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" aria-label={t("common.close")} onClick={() => setError("")}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          )}
          <button type="button" className="community-quiz-primary" onClick={() => void startGame()} disabled={isLoading}>
            {isLoading ? <LoaderCircle className="ui-spin" size={16} /> : <Gamepad2 size={16} />}
            {t("community.games.board.start")}
          </button>
        </div>
      ) : (
        <>
          <p className={`board-game-turn${finished ? " board-game-result-message" : ""}`} role="status" aria-live="polite">
            {finished
              ? t(won ? "community.games.board.youWon" : game.state.result === "draw" ? "community.games.board.draw" : "community.games.board.youLost")
              : botThinking
                ? t("community.games.board.botThinking")
                : t("community.games.board.turn", { turn: t(getTurnMessageKey(gameType, game.state.turn)) })}
          </p>
          {botTurnError && (
            <button type="button" className="community-quiz-primary board-game-pass" disabled={isLoading} onClick={() => void runBotTurn(game)}>
              <RotateCcw size={16} /> {t("community.games.board.retryBot")}
            </button>
          )}
          <div className="board-game-stage">
            {error && (
              <div className="game-board-warning" role="alert" aria-live="assertive">
                <CircleAlert size={18} aria-hidden="true" />
                <span>{error}</span>
                <button type="button" aria-label={t("common.close")} onClick={() => setError("")}>
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            )}
            <div className={`board-game-surface board-game-surface-${gameType}`}>
              <div
                className={`board-game-board board-game-${gameType}`}
                style={gameType === "go" || gameType === "xiangqi" ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                role="grid"
                aria-label={title}
              >
                {gameType === "xiangqi" && (
                  <div className="xiangqi-river" aria-hidden="true">
                    <span>楚河</span>
                    <span>漢界</span>
                  </div>
                )}
                {grid.flatMap((row, rowIndex) => row.map((piece, columnIndex) => {
                  const isSelected = selectedCell?.[0] === rowIndex && selectedCell[1] === columnIndex;
                  const isOccupied = Boolean(piece && piece !== "." && piece !== "-");
                  const isLastMovedPiece = Boolean(
                    lastMoveCoordinates
                    && lastMoveCoordinates.to[0] === rowIndex
                    && lastMoveCoordinates.to[1] === columnIndex
                    && isOccupied,
                  );
                  const isLastMoveOrigin = Boolean(
                    lastMoveCoordinates
                    && lastMoveCoordinates.from[0] === rowIndex
                    && lastMoveCoordinates.from[1] === columnIndex,
                  );
                  const squareTone = (rowIndex + columnIndex) % 2 === 0 ? " square-light" : " square-dark";
                  const sideClass = isOccupied && gameType !== "go"
                    ? (piece === piece.toUpperCase() ? " piece-light-side" : " piece-dark-side")
                    : "";
                  return (
                    <button
                      type="button"
                      role="gridcell"
                      key={`${rowIndex}-${columnIndex}`}
                      className={`board-game-square${gameType === "chess" ? squareTone : ""}${isSelected ? " selected" : ""}${isOccupied ? " occupied" : ""}${sideClass}${isLastMovedPiece ? " piece-move-active piece-move-target" : ""}${isLastMoveOrigin ? " piece-move-origin" : ""}${gameType === "go" && isOccupied ? ` stone-${piece.toLowerCase()}` : ""}`}
                      aria-label={t("community.games.board.cell", { row: rowIndex + 1, column: columnIndex + 1, piece: describePiece(gameType, piece, t) })}
                      onClick={() => chooseBoardCell(rowIndex, columnIndex)}
                      disabled={isLoading || finished || botTurnError || game.state.turn !== game.state.human}
                      style={gameType === "go"
                        ? {
                            left: `${5.5556 + columnIndex * 11.1111}%`,
                            top: `${5.5556 + rowIndex * 11.1111}%`,
                          }
                        : gameType === "xiangqi"
                          ? {
                              left: `${6.25 + columnIndex * 10.9375}%`,
                              top: `${5.5556 + rowIndex * 9.8765}%`,
                            }
                          : undefined}
                    >
                      {gameType === "go" ? null : isOccupied ? (
                        <span
                          className={isLastMovedPiece ? "board-game-piece-motion" : "board-game-piece-static"}
                          style={isLastMovedPiece && lastMoveCoordinates
                            ? {
                                "--piece-move-x": `${(lastMoveCoordinates.from[1] - columnIndex) * 100}%`,
                                "--piece-move-y": `${(lastMoveCoordinates.from[0] - rowIndex) * 100}%`,
                              } as CSSProperties
                            : undefined}
                        >
                          {gameType === "chess"
                            ? <ChessPiece piece={piece} />
                            : gameType === "xiangqi"
                              ? <XiangqiPiece piece={piece} />
                              : pieceSymbol(gameType, piece)}
                        </span>
                      ) : null}
                    </button>
                  );
                }))}
              </div>
              {showBoardResultAnimation && shouldShowBoardResultAnimation && (
                <div className={`board-game-result-overlay${won ? " board-game-result-victory" : " board-game-result-game-over"}`} aria-hidden="true">
                  <Lottie
                    src={won ? trophyAnimation : gameOverAnimation}
                    autoplay
                    loop={false}
                    className="board-game-result-lottie"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="board-game-replay-row">
            {!finished && (
              <button type="button" className="community-quiz-secondary board-game-surrender" onClick={() => void surrenderGame()} disabled={isLoading}>
                <Flag size={16} /> {t("community.games.board.surrender")}
              </button>
            )}
            {finished ? (
              <>
                <button type="button" className="community-quiz-primary board-game-replay" disabled={isLoading} onClick={() => void startGame()}>
                  <Gamepad2 size={18} /> {t("community.games.board.newGame")}
                </button>
                <button type="button" className="community-quiz-secondary board-game-replay" disabled={isLoading} onClick={returnToDifficultySelection}>
                  <ArrowLeft size={16} /> {t("community.games.board.back")}
                </button>
              </>
            ) : (
              <button type="button" className="community-quiz-secondary board-game-replay" disabled={isLoading} onClick={() => void returnToGameSetup()}>
                <ArrowLeft size={16} /> {t("community.games.board.back")}
              </button>
            )}
          </div>
          {gameType === "go" && !finished && game.state.turn === game.state.human && (
            <button type="button" className="community-quiz-primary board-game-pass" disabled={isLoading} onClick={() => void sendMove({ pass: true })}>
              {t("community.games.go.pass")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DescriptionIconForGame({ game }: { game: Exclude<GameType, "word_search"> }) {
  const Icon = game === "chess" ? Crown : game === "xiangqi" ? Shield : Grid3X3;
  return <Icon size={28} aria-hidden="true" />;
}

function getBoardMoveCoordinates(
  lastMove: Record<string, unknown> | null | undefined,
): { from: [number, number]; to: [number, number] } | null {
  const from = lastMove?.from;
  const to = lastMove?.to;
  if (!Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2) return null;
  const [fromRow, fromColumn] = from;
  const [toRow, toColumn] = to;
  if (![fromRow, fromColumn, toRow, toColumn].every(isBoardCoordinate)) return null;
  return {
    from: [fromRow, fromColumn],
    to: [toRow, toColumn],
  };
}

function isBoardCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 9;
}

function isHumanSide(game: Exclude<GameType, "word_search">, piece: string) {
  if (game === "go") return piece === "B";
  return piece === piece.toUpperCase();
}

function describePiece(
  game: Exclude<GameType, "word_search">,
  piece: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!piece || piece === ".") return t("community.games.board.emptyCell");
  return t(pieceMessageKeys[game][piece] ?? "community.games.board.occupiedCell");
}

function ChessPiece({ piece }: { piece: string }) {
  const kind = piece.toLowerCase();
  const isWhite = piece === piece.toUpperCase();
  const outline = isWhite ? "#8f7350" : "#111827";
  const detail = isWhite ? "#c3974f" : "#c8a767";
  const shape: Record<string, string> = {
    p: "M32 8a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM28 23h8c0 6 3 10 7 14l5 13H16l5-13c4-4 7-8 7-14ZM12 50h40v7H12z",
    r: "M14 9h9v8h6V9h7v8h6V9h9v15H46v20l6 7v6H12v-6l6-7V24h-4z",
    n: "M14 52h38v6H12zM17 49c2-9 5-16 12-21l-5-8 3-10 9 8c9-1 15 5 15 14v17H17ZM31 19l-2 5 7 3 2-4z",
    b: "M32 5 19 20l7 7-2 5c-2 6-5 11-10 17l-5 5v4h46v-4l-5-5c-5-6-8-11-10-17l-2-5 7-7z",
    q: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm20-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm20 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM15 17l7 17h20l7-17-10 8-7-14-7 14zM22 37c-2 5-5 9-9 14v5h38v-5c-4-5-7-9-9-14z",
    k: "M28 5h8v8h8v7h-8v6c1 5 4 9 8 13l4 10H16l4-10c4-4 7-8 8-13v-6h-8v-7h8zM12 51h40v6H12z",
  };
  const accents: Record<string, string> = {
    p: "M26 40h12M22 48h20",
    r: "M20 26h24M22 45h20",
    n: "M26 37c5-4 11-5 17-3M35 21l4 2",
    b: "M25 25 39 13M23 45h18",
    q: "M22 34h20M23 45h18",
    k: "M28 16h8M22 45h20",
  };

  if (!shape[kind]) return null;
  const pieceId = isWhite ? "white" : "black";
  const bodyGradient = `chess-piece-${pieceId}`;
  const sideGradient = `chess-piece-side-${pieceId}`;
  const sheenGradient = `chess-piece-sheen-${pieceId}`;
  const shadow = isWhite ? "#806a49" : "#090e18";
  return (
    <svg className="chess-piece-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={bodyGradient} x1="0" y1="0" x2="1" y2=".35">
          {isWhite ? (
            <>
              <stop offset="0" stopColor="#fffef7" />
              <stop offset=".28" stopColor="#f5e6bf" />
              <stop offset=".58" stopColor="#d7bc88" />
              <stop offset="1" stopColor="#a7834e" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#7e8da5" />
              <stop offset=".28" stopColor="#4a5870" />
              <stop offset=".62" stopColor="#283449" />
              <stop offset="1" stopColor="#111827" />
            </>
          )}
        </linearGradient>
        <linearGradient id={sideGradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={isWhite ? "#fff6d8" : "#73819a"} />
          <stop offset=".38" stopColor={isWhite ? "#d2b37b" : "#354258"} />
          <stop offset="1" stopColor={isWhite ? "#8f6e3d" : "#0b111c"} />
        </linearGradient>
        <linearGradient id={sheenGradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".64" />
          <stop offset=".32" stopColor="#fff" stopOpacity=".12" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={shape[kind]} transform="translate(0 3)" fill={shadow} stroke={shadow} strokeWidth="3" strokeLinejoin="round" />
      <path d={shape[kind]} transform="translate(0 1.5)" fill={`url(#${sideGradient})`} stroke={outline} strokeWidth="2.5" strokeLinejoin="round" />
      <path d={shape[kind]} fill={`url(#${bodyGradient})`} stroke={outline} strokeWidth="2.2" strokeLinejoin="round" />
      <path d={shape[kind]} fill={`url(#${sheenGradient})`} opacity=".55" />
      <path d="M17 53h30M14 56h36" fill="none" stroke={isWhite ? "#fff0c8" : "#8592a7"} strokeWidth="1" opacity=".7" />
      {kind === "p" && <><circle cx="32" cy="15" r="4" fill="none" stroke={detail} strokeWidth="1.5" /><path d="M22 51h20" fill="none" stroke={detail} strokeWidth="1.5" /></>}
      {kind === "b" && <path d="m35 13-6 10" fill="none" stroke={detail} strokeWidth="2.4" strokeLinecap="round" />}
      {kind === "q" && <g fill={detail}><circle cx="12" cy="12" r="1.5" /><circle cx="32" cy="8" r="1.5" /><circle cx="52" cy="12" r="1.5" /></g>}
      {kind === "k" && <path d="M32 7v9M28 11h8" fill="none" stroke={detail} strokeWidth="2" strokeLinecap="round" />}
      {kind !== "q" && kind !== "k" && <path d={accents[kind]} fill="none" stroke={detail} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
      {kind === "q" && <path d={accents.q} fill="none" stroke={detail} strokeWidth="1.5" strokeLinecap="round" />}
      {kind === "k" && <path d={accents.k} fill="none" stroke={detail} strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  );
}

function XiangqiPiece({ piece }: { piece: string }) {
  const symbols: Record<string, string> = {
    K: "帥", A: "仕", E: "相", H: "傌", R: "俥", C: "炮", P: "兵",
    k: "將", a: "士", e: "象", h: "馬", r: "車", c: "砲", p: "卒",
  };
  const symbol = symbols[piece];
  if (!symbol) return null;
  return <span className="xiangqi-piece-art" aria-hidden="true">{symbol}</span>;
}

function pieceSymbol(game: Exclude<GameType, "word_search">, piece: string) {
  return piece && piece !== "." ? "●" : "";
}
