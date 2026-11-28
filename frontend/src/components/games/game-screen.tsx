"use client";

import { ArcadeHub } from "@/components/games/arcade-hub";
import type { ArcadeGameSlug } from "@/lib/games/registry";

export type GameSlug = ArcadeGameSlug;

/** Legacy adapter delegating directly to the unified modular `ArcadeHub`. */
export function GameScreen({ game }: { game: GameSlug }) {
  return <ArcadeHub initialGame={game} />;
}
