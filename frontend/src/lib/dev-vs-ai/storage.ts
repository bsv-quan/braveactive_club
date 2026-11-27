import {
  INITIAL_UNLOCKED_ROBOTS,
  ROBOT_ORDER,
  STAGES,
  type RobotId,
} from "@/lib/dev-vs-ai/core";

const STORAGE_KEY = "braveactive-dev-vs-ai-progress-v1";

export interface DevVsAiProgress {
  unlockedStages: string[];
  stageStars: Record<string, number>;
  unlockedRobots: RobotId[];
  bestEndlessWave: number;
  totalTokensCollected: number;
  sandboxUnlockAll: boolean;
  muted: boolean;
}

export function defaultProgress(): DevVsAiProgress {
  return {
    unlockedStages: ["1-1"],
    stageStars: {},
    unlockedRobots: [...INITIAL_UNLOCKED_ROBOTS],
    bestEndlessWave: 0,
    totalTokensCollected: 0,
    sandboxUnlockAll: false,
    muted: false,
  };
}

export function loadProgress(): DevVsAiProgress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<DevVsAiProgress>;
    const base = defaultProgress();
    return {
      unlockedStages:
        Array.isArray(parsed.unlockedStages) && parsed.unlockedStages.length > 0
          ? [...new Set(["1-1", ...parsed.unlockedStages.filter((s): s is string => typeof s === "string")])]
          : base.unlockedStages,
      stageStars:
        parsed.stageStars && typeof parsed.stageStars === "object"
          ? { ...parsed.stageStars }
          : {},
      unlockedRobots:
        Array.isArray(parsed.unlockedRobots) && parsed.unlockedRobots.length > 0
          ? [
              ...new Set([
                ...INITIAL_UNLOCKED_ROBOTS,
                ...parsed.unlockedRobots.filter((r): r is RobotId =>
                  ROBOT_ORDER.includes(r as RobotId),
                ),
              ]),
            ]
          : base.unlockedRobots,
      bestEndlessWave:
        typeof parsed.bestEndlessWave === "number" && Number.isFinite(parsed.bestEndlessWave)
          ? Math.max(0, Math.floor(parsed.bestEndlessWave))
          : 0,
      totalTokensCollected:
        typeof parsed.totalTokensCollected === "number" && Number.isFinite(parsed.totalTokensCollected)
          ? Math.max(0, Math.floor(parsed.totalTokensCollected))
          : 0,
      sandboxUnlockAll: Boolean(parsed.sandboxUnlockAll),
      muted: Boolean(parsed.muted),
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: DevVsAiProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors in private browsing
  }
}

export function getEffectiveUnlockedStages(progress: DevVsAiProgress): Set<string> {
  if (progress.sandboxUnlockAll) {
    return new Set(STAGES.map((stage) => stage.id));
  }
  return new Set(progress.unlockedStages);
}

export function getEffectiveUnlockedRobots(progress: DevVsAiProgress): RobotId[] {
  if (progress.sandboxUnlockAll) {
    return [...ROBOT_ORDER];
  }
  return ROBOT_ORDER.filter((id) => progress.unlockedRobots.includes(id));
}

export function recordStageVictory(
  progress: DevVsAiProgress,
  stageId: string,
  stars: number,
  tokensCollected: number,
): DevVsAiProgress {
  const stage = STAGES.find((s) => s.id === stageId);
  const nextUnlockedStages = new Set(progress.unlockedStages);
  if (stage?.unlocksNextStage) {
    nextUnlockedStages.add(stage.unlocksNextStage);
  }
  if (stageId === "3-3" || stageId === "3-4") {
    nextUnlockedStages.add("on-call");
  }

  const nextUnlockedRobots = new Set<RobotId>(progress.unlockedRobots);
  if (stage?.unlocksRobot) {
    nextUnlockedRobots.add(stage.unlocksRobot);
  }

  const prevStars = progress.stageStars[stageId] ?? 0;
  const next: DevVsAiProgress = {
    ...progress,
    unlockedStages: [...nextUnlockedStages],
    stageStars: {
      ...progress.stageStars,
      [stageId]: Math.max(prevStars, stars),
    },
    unlockedRobots: ROBOT_ORDER.filter((id) => nextUnlockedRobots.has(id)),
    totalTokensCollected: progress.totalTokensCollected + tokensCollected,
  };
  saveProgress(next);
  return next;
}
