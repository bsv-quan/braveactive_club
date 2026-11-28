"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import { GameZoneIllustration } from "@/components/games/illustrations/game-zone-illustration";
import { useI18n } from "@/i18n/i18n-provider";
import { ApiError } from "@/lib/api/client";
import { communityApi, type GameDifficulty, type WordSearchPuzzle } from "@/lib/api/community";
import { consumeGuestHint, readGuestHintsRemaining } from "@/lib/games/guest-progress";
import { updateWordSearchSelection } from "@/lib/word-search";
import { DifficultyDisplay, DifficultyPicker } from "./difficulty-controls";

type WordSearchArenaProps = {
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

function findWordStart(data: WordSearchPuzzle, word: string): number | null {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;
  for (let row = 0; row < data.size; row += 1) {
    for (let column = 0; column < data.size; column += 1) {
      for (const [dr, dc] of directions) {
        const endRow = row + (word.length - 1) * dr;
        const endColumn = column + (word.length - 1) * dc;
        if (endRow < 0 || endRow >= data.size || endColumn < 0 || endColumn >= data.size) continue;
        const cells = Array.from({ length: word.length }, (_, i) => data.grid[row + i * dr][column + i * dc]);
        if (cells.join("") === word) return row * data.size + column;
      }
    }
  }
  return null;
}

export function WordSearchArena({
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
}: WordSearchArenaProps) {
  const { t, locale } = useI18n();
  const [puzzle, setPuzzle] = useState<WordSearchPuzzle | null>(null);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [foundWords, setFoundWords] = useState<number[]>([]);
  const [foundCells, setFoundCells] = useState<number[]>([]);
  const [hintedCell, setHintedCell] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | "invalid" | null>(null);
  const [guestHintsRemaining, setGuestHintsRemaining] = useState(2);
  const [roundDifficulty, setRoundDifficulty] = useState<GameDifficulty>("medium");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isComplete = Boolean(puzzle && foundWords.length === puzzle.words.length);

  useEffect(() => {
    onActiveChange(Boolean(puzzle && !isComplete));
  }, [puzzle, isComplete, onActiveChange]);

  useEffect(() => {
    if (!isMember) setGuestHintsRemaining(readGuestHintsRemaining());
  }, [isMember]);

  const selectedLetters = useMemo(
    () =>
      puzzle
        ? selectedCells
            .map((index) => puzzle.grid[Math.floor(index / puzzle.size)][index % puzzle.size])
            .join("")
        : "",
    [puzzle, selectedCells],
  );

  async function createPuzzle() {
    const selectedDifficulty = difficulty;
    setIsLoading(true);
    setError("");
    try {
      const generated = await communityApi.generateWordSearch({
        difficulty: selectedDifficulty,
        locale,
      });
      setPuzzle(generated);
      setRoundDifficulty(selectedDifficulty);
      setSelectedCells([]);
      setFoundWords([]);
      setFoundCells([]);
      setHintedCell(null);
      setFeedback(null);
      onScoreChange(0);
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status === 429
          ? t("community.games.wordSearch.rateLimited")
          : reason instanceof ApiError && reason.status === 503
            ? t("community.games.wordSearch.aiUnavailable")
            : t("community.games.wordSearch.generateError"),
      );
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
      const match = puzzle.words.findIndex(
        ({ answer }, index) => answer === selectedWord && !foundWords.includes(index),
      );
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
        onHintUsed?.();
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
        setGuestHintsRemaining(consumeGuestHint());
        setHintedCell(cell);
        setSelectedCells([]);
        setFeedback(null);
      }
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status === 409
          ? t("community.games.wordSearch.insufficientPoints")
          : t("community.games.score.saveError"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="game-play-card">
      <div className="game-play-card-header">
        <div>
          <h2>{t("community.games.wordSearch.playTitle")}</h2>
          <p>{t("community.games.wordSearch.playDescription")}</p>
        </div>
        {puzzle && !isComplete ? (
          <DifficultyDisplay value={roundDifficulty} game="wordSearch" />
        ) : (
          <DifficultyPicker
            value={difficulty}
            onChange={onDifficultyChange}
            game="wordSearch"
            disabled={isLoading}
          />
        )}
      </div>

      {error ? (
        <p className="community-word-search-error" role="alert">
          {error}
        </p>
      ) : null}

      {!puzzle ? (
        <div className="game-start-panel game-start-illustrated">
          <div className="game-start-art-frame">
            <GameZoneIllustration slug="word-search" />
          </div>
          <h3>{t("community.games.wordSearch.customizeTitle")}</h3>
          <p>{t("community.games.wordSearch.customizeIntro")}</p>
          <button
            type="button"
            className="community-quiz-primary"
            onClick={() => void createPuzzle()}
            disabled={isLoading}
          >
            {isLoading ? <LoaderCircle className="ui-spin" size={16} /> : <WandSparkles size={16} />}
            {t(isLoading ? "community.games.wordSearch.generating" : "community.games.wordSearch.generate")}
          </button>
        </div>
      ) : (
        <>
          <div className="game-round-meta">
            <span>
              {t("community.games.wordSearch.found", {
                found: foundWords.length,
                total: puzzle.words.length,
              })}
            </span>
            {isMember ? (
              <span>{t("community.games.wordSearch.pointBalance", { count: pointsBalance })}</span>
            ) : null}
            <span>
              {t("community.games.wordSearch.hintsRemaining", {
                count: isMember ? freeHintsRemaining : guestHintsRemaining,
                cost: 100,
              })}
            </span>
          </div>

          {isComplete ? (
            <div className="game-result-panel game-result-win" role="status">
              <span className="game-result-confetti" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => (
                  <i key={index} />
                ))}
              </span>
              <Sparkles className="game-result-icon" size={30} aria-hidden="true" />
              <h3>{t("community.games.wordSearch.complete")}</h3>
              <strong>{t("community.games.score.points", { score })}</strong>
              <ul className="community-word-search-completed-answers">
                {puzzle.words.map(({ displayAnswer, clue }) => (
                  <li key={displayAnswer}>
                    <span>{clue}</span>
                    <strong>{t("community.games.wordSearch.answer", { answer: displayAnswer })}</strong>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="community-quiz-primary"
                onClick={() => void createPuzzle()}
                disabled={isLoading}
              >
                <RotateCcw size={16} /> {t("community.games.playAgain")}
              </button>
            </div>
          ) : (
            <div className="word-search-screen-layout">
              <div
                className="community-word-search-grid"
                style={{
                  gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))`,
                  width: `min(100%, ${Math.min(puzzle.size * 36, 460)}px)`,
                }}
                role="group"
                aria-label={t("community.games.wordSearch.board")}
              >
                {puzzle.grid.flatMap((row, rowIndex) =>
                  row.map((letter, columnIndex) => {
                    const index = rowIndex * puzzle.size + columnIndex;
                    const selected = selectedCells.includes(index);
                    const found = foundCells.includes(index);
                    return (
                      <button
                        type="button"
                        key={index}
                        className={`community-word-search-cell${found ? " found" : ""}${
                          hintedCell === index ? " hinted" : ""
                        }${selected ? " selected" : ""}`}
                        aria-label={t(
                          found
                            ? "community.games.wordSearch.foundCell"
                            : "community.games.wordSearch.cell",
                          { row: rowIndex + 1, column: columnIndex + 1, letter },
                        )}
                        aria-pressed={selected || found}
                        onClick={() => chooseCell(index)}
                      >
                        {letter}
                      </button>
                    );
                  }),
                )}
              </div>

              <div className="word-search-clue-panel">
                <ul className="community-word-search-clues">
                  {puzzle.words.map(({ answer, clue, displayAnswer }, index) => (
                    <li key={`${answer}-${index}`} className={foundWords.includes(index) ? "found" : ""}>
                      <span aria-hidden="true">{foundWords.includes(index) ? "✓" : "·"}</span>
                      <span className="community-word-search-clue-copy">
                        {clue} ({answer.length})
                        {foundWords.includes(index) ? (
                          <strong className="community-word-search-answer">
                            {t("community.games.wordSearch.answer", { answer: displayAnswer })}
                          </strong>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>

                <p>
                  {selectedLetters
                    ? t("community.games.wordSearch.selectionPreview", {
                        letters: selectedLetters,
                        length: selectedLetters.length,
                      })
                    : t("community.games.wordSearch.selectStart")}
                </p>

                {feedback ? (
                  <strong className={feedback === "correct" ? "correct" : "incorrect"} role="status">
                    {t(`community.games.wordSearch.${feedback}`)}
                  </strong>
                ) : null}

                {hintedCell !== null ? (
                  <p className="community-word-search-hint">
                    {t("community.games.wordSearch.hint", {
                      letter: puzzle.grid[Math.floor(hintedCell / puzzle.size)][hintedCell % puzzle.size],
                      row: Math.floor(hintedCell / puzzle.size) + 1,
                      column: (hintedCell % puzzle.size) + 1,
                    })}
                  </p>
                ) : null}

                <div className="community-word-search-actions">
                  <button
                    type="button"
                    className="community-quiz-primary community-word-search-hint-button"
                    disabled={
                      isLoading ||
                      (isMember ? freeHintsRemaining === 0 && pointsBalance < 100 : guestHintsRemaining === 0)
                    }
                    onClick={() => void useHint()}
                  >
                    <WandSparkles size={15} /> {t("community.games.wordSearch.hintButton")}
                  </button>
                  <button
                    type="button"
                    className="community-quiz-primary"
                    disabled={selectedCells.length < 2 || isLoading}
                    onClick={() => void confirmSelection()}
                  >
                    {isLoading ? <LoaderCircle className="ui-spin" size={15} /> : null}
                    {t("community.games.wordSearch.confirmSelection")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
