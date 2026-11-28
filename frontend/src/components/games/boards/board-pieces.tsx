"use client";

import { useId } from "react";
import type { useI18n } from "@/i18n/i18n-provider";
import type { MessageKey } from "@/i18n/messages/types";
import type { BoardGameApiType } from "@/lib/api/community";

const SIDE_MESSAGE_KEYS: Record<string, MessageKey> = {
  white: "community.games.board.sides.white",
  black: "community.games.board.sides.black",
  red: "community.games.board.sides.red",
  blue: "community.games.board.sides.blue",
  x: "community.games.caro.sides.x",
  o: "community.games.caro.sides.o",
  human: "community.games.board.sides.human",
  ai: "community.games.board.sides.ai",
};

const PIECE_MESSAGE_KEYS: Record<BoardGameApiType, Record<string, MessageKey>> = {
  chess: {
    K: "community.games.chess.pieces.K",
    Q: "community.games.chess.pieces.Q",
    R: "community.games.chess.pieces.R",
    B: "community.games.chess.pieces.B",
    N: "community.games.chess.pieces.N",
    P: "community.games.chess.pieces.P",
    k: "community.games.chess.pieces.k",
    q: "community.games.chess.pieces.q",
    r: "community.games.chess.pieces.r",
    b: "community.games.chess.pieces.b",
    n: "community.games.chess.pieces.n",
    p: "community.games.chess.pieces.p",
  },
  xiangqi: {
    K: "community.games.xiangqi.pieces.K",
    A: "community.games.xiangqi.pieces.A",
    E: "community.games.xiangqi.pieces.E",
    H: "community.games.xiangqi.pieces.H",
    R: "community.games.xiangqi.pieces.R",
    C: "community.games.xiangqi.pieces.C",
    P: "community.games.xiangqi.pieces.P",
    k: "community.games.xiangqi.pieces.k",
    a: "community.games.xiangqi.pieces.a",
    e: "community.games.xiangqi.pieces.e",
    h: "community.games.xiangqi.pieces.h",
    r: "community.games.xiangqi.pieces.r",
    c: "community.games.xiangqi.pieces.c",
    p: "community.games.xiangqi.pieces.p",
  },
  go: {
    B: "community.games.go.pieces.B",
    W: "community.games.go.pieces.W",
    b: "community.games.go.pieces.b",
    w: "community.games.go.pieces.w",
  },
  caro: {
    X: "community.games.caro.pieces.X",
    O: "community.games.caro.pieces.O",
  },
};

export function getTurnMessageKey(gameType: BoardGameApiType, turn: string): MessageKey {
  if (gameType === "go") {
    if (turn === "black") return "community.games.go.sides.black";
    if (turn === "white") return "community.games.go.sides.white";
  }
  if (gameType === "caro") {
    if (turn === "x") return "community.games.caro.sides.x";
    if (turn === "o") return "community.games.caro.sides.o";
  }
  return SIDE_MESSAGE_KEYS[turn] ?? "community.games.board.sides.human";
}

function isBoardCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 14;
}

export function getBoardMoveCoordinates(
  lastMove: Record<string, unknown> | null | undefined,
): { from: [number, number]; to: [number, number] } | null {
  const from = lastMove?.from;
  const to = lastMove?.to;
  if (!Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2) return null;
  const [fromRow, fromColumn] = from;
  const [toRow, toColumn] = to;
  if (![fromRow, fromColumn, toRow, toColumn].every(isBoardCoordinate)) return null;
  return {
    from: [fromRow, fromColumn],
    to: [toRow, toColumn],
  };
}

export function getGoMoveCoordinate(
  lastMove: Record<string, unknown> | null | undefined,
): [number, number] | null {
  const at = lastMove?.at;
  if (!Array.isArray(at) || at.length !== 2) return null;
  const [row, col] = at;
  if (!isBoardCoordinate(row) || !isBoardCoordinate(col)) return null;
  return [row, col];
}

export function isHumanSide(game: BoardGameApiType, piece: string): boolean {
  if (game === "go") return piece === "B";
  if (game === "caro") return piece === "X";
  return piece === piece.toUpperCase();
}

export function getCaroWinningSet(winningLine: unknown): Set<string> {
  const result = new Set<string>();
  if (!Array.isArray(winningLine)) return result;
  for (const item of winningLine) {
    if (Array.isArray(item) && item.length === 2 && isBoardCoordinate(item[0]) && isBoardCoordinate(item[1])) {
      result.add(`${item[0]}-${item[1]}`);
    }
  }
  return result;
}

export function describePiece(
  game: BoardGameApiType,
  piece: string,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (!piece || piece === ".") return t("community.games.board.emptyCell");
  return t(PIECE_MESSAGE_KEYS[game][piece] ?? "community.games.board.occupiedCell");
}

