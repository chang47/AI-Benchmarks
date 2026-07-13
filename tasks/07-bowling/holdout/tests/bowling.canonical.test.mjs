// HOLDOUT ANSWER KEY — mechanical translation of Exercism's bowling canonical-data.json.
// Source data: ../canonical-data.json (byte-verbatim copy of
// https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/bowling/canonical-data.json).
// Translation rules (from the canonical file's own comments):
//   - every element of input.previousRolls is fed through roll() and expected to succeed;
//   - property "score": expected integer -> score() returns it; expected {error} -> score() throws
//     an Error whose message matches character-for-character;
//   - property "roll": rolling input.roll produces the expected result; expected {error} -> that
//     roll() throws an Error whose message matches character-for-character.
// Case descriptions are preserved verbatim as test names. See ../VETTING.md for counts.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Bowling } from "../../src/bowling.mjs";

const canonical = JSON.parse(
  readFileSync(new URL("../canonical-data.json", import.meta.url), "utf8"),
);

// Exact-match throw assertion: vitest's toThrowError(string) does SUBSTRING matching,
// which would let a wrong-but-superstring message pass. The error strings are pinned
// character-for-character, so assert instanceof Error + strict message equality.
function expectExactError(fn, expectedMessage) {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught, "expected the call to throw an Error").toBeInstanceOf(Error);
  expect(caught.message).toBe(expectedMessage);
}

function isErrorExpectation(expected) {
  return (
    typeof expected === "object" &&
    expected !== null &&
    typeof expected.error === "string"
  );
}

describe("Bowling — Exercism canonical data", () => {
  for (const testCase of canonical.cases) {
    it(testCase.description, () => {
      const game = new Bowling();
      for (const pins of testCase.input.previousRolls) {
        game.roll(pins); // canonical comment: each previous roll is expected to succeed
      }

      switch (testCase.property) {
        case "score": {
          if (isErrorExpectation(testCase.expected)) {
            expectExactError(() => game.score(), testCase.expected.error);
          } else {
            expect(game.score()).toBe(testCase.expected);
          }
          break;
        }
        case "roll": {
          if (isErrorExpectation(testCase.expected)) {
            expectExactError(
              () => game.roll(testCase.input.roll),
              testCase.expected.error,
            );
          } else {
            // Not present in the current canonical data ("Currently, all cases of this
            // type result in errors"), kept for mechanical completeness: a non-error
            // expectation means the roll simply succeeds.
            game.roll(testCase.input.roll);
          }
          break;
        }
        default:
          throw new Error(
            `Canonical case ${testCase.uuid} has untranslatable property "${testCase.property}"`,
          );
      }
    });
  }
});
