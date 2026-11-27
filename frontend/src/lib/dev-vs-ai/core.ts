/**
 * Core data catalog, stage scripts, and deterministic simulation engine
 * for the "Dev vs AI" 2D pixel tower-defense game.
 *
 * Kept self-contained (zero runtime relative imports) so both Next.js
 * and Node.js native test runner (`node --test`) can import it directly.
 */

export const GRID_ROWS = 5;
export const GRID_COLS = 9;
export const TOKEN_COIN_VALUE = 25;
export const MAX_COFFEE_CUPS = 3;
export const COFFEE_CHARGE_PER_KILL = 16;
export const COFFEE_CHARGE_PER_BOSS_HIT = 1;
export const COFFEE_OVERCLOCK_DURATION = 5.0;
export const UNINSTALL_REFUND_RATIO = 0.25;

export type RobotId =
  | "token-flower"
  | "ping-blossom"
  | "firewall-pod"
  | "bug-trap"
  | "cooler-bot"
  | "dual-core"
  | "hotfix-core";

export type EnemyId =
  | "prompt-slime"
  | "cone-bot"
  | "gpu-golem"
  | "glitch-hopper"
  | "six-finger-boss"
  | "mini-prompt";

export type WorldId = "localhost" | "staging" | "production" | "on-call";

export type GameScreenMode = "menu" | "world-map" | "playing" | "robot-dex";

export interface RobotDefinition {
  id: RobotId;
  name: string;
  role: "economy" | "shooter" | "tank" | "trap" | "control" | "burst";
  cost: number;
  maxHp: number;
  damage: number;
  attackInterval: number; // seconds (0 for passive/instant)
  cooldown: number; // card cooldown seconds
  shotsPerAttack?: number;
  slowFactor?: number; // e.g. 0.4 means 40% slower
  slowDuration?: number;
  armingTime?: number; // Bug-Trap arming seconds
  blastRadius?: number; // 0 = single tile, 1 = 3x3
  tokenInterval?: number; // Token-Flower interval
  firstTokenDelay?: number;
  coffeeDescription: string;
  lore: string;
  accentColor: string;
}

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  baseHp: number;
  armorHp: number;
  speed: number; // columns per second (1.0 standard ≈ 1 col / 4.5s => 0.222 col/s)
  biteDps: number;
  canJumpFirstRobot?: boolean;
  spawnsMiniAtHalfHp?: boolean;
  scoreValue: number;
  lore: string;
  accentColor: string;
}

export interface WaveSpawnEvent {
  /** Seconds since stage start */
  time: number;
  enemyId: EnemyId;
  /** Optional fixed row (0..4); if omitted, chosen from stage activeRows */
  row?: number;
}

export interface StageDefinition {
  id: string;
  world: WorldId;
  code: string;
  name: string;
  subtitle: string;
  activeRows: number[];
  startingTokens: number;
  naturalTokenInterval: number;
  attentionNodeCount: number;
  attentionNodesShift?: boolean;
  coffeeEnabled: boolean;
  hasTrafficSpike?: boolean;
  trafficSpikeTime?: number;
  isBossStage?: boolean;
  isEndless?: boolean;
  unlocksRobot?: RobotId;
  unlocksNextStage?: string;
  featuredEnemies: EnemyId[];
  waveMarkers: number[]; // progress fractions (0..1) where wave banners appear
  spawns: WaveSpawnEvent[];
  rewardLabel?: string;
}

export interface RobotEntity {
  uid: number;
  id: RobotId;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  timer: number;
  armed: boolean;
  armTimer: number;
  overclockTimer: number;
  overclockShotsLeft: number;
  recoilTimer: number;
  hitFlashTimer: number;
  bobPhase: number;
}

export interface EnemyEntity {
  uid: number;
  id: EnemyId;
  row: number;
  x: number; // column units: 0..9 (starts around 9.2, triggers broom at < 0)
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  speed: number;
  biteDps: number;
  slowTimer: number;
  hitFlashTimer: number;
  hasJumped: boolean;
  jumpTimer: number;
  spawnedMini: boolean;
  bobPhase: number;
}

export interface ProjectileEntity {
  uid: number;
  row: number;
  x: number;
  speed: number; // columns per second
  damage: number;
  slowFactor: number;
  slowDuration: number;
  color: string;
  kind: "laser" | "ice" | "overclock";
}

export interface TokenEntity {
  uid: number;
  value: number;
  x: number; // column units 0..9
  y: number; // row units 0..5
  targetY: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  collected: boolean;
  collectProgress: number;
  startCollectX: number;
  startCollectY: number;
}

export interface BroomEntity {
  row: number;
  active: boolean;
  spent: boolean;
  x: number; // starts at -0.55, sweeps to 9.8
}

export interface AttentionNode {
  row: number;
  col: number;
}

export interface LockedTile {
  row: number;
  col: number;
  timer: number;
  warningTimer: number; // >0 means boss telegraphing lock
}

export interface BossEntity {
  active: boolean;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  attackTimer: number;
  summonTimer: number;
  hitFlashTimer: number;
  expression: "smug" | "casting" | "hurt" | "panic";
  expressionTimer: number;
  spawnedPhase3Guard: boolean;
}

