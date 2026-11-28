"use client";

import { useId } from "react";
import type { ArcadeGameSlug } from "@/lib/games/registry";

/**
 * Art-directed SVG scene illustrations for each mini-game zone in the braveActive Arcade Universe.
 * Replaces small generic icons with rich, tactile game-world scenes.
 */
export function GameZoneIllustration({
  slug,
  className = "arcade-zone-svg",
}: {
  slug: ArcadeGameSlug;
  className?: string;
}) {
  switch (slug) {
    case "dev-vs-ai":
      return <DevVsAiScene className={className} />;
    case "word-search":
      return <WordSearchScene className={className} />;
    case "chess":
      return <ChessScene className={className} />;
    case "xiangqi":
      return <XiangqiScene className={className} />;
    case "go":
      return <GoScene className={className} />;
  }
}

function DevVsAiScene({ className }: { className?: string }) {
  const uid = useId();
  return (
    <svg className={className} viewBox="0 0 420 200" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`dva-bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="0.52" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#311047" />
        </linearGradient>
        <linearGradient id={`dva-beam-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="1" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="420" height="200" rx="14" fill={`url(#dva-bg-${uid})`} />

      {/* Neural Grid Lanes */}
      <g stroke="#38bdf8" strokeOpacity="0.18" strokeWidth="1">
        <line x1="20" y1="54" x2="400" y2="54" />
        <line x1="20" y1="98" x2="400" y2="98" />
        <line x1="20" y1="142" x2="400" y2="142" />
        <line x1="20" y1="176" x2="400" y2="176" />
        <line x1="78" y1="36" x2="54" y2="184" />
        <line x1="148" y1="36" x2="136" y2="184" />
        <line x1="218" y1="36" x2="218" y2="184" />
        <line x1="288" y1="36" x2="300" y2="184" />
        <line x1="358" y1="36" x2="380" y2="184" />
      </g>

      {/* Top HUD Stars & Token Counter */}
      <g transform="translate(22 16)">
        <rect width="88" height="22" rx="11" fill="#0f172acc" stroke="#38bdf866" />
        <circle cx="14" cy="11" r="6" fill="#fbbf24" />
        <text x="26" y="15" fill="#f8fafc" fontSize="10.5" fontWeight="800" fontFamily="monospace">
          250 TKN
        </text>
      </g>
      <g transform="translate(332 16)" fill="#fbbf24">
        <polygon points="10,2 12.5,7.4 18.4,8 14,12 15.2,17.8 10,14.8 4.8,17.8 6,12 1.6,8 7.5,7.4" />
        <polygon transform="translate(22 0)" points="10,2 12.5,7.4 18.4,8 14,12 15.2,17.8 10,14.8 4.8,17.8 6,12 1.6,8 7.5,7.4" />
        <polygon transform="translate(44 0)" points="10,2 12.5,7.4 18.4,8 14,12 15.2,17.8 10,14.8 4.8,17.8 6,12 1.6,8 7.5,7.4" />
      </g>

      {/* Left Defender 1: Token-Flower Mecha */}
      <g transform="translate(48 56)">
        <ellipse cx="26" cy="48" rx="20" ry="6" fill="#0ea5e933" />
        <rect x="21" y="28" width="10" height="18" rx="4" fill="#10b981" />
        <circle cx="26" cy="20" r="16" fill="#fbbf24" stroke="#fef08a" strokeWidth="2.5" />
        <circle cx="26" cy="20" r="9" fill="#0f172a" />
        <circle cx="23" cy="18" r="2.2" fill="#38bdf8" />
        <circle cx="29" cy="18" r="2.2" fill="#38bdf8" />
      </g>

      {/* Left Defender 2: Code-Cannon Turret + Laser Beam */}
      <g transform="translate(96 98)">
        <ellipse cx="28" cy="52" rx="22" ry="7" fill="#22d3ee38" />
        <rect x="8" y="20" width="34" height="26" rx="8" fill="#0284c7" stroke="#7dd3fc" strokeWidth="2" />
        <rect x="36" y="26" width="18" height="12" rx="4" fill="#38bdf8" />
        <rect x="14" y="26" width="16" height="9" rx="3" fill="#0f172a" />
        <circle cx="20" cy="30.5" r="2.5" fill="#22d3ee" />
      </g>

      {/* Energy Pulse Projectiles */}
      <rect x="152" y="126" width="128" height="6" rx="3" fill={`url(#dva-beam-${uid})`} />
      <g transform="translate(184 118)">
        <circle cx="11" cy="11" r="9" fill="#22d3ee" fillOpacity="0.28" />
        <circle cx="11" cy="11" r="5" fill="#e0f2fe" />
      </g>
      <g transform="translate(232 118)">
        <circle cx="11" cy="11" r="9" fill="#22d3ee" fillOpacity="0.28" />
        <circle cx="11" cy="11" r="5" fill="#e0f2fe" />
      </g>

      {/* Floating Collectible Token */}
      <g transform="translate(174 56)">
        <circle cx="14" cy="14" r="12" fill="#f59e0b" stroke="#fde68a" strokeWidth="2" />
        <text x="14" y="18" textAnchor="middle" fill="#451a03" fontSize="11" fontWeight="900" fontFamily="monospace">
          {"{}"}
        </text>
      </g>

      {/* Enemy 1: Glitch Crawler */}
      <g transform="translate(262 60)">
        <ellipse cx="22" cy="44" rx="18" ry="5" fill="#ec489933" />
        <rect x="6" y="10" width="32" height="28" rx="7" fill="#6d28d9" stroke="#c084fc" strokeWidth="2" />
        <rect x="11" y="17" width="22" height="9" rx="3" fill="#1e1b4b" />
        <circle cx="17" cy="21.5" r="2.5" fill="#f43f5e" />
        <circle cx="27" cy="21.5" r="2.5" fill="#f43f5e" />
        <line x1="12" y1="38" x2="9" y2="45" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="32" y1="38" x2="35" y2="45" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Boss Rogue LLM Mecha on Right */}
      <g transform="translate(320 76)">
        <ellipse cx="38" cy="84" rx="34" ry="9" fill="#f43f5e3b" />
        <polygon points="38,4 70,22 70,62 38,80 6,62 6,22" fill="#3b0764" stroke="#f43f5e" strokeWidth="2.5" />
        <polygon points="38,14 60,27 60,55 38,68 16,55 16,27" fill="#1e1b4b" stroke="#a855f7" strokeWidth="1.5" />
        <circle cx="38" cy="41" r="13" fill="#f43f5e" />
        <circle cx="38" cy="41" r="6" fill="#fff1f2" />
        <rect x="14" y="-6" width="48" height="6" rx="3" fill="#1e293b" />
        <rect x="14" y="-6" width="36" height="6" rx="3" fill="#f43f5e" />
      </g>
    </svg>
  );
}

