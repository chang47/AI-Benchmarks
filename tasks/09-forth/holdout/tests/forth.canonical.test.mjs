// Holdout answer key — MECHANICAL translation of canonical-data.json (Exercism `forth`).
// Source: https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/forth/canonical-data.json
// Every test is generated directly from the canonical data at runtime; test names are the
// case descriptions verbatim. No case was adapted or weakened. See ../VETTING.md.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/forth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const canonical = JSON.parse(
  readFileSync(join(here, '..', 'canonical-data.json'), 'utf8'),
);

function isErrorExpectation(expected) {
  return (
    expected !== null &&
    typeof expected === 'object' &&
    !Array.isArray(expected) &&
    typeof expected.error === 'string'
  );
}

// Assert that fn throws a JS Error whose message EXACTLY equals `message`
// (vitest's toThrowError(string) does substring matching, so assert manually).
function expectExactError(fn, message) {
  let caught = null;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  expect(caught, 'expected evaluate to throw an Error').toBeInstanceOf(Error);
  expect(caught.message).toBe(message);
}

function translateCase(c) {
  if (c.property === 'evaluate') {
    it(c.description, () => {
      if (isErrorExpectation(c.expected)) {
        expectExactError(() => evaluate(c.input.instructions), c.expected.error);
      } else {
        expect(evaluate(c.input.instructions)).toEqual(c.expected);
      }
    });
    return;
  }
  if (c.property === 'evaluateBoth') {
    // Canonical local-scope case: two INDEPENDENT evaluate calls, in order.
    // Definitions made in the first call must not be visible in the second.
    it(c.description, () => {
      const first = evaluate(c.input.instructionsFirst);
      const second = evaluate(c.input.instructionsSecond);
      expect(first).toEqual(c.expected[0]);
      expect(second).toEqual(c.expected[1]);
    });
    return;
  }
  throw new Error(`untranslatable canonical property: ${c.property}`);
}

function walk(node) {
  if (Object.prototype.hasOwnProperty.call(node, 'property')) {
    translateCase(node);
    return;
  }
  if (Array.isArray(node.cases)) {
    describe(node.description, () => {
      for (const child of node.cases) walk(child);
    });
  }
}

for (const section of canonical.cases) walk(section);