export interface ParticleEntity {
  x: number; // column units
  y: number; // row units
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingTextEntity {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface SoundCue {
  kind:
    | "token"
    | "place"
    | "uninstall"
    | "shoot"
    | "ice"
    | "hit"
    | "explosion"
    | "broom"
    | "coffee"
    | "wave"
    | "victory"
    | "defeat"
    | "boss-lock";
}

export interface GameState {
  stage: StageDefinition;
  elapsed: number;
  tokens: number;
  tokensCollected: number;
  enemiesPatched: number;
  coffeeCups: number;
  coffeeCharge: number; // 0..100 fills 1 cup
  cardCooldowns: Record<RobotId, number>;
  robots: RobotEntity[];
  enemies: EnemyEntity[];
  projectiles: ProjectileEntity[];
  tokenCoins: TokenEntity[];
  brooms: BroomEntity[];
  attentionNodes: AttentionNode[];
  attentionShiftTimer: number;
  lockedTiles: LockedTile[];
  boss: BossEntity | null;
  particles: ParticleEntity[];
  floatingTexts: FloatingTextEntity[];
  pendingSpawns: WaveSpawnEvent[];
  totalSpawns: number;
  naturalTokenTimer: number;
  bannerText: string | null;
  bannerTimer: number;
  triggeredWaveMarkers: number[];
  trafficSpikeTriggered: boolean;
  screenShakeTimer: number;
  screenShakeIntensity: number;
  endlessWave: number;
  endlessNextWaveTimer: number;
  status: "playing" | "victory" | "defeat";
  starsEarned: number;
  nextUid: number;
  rngState: number;
  soundQueue: SoundCue[];
}

export const BASE_COL_SPEED = 1 / 4.5; // 1 tile in 4.5s

export const ROBOT_ORDER: RobotId[] = [
  "token-flower",
  "ping-blossom",
  "firewall-pod",
  "bug-trap",
  "cooler-bot",
  "dual-core",
  "hotfix-core",
];

export const ENEMY_ORDER: EnemyId[] = [
  "prompt-slime",
  "cone-bot",
  "gpu-golem",
  "glitch-hopper",
  "six-finger-boss",
  "mini-prompt",
];

export const ROBOT_CATALOG: Record<RobotId, RobotDefinition> = {
  "token-flower": {
    id: "token-flower",
    name: "Token-Flower",
    role: "economy",
    cost: 50,
    maxHp: 300,
    damage: 0,
    attackInterval: 0,
    cooldown: 7,
    tokenInterval: 20,
    firstTokenDelay: 7.5,
    coffeeDescription: "Nở rộ và thả ngay 5 đồng TOKEN (125 Token).",
    lore: "Bông hoa pin mặt trời cơ khí chuyên đào Free Tier Token nuôi cả đội hình.",
    accentColor: "#FFE14D",
  },
  "ping-blossom": {
    id: "ping-blossom",
    name: "Ping-Blossom",
    role: "shooter",
    cost: 100,
    maxHp: 300,
    damage: 25,
    attackInterval: 1.5,
    cooldown: 7,
    shotsPerAttack: 1,
    coffeeDescription: "Xả liên thanh 18 tia laser pixel siêu tốc dọc hàng.",
    lore: "Bắn gói tin 0/1 chuẩn 60 FPS. Không bao giờ rớt ping!",
    accentColor: "#52F2B8",
  },
  "firewall-pod": {
    id: "firewall-pod",
    name: "Firewall-Pod",
    role: "tank",
    cost: 50,
    maxHp: 3000,
    damage: 0,
    attackInterval: 0,
    cooldown: 22,
    coffeeDescription: "Hồi đầy máu và bọc thêm giáp Titanium (+2000 HP).",
    lore: "Chặn mọi request xấu bằng nụ cười LED lạc quan cho đến tận giọt pin cuối.",
    accentColor: "#4DD8FF",
  },
  "bug-trap": {
    id: "bug-trap",
    name: "Bug-Trap",
    role: "trap",
    cost: 25,
    maxHp: 300,
    damage: 1800,
    attackInterval: 0,
    cooldown: 22,
    armingTime: 11,
    blastRadius: 0,
    coffeeDescription: "Nạp xong tức thì và nhân bản thêm 2 bẫy sang ô trống.",
    lore: "Hạt mầm gài bẫy dưới node mạng — quái AI giẫm lên là bay màu ngay lập tức.",
    accentColor: "#FF6B81",
  },
  "cooler-bot": {
    id: "cooler-bot",
    name: "Cooler-Bot",
    role: "control",
    cost: 175,
    maxHp: 300,
    damage: 34,
    attackInterval: 1.45,
    cooldown: 7,
    shotsPerAttack: 1,
    slowFactor: 0.4,
    slowDuration: 4.2,
    coffeeDescription: "Đóng băng toàn bộ quái AI trên hàng trong 4.5 giây + 160 DMG (429!).",
    lore: "Quạt tản nhiệt băng vừa sát thương khá vừa hạ nhiệt mấy con AI chạy quá tốc độ.",
    accentColor: "#63E6FF",
  },
  "dual-core": {
    id: "dual-core",
    name: "Dual-Core",
    role: "shooter",
    cost: 200,
    maxHp: 300,
    damage: 40,
    attackInterval: 1.4,
    cooldown: 8,
    shotsPerAttack: 2,
    coffeeDescription: "Bắn liên hoàn 24 viên đạn đa luồng siêu mạnh dồn sát thương Boss!",
    lore: "Xử lý song song 2 luồng đạn 40×2 (80 DMG/loạt), khắc tinh của GPU Golem & Boss.",
    accentColor: "#70FFB8",
  },
  "hotfix-core": {
    id: "hotfix-core",
    name: "Hotfix-Core",
    role: "burst",
    cost: 150,
    maxHp: 300,
    damage: 2000,
    attackInterval: 0,
    cooldown: 32,
    blastRadius: 1,
    coffeeDescription: "Phát nổ diện rộng 3×3 ngay lập tức (2000 DMG, 1400 DMG lên Boss)!",
    lore: "Bản vá nóng cuối giờ chiều — nổ một phát 3×3 là hết ngay cảnh báo đỏ.",
    accentColor: "#FF8A3D",
  },
};

export const ENEMY_CATALOG: Record<EnemyId, EnemyDefinition> = {
  "prompt-slime": {
    id: "prompt-slime",
    name: "Prompt Slime",
    baseHp: 200,
    armorHp: 0,
    speed: 1.0 * BASE_COL_SPEED,
    biteDps: 40,
    scoreValue: 10,
    lore: "Bong bóng chat hồng ngơ ngác, đi lạch bạch nhưng đông lên cũng mệt đấy.",
    accentColor: "#FF5CA8",
  },
  "cone-bot": {
    id: "cone-bot",
    name: "Warning-Cone Bot",
    baseHp: 200,
    armorHp: 360,
    speed: 1.0 * BASE_COL_SPEED,
    biteDps: 40,
    scoreValue: 20,
    lore: "Đội chóp cảnh báo lỗi trên đầu để chống đạn, vỡ chóp là mất tự tin ngay.",
    accentColor: "#FF9F1C",
  },
  "gpu-golem": {
    id: "gpu-golem",
    name: "GPU-Bucket Golem",
    baseHp: 200,
    armorHp: 1100,
    speed: 0.88 * BASE_COL_SPEED,
    biteDps: 48,
    scoreValue: 40,
    lore: "Đội nguyên thùng GPU tản nhiệt trên đầu, đi chậm nhưng giáp cực dày.",
    accentColor: "#94A3B8",
  },
  "glitch-hopper": {
    id: "glitch-hopper",
    name: "Glitch Hopper",
    baseHp: 340,
    armorHp: 0,
    speed: 1.55 * BASE_COL_SPEED,
    biteDps: 45,
    canJumpFirstRobot: true,
    scoreValue: 30,
    lore: "Quái nhỏ tinh nghịch có thể glitch-nhảy qua Robot phòng thủ đầu tiên gặp phải.",
    accentColor: "#F43F9E",
  },
  "six-finger-boss": {
    id: "six-finger-boss",
    name: "6-Finger Mini-Boss",
    baseHp: 2400,
    armorHp: 0,
    speed: 0.68 * BASE_COL_SPEED,
    biteDps: 180,
    spawnsMiniAtHalfHp: true,
    scoreValue: 100,
    lore: "Gấu máy khổng lồ bị AI vẽ dư thành 6 ngón; mất nửa máu sẽ thả Mini-Prompt.",
    accentColor: "#B06CFF",
  },
  "mini-prompt": {
    id: "mini-prompt",
    name: "Mini-Prompt",
    baseHp: 100,
    armorHp: 0,
    speed: 1.5 * BASE_COL_SPEED,
    biteDps: 38,
    scoreValue: 10,
    lore: "Prompt tí hon chạy cực nhanh do 6-Finger Mini-Boss tung ra.",
    accentColor: "#FF85C0",
  },
};

export const INITIAL_UNLOCKED_ROBOTS: RobotId[] = ["token-flower", "ping-blossom"];

function buildLinearSpawns(
  entries: Array<[number, EnemyId, number?]>,
): WaveSpawnEvent[] {
  return entries
    .map(([time, enemyId, row]) => ({ time, enemyId, row }))
    .sort((a, b) => a.time - b.time);
}

export const STAGES: StageDefinition[] = [
  // ---------- WORLD 1: LOCALHOST ----------
  {
    id: "1-1",
    world: "localhost",
    code: "1-1",
    name: "Hello World",
    subtitle: "Làm quen với Mạng lưới LLM, đồng TOKEN và Ping-Blossom.",
    activeRows: [1, 2, 3],
    startingTokens: 100,
    naturalTokenInterval: 7.5,
    attentionNodeCount: 0,
    coffeeEnabled: false,
    unlocksRobot: "firewall-pod",
    unlocksNextStage: "1-2",
    featuredEnemies: ["prompt-slime"],
    waveMarkers: [0.55, 0.92],
    spawns: buildLinearSpawns([
      [20, "prompt-slime", 2],
      [38, "prompt-slime", 1],
      [54, "prompt-slime", 3],
      [68, "prompt-slime", 2],
      [76, "prompt-slime", 1],
      [86, "prompt-slime", 3],
      [94, "prompt-slime", 1],
      [97, "prompt-slime", 2],
      [100, "prompt-slime", 3],
    ]),
  },
  {
    id: "1-2",
    world: "localhost",
    code: "1-2",
    name: "First Pull Request",
    subtitle: "Mở đủ 5 hàng và làm quen với Warning-Cone Bot.",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 100,
    naturalTokenInterval: 8.5,
    attentionNodeCount: 0,
    coffeeEnabled: false,
    unlocksRobot: "bug-trap",
    unlocksNextStage: "1-3",
    featuredEnemies: ["prompt-slime", "cone-bot"],
    waveMarkers: [0.5, 0.9],
    spawns: buildLinearSpawns([
      [19, "prompt-slime", 2],
      [35, "prompt-slime", 0],
      [49, "prompt-slime", 4],
      [60, "cone-bot", 2],
      [70, "prompt-slime", 1],
      [78, "prompt-slime", 3],
      [88, "cone-bot", 1],
      [96, "prompt-slime", 4],
      [102, "prompt-slime", 0],
      [110, "cone-bot", 3],
      [113, "prompt-slime", 2],
      [116, "prompt-slime", 1],
      [119, "cone-bot", 0],
    ]),
  },
  {
    id: "1-3",
    world: "localhost",
    code: "1-3",
    name: "Merge Conflict",
    subtitle: "Vượt qua sóng cuối Localhost để mở khóa Cooler-Bot!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 100,
    naturalTokenInterval: 8.5,
    attentionNodeCount: 0,
    coffeeEnabled: false,
    unlocksRobot: "cooler-bot",
    unlocksNextStage: "2-1",
    featuredEnemies: ["prompt-slime", "cone-bot"],
    waveMarkers: [0.38, 0.72, 0.93],
    spawns: buildLinearSpawns([
      [18, "prompt-slime", 1],
      [33, "prompt-slime", 3],
      [46, "cone-bot", 2],
      [56, "prompt-slime", 0],
      [62, "prompt-slime", 4],
      [70, "cone-bot", 1],
      [78, "prompt-slime", 2],
      [86, "cone-bot", 3],
      [94, "prompt-slime", 0],
      [100, "cone-bot", 4],
      [106, "prompt-slime", 1],
      [112, "cone-bot", 2],
      [120, "cone-bot", 0],
      [122, "prompt-slime", 0],
      [125, "cone-bot", 3],
      [127, "prompt-slime", 3],
      [130, "prompt-slime", 2],
      [133, "cone-bot", 4],
    ]),
  },

  // ---------- WORLD 2: STAGING / QA ----------
  {
    id: "2-1",
    world: "staging",
    code: "2-1",
    name: "Rate Limit Test",
    subtitle: "Xuất hiện Attention Node (+25% tốc độ), Coffee Boost & Glitch Hopper!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 100,
    naturalTokenInterval: 9,
    attentionNodeCount: 2,
    coffeeEnabled: true,
    unlocksNextStage: "2-2",
    featuredEnemies: ["prompt-slime", "cone-bot", "glitch-hopper"],
    waveMarkers: [0.45, 0.9],
    spawns: buildLinearSpawns([
      [18, "prompt-slime", 2],
      [32, "prompt-slime", 0],
      [44, "cone-bot", 3],
      [54, "glitch-hopper", 2],
      [64, "prompt-slime", 1],
      [72, "cone-bot", 4],
      [80, "glitch-hopper", 1],
      [88, "prompt-slime", 3],
      [96, "cone-bot", 0],
      [104, "glitch-hopper", 4],
      [110, "cone-bot", 2],
      [113, "glitch-hopper", 0],
      [116, "prompt-slime", 1],
      [119, "cone-bot", 3],
      [122, "glitch-hopper", 2],
    ]),
  },
  {
    id: "2-2",
    world: "staging",
    code: "2-2",
    name: "GPU Stress Test",
    subtitle: "GPU-Bucket Golem giáp dày xuất kích — tận dụng Bug-Trap & Coffee Boost!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 75,
    naturalTokenInterval: 10,
    attentionNodeCount: 2,
    coffeeEnabled: true,
    unlocksRobot: "dual-core",
    unlocksNextStage: "2-3",
    featuredEnemies: ["prompt-slime", "cone-bot", "glitch-hopper", "gpu-golem"],
    waveMarkers: [0.38, 0.72, 0.92],
    spawns: buildLinearSpawns([
      [9, "prompt-slime", 1],
      [19, "cone-bot", 3],
      [29, "prompt-slime", 0],
      [38, "glitch-hopper", 2],
      [46, "gpu-golem", 2],
      [54, "prompt-slime", 4],
      [62, "cone-bot", 1],
      [70, "glitch-hopper", 3],
      [78, "gpu-golem", 0],
      [84, "cone-bot", 4],
      [92, "prompt-slime", 2],
      [98, "gpu-golem", 3],
      [100, "glitch-hopper", 1],
      [102, "cone-bot", 0],
      [105, "prompt-slime", 4],
      [108, "gpu-golem", 2],
    ]),
  },
  {
    id: "2-3",
    world: "staging",
    code: "2-3",
    name: "Cache Miss",
    subtitle: "Token rơi chậm hơn — đặt Token-Flower lên ô Attention Node!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 75,
    naturalTokenInterval: 14,
    attentionNodeCount: 2,
    coffeeEnabled: true,
    unlocksRobot: "hotfix-core",
    unlocksNextStage: "2-4",
    featuredEnemies: ["prompt-slime", "cone-bot", "glitch-hopper", "gpu-golem"],
    waveMarkers: [0.35, 0.68, 0.92],
    spawns: buildLinearSpawns([
      [10, "prompt-slime", 2],
      [22, "cone-bot", 0],
      [32, "prompt-slime", 4],
      [40, "glitch-hopper", 1],
      [48, "cone-bot", 3],
      [56, "gpu-golem", 1],
      [64, "prompt-slime", 2],
      [72, "glitch-hopper", 4],
      [80, "gpu-golem", 3],
      [88, "cone-bot", 0],
      [96, "glitch-hopper", 2],
      [102, "gpu-golem", 4],
      [106, "cone-bot", 1],
      [110, "gpu-golem", 2],
      [112, "glitch-hopper", 0],
      [114, "prompt-slime", 3],
    ]),
  },
  {
    id: "2-4",
    world: "staging",
    code: "2-4",
    name: "Staging Sign-Off",
    subtitle: "Attention Node dịch chuyển giữa trận — bài kiểm tra tổng hợp Staging!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 100,
    naturalTokenInterval: 10,
    attentionNodeCount: 3,
    attentionNodesShift: true,
    coffeeEnabled: true,
    unlocksNextStage: "3-1",
    featuredEnemies: ["prompt-slime", "cone-bot", "glitch-hopper", "gpu-golem"],
    waveMarkers: [0.35, 0.68, 0.91],
    spawns: buildLinearSpawns([
      [8, "prompt-slime", 0],
      [16, "cone-bot", 2],
      [25, "glitch-hopper", 4],
      [34, "cone-bot", 1],
      [42, "gpu-golem", 3],
      [50, "glitch-hopper", 0],
      [58, "cone-bot", 2],
      [66, "gpu-golem", 1],
      [72, "prompt-slime", 4],
      [80, "glitch-hopper", 3],
      [86, "gpu-golem", 0],
      [92, "cone-bot", 4],
      [100, "gpu-golem", 2],
      [104, "glitch-hopper", 1],
      [108, "glitch-hopper", 3],
      [112, "gpu-golem", 4],
      [115, "cone-bot", 0],
      [118, "glitch-hopper", 2],
    ]),
  },

  // ---------- WORLD 3: PRODUCTION ----------
  {
    id: "3-1",
    world: "production",
    code: "3-1",
    name: "Friday Deploy",
    subtitle: "Cẩn thận Traffic Spike giữa trận — bầy Prompt Slime tràn khắp 5 hàng!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 100,
    naturalTokenInterval: 10,
    attentionNodeCount: 2,
    coffeeEnabled: true,
    hasTrafficSpike: true,
    trafficSpikeTime: 58,
    unlocksNextStage: "3-2",
    featuredEnemies: ["prompt-slime", "cone-bot", "glitch-hopper", "gpu-golem"],
    waveMarkers: [0.42, 0.72, 0.92],
    spawns: buildLinearSpawns([
      [8, "prompt-slime", 2],
      [16, "cone-bot", 1],
      [24, "glitch-hopper", 3],
      [32, "gpu-golem", 0],
      [42, "cone-bot", 4],
      [50, "glitch-hopper", 2],
      // Traffic spike around 58s!
      [59, "prompt-slime", 0],
      [60, "prompt-slime", 1],
      [61, "prompt-slime", 2],
      [62, "prompt-slime", 3],
      [63, "prompt-slime", 4],
      [65, "cone-bot", 1],
      [66, "cone-bot", 3],
      [76, "gpu-golem", 2],
      [84, "glitch-hopper", 0],
      [90, "gpu-golem", 4],
      [98, "gpu-golem", 1],
      [100, "glitch-hopper", 3],
      [103, "cone-bot", 2],
      [106, "gpu-golem", 0],
    ]),
  },
  {
    id: "3-2",
    world: "production",
    code: "3-2",
    name: "Hallucination Surge",
    subtitle: "6-Finger Mini-Boss xuất hiện — giữ Hotfix-Core để hạ gọn!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 100,
    naturalTokenInterval: 10,
    attentionNodeCount: 2,
    coffeeEnabled: true,
    unlocksNextStage: "3-3",
    featuredEnemies: ["cone-bot", "glitch-hopper", "gpu-golem", "six-finger-boss"],
    waveMarkers: [0.35, 0.68, 0.92],
    spawns: buildLinearSpawns([
      [8, "prompt-slime", 1],
      [16, "cone-bot", 3],
      [26, "glitch-hopper", 0],
      [36, "gpu-golem", 2],
      [46, "cone-bot", 4],
      [56, "six-finger-boss", 2],
      [66, "glitch-hopper", 1],
      [74, "gpu-golem", 3],
      [82, "cone-bot", 0],
      [92, "gpu-golem", 4],
      [100, "six-finger-boss", 1],
      [104, "glitch-hopper", 3],
      [108, "cone-bot", 2],
      [112, "gpu-golem", 0],
    ]),
  },
  {
    id: "3-3",
    world: "production",
    code: "3-3",
    name: "Zero Downtime",
    subtitle: "Thử thách cuối cùng trước Boss: Traffic Spike + 2 Mini-Boss!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 125,
    naturalTokenInterval: 9.5,
    attentionNodeCount: 3,
    attentionNodesShift: true,
    coffeeEnabled: true,
    hasTrafficSpike: true,
    trafficSpikeTime: 62,
    unlocksNextStage: "3-4",
    featuredEnemies: ["cone-bot", "glitch-hopper", "gpu-golem", "six-finger-boss"],
    waveMarkers: [0.3, 0.58, 0.88],
    spawns: buildLinearSpawns([
      [7, "cone-bot", 2],
      [15, "glitch-hopper", 0],
      [23, "cone-bot", 4],
      [31, "gpu-golem", 1],
      [40, "glitch-hopper", 3],
      [48, "six-finger-boss", 2],
      // Traffic spike
      [63, "prompt-slime", 0],
      [64, "prompt-slime", 1],
      [65, "prompt-slime", 2],
      [66, "prompt-slime", 3],
      [67, "prompt-slime", 4],
      [74, "gpu-golem", 0],
      [82, "gpu-golem", 4],
      [90, "glitch-hopper", 2],
      [98, "six-finger-boss", 1],
      [104, "six-finger-boss", 3],
      [108, "gpu-golem", 2],
      [112, "glitch-hopper", 0],
      [115, "glitch-hopper", 4],
    ]),
  },
  {
    id: "3-4",
    world: "production",
    code: "3-4",
    name: "BOSS: ROGUE LLM",
    subtitle: "Hạ gục Rogue LLM (6,500 HP) qua 3 Phase để bảo vệ Production!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 175,
    naturalTokenInterval: 8.0,
    attentionNodeCount: 2,
    attentionNodesShift: true,
    coffeeEnabled: true,
    isBossStage: true,
    featuredEnemies: ["prompt-slime", "cone-bot", "glitch-hopper", "gpu-golem", "six-finger-boss"],
    waveMarkers: [],
    spawns: buildLinearSpawns([
      [6, "prompt-slime", 2],
      [14, "cone-bot", 1],
      [22, "prompt-slime", 3],
    ]),
    rewardLabel: "Production Master Trophy",
  },

  // ---------- BONUS: 24/7 ON-CALL (ENDLESS) ----------
  {
    id: "on-call",
    world: "on-call",
    code: "∞",
    name: "24/7 On-Call",
    subtitle: "Chế độ vô tận — giữ Uptime cao nhất qua các đợt quái tăng dần!",
    activeRows: [0, 1, 2, 3, 4],
    startingTokens: 125,
    naturalTokenInterval: 9.5,
    attentionNodeCount: 3,
    attentionNodesShift: true,
    coffeeEnabled: true,
    isEndless: true,
    featuredEnemies: ["prompt-slime", "cone-bot", "glitch-hopper", "gpu-golem", "six-finger-boss"],
    waveMarkers: [],
    spawns: [],
  },
];

export function getStageById(stageId: string): StageDefinition {
  return STAGES.find((stage) => stage.id === stageId) ?? STAGES[0];
}

function nextRandom(state: GameState): number {
  // Deterministic LCG for reproducible tests and smooth runtime randomness
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return state.rngState / 0x100000000;
}

function pickAttentionNodes(state: GameState, count: number): AttentionNode[] {
  if (count <= 0) return [];
  const candidates: AttentionNode[] = [];
  for (const row of state.stage.activeRows) {
    for (let col = 1; col <= 6; col++) {
      candidates.push({ row, col });
    }
  }
  const picked: AttentionNode[] = [];
  while (picked.length < count && candidates.length > 0) {
    const idx = Math.floor(nextRandom(state) * candidates.length);
    picked.push(candidates.splice(idx, 1)[0]);
  }
  return picked;
}

export function generateEndlessWaveSpawns(
  wave: number,
  startTime: number,
  activeRows: number[],
  rng: () => number,
): WaveSpawnEvent[] {
  const budget = Math.round(6 + wave * 3.5);
  const pool: Array<{ id: EnemyId; weight: number }> = [
    { id: "prompt-slime", weight: 1 },
    { id: "cone-bot", weight: 2 },
  ];
  if (wave >= 2) pool.push({ id: "glitch-hopper", weight: 3 });
  if (wave >= 3) pool.push({ id: "gpu-golem", weight: 4 });
  if (wave >= 5 && wave % 2 === 1) pool.push({ id: "six-finger-boss", weight: 8 });

  const events: WaveSpawnEvent[] = [];
  let remaining = budget;
  let offset = 0;

  while (remaining > 0) {
    const affordable = pool.filter((item) => item.weight <= remaining);
    const pick = affordable[Math.floor(rng() * affordable.length)] ?? pool[0];
    const row = activeRows[Math.floor(rng() * activeRows.length)];
    events.push({ time: startTime + offset, enemyId: pick.id, row });
    remaining -= pick.weight;
    offset += Math.max(0.85, 2.4 - wave * 0.12) * (0.7 + rng() * 0.6);
  }
  return events;
}

export function createGameState(stageId: string, seed = 1337): GameState {
  const stage = getStageById(stageId);
  const cardCooldowns: Record<RobotId, number> = {
    "token-flower": 0,
    "ping-blossom": 0,
    "firewall-pod": 0,
    "bug-trap": 0,
    "cooler-bot": 0,
    "dual-core": 0,
    "hotfix-core": 0,
  };

  const state: GameState = {
    stage,
    elapsed: 0,
    tokens: stage.startingTokens,
    tokensCollected: 0,
    enemiesPatched: 0,
    coffeeCups: stage.coffeeEnabled ? 1 : 0,
    coffeeCharge: 0,
    cardCooldowns,
    robots: [],
    enemies: [],
    projectiles: [],
    tokenCoins: [],
    brooms: Array.from({ length: GRID_ROWS }, (_, row) => ({
      row,
      active: false,
      spent: !stage.activeRows.includes(row),
      x: -0.55,
    })),
    attentionNodes: [],
    attentionShiftTimer: 32,
    lockedTiles: [],
    boss: stage.isBossStage
      ? {
          active: true,
          hp: 6500,
          maxHp: 6500,
          phase: 1,
          attackTimer: 12,
          summonTimer: 10,
          hitFlashTimer: 0,
          expression: "smug",
          expressionTimer: 0,
          spawnedPhase3Guard: false,
        }
      : null,
    particles: [],
    floatingTexts: [],
    pendingSpawns: stage.spawns.map((s) => ({ ...s })),
    totalSpawns: stage.spawns.length,
    naturalTokenTimer: 3.0,
    bannerText: stage.isBossStage
      ? "⚠️ ROGUE LLM DETECTED IN PRODUCTION!"
      : `${stage.code}: ${stage.name.toUpperCase()}`,
    bannerTimer: 2.8,
    triggeredWaveMarkers: [],
    trafficSpikeTriggered: false,
    screenShakeTimer: 0,
    screenShakeIntensity: 0,
    endlessWave: stage.isEndless ? 1 : 0,
    endlessNextWaveTimer: 6,
    status: "playing",
    starsEarned: 0,
    nextUid: 1,
    rngState: seed >>> 0,
    soundQueue: [],
  };

  state.attentionNodes = pickAttentionNodes(state, stage.attentionNodeCount);

  if (stage.isEndless) {
    const firstWave = generateEndlessWaveSpawns(1, 7, stage.activeRows, () => nextRandom(state));
    state.pendingSpawns = firstWave;
    state.totalSpawns = firstWave.length;
    state.endlessNextWaveTimer = 26;
  }

  return state;
}

export function isAttentionNode(state: GameState, row: number, col: number): boolean {
  return state.attentionNodes.some((node) => node.row === row && node.col === col);
}

export function isTileLocked(state: GameState, row: number, col: number): boolean {
  return state.lockedTiles.some((tile) => tile.row === row && tile.col === col && tile.warningTimer <= 0);
}

export function canPlaceRobot(
  state: GameState,
  robotId: RobotId,
  row: number,
  col: number,
): boolean {
  if (state.status !== "playing") return false;
  if (!state.stage.activeRows.includes(row)) return false;
  if (col < 0 || col >= GRID_COLS) return false;
  // In Boss stage, columns 7 and 8 in rows 1..3 are occupied by Rogue LLM
  if (state.boss?.active && col >= 7 && row >= 1 && row <= 3) return false;
  if (isTileLocked(state, row, col)) return false;
  if (state.robots.some((r) => r.row === row && r.col === col)) return false;
  const def = ROBOT_CATALOG[robotId];
  if (state.tokens < def.cost) return false;
  if (state.cardCooldowns[robotId] > 0) return false;
  return true;
}

function addParticles(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 2.4,
): void {
  for (let i = 0; i < count; i++) {
    const angle = nextRandom(state) * Math.PI * 2;
    const mag = (0.35 + nextRandom(state) * 0.9) * speed;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * mag,
      vy: Math.sin(angle) * mag - 0.5,
      size: 2 + Math.floor(nextRandom(state) * 3),
      color,
      life: 0.35 + nextRandom(state) * 0.35,
      maxLife: 0.7,
    });
  }
}

