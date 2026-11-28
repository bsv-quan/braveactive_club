"use client";

import { useI18n } from "@/i18n/i18n-provider";
import type { GameDifficulty } from "@/lib/api/community";

export const DIFFICULTY_OPTIONS: readonly GameDifficulty[] = ["easy", "medium", "hard"];

export function isGameDifficulty(value: unknown): value is GameDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

export function DifficultyPicker({
  value,
  onChange,
  game,
  disabled = false,
  showReward = true,
}: {
  value: GameDifficulty;
  onChange: (value: GameDifficulty) => void;
  game: "wordSearch" | "chess" | "xiangqi" | "go" | "caro" | "sudoku";
  disabled?: boolean;
  showReward?: boolean;
}) {
  const { t } = useI18n();
  return (
    <label className="game-difficulty-picker">
      <span>{t("community.games.difficultyLabel")}</span>
      <select
        className="ui-select"
        value={value}
        onChange={(event) => onChange(event.target.value as GameDifficulty)}
        disabled={disabled}
      >
        {DIFFICULTY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(`community.games.difficulties.${option}`)}
          </option>
        ))}
      </select>
      {showReward ? <small>{t(`community.games.${game}.difficultyPoints.${value}`)}</small> : null}
    </label>
  );
}

export function DifficultyDisplay({
  value,
  game,
  showReward = true,
}: {
  value: GameDifficulty;
  game: "wordSearch" | "chess" | "xiangqi" | "go" | "caro" | "sudoku";
  showReward?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className="game-difficulty-display"
      aria-label={`${t("community.games.difficultyLabel")}: ${t(`community.games.difficulties.${value}`)}`}
    >
      <span>{t("community.games.difficultyLabel")}</span>
      <strong>{t(`community.games.difficulties.${value}`)}</strong>
      {showReward ? <small>{t(`community.games.${game}.difficultyPoints.${value}`)}</small> : null}
    </div>
  );
}
