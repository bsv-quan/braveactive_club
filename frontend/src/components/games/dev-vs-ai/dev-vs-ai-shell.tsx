"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, Sparkles, Unlock, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { communityApi } from "@/lib/api/community";
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

type DevVsAiShellProps = {
  embedded?: boolean;
  isMember?: boolean;
  onActiveChange?: (active: boolean) => void;
  onRoundCompleted?: (scoreAwarded: number) => void;
};

export function DevVsAiShell({
  embedded = false,
  isMember = false,
  onActiveChange,
  onRoundCompleted,
}: DevVsAiShellProps = {}) {
  const { t } = useI18n();
  const [screen, setScreen] = useState<GameScreenMode>("menu");
  const [activeStageId, setActiveStageId] = useState<string>("1-1");
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState<DevVsAiProgress>(() => defaultProgress());
  const [lastAwardedPoints, setLastAwardedPoints] = useState<number | null>(null);
  const activeRoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  useEffect(() => {
    onActiveChange?.(screen === "playing");
  }, [screen, onActiveChange]);

  useEffect(() => {
    if (lastAwardedPoints === null) return;
    const timer = window.setTimeout(() => setLastAwardedPoints(null), 5500);
    return () => window.clearTimeout(timer);
  }, [lastAwardedPoints]);

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

  const launchStage = useCallback(
    (stageId: string) => {
      setActiveStageId(stageId);
      setLastAwardedPoints(null);
      setScreen("playing");
      activeRoundIdRef.current = null;
      if (isMember) {
        void communityApi
          .startDevVsAiRound(stageId)
          .then((started) => {
            activeRoundIdRef.current = started.roundId;
          })
          .catch(() => {
            activeRoundIdRef.current = null;
          });
      }
    },
    [isMember],
  );

  const handleStageFinished = useCallback(
    (finishedState: GameState) => {
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

      const roundId = activeRoundIdRef.current;
      activeRoundIdRef.current = null;
      if (isMember && roundId) {
        void communityApi
          .completeDevVsAiRound(roundId, {
            status: finishedState.status === "victory" ? "victory" : "defeat",
            starsEarned: finishedState.starsEarned,
            endlessWave: finishedState.endlessWave,
          })
          .then((result) => {
            if (result.scoreAwarded > 0) {
              setLastAwardedPoints(result.scoreAwarded);
            }
            onRoundCompleted?.(result.scoreAwarded);
          })
          .catch(() => {
            onRoundCompleted?.(0);
          });
      } else if (finishedState.status === "victory" || finishedState.endlessWave > 0) {
        onRoundCompleted?.(0);
      }
    },
    [isMember, onRoundCompleted],
  );

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
    <div className={`${styles.arcadeRoot}${embedded ? " arcade-embedded-dev-vs-ai" : ""}`}>
      <header className={styles.topStrip}>
        <div className={styles.topLeft}>
          {!embedded ? (
            <Link href="/games" className={styles.backLink}>
              <ArrowLeft size={15} aria-hidden="true" />
              <span>{t("community.games.arcade.backToLobby")}</span>
            </Link>
          ) : null}
          <span className={styles.brandBadge}>
            <span className={styles.brandDev}>DEV</span>
            <span className={styles.brandVs}>vs</span>
            <span className={styles.brandAi}>AI</span>
          </span>
          {lastAwardedPoints !== null && lastAwardedPoints > 0 ? (
            <span className="arcade-dev-points-toast" role="status">
              <Sparkles size={13} aria-hidden="true" />
              {t("community.games.arcade.devVsAiPointsToast", { points: lastAwardedPoints })}
            </span>
          ) : null}
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
