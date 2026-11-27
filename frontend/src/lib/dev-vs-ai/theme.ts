import { GRID_COLS, GRID_ROWS, type WorldId } from "@/lib/dev-vs-ai/core";

/**
 * Logical 16:9 canvas dimensions (960x540 for crisp, rounded 16-bit sprites).
 */
export const CANVAS_W = 960;
export const CANVAS_H = 540;

/**
 * Battlefield grid layout inside the 960x540 canvas.
 * Leaves generous room at the top (122px) for the chunky Robot Card HUD
 * and on the left (204px) for the Production Server Base & angled GC Brooms.
 */
export const GRID_X = 204;
export const GRID_Y = 122;
export const TILE_W = 80;
export const TILE_H = 78;

export const GRID_W = GRID_COLS * TILE_W; // 720px (ends at x=924)
export const GRID_H = GRID_ROWS * TILE_H; // 390px (ends at y=512)

export interface WorldVisualTheme {
  bgTop: string;
  bgBottom: string;
  tileBg: string;
  tileAltBg: string;
  tileInactiveBg: string;
  tileBorder: string;
  circuitLine: string;
  pulseColor: string;
  accent: string;
}

export const WORLD_THEMES: Record<WorldId, WorldVisualTheme> = {
  localhost: {
    bgTop: "#131836",
    bgBottom: "#1b234d",
    tileBg: "#212b5c",
    tileAltBg: "#263269",
    tileInactiveBg: "#151a38",
    tileBorder: "#4558a6",
    circuitLine: "#3b82f6",
    pulseColor: "#52f2b8",
    accent: "#52f2b8",
  },
  staging: {
    bgTop: "#171436",
    bgBottom: "#241b52",
    tileBg: "#29225c",
    tileAltBg: "#31286b",
    tileInactiveBg: "#171436",
    tileBorder: "#5b4ca8",
    circuitLine: "#a855f7",
    pulseColor: "#4dd8ff",
    accent: "#b06cff",
  },
  production: {
    bgTop: "#160f2e",
    bgBottom: "#291447",
    tileBg: "#2b194d",
    tileAltBg: "#341e5c",
    tileInactiveBg: "#180f30",
    tileBorder: "#7a3ca8",
    circuitLine: "#ec4899",
    pulseColor: "#ff5ca8",
    accent: "#ff5ca8",
  },
  "on-call": {
    bgTop: "#151633",
    bgBottom: "#24224f",
    tileBg: "#272759",
    tileAltBg: "#2f2f69",
    tileInactiveBg: "#151633",
    tileBorder: "#6b5ca5",
    circuitLine: "#f59e0b",
    pulseColor: "#ffe14d",
    accent: "#ffe14d",
  },
};

export function gridToPixel(col: number, row: number): { x: number; y: number } {
  return {
    x: GRID_X + col * TILE_W,
    y: GRID_Y + row * TILE_H,
  };
}

export function pixelToGrid(px: number, py: number): { col: number; row: number } | null {
  const col = Math.floor((px - GRID_X) / TILE_W);
  const row = Math.floor((py - GRID_Y) / TILE_H);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}