function addFloatingText(
  state: GameState,
  x: number,
  y: number,
  text: string,
  color: string,
): void {
  state.floatingTexts.push({
    x,
    y,
    text,
    color,
    life: 0.95,
    maxLife: 0.95,
  });
}

function spawnTokenCoin(
  state: GameState,
  x: number,
  y: number,
  targetY: number,
  fromSky: boolean,
): void {
  state.tokenCoins.push({
    uid: state.nextUid++,
    value: TOKEN_COIN_VALUE,
    x,
    y,
    targetY,
    vx: fromSky ? 0 : (nextRandom(state) - 0.5) * 0.9,
    vy: fromSky ? 0.85 : -1.5,
    age: 0,
    lifetime: 10,
    collected: false,
    collectProgress: 0,
    startCollectX: x,
    startCollectY: y,
  });
}

function spawnEnemy(state: GameState, enemyId: EnemyId, row: number, startX = GRID_COLS + 0.25): void {
  const def = ENEMY_CATALOG[enemyId];
  state.enemies.push({
    uid: state.nextUid++,
    id: enemyId,
    row,
    x: startX,
    hp: def.baseHp,
    maxHp: def.baseHp,
    armor: def.armorHp,
    maxArmor: def.armorHp,
    speed: def.speed,
    biteDps: def.biteDps,
    slowTimer: 0,
    hitFlashTimer: 0,
    hasJumped: false,
    jumpTimer: 0,
    spawnedMini: false,
    bobPhase: nextRandom(state) * Math.PI * 2,
  });
}

