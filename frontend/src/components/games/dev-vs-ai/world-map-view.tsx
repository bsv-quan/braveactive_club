"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { STAGES, type StageDefinition } from "@/lib/dev-vs-ai/core";
import { getEffectiveUnlockedStages, type DevVsAiProgress } from "@/lib/dev-vs-ai/storage";
import { CANVAS_H, CANVAS_W } from "@/lib/dev-vs-ai/theme";
import {
  hitTestWorldMapNode,
  renderWorldMapCanvas,
} from "@/lib/dev-vs-ai/world-map-renderer";
import { PixelSpriteIcon } from "./pixel-sprite-icon";
import styles from "./dev-vs-ai.module.css";

export function WorldMapView({
  progress,
  initialStageId,
  onBack,
  onDeployStage,
}: {
  progress: DevVsAiProgress;
  initialStageId: string;
  onBack: () => void;
  onDeployStage: (stageId: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const unlocked = useMemo(() => getEffectiveUnlockedStages(progress), [progress]);
  const [selectedId, setSelectedId] = useState<string>(
    unlocked.has(initialStageId) ? initialStageId : "1-1",
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const selectedStage: StageDefinition =
    STAGES.find((s) => s.id === selectedId) ?? STAGES[0];
  const totalStars = Object.values(progress.stageStars).reduce((sum, s) => sum + s, 0);

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        renderWorldMapCanvas(ctx, {
          time: (now - start) / 1000,
          selectedStageId: selectedId,
          hoveredStageId: hoveredId,
          unlockedStages: unlocked,
          stageStars: progress.stageStars,
        });
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [selectedId, hoveredId, unlocked, progress.stageStars]);

  const getPoint = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getPoint(event);
    const hit = pt ? hitTestWorldMapNode(pt.x, pt.y) : null;
    setHoveredId(hit ? hit.stageId : null);
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getPoint(event);
    const hit = pt ? hitTestWorldMapNode(pt.x, pt.y) : null;
    if (!hit) return;
    if (!unlocked.has(hit.stageId)) return;
    if (hit.stageId === selectedId) {
      onDeployStage(hit.stageId);
    } else {
      setSelectedId(hit.stageId);
    }
  };

  return (
    <div className={styles.menuSceneWrap}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className={styles.menuBgCanvas}
        style={{ cursor: hoveredId && unlocked.has(hoveredId) ? "pointer" : "default" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoveredId(null)}
        onClick={handleClick}
      />

      {/* TOP HUD OVERLAY */}
      <div className={styles.mapTopBar}>
        <button type="button" className={`${styles.arcadeBtn} ${styles.arcadeBtnSmall}`} onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" />
          <span>BACK</span>
        </button>

        <div className={styles.mapTitleBanner}>WORLD MAP</div>

        <div className={styles.mapCounters}>
          <span className={styles.mapCounterPill}>
            <span style={{ color: "#ffe14d" }}>★</span> {totalStars}/33
          </span>
          <span className={styles.mapCounterPill}>
            <PixelSpriteIcon sprite={{ type: "token" }} size={26} animate />
            <span>{progress.totalTokensCollected}</span>
          </span>
        </div>
      </div>

      {/* BOTTOM-CENTER STAGE PREVIEW CARD */}
      <div className={styles.mapBottomCard}>
        <div className={styles.previewInfo}>
          <h3 className={styles.previewTitle}>
            {selectedStage.isEndless
              ? "24/7 ON-CALL — ENDLESS MODE"
              : `STAGE ${selectedStage.code}: ${selectedStage.name.toUpperCase()}`}
          </h3>
          <p className={styles.previewSub}>{selectedStage.subtitle}</p>
        </div>

        <div className={styles.previewEnemies} aria-label="Quái AI trong màn">
          {selectedStage.featuredEnemies.slice(0, 4).map((enemyId) => (
            <PixelSpriteIcon key={enemyId} sprite={{ type: "enemy", id: enemyId }} size={54} />
          ))}
        </div>

        <button
          type="button"
          className={`${styles.arcadeBtn} ${styles.arcadeBtnPrimary}`}
          onClick={() => onDeployStage(selectedStage.id)}
        >
          <Play size={16} aria-hidden="true" />
          <span>DEPLOY!</span>
        </button>
      </div>
    </div>
  );
}
