import { drawCoffeeCup, drawRobotSprite } from "@/lib/dev-vs-ai/sprites";
import { CANVAS_H, CANVAS_W } from "@/lib/dev-vs-ai/theme";

export interface MapNodePoint {
  stageId: string;
  label: string;
  x: number;
  y: number;
  isBoss?: boolean;
  isEndless?: boolean;
  radius: number;
}

/**
 * Single source of truth for stage node coordinates on the 960x540 World Map canvas.
 * Shared by both the Canvas renderer and click/hover hit-testing.
 */
export const WORLD_MAP_NODES: MapNodePoint[] = [
  // World 1: Localhost (Left Mint Island)
  { stageId: "1-1", label: "1-1", x: 96, y: 342, radius: 24 },
  { stageId: "1-2", label: "1-2", x: 174, y: 342, radius: 24 },
  { stageId: "1-3", label: "1-3", x: 252, y: 342, radius: 24 },
  // World 2: Staging (Center Purple Island)
  { stageId: "2-1", label: "2-1", x: 398, y: 278, radius: 24 },
  { stageId: "2-2", label: "2-2", x: 476, y: 278, radius: 24 },
  { stageId: "2-3", label: "2-3", x: 544, y: 320, radius: 24 },
  { stageId: "2-4", label: "2-4", x: 616, y: 278, radius: 24 },
  // World 3: Production (Top-Right Citadel Island)
  { stageId: "3-1", label: "3-1", x: 716, y: 250, radius: 22 },
  { stageId: "3-2", label: "3-2", x: 772, y: 272, radius: 22 },
  { stageId: "3-3", label: "3-3", x: 826, y: 230, radius: 22 },
  { stageId: "3-4", label: "BOSS", x: 896, y: 214, radius: 25, isBoss: true },
  // Bonus: 24/7 On-Call (Bottom-Right Golden Portal Island)
  { stageId: "on-call", label: "∞", x: 846, y: 422, radius: 44, isEndless: true },
];

export interface WorldMapRenderState {
  time: number;
  selectedStageId: string;
  hoveredStageId: string | null;
  unlockedStages: Set<string>;
  stageStars: Record<string, number>;
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  text: string,
  fill: string,
  border: string,
): void {
  const h = 28;
  // Ribbon tails
  ctx.fillStyle = border;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - 14, cy - h / 2 + 4);
  ctx.lineTo(cx - w / 2 + 4, cy - h / 2 + 4);
  ctx.lineTo(cx - w / 2 + 4, cy + h / 2 + 4);
  ctx.lineTo(cx - w / 2 - 14, cy + h / 2 + 4);
  ctx.lineTo(cx - w / 2 - 6, cy + 4);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + w / 2 + 14, cy - h / 2 + 4);
  ctx.lineTo(cx + w / 2 - 4, cy - h / 2 + 4);
  ctx.lineTo(cx + w / 2 - 4, cy + h / 2 + 4);
  ctx.lineTo(cx + w / 2 + 14, cy + h / 2 + 4);
  ctx.lineTo(cx + w / 2 + 6, cy + 4);
  ctx.closePath();
  ctx.fill();

  // Main banner box
  ctx.fillStyle = fill;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 13px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 1);
}