function WordSearchScene({ className }: { className?: string }) {
  const uid = useId();
  const rows = [
    ["B", "R", "A", "V", "E"],
    ["S", "C", "L", "U", "B"],
    ["P", "O", "T", "E", "N"],
    ["M", "I", "N", "I", "S"],
  ];
  const highlighted = new Set(["0-2", "1-2", "2-2", "3-2"]);
  return (
    <svg className={className} viewBox="0 0 360 186" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`ws-bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ecfdf5" />
          <stop offset="0.55" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#f0fdfa" />
        </linearGradient>
        <linearGradient id={`ws-pill-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>

      <rect width="360" height="186" rx="14" fill={`url(#ws-bg-${uid})`} />
      <circle cx="318" cy="34" r="52" fill="#14b8a6" fillOpacity="0.12" />
      <circle cx="40" cy="160" r="46" fill="#0284c7" fillOpacity="0.1" />

      {/* Letter Matrix Board */}
      <g transform="translate(24 22)">
        <rect width="204" height="144" rx="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* Highlight Capsule on Row 0 "B R A V E" */}
        <rect x="11" y="11" width="182" height="28" rx="9" fill={`url(#ws-pill-${uid})`} opacity="0.92" />
        {/* Highlight Capsule on Column 2 */}
        <rect x="86" y="45" width="32" height="88" rx="9" fill="#0ea5e9" fillOpacity="0.18" stroke="#0284c7" strokeWidth="1.5" />

        {rows.map((row, rIdx) =>
          row.map((letter, cIdx) => {
            const x = 14 + cIdx * 36;
            const y = 13 + rIdx * 32;
            const inBrave = rIdx === 0;
            const inVertical = highlighted.has(`${rIdx}-${cIdx}`) && rIdx > 0;
            return (
              <g key={`${rIdx}-${cIdx}`} transform={`translate(${x} ${y})`}>
                {!inBrave ? (
                  <rect
                    width="26"
                    height="24"
                    rx="6"
                    fill={inVertical ? "#e0f2fe" : "#f8fafc"}
                    stroke={inVertical ? "#0284c7" : "#e2e8f0"}
                  />
                ) : null}
                <text
                  x="13"
                  y="16.5"
                  textAnchor="middle"
                  fill={inBrave ? "#ffffff" : inVertical ? "#0369a1" : "#334155"}
                  fontSize="12.5"
                  fontWeight="800"
                  fontFamily="Manrope, system-ui, sans-serif"
                >
                  {letter}
                </text>
              </g>
            );
          }),
        )}
      </g>

      {/* AI Clue Card on Right */}
      <g transform="translate(240 34)">
        <rect width="98" height="118" rx="12" fill="#0f172a" />
        <rect x="10" y="12" width="46" height="14" rx="7" fill="#10b98133" />
        <text x="33" y="22" textAnchor="middle" fill="#34d399" fontSize="8.5" fontWeight="800">
          AI CLUE
        </text>
        <rect x="10" y="36" width="76" height="6" rx="3" fill="#475569" />
        <rect x="10" y="48" width="64" height="6" rx="3" fill="#475569" />
        <rect x="10" y="60" width="52" height="6" rx="3" fill="#334155" />
        <g transform="translate(10 82)">
          <rect width="78" height="24" rx="7" fill="#10b981" />
          <text x="39" y="15.5" textAnchor="middle" fill="#052e16" fontSize="9.5" fontWeight="900">
            ✓ BRAVE
          </text>
        </g>
      </g>
    </svg>
  );
}