function damageEnemy(state: GameState, enemy: EnemyEntity, amount: number): void {
  enemy.hitFlashTimer = 0.1;
  let remaining = amount;
  if (enemy.armor > 0) {
    const absorbed = Math.min(enemy.armor, remaining);
    enemy.armor -= absorbed;
    remaining -= absorbed;
    if (enemy.armor === 0 && absorbed > 0) {
      addParticles(state, enemy.x, enemy.row + 0.35, ENEMY_CATALOG[enemy.id].accentColor, 8, 2.8);
    }
  }
  if (remaining > 0) {
    enemy.hp = Math.max(0, enemy.hp - remaining);
  }

  // 6-Fingered Mini-Boss spawns a Mini-Prompt at 50% HP
  const def = ENEMY_CATALOG[enemy.id];
  if (def.spawnsMiniAtHalfHp && !enemy.spawnedMini && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.5) {
    enemy.spawnedMini = true;
    const spawnX = Math.max(0.4, enemy.x - 0.9);
    spawnEnemy(state, "mini-prompt", enemy.row, spawnX);
    addFloatingText(state, enemy.x, enemy.row, "MINI-PROMPT!", "#FF85C0");
  }
}

function damageBoss(state: GameState, amount: number): void {
  const boss = state.boss;
  if (!boss || !boss.active) return;
  boss.hp = Math.max(0, boss.hp - amount);
  boss.hitFlashTimer = 0.1;
  boss.expression = boss.hp < boss.maxHp * 0.35 ? "panic" : "hurt";
  boss.expressionTimer = 0.35;
  addCoffeeCharge(state, COFFEE_CHARGE_PER_BOSS_HIT);

  const ratio = boss.hp / boss.maxHp;
  if (ratio <= 0.35 && boss.phase < 3) {
    boss.phase = 3;
    state.bannerText = "⚠️ ROGUE LLM PHASE 3 — CRITICAL OVERLOAD!";
    state.bannerTimer = 2.6;
    state.soundQueue.push({ kind: "wave" });
    if (!boss.spawnedPhase3Guard) {
      boss.spawnedPhase3Guard = true;
      spawnEnemy(state, "six-finger-boss", 2, 7.6);
    }
  } else if (ratio <= 0.7 && boss.phase < 2) {
    boss.phase = 2;
    state.bannerText = "⚠️ ROGUE LLM PHASE 2 — HALLUCINATION SPIKE!";
    state.bannerTimer = 2.4;
    state.soundQueue.push({ kind: "wave" });
  }

  if (boss.hp <= 0) {
    boss.active = false;
    state.enemies = [];
    state.lockedTiles = [];
    state.screenShakeTimer = 0.5;
    state.screenShakeIntensity = 5;
    addParticles(state, 8.0, 2.5, "#B06CFF", 28, 4.2);
    addParticles(state, 8.0, 2.5, "#FFE14D", 20, 3.6);
    addFloatingText(state, 7.6, 1.8, "PROD SAVED!", "#52F2B8");
    finishVictory(state);
  }
}

