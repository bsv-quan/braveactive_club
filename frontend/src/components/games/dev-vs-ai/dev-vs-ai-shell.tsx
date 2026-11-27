"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, Unlock, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { getStageById, STAGES, type GameScreenMode, type GameState } from "@/lib/dev-vs-ai/core";
import {
  defaultProgress,
  getEffectiveUnlockedRobots,
  getEffectiveUnlockedStages,
  loadProgress,
  recordStageVictory,
  saveProgress,
  type DevVsAiProgress,
} from "@/lib/dev-vs-ai/storage";
import { GameplayView } from "./gameplay-view";
import { MainMenuView } from "./main-menu-view";
import { RobotDexView } from "./robot-dex-view";
import { WorldMapView } from "./world-map-view";
import styles from "./dev-vs-ai.module.css";

export function DevVsAiShell() {
  const { t } = useI18n();
  const [screen, setScreen] = useState<GameScreenMode>("menu");
  const [activeStageId, setActiveStageId] = useState<string>("1-1");
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState<DevVsAiProgress>(() => defaultProgress());

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const toggleMute = () => {
    setProgress((prev) => {
      const next = { ...prev, muted: !prev.muted };
      saveProgress(next);
      return next;
    });
  };

  const toggleSandboxUnlock = () => {
    setProgress((prev) => {
      const next = { ...prev, sandboxUnlockAll: !prev.sandboxUnlockAll };
      saveProgress(next);
      return next;
    });
  };

  const launchStage = useCallback((stageId: string) => {
    setActiveStageId(stageId);
    setScreen("playing");
  }, []);

  const handleStageFinished = useCallback((finishedState: GameState) => {
    if (finishedState.status === "victory") {
      setProgress((prev) =>
        recordStageVictory(
          prev,
          finishedState.stage.id,
          finishedState.starsEarned,
          finishedState.tokensCollected,
        ),
      );
    } else if (finishedState.stage.isEndless && finishedState.endlessWave > 0) {
      setProgress((prev) => {
        const next: DevVsAiProgress = {
          ...prev,
          bestEndlessWave: Math.max(prev.bestEndlessWave, finishedState.endlessWave),
          totalTokensCollected: prev.totalTokensCollected + finishedState.tokensCollected,
        };
        saveProgress(next);
        return next;
      });
    }
  }, []);

  const handleQuickPlay = useCallback(() => {
    const unlocked = getEffectiveUnlockedStages(progress);
    const campaignStages = STAGES.filter((s) => !s.isEndless);
    const nextUnfinished = campaignStages.find(
      (s) => unlocked.has(s.id) && !(progress.stageStars[s.id] > 0),
    );
    launchStage(nextUnfinished?.id ?? activeStageId);
  }, [progress, activeStageId, launchStage]);

  const currentStage = getStageById(activeStageId);
  const unlockedRobots = getEffectiveUnlockedRobots(progress);

  return (
    <div className={styles.arcadeRoot}>
      <header className={styles.topStrip}>
        <div className={styles.topLeft}>
          <Link href="/community" className={styles.backLink}>
            <ArrowLeft size={15} aria-hidden="true" />
            <span>{t("community.games.devVsAi.backToCommunity")}</span>
          </Link>
          <span className={styles.brandBadge}>
            <span className={styles.brandDev}>DEV</span>
            <span className={styles.brandVs}>vs</span>
            <span className={styles.brandAi}>AI</span>
          </span>
        </div>

        <div className={styles.topRight}>
          <button
            type="button"
            className={`${styles.stripButton} ${progress.sandboxUnlockAll ? styles.stripButtonActive : ""}`}
            onClick={toggleSandboxUnlock}
            title="Mở khóa toàn bộ 11 màn + Boss 3-4 + 7 Robot để chơi thử nhanh"
          >
            <Unlock size={14} aria-hidden="true" />
            <span>{progress.sandboxUnlockAll ? "Unlock All: ON" : "Unlock All"}</span>
          </button>
          <button
            type="button"
            className={styles.stripButton}
            onClick={toggleMute}
            aria-label={progress.muted ? "Unmute" : "Mute"}
          >
            {progress.muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={styles.stripButton}
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? "Shrink viewport" : "Expand viewport"}
          >
            {expanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className={styles.stageContainer}>
        <div className={`${styles.arcadeViewport} ${expanded ? styles.viewportExpanded : ""}`}>
          {screen === "menu" ? (
            <MainMenuView
              progress={progress}
              subtitle={t("community.games.devVsAi.subtitle")}
              onQuickPlay={handleQuickPlay}
              onOpenWorldMap={() => setScreen("world-map")}
              onStartEndless={() => launchStage("on-call")}
              onOpenRobotDex={() => setScreen("robot-dex")}
              onToggleMute={toggleMute}
              onToggleSandbox={toggleSandboxUnlock}
            />
          ) : null}

          {screen === "world-map" ? (
            <WorldMapView
              progress={progress}
              initialStageId={activeStageId}
              onBack={() => setScreen("menu")}
              onDeployStage={launchStage}
            />
          ) : null}

          {screen === "robot-dex" ? (
            <RobotDexView progress={progress} onBack={() => setScreen("menu")} />
          ) : null}

          {screen === "playing" ? (
            <GameplayView
              stageId={activeStageId}
              progress={progress}
              unlockedRobots={unlockedRobots}
              muted={progress.muted}
              hasNextStage={Boolean(currentStage.unlocksNextStage)}
              onStageFinished={handleStageFinished}
              onNextStage={() => {
                if (currentStage.unlocksNextStage) {
                  launchStage(currentStage.unlocksNextStage);
                } else {
                  setScreen("world-map");
                }
              }}
              onWorldMap={() => setScreen("world-map")}
              onQuitToMenu={() => setScreen("menu")}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
