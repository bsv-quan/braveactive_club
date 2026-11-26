import { notFound } from "next/navigation";
import { GameScreen, type GameSlug } from "@/components/games/game-screen";
import { AppShell } from "@/components/layout/app-shell";

const gameSlugs = new Set<GameSlug>(["word-search", "chess", "xiangqi", "go"]);

function isGameSlug(value: string): value is GameSlug {
  return gameSlugs.has(value as GameSlug);
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  if (!isGameSlug(game)) notFound();

  return (
    <AppShell currentPage="community">
      <GameScreen game={game} />
    </AppShell>
  );
}
