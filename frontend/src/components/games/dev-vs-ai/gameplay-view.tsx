"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, LogOut, Menu, Play, RotateCcw, Trash2 } from "lucide-react";
import {
  applyCoffeeBoost,
  collectToken,
  computeEndlessUptime,
  createGameState,
  getWaveProgress,
  MAX_COFFEE_CUPS,
  placeRobot,
  ROBOT_CATALOG,
  stepGameState,
  uninstallRobot,
  type GameState,
  type RobotId,
} from "@/lib/dev-vs-ai/core";
import { renderGameCanvas } from "@/lib/dev-vs-ai/renderer";
import { ChiptuneSoundEngine } from "@/lib/dev-vs-ai/sound";
import type { DevVsAiProgress } from "@/lib/dev-vs-ai/storage";
import { CANVAS_H, CANVAS_W, GRID_X, GRID_Y, pixelToGrid, TILE_H, TILE_W } from "@/lib/dev-vs-ai/theme";
import { PixelSpriteIcon } from "./pixel-sprite-icon";
import { RobotDexView } from "./robot-dex-view";
import { StageOutcomeModal } from "./stage-modals";
import styles from "./dev-vs-ai.module.css";

interface HudSnapshot {
  tokens: number;
  coffeeCups: number;
  coffeeCharge: number;
  cooldowns: Record<RobotId, number>;
  progress: number;
  bossHpPercent: number | null;
  endlessWave: number;
  status: GameState["status"];
}

type PauseModalView = "none" | "menu" | "confirm-new-game" | "confirm-quit" | "robot-dex";

function readHudSnapshot(state: GameState): HudSnapshot {
  return {
    tokens: state.tokens,
    coffeeCups: state.coffeeCups,
    coffeeCharge: state.coffeeCharge,
    cooldowns: { ...state.cardCooldowns },
    progress: getWaveProgress(state),
    bossHpPercent: state.boss ? Math.ceil((state.boss.hp / state.boss.maxHp) * 100) : null,
    endlessWave: state.endlessWave,
    status: state.status,
  };
}

