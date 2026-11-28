import { notFound } from "next/navigation";
import { ArcadeHub } from "@/components/games/arcade-hub";
import { isArcadeGameSlug } from "@/lib/games/registry";

export default async function GameZonePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  if (!isArcadeGameSlug(game)) notFound();

  return <ArcadeHub initialGame={game} />;
}