function addCoffeeCharge(state: GameState, amount: number): void {
  if (!state.stage.coffeeEnabled) return;
  if (state.coffeeCups >= MAX_COFFEE_CUPS) return;
  state.coffeeCharge += amount;
  while (state.coffeeCharge >= 100 && state.coffeeCups < MAX_COFFEE_CUPS) {
    state.coffeeCharge -= 100;
    state.coffeeCups += 1;
    addFloatingText(state, 1.0, 4.6, "+1 COFFEE!", "#FF9F1C");
  }
}

function triggerHotfixBlast(state: GameState, row: number, col: number): void {
  const def = ROBOT_CATALOG["hotfix-core"];
  for (const enemy of state.enemies) {
    const dRow = Math.abs(enemy.row - row);
    const dCol = Math.abs(enemy.x - (col + 0.5));
    if (dRow <= 1 && dCol <= 1.65) {
      damageEnemy(state, enemy, def.damage);
    }
  }
  if (state.boss?.active && col >= 5 && row >= 0 && row <= 4) {
    damageBoss(state, 1400);
  }
  state.screenShakeTimer = 0.25;
  state.screenShakeIntensity = 4;
  addParticles(state, col + 0.5, row + 0.5, "#FF8A3D", 22, 4.0);
  addParticles(state, col + 0.5, row + 0.5, "#FFE14D", 14, 3.0);
  addFloatingText(state, col + 0.5, row + 0.2, "HOTFIX!", "#FFE14D");
  state.soundQueue.push({ kind: "explosion" });
}

export function placeRobot(
  state: GameState,
  robotId: RobotId,
  row: number,
  col: number,
): boolean {
  if (!canPlaceRobot(state, robotId, row, col)) return false;
  const def = ROBOT_CATALOG[robotId];
  state.tokens -= def.cost;
  state.cardCooldowns[robotId] = def.cooldown;

  if (robotId === "hotfix-core") {
    triggerHotfixBlast(state, row, col);
    return true;
  }

  state.robots.push({
    uid: state.nextUid++,
    id: robotId,
    row,
    col,
    hp: def.maxHp,
    maxHp: def.maxHp,
    timer: robotId === "token-flower" ? (def.firstTokenDelay ?? 7.5) : 0.35,
    armed: robotId !== "bug-trap",
    armTimer: def.armingTime ?? 0,
    overclockTimer: 0,
    overclockShotsLeft: 0,
    recoilTimer: 0,
    hitFlashTimer: 0,
    bobPhase: nextRandom(state) * Math.PI * 2,
  });

  addParticles(state, col + 0.5, row + 0.65, def.accentColor, 6, 1.5);
  state.soundQueue.push({ kind: "place" });
  return true;
}

