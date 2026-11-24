import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { exerciseGroups, exercises, filterExercises, initialExerciseFilters, sortExercisesByLevel } from "../src/lib/training.ts";

test("the public catalogue has complete, uniquely identified translations", () => {
  assert.ok(exercises.length >= 8);
  assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, exercises.length);
  for (const exercise of exercises) {
    assert.ok(exercise.minutes > 0);
    for (const locale of ["vi", "en", "ja"]) {
      const content = exercise.text[locale];
      assert.ok(content.title && content.equipment && content.note);
      assert.ok(content.steps.length >= 3 && content.steps.every(Boolean));
      for (const text of [content.title, content.equipment, content.note, ...content.steps]) {
        assert.ok(!text.includes(";"), `${exercise.id} (${locale}) contains a semicolon`);
      }
    }
  }
});

test("each exercise has a dedicated illustration file", () => {
  const files = readdirSync(new URL("../src/components/training/illustrations/", import.meta.url))
    .filter((name) => name.endsWith(".tsx") && name !== "shared.tsx")
    .sort();
  assert.deepEqual(files, exercises.map((exercise) => `${exercise.id}.tsx`).sort());
});

test("exercise joint origins and stretch holds match the artwork", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const origins = {
    "training-neck-tilt": "151px 75px",
    "training-neck-tuck": "151px 75px",
    "training-neck-tuck-neck": "151px 75px",
    "training-elbow-bend-left": "112px 125px",
    "training-elbow-bend-right": "191px 125px",
    "training-lateral-arm-left": "124px 84px",
    "training-lateral-arm-right": "178px 84px",
    "training-knee-far": "141px 145px",
    "training-knee-near": "154px 149px",
    "training-seated-heel-far": "168px 227px",
    "training-seated-heel": "182px 227px",
    "training-toe-raise-far": "135px 227px",
    "training-toe-raise-near": "149px 227px",
    "training-march-thigh-far": "139px 141px",
    "training-march-thigh-near": "147px 141px",
    "training-march-shin-far": "139px 182px",
    "training-march-shin-near": "147px 182px",
    "sit-stand-shin": "180px 220px",
    "sit-stand-thigh": "176px 165px",
    "sit-stand-upper": "115px 165px",
    "training-standing-lift": "140px 228px",
    "training-side-leg-left": "140px 140px",
    "training-side-leg-right": "162px 140px",
    "training-side-arm-left": "124px 84px",
    "training-side-arm-right": "178px 84px",
    "training-wrist-left": "146px 69px",
    "training-wrist-right": "154px 69px",
  };
  for (const [name, origin] of Object.entries(origins)) {
    const rule = css.match(new RegExp(`^\\.${name} \\{([^}]*)\\}`, "m"));
    assert.ok(rule, `missing CSS for ${name}`);
    assert.ok(rule[1].includes(`transform-origin: ${origin};`), `${name} pivot`);
  }
  assert.match(css, /\.training-neck-tilt\s*\{[^}]*animation:\s*neckStretch 8s ease-in-out infinite/);
  assert.match(css, /12\.5%, 37\.5%\s*\{\s*transform:\s*rotate\(20deg\)/);
  assert.match(css, /62\.5%, 87\.5%\s*\{\s*transform:\s*rotate\(-20deg\)/);
  assert.match(css, /35%, 60%\s*\{\s*transform:\s*translateX\(-10px\)/);
});

test("exercises belong to exactly one ordered group", () => {
  const expected = {
    neckShoulders: ["shoulder-lifts", "shoulder-blades", "neck-side-tilt", "chin-tuck", "shoulder-side-raise", "weighted-shoulder-raise"],
    limbs: ["supported-side-leg-raise", "wrist-circles", "elbow-bends", "seated-toe-raises", "seated-heel-raises", "seated-knee-extension", "standing-heel-raises"],
    wholeBody: ["side-step-arms", "sit-to-stand", "march-in-place", "standing-arm-stretch"],
  };
  assert.deepEqual([...exerciseGroups], Object.keys(expected));
  for (const group of exerciseGroups) {
    const items = exercises.filter((exercise) => exercise.group === group);
    assert.deepEqual(items.map((exercise) => exercise.id), expected[group]);
    assert.deepEqual([...new Set(items.map((exercise) => exercise.level))].sort(), [1, 2, 3]);
    const sorted = sortExercisesByLevel(items);
    assert.ok(sorted.every((exercise, index) => index === 0 || sorted[index - 1].level <= exercise.level));
    assert.deepEqual(items.map((exercise) => exercise.id), expected[group]);
  }
  assert.ok(exercises.every((exercise) => exerciseGroups.includes(exercise.group)));
});

test("advanced level can be filtered without changing other filters", () => {
  const advanced = filterExercises(exercises, { ...initialExerciseFilters, level: 3 });
  assert.equal(advanced.length, 3);
  assert.ok(advanced.every((exercise) => exercise.level === 3));
});

test("filters combine position, region, level and duration", () => {
  assert.equal(filterExercises(exercises, initialExerciseFilters).length, exercises.length);
  const filters = { position: "standing", region: "legs", level: 2, duration: "short" };
  assert.deepEqual(filterExercises(exercises, filters).map((exercise) => exercise.id), ["standing-heel-raises"]);
  assert.equal(filterExercises(exercises, { ...filters, position: "seated" }).length, 0);
});

test("one minute belongs to the short duration, not the longer duration", () => {
  const short = filterExercises(exercises, { ...initialExerciseFilters, duration: "short" });
  const longer = filterExercises(exercises, { ...initialExerciseFilters, duration: "longer" });
  assert.ok(short.some((exercise) => exercise.minutes === 1));
  assert.ok(short.every((exercise) => exercise.minutes <= 1));
  assert.ok(longer.length > 0 && longer.every((exercise) => exercise.minutes > 1));
  assert.equal(short.length + longer.length, exercises.length);
});
