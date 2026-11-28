import { ArcadeHub } from "@/components/games/arcade-hub";

export const metadata = {
  title: "Dev vs AI — braveActive Club",
  description:
    "2D pixel tower defense on an LLM neural grid: deploy mecha-flower robots, collect TOKENs, and defend Production!",
};

export default function DevVsAiPage() {
  return <ArcadeHub initialGame="dev-vs-ai" />;
}
