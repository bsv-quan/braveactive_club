"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  ENEMY_CATALOG,
  ENEMY_ORDER,
  ROBOT_CATALOG,
  ROBOT_ORDER,
  type EnemyId,
  type RobotId,
} from "@/lib/dev-vs-ai/core";
import { getEffectiveUnlockedRobots, type DevVsAiProgress } from "@/lib/dev-vs-ai/storage";
import { PixelSpriteIcon } from "./pixel-sprite-icon";
import styles from "./dev-vs-ai.module.css";

export function RobotDexView({
  progress,
  onBack,
}: {
  progress: DevVsAiProgress;
  onBack: () => void;
}) {
  const unlockedRobots = getEffectiveUnlockedRobots(progress);
  const [tab, setTab] = useState<"robots" | "enemies">("robots");
  const [selectedRobotId, setSelectedRobotId] = useState<RobotId>("ping-blossom");
  const [selectedEnemyId, setSelectedEnemyId] = useState<EnemyId>("prompt-slime");

  const robot = ROBOT_CATALOG[selectedRobotId];
  const enemy = ENEMY_CATALOG[selectedEnemyId];

  return (
    <div className={styles.screenLayer}>
      <div className={styles.screenHeader}>
        <button type="button" className={`${styles.arcadeBtn} ${styles.arcadeBtnSmall}`} onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" />
          <span>BACK</span>
        </button>

        <div className={styles.dexTabs}>
          <button
            type="button"
            className={`${styles.dexTab} ${tab === "robots" ? styles.dexTabActive : ""}`}
            onClick={() => setTab("robots")}
          >
            ROBOTS (DEV)
          </button>
          <button
            type="button"
            className={`${styles.dexTab} ${tab === "enemies" ? styles.dexTabActiveEnemy : ""}`}
            onClick={() => setTab("enemies")}
          >
            AI MONSTERS
          </button>
        </div>

        <span style={{ fontSize: 15, fontWeight: 900, color: "#ffe14d" }}>
          {unlockedRobots.length}/{ROBOT_ORDER.length} UNLOCKED
        </span>
      </div>

      {tab === "robots" ? (
        <div className={styles.dexBody}>
          <div className={styles.dexGrid}>
            {ROBOT_ORDER.map((id) => {
              const def = ROBOT_CATALOG[id];
              const isUnlocked = unlockedRobots.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`${styles.dexCard} ${selectedRobotId === id ? styles.dexCardSelected : ""} ${!isUnlocked ? styles.dexCardLocked : ""}`}
                  onClick={() => setSelectedRobotId(id)}
                >
                  <PixelSpriteIcon sprite={{ type: "robot", id }} size={68} />
                  <span className={styles.dexCardName}>{isUnlocked ? def.name : "???"}</span>
                  <span className={styles.dexCardCost}>{def.cost} T</span>
                </button>
              );
            })}
          </div>

          <aside className={styles.dexInspector}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 22, color: "#52f2b8" }}>{robot.name.toUpperCase()}</strong>
              <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 6, background: "#1e293b", color: "#4dd8ff" }}>
                {robot.role.toUpperCase()}
              </span>
            </div>

            <div className={styles.dexShowcase}>
              <PixelSpriteIcon sprite={{ type: "robot", id: robot.id }} size={124} animate />
            </div>

            <div className={styles.dexStats}>
              <div className={styles.dexStatPill}>COST: <strong style={{ color: "#ffe14d" }}>{robot.cost} T</strong></div>
              <div className={styles.dexStatPill}>HP: <strong style={{ color: "#52f2b8" }}>{robot.maxHp}</strong></div>
              <div className={styles.dexStatPill}>
                DMG:{" "}
                <strong style={{ color: "#4dd8ff" }}>
                  {robot.damage
                    ? (robot.shotsPerAttack ?? 1) > 1
                      ? `${robot.damage}×${robot.shotsPerAttack} (${robot.damage * (robot.shotsPerAttack ?? 1)})`
                      : robot.damage
                    : "—"}
                </strong>
              </div>
              <div className={styles.dexStatPill}>CD: <strong style={{ color: "#c084fc" }}>{robot.cooldown}s</strong></div>
            </div>

            <div className={styles.dexCoffeeBox}>
              <strong>☕ COFFEE BOOST:</strong> {robot.coffeeDescription}
            </div>
            <p className={styles.dexLore}>{robot.lore}</p>
          </aside>
        </div>
      ) : (
        <div className={styles.dexBody}>
          <div className={styles.dexGrid}>
            {ENEMY_ORDER.map((id) => {
              const def = ENEMY_CATALOG[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={`${styles.dexCard} ${selectedEnemyId === id ? styles.dexCardSelected : ""}`}
                  onClick={() => setSelectedEnemyId(id)}
                >
                  <PixelSpriteIcon sprite={{ type: "enemy", id }} size={68} />
                  <span className={styles.dexCardName}>{def.name}</span>
                  <span className={styles.dexCardCost} style={{ color: "#ff5ca8" }}>
                    {def.baseHp + def.armorHp} HP
                  </span>
                </button>
              );
            })}
          </div>

          <aside className={styles.dexInspector}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 22, color: "#ff5ca8" }}>{enemy.name.toUpperCase()}</strong>
              <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 6, background: "#3b1347", color: "#f9a8d4" }}>
                AI MONSTER
              </span>
            </div>

            <div className={styles.dexShowcase}>
              <PixelSpriteIcon sprite={{ type: "enemy", id: enemy.id }} size={124} animate />
            </div>

            <div className={styles.dexStats}>
              <div className={styles.dexStatPill}>BASE HP: <strong style={{ color: "#ff5ca8" }}>{enemy.baseHp}</strong></div>
              <div className={styles.dexStatPill}>ARMOR: <strong style={{ color: "#ff9f1c" }}>{enemy.armorHp}</strong></div>
              <div className={styles.dexStatPill}>BITE: <strong style={{ color: "#ffe14d" }}>{enemy.biteDps}/s</strong></div>
              <div className={styles.dexStatPill}>SCORE: <strong style={{ color: "#52f2b8" }}>+{enemy.scoreValue}</strong></div>
            </div>

            <p className={styles.dexLore}>{enemy.lore}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
