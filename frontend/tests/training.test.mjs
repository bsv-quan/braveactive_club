import assert from "node:assert/strict";
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
