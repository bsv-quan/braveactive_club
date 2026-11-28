"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lottie } from "lottie-react";
import {
  ArrowLeft,
  CircleAlert,
  Eraser,
  Gamepad2,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Sparkles,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import trophyAnimation from "@/components/games/animations/trophy.json";
import { GameZoneIllustration } from "@/components/games/illustrations/game-zone-illustration";
import { useDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/i18n/i18n-provider";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  communityApi,
  type GameDifficulty,
  type SudokuStateResponse,
} from "@/lib/api/community";
import { consumeGuestHint, readGuestHintsRemaining } from "@/lib/games/guest-progress";
import { DifficultyDisplay, DifficultyPicker } from "./difficulty-controls";

type SudokuArenaProps = {
  difficulty: GameDifficulty;
  onDifficultyChange: (value: GameDifficulty) => void;
  score: number;
  onScoreChange: (value: number) => void;
  onCompleted: () => void;
  onHintUsed?: () => void;
  onActiveChange: (active: boolean) => void;
  freeHintsRemaining: number;
  pointsBalance: number;
  isMember: boolean;
};

type NotesGrid = number[][][]; // 9x9 array of sorted candidate digits

type UndoSnapshot = {
  board: number[][];
  notes: NotesGrid;
};

const SUDOKU_REWARD_POINTS: Record<GameDifficulty, number> = {
  easy: 100,
  medium: 250,
  hard: 500,
};

function createEmptyNotes(): NotesGrid {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

function cloneNotes(notes: NotesGrid): NotesGrid {
  return notes.map((row) => row.map((cell) => [...cell]));
}

function findConflicts(board: number[][]): Set<string> {
  const conflicts = new Set<string>();
  for (let r = 0; r < 9; r += 1) {
    const seen = new Map<number, number[]>();
    for (let c = 0; c < 9; c += 1) {
      const v = board[r][c];
      if (!v) continue;
      const list = seen.get(v) ?? [];
      list.push(c);
      seen.set(v, list);
    }
    for (const cols of seen.values()) {
      if (cols.length > 1) cols.forEach((c) => conflicts.add(`${r}-${c}`));
    }
  }
  for (let c = 0; c < 9; c += 1) {
    const seen = new Map<number, number[]>();
    for (let r = 0; r < 9; r += 1) {
      const v = board[r][c];
      if (!v) continue;
      const list = seen.get(v) ?? [];
      list.push(r);
      seen.set(v, list);
    }
    for (const rows of seen.values()) {
      if (rows.length > 1) rows.forEach((r) => conflicts.add(`${r}-${c}`));
    }
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const seen = new Map<number, [number, number][]>();
      for (let r = br; r < br + 3; r += 1) {
        for (let c = bc; c < bc + 3; c += 1) {
          const v = board[r][c];
          if (!v) continue;
          const list = seen.get(v) ?? [];
          list.push([r, c]);
          seen.set(v, list);
        }
      }
      for (const cells of seen.values()) {
        if (cells.length > 1) cells.forEach(([r, c]) => conflicts.add(`${r}-${c}`));
      }
    }
  }
  return conflicts;
}

function isBoardSolvedLocally(board: number[][], conflicts: Set<string>): boolean {
  if (conflicts.size > 0) return false;
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (board[r][c] < 1 || board[r][c] > 9) return false;
    }
  }
  return true;
}

