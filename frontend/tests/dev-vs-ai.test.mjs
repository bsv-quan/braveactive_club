import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCoffeeBoost,
  canPlaceRobot,
  collectToken,
  computeEndlessUptime,
  createGameState,
  ENEMY_CATALOG,
  placeRobot,
  ROBOT_CATALOG,
  STAGES,
  stepGameState,
  uninstallRobot,
} from "../src/lib/dev-vs-ai/core.ts";

test("catalog and 11 scripted stages + endless mode are complete and well-formed", () => {
  assert.equal(Object.keys(ROBOT_CATALOG).length, 7);
  assert.equal(Object.keys(ENEMY_CATALOG).length, 6);
  assert.equal(STAGES.length, 12); // 11 campaign stages + 24/7 On-Call endless
  assert.equal(STAGES.find((s) => s.id === "1-1")?.activeRows.length, 3);
  assert.equal(STAGES.find((s) => s.id === "3-4")?.isBossStage, true);
  assert.equal(STAGES.find((s) => s.id === "on-call")?.isEndless, true);
  assert.ok(ROBOT_CATALOG["ping-blossom"].damage < ROBOT_CATALOG["cooler-bot"].damage);
  assert.ok(
    ROBOT_CATALOG["cooler-bot"].damage <
      ROBOT_CATALOG["dual-core"].damage * (ROBOT_CATALOG["dual-core"].shotsPerAttack ?? 1),
  );
});

test("placing, collecting tokens, and uninstalling refunds 25% of cost", () => {
  const state = createGameState("1-1", 42);
  // Stage 1-1 only allows rows 1, 2, 3
  assert.equal(canPlaceRobot(state, "token-flower", 0, 1), false);
  assert.equal(canPlaceRobot(state, "token-flower", 2, 1), true);

  const startTokens = state.tokens;
  assert.equal(placeRobot(state, "token-flower", 2, 1), true);
  assert.equal(state.tokens, startTokens - ROBOT_CATALOG["token-flower"].cost);
  assert.equal(state.robots.length, 1);

  // Uninstall refunds floor(50 * 0.25) = 12
  assert.equal(uninstallRobot(state, 2, 1), true);
  assert.equal(state.robots.length, 0);
  assert.equal(state.tokens, startTokens - 50 + 12);

  // Advance until a natural token drops and collect it
  for (let i = 0; i < 60; i++) stepGameState(state, 0.1);
  assert.ok(state.tokenCoins.length >= 1);
  const beforeCollect = state.tokens;
  assert.equal(collectToken(state, state.tokenCoins[0].uid), true);
  assert.equal(state.tokens, beforeCollect + 25);
});

test("GC Broom sweeps an entire lane when an enemy reaches the left edge", () => {
  const state = createGameState("1-2", 99);
  state.pendingSpawns = [];
  state.enemies.push({
    uid: 900,
    id: "prompt-slime",
    row: 2,
    x: 0.02,
    hp: 200,
    maxHp: 200,
    armor: 0,
    maxArmor: 0,
    speed: 0.22,
    biteDps: 40,
    slowTimer: 0,
    hitFlashTimer: 0,
    hasJumped: false,
    jumpTimer: 0,
    spawnedMini: false,
    bobPhase: 0,
  });
  state.enemies.push({
    uid: 901,
    id: "cone-bot",
    row: 2,
    x: 3.5,
    hp: 200,
    maxHp: 200,
    armor: 360,
    maxArmor: 360,
    speed: 0.22,
    biteDps: 40,
    slowTimer: 0,
    hitFlashTimer: 0,
    hasJumped: false,
    jumpTimer: 0,
    spawnedMini: false,
    bobPhase: 0,
  });

  // Step until broom activates and sweeps across row 2
  for (let i = 0; i < 30; i++) stepGameState(state, 0.1);
  assert.equal(state.brooms[2].active || state.brooms[2].spent, true);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.status, "victory");
  assert.equal(state.starsEarned, 2); // 4 of 5 brooms saved -> 2 stars
});

test("Glitch Hopper jumps over the first robot encountered", () => {
  const state = createGameState("2-1", 7);
  state.tokens = 500;
  state.pendingSpawns = [];
  assert.equal(placeRobot(state, "firewall-pod", 2, 3), true);

  state.enemies.push({
    uid: 800,
    id: "glitch-hopper",
    row: 2,
    x: 3.85,
    hp: 340,
    maxHp: 340,
    armor: 0,
    maxArmor: 0,
    speed: ENEMY_CATALOG["glitch-hopper"].speed,
    biteDps: 45,
    slowTimer: 0,
    hitFlashTimer: 0,
    hasJumped: false,
    jumpTimer: 0,
    spawnedMini: false,
    bobPhase: 0,
  });

  stepGameState(state, 0.1);
  assert.equal(state.enemies[0].hasJumped, true);
  assert.ok(state.enemies[0].x < 3.0);
});

test("Coffee Boost overclocks Token-Flower and Firewall-Pod", () => {
  const state = createGameState("2-1", 11);
  state.tokens = 500;
  state.coffeeCups = 2;
  assert.equal(placeRobot(state, "token-flower", 1, 1), true);
  assert.equal(placeRobot(state, "firewall-pod", 1, 4), true);

  const coinsBefore = state.tokenCoins.length;
  assert.equal(applyCoffeeBoost(state, 1, 1), true);
  assert.equal(state.tokenCoins.length, coinsBefore + 5);

  assert.equal(applyCoffeeBoost(state, 1, 4), true);
  const pod = state.robots.find((r) => r.id === "firewall-pod");
  assert.equal(pod?.hp, 5000);
  assert.equal(state.coffeeCups, 0);
});

test("Hotfix-Core blasts 3x3 area and Boss Rogue LLM can be damaged and defeated", () => {
  const state = createGameState("3-4", 123);
  assert.ok(state.boss?.active);
  state.tokens = 500;
  state.boss.hp = 600;

  assert.equal(placeRobot(state, "hotfix-core", 2, 6), true);
  assert.equal(state.boss.active, false);
  assert.equal(state.status, "victory");
  assert.equal(state.starsEarned, 3);
  assert.equal(computeEndlessUptime(1), "99.00%");
  assert.notEqual(computeEndlessUptime(10), "99.00%");
});
