"use client";

import { useEffect, useRef } from "react";
import { Unlock, Volume2, VolumeX } from "lucide-react";
import { renderMainMenuCanvas } from "@/lib/dev-vs-ai/menu-renderer";
import { getEffectiveUnlockedStages, type DevVsAiProgress } from "@/lib/dev-vs-ai/storage";
import { CANVAS_H, CANVAS_W } from "@/lib/dev-vs-ai/theme";
import styles from "./dev-vs-ai.module.css";

export function MainMenuView({
  progress,
  subtitle,
  onQuickPlay,
  onOpenWorldMap,
  onStartEndless,
  onOpenRobotDex,
  onToggleMute,
  onToggleSandbox,
}: {
  progress: DevVsAiProgress;
  subtitle: string;
  onQuickPlay: () => void;
  onOpenWorldMap: () => void;
  onStartEndless: () => void;
  onOpenRobotDex: () => void;
  onToggleMute: () => void;
  onToggleSandbox: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const unlockedStages = getEffectiveUnlockedStages(progress);
  const endlessUnlocked = unlockedStages.has("on-call");

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        renderMainMenuCanvas(ctx, (now - start) / 1000);
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className={styles.menuSceneWrap}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className={styles.menuBgCanvas}
        aria-hidden="true"
      />

      {/* Top-right chunky arcade corner icons (Sound & Unlock All) */}
      <div className={styles.menuCornerIcons}>
        <button
          type="button"
          className={styles.menuSquareIconBtn}
          onClick={onToggleMute}
          title={progress.muted ? "Bật âm thanh" : "Tắt âm thanh"}
          aria-label={progress.muted ? "Unmute" : "Mute"}
        >
          {progress.muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={`${styles.menuSquareIconBtn} ${progress.sandboxUnlockAll ? styles.menuSquareIconBtnActive : ""}`}
          onClick={onToggleSandbox}
          title="Bật/tắt mở khóa nhanh toàn bộ 11 màn + Boss 3-4"
          aria-label="Toggle unlock all stages"
        >
          <Unlock size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Centered Logo + 4 Concept Arcade Buttons */}
      <div className={styles.menuOverlayCenter}>
        <div className={styles.logoLockup}>
          <span className={styles.logoSprout} aria-hidden="true">🌱</span>
          <h1 className={styles.conceptLogo}>
            <span className={styles.logoDev}>DEV</span>
            <span className={styles.logoVsBadge}>VS</span>
            <span className={styles.logoAi}>AI</span>
          </h1>
          <p className={styles.conceptSubtitle}>{subtitle}</p>
        </div>

        <nav className={styles.conceptMenuStack} aria-label="Main menu">
          <button
            type="button"
            className={`${styles.conceptBtn} ${styles.conceptBtnPlay}`}
            onClick={onQuickPlay}
          >
            PLAY
          </button>
          <button
            type="button"
            className={styles.conceptBtn}
            onClick={onOpenWorldMap}
          >
            STAGES
          </button>
          <button
            type="button"
            className={styles.conceptBtn}
            disabled={!endlessUnlocked}
            title={
              endlessUnlocked
                ? "Chế độ vô tận 24/7 On-Call"
                : "Hoàn thành màn 3-3 hoặc bấm nút Mở khóa góc trên phải"
            }
            onClick={onStartEndless}
          >
            24/7 ON-CALL{endlessUnlocked ? "" : " 🔒"}
          </button>
          <button
            type="button"
            className={styles.conceptBtn}
            onClick={onOpenRobotDex}
          >
            ROBOT DEX
          </button>
        </nav>
      </div>
    </div>
  );
}