function drawFloatingIsland(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  topFill: string,
  sideFill: string,
  strokeColor: string,
  depth = 26,
): void {
  // Underside rock/cyber thickness
  ctx.fillStyle = sideFill;
  ctx.strokeStyle = "#0f1021";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y + depth) : ctx.lineTo(x, y + depth)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Connect side walls
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    if (y1 >= points[0][1] - 20 || y2 >= points[0][1] - 20) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 + depth);
      ctx.lineTo(x1, y1 + depth);
      ctx.closePath();
    }
  }
  ctx.fill();

  // Top plateau surface
  ctx.fillStyle = topFill;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function renderWorldMapCanvas(
  ctx: CanvasRenderingContext2D,
  state: WorldMapRenderState,
): void {
  const { time, selectedStageId, hoveredStageId, unlockedStages, stageStars } = state;

  ctx.save();
  ctx.imageSmoothingEnabled = true;

  // 1. Deep space cyber background
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, "#090c21");
  bg.addColorStop(0.55, "#111638");
  bg.addColorStop(1, "#0b0f29");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle circuit traces in background
  ctx.strokeStyle = "rgba(77, 216, 255, 0.1)";
  ctx.lineWidth = 1.5;
  for (let y = 76; y < CANVAS_H; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }

  // Twinkling stars
  for (let i = 0; i < 24; i++) {
    const sx = (i * 173 + 41) % CANVAS_W;
    const sy = (i * 97 + 62) % (CANVAS_H - 60);
    const alpha = 0.25 + 0.55 * Math.abs(Math.sin(time * 1.8 + i));
    ctx.fillStyle = `rgba(186, 230, 253, ${alpha.toFixed(2)})`;
    ctx.fillRect(sx, sy, 2.5, 2.5);
  }

  // 2. Island 1: WORLD 1 LOCALHOST (Left Mint-Cyan Plateau)
  drawFloatingIsland(
    ctx,
    [
      [34, 304],
      [120, 248],
      [246, 248],
      [308, 302],
      [294, 376],
      [182, 412],
      [54, 374],
    ],
    "#5ff5c7",
    "#15616d",
    "#a7f3d0",
    22,
  );
  // Subtle circuit lines on Island 1
  ctx.strokeStyle = "rgba(15, 118, 110, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(74, 342);
  ctx.lineTo(270, 342);
  ctx.moveTo(132, 276);
  ctx.lineTo(132, 342);
  ctx.moveTo(212, 278);
  ctx.lineTo(212, 342);
  ctx.stroke();

  // Laptop landmark (left of Island 1)
  ctx.fillStyle = "#e2e8f0";
  ctx.strokeStyle = "#0f1021";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(74, 234, 42, 30, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(79, 239, 32, 20);
  ctx.fillStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(74, 264);
  ctx.lineTo(116, 264);
  ctx.lineTo(128, 280);
  ctx.lineTo(86, 280);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Dev Desk landmark (right of Island 1)
  ctx.fillStyle = "#b45309";
  ctx.fillRect(190, 250, 74, 14);
  ctx.strokeRect(190, 250, 74, 14);
  ctx.fillStyle = "#78350f";
  ctx.fillRect(194, 264, 8, 24);
  ctx.fillRect(252, 264, 8, 24);
  ctx.fillStyle = "#334155";
  ctx.fillRect(204, 224, 30, 24);
  ctx.strokeRect(204, 224, 30, 24);
  ctx.fillStyle = "#4dd8ff";
  ctx.fillRect(208, 228, 22, 16);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(240, 226, 16, 24);
  ctx.strokeRect(240, 226, 16, 24);

  drawRibbon(ctx, 174, 182, 198, "WORLD 1: LOCALHOST", "#164e63", "#52f2b8");

  // 3. Island 2: WORLD 2 STAGING (Center Lavender-Purple Plateau)
  drawFloatingIsland(
    ctx,
    [
      [340, 250],
      [430, 184],
      [564, 184],
      [660, 248],
      [650, 322],
      [524, 370],
      [362, 318],
    ],
    "#b86bff",
    "#4c1d95",
    "#e9d5ff",
    26,
  );

  // 3 glowing cyan isometric Attention Node pads on Island 2
  const pads: Array<[number, number]> = [
    [428, 224],
    [496, 208],
    [544, 232],
  ];
  for (const [px, py] of pads) {
    ctx.fillStyle = "#38bdf8";
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py - 14);
    ctx.lineTo(px + 26, py);
    ctx.lineTo(px, py + 14);
    ctx.lineTo(px - 26, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawRibbon(ctx, 496, 150, 184, "WORLD 2: STAGING", "#4c1d95", "#c084fc");

  // 4. Island 3: WORLD 3 PRODUCTION (Top-Right Magenta-Purple Citadel)
  drawFloatingIsland(
    ctx,
    [
      [666, 206],
      [744, 154],
      [882, 154],
      [942, 212],
      [924, 272],
      [790, 304],
      [682, 260],
    ],
    "#6b21a8",
    "#2e1065",
    "#f472b6",
    24,
  );

  // 3 glowing server towers on Island 3
  for (const [tx, ty, th] of [
    [694, 134, 62],
    [744, 128, 56],
    [792, 128, 56],
    [834, 122, 64],
  ]) {
    ctx.fillStyle = "#1e1b4b";
    ctx.strokeStyle = "#0f1021";
    ctx.lineWidth = 2;
    ctx.fillRect(tx, ty, 28, th);
    ctx.strokeRect(tx, ty, 28, th);
    for (let r = 0; r < 5; r++) {
      ctx.fillStyle = (Math.floor(time * 3 + r + tx) % 2 === 0) ? "#4dd8ff" : "#a855f7";
      ctx.fillRect(tx + 5, ty + 8 + r * 9, 18, 4);
    }
  }

  // Mini CRT Rogue LLM icon hovering above Boss 3-4!
  const bossHover = Math.sin(time * 3) * 4;
  ctx.fillStyle = "#94a3b8";
  ctx.strokeStyle = "#0f1021";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(872, 126 + bossHover, 48, 42, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(878, 132 + bossHover, 36, 28);
  ctx.fillStyle = "#ff4757";
  ctx.fillRect(884, 141 + bossHover, 8, 5);
  ctx.fillRect(900, 141 + bossHover, 8, 5);
  ctx.fillRect(888, 151 + bossHover, 16, 3);

  drawRibbon(ctx, 804, 92, 212, "WORLD 3: PRODUCTION", "#581c87", "#ff5ca8");

  // 5. Bonus Mini-Island: 24/7 ON-CALL (Bottom-Right Golden Portal)
  const endlessUnlocked = unlockedStages.has("on-call");
  const endlessHovered = hoveredStageId === "on-call";
  const endlessSelected = selectedStageId === "on-call";

  // Golden power cable from Staging -> On-Call island
  ctx.strokeStyle = endlessUnlocked ? "#ffe14d" : "#475569";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(626, 344);
  ctx.bezierCurveTo(705, 360, 690, 468, 790, 466);
  ctx.stroke();

  drawFloatingIsland(
    ctx,
    [
      [776, 434],
      [848, 398],
      [920, 434],
      [852, 476],
    ],
    endlessUnlocked ? "#fde047" : "#475569",
    "#78350f",
    endlessSelected || endlessHovered ? "#ffffff" : "#fef08a",
    18,
  );

  // Swirling Golden Portal Gate
  ctx.fillStyle = "#cbd5e1";
  ctx.strokeStyle = "#0f1021";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(816, 370, 48, 66, [22, 22, 4, 4]);
  ctx.fill();
  ctx.stroke();
  const portalGrad = ctx.createRadialGradient(840, 404, 4, 840, 404, 24);
  portalGrad.addColorStop(0, "#ffffff");
  portalGrad.addColorStop(0.5, endlessUnlocked ? "#ffe14d" : "#64748b");
  portalGrad.addColorStop(1, endlessUnlocked ? "#d97706" : "#334155");
  ctx.fillStyle = portalGrad;
  ctx.beginPath();
  ctx.roundRect(823, 378, 34, 56, [16, 16, 2, 2]);
  ctx.fill();

  drawCoffeeCup(ctx, 886, 428, endlessUnlocked, time, 0.72);

  ctx.fillStyle = "#ffe14d";
  ctx.font = "900 13px monospace";
  ctx.textAlign = "center";
  ctx.fillText("24/7 ON-CALL", 846, 354);

  // 6. Glowing Pipeline Connectors between Stage Nodes
  const connections: Array<[string, string, string]> = [
    ["1-1", "1-2", "#0f766e"],
    ["1-2", "1-3", "#0f766e"],
    ["1-3", "2-1", "#4dd8ff"],
    ["2-1", "2-2", "#4c1d95"],
    ["2-2", "2-3", "#4c1d95"],
    ["2-3", "2-4", "#4c1d95"],
    ["2-4", "3-1", "#c084fc"],
    ["3-1", "3-2", "#3b0764"],
    ["3-2", "3-3", "#3b0764"],
    ["3-3", "3-4", "#ff5ca8"],
  ];

  const nodeMap = new Map(WORLD_MAP_NODES.map((n) => [n.stageId, n]));
  for (const [fromId, toId, color] of connections) {
    const a = nodeMap.get(fromId);
    const b = nodeMap.get(toId);
    if (!a || !b) continue;
    ctx.strokeStyle = "#0f1021";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // Animated pulse dot along inter-world bridges
    if (fromId === "1-3" || fromId === "2-4") {
      const t = (time * 0.7) % 1;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 7. Draw Circular Stage Nodes + Stars
  for (const node of WORLD_MAP_NODES) {
    if (node.isEndless) continue;
    const isUnlocked = unlockedStages.has(node.stageId);
    const isSelected = selectedStageId === node.stageId;
    const isHovered = hoveredStageId === node.stageId;
    const stars = stageStars[node.stageId] ?? 0;

    // Pulsing golden selection halo
    if (isSelected) {
      const haloR = node.radius + 7 + Math.sin(time * 6) * 2.5;
      ctx.fillStyle = "rgba(255, 225, 77, 0.35)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3D base cylinder
    ctx.fillStyle = "#0f1021";
    ctx.beginPath();
    ctx.ellipse(node.x, node.y + 5, node.radius + 2, node.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Node cap
    const capFill = !isUnlocked
      ? "#1e244d"
      : node.isBoss
        ? "#c026d3"
        : isSelected
          ? "#fde68a"
          : stars > 0
            ? "#52f2b8"
            : "#60a5fa";
    ctx.fillStyle = capFill;
    ctx.strokeStyle = isSelected ? "#ffe14d" : isHovered ? "#ffffff" : "#0f1021";
    ctx.lineWidth = isSelected || isHovered ? 3 : 2.5;
    ctx.beginPath();
    ctx.ellipse(node.x, node.y, node.radius, node.radius * 0.84, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Label or Boss Skull
    if (node.isBoss) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 18px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isUnlocked ? "💀" : "🔒", node.x, node.y + 1);
    } else {
      ctx.fillStyle = !isUnlocked ? "#64748b" : "#0f172a";
      ctx.font = "900 13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isUnlocked ? node.label : "🔒", node.x, node.y + 1);
    }

    // 3 tiny golden stars beneath unlocked nodes
    if (isUnlocked) {
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#ffe14d";
      ctx.fillText(`${"★".repeat(stars)}${"☆".repeat(3 - stars)}`, node.x, node.y + node.radius + 11);
    }
  }

  // 8. Cute Bouncing Robot Marker standing on the currently selected campaign node!
  const selectedNode = nodeMap.get(selectedStageId);
  if (selectedNode && !selectedNode.isEndless) {
    drawRobotSprite(ctx, "firewall-pod", selectedNode.x, selectedNode.y - 26, {
      time,
      scale: 0.78,
    });
  }

  ctx.restore();
}

export function hitTestWorldMapNode(x: number, y: number): MapNodePoint | null {
  for (const node of WORLD_MAP_NODES) {
    const dist = Math.hypot(x - node.x, y - node.y);
    if (dist <= node.radius + 8) return node;
  }
  return null;
}
