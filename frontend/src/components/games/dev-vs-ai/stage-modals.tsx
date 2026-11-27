"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import {
  computeEndlessUptime,
  ROBOT_CATALOG,
  type GameState,
  type RobotId,
} from "@/lib/dev-vs-ai/core";
import { CANVAS_H, CANVAS_W } from "@/lib/dev-vs-ai/theme";
import { PixelSpriteIcon } from "./pixel-sprite-icon";
import styles from "./dev-vs-ai.module.css";

const ROBOT_UNLOCK_TAGLINE: Record<RobotId, string> = {
  "token-flower": "Produces extra TOKEN coins!",
  "ping-blossom": "Fires crisp pixel lasers!",
  "firewall-pod": "Sturdy shield for your lane!",
  "bug-trap": "Blasts AI monsters on contact!",
  "cooler-bot": "Slows AI Monsters!",
  "dual-core": "Fires twin parallel lasers!",
  "hotfix-core": "Explodes a 3×3 area!",
};

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vRot: number;
  color: string;
}

const CONFETTI_COLORS = ["#ff5ca8", "#52f2b8", "#ffe14d", "#4dd8ff", "#c084fc", "#ff8a3d"];

function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pieces: ConfettiPiece[] = Array.from({ length: 85 }, (_, i) => ({
      x: (i * 97) % CANVAS_W,
      y: -((i * 53) % CANVAS_H),
      vx: (Math.random() - 0.5) * 42,
      vy: 68 + Math.random() * 78,
      w: 7 + (i % 5) * 2,
      h: 4 + (i % 3) * 2,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }));

    let rafId = 0;
    let last = performance.now();
    const start = last;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Warm golden light rays radiating from top-center behind the 3 stars
      ctx.save();
      ctx.translate(CANVAS_W / 2, 108);
      for (let r = -2; r <= 2; r++) {
        ctx.save();
        ctx.rotate(r * 0.24 + Math.sin(t * 0.8) * 0.04);
        const rayGrad = ctx.createLinearGradient(0, 0, 0, -140);
        rayGrad.addColorStop(0, "rgba(255, 225, 77, 0.22)");
        rayGrad.addColorStop(1, "rgba(255, 225, 77, 0)");
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-38, -140);
        ctx.lineTo(38, -140);
        ctx.lineTo(14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Falling & fluttering pixel confetti
      for (const p of pieces) {
        p.x += (p.vx + Math.sin(t * 2.5 + p.y * 0.03) * 18) * dt;
        p.y += p.vy * dt;
        p.rot += p.vRot * dt;
        if (p.y > CANVAS_H + 16) {
          p.y = -14;
          p.x = Math.random() * CANVAS_W;
        }
        if (p.x < -16) p.x = CANVAS_W + 12;
        if (p.x > CANVAS_W + 16) p.x = -12;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className={styles.confettiCanvas}
      aria-hidden="true"
    />
  );
}

function GoldenStarSvg({ filled, large }: { filled: boolean; large?: boolean }) {
  const size = large ? 58 : 48;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{
        filter: filled
          ? "drop-shadow(0 4px 0 #0f1021) drop-shadow(0 0 12px rgba(255,225,77,0.65))"
          : "drop-shadow(0 3px 0 #0f1021)",
        transform: large ? "translateY(-8px)" : "none",
      }}
      aria-hidden="true"
    >
      <polygon
        points="24,3 30.5,16.2 45,18.3 34.5,28.5 37,43 24,36.2 11,43 13.5,28.5 3,18.3 17.5,16.2"
        fill={filled ? "#ffe14d" : "#262d59"}
        stroke={filled ? "#b45309" : "#475569"}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {filled ? (
        <polygon
          points="24,7 28.8,17.2 39.5,18.8 31.5,26.4 33.4,37 24,32 14.6,37 16.5,26.4 8.5,18.8 19.2,17.2"
          fill="#fff3a1"
          opacity="0.55"
        />
      ) : null}
    </svg>
  );
}

