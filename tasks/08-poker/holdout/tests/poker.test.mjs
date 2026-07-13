// Holdout test suite — task 08-poker.
// MECHANICAL translation of holdout/canonical-data.json (Exercism problem-specifications,
// exercise "poker") into vitest tests. Each effective canonical case becomes exactly one
// test; the case's `description` is the test name; `input.hands` is passed verbatim to
// `bestHands` and the result must deep-equal `expected` (verbatim strings, input order,
// per spec.md "Artifact contract" and convention C3 in research/RESEARCH.md).
//
// Per the problem-specifications format, a case bearing `"reimplements": "<uuid>"`
// REPLACES the referenced case, so superseded cases are excluded (39 raw -> 37 effective).
// The canonical data contains no error cases, so no thrown-Error tests exist.
// See holdout/VETTING.md for source URL, hash, and case accounting.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bestHands } from '../../src/poker.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(join(here, '..', 'canonical-data.json'), 'utf8'),
);

// A case with `reimplements: <uuid>` supersedes the case with that uuid.
const supersededUuids = new Set(
  data.cases.filter((c) => c.reimplements).map((c) => c.reimplements),
);
const effectiveCases = data.cases.filter((c) => !supersededUuids.has(c.uuid));

// Integrity guard: the frozen canonical data must be exactly what VETTING.md records.
// (39 raw cases, 2 superseded, 37 effective, all property "bestHands".)
if (data.cases.length !== 39) {
  throw new Error(`canonical-data.json drift: expected 39 raw cases, got ${data.cases.length}`);
}
if (effectiveCases.length !== 37) {
  throw new Error(`canonical-data.json drift: expected 37 effective cases, got ${effectiveCases.length}`);
}
for (const c of effectiveCases) {
  if (c.property !== 'bestHands') {
    throw new Error(`unexpected property "${c.property}" in case ${c.uuid}`);
  }
}

describe('bestHands — Exercism poker canonical data', () => {
  for (const c of effectiveCases) {
    it(c.description, () => {
      expect(bestHands(c.input.hands)).toEqual(c.expected);
    });
  }
});