export function uninstallRobot(state: GameState, row: number, col: number): boolean {
  if (state.status !== "playing") return false;
  const idx = state.robots.findIndex((r) => r.row === row && r.col === col);
  if (idx === -1) return false;
  const [removed] = state.robots.splice(idx, 1);
  const refund = Math.floor(ROBOT_CATALOG[removed.id].cost * UNINSTALL_REFUND_RATIO);
  state.tokens += refund;
  addParticles(state, col + 0.5, row + 0.5, "#94A3B8", 8, 1.8);
  if (refund > 0) {
    addFloatingText(state, col + 0.5, row + 0.3, `+${refund} T`, "#FFE14D");
  }
  state.soundQueue.push({ kind: "uninstall" });
  return true;
}

export function collectToken(state: GameState, tokenUid: number): boolean {
  const coin = state.tokenCoins.find((c) => c.uid === tokenUid && !c.collected);
  if (!coin) return false;
  coin.collected = true;
  coin.collectProgress = 0;
  coin.startCollectX = coin.x;
  coin.startCollectY = coin.y;
  state.tokens += coin.value;
  state.tokensCollected += coin.value;
  state.soundQueue.push({ kind: "token" });
  return true;
}

export function applyCoffeeBoost(state: GameState, row: number, col: number): boolean {
  if (state.status !== "playing") return false;
  if (!state.stage.coffeeEnabled || state.coffeeCups <= 0) return false;
  const robot = state.robots.find((r) => r.row === row && r.col === col);
  if (!robot) return false;

  state.coffeeCups -= 1;
  robot.overclockTimer = COFFEE_OVERCLOCK_DURATION;
  state.screenShakeTimer = 0.16;
  state.screenShakeIntensity = 2.5;
  state.soundQueue.push({ kind: "coffee" });
  addParticles(state, col + 0.5, row + 0.5, "#FFE14D", 14, 3.0);
  addFloatingText(state, col + 0.5, row + 0.1, "OVERCLOCK!", "#FFE14D");

  if (robot.id === "token-flower") {
    for (let i = 0; i < 5; i++) {
      const offsetX = (i - 2) * 0.25;
      spawnTokenCoin(
        state,
        Math.min(GRID_COLS - 0.5, Math.max(0.5, col + 0.5 + offsetX)),
        row + 0.2,
        row + 0.72,
        false,
      );
    }
  } else if (robot.id === "ping-blossom") {
    robot.overclockShotsLeft = 18;
    robot.timer = 0.05;
  } else if (robot.id === "dual-core") {
    robot.overclockShotsLeft = 24;
    robot.timer = 0.05;
  } else if (robot.id === "firewall-pod") {
    robot.maxHp = 5000;
    robot.hp = 5000;
    addFloatingText(state, col + 0.5, row + 0.3, "TITANIUM!", "#4DD8FF");
  } else if (robot.id === "cooler-bot") {
    for (const enemy of state.enemies) {
      if (enemy.row === row) {
        enemy.slowTimer = Math.max(enemy.slowTimer, 4.5);
        damageEnemy(state, enemy, 160);
      }
    }
    if (state.boss?.active && row >= 1 && row <= 3) {
      damageBoss(state, 240);
    }
    addFloatingText(state, col + 1.5, row + 0.3, "429 FREEZE!", "#63E6FF");
  } else if (robot.id === "bug-trap") {
    robot.armed = true;
    robot.armTimer = 0;
    let spawned = 0;
    for (const candidateRow of state.stage.activeRows) {
      for (let c = 2; c <= 6 && spawned < 2; c++) {
        const occupied = state.robots.some((r) => r.row === candidateRow && r.col === c);
        if (!occupied && !isTileLocked(state, candidateRow, c)) {
          state.robots.push({
            uid: state.nextUid++,
            id: "bug-trap",
            row: candidateRow,
            col: c,
            hp: ROBOT_CATALOG["bug-trap"].maxHp,
            maxHp: ROBOT_CATALOG["bug-trap"].maxHp,
            timer: 0,
            armed: true,
            armTimer: 0,
            overclockTimer: 1.5,
            overclockShotsLeft: 0,
            recoilTimer: 0,
            hitFlashTimer: 0,
            bobPhase: nextRandom(state) * Math.PI * 2,
          });
          spawned++;
        }
      }
    }
  }

  return true;
}

function finishVictory(state: GameState): void {
  if (state.status !== "playing") return;
  state.status = "victory";
  const activeCount = state.stage.activeRows.length;
  const savedBrooms = state.brooms.filter(
    (b) => state.stage.activeRows.includes(b.row) && !b.active && !b.spent,
  ).length;
  if (savedBrooms >= activeCount) {
    state.starsEarned = 3;
  } else if (savedBrooms >= Math.max(1, activeCount - 2)) {
    state.starsEarned = 2;
  } else {
    state.starsEarned = 1;
  }
  state.soundQueue.push({ kind: "victory" });
}

function hasThreatInRow(state: GameState, row: number, col: number): boolean {
  if (state.boss?.active && row >= 1 && row <= 3) return true;
  return state.enemies.some((e) => e.row === row && e.x >= col + 0.2 && e.x <= GRID_COLS + 0.3);
}