function ChessScene({ className }: { className?: string }) {
  const uid = useId();
  return (
    <svg className={className} viewBox="0 0 360 186" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`ch-bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c2724" />
          <stop offset="0.6" stopColor="#263832" />
          <stop offset="1" stopColor="#111827" />
        </linearGradient>
        <linearGradient id={`ch-ivory-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="0.65" stopColor="#efe4cc" />
          <stop offset="1" stopColor="#cbb894" />
        </linearGradient>
        <linearGradient id={`ch-slate-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#64748b" />
          <stop offset="0.5" stopColor="#334155" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      <rect width="360" height="186" rx="14" fill={`url(#ch-bg-${uid})`} />

      {/* Perspective Tournament Board */}
      <g transform="translate(34 114)">
        <polygon points="24,0 268,0 296,54 -4,54" fill="#3f2e21" stroke="#fbbf2466" strokeWidth="1.5" />
        {[0, 1].map((r) =>
          [0, 1, 2, 3, 4].map((c) => {
            const topW = 48;
            const botW = 58;
            const y1 = r * 24 + 3;
            const y2 = (r + 1) * 24 + 3;
            const x1Left = 24 - r * 12 + c * (topW + r * 4);
            const x2Left = 24 - (r + 1) * 12 + c * (botW - (1 - r) * 4);
            const w1 = topW + r * 5;
            const w2 = topW + (r + 1) * 5;
            const isLight = (r + c) % 2 === 0;
            const isHighlight = r === 1 && c === 2;
            return (
              <polygon
                key={`${r}-${c}`}
                points={`${x1Left},${y1} ${x1Left + w1},${y1} ${x2Left + w2},${y2} ${x2Left},${y2}`}
                fill={isHighlight ? "#eab308" : isLight ? "#f2e8d5" : "#5a7d6f"}
              />
            );
          }),
        )}
      </g>

      {/* Golden Royal Check Aura */}
      <circle cx="178" cy="84" r="54" fill="#fbbf24" fillOpacity="0.12" />

      {/* White King (Center Left) */}
      <g transform="translate(116 30) scale(1.65)">
        <ellipse cx="32" cy="58" rx="18" ry="4.5" fill="#00000055" />
        <path
          d="M28 5h8v8h8v7h-8v6c1 5 4 9 8 13l4 10H16l4-10c4-4 7-8 8-13v-6h-8v-7h8zM12 51h40v6H12z"
          fill={`url(#ch-ivory-${uid})`}
          stroke="#1e293b"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M22 45h20" stroke="#b45309" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      {/* White Queen (Foreground Left) */}
      <g transform="translate(56 54) scale(1.32)">
        <ellipse cx="32" cy="58" rx="17" ry="4" fill="#00000044" />
        <path
          d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm20-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm20 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM15 17l7 17h20l7-17-10 8-7-14-7 14zM22 37c-2 5-5 9-9 14v5h38v-5c-4-5-7-9-9-14z"
          fill={`url(#ch-ivory-${uid})`}
          stroke="#1e293b"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* Black Knight (Facing Right) */}
      <g transform="translate(216 42) scale(1.5)">
        <ellipse cx="32" cy="58" rx="18" ry="4.5" fill="#00000066" />
        <path
          d="M14 52h38v6H12zM17 49c2-9 5-16 12-21l-5-8 3-10 9 8c9-1 15 5 15 14v17H17ZM31 19l-2 5 7 3 2-4z"
          fill={`url(#ch-slate-${uid})`}
          stroke="#e2e8f0"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

function XiangqiScene({ className }: { className?: string }) {
  const uid = useId();
  return (
    <svg className={className} viewBox="0 0 360 186" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`xq-wood-${uid}`} cx="50%" cy="45%" r="65%">
          <stop offset="0" stopColor="#fae8c0" />
          <stop offset="0.7" stopColor="#e5be75" />
          <stop offset="1" stopColor="#c79245" />
        </radialGradient>
        <radialGradient id={`xq-disc-${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fffef5" />
          <stop offset="0.6" stopColor="#f5deb0" />
          <stop offset="1" stopColor="#d4ab63" />
        </radialGradient>
      </defs>

      <rect width="360" height="186" rx="14" fill="#5c3217" />
      <rect x="8" y="8" width="344" height="170" rx="10" fill={`url(#xq-wood-${uid})`} stroke="#783f1c" strokeWidth="2" />

      {/* Palace Grid & River */}
      <g stroke="#78350f" strokeOpacity="0.55" strokeWidth="1.4" fill="none">
        <rect x="34" y="22" width="292" height="142" />
        <line x1="34" y1="74" x2="326" y2="74" />
        <line x1="34" y1="112" x2="326" y2="112" />
        {[92, 150, 210, 268].map((x) => (
          <g key={x}>
            <line x1={x} y1="22" x2={x} y2="74" />
            <line x1={x} y1="112" x2={x} y2="164" />
          </g>
        ))}
        {/* Diagonal Palace Lines */}
        <line x1="150" y1="22" x2="210" y2="74" />
        <line x1="210" y1="22" x2="150" y2="74" />
        <line x1="150" y1="112" x2="210" y2="164" />
        <line x1="210" y1="112" x2="150" y2="164" />
      </g>

      <text x="108" y="98" textAnchor="middle" fill="#78350f" fillOpacity="0.72" fontSize="16" fontWeight="800" fontFamily="serif">
        楚 河
      </text>
      <text x="252" y="98" textAnchor="middle" fill="#78350f" fillOpacity="0.72" fontSize="16" fontWeight="800" fontFamily="serif">
        漢 界
      </text>

      {/* Tactical Cannon Arc */}
      <path d="M92 138 Q 140 58 210 48" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="5 4" />

      {/* Red General 帥 */}
      <g transform="translate(180 138)">
        <circle cx="0" cy="4" r="26" fill="#451a0355" />
        <circle cx="0" cy="0" r="25" fill={`url(#xq-disc-${uid})`} stroke="#b91c1c" strokeWidth="2.6" />
        <circle cx="0" cy="0" r="20" fill="none" stroke="#b91c1c" strokeWidth="1.3" />
        <text x="0" y="8" textAnchor="middle" fill="#b91c1c" fontSize="22" fontWeight="900" fontFamily="serif">
          帥
        </text>
      </g>

      {/* Red Cannon 炮 */}
      <g transform="translate(92 136)">
        <circle cx="0" cy="3" r="22" fill="#451a0344" />
        <circle cx="0" cy="0" r="21" fill={`url(#xq-disc-${uid})`} stroke="#b91c1c" strokeWidth="2.4" />
        <circle cx="0" cy="0" r="16.5" fill="none" stroke="#b91c1c" strokeWidth="1.2" />
        <text x="0" y="7" textAnchor="middle" fill="#b91c1c" fontSize="18.5" fontWeight="900" fontFamily="serif">
          炮
        </text>
      </g>

      {/* Black General 將 */}
      <g transform="translate(210 48)">
        <circle cx="0" cy="4" r="24" fill="#451a0355" />
        <circle cx="0" cy="0" r="23" fill={`url(#xq-disc-${uid})`} stroke="#1e293b" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="18" fill="none" stroke="#1e293b" strokeWidth="1.2" />
        <text x="0" y="7.5" textAnchor="middle" fill="#0f172a" fontSize="20" fontWeight="900" fontFamily="serif">
          將
        </text>
      </g>

      {/* Black Chariot 車 */}
      <g transform="translate(274 74)">
        <circle cx="0" cy="3" r="20" fill="#451a0344" />
        <circle cx="0" cy="0" r="19.5" fill={`url(#xq-disc-${uid})`} stroke="#1e293b" strokeWidth="2.2" />
        <circle cx="0" cy="0" r="15" fill="none" stroke="#1e293b" strokeWidth="1.1" />
        <text x="0" y="6.5" textAnchor="middle" fill="#0f172a" fontSize="17" fontWeight="900" fontFamily="serif">
          車
        </text>
      </g>
    </svg>
  );
}

function GoScene({ className }: { className?: string }) {
  const uid = useId();
  const cols = [66, 112, 158, 204, 250, 296];
  const rows = [30, 68, 106, 144];
  const blackStones: [number, number][] = [
    [158, 68],
    [204, 106],
    [112, 106],
    [158, 144],
    [250, 68],
  ];
  const whiteStones: [number, number][] = [
    [158, 106],
    [204, 68],
    [250, 106],
    [204, 144],
  ];
  return (
    <svg className={className} viewBox="0 0 360 186" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`go-kaya-${uid}`} cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#f1d592" />
          <stop offset="0.7" stopColor="#dfb76c" />
          <stop offset="1" stopColor="#c89b4b" />
        </radialGradient>
        <radialGradient id={`go-black-${uid}`} cx="32%" cy="28%" r="70%">
          <stop offset="0" stopColor="#64748b" />
          <stop offset="0.35" stopColor="#1e293b" />
          <stop offset="1" stopColor="#020617" />
        </radialGradient>
        <radialGradient id={`go-white-${uid}`} cx="32%" cy="28%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.65" stopColor="#f8f5ec" />
          <stop offset="1" stopColor="#cbd5e1" />
        </radialGradient>
      </defs>

      <rect width="360" height="186" rx="14" fill="#785023" />
      <rect x="8" y="8" width="344" height="170" rx="10" fill={`url(#go-kaya-${uid})`} stroke="#855826" strokeWidth="2" />

      {/* Goban Intersections */}
      <g stroke="#5c3d18" strokeOpacity="0.68" strokeWidth="1.4">
        {cols.map((x) => (
          <line key={`c-${x}`} x1={x} y1="18" x2={x} y2="168" />
        ))}
        {rows.map((y) => (
          <line key={`r-${y}`} x1="42" y1={y} x2="320" y2={y} />
        ))}
      </g>

      {/* Hoshi Star Points */}
      <circle cx="112" cy="68" r="3.2" fill="#5c3d18" />
      <circle cx="250" cy="144" r="3.2" fill="#5c3d18" />

      {/* White Stones */}
      {whiteStones.map(([cx, cy]) => (
        <g key={`w-${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
          <circle cx="1" cy="3" r="16.5" fill="#45270944" />
          <circle cx="0" cy="0" r="16.5" fill={`url(#go-white-${uid})`} />
        </g>
      ))}

      {/* Black Stones */}
      {blackStones.map(([cx, cy], idx) => (
        <g key={`b-${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
          <circle cx="1" cy="3.5" r="16.8" fill="#1e130566" />
          <circle cx="0" cy="0" r="16.8" fill={`url(#go-black-${uid})`} />
          {idx === 1 ? (
            <circle cx="0" cy="0" r="6.5" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          ) : null}
        </g>
      ))}
    </svg>
  );
}
