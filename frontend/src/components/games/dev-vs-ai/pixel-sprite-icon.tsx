"use client";

import { useEffect, useRef } from "react";
import type { EnemyId, RobotId } from "@/lib/dev-vs-ai/core";
import {
  drawCoffeeCup,
  drawEnemySprite,
  drawGcBroom,
  drawRobotSprite,
  drawTokenCoin,
} from "@/lib/dev-vs-ai/sprites";

export type PixelSpriteIconKind =
  | { type: "robot"; id: RobotId }
  | { type: "enemy"; id: EnemyId }
  | { type: "token" }
  | { type: "broom"; active?: boolean }
  | { type: "coffee"; filled?: boolean };

export function PixelSpriteIcon({
  sprite,
  size = 48,
  animate = false,
  className,
}: {
  sprite: PixelSpriteIconKind;
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const time = animate ? (now - start) / 1000 : 0.4;
      ctx.clearRect(0, 0, 72, 72);
      ctx.imageSmoothingEnabled = true;

      if (sprite.type === "robot") {
        drawRobotSprite(ctx, sprite.id, 36, 40, { time, scale: 1.05 });
      } else if (sprite.type === "enemy") {
        drawEnemySprite(ctx, sprite.id, 36, 42, {
          time,
          hasArmor: sprite.id === "cone-bot" || sprite.id === "gpu-golem",
          scale: sprite.id === "six-finger-boss" ? 0.88 : 1.0,
        });
      } else if (sprite.type === "token") {
        drawTokenCoin(ctx, 36, 36, time, 1.55);
      } else if (sprite.type === "broom") {
        drawGcBroom(ctx, 36, 37, Boolean(sprite.active), time, 1.05);
      } else if (sprite.type === "coffee") {
        drawCoffeeCup(ctx, 36, 40, sprite.filled ?? true, time, 1.2);
      }

      if (animate) {
        rafId = requestAnimationFrame(draw);
      }
    };

    draw(start);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [sprite, animate]);

  return (
    <canvas
      ref={canvasRef}
      width={72}
      height={72}
      className={className}
      style={{
        width: size,
        height: size,
        display: "block",
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}
