import assert from "node:assert/strict";
import test from "node:test";
import { extendStraightPath, getStraightPath, updateWordSearchSelection } from "../src/lib/word-search.ts";

test("normalizes reversed horizontal selections to left-to-right", () => {
  assert.deepEqual(getStraightPath(17, 12, 6), [12, 13, 14, 15, 16, 17]);
});

test("normalizes reversed vertical selections to top-to-bottom", () => {
  assert.deepEqual(getStraightPath(31, 7, 6), [7, 13, 19, 25, 31]);
});

test("normalizes reversed diagonal selections from the top row downward", () => {
  assert.deepEqual(getStraightPath(20, 5, 6), [5, 10, 15, 20]);
  assert.deepEqual(getStraightPath(19, 4, 6), [4, 9, 14, 19]);
});

test("preserves forward selections and rejects non-straight paths", () => {
  assert.deepEqual(getStraightPath(7, 11, 6), [7, 8, 9, 10, 11]);
  assert.equal(getStraightPath(1, 9, 6), null);
});

test("extends a sequential selection at either end of its straight path", () => {
  assert.deepEqual(extendStraightPath([7, 8], 9, 6), [7, 8, 9]);
  assert.deepEqual(extendStraightPath([7, 8], 6, 6), [6, 7, 8]);
  assert.deepEqual(extendStraightPath([5, 10], 15, 6), [5, 10, 15]);
  assert.deepEqual(extendStraightPath([10, 15], 5, 6), [5, 10, 15]);
});

test("does not extend a sequential selection with a nonconsecutive or off-line cell", () => {
  assert.equal(extendStraightPath([7, 8], 10, 6), null);
  assert.equal(extendStraightPath([7, 8], 14, 6), null);
});

test("supports both endpoint selection and consecutive cell selection", () => {
  assert.deepEqual(updateWordSearchSelection([], 7, 6), { path: [7], isValid: true });
  assert.deepEqual(updateWordSearchSelection([7], 10, 6), {
    path: [7, 8, 9, 10],
    isValid: true,
  });
  assert.deepEqual(updateWordSearchSelection([7, 8], 9, 6), {
    path: [7, 8, 9],
    isValid: true,
  });
});

test("reselecting a chosen cell resets the sequence to that cell", () => {
  assert.deepEqual(updateWordSearchSelection([7, 8, 9], 8, 6), {
    path: [8],
    isValid: true,
  });
});