export function SudokuArena({
  difficulty,
  onDifficultyChange,
  score,
  onScoreChange,
  onCompleted,
  onHintUsed,
  onActiveChange,
  freeHintsRemaining,
  pointsBalance,
  isMember,
}: SudokuArenaProps) {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const [game, setGame] = useState<SudokuStateResponse | null>(null);
  const [board, setBoard] = useState<number[][]>([]);
  const [notes, setNotes] = useState<NotesGrid>(() => createEmptyNotes());
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [guestScore, setGuestScore] = useState(0);
  const [guestHintsRemaining, setGuestHintsRemaining] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [showVictoryAnim, setShowVictoryAnim] = useState(false);
  const [error, setError] = useState("");

  const mountedRef = useRef(true);
  const syncTimerRef = useRef<number | null>(null);
  const latestBoardRef = useRef<number[][]>([]);
  latestBoardRef.current = board;
  const gameRef = useRef<SudokuStateResponse | null>(null);
  gameRef.current = game;
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isMember) setGuestHintsRemaining(readGuestHintsRemaining());
  }, [isMember]);

  // Resume active Sudoku round for signed-in members
  useEffect(() => {
    if (!isMember) return;
    let cancelled = false;
    setIsLoading(true);
    communityApi
      .getActiveSudoku()
      .then((saved) => {
        if (cancelled || !saved) return;
        setGame(saved);
        setBoard(cloneBoard(saved.board));
        setNotes(createEmptyNotes());
        setUndoStack([]);
        onDifficultyChange(saved.difficulty);
        onScoreChange(saved.score);
      })
      .catch(() => {
        if (!cancelled) setError(t("community.games.board.resumeError"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isMember, onDifficultyChange, onScoreChange, t]);

  const completed = Boolean(game?.completed);

  useEffect(() => {
    onActiveChange(Boolean(game && !completed));
  }, [game, completed, onActiveChange]);

  useEffect(() => {
    if (!completed) {
      setShowVictoryAnim(false);
      return;
    }
    setShowVictoryAnim(true);
    const timer = window.setTimeout(() => setShowVictoryAnim(false), 3200);
    return () => window.clearTimeout(timer);
  }, [completed]);

  const conflicts = useMemo(() => (board.length === 9 ? findConflicts(board) : new Set<string>()), [board]);

  const hintedSet = useMemo(() => {
    const set = new Set<string>();
    for (const [r, c] of game?.hintedCells ?? []) {
      set.add(`${r}-${c}`);
    }
    return set;
  }, [game?.hintedCells]);

  const digitCounts = useMemo(() => {
    const counts = Array<number>(10).fill(0);
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const val = board[r]?.[c] ?? 0;
        if (val >= 1 && val <= 9) counts[val] += 1;
      }
    }
    return counts;
  }, [board]);

  const filledCount = useMemo(
    () => digitCounts.slice(1).reduce((sum, count) => sum + count, 0),
    [digitCounts],
  );

  const selectedValue = selected && board.length === 9 ? board[selected[0]][selected[1]] : 0;

  const flushSync = useCallback(
    async (nextBoard: number[][]) => {
      const current = gameRef.current;
      if (!current?.roundId || current.completed) return;
      try {
        const updated = await communityApi.syncSudoku(current.roundId, nextBoard);
        if (!mountedRef.current) return;
        setGame(updated);
        onScoreChange(updated.score);
        if (updated.completed) {
          onCompletedRef.current();
        }
      } catch (reason) {
        if (!mountedRef.current) return;
        setError(errorMessage(reason, t("community.games.score.saveError")));
      }
    },
    [onScoreChange, t],
  );

  const scheduleSync = useCallback(
    (nextBoard: number[][], immediate = false) => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      const current = gameRef.current;
      if (!current?.roundId || current.completed) return;
      if (immediate) {
        void flushSync(nextBoard);
      } else {
        syncTimerRef.current = window.setTimeout(() => {
          syncTimerRef.current = null;
          void flushSync(latestBoardRef.current);
        }, 280);
      }
    },
    [flushSync],
  );

  async function startNewGame(discardActive = false) {
    setIsLoading(true);
    setError("");
    try {
      if (discardActive && isMember) {
        await communityApi.abandonActiveSudoku();
      }
      const started = await communityApi.startSudoku(difficulty);
      if (!mountedRef.current) return;
      setGame(started);
      setBoard(cloneBoard(started.board));
      setNotes(createEmptyNotes());
      setUndoStack([]);
      setSelected(null);
      setNotesMode(false);
      setGuestScore(0);
      onDifficultyChange(started.difficulty);
      onScoreChange(started.score);
    } catch (reason) {
      if (!mountedRef.current) return;
      setError(errorMessage(reason, t("community.games.sudoku.startError")));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }

  async function returnToSetup() {
    if (!game) return;
    if (!completed) {
      const shouldLeave = await confirm({
        title: t("common.confirmTitle"),
        message: t("community.games.board.restartConfirm"),
        confirmLabel: t("common.confirm"),
        tone: "danger",
      });
      if (!shouldLeave) return;
      if (isMember) {
        try {
          await communityApi.abandonActiveSudoku();
        } catch {
          setError(t("community.games.board.abandonError"));
          return;
        }
      }
    }
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    setGame(null);
    setBoard([]);
    setNotes(createEmptyNotes());
    setUndoStack([]);
    setSelected(null);
    setGuestScore(0);
    setError("");
    onScoreChange(0);
  }

  const applyDigit = useCallback(
    (digit: number) => {
      if (!game || completed || !selected || isHintLoading) return;
      const [row, col] = selected;
      if (game.puzzle[row][col] !== 0) return; // Given clue is immutable

      setError("");

      if (notesMode && digit > 0) {
        // Toggle pencil mark on empty cell
        if (board[row][col] !== 0) return;
        setUndoStack((prev) => [...prev.slice(-29), { board: cloneBoard(board), notes: cloneNotes(notes) }]);
        const nextNotes = cloneNotes(notes);
        const existing = nextNotes[row][col];
        nextNotes[row][col] = existing.includes(digit)
          ? existing.filter((n) => n !== digit)
          : [...existing, digit].sort((a, b) => a - b);
        setNotes(nextNotes);
        return;
      }

      if (board[row][col] === digit) return;
      setUndoStack((prev) => [...prev.slice(-29), { board: cloneBoard(board), notes: cloneNotes(notes) }]);

      const nextBoard = cloneBoard(board);
      nextBoard[row][col] = digit;
      const nextNotes = cloneNotes(notes);
      nextNotes[row][col] = [];

      // Automatically prune placed digit from peer pencil notes
      if (digit > 0) {
        for (let i = 0; i < 9; i += 1) {
          nextNotes[row][i] = nextNotes[row][i].filter((n) => n !== digit);
          nextNotes[i][col] = nextNotes[i][col].filter((n) => n !== digit);
        }
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r += 1) {
          for (let c = bc; c < bc + 3; c += 1) {
            nextNotes[r][c] = nextNotes[r][c].filter((n) => n !== digit);
          }
        }
      }

      setBoard(nextBoard);
      setNotes(nextNotes);

      const nextConflicts = findConflicts(nextBoard);
      const solvedNow = isBoardSolvedLocally(nextBoard, nextConflicts);

      if (game.roundId) {
        scheduleSync(nextBoard, solvedNow);
      } else if (solvedNow) {
        const earned = SUDOKU_REWARD_POINTS[game.difficulty];
        setGuestScore(earned);
        onScoreChange(earned);
        setGame((prev) => (prev ? { ...prev, board: nextBoard, completed: true, score: earned, scoreAwarded: earned } : prev));
        onCompletedRef.current();
      }
    },
    [board, completed, game, isHintLoading, notes, notesMode, onScoreChange, scheduleSync, selected],
  );

  const handleUndo = useCallback(() => {
    if (!game || completed || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setBoard(prev.board);
    setNotes(prev.notes);
    if (game.roundId) {
      scheduleSync(prev.board, false);
    }
  }, [completed, game, scheduleSync, undoStack]);

  async function handleHint() {
    if (!game || completed || isHintLoading) return;
    setIsHintLoading(true);
    setError("");
    try {
      if (game.roundId) {
        if (syncTimerRef.current !== null) {
          window.clearTimeout(syncTimerRef.current);
          syncTimerRef.current = null;
        }
        const res = await communityApi.useSudokuHint(game.roundId, {
          row: selected?.[0],
          col: selected?.[1],
          board,
        });
        if (!mountedRef.current) return;
        setBoard(cloneBoard(res.board));
        setGame((prev) =>
          prev
            ? {
                ...prev,
                board: res.board,
                hintedCells: res.hintedCells,
                completed: res.completed,
                score: res.score,
                scoreAwarded: res.scoreAwarded,
              }
            : prev,
        );
        if (res.row !== null && res.col !== null) {
          setSelected([res.row, res.col]);
          setNotes((prev) => {
            const next = cloneNotes(prev);
            next[res.row!][res.col!] = [];
            return next;
          });
        }
        onScoreChange(res.score);
        onHintUsed?.();
        if (res.completed) {
          onCompletedRef.current();
        }
      } else {
        // Guest local hint using client-held guest solution
        const solution = game.solution;
        if (!solution) return;
        if (guestHintsRemaining <= 0) {
          setError(t("community.games.wordSearch.guestHintsUsed"));
          return;
        }
        let target: [number, number] | null = null;
        if (
          selected &&
          game.puzzle[selected[0]][selected[1]] === 0 &&
          board[selected[0]][selected[1]] !== solution[selected[0]][selected[1]]
        ) {
          target = selected;
        } else {
          for (let r = 0; r < 9 && !target; r += 1) {
            for (let c = 0; c < 9; c += 1) {
              if (game.puzzle[r][c] === 0 && board[r][c] !== solution[r][c]) {
                target = [r, c];
                break;
              }
            }
          }
        }
        if (!target) return;
        const remaining = consumeGuestHint();
        setGuestHintsRemaining(remaining);
        const [tr, tc] = target;
        const nextBoard = cloneBoard(board);
        nextBoard[tr][tc] = solution[tr][tc];
        setBoard(nextBoard);
        setSelected([tr, tc]);
        const nextConflicts = findConflicts(nextBoard);
        const solvedNow = isBoardSolvedLocally(nextBoard, nextConflicts);
        const nextHinted: [number, number][] = [...game.hintedCells, [tr, tc]];
        if (solvedNow) {
          const earned = SUDOKU_REWARD_POINTS[game.difficulty];
          setGuestScore(earned);
          onScoreChange(earned);
          setGame((prev) =>
            prev
              ? { ...prev, board: nextBoard, hintedCells: nextHinted, completed: true, score: earned, scoreAwarded: earned }
              : prev,
          );
          onCompletedRef.current();
        } else {
          setGame((prev) => (prev ? { ...prev, board: nextBoard, hintedCells: nextHinted } : prev));
        }
      }
    } catch (reason) {
      if (!mountedRef.current) return;
      setError(
        reason instanceof ApiError && reason.status === 409
          ? t("community.games.wordSearch.insufficientPoints")
          : errorMessage(reason, t("community.games.score.saveError")),
      );
    } finally {
      if (mountedRef.current) setIsHintLoading(false);
    }
  }

  // Keyboard shortcuts when a puzzle is active
  useEffect(() => {
    if (!game || completed) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      ) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (event.key >= "1" && event.key <= "9") {
        event.preventDefault();
        applyDigit(Number(event.key));
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
        event.preventDefault();
        applyDigit(0);
        return;
      }
      if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setNotesMode((v) => !v);
        return;
      }
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        setSelected((cur) => {
          const [r, c] = cur ?? [0, 0];
          if (event.key === "ArrowUp") return [(r + 8) % 9, c];
          if (event.key === "ArrowDown") return [(r + 1) % 9, c];
          if (event.key === "ArrowLeft") return [r, (c + 8) % 9];
          return [r, (c + 1) % 9];
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyDigit, completed, game, handleUndo]);

  const availableHints = isMember ? freeHintsRemaining : guestHintsRemaining;
  const canAffordPaidHint = isMember && pointsBalance >= 100;

  return (
    <div className="game-play-card sudoku-card">
      <div className="game-play-card-header">
        <div>
          <h2>{t("community.games.sudoku.playTitle")}</h2>
          <p>{t("community.games.sudoku.playDescription")}</p>
        </div>
        {game && !completed ? (
          <DifficultyDisplay value={game.difficulty} game="sudoku" showReward={false} />
        ) : (
          <DifficultyPicker
            value={difficulty}
            onChange={onDifficultyChange}
            game="sudoku"
            disabled={isLoading}
            showReward={false}
          />
        )}
      </div>

      <div className="board-game-points">
        <div className="board-game-stat">
          <span>{t("community.games.score.points", { score: isMember ? score : guestScore })}</span>
        </div>
        <div className="board-game-stat board-game-stat-reward">
          <span>
            {t(`community.games.sudoku.difficultyPoints.${game && !completed ? game.difficulty : difficulty}`)}
          </span>
        </div>
        {game ? (
          <div className="board-game-stat">
            <span>{t("community.games.sudoku.progress", { filled: filledCount, total: 81 })}</span>
          </div>
        ) : null}
      </div>

      {!game ? (
        <div className="game-start-panel game-start-illustrated">
          <div className="game-start-art-frame">
            <GameZoneIllustration slug="sudoku" />
          </div>
          <h3>{t("community.games.sudoku.readyTitle")}</h3>
          <p>{t("community.games.sudoku.readyDescription")}</p>
          {error ? (
            <div className="game-board-warning game-board-warning-start" role="alert" aria-live="assertive">
              <CircleAlert size={18} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" aria-label={t("common.close")} onClick={() => setError("")}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="community-quiz-primary"
            onClick={() => void startNewGame(false)}
            disabled={isLoading}
          >
            {isLoading ? <LoaderCircle className="ui-spin" size={16} /> : <Gamepad2 size={16} />}
            {t("community.games.board.start")}
          </button>
        </div>
      ) : (
        <>
          {completed ? (
            <p className="board-game-turn board-game-result-message" role="status" aria-live="polite">
              <Sparkles size={16} aria-hidden="true" />
              {t("community.games.sudoku.completed", {
                points: SUDOKU_REWARD_POINTS[game.difficulty],
              })}
            </p>
          ) : conflicts.size > 0 ? (
            <p className="board-game-turn is-in-check" role="status" aria-live="polite">
              <CircleAlert size={15} aria-hidden="true" />
              {t("community.games.sudoku.conflictWarning")}
            </p>
          ) : (
            <p className="board-game-turn" role="status" aria-live="polite">
              {notesMode
                ? t("community.games.sudoku.notesActiveHint")
                : t("community.games.sudoku.playHint")}
            </p>
          )}

          {error ? (
            <div className="game-board-warning game-board-warning-start" role="alert" aria-live="assertive">
              <CircleAlert size={18} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" aria-label={t("common.close")} onClick={() => setError("")}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <div className="sudoku-stage">
            <div className="sudoku-board-wrap">
              <div
                className="sudoku-grid"
                role="grid"
                aria-label={t("community.games.sudoku.title")}
              >
                {board.map((row, rIdx) =>
                  row.map((val, cIdx) => {
                    const key = `${rIdx}-${cIdx}`;
                    const isGiven = game.puzzle[rIdx][cIdx] !== 0;
                    const isHinted = hintedSet.has(key);
                    const isSelected = selected?.[0] === rIdx && selected?.[1] === cIdx;
                    const isPeer =
                      selected !== null &&
                      !isSelected &&
                      (selected[0] === rIdx ||
                        selected[1] === cIdx ||
                        (Math.floor(selected[0] / 3) === Math.floor(rIdx / 3) &&
                          Math.floor(selected[1] / 3) === Math.floor(cIdx / 3)));
                    const isSameDigit = Boolean(selectedValue && val === selectedValue && !isSelected);
                    const isConflict = conflicts.has(key);
                    const cellNotes = notes[rIdx]?.[cIdx] ?? [];

                    return (
                      <button
                        type="button"
                        role="gridcell"
                        key={key}
                        className={[
                          "sudoku-cell",
                          isGiven ? "is-given" : "is-editable",
                          isHinted ? "is-hinted" : "",
                          isSelected ? "is-selected" : "",
                          isPeer ? "is-peer" : "",
                          isSameDigit ? "is-same-digit" : "",
                          isConflict ? "is-conflict" : "",
                          cIdx === 2 || cIdx === 5 ? "box-right" : "",
                          rIdx === 2 || rIdx === 5 ? "box-bottom" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-label={t("community.games.sudoku.cellLabel", {
                          row: rIdx + 1,
                          col: cIdx + 1,
                          value: val ? String(val) : t("community.games.board.emptyCell"),
                        })}
                        aria-selected={isSelected}
                        onClick={() => setSelected([rIdx, cIdx])}
                      >
                        {val > 0 ? (
                          <span className="sudoku-digit">{val}</span>
                        ) : cellNotes.length > 0 ? (
                          <span className="sudoku-notes" aria-hidden="true">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                              <span key={n}>{cellNotes.includes(n) ? n : ""}</span>
                            ))}
                          </span>
                        ) : null}
                      </button>
                    );
                  }),
                )}
              </div>

              {showVictoryAnim && completed ? (
                <div className="board-game-result-overlay board-game-result-victory" aria-hidden="true">
                  <Lottie
                    src={trophyAnimation}
                    autoplay
                    loop={false}
                    className="board-game-result-lottie"
                  />
                </div>
              ) : null}
            </div>

            {!completed ? (
              <div className="sudoku-controls">
                <div className="sudoku-tool-row">
                  <button
                    type="button"
                    className="sudoku-tool-btn"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                  >
                    <Undo2 size={15} aria-hidden="true" />
                    <span>{t("community.games.sudoku.undo")}</span>
                  </button>
                  <button
                    type="button"
                    className="sudoku-tool-btn"
                    onClick={() => applyDigit(0)}
                    disabled={!selected || (selected && game.puzzle[selected[0]][selected[1]] !== 0)}
                  >
                    <Eraser size={15} aria-hidden="true" />
                    <span>{t("community.games.sudoku.erase")}</span>
                  </button>
                  <button
                    type="button"
                    className={`sudoku-tool-btn${notesMode ? " is-active" : ""}`}
                    aria-pressed={notesMode}
                    onClick={() => setNotesMode((v) => !v)}
                  >
                    <Pencil size={15} aria-hidden="true" />
                    <span>{t("community.games.sudoku.notes")}</span>
                  </button>
                  <button
                    type="button"
                    className="sudoku-tool-btn is-hint"
                    onClick={() => void handleHint()}
                    disabled={isHintLoading || (availableHints <= 0 && !canAffordPaidHint)}
                  >
                    {isHintLoading ? (
                      <LoaderCircle className="ui-spin" size={15} aria-hidden="true" />
                    ) : (
                      <WandSparkles size={15} aria-hidden="true" />
                    )}
                    <span>
                      {availableHints > 0
                        ? t("community.games.sudoku.hintFree", { count: availableHints })
                        : t("community.games.sudoku.hintPaid")}
                    </span>
                  </button>
                </div>

                <div className="sudoku-numpad" role="group" aria-label={t("community.games.sudoku.numpadAria")}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
                    const remaining = Math.max(0, 9 - digitCounts[digit]);
                    const isDone = remaining === 0;
                    return (
                      <button
                        key={digit}
                        type="button"
                        className={`sudoku-num-btn${isDone ? " is-done" : ""}${
                          selectedValue === digit ? " is-highlighted" : ""
                        }`}
                        onClick={() => applyDigit(digit)}
                        disabled={!selected || (selected && game.puzzle[selected[0]][selected[1]] !== 0)}
                      >
                        <strong>{digit}</strong>
                        <small aria-hidden="true">{remaining}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="board-game-replay-row">
            {completed ? (
              <>
                <button
                  type="button"
                  className="community-quiz-primary board-game-replay"
                  disabled={isLoading}
                  onClick={() => void startNewGame(false)}
                >
                  <RotateCcw size={16} /> {t("community.games.board.newGame")}
                </button>
                <button
                  type="button"
                  className="community-quiz-secondary board-game-replay"
                  disabled={isLoading}
                  onClick={() => void returnToSetup()}
                >
                  <ArrowLeft size={16} /> {t("community.games.board.back")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="community-quiz-secondary board-game-replay"
                disabled={isLoading}
                onClick={() => void returnToSetup()}
              >
                <ArrowLeft size={16} /> {t("community.games.board.back")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