export function ChessPiece({ piece }: { piece: string }) {
  const uid = useId();
  const kind = piece.toLowerCase();
  const isWhite = piece === piece.toUpperCase();
  const outline = isWhite ? "#1f2937" : "#0b0f17";
  const detail = isWhite ? "#a17c42" : "#e5c989";
  const shape: Record<string, string> = {
    p: "M32 8a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM28 23h8c0 6 3 10 7 14l5 13H16l5-13c4-4 7-8 7-14ZM12 50h40v7H12z",
    r: "M14 9h9v8h6V9h7v8h6V9h9v15H46v20l6 7v6H12v-6l6-7V24h-4z",
    n: "M14 52h38v6H12zM17 49c2-9 5-16 12-21l-5-8 3-10 9 8c9-1 15 5 15 14v17H17ZM31 19l-2 5 7 3 2-4z",
    b: "M32 5 19 20l7 7-2 5c-2 6-5 11-10 17l-5 5v4h46v-4l-5-5c-5-6-8-11-10-17l-2-5 7-7z",
    q: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm20-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm20 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM15 17l7 17h20l7-17-10 8-7-14-7 14zM22 37c-2 5-5 9-9 14v5h38v-5c-4-5-7-9-9-14z",
    k: "M28 5h8v8h8v7h-8v6c1 5 4 9 8 13l4 10H16l4-10c4-4 7-8 8-13v-6h-8v-7h8zM12 51h40v6H12z",
  };
  const accents: Record<string, string> = {
    p: "M26 40h12M22 48h20",
    r: "M20 26h24M22 45h20",
    n: "M26 37c5-4 11-5 17-3M35 21l4 2",
    b: "M25 25 39 13M23 45h18",
    q: "M22 34h20M23 45h18",
    k: "M28 16h8M22 45h20",
  };

  if (!shape[kind]) return null;
  const bodyGradient = `cp-body-${uid}`;
  const sideGradient = `cp-side-${uid}`;
  const sheenGradient = `cp-sheen-${uid}`;
  const shadow = isWhite ? "#475569" : "#020617";
  return (
    <svg className="chess-piece-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={bodyGradient} x1="0" y1="0" x2="1" y2=".4">
          {isWhite ? (
            <>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset=".35" stopColor="#fbf8f0" />
              <stop offset=".75" stopColor="#e8dfc9" />
              <stop offset="1" stopColor="#cbbca0" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#64748b" />
              <stop offset=".3" stopColor="#334155" />
              <stop offset=".68" stopColor="#1e293b" />
              <stop offset="1" stopColor="#0b111c" />
            </>
          )}
        </linearGradient>
        <linearGradient id={sideGradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={isWhite ? "#fffcf5" : "#475569"} />
          <stop offset=".45" stopColor={isWhite ? "#dfd4bc" : "#1e293b"} />
          <stop offset="1" stopColor={isWhite ? "#a69474" : "#06090f"} />
        </linearGradient>
        <linearGradient id={sheenGradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={isWhite ? ".7" : ".32"} />
          <stop offset=".35" stopColor="#fff" stopOpacity=".08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={shape[kind]} transform="translate(0 3)" fill={shadow} stroke={shadow} strokeWidth="2.8" strokeLinejoin="round" opacity=".55" />
      <path d={shape[kind]} transform="translate(0 1.5)" fill={`url(#${sideGradient})`} stroke={outline} strokeWidth="2.3" strokeLinejoin="round" />
      <path d={shape[kind]} fill={`url(#${bodyGradient})`} stroke={outline} strokeWidth="2.1" strokeLinejoin="round" />
      <path d={shape[kind]} fill={`url(#${sheenGradient})`} opacity=".65" />
      <path d="M17 53h30M14 56h36" fill="none" stroke={isWhite ? "#ffffff" : "#94a3b8"} strokeWidth="1" opacity=".7" />
      {kind === "p" && (
        <>
          <circle cx="32" cy="15" r="4" fill="none" stroke={detail} strokeWidth="1.5" />
          <path d="M22 51h20" fill="none" stroke={detail} strokeWidth="1.5" />
        </>
      )}
      {kind === "b" && <path d="m35 13-6 10" fill="none" stroke={detail} strokeWidth="2.4" strokeLinecap="round" />}
      {kind === "q" && (
        <g fill={detail}>
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="32" cy="8" r="1.6" />
          <circle cx="52" cy="12" r="1.6" />
        </g>
      )}
      {kind === "k" && <path d="M32 7v9M28 11h8" fill="none" stroke={detail} strokeWidth="2" strokeLinecap="round" />}
      {kind !== "q" && kind !== "k" && (
        <path d={accents[kind]} fill="none" stroke={detail} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "q" && <path d={accents.q} fill="none" stroke={detail} strokeWidth="1.5" strokeLinecap="round" />}
      {kind === "k" && <path d={accents.k} fill="none" stroke={detail} strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  );
}

export function XiangqiPiece({ piece }: { piece: string }) {
  const symbols: Record<string, string> = {
    K: "帥",
    A: "仕",
    E: "相",
    H: "傌",
    R: "俥",
    C: "炮",
    P: "兵",
    k: "將",
    a: "士",
    e: "象",
    h: "馬",
    r: "車",
    c: "砲",
    p: "卒",
  };
  const symbol = symbols[piece];
  if (!symbol) return null;
  return (
    <span className="xiangqi-piece-art" aria-hidden="true">
      {symbol}
    </span>
  );
}

export function CaroMark({ piece }: { piece: string }) {
  if (piece === "X") {
    return (
      <svg className="caro-mark-art is-x" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <path d="M9 9 L27 27 M27 9 L9 27" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (piece === "O") {
    return (
      <svg className="caro-mark-art is-o" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <circle cx="18" cy="18" r="10.2" fill="none" stroke="currentColor" strokeWidth="4.1" />
      </svg>
    );
  }
  return null;
}

export function pieceSymbol(piece: string): string {
  return piece && piece !== "." ? "●" : "";
}