export function StageOutcomeModal({
  state,
  hasNextStage,
  onNextStage,
  onReplay,
  onWorldMap,
  onMainMenu,
}: {
  state: GameState;
  hasNextStage: boolean;
  onNextStage: () => void;
  onReplay: () => void;
  onWorldMap: () => void;
  onMainMenu: () => void;
}) {
  const [confirmingReplay, setConfirmingReplay] = useState(false);

  const isVictory = state.status === "victory";
  const activeCount = state.stage.activeRows.length;
  const savedBrooms = state.brooms.filter(
    (b) => state.stage.activeRows.includes(b.row) && !b.active && !b.spent,
  ).length;
  const unlockedRobot =
    isVictory && state.stage.unlocksRobot ? ROBOT_CATALOG[state.stage.unlocksRobot] : null;

  if (confirmingReplay) {
    return (
      <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
        <div className={styles.modalCard} style={{ maxWidth: 440 }}>
          <h2 className={styles.modalHeading} style={{ color: "#ffe14d" }}>
            XÁC NHẬN CHƠI LẠI?
          </h2>
          <p className={styles.modalSubtitleText}>
            Bạn có chắc muốn chơi lại màn <strong>{state.stage.code}: {state.stage.name}</strong> từ đầu không?
          </p>
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.arcadeBtn}
              onClick={() => setConfirmingReplay(false)}
            >
              HỦY
            </button>
            <button
              type="button"
              className={`${styles.arcadeBtn} ${styles.arcadeBtnPrimary}`}
              onClick={onReplay}
            >
              CHƠI LẠI
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <ConfettiCanvas active={isVictory} />

      <div className={`${styles.victoryModalShell} ${isVictory ? "" : styles.victoryModalDefeat}`}>
        {/* 4 Golden Corner Brackets */}
        <span className={`${styles.cornerBracket} ${styles.cornerTL}`} aria-hidden="true" />
        <span className={`${styles.cornerBracket} ${styles.cornerTR}`} aria-hidden="true" />
        <span className={`${styles.cornerBracket} ${styles.cornerBL}`} aria-hidden="true" />
        <span className={`${styles.cornerBracket} ${styles.cornerBR}`} aria-hidden="true" />

        {/* 3 Arched 3D Golden Stars */}
        {isVictory ? (
          <div className={styles.archedStarsRow} aria-label={`${state.starsEarned} stars`}>
            <GoldenStarSvg filled={state.starsEarned >= 1} />
            <GoldenStarSvg filled={state.starsEarned >= 2} large />
            <GoldenStarSvg filled={state.starsEarned >= 3} />
          </div>
        ) : null}

        {/* Top Ribbon Banner (DEPLOY SUCCESS! / 500 INTERNAL ERROR) */}
        <div className={`${styles.ribbonWrap} ${isVictory ? "" : styles.ribbonWrapDefeat}`}>
          <span className={styles.ribbonTailLeft} aria-hidden="true" />
          <div className={styles.ribbonBanner}>
            <h2 className={styles.ribbonHeading}>
              {isVictory ? "DEPLOY SUCCESS!" : "500 INTERNAL ERROR"}
            </h2>
          </div>
          <span className={styles.ribbonTailRight} aria-hidden="true" />
        </div>

        {/* Stage Subtitle */}
        <p className={styles.victoryStageSub}>
          {isVictory
            ? `STAGE ${state.stage.code}: ${state.stage.name.toUpperCase()} CLEARED!`
            : state.stage.isEndless
              ? `24/7 ON-CALL — WAVE ${state.endlessWave} · UPTIME ${computeEndlessUptime(state.endlessWave)}`
              : `STAGE ${state.stage.code}: AI TOOK OVER PRODUCTION!`}
        </p>

        {/* Two-Column Stats & Unlock Showcase */}
        <div className={styles.victoryBodyGrid}>
          <div className={styles.victoryStatsBox}>
            <div className={styles.victoryStatRow}>
              <span className={styles.victoryStatLabel}>
                <span className={styles.uptimeClockBadge}>
                  <Clock size={16} />
                </span>
                <span>UPTIME:</span>
              </span>
              <strong style={{ color: isVictory ? "#52f2b8" : "#ff5c77" }}>
                {state.stage.isEndless
                  ? computeEndlessUptime(state.endlessWave)
                  : isVictory
                    ? "100%"
                    : "0%"}
              </strong>
            </div>

            <div className={styles.victoryStatRow}>
              <span className={styles.victoryStatLabel}>
                <PixelSpriteIcon sprite={{ type: "token" }} size={28} />
                <span>TOKENS COLLECTED:</span>
              </span>
              <strong style={{ color: "#ffe14d" }}>{state.tokensCollected}</strong>
            </div>

            <div className={styles.victoryStatRow}>
              <span className={styles.victoryStatLabel}>
                <PixelSpriteIcon sprite={{ type: "enemy", id: "prompt-slime" }} size={28} />
                <span>AI BUGS PATCHED:</span>
              </span>
              <strong style={{ color: "#ffe14d" }}>{state.enemiesPatched}</strong>
            </div>

            <div className={styles.victoryStatRow}>
              <span className={styles.victoryStatLabel}>
                <PixelSpriteIcon sprite={{ type: "broom" }} size={28} />
                <span>BROOMS SAVED:</span>
              </span>
              <strong style={{ color: "#52f2b8" }}>
                {savedBrooms}/{activeCount}
              </strong>
            </div>
          </div>

          <div className={styles.victoryUnlockBox}>
            {unlockedRobot ? (
              <>
                <span className={styles.unlockHeaderLabel}>NEW ROBOT UNLOCKED!</span>
                <div className={styles.unlockGlowPedestal}>
                  <PixelSpriteIcon sprite={{ type: "robot", id: unlockedRobot.id }} size={96} animate />
                </div>
                <div className={styles.unlockCaptionPill}>
                  <strong>{unlockedRobot.name.toUpperCase()}</strong> —{" "}
                  {ROBOT_UNLOCK_TAGLINE[unlockedRobot.id]}
                </div>
              </>
            ) : isVictory && state.stage.isBossStage ? (
              <>
                <span className={styles.unlockHeaderLabel}>PRODUCTION SAVED!</span>
                <div className={styles.unlockGlowPedestal}>
                  <PixelSpriteIcon sprite={{ type: "coffee", filled: true }} size={92} animate />
                </div>
                <div className={styles.unlockCaptionPill}>
                  <strong>ROGUE LLM DEFEATED!</strong> — 100% Uptime Hero!
                </div>
              </>
            ) : isVictory ? (
              <>
                <span className={styles.unlockHeaderLabel}>CLEAN DEPLOYMENT!</span>
                <div className={styles.unlockGlowPedestal}>
                  <PixelSpriteIcon sprite={{ type: "token" }} size={88} animate />
                </div>
                <div className={styles.unlockCaptionPill}>
                  Ready to deploy the next environment!
                </div>
              </>
            ) : (
              <>
                <span className={styles.unlockHeaderLabel} style={{ color: "#ff5c77" }}>
                  ROLLBACK NEEDED!
                </span>
                <div className={styles.unlockGlowPedestal}>
                  <PixelSpriteIcon sprite={{ type: "enemy", id: "prompt-slime" }} size={88} animate />
                </div>
                <div className={styles.unlockCaptionPill}>
                  Tip: Place Token-Flowers early &amp; guard with Firewall-Pod!
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom Arcade Action Buttons */}
        <div className={styles.victoryActionsRow}>
          <button type="button" className={styles.victorySecondaryBtn} onClick={onMainMenu}>
            MENU
          </button>
          <button type="button" className={styles.victorySecondaryBtn} onClick={onWorldMap}>
            WORLD MAP
          </button>
          <button
            type="button"
            className={styles.victorySecondaryBtn}
            onClick={() => setConfirmingReplay(true)}
          >
            {isVictory ? "REPLAY" : "RETRY"}
          </button>
          {isVictory && hasNextStage ? (
            <button type="button" className={styles.victoryPrimaryBtn} onClick={onNextStage}>
              NEXT STAGE &gt;
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