export function GameplayView({
  stageId,
  progress,
  unlockedRobots,
  muted,
  hasNextStage,
  onStageFinished,
  onNextStage,
  onWorldMap,
  onQuitToMenu,
}: {
  stageId: string;
  progress: DevVsAiProgress;
  unlockedRobots: RobotId[];
  muted: boolean;
  hasNextStage: boolean;
  onStageFinished: (state: GameState) => void;
  onNextStage: () => void;
  onWorldMap: () => void;
  onQuitToMenu: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundRef = useRef<ChiptuneSoundEngine | null>(null);
  const stateRef = useRef<GameState>(createGameState(stageId, Date.now() & 0xffff));
  const finishedReportedRef = useRef(false);

  const [pauseView, setPauseView] = useState<PauseModalView>("none");
  const [selectedRobot, setSelectedRobot] = useState<RobotId | null>(null);
  const [uninstallMode, setUninstallMode] = useState(false);
  const [coffeeMode, setCoffeeMode] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(() => readHudSnapshot(stateRef.current));
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);

  const paused = pauseView !== "none";

  const hoverCellRef = useRef<{ row: number; col: number } | null>(null);
  const interactionRef = useRef({
    selectedRobot: null as RobotId | null,
    uninstallMode: false,
    coffeeMode: false,
  });

  useEffect(() => {
    interactionRef.current = { selectedRobot, uninstallMode, coffeeMode };
  }, [selectedRobot, uninstallMode, coffeeMode]);

  useEffect(() => {
    if (!soundRef.current) {
      soundRef.current = new ChiptuneSoundEngine();
    }
    soundRef.current.setMuted(muted);
  }, [muted]);

  const resetStage = useCallback(() => {
    stateRef.current = createGameState(stageId, Date.now() & 0xffff);
    finishedReportedRef.current = false;
    setShowOutcomeModal(false);
    setPauseView("none");
    setSelectedRobot(null);
    setUninstallMode(false);
    setCoffeeMode(false);
    setHud(readHudSnapshot(stateRef.current));
  }, [stageId]);

  // Wait 1.0 second after stage ends so explosion/sweeping animations play out cleanly
  useEffect(() => {
    if (hud.status === "playing") {
      setShowOutcomeModal(false);
      return;
    }
    const timerId = window.setTimeout(() => {
      setShowOutcomeModal(true);
    }, 1000);
    return () => window.clearTimeout(timerId);
  }, [hud.status]);

  useEffect(() => {
    resetStage();
  }, [resetStage]);

  // Keyboard shortcuts: 1-7 robot cards, U uninstall, C coffee boost, Esc/Space toggle Menu
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedRobot || uninstallMode || coffeeMode) {
          setSelectedRobot(null);
          setUninstallMode(false);
          setCoffeeMode(false);
          return;
        }
        setPauseView((prev) => (prev === "none" ? "menu" : "none"));
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        setPauseView((prev) => (prev === "none" ? "menu" : "none"));
        return;
      }
      if (paused) return;
      if (event.key.toLowerCase() === "u") {
        setSelectedRobot(null);
        setCoffeeMode(false);
        setUninstallMode((prev) => !prev);
        return;
      }
      if (event.key.toLowerCase() === "c") {
        const state = stateRef.current;
        if (state.stage.coffeeEnabled && state.coffeeCups > 0) {
          setSelectedRobot(null);
          setUninstallMode(false);
          setCoffeeMode((prev) => !prev);
        }
        return;
      }
      const num = Number(event.key);
      if (num >= 1 && num <= unlockedRobots.length) {
        const id = unlockedRobots[num - 1];
        setUninstallMode(false);
        setCoffeeMode(false);
        setSelectedRobot((prev) => (prev === id ? null : id));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [unlockedRobots, paused, selectedRobot, uninstallMode, coffeeMode]);

  // Main 60fps simulation & render loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudSyncAccum = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const state = stateRef.current;
      if (!paused) {
        stepGameState(state, dt);
        soundRef.current?.flush(state.soundQueue);
      }

      if (state.status !== "playing" && !finishedReportedRef.current) {
        finishedReportedRef.current = true;
        soundRef.current?.flush(state.soundQueue);
        setHud(readHudSnapshot(state));
        onStageFinished(state);
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        renderGameCanvas(ctx, state, {
          hoverCell: hoverCellRef.current,
          selectedRobot: interactionRef.current.selectedRobot,
          uninstallMode: interactionRef.current.uninstallMode,
          coffeeMode: interactionRef.current.coffeeMode,
        });
      }

      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.08) {
        hudSyncAccum = 0;
        setHud(readHudSnapshot(state));
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [paused, onStageFinished]);

  const getCanvasPoint = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const handleCanvasMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(event);
    hoverCellRef.current = pt ? pixelToGrid(pt.x, pt.y) : null;
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (paused || state.status !== "playing") return;
    const pt = getCanvasPoint(event);
    if (!pt) return;

    // 1. Check floating round TOKEN coin pickup first (generous 36px radius)
    for (const coin of state.tokenCoins) {
      if (coin.collected) continue;
      const cx = GRID_X + coin.x * TILE_W;
      const cy = GRID_Y + coin.y * TILE_H;
      const dist = Math.hypot(pt.x - cx, pt.y - cy);
      if (dist <= 36) {
        if (collectToken(state, coin.uid)) {
          soundRef.current?.flush(state.soundQueue);
          setHud(readHudSnapshot(state));
        }
        return;
      }
    }

    // 2. Grid interaction
    const cell = pixelToGrid(pt.x, pt.y);
    if (!cell) return;

    if (coffeeMode) {
      if (applyCoffeeBoost(state, cell.row, cell.col)) {
        setCoffeeMode(false);
        soundRef.current?.flush(state.soundQueue);
        setHud(readHudSnapshot(state));
      }
      return;
    }

    if (uninstallMode) {
      if (uninstallRobot(state, cell.row, cell.col)) {
        setUninstallMode(false);
        soundRef.current?.flush(state.soundQueue);
        setHud(readHudSnapshot(state));
      }
      return;
    }

    if (selectedRobot) {
      if (placeRobot(state, selectedRobot, cell.row, cell.col)) {
        setSelectedRobot(null);
        soundRef.current?.flush(state.soundQueue);
        setHud(readHudSnapshot(state));
      }
    }
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setSelectedRobot(null);
    setUninstallMode(false);
    setCoffeeMode(false);
  };

  const stage = stateRef.current.stage;

  return (
    <div className={styles.gameplayWrap}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className={styles.pixelCanvas}
        onMouseMove={handleCanvasMove}
        onMouseLeave={() => {
          hoverCellRef.current = null;
        }}
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
      />

      {/* TOP HUD */}
      <div className={styles.hudTop}>
        <div className={styles.tokenBadge} title="Số dư TOKEN">
          <PixelSpriteIcon sprite={{ type: "token" }} size={42} animate />
          <span>{hud.tokens}</span>
        </div>

        <div className={styles.cardTray} role="toolbar" aria-label="Chọn Robot phòng thủ">
          {unlockedRobots.map((robotId, index) => {
            const def = ROBOT_CATALOG[robotId];
            const cd = hud.cooldowns[robotId] ?? 0;
            const canAfford = hud.tokens >= def.cost && cd <= 0;
            const isSelected = selectedRobot === robotId;
            const cdPercent = def.cooldown > 0 ? Math.min(100, (cd / def.cooldown) * 100) : 0;
            return (
              <button
                key={robotId}
                type="button"
                className={`${styles.seedCard} ${isSelected ? styles.seedCardSelected : ""} ${!canAfford ? styles.seedCardDisabled : ""}`}
                disabled={!canAfford}
                title={`${def.name} (${def.cost} Token) — Phím ${index + 1}`}
                onClick={() => {
                  setUninstallMode(false);
                  setCoffeeMode(false);
                  setSelectedRobot((prev) => (prev === robotId ? null : robotId));
                }}
              >
                <span className={styles.seedCardKey}>{index + 1}</span>
                <PixelSpriteIcon sprite={{ type: "robot", id: robotId }} size={60} />
                <span className={styles.seedCardCost}>{def.cost}</span>
                {cd > 0 ? (
                  <span className={styles.cooldownOverlay} style={{ height: `${cdPercent}%` }} />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className={styles.hudRight}>
          <div className={styles.hudRightButtons}>
            <button
              type="button"
              className={`${styles.hudToolBtn} ${styles.hudToolBtnUninstall} ${uninstallMode ? styles.hudToolBtnActive : ""}`}
              title="Gỡ Robot hoàn 25% Token (Phím U)"
              onClick={() => {
                setSelectedRobot(null);
                setCoffeeMode(false);
                setUninstallMode((prev) => !prev);
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              <span>Uninstall</span>
            </button>
            <button
              type="button"
              className={styles.hudToolBtn}
              title="Mở Menu (Tạm dừng game — Phím Esc / Space)"
              onClick={() => setPauseView("menu")}
            >
              <Menu size={15} aria-hidden="true" />
              <span>MENU</span>
            </button>
          </div>

          <div className={styles.progressWrap}>
            <span className={styles.progressLabel}>
              {stage.isBossStage
                ? `ROGUE LLM — ${hud.bossHpPercent ?? 0}%`
                : stage.isEndless
                  ? `ON-CALL W${hud.endlessWave} · ${computeEndlessUptime(hud.endlessWave)}`
                  : `${stage.code} ${stage.name.toUpperCase()}`}
            </span>
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${stage.isBossStage ? styles.progressFillBoss : ""}`}
                style={{ width: `${Math.round(hud.progress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM-LEFT COFFEE BOOST PANEL */}
      {stage.coffeeEnabled ? (
        <button
          type="button"
          className={`${styles.coffeePanel} ${coffeeMode ? styles.coffeePanelActive : ""}`}
          disabled={hud.coffeeCups <= 0}
          title="Kích hoạt Coffee Boost lên 1 Robot bất kỳ (Phím C)"
          onClick={() => {
            if (hud.coffeeCups <= 0) return;
            setSelectedRobot(null);
            setUninstallMode(false);
            setCoffeeMode((prev) => !prev);
          }}
        >
          <span className={styles.coffeeTitle}>
            COFFEE BOOST ({hud.coffeeCups}/{MAX_COFFEE_CUPS})
          </span>
          <div className={styles.coffeeCupsRow}>
            {Array.from({ length: MAX_COFFEE_CUPS }, (_, i) => (
              <PixelSpriteIcon
                key={i}
                sprite={{ type: "coffee", filled: i < hud.coffeeCups }}
                size={34}
                animate={i < hud.coffeeCups}
              />
            ))}
          </div>
          <div className={styles.coffeeChargeTrack}>
            <div
              className={styles.coffeeChargeFill}
              style={{ width: `${Math.min(100, hud.coffeeCharge)}%` }}
            />
          </div>
        </button>
      ) : null}

      {/* IN-GAME MENU POPUP (PAUSES GAME) */}
      {pauseView === "menu" && hud.status === "playing" ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard} style={{ maxWidth: 340 }}>
            <h2 className={styles.modalHeading}>GAME MENU</h2>
            <p className={styles.previewSub}>
              {stage.code}: {stage.name}
            </p>
            <div className={styles.menuActions}>
              <button
                type="button"
                className={`${styles.arcadeBtn} ${styles.arcadeBtnPrimary}`}
                onClick={() => setPauseView("none")}
              >
                <Play size={15} aria-hidden="true" />
                <span>RESUME</span>
              </button>
              <button
                type="button"
                className={styles.arcadeBtn}
                onClick={() => setPauseView("confirm-new-game")}
              >
                <RotateCcw size={15} aria-hidden="true" />
                <span>NEW GAME</span>
              </button>
              <button
                type="button"
                className={styles.arcadeBtn}
                onClick={() => setPauseView("robot-dex")}
              >
                <BookOpen size={15} aria-hidden="true" />
                <span>ROBOT DEX</span>
              </button>
              <button
                type="button"
                className={`${styles.arcadeBtn} ${styles.arcadeBtnDanger}`}
                onClick={() => setPauseView("confirm-quit")}
              >
                <LogOut size={15} aria-hidden="true" />
                <span>QUIT GAME</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* CONFIRM NEW GAME */}
      {pauseView === "confirm-new-game" && hud.status === "playing" ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard} style={{ maxWidth: 380 }}>
            <h2 className={styles.modalHeading} style={{ color: "#ffe14d" }}>
              CHƠI LẠI TỪ ĐẦU?
            </h2>
            <p className={styles.previewSub}>
              Tiến độ hiện tại của màn <strong>{stage.code}: {stage.name}</strong> sẽ được đặt lại.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.arcadeBtn}
                onClick={() => setPauseView("menu")}
              >
                HỦY
              </button>
              <button
                type="button"
                className={`${styles.arcadeBtn} ${styles.arcadeBtnPrimary}`}
                onClick={resetStage}
              >
                XÁC NHẬN
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* CONFIRM QUIT GAME */}
      {pauseView === "confirm-quit" && hud.status === "playing" ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard} style={{ maxWidth: 380 }}>
            <h2 className={`${styles.modalHeading} ${styles.modalHeadingDefeat}`}>
              THOÁT MÀN CHƠI?
            </h2>
            <p className={styles.previewSub}>
              Quay về Menu chính? Tiến độ trận đang chơi sẽ không được lưu.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.arcadeBtn}
                onClick={() => setPauseView("menu")}
              >
                HỦY
              </button>
              <button
                type="button"
                className={`${styles.arcadeBtn} ${styles.arcadeBtnDanger}`}
                onClick={onQuitToMenu}
              >
                QUIT TO MENU
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* IN-GAME ROBOT DEX OVERLAY (PRESERVES CURRENT MATCH) */}
      {pauseView === "robot-dex" && hud.status === "playing" ? (
        <div className={styles.modalBackdrop} style={{ padding: 0 }} role="dialog" aria-modal="true">
          <RobotDexView progress={progress} onBack={() => setPauseView("menu")} />
        </div>
      ) : null}

      {/* VICTORY / DEFEAT MODAL (AFTER 1s CELEBRATION DELAY) */}
      {showOutcomeModal && hud.status !== "playing" ? (
        <StageOutcomeModal
          state={stateRef.current}
          hasNextStage={hasNextStage}
          onNextStage={onNextStage}
          onReplay={resetStage}
          onWorldMap={onWorldMap}
          onMainMenu={onQuitToMenu}
        />
      ) : null}
    </div>
  );
}
