import {
  canPlaceRobot,
  GRID_COLS,
  GRID_ROWS,
  isAttentionNode,
  type GameState,
  type RobotId,
} from "@/lib/dev-vs-ai/core";
import {
  drawBossRogueLlm,
  drawEnemySprite,
  drawGcBroom,
  drawProductionBase,
  drawRobotSprite,
  drawTokenCoin,
} from "@/lib/dev-vs-ai/sprites";
import {
  CANVAS_H,
  CANVAS_W,
  GRID_H,
  GRID_W,
  GRID_X,
  GRID_Y,
  gridToPixel,
  TILE_H,
  TILE_W,
  WORLD_THEMES,
} from "@/lib/dev-vs-ai/theme";

export interface RenderInteractionState {
  hoverCell: { row: number; col: number } | null;
  selectedRobot: RobotId | null;
  uninstallMode: boolean;
  coffeeMode: boolean;
}

export function renderGameCanvas(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  interaction: RenderInteractionState,
): void {
  const theme = WORLD_THEMES[state.stage.world];
  const time = state.elapsed;

  ctx.save();
  ctx.imageSmoothingEnabled = true;

  // Screen shake on explosions / overclock
  if (state.screenShakeTimer > 0) {
    const mag = state.screenShakeIntensity * 1.4 * (state.screenShakeTimer / 0.25);
    ctx.translate(
      Math.round((Math.random() - 0.5) * mag * 2),
      Math.round((Math.random() - 0.5) * mag * 2),
    );
  }

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, theme.bgTop);
  grad.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle ambient neural circuit backdrop lines
  ctx.strokeStyle = "rgba(77, 216, 255, 0.08)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const y = 48 + i * 92;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }

  // Left Production Server Rack & Dev Desk
  drawProductionBase(ctx, time);

  // LLM Neural Grid: horizontal synapse connectors
  for (let row = 0; row < GRID_ROWS; row++) {
    const activeRow = state.stage.activeRows.includes(row);
    const cy = GRID_Y + row * TILE_H + TILE_H / 2;
    ctx.strokeStyle = activeRow ? theme.circuitLine : "rgba(69, 88, 166, 0.2)";
    ctx.lineWidth = activeRow ? 4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(GRID_X - 24, cy);
    ctx.lineTo(GRID_X + GRID_W + 10, cy);
    ctx.stroke();

    // Animated Data Pulse traveling horizontally along active lanes
    if (activeRow) {
      const pulsePos = ((time * 135 + row * 165) % (GRID_W + 60)) - 30;
      ctx.fillStyle = theme.pulseColor;
      ctx.beginPath();
      ctx.roundRect(GRID_X + pulsePos, cy - 3, 18, 6, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(GRID_X + pulsePos + 9, cy - 1.5, 7, 3, 1.5);
      ctx.fill();
    }
  }

  // Grid Tiles (5 x 9 rounded LLM Nodes)
  for (let row = 0; row < GRID_ROWS; row++) {
    const activeRow = state.stage.activeRows.includes(row);
    for (let col = 0; col < GRID_COLS; col++) {
      const { x, y } = gridToPixel(col, row);
      const pad = 6;
      const w = TILE_W - pad * 2;
      const h = TILE_H - pad * 2;

      ctx.beginPath();
      ctx.roundRect(x + pad, y + pad, w, h, 10);

      if (!activeRow) {
        ctx.fillStyle = theme.tileInactiveBg;
        ctx.fill();
        ctx.strokeStyle = "rgba(69, 88, 166, 0.22)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        continue;
      }

      const attention = isAttentionNode(state, row, col);
      const isAlt = (row + col) % 2 === 1;
      ctx.fillStyle = isAlt ? theme.tileAltBg : theme.tileBg;
      ctx.fill();

      if (attention) {
        const pulse = 0.24 + 0.14 * Math.sin(time * 4.5 + row + col);
        ctx.fillStyle = `rgba(255, 225, 77, ${pulse.toFixed(2)})`;
        ctx.fill();
        ctx.strokeStyle = "#ffe14d";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = theme.tileBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // Boss Context Overflow Locked Tiles
  for (const lock of state.lockedTiles) {
    const { x, y } = gridToPixel(lock.col, lock.row);
    const pad = 6;
    const w = TILE_W - pad * 2;
    const h = TILE_H - pad * 2;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, w, h, 10);

    if (lock.warningTimer > 0) {
      const flash = Math.floor(time * 12) % 2 === 0;
      ctx.fillStyle = flash ? "rgba(255, 92, 168, 0.48)" : "rgba(255, 92, 168, 0.16)";
      ctx.fill();
      ctx.strokeStyle = "#ff5ca8";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(131, 24, 67, 0.82)";
      ctx.fill();
      ctx.strokeStyle = "#ff5ca8";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      const cx = x + TILE_W / 2;
      const cy = y + TILE_H / 2 - 5;
      ctx.strokeStyle = "#f9a8d4";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 7, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = "#ff5ca8";
      ctx.beginPath();
      ctx.roundRect(cx - 10, cy - 6, 20, 15, 4);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("LOCKED", cx, y + TILE_H - 12);
    }
  }

  // Hover Ghost Preview
  if (interaction.hoverCell && state.status === "playing") {
    const { row, col } = interaction.hoverCell;
    const { x, y } = gridToPixel(col, row);
    const pad = 6;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, TILE_W - pad * 2, TILE_H - pad * 2, 10);

    if (interaction.selectedRobot) {
      const valid = canPlaceRobot(state, interaction.selectedRobot, row, col);
      ctx.fillStyle = valid ? "rgba(82, 242, 184, 0.24)" : "rgba(255, 71, 87, 0.26)";
      ctx.fill();
      ctx.strokeStyle = valid ? "#52f2b8" : "#ff4757";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (valid) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        drawRobotSprite(ctx, interaction.selectedRobot, x + TILE_W / 2, y + TILE_H / 2, {
          time,
        });
        ctx.restore();
      }
    } else if (interaction.uninstallMode) {
      ctx.fillStyle = "rgba(255, 92, 119, 0.28)";
      ctx.fill();
      ctx.strokeStyle = "#ff5c77";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (interaction.coffeeMode) {
      ctx.fillStyle = "rgba(255, 225, 77, 0.28)";
      ctx.fill();
      ctx.strokeStyle = "#ffe14d";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // GC Brooms (parked on left edge or turbo sweeping)
  for (const broom of state.brooms) {
    if (broom.spent) continue;
    const bx = GRID_X + broom.x * TILE_W;
    const by = GRID_Y + broom.row * TILE_H + TILE_H / 2;
    drawGcBroom(ctx, bx, by, broom.active, time, 1.0);
  }

  // Robots
  for (const robot of state.robots) {
    const { x, y } = gridToPixel(robot.col, robot.row);
    const cx = x + TILE_W / 2;
    const cy = y + TILE_H / 2;
    drawRobotSprite(ctx, robot.id, cx, cy, {
      time,
      bobPhase: robot.bobPhase,
      recoil: robot.recoilTimer,
      hitFlash: robot.hitFlashTimer > 0,
      overclock: robot.overclockTimer > 0,
      armed: robot.armed,
      hpRatio: robot.hp / robot.maxHp,
      titanium: robot.id === "firewall-pod" && robot.maxHp > 3000,
    });

    if (robot.hp < robot.maxHp) {
      const ratio = Math.max(0, robot.hp / robot.maxHp);
      ctx.fillStyle = "#0f1021";
      ctx.fillRect(Math.round(cx - 20), Math.round(y + TILE_H - 12), 40, 5);
      ctx.fillStyle = ratio > 0.5 ? "#52f2b8" : ratio > 0.25 ? "#ffe14d" : "#ff5c77";
      ctx.fillRect(Math.round(cx - 19), Math.round(y + TILE_H - 11), Math.round(38 * ratio), 3);
    }
  }

  // Boss Rogue LLM (occupying right side of rows 1..3)
  if (state.boss?.active) {
    const bossX = GRID_X + 8.15 * TILE_W;
    const bossY = GRID_Y + 2.28 * TILE_H;
    drawBossRogueLlm(ctx, state.boss, bossX, bossY, time);
  }

  // AI Monsters
  for (const enemy of state.enemies) {
    const cx = GRID_X + enemy.x * TILE_W;
    const cy = GRID_Y + enemy.row * TILE_H + TILE_H / 2;
    drawEnemySprite(ctx, enemy.id, cx, cy, {
      time,
      bobPhase: enemy.bobPhase,
      hitFlash: enemy.hitFlashTimer > 0,
      slowed: enemy.slowTimer > 0,
      hasArmor: enemy.armor > 0,
      jumping: enemy.jumpTimer > 0,
    });

    const totalMax = enemy.maxHp + enemy.maxArmor;
    const totalCur = enemy.hp + enemy.armor;
    if (totalCur < totalMax) {
      const ratio = Math.max(0, totalCur / totalMax);
      ctx.fillStyle = "#0f1021";
      ctx.fillRect(Math.round(cx - 20), Math.round(cy - 34), 40, 5);
      ctx.fillStyle = enemy.armor > 0 ? "#ff9f1c" : "#ff5ca8";
      ctx.fillRect(Math.round(cx - 19), Math.round(cy - 33), Math.round(38 * ratio), 3);
    }
  }

  // Projectiles (glowing rounded plasma bolts)
  for (const proj of state.projectiles) {
    const px = GRID_X + proj.x * TILE_W;
    const py = GRID_Y + proj.row * TILE_H + TILE_H / 2 - 5;
    ctx.fillStyle = proj.color;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.roundRect(px - 20, py - 4, 20, 8, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(px, py, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = proj.color;
    ctx.fill();
    ctx.strokeStyle = "#0f1021";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + 1, py - 1.5, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  // Particles
  for (const p of state.particles) {
    const px = GRID_X + p.x * TILE_W;
    const py = GRID_Y + p.y * TILE_H;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px, py, p.size * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Spinning & Parabolic-Flying Round TOKEN Coins
  for (const coin of state.tokenCoins) {
    let drawX = GRID_X + coin.x * TILE_W;
    let drawY = GRID_Y + coin.y * TILE_H;
    let scale = 1.05;
    if (coin.collected) {
      const t = Math.min(1, coin.collectProgress);
      const sx = GRID_X + coin.startCollectX * TILE_W;
      const sy = GRID_Y + coin.startCollectY * TILE_H;
      const tx = 64;
      const ty = 44;
      const arcLift = Math.sin(t * Math.PI) * 52;
      drawX = sx + (tx - sx) * t;
      drawY = sy + (ty - sy) * t - arcLift;
      scale = 1.05 - t * 0.35;
    }
    drawTokenCoin(ctx, drawX, drawY, time + coin.uid * 0.3, scale);
  }

  // Floating Micro-Texts
  ctx.font = "900 14px monospace";
  ctx.textAlign = "center";
  for (const ft of state.floatingTexts) {
    const fx = GRID_X + ft.x * TILE_W;
    const fy = GRID_Y + ft.y * TILE_H;
    ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    ctx.fillStyle = "#0f1021";
    ctx.fillText(ft.text, fx + 2, fy + 2);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, fx, fy);
  }
  ctx.globalAlpha = 1;

  // Arcade Wave / Boss Phase Banner
  if (state.bannerText && state.bannerTimer > 0) {
    const alpha = Math.min(1, state.bannerTimer * 1.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    const by = GRID_Y + GRID_H / 2 - 30;
    ctx.fillStyle = "rgba(11, 13, 31, 0.92)";
    ctx.beginPath();
    ctx.roundRect(140, by, CANVAS_W - 280, 56, 12);
    ctx.fill();
    ctx.strokeStyle = "#ffe14d";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#ffe14d";
    ctx.font = "900 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(state.bannerText, CANVAS_W / 2, by + 35);
    ctx.restore();
  }

  ctx.restore();
}