export function stepGameState(state: GameState, rawDt: number): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.1);
  if (state.status !== "playing") {
    // Keep visual effects (particles, floating texts, sweeping brooms, idle bobbing) alive
    // during the 1-second post-match celebration before the result modal opens!
    state.elapsed += dt;
    if (state.screenShakeTimer > 0) {
      state.screenShakeTimer = Math.max(0, state.screenShakeTimer - dt);
    }
    for (const broom of state.brooms) {
      if (!broom.active) continue;
      broom.x += 7.8 * dt;
      addParticles(state, broom.x - 0.35, broom.row + 0.58, "#67e8f9", 2, 1.3);
      if (broom.x >= GRID_COLS + 0.8) {
        broom.active = false;
        broom.spent = true;
      }
    }
    state.tokenCoins = state.tokenCoins.filter((coin) => {
      if (!coin.collected) return true;
      coin.collectProgress += dt * 2.8;
      return coin.collectProgress < 1;
    });
    state.particles = state.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 2.2 * dt;
      return p.life > 0;
    });
    state.floatingTexts = state.floatingTexts.filter((ft) => {
      ft.life -= dt;
      ft.y -= 0.7 * dt;
      return ft.life > 0;
    });
    return;
  }
  state.elapsed += dt;

  if (state.bannerTimer > 0) {
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.bannerTimer === 0) state.bannerText = null;
  }
  if (state.screenShakeTimer > 0) {
    state.screenShakeTimer = Math.max(0, state.screenShakeTimer - dt);
  }

  // Cooldowns
  for (const id of ROBOT_ORDER) {
    if (state.cardCooldowns[id] > 0) {
      state.cardCooldowns[id] = Math.max(0, state.cardCooldowns[id] - dt);
    }
  }

  // Shifting Attention Nodes
  if (state.stage.attentionNodesShift && state.stage.attentionNodeCount > 0) {
    state.attentionShiftTimer -= dt;
    if (state.attentionShiftTimer <= 0) {
      state.attentionShiftTimer = 32;
      state.attentionNodes = pickAttentionNodes(state, state.stage.attentionNodeCount);
      addFloatingText(state, 4.5, 0.5, "ATTENTION SHIFT!", "#FFE14D");
    }
  }

  // Natural Token drops
  state.naturalTokenTimer -= dt;
  if (state.naturalTokenTimer <= 0) {
    state.naturalTokenTimer = state.stage.naturalTokenInterval;
    const x = 1.0 + nextRandom(state) * 6.5;
    const targetRow =
      state.stage.activeRows[Math.floor(nextRandom(state) * state.stage.activeRows.length)];
    spawnTokenCoin(state, x, -0.3, targetRow + 0.65, true);
  }

  // Traffic spike banner
  if (
    state.stage.hasTrafficSpike &&
    !state.trafficSpikeTriggered &&
    state.stage.trafficSpikeTime !== undefined &&
    state.elapsed >= state.stage.trafficSpikeTime
  ) {
    state.trafficSpikeTriggered = true;
    state.bannerText = "⚠️ TRAFFIC SPIKE INCOMING!";
    state.bannerTimer = 2.6;
    state.soundQueue.push({ kind: "wave" });
  }

  // Scheduled spawns
  while (state.pendingSpawns.length > 0 && state.pendingSpawns[0].time <= state.elapsed) {
    const next = state.pendingSpawns.shift()!;
    const row =
      next.row !== undefined
        ? next.row
        : state.stage.activeRows[Math.floor(nextRandom(state) * state.stage.activeRows.length)];
    spawnEnemy(state, next.enemyId, row);
  }

  // Wave banners for scripted stages
  if (!state.stage.isBossStage && !state.stage.isEndless && state.totalSpawns > 0) {
    const spawned = state.totalSpawns - state.pendingSpawns.length;
    const progress = spawned / state.totalSpawns;
    for (let i = 0; i < state.stage.waveMarkers.length; i++) {
      if (progress >= state.stage.waveMarkers[i] && !state.triggeredWaveMarkers.includes(i)) {
        state.triggeredWaveMarkers.push(i);
        const isFinal = i === state.stage.waveMarkers.length - 1;
        state.bannerText = isFinal
          ? "⚠️ HUGE PROMPT WAVE INCOMING!"
          : `WAVE ${i + 2} APPROACHING!`;
        state.bannerTimer = 2.4;
        state.soundQueue.push({ kind: "wave" });
      }
    }
  }

  // Endless mode wave generator
  if (state.stage.isEndless) {
    if (state.pendingSpawns.length === 0) {
      state.endlessNextWaveTimer -= dt;
      if (state.endlessNextWaveTimer <= 0 || state.enemies.length === 0) {
        state.endlessWave += 1;
        const newSpawns = generateEndlessWaveSpawns(
          state.endlessWave,
          state.elapsed + 1.5,
          state.stage.activeRows,
          () => nextRandom(state),
        );
        state.pendingSpawns.push(...newSpawns);
        state.totalSpawns += newSpawns.length;
        state.endlessNextWaveTimer = 24;
        state.bannerText = `24/7 ON-CALL — WAVE ${state.endlessWave}`;
        state.bannerTimer = 2.2;
        state.soundQueue.push({ kind: "wave" });
      }
    }
  }

  // Locked tiles countdown
  for (const tile of state.lockedTiles) {
    if (tile.warningTimer > 0) {
      tile.warningTimer = Math.max(0, tile.warningTimer - dt);
    } else {
      tile.timer -= dt;
    }
  }
  state.lockedTiles = state.lockedTiles.filter((t) => t.warningTimer > 0 || t.timer > 0);

  // Boss Rogue LLM AI
  if (state.boss?.active) {
    const boss = state.boss;
    if (boss.hitFlashTimer > 0) boss.hitFlashTimer = Math.max(0, boss.hitFlashTimer - dt);
    if (boss.expressionTimer > 0) {
      boss.expressionTimer = Math.max(0, boss.expressionTimer - dt);
      if (boss.expressionTimer === 0) {
        boss.expression = boss.phase === 3 ? "panic" : "smug";
      }
    }

    // Summon minions
    boss.summonTimer -= dt;
    if (boss.summonTimer <= 0) {
      boss.summonTimer = boss.phase === 1 ? 11.5 : boss.phase === 2 ? 9.0 : 7.5;
      const row = state.stage.activeRows[Math.floor(nextRandom(state) * state.stage.activeRows.length)];
      const r = nextRandom(state);
      let enemyId: EnemyId = "prompt-slime";
      if (boss.phase === 1) {
        enemyId = r < 0.65 ? "prompt-slime" : "cone-bot";
      } else if (boss.phase === 2) {
        enemyId = r < 0.35 ? "cone-bot" : r < 0.7 ? "glitch-hopper" : "gpu-golem";
      } else {
        enemyId = r < 0.35 ? "glitch-hopper" : r < 0.75 ? "gpu-golem" : "cone-bot";
      }
      spawnEnemy(state, enemyId, row, 7.7);
      boss.expression = "casting";
      boss.expressionTimer = 0.8;
    }

    // Context Overflow: lock an empty tile
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.attackTimer = boss.phase === 1 ? 14 : boss.phase === 2 ? 11 : 9.5;
      const maxLocks = boss.phase === 1 ? 1 : 2;
      if (state.lockedTiles.length < maxLocks) {
        const emptyCandidates: Array<{ row: number; col: number }> = [];
        for (const row of state.stage.activeRows) {
          for (let col = 2; col <= 5; col++) {
            const hasRobot = state.robots.some((r) => r.row === row && r.col === col);
            const alreadyLocked = state.lockedTiles.some((t) => t.row === row && t.col === col);
            if (!hasRobot && !alreadyLocked) emptyCandidates.push({ row, col });
          }
        }
        if (emptyCandidates.length > 0) {
          const pick = emptyCandidates[Math.floor(nextRandom(state) * emptyCandidates.length)];
          state.lockedTiles.push({
            row: pick.row,
            col: pick.col,
            warningTimer: 1.5,
            timer: 10,
          });
          boss.expression = "casting";
          boss.expressionTimer = 1.0;
          addFloatingText(state, pick.col + 0.5, pick.row + 0.2, "LOCKED!", "#FF5CA8");
          state.soundQueue.push({ kind: "boss-lock" });
        }
      }
    }
  }

  // Update Robots
  const explodedTrapUids = new Set<number>();
  for (const robot of state.robots) {
    const def = ROBOT_CATALOG[robot.id];
    const onAttention = isAttentionNode(state, robot.row, robot.col);
    const speedMultiplier = onAttention ? 1.25 : 1.0;

    if (robot.recoilTimer > 0) robot.recoilTimer = Math.max(0, robot.recoilTimer - dt);
    if (robot.hitFlashTimer > 0) robot.hitFlashTimer = Math.max(0, robot.hitFlashTimer - dt);
    if (robot.overclockTimer > 0) robot.overclockTimer = Math.max(0, robot.overclockTimer - dt);

    if (robot.id === "token-flower") {
      robot.timer -= dt * speedMultiplier;
      if (robot.timer <= 0) {
        robot.timer = def.tokenInterval ?? 20;
        spawnTokenCoin(state, robot.col + 0.5, robot.row + 0.25, robot.row + 0.72, false);
        robot.recoilTimer = 0.2;
      }
    } else if (robot.id === "bug-trap") {
      if (!robot.armed) {
        robot.armTimer -= dt * speedMultiplier;
        if (robot.armTimer <= 0) {
          robot.armed = true;
          addFloatingText(state, robot.col + 0.5, robot.row + 0.2, "ARMED!", "#FF6B81");
        }
      } else {
        const trigger = state.enemies.find(
          (e) => e.row === robot.row && Math.abs(e.x - (robot.col + 0.5)) <= 0.55,
        );
        if (trigger) {
          for (const e of state.enemies) {
            if (e.row === robot.row && Math.abs(e.x - (robot.col + 0.5)) <= 0.95) {
              damageEnemy(state, e, def.damage);
            }
          }
          explodedTrapUids.add(robot.uid);
          state.screenShakeTimer = 0.18;
          state.screenShakeIntensity = 3;
          addParticles(state, robot.col + 0.5, robot.row + 0.5, "#FF6B81", 16, 3.2);
          addFloatingText(state, robot.col + 0.5, robot.row + 0.2, "BUG FIXED!", "#52F2B8");
          state.soundQueue.push({ kind: "explosion" });
        }
      }
    } else if (def.attackInterval > 0) {
      // Overclock rapid fire burst
      if (robot.overclockShotsLeft > 0) {
        robot.timer -= dt;
        if (robot.timer <= 0) {
          robot.timer = 0.12;
          robot.overclockShotsLeft -= 1;
          robot.recoilTimer = 0.1;
          state.projectiles.push({
            uid: state.nextUid++,
            row: robot.row,
            x: robot.col + 0.78,
            speed: 7.5,
            damage: def.damage,
            slowFactor: def.slowFactor ?? 0,
            slowDuration: def.slowDuration ?? 0,
            color: "#FFE14D",
            kind: "overclock",
          });
          state.soundQueue.push({ kind: "shoot" });
        }
      } else if (hasThreatInRow(state, robot.row, robot.col)) {
        robot.timer -= dt * speedMultiplier;
        if (robot.timer <= 0) {
          robot.timer = def.attackInterval;
          robot.recoilTimer = 0.16;
          const shots = def.shotsPerAttack ?? 1;
          for (let s = 0; s < shots; s++) {
            state.projectiles.push({
              uid: state.nextUid++,
              row: robot.row,
              x: robot.col + 0.75 - s * 0.28,
              speed: 6.2,
              damage: def.damage,
              slowFactor: def.slowFactor ?? 0,
              slowDuration: def.slowDuration ?? 0,
              color: robot.id === "cooler-bot" ? "#63E6FF" : "#52F2B8",
              kind: robot.id === "cooler-bot" ? "ice" : "laser",
            });
          }
          state.soundQueue.push({ kind: robot.id === "cooler-bot" ? "ice" : "shoot" });
        }
      }
    }
  }
  if (explodedTrapUids.size > 0) {
    state.robots = state.robots.filter((r) => !explodedTrapUids.has(r.uid));
  }

  // Update Projectiles & Collisions
  const remainingProjectiles: ProjectileEntity[] = [];
  for (const proj of state.projectiles) {
    proj.x += proj.speed * dt;
    if (proj.x > GRID_COLS + 0.4) continue;

    // Hit closest enemy in row
    let hit = false;
    let closest: EnemyEntity | null = null;
    for (const enemy of state.enemies) {
      if (enemy.row !== proj.row || enemy.hp <= 0) continue;
      if (Math.abs(enemy.x - proj.x) <= 0.42) {
        if (!closest || enemy.x < closest.x) closest = enemy;
      }
    }

    if (closest) {
      hit = true;
      damageEnemy(state, closest, proj.damage);
      if (proj.slowFactor > 0) {
        const wasSlowed = closest.slowTimer > 0;
        closest.slowTimer = Math.max(closest.slowTimer, proj.slowDuration);
        if (!wasSlowed) {
          addFloatingText(state, closest.x, closest.row + 0.1, "429!", "#63E6FF");
        }
      }
      addParticles(state, proj.x, proj.row + 0.45, proj.color, 4, 1.8);
      state.soundQueue.push({ kind: "hit" });
    } else if (state.boss?.active && proj.row >= 1 && proj.row <= 3 && proj.x >= 7.1) {
      hit = true;
      damageBoss(state, proj.damage);
      addParticles(state, proj.x, proj.row + 0.45, proj.color, 5, 2.2);
      state.soundQueue.push({ kind: "hit" });
    }

    if (!hit) remainingProjectiles.push(proj);
  }
  state.projectiles = remainingProjectiles;

  // Update Enemies
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
    if (enemy.slowTimer > 0) enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
    if (enemy.jumpTimer > 0) enemy.jumpTimer = Math.max(0, enemy.jumpTimer - dt);

    const slowMul = enemy.slowTimer > 0 ? 0.6 : 1.0;

    // Check robot blocking this enemy
    const blocker = state.robots.find(
      (r) => r.row === enemy.row && enemy.x > r.col + 0.25 && enemy.x <= r.col + 0.92,
    );

    if (blocker) {
      const def = ENEMY_CATALOG[enemy.id];
      if (def.canJumpFirstRobot && !enemy.hasJumped) {
        enemy.hasJumped = true;
        enemy.jumpTimer = 0.35;
        enemy.x = Math.max(0.1, blocker.col - 0.15);
        enemy.speed = 1.0 * BASE_COL_SPEED;
        addParticles(state, enemy.x + 0.4, enemy.row + 0.45, "#F43F9E", 8, 2.4);
        addFloatingText(state, enemy.x + 0.3, enemy.row + 0.1, "GLITCH!", "#F43F9E");
      } else {
        blocker.hp -= enemy.biteDps * slowMul * dt;
        blocker.hitFlashTimer = 0.08;
      }
    } else {
      enemy.x -= enemy.speed * slowMul * dt;
    }

    // Reached home base edge -> trigger broom or lose!
    if (enemy.x < 0.0) {
      const broom = state.brooms[enemy.row];
      if (broom && !broom.active && !broom.spent) {
        broom.active = true;
        broom.x = -0.3;
        state.screenShakeTimer = 0.2;
        state.screenShakeIntensity = 3;
        addFloatingText(state, 0.8, enemy.row + 0.2, "GC SWEPT!", "#4DD8FF");
        state.soundQueue.push({ kind: "broom" });
      } else if (!broom || broom.spent) {
        state.status = "defeat";
        state.soundQueue.push({ kind: "defeat" });
        return;
      }
    }
  }

  // Remove destroyed robots
  state.robots = state.robots.filter((r) => {
    if (r.hp > 0) return true;
    addParticles(state, r.col + 0.5, r.row + 0.5, ROBOT_CATALOG[r.id].accentColor, 10, 2.2);
    return false;
  });

  // Update GC Brooms
  for (const broom of state.brooms) {
    if (!broom.active) continue;
    broom.x += 7.8 * dt;
    addParticles(state, broom.x - 0.35, broom.row + 0.58, "#67e8f9", 2, 1.3);
    if (nextRandom(state) < 0.45) {
      addParticles(state, broom.x - 0.5, broom.row + 0.48, "#ffffff", 1, 1.0);
    }
    for (const enemy of state.enemies) {
      if (enemy.row === broom.row && enemy.hp > 0 && Math.abs(enemy.x - broom.x) <= 0.65) {
        enemy.hp = 0;
        enemy.armor = 0;
        addParticles(state, enemy.x, enemy.row + 0.5, ENEMY_CATALOG[enemy.id].accentColor, 10, 3.0);
      }
    }
    if (broom.x >= GRID_COLS + 0.8) {
      broom.active = false;
      broom.spent = true;
    }
  }

  // Remove defeated enemies & grant coffee charge
  state.enemies = state.enemies.filter((e) => {
    if (e.hp > 0) return true;
    state.enemiesPatched += 1;
    addCoffeeCharge(state, COFFEE_CHARGE_PER_KILL);
    addParticles(state, e.x, e.row + 0.5, ENEMY_CATALOG[e.id].accentColor, 10, 2.6);
    if (nextRandom(state) < 0.28) {
      addFloatingText(state, e.x, e.row + 0.2, "PATCHED!", "#52F2B8");
    }
    return false;
  });

  // Update Token Coins
  state.tokenCoins = state.tokenCoins.filter((coin) => {
    if (coin.collected) {
      coin.collectProgress += dt * 2.8;
      return coin.collectProgress < 1;
    }
    coin.age += dt;
    if (coin.y < coin.targetY) {
      coin.vy += 4.2 * dt;
      coin.x = Math.min(GRID_COLS - 0.4, Math.max(0.4, coin.x + coin.vx * dt));
      coin.y = Math.min(coin.targetY, coin.y + coin.vy * dt);
      if (coin.y >= coin.targetY) {
        coin.vx = 0;
        coin.vy = 0;
      }
    }
    return coin.age < coin.lifetime;
  });

  // Update Particles & Floating Texts
  state.particles = state.particles.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 2.2 * dt;
    return p.life > 0;
  });

  state.floatingTexts = state.floatingTexts.filter((ft) => {
    ft.life -= dt;
    ft.y -= 0.7 * dt;
    return ft.life > 0;
  });

  // Victory check for non-boss, non-endless stages
  if (
    !state.stage.isBossStage &&
    !state.stage.isEndless &&
    state.pendingSpawns.length === 0 &&
    state.enemies.length === 0
  ) {
    finishVictory(state);
  }
}

export function getWaveProgress(state: GameState): number {
  if (state.boss) {
    return Math.max(0, Math.min(1, state.boss.hp / state.boss.maxHp));
  }
  if (state.totalSpawns <= 0) return 0;
  const remaining = state.pendingSpawns.length + state.enemies.length * 0.5;
  return Math.max(0, Math.min(1, 1 - remaining / state.totalSpawns));
}

export function computeEndlessUptime(wave: number): string {
  if (wave <= 1) return "99.00%";
  const value = Math.min(99.99, 99 + (1 - Math.pow(0.76, wave - 1)) * 0.99);
  return `${value.toFixed(2)}%`;
}
