import type { BossEntity, EnemyId, RobotId } from "@/lib/dev-vs-ai/core";

const OUTLINE = "#0f1021";

function fillStrokePath(
  ctx: CanvasRenderingContext2D,
  fill: string,
  stroke = OUTLINE,
  lineWidth = 2,
): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke = OUTLINE,
  lineWidth = 2,
): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  fillStrokePath(ctx, fill, stroke, lineWidth);
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  rotation = 0,
  stroke = OUTLINE,
  lineWidth = 2,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rotation, 0, Math.PI * 2);
  fillStrokePath(ctx, fill, stroke, lineWidth);
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke = OUTLINE,
  lineWidth = 2,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  fillStrokePath(ctx, fill, stroke, lineWidth);
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color = "#ffffff",
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

export interface RobotDrawOptions {
  time: number;
  bobPhase?: number;
  recoil?: number;
  hitFlash?: boolean;
  overclock?: boolean;
  armed?: boolean;
  hpRatio?: number;
  titanium?: boolean;
  scale?: number;
}

export function drawRobotSprite(
  ctx: CanvasRenderingContext2D,
  id: RobotId,
  cx: number,
  cy: number,
  opts: RobotDrawOptions,
): void {
  const {
    time,
    bobPhase = 0,
    recoil = 0,
    hitFlash = false,
    overclock = false,
    armed = true,
    hpRatio = 1,
    titanium = false,
    scale = 1,
  } = opts;

  const bob = Math.sin(time * (overclock ? 9 : 4.0) + bobPhase) * 2.0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Soft ground shadow
  drawEllipse(ctx, 0, 24, 18, 5, "rgba(7, 8, 22, 0.45)", 0, OUTLINE, 0);

  // Golden Coffee Boost overclock aura
  if (overclock) {
    const pulse = 0.75 + 0.25 * Math.sin(time * 16);
    ctx.strokeStyle = `rgba(255, 225, 77, ${pulse.toFixed(2)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawSparkle(ctx, -22, -16 + Math.sin(time * 12) * 4, 5, "#ffe14d");
    drawSparkle(ctx, 22, -12 + Math.cos(time * 12) * 4, 4, "#fff3a1");
  }

  ctx.translate(-recoil * 5, bob);

  switch (id) {
    case "token-flower": {
      // Metallic silver stem & rounded leaves
      drawRoundRect(ctx, -3, 8, 6, 16, 3, "#cbd5e1");
      drawEllipse(ctx, -10, 17, 9, 4.5, "#cbd5e1", -0.35);
      drawEllipse(ctx, 10, 17, 9, 4.5, "#cbd5e1", 0.35);

      // 8 plump rounded golden solar petals
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const px = Math.cos(angle) * 16;
        const py = Math.sin(angle) * 16 - 5;
        drawEllipse(
          ctx,
          px,
          py,
          7.5,
          5.2,
          hitFlash ? "#ffffff" : i % 2 === 0 ? "#ffd23f" : "#f59e0b",
          angle,
        );
        if (!hitFlash) {
          drawEllipse(ctx, px, py - 1, 3.5, 2.2, "#fff3a1", angle, OUTLINE, 0);
        }
      }

      // Rounded silver bezel + dark LED screen
      drawRoundRect(ctx, -13, -18, 26, 26, 9, "#94a3b8");
      drawRoundRect(ctx, -10, -15, 20, 20, 7, "#1e293b", OUTLINE, 1.5);

      // Cute happy ^ ^ LED eyes & smile
      const blink = Math.floor(time * 2 + bobPhase) % 9 === 0;
      ctx.strokeStyle = "#ffe14d";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      if (blink) {
        ctx.beginPath();
        ctx.moveTo(-6, -7);
        ctx.lineTo(-2, -7);
        ctx.moveTo(2, -7);
        ctx.lineTo(6, -7);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(-4.5, -5.5, 2.5, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(4.5, -5.5, 2.5, Math.PI, 0);
        ctx.stroke();
      }
      ctx.strokeStyle = "#52f2b8";
      ctx.beginPath();
      ctx.arc(0, -3.5, 4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    }

    case "ping-blossom": {
      // Green stem & plump leaves
      drawRoundRect(ctx, -3, 8, 6, 16, 3, "#22c55e");
      drawEllipse(ctx, -11, 17, 10, 4.5, "#4ade80", -0.35);
      drawEllipse(ctx, 11, 17, 10, 4.5, "#4ade80", 0.35);

      // 6 plump rounded mint-green petals
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + 0.25;
        const px = Math.cos(angle) * 14 - 2;
        const py = Math.sin(angle) * 14 - 5;
        drawCircle(ctx, px, py, 8.2, hitFlash ? "#ffffff" : "#52f2b8");
        if (!hitFlash) {
          drawCircle(ctx, px - 2, py - 2, 3, "#a7f3d0", OUTLINE, 0);
        }
      }

      // Glossy round white camera head
      drawCircle(ctx, -2, -5, 13, hitFlash ? "#ffffff" : "#f1f5f9");
      drawEllipse(ctx, -5, -11, 5, 2.5, "#ffffff", -0.3, OUTLINE, 0);

      // Protruding 3D camera lens cannon pointing right
      drawEllipse(ctx, 9, -5, 9, 9.5, "#cbd5e1");
      drawCircle(ctx, 11, -5, 6.5, "#334155");
      drawCircle(ctx, 12, -5, 4.2, "#0f172a", "#4dd8ff", 1.5);
      drawCircle(ctx, 13, -6.5, 1.5, "#ffffff", OUTLINE, 0);

      // Muzzle flash when firing
      if (recoil > 0.08) {
        drawSparkle(ctx, 23, -5, 7, "#4dd8ff");
        drawCircle(ctx, 22, -5, 3, "#ffffff", OUTLINE, 0);
      }
      break;
    }

    case "firewall-pod": {
      const mainFill = hitFlash ? "#ffffff" : titanium ? "#bae6fd" : "#38bdf8";
      const darkFill = titanium ? "#38bdf8" : "#0284c7";

      // Stubby rounded feet
      drawRoundRect(ctx, -12, 14, 9, 9, 4, "#64748b");
      drawRoundRect(ctx, 3, 14, 9, 9, 4, "#64748b");
      // Rounded arms
      drawEllipse(ctx, -18, 2, 5.5, 9, "#7dd3fc", 0.15);
      drawEllipse(ctx, 18, 2, 5.5, 9, "#7dd3fc", -0.15);
      // Plump rounded barrel/pot body
      drawRoundRect(ctx, -16, -17, 32, 33, 12, mainFill);
      // Top rim highlight (pot shape)
      drawEllipse(ctx, 0, -16, 15, 4.5, "#bae6fd");
      drawEllipse(ctx, 0, -16, 11, 2.5, darkFill, 0, OUTLINE, 0);

      // Digital LED screen
      drawRoundRect(ctx, -11, -9, 22, 16, 5, "#0f172a", "#bae6fd", 1.5);
      if (hpRatio > 0.6) {
        drawCircle(ctx, -5, -3, 2, "#52f2b8", OUTLINE, 0);
        drawCircle(ctx, 5, -3, 2, "#52f2b8", OUTLINE, 0);
        ctx.strokeStyle = "#52f2b8";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, -1, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      } else if (hpRatio > 0.3) {
        ctx.fillStyle = "#ffe14d";
        ctx.fillRect(-7, -4, 4, 2);
        ctx.fillRect(3, -4, 4, 2);
        ctx.fillRect(-4, 2, 8, 2);
        drawEllipse(ctx, 8, -5, 2, 3.5, "#38bdf8", 0, OUTLINE, 0);
      } else {
        ctx.strokeStyle = "#ff5c77";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, -5);
        ctx.lineTo(-3, -1);
        ctx.moveTo(-3, -5);
        ctx.lineTo(-7, -1);
        ctx.moveTo(3, -5);
        ctx.lineTo(7, -1);
        ctx.moveTo(7, -5);
        ctx.lineTo(3, -1);
        ctx.stroke();
      }

      if (titanium) {
        drawRoundRect(ctx, 13, -12, 10, 22, 5, "#ffe14d");
        drawRoundRect(ctx, 15, -9, 6, 16, 3, "#fff3a1", OUTLINE, 0);
      }
      break;
    }

    case "bug-trap": {
      const blinkRed = armed && Math.floor(time * 6) % 2 === 0;
      // Cute green leaf on upper left
      drawEllipse(ctx, -14, -10, 8, 4.5, "#4ade80", -0.55);
      // Antenna + blinking red bulb
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, -21);
      ctx.stroke();
      drawCircle(ctx, 0, -22, 4, blinkRed ? "#ff4757" : armed ? "#b91c1c" : "#64748b");
      if (blinkRed) drawSparkle(ctx, 0, -22, 6, "#ffb3c1");

      // Smooth round metallic orb
      drawCircle(ctx, 0, 4, 15, hitFlash ? "#ffffff" : "#e2e8f0");
      drawCircle(ctx, 2, 5, 10.5, "#34d399");
      // Cute eyes & smile
      drawCircle(ctx, -2, 4, 2, "#0f172a", OUTLINE, 0);
      drawCircle(ctx, 6, 4, 2, "#0f172a", OUTLINE, 0);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(2, 7.5, 2.5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      break;
    }

    case "cooler-bot": {
      // Icy stem
      drawRoundRect(ctx, -3, 10, 6, 13, 3, "#38bdf8");
      // 8 crystal snowflake petals
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const px = Math.cos(angle) * 16;
        const py = Math.sin(angle) * 16 - 4;
        drawEllipse(ctx, px, py, 8, 4.8, hitFlash ? "#ffffff" : "#67e8f9", angle);
        if (!hitFlash) {
          drawEllipse(ctx, px, py, 4, 2.2, "#e0f2fe", angle, OUTLINE, 0);
        }
      }
      // Circular cooling fan housing + spinning blades
      drawCircle(ctx, 0, -4, 12.5, "#0e7490");
      drawCircle(ctx, 0, -4, 10, "#155e75", "#bae6fd", 1.5);
      const fanAngle = time * 8;
      for (let b = 0; b < 4; b++) {
        const a = fanAngle + (b * Math.PI) / 2;
        drawEllipse(ctx, Math.cos(a) * 5, -4 + Math.sin(a) * 5, 4.8, 2.4, "#e0f2fe", a, OUTLINE, 0.8);
      }
      drawCircle(ctx, 0, -4, 3.2, "#38bdf8");
      break;
    }

    case "dual-core": {
      // Sturdy stem & leaves
      drawRoundRect(ctx, -3.5, 8, 7, 16, 3, "#10b981");
      drawEllipse(ctx, -11, 17, 10, 4.5, "#34d399", -0.35);
      drawEllipse(ctx, 11, 17, 10, 4.5, "#34d399", 0.35);
      // Petals
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        drawCircle(
          ctx,
          Math.cos(angle) * 14 - 3,
          Math.sin(angle) * 14 - 5,
          8,
          hitFlash ? "#ffffff" : "#34d399",
        );
      }
      drawCircle(ctx, -3, -5, 13, hitFlash ? "#ffffff" : "#e2e8f0");
      // Twin rounded cannons
      drawRoundRect(ctx, 4, -15, 16, 8, 4, "#94a3b8");
      drawCircle(ctx, 18, -11, 3.5, "#52f2b8");
      drawRoundRect(ctx, 4, -3, 16, 8, 4, "#94a3b8");
      drawCircle(ctx, 18, 1, 3.5, "#4dd8ff");
      // Visor
      drawRoundRect(ctx, -11, -9, 10, 6, 3, "#0f172a", OUTLINE, 1);
      drawRoundRect(ctx, -9, -7.5, 6, 3, 1.5, "#52f2b8", OUTLINE, 0);
      break;
    }

    case "hotfix-core": {
      const flicker = Math.floor(time * 14) % 2 === 0;
      for (const ox of [-10, 10]) {
        // Glowing fuse flame
        drawCircle(ctx, ox, -20, 4.2, flicker ? "#ffe14d" : "#ff4757", OUTLINE, 1);
        drawCircle(ctx, ox, -20, 2, "#ffffff", OUTLINE, 0);
        // Rounded cylinder bomb body
        drawRoundRect(ctx, ox - 9, -12, 18, 27, 7, hitFlash ? "#ffffff" : "#ff6b35");
        drawRoundRect(ctx, ox - 7, -10, 14, 7, 4, "#ff9f1c", OUTLINE, 0);
        // Silver top & bottom caps
        drawRoundRect(ctx, ox - 8, -15, 16, 5, 2.5, "#cbd5e1");
        drawRoundRect(ctx, ox - 8, 12, 16, 5, 2.5, "#cbd5e1");
        // Determined eyes
        drawCircle(ctx, ox - 3.5, 0, 2, "#0f172a", OUTLINE, 0);
        drawCircle(ctx, ox + 3.5, 0, 2, "#0f172a", OUTLINE, 0);
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(ox - 6, -3);
        ctx.lineTo(ox - 1, -1.5);
        ctx.moveTo(ox + 6, -3);
        ctx.lineTo(ox + 1, -1.5);
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}

export interface EnemyDrawOptions {
  time: number;
  bobPhase?: number;
  hitFlash?: boolean;
  slowed?: boolean;
  hasArmor?: boolean;
  jumping?: boolean;
  scale?: number;
}

export function drawEnemySprite(
  ctx: CanvasRenderingContext2D,
  id: EnemyId,
  cx: number,
  cy: number,
  opts: EnemyDrawOptions,
): void {
  const {
    time,
    bobPhase = 0,
    hitFlash = false,
    slowed = false,
    hasArmor = false,
    jumping = false,
    scale = 1,
  } = opts;

  const bounce = Math.abs(Math.sin(time * (slowed ? 3.2 : 5.8) + bobPhase));
  const walkY = -bounce * 4.5;
  const stretchX = 1 + (0.5 - bounce) * 0.08;
  const stretchY = 1 - (0.5 - bounce) * 0.08;
  const jumpOffset = jumping ? -22 : 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Soft ground shadow
  drawEllipse(ctx, 0, 24, 18, 5, "rgba(7, 8, 22, 0.45)", 0, OUTLINE, 0);

  ctx.translate(0, walkY + jumpOffset);
  ctx.scale(stretchX, stretchY);

  const tint = (normal: string) => {
    if (hitFlash) return "#ffffff";
    if (slowed) return "#7dd3fc";
    return normal;
  };

  switch (id) {
    case "prompt-slime": {
      // Exact match to Sprite Sheet: smooth round-oval pink chat bubble,
      // bottom-left speech tail, glossy top-left arc, "..." dots, big round eyes, small open mouth
      const bodyGrad = ctx.createLinearGradient(-12, -16, 14, 18);
      bodyGrad.addColorStop(0, tint("#ff7ebc"));
      bodyGrad.addColorStop(0.65, tint("#f752a0"));
      bodyGrad.addColorStop(1, tint("#d62f7e"));

      // Speech bubble tail bottom-left + main plump oval body
      ctx.beginPath();
      ctx.ellipse(0, 1, 21, 17.5, 0, 0, Math.PI * 2);
      fillStrokePath(ctx, bodyGrad as unknown as string, OUTLINE, 2.4);

      ctx.beginPath();
      ctx.moveTo(-13, 13);
      ctx.lineTo(-16, 22);
      ctx.lineTo(-5, 16);
      ctx.closePath();
      fillStrokePath(ctx, tint("#e13b89"), OUTLINE, 2.2);
      // Cover inner seam of tail
      ctx.fillStyle = tint("#f04896");
      ctx.beginPath();
      ctx.ellipse(-9, 13, 6, 3.5, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Crisp white crescent highlight on top-left
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(-3, 0, 14, Math.PI * 1.15, Math.PI * 1.48);
      ctx.stroke();

      // Three tiny "..." typing dots on lower-left cheek
      ctx.fillStyle = "#831843";
      ctx.fillRect(-13, 9, 2, 2);
      ctx.fillRect(-9.5, 9, 2, 2);
      ctx.fillRect(-6, 9, 2, 2);

      // Two large round derpy white eyes with centered dark pupils
      drawCircle(ctx, -5.5, -1, 6, "#ffffff", OUTLINE, 2);
      drawCircle(ctx, 8.5, -1, 6, "#ffffff", OUTLINE, 2);
      drawCircle(ctx, -5.5, -1, 2.6, "#0f172a", OUTLINE, 0);
      drawCircle(ctx, 8.5, -1, 2.6, "#0f172a", OUTLINE, 0);

      // Small cute rounded-rectangle pink mouth below-center
      drawRoundRect(ctx, -1, 7, 7.5, 4.8, 2.2, "#9d174d", OUTLINE, 1.8);
      drawRoundRect(ctx, 0.5, 8.5, 4.5, 2, 1, "#ff85c0", OUTLINE, 0);
      break;
    }

    case "cone-bot": {
      // Exact match to Sprite Sheet: bell-shaped glossy purple slime with scalloped puddle base
      // and tall tilted orange-and-white striped traffic cone!
      const slimeGrad = ctx.createLinearGradient(-8, -10, 10, 20);
      slimeGrad.addColorStop(0, tint("#c084fc"));
      slimeGrad.addColorStop(0.6, tint("#a855f7"));
      slimeGrad.addColorStop(1, tint("#7e22ce"));

      ctx.beginPath();
      ctx.moveTo(-21, 16);
      ctx.quadraticCurveTo(-19, -8, 0, -9);
      ctx.quadraticCurveTo(19, -8, 21, 16);
      // Wavy 3-lobe slime puddle bottom
      ctx.quadraticCurveTo(15, 21, 8, 18.5);
      ctx.quadraticCurveTo(0, 21.5, -8, 18.5);
      ctx.quadraticCurveTo(-15, 21, -21, 16);
      ctx.closePath();
      fillStrokePath(ctx, slimeGrad as unknown as string, OUTLINE, 2.4);

      // Glossy highlight curve on left side + soft base rim highlight
      ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-13, 3);
      ctx.quadraticCurveTo(-11, -2, -7, -4);
      ctx.stroke();

      // Cute small dot eyes, rosy cheeks & tiny happy smile
      drawEllipse(ctx, -10, 8, 2.8, 1.6, "rgba(244, 114, 182, 0.55)", 0, OUTLINE, 0);
      drawEllipse(ctx, 10, 8, 2.8, 1.6, "rgba(244, 114, 182, 0.55)", 0, OUTLINE, 0);
      drawCircle(ctx, -5.5, 5.5, 2.2, "#0f172a", OUTLINE, 0);
      drawCircle(ctx, 5.5, 5.5, 2.2, "#0f172a", OUTLINE, 0);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.arc(0, 6.2, 2.8, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      // Tall tilted traffic cone hat if armor intact
      if (hasArmor) {
        ctx.save();
        ctx.translate(0, -8);
        ctx.rotate(-0.12);
        // Wide curved orange brim base
        ctx.beginPath();
        ctx.moveTo(-17, 2);
        ctx.quadraticCurveTo(0, 8, 17, 1);
        ctx.quadraticCurveTo(14, -3, 0, -2);
        ctx.quadraticCurveTo(-14, -3, -17, 2);
        ctx.closePath();
        fillStrokePath(ctx, hitFlash ? "#ffffff" : "#ea580c", OUTLINE, 2.2);

        // Tall cone body
        ctx.beginPath();
        ctx.moveTo(-11.5, 1);
        ctx.lineTo(-2.8, -26);
        ctx.quadraticCurveTo(0, -28.5, 2.8, -26);
        ctx.lineTo(11.5, 1);
        ctx.quadraticCurveTo(0, 4.5, -11.5, 1);
        ctx.closePath();
        fillStrokePath(ctx, hitFlash ? "#ffffff" : "#f97316", OUTLINE, 2.2);

        // Two crisp white stripes
        if (!hitFlash) {
          ctx.beginPath();
          ctx.moveTo(-9, -5.5);
          ctx.lineTo(-7, -11.5);
          ctx.quadraticCurveTo(0, -9.5, 7, -11.5);
          ctx.lineTo(9, -5.5);
          ctx.quadraticCurveTo(0, -3, -9, -5.5);
          ctx.closePath();
          fillStrokePath(ctx, "#ffffff", OUTLINE, 1.4);

          ctx.beginPath();
          ctx.moveTo(-5.5, -16);
          ctx.lineTo(-3.8, -21);
          ctx.lineTo(3.8, -21);
          ctx.lineTo(5.5, -16);
          ctx.closePath();
          fillStrokePath(ctx, "#ffffff", OUTLINE, 1.4);
        }
        ctx.restore();
      }
      break;
    }

    case "gpu-golem": {
      // Exact match to Sprite Sheet: muscular stone-lavender golem body + isometric 3D boxy GPU head
      // with left PCIe bracket & side vents + twin recessed radial fans on upper face!
      const stoneMain = tint("#949bc0");
      const stoneDark = tint("#6e7599");
      const stoneLight = tint("#bcc2e0");

      // Sturdy short legs
      drawRoundRect(ctx, -14, 12, 11, 11, 4, stoneDark, OUTLINE, 2.2);
      drawRoundRect(ctx, 3, 12, 11, 11, 4, stoneDark, OUTLINE, 2.2);

      // Muscular rounded arms & big fists at sides
      drawEllipse(ctx, -18, 6, 7, 10.5, stoneMain, 0.18, OUTLINE, 2.2);
      drawEllipse(ctx, 18, 6, 7, 10.5, stoneMain, -0.18, OUTLINE, 2.2);
      drawCircle(ctx, -18, 12, 5.5, stoneDark, OUTLINE, 2);
      drawCircle(ctx, 18, 12, 5.5, stoneDark, OUTLINE, 2);

      // Rounded torso + chest rivets
      drawRoundRect(ctx, -14, -4, 28, 20, 8, stoneMain, OUTLINE, 2.2);
      drawRoundRect(ctx, -6, 1, 3.5, 3, 1, stoneLight, OUTLINE, 1);
      drawRoundRect(ctx, 2.5, 1, 3.5, 3, 1, stoneLight, OUTLINE, 1);

      if (hasArmor) {
        // PCIe metal bracket tab sticking out top-left
        drawRoundRect(ctx, -23, -27, 6, 4, 1.5, "#cbd5e1", OUTLINE, 1.8);

        // 3D Left side panel of isometric GPU block head
        ctx.beginPath();
        ctx.moveTo(-19, -26);
        ctx.lineTo(-11, -29);
        ctx.lineTo(-11, -4);
        ctx.lineTo(-19, -7);
        ctx.closePath();
        fillStrokePath(ctx, hitFlash ? "#ffffff" : stoneDark, OUTLINE, 2.2);
        // Side heatsink vent slots
        if (!hitFlash) {
          ctx.fillStyle = "#1e293b";
          for (let sy = -22; sy <= -10; sy += 4) {
            ctx.fillRect(-17, sy, 4.5, 2);
          }
        }

        // Front square face of GPU block head
        drawRoundRect(ctx, -11, -29, 30, 25, 3.5, hitFlash ? "#ffffff" : stoneLight, OUTLINE, 2.2);
        // Stepped chin plate
        drawRoundRect(ctx, -4, -9, 16, 5, 1.5, hitFlash ? "#ffffff" : "#cbd5e1", OUTLINE, 1.6);

        // Twin recessed dark circular GPU cooling fans on upper face
        const fanSpin = time * 9;
        for (const fx of [-3.5, 11.5]) {
          drawCircle(ctx, fx, -20.5, 5.8, "#334155", OUTLINE, 1.8);
          for (let b = 0; b < 6; b++) {
            const a = fanSpin + (b * Math.PI) / 3;
            ctx.strokeStyle = "#94a3b8";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(fx, -20.5);
            ctx.lineTo(fx + Math.cos(a) * 4.8, -20.5 + Math.sin(a) * 4.8);
            ctx.stroke();
          }
          drawCircle(ctx, fx, -20.5, 1.8, "#0f172a", OUTLINE, 0);
        }

        // Two stoic square pixel eyes below fans
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-4.5, -13, 3.2, 3.2);
        ctx.fillRect(9.5, -13, 3.2, 3.2);
      } else {
        // Armor broken -> smaller exposed core head
        drawRoundRect(ctx, -12, -21, 24, 18, 6, stoneMain, OUTLINE, 2.2);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-6, -13, 3.2, 3.2);
        ctx.fillRect(3, -13, 3.2, 3.2);
      }
      break;
    }

    case "glitch-hopper": {
      // Exact match to Sprite Sheet: full-body agile neon-magenta imp/goblin with swept pointed ears,
      // cyan-glint angry eyes, wide grin, outstretched arms, raised jumping knee, and left glitch squares!
      const magMain = tint("#f725b5");
      const magLight = tint("#ff70d9");
      const magDark = tint("#b5179e");

      // Detached pixel glitch squares floating on the left side
      const gShift = Math.sin(time * 18) * 2.5;
      ctx.fillStyle = "#f725b5";
      ctx.fillRect(-26 - gShift, -6, 4.5, 4.5);
      ctx.fillRect(-21, 3 + gShift, 4, 4);
      ctx.fillStyle = "#a855f7";
      ctx.fillRect(-25, 11 - gShift, 3.5, 3.5);
      ctx.fillRect(-17 - gShift, 14, 3, 3);

      // Dynamic jumping legs (left leg down, right knee raised!)
      drawRoundRect(ctx, -7, 9, 5.5, 12, 2.8, magDark, OUTLINE, 2);
      drawRoundRect(ctx, 2, 5, 6, 10, 3, magMain, OUTLINE, 2);

      // Outstretched arms (left arm reaching left-down, right arm forward)
      ctx.save();
      ctx.translate(-8, 2);
      ctx.rotate(0.55);
      drawRoundRect(ctx, -9, -2.5, 10, 5, 2.5, magMain, OUTLINE, 2);
      ctx.restore();

      ctx.save();
      ctx.translate(8, 2);
      ctx.rotate(-0.45);
      drawRoundRect(ctx, -1, -2.5, 10, 5, 2.5, magMain, OUTLINE, 2);
      ctx.restore();

      // Compact agile torso
      drawRoundRect(ctx, -7.5, -2, 15, 13, 6, magMain, OUTLINE, 2.2);

      // Swept-back pointed imp ears
      ctx.beginPath();
      ctx.moveTo(-9, -11);
      ctx.lineTo(-19, -24);
      ctx.lineTo(-2, -17);
      ctx.closePath();
      fillStrokePath(ctx, magMain, OUTLINE, 2.2);

      ctx.beginPath();
      ctx.moveTo(9, -11);
      ctx.lineTo(19, -24);
      ctx.lineTo(2, -17);
      ctx.closePath();
      fillStrokePath(ctx, magMain, OUTLINE, 2.2);

      // Imp head
      drawEllipse(ctx, 0, -11, 13.5, 11.5, magMain, 0, OUTLINE, 2.2);
      drawEllipse(ctx, -3, -17, 6, 2.5, magLight, -0.2, OUTLINE, 0);

      // Slanted dark eyes with bright CYAN glints + mischievous grin!
      ctx.beginPath();
      ctx.moveTo(-9, -14);
      ctx.lineTo(-2, -11);
      ctx.lineTo(-8, -9.5);
      ctx.closePath();
      fillStrokePath(ctx, "#0f172a", OUTLINE, 1);
      drawCircle(ctx, -5.5, -11.5, 1.4, "#4dd8ff", OUTLINE, 0);

      ctx.beginPath();
      ctx.moveTo(9, -14);
      ctx.lineTo(2, -11);
      ctx.lineTo(8, -9.5);
      ctx.closePath();
      fillStrokePath(ctx, "#0f172a", OUTLINE, 1);
      drawCircle(ctx, 5.5, -11.5, 1.4, "#4dd8ff", OUTLINE, 0);

      // Cheeky grin
      ctx.beginPath();
      ctx.moveTo(-6.5, -6.5);
      ctx.quadraticCurveTo(0, -3, 6.5, -6.5);
      ctx.quadraticCurveTo(0, -5, -6.5, -6.5);
      fillStrokePath(ctx, "#0f172a", OUTLINE, 1.5);
      break;
    }

    case "six-finger-boss": {
      // Exact match to Sprite Sheet: soft pastel-lilac plush giant with vertical belly seam,
      // smooth round head, wide happy open laugh, and TWO raised arms with 6 distinct spread fingers!
      const plushMain = tint("#c4abfa");
      const plushLight = tint("#ddd0fe");
      const plushShade = tint("#9d7bea");

      // Sturdy plush legs
      drawRoundRect(ctx, -16, 12, 12, 13, 5, plushShade, OUTLINE, 2.4);
      drawRoundRect(ctx, 4, 12, 12, 13, 5, plushShade, OUTLINE, 2.4);

      // Raised thick plush arms + large 6-fingered open hands on BOTH sides!
      const wave = Math.sin(time * 5.5 + bobPhase) * 0.1;
      for (const side of [-1, 1] as const) {
        ctx.save();
        ctx.translate(side * 18, -2);
        ctx.rotate(side * (-0.55 + wave));
        // Forearm
        drawRoundRect(ctx, side === -1 ? -16 : -2, -7, 18, 13, 6.5, plushMain, OUTLINE, 2.2);
        // Palm centered at end of arm
        const px = side * 14;
        const py = -4;
        // 6 spread-out sausage fingers fanning around the top of the palm!
        for (let f = 0; f < 6; f++) {
          const angle = -Math.PI * 0.92 + (f / 5) * Math.PI * 0.84;
          const fx = px + Math.cos(angle) * 9.5;
          const fy = py + Math.sin(angle) * 9.5 - 2;
          drawEllipse(ctx, fx, fy, 2.4, 4.8, plushLight, angle + Math.PI / 2, OUTLINE, 1.6);
        }
        drawCircle(ctx, px, py, 7.5, plushLight, OUTLINE, 2);
        ctx.restore();
      }

      // Chubby rounded torso with plush center seam
      drawRoundRect(ctx, -19, -7, 38, 25, 13, plushMain, OUTLINE, 2.4);
      drawEllipse(ctx, 0, 6, 13, 10, plushLight, 0, OUTLINE, 0);
      ctx.strokeStyle = plushShade;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 17);
      ctx.stroke();

      // Smooth bald round head
      drawEllipse(ctx, 0, -16, 15.5, 14, plushMain, 0, OUTLINE, 2.4);
      drawEllipse(ctx, -4, -24, 6.5, 2.8, "rgba(255,255,255,0.55)", -0.2, OUTLINE, 0);

      // Happy eyebrows, dark eyes, pink cheeks & wide laughing mouth
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(-6.5, -20, 3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(6.5, -20, 3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      drawCircle(ctx, -6.5, -17, 2.5, "#0f172a", OUTLINE, 0);
      drawCircle(ctx, 6.5, -17, 2.5, "#0f172a", OUTLINE, 0);
      drawCircle(ctx, -11, -13.5, 2.6, "rgba(244, 114, 182, 0.55)", OUTLINE, 0);
      drawCircle(ctx, 11, -13.5, 2.6, "rgba(244, 114, 182, 0.55)", OUTLINE, 0);

      ctx.beginPath();
      ctx.arc(0, -13, 6.2, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.closePath();
      fillStrokePath(ctx, "#581c87", OUTLINE, 1.8);
      drawEllipse(ctx, 0, -9.5, 3.8, 1.8, "#fb7185", 0, OUTLINE, 0);
      break;
    }

    case "mini-prompt": {
      drawEllipse(ctx, 0, 4, 12, 10, tint("#ff7ebc"), 0, OUTLINE, 2);
      drawCircle(ctx, -3.8, 3, 3.4, "#ffffff", OUTLINE, 1.5);
      drawCircle(ctx, 4.2, 3, 3.4, "#ffffff", OUTLINE, 1.5);
      drawCircle(ctx, -3.8, 3, 1.5, "#0f172a", OUTLINE, 0);
      drawCircle(ctx, 4.2, 3, 1.5, "#0f172a", OUTLINE, 0);
      break;
    }
  }

  ctx.restore();
}

function drawFacetedCrystal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  inverted = false,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (inverted) ctx.scale(1, -1);

  const hw = w / 2;
  // Full crystal silhouette with dark outline
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(hw, -h * 0.42);
  ctx.lineTo(hw * 0.78, 0);
  ctx.lineTo(-hw * 0.78, 0);
  ctx.lineTo(-hw, -h * 0.42);
  ctx.closePath();

  const baseGrad = ctx.createLinearGradient(0, -h, 0, 0);
  baseGrad.addColorStop(0, inverted ? "#f5d0fe" : "#cffafe");
  baseGrad.addColorStop(0.45, inverted ? "#c084fc" : "#38bdf8");
  baseGrad.addColorStop(1, "#9333ea");
  fillStrokePath(ctx, baseGrad as unknown as string, OUTLINE, 2.2);

  // Left bright facet
  ctx.fillStyle = inverted ? "rgba(250, 232, 255, 0.55)" : "rgba(224, 242, 254, 0.65)";
  ctx.beginPath();
  ctx.moveTo(0, -h + 2);
  ctx.lineTo(-2, -2);
  ctx.lineTo(-hw * 0.72, -2);
  ctx.lineTo(-hw + 2, -h * 0.42);
  ctx.closePath();
  ctx.fill();

  // Right deep magenta/violet facet
  ctx.fillStyle = "rgba(134, 25, 143, 0.42)";
  ctx.beginPath();
  ctx.moveTo(0, -h + 2);
  ctx.lineTo(hw - 2, -h * 0.42);
  ctx.lineTo(hw * 0.72, -2);
  ctx.lineTo(2, -2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawHologramOpenHand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18 + Math.sin(time * 3.6) * 0.08);

  // Outer neon magenta glow
  ctx.shadowColor = "#f472b6";
  ctx.shadowBlur = 14;

  // Single unified 6-digit open palm + splayed fingers silhouette!
  // 5 upper fingers fanning from left to right + 1 thumb sticking out on the right
  ctx.beginPath();
  // Wrist bottom-left
  ctx.moveTo(-11, 20);
  ctx.quadraticCurveTo(-18, 12, -19, 2);
  // Finger 1 (far left pinky)
  ctx.lineTo(-29, -9);
  ctx.quadraticCurveTo(-32, -14, -27, -16);
  ctx.lineTo(-15, -5);
  // Finger 2
  ctx.lineTo(-23, -21);
  ctx.quadraticCurveTo(-24, -27, -18, -27);
  ctx.lineTo(-9, -9);
  // Finger 3 (middle)
  ctx.lineTo(-12, -28);
  ctx.quadraticCurveTo(-11, -34, -5, -33);
  ctx.lineTo(-1, -11);
  // Finger 4
  ctx.lineTo(1, -29);
  ctx.quadraticCurveTo(4, -34, 9, -31);
  ctx.lineTo(7, -9);
  // Finger 5
  ctx.lineTo(14, -23);
  ctx.quadraticCurveTo(18, -27, 21, -22);
  ctx.lineTo(13, -3);
  // 6th digit: Thumb extending right!
  ctx.lineTo(25, -5);
  ctx.quadraticCurveTo(31, -6, 30, 0);
  ctx.lineTo(17, 10);
  // Wrist bottom-right curving back
  ctx.quadraticCurveTo(10, 22, -11, 20);
  ctx.closePath();

  const handGrad = ctx.createLinearGradient(-20, -30, 20, 22);
  handGrad.addColorStop(0, "rgba(232, 121, 249, 0.88)");
  handGrad.addColorStop(0.55, "rgba(168, 85, 247, 0.85)");
  handGrad.addColorStop(1, "rgba(217, 70, 239, 0.92)");
  ctx.fillStyle = handGrad;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = "#fae8ff";
  ctx.stroke();

  ctx.shadowBlur = 0;
  // Subtle glowing palm crease arc
  ctx.strokeStyle = "rgba(250, 232, 255, 0.6)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 6, 10, Math.PI * 1.1, Math.PI * 1.85);
  ctx.stroke();

  ctx.restore();
}

function drawHologramClawHand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.1 + Math.cos(time * 3.4) * 0.08);

  ctx.shadowColor = "#e879f9";
  ctx.shadowBlur = 14;

  // Expressive upward-reaching hologram hand (thumb left, 4 curved fingers right)
  ctx.beginPath();
  ctx.moveTo(-8, 22);
  ctx.quadraticCurveTo(-18, 17, -25, 8);
  // Left thumb curving inward
  ctx.quadraticCurveTo(-30, 3, -25, -1);
  ctx.lineTo(-13, 6);
  ctx.quadraticCurveTo(-10, 0, -6, -4);
  // Index finger reaching up
  ctx.lineTo(-8, -21);
  ctx.quadraticCurveTo(-7, -26, -2, -24);
  ctx.lineTo(1, -6);
  // Middle finger
  ctx.lineTo(4, -24);
  ctx.quadraticCurveTo(7, -29, 11, -25);
  ctx.lineTo(8, -5);
  // Ring finger
  ctx.lineTo(14, -20);
  ctx.quadraticCurveTo(18, -24, 20, -18);
  ctx.lineTo(14, -1);
  // Pinky finger
  ctx.lineTo(21, -11);
  ctx.quadraticCurveTo(25, -13, 25, -7);
  ctx.quadraticCurveTo(22, 16, -8, 22);
  ctx.closePath();

  const handGrad = ctx.createLinearGradient(-16, -24, 18, 22);
  handGrad.addColorStop(0, "rgba(240, 171, 252, 0.9)");
  handGrad.addColorStop(0.5, "rgba(192, 38, 211, 0.88)");
  handGrad.addColorStop(1, "rgba(147, 51, 234, 0.92)");
  ctx.fillStyle = handGrad;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = "#fae8ff";
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawBossRogueLlm(
  ctx: CanvasRenderingContext2D,
  boss: BossEntity,
  cx: number,
  cy: number,
  time: number,
): void {
  const hover = Math.sin(time * 2.4) * 6;
  const bx = cx;
  const by = cy + hover;

  ctx.save();
  ctx.translate(bx, by);

  // 1. Ambient neon glitch pixel swarm drifting to the left & bottom of Boss
  const glitchPixels: Array<[number, number, number, number, string]> = [
    [-112, 18, 6, 3, "#4dd8ff"],
    [-96, 36, 4, 4, "#f43f9e"],
    [-124, 52, 7, 3, "#38bdf8"],
    [-84, 64, 5, 4, "#c084fc"],
    [-106, 78, 4, 4, "#4dd8ff"],
    [-68, 86, 6, 3, "#f43f9e"],
    [-92, -8, 5, 3, "#c084fc"],
    [-54, 56, 5, 5, "#38bdf8"],
  ];
  for (let i = 0; i < glitchPixels.length; i++) {
    const [gx, gy, gw, gh, col] = glitchPixels[i];
    const driftX = Math.sin(time * 5 + i * 1.7) * 5;
    const driftY = Math.cos(time * 4 + i * 1.3) * 3;
    ctx.fillStyle = col;
    ctx.fillRect(gx + driftX, gy + driftY, gw, gh);
  }

  // Soft purple-magenta boss aura
  const aura = ctx.createRadialGradient(-6, 0, 24, -6, 0, 115);
  aura.addColorStop(0, "rgba(168, 85, 247, 0.36)");
  aura.addColorStop(1, "rgba(168, 85, 247, 0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(-6, 0, 115, 0, Math.PI * 2);
  ctx.fill();

  // 2. Bottom Inverted Faceted Crystal Cluster (hanging beneath the 3D CRT)
  drawFacetedCrystal(ctx, -18, 50, 22, 34, 0.22, true);
  drawFacetedCrystal(ctx, 14, 48, 20, 30, -0.24, true);
  drawFacetedCrystal(ctx, -2, 52, 28, 46, 0.03, true);

  // 3. Isometric 3D Retro CRT Monitor Casing (angled slightly left!)
  const isFlash = boss.hitFlashTimer > 0;

  // 3A. Top 3D Perspective Plane
  ctx.beginPath();
  ctx.moveTo(-64, -52);
  ctx.lineTo(-22, -74);
  ctx.lineTo(66, -64);
  ctx.lineTo(36, -40);
  ctx.closePath();
  fillStrokePath(ctx, isFlash ? "#ffffff" : "#8b9cf8", OUTLINE, 2.8);

  // Crystal socket rim on top plane
  drawEllipse(ctx, 2, -57, 34, 11, "#312e81", 0.08, "#a5b4fc", 2);

  // 3B. Multi-Faceted Quartz Crystal Crown erupting from socket!
  drawFacetedCrystal(ctx, -22, -56, 18, 32, -0.34, false);
  drawFacetedCrystal(ctx, 24, -55, 18, 30, 0.34, false);
  drawFacetedCrystal(ctx, -10, -55, 22, 44, -0.14, false);
  drawFacetedCrystal(ctx, 12, -54, 22, 40, 0.16, false);
  drawFacetedCrystal(ctx, 1, -53, 26, 54, 0.0, false);

  // 3C. Right 3D Perspective Side Panel
  ctx.beginPath();
  ctx.moveTo(36, -40);
  ctx.lineTo(66, -64);
  ctx.lineTo(66, 30);
  ctx.lineTo(36, 56);
  ctx.closePath();
  fillStrokePath(ctx, isFlash ? "#ffffff" : "#4b4da3", OUTLINE, 2.8);

  // Protruding purple side vent module on right 3D panel
  ctx.beginPath();
  ctx.moveTo(46, -16);
  ctx.lineTo(69, -32);
  ctx.lineTo(69, 8);
  ctx.lineTo(46, 24);
  ctx.closePath();
  fillStrokePath(ctx, isFlash ? "#ffffff" : "#9333ea", OUTLINE, 2.2);
  if (!isFlash) {
    ctx.strokeStyle = "#1e1b4b";
    ctx.lineWidth = 2.2;
    for (let v = 0; v < 4; v++) {
      const vy = -8 + v * 7;
      ctx.beginPath();
      ctx.moveTo(51, vy);
      ctx.lineTo(64, vy - 9);
      ctx.stroke();
    }
  }

  // 3D. Main Front Beveled CRT Face (slightly perspective-tilted toward left!)
  ctx.beginPath();
  ctx.moveTo(-64, -52);
  ctx.lineTo(36, -40);
  ctx.lineTo(36, 56);
  ctx.lineTo(-64, 42);
  ctx.closePath();
  const frontGrad = ctx.createLinearGradient(-64, -52, 36, 56);
  frontGrad.addColorStop(0, isFlash ? "#ffffff" : "#7c8bf5");
  frontGrad.addColorStop(1, isFlash ? "#ffffff" : "#565dd4");
  fillStrokePath(ctx, frontGrad as unknown as string, OUTLINE, 3);

  // Top highlight strip on front bezel
  if (!isFlash) {
    ctx.strokeStyle = "rgba(224, 231, 255, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-58, -47);
    ctx.lineTo(30, -36);
    ctx.stroke();
  }

  // Bottom CRT chin controls: red power LED + indicator slots
  drawCircle(ctx, -53, 35, 3, "#ff4757", OUTLINE, 1.2);
  ctx.fillStyle = "#312e81";
  ctx.fillRect(-43, 35, 10, 3);
  ctx.fillRect(8, 42, 18, 4);

  // 3E. Deep Recessed Dark Curved CRT Glass Screen
  ctx.beginPath();
  ctx.moveTo(-54, -40);
  ctx.lineTo(25, -30);
  ctx.lineTo(25, 36);
  ctx.lineTo(-54, 26);
  ctx.closePath();
  const screenGrad = ctx.createRadialGradient(-14, -2, 8, -14, -2, 56);
  screenGrad.addColorStop(0, "#14294a");
  screenGrad.addColorStop(1, "#090f24");
  fillStrokePath(ctx, screenGrad as unknown as string, "#1e293b", 3);

  // Subtle CRT horizontal scanlines
  ctx.fillStyle = "rgba(103, 232, 249, 0.06)";
  for (let sy = -34; sy <= 28; sy += 5) {
    ctx.fillRect(-51, sy, 73, 2);
  }

  // 4. Expressive CRT Phosphor Face (centered on the angled screen around x=-15, y=-2)
  ctx.save();
  ctx.translate(-15, -1);
  ctx.transform(1, 0.12, 0, 1, 0, 0); // Match perspective tilt of the front CRT screen!

  if (boss.expression === "hurt") {
    ctx.strokeStyle = "#ff5c77";
    ctx.lineWidth = 4.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-24, -18);
    ctx.lineTo(-10, -4);
    ctx.moveTo(-10, -18);
    ctx.lineTo(-24, -4);
    ctx.moveTo(10, -18);
    ctx.lineTo(24, -4);
    ctx.moveTo(24, -18);
    ctx.lineTo(10, -4);
    ctx.stroke();
    // Jagged glitch mouth
    ctx.beginPath();
    ctx.moveTo(-18, 14);
    ctx.lineTo(-8, 8);
    ctx.lineTo(0, 15);
    ctx.lineTo(10, 8);
    ctx.lineTo(18, 14);
    ctx.stroke();
  } else if (boss.expression === "panic") {
    drawCircle(ctx, -16, -11, 9.5, "#ffffff", OUTLINE, 0);
    drawCircle(ctx, 16, -11, 9.5, "#ffffff", OUTLINE, 0);
    drawCircle(ctx, -16, -11, 4, "#090f24", OUTLINE, 0);
    drawCircle(ctx, 16, -11, 4, "#090f24", OUTLINE, 0);
    drawEllipse(ctx, 0, 13, 16, 9, "#ff5c77", 0, OUTLINE, 0);
  } else {
    const glowCol = boss.expression === "casting" ? "#ffe14d" : "#67e8f9";
    const brightCol = boss.expression === "casting" ? "#fef9c3" : "#cffafe";

    // Smug arched eyebrows!
    ctx.strokeStyle = glowCol;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-16, -15, 11, Math.PI * 1.15, Math.PI * 1.78);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(16, -13, 11, Math.PI * 1.22, Math.PI * 1.88);
    ctx.stroke();

    // Left glowing almond eye
    drawEllipse(ctx, -16, -9, 7.5, 8.5, brightCol, -0.1, glowCol, 2);

    // Right mischievous winking arc!
    ctx.strokeStyle = brightCol;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(16, -6, 8.5, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();

    // Iconic Wide Cheeky Toothy Grin!
    ctx.beginPath();
    ctx.moveTo(-25, 4);
    ctx.quadraticCurveTo(0, 12, 24, 5);
    ctx.quadraticCurveTo(16, 26, -1, 25);
    ctx.quadraticCurveTo(-18, 24, -25, 4);
    ctx.closePath();
    ctx.fillStyle = brightCol;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = glowCol;
    ctx.stroke();

    // Vertical dark tooth dividers across the grin
    ctx.strokeStyle = "#0d1b38";
    ctx.lineWidth = 2;
    for (const tx of [-13, -4, 5, 14]) {
      ctx.beginPath();
      ctx.moveTo(tx, 7);
      ctx.lineTo(tx - 1, 23);
      ctx.stroke();
    }
  }
  ctx.restore();

  // 5. Two Distinct Floating Neon Hologram Hands matching the concept!
  // Upper-left open waving 6-digit hand + Lower-right upward-curled claw hand
  const handBobL = Math.sin(time * 3.8) * 7;
  const handBobR = Math.cos(time * 3.8) * 7;
  drawHologramOpenHand(ctx, -96, -46 + handBobL, time);
  drawHologramClawHand(ctx, 18, 92 + handBobR, time);

  ctx.restore();
}

/**
 * True round golden TOKEN coin matching the concept art:
 * circular rim, inner gold face, 5-point star watermark, crisp "TOKEN" text, and sparkle!
 */
export function drawTokenCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  time: number,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const r = 17;
  // Smooth horizontal spin pulse (stays circular/oval, never square!)
  const spinX = 0.78 + 0.22 * Math.abs(Math.cos(time * 3.4));

  ctx.save();
  ctx.scale(spinX, 1);

  // Outer warm orange-gold rim
  drawCircle(ctx, 0, 0, r, "#f59e0b", "#78350f", 2.2);
  // Inner bright golden face
  drawCircle(ctx, 0, 0, r - 3.5, "#ffe14d", "#d97706", 1.5);
  // Subtle glossy top crescent
  drawEllipse(ctx, -3, -7, 7, 3, "#fff7b2", -0.3, OUTLINE, 0);

  // Subtle 5-point star watermark in center
  ctx.fillStyle = "rgba(245, 158, 11, 0.35)";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? 10 : 4.5;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();

  // Crisp "TOKEN" text across center
  ctx.fillStyle = "#92400e";
  ctx.font = "900 7.5px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TOKEN", 0, 0.5);

  ctx.restore();

  // Twinkling 4-point star sparkle on upper-right edge
  const sparkleScale = 0.75 + 0.35 * Math.sin(time * 7);
  drawSparkle(ctx, r * 0.78, -r * 0.78, 5.5 * sparkleScale, "#fffbeb");

  ctx.restore();
}

/**
 * Classic cyber-wooden sweeping broom (GC Broom) matching the Boss Stage concept:
 * slender angled wooden handle, sky-blue brush collar, golden straw bristles,
 * and a long glowing cyan-white comet trail + star sparkles when sweeping!
 */
export function drawGcBroom(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  active: boolean,
  time: number,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Gorgeous long glowing cyan-white sweep comet trail when active!
  if (active) {
    const trailLen = 210 + Math.sin(time * 28) * 14;
    const trailGrad = ctx.createLinearGradient(-trailLen, 0, 8, 0);
    trailGrad.addColorStop(0, "rgba(56, 189, 248, 0)");
    trailGrad.addColorStop(0.35, "rgba(56, 189, 248, 0.35)");
    trailGrad.addColorStop(0.78, "rgba(103, 232, 249, 0.85)");
    trailGrad.addColorStop(1, "rgba(255, 255, 255, 0.98)");

    // Main tapering cyan sweep beam
    ctx.fillStyle = trailGrad;
    ctx.beginPath();
    ctx.moveTo(4, -6);
    ctx.quadraticCurveTo(-trailLen * 0.45, -14, -trailLen, -4);
    ctx.lineTo(-trailLen, 16);
    ctx.quadraticCurveTo(-trailLen * 0.45, 22, 6, 22);
    ctx.closePath();
    ctx.fill();

    // Bright white-cyan core streak
    const coreGrad = ctx.createLinearGradient(-trailLen * 0.72, 0, 6, 0);
    coreGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
    coreGrad.addColorStop(0.65, "rgba(224, 242, 254, 0.7)");
    coreGrad.addColorStop(1, "rgba(255, 255, 255, 1)");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(4, 2);
    ctx.lineTo(-trailLen * 0.72, 4);
    ctx.lineTo(-trailLen * 0.72, 13);
    ctx.lineTo(6, 17);
    ctx.closePath();
    ctx.fill();

    // Sparkling 4-point stars scattered along the cyan sweep trail
    const sparkleOffsets: Array<[number, number, number]> = [
      [-28, -10, 6],
      [-58, 12, 5],
      [-92, -6, 7],
      [-130, 8, 5.5],
      [-168, -2, 4.5],
      [-44, 20, 4],
    ];
    for (let i = 0; i < sparkleOffsets.length; i++) {
      const [ox, oy, sr] = sparkleOffsets[i];
      const shimmer = 0.65 + 0.45 * Math.sin(time * 18 + i * 1.9);
      const driftY = Math.sin(time * 12 + i) * 3;
      drawSparkle(ctx, ox, oy + driftY, sr * shimmer, i % 2 === 0 ? "#ffffff" : "#67e8f9");
    }

    // Crisp curved cyan whoosh arc right in front of the bristles
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(14, 12, 16, -0.45 * Math.PI, 0.35 * Math.PI);
    ctx.stroke();
  }

  // Soft shadow under broom
  drawEllipse(ctx, 2, 24, 16, 4.5, "rgba(7, 8, 22, 0.45)", 0, OUTLINE, 0);

  // Broom body: angled cleanly like the concept (handle up-left, brush bottom-right)
  ctx.save();
  const sweepTilt = active ? -0.38 + Math.sin(time * 26) * 0.05 : -0.32;
  ctx.rotate(sweepTilt);

  // Slender wooden handle
  drawRoundRect(ctx, -3, -34, 6, 38, 3, "#a8552a");
  ctx.fillStyle = "#d9824b";
  ctx.fillRect(-1.5, -32, 2, 34);

  // Sky-blue rounded brush cap/head
  drawRoundRect(ctx, -15, 2, 30, 10, 4, "#60a5fa");
  ctx.fillStyle = "#bae6fd";
  ctx.fillRect(-12, 3.5, 24, 2.5);
  // Subtle cute LED dots on brush head
  drawCircle(ctx, -5, 7.5, 1.4, "#0f172a", OUTLINE, 0);
  drawCircle(ctx, 5, 7.5, 1.4, "#0f172a", OUTLINE, 0);

  // Golden-straw bristles with crisp vertical grooves
  ctx.beginPath();
  ctx.moveTo(-14, 11);
  ctx.lineTo(-17, 23);
  ctx.quadraticCurveTo(0, 27, 17, 23);
  ctx.lineTo(14, 11);
  ctx.closePath();
  fillStrokePath(ctx, "#f6c453");
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 1.6;
  for (let i = -10; i <= 10; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i * 0.9, 12);
    ctx.lineTo(i * 1.1, 23.5);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

export function drawCoffeeCup(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  filled: boolean,
  time: number,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (filled) {
    // Rising curvy steam
    const s = Math.sin(time * 5) * 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-4, -13);
    ctx.quadraticCurveTo(-7 + s, -18, -3, -23);
    ctx.moveTo(4, -14);
    ctx.quadraticCurveTo(7 - s, -19, 3, -24);
    ctx.stroke();
    drawSparkle(ctx, -18, -6, 4.5, "#ffe14d");
    drawSparkle(ctx, 18, -12, 4, "#ffe14d");
  }

  // Handle
  ctx.strokeStyle = filled ? "#ffe14d" : "#475569";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(11, 2, 6.5, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Plump rounded mug body
  drawRoundRect(ctx, -12, -10, 24, 24, 7, filled ? "#fff7ed" : "#1e293b");
  drawEllipse(ctx, 0, -9, 10.5, 3.5, filled ? "#78350f" : "#0f172a", 0, OUTLINE, 1.5);

  if (filled) {
    // Golden lightning bolt emblem
    ctx.beginPath();
    ctx.moveTo(1, -3);
    ctx.lineTo(-4, 3);
    ctx.lineTo(0, 3);
    ctx.lineTo(-2, 10);
    ctx.lineTo(5, 1);
    ctx.lineTo(1, 1);
    ctx.closePath();
    fillStrokePath(ctx, "#f59e0b", "#78350f", 1);
  }

  ctx.restore();
}

export function drawProductionBase(
  ctx: CanvasRenderingContext2D,
  time: number,
): void {
  // Sleek Server Rack on far left
  drawRoundRect(ctx, 18, 175, 74, 182, 8, "#1e293b", OUTLINE, 2.5);
  drawRoundRect(ctx, 22, 180, 66, 8, 3, "#334155", OUTLINE, 0);
  for (let slot = 0; slot < 6; slot++) {
    const sy = 196 + slot * 25;
    drawRoundRect(ctx, 25, sy, 60, 17, 4, "#0f172a", "#334155", 1.2);
    for (let led = 0; led < 4; led++) {
      const blink = Math.floor(time * 3 + slot * 2 + led) % 3 !== 0;
      const color = led === 0 ? "#52f2b8" : led === 1 ? "#4dd8ff" : "#ffe14d";
      drawCircle(ctx, 33 + led * 9, sy + 8.5, 2.3, blink ? color : "#1e293b", OUTLINE, 0);
    }
    drawRoundRect(ctx, 70, sy + 6, 10, 5, 2, "#334155", OUTLINE, 0);
  }

  // Cozy Dev desk + monitor + steaming coffee cup
  drawRoundRect(ctx, 16, 372, 92, 14, 4, "#92400e");
  drawRoundRect(ctx, 22, 386, 9, 26, 3, "#78350f");
  drawRoundRect(ctx, 92, 386, 9, 26, 3, "#78350f");
  // Monitor
  drawRoundRect(ctx, 54, 334, 46, 32, 5, "#334155");
  drawRoundRect(ctx, 58, 338, 38, 24, 3, "#0f172a", OUTLINE, 0);
  ctx.fillStyle = "#52f2b8";
  ctx.fillRect(62, 343, 20, 3);
  ctx.fillStyle = "#4dd8ff";
  ctx.fillRect(62, 349, 28, 3);
  ctx.fillStyle = "#ffe14d";
  ctx.fillRect(62, 355, 16, 3);
  drawRoundRect(ctx, 73, 366, 8, 6, 2, "#64748b");
  // Mini coffee cup on desk
  drawCoffeeCup(ctx, 35, 362, true, time, 0.55);
}
