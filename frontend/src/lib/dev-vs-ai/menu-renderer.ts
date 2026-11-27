import {
  drawCoffeeCup,
  drawEnemySprite,
  drawGcBroom,
  drawRobotSprite,
  drawTokenCoin,
} from "@/lib/dev-vs-ai/sprites";
import { CANVAS_H, CANVAS_W } from "@/lib/dev-vs-ai/theme";

function drawSparkleStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

export function renderMainMenuCanvas(
  ctx: CanvasRenderingContext2D,
  time: number,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = true;

  // 1. Deep starry cyber-indigo gradient sky
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  sky.addColorStop(0, "#0b0d29");
  sky.addColorStop(0.55, "#191c4d");
  sky.addColorStop(0.85, "#2b2468");
  sky.addColorStop(1, "#1b2859");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 2. Ambient neural circuit lines (left & right corners)
  ctx.strokeStyle = "rgba(77, 216, 255, 0.22)";
  ctx.lineWidth = 2;
  const circuits: Array<Array<[number, number]>> = [
    [[0, 44], [110, 44], [150, 84], [240, 84]],
    [[0, 128], [66, 128], [108, 170], [185, 170]],
    [[60, 0], [60, 95], [120, 155]],
    [[960, 56], [855, 56], [815, 96], [740, 96]],
    [[960, 150], [875, 150], [835, 190]],
    [[640, 320], [700, 260], [780, 260]],
    [[660, 370], [720, 310], [810, 310]],
  ];
  for (const path of circuits) {
    ctx.beginPath();
    path.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    const [ex, ey] = path[path.length - 1];
    ctx.fillStyle = "#4dd8ff";
    ctx.beginPath();
    ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Twinkling stars
  const stars: Array<[number, number, number, string]> = [
    [142, 134, 6, "#4dd8ff"],
    [224, 64, 4, "#ffffff"],
    [322, 42, 3.5, "#ffe14d"],
    [762, 182, 7, "#c084fc"],
    [820, 74, 4.5, "#ffffff"],
    [684, 52, 4, "#4dd8ff"],
    [650, 290, 5, "#ff5ca8"],
    [122, 178, 5, "#4dd8ff"],
  ];
  for (let i = 0; i < stars.length; i++) {
    const [sx, sy, sr, col] = stars[i];
    const pulse = 0.65 + 0.4 * Math.sin(time * 3.5 + i * 1.4);
    drawSparkleStar(ctx, sx, sy, sr * pulse, col);
  }

  // 3. Floating golden TOKEN coins in sky (left & right)
  const skyTokens: Array<[number, number, number]> = [
    [92, 108, 1.1],
    [176, 68, 0.78],
    [194, 156, 0.85],
    [846, 102, 0.82],
    [906, 144, 1.1],
    [806, 170, 0.72],
  ];
  for (let i = 0; i < skyTokens.length; i++) {
    const [tx, ty, sc] = skyTokens[i];
    const bobY = ty + Math.sin(time * 2.2 + i * 1.1) * 5;
    drawTokenCoin(ctx, tx, bobY, time + i * 0.7, sc);
  }

  // 4. Glowing Cyber Floor Platform across the bottom
  const floorTop = 412;
  const wallGrad = ctx.createLinearGradient(0, floorTop, 0, floorTop + 58);
  wallGrad.addColorStop(0, "#38bdf8");
  wallGrad.addColorStop(0.2, "#2a438c");
  wallGrad.addColorStop(1, "#1e2e6b");
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, floorTop, CANVAS_W, 56);

  // Glowing cyan floor deck
  const deckGrad = ctx.createLinearGradient(0, floorTop + 54, 0, CANVAS_H);
  deckGrad.addColorStop(0, "#4dd8ff");
  deckGrad.addColorStop(0.32, "#2563eb");
  deckGrad.addColorStop(1, "#172554");
  ctx.fillStyle = deckGrad;
  ctx.fillRect(0, floorTop + 54, CANVAS_W, CANVAS_H - (floorTop + 54));

  // Floor perspective lines & dark border trim
  ctx.strokeStyle = "#0f1021";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, floorTop);
  ctx.lineTo(CANVAS_W, floorTop);
  ctx.moveTo(0, floorTop + 54);
  ctx.lineTo(CANVAS_W, floorTop + 54);
  ctx.moveTo(0, floorTop + 98);
  ctx.lineTo(CANVAS_W, floorTop + 98);
  ctx.stroke();

  ctx.strokeStyle = "rgba(186, 230, 253, 0.45)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const x = i * 96;
    ctx.beginPath();
    ctx.moveTo(x, floorTop + 54);
    ctx.lineTo(x + (i - 5) * 14, floorTop + 98);
    ctx.stroke();
  }

  // 5. Left Production Server Rack + Cozy Desk with Steaming Coffee Mug
  ctx.fillStyle = "#1e293b";
  ctx.strokeStyle = "#0f1021";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(14, 200, 142, 272, 8);
  ctx.fill();
  ctx.stroke();

  for (let slot = 0; slot < 9; slot++) {
    const sy = 216 + slot * 27;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(26, sy, 118, 19);
    for (let led = 0; led < 5; led++) {
      const blink = Math.floor(time * 3 + slot * 2 + led) % 3 !== 0;
      ctx.fillStyle = blink ? (led % 2 === 0 ? "#52f2b8" : "#4dd8ff") : "#1e293b";
      ctx.fillRect(34 + led * 14, sy + 6, 7, 6);
    }
    ctx.fillStyle = "#334155";
    ctx.fillRect(108, sy + 6, 28, 6);
  }

  // Wooden desk on far left edge + steaming coffee mug
  ctx.fillStyle = "#92400e";
  ctx.strokeStyle = "#0f1021";
  ctx.lineWidth = 3;
  ctx.fillRect(-4, 392, 92, 16);
  ctx.strokeRect(-4, 392, 92, 16);
  ctx.fillStyle = "#78350f";
  ctx.fillRect(66, 408, 12, 82);
  ctx.strokeRect(66, 408, 12, 82);
  drawCoffeeCup(ctx, 44, 376, true, time, 1.15);

  // 6. Left Defender Cast (big, heroic, layered just like the concept!)
  drawRobotSprite(ctx, "token-flower", 168, 286, { time, scale: 2.2, bobPhase: 0.2 });
  drawRobotSprite(ctx, "ping-blossom", 282, 316, { time, scale: 2.05, bobPhase: 1.4 });
  drawRobotSprite(ctx, "firewall-pod", 214, 412, { time, scale: 2.25, bobPhase: 0.7 });
  drawGcBroom(ctx, 304, 424, false, time, 1.85);

  // 7. Right Cyber Wall Edge + Playful AI Monster Cast
  ctx.fillStyle = "#475569";
  ctx.strokeStyle = "#0f1021";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(914, 188, 56, 308, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(920, 198, 8, 288);

  drawEnemySprite(ctx, "cone-bot", 872, 294, { time, hasArmor: true, scale: 2.0, bobPhase: 1.2 });
  drawEnemySprite(ctx, "prompt-slime", 764, 272, { time, scale: 1.95, bobPhase: 0.3 });
  drawEnemySprite(ctx, "six-finger-boss", 832, 404, { time, scale: 2.3, bobPhase: 2.1 });

  ctx.restore();
}
