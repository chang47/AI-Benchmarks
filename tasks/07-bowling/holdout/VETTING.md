# Holdout Vetting — 07-bowling

Independent holdout author, Vetted Bench wave 2, 2026-07-12.
Inputs read: `spec.md`, `research/RESEARCH.md`, `holdout/canonical-data.json` — nothing else. The builder's `src/` was never read and never written.

## Canonical source

- **URL:** https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/bowling/canonical-data.json
  (per RESEARCH.md source [2]; `holdout/canonical-data.json` is the byte-verbatim copy saved by the researcher, translated here as-is.)

## Case counts

| Metric | Count |
|---|---|
| Total cases in canonical-data.json | **31** (21 `score`-property, 10 `roll`-property) |
| Translated | **31** |
| Excluded | **0** |

**Count discrepancy noted:** RESEARCH.md's holdout note says "30 cases: 17 score-property, 13 roll-property." Counting the actual file on disk gives 31 cases: 21 with `property: "score"` and 10 with `property: "roll"`. The file itself is authoritative; every one of its 31 cases is translated. No case was excluded or adapted.

## Translation method (mechanical)

Tests live in `tests/bowling.canonical.test.mjs`, which parses `../canonical-data.json` at run time and emits one `it()` per case — the test file cannot drift from the data. Per the canonical file's own comments:

1. Each element of `input.previousRolls` is passed through `roll()` one at a time; each is expected to succeed (any throw fails the test).
2. `property: "score"` — if `expected` is an integer, `expect(game.score()).toBe(expected)`; if `expected.error` is set, `score()` must throw an `Error` whose message equals the string **character-for-character**.
3. `property: "roll"` — `game.roll(input.roll)` must throw an `Error` whose `message` equals `expected.error` character-for-character (all current roll-cases are errors; a hypothetical non-error case would simply assert the roll succeeds).
4. Case `description` strings are preserved verbatim as test names (all 31 are distinct).

**Exact-match errors:** vitest's `toThrowError("...")` does substring matching, which would let a superstring message (e.g. `"Error: Pin count exceeds pins on the lane!"`) pass. The suite instead catches the throw and asserts `instanceof Error` plus strict `message` equality, since the four error strings are pinned verbatim in both the canonical data and spec.md.

## Contract

- Candidate imported from the spec's exact contract path: `import { Bowling } from "../../src/bowling.mjs"` (→ `tasks/07-bowling/src/bowling.mjs`).
- Runner: `npm test` (= `vitest run`) inside `holdout/`. ESM throughout (`"type": "module"`).

## Validation performed (outside the task folder)

A throwaway reference implementation was written in the session scratchpad (never inside the task folder) and the suite mirrored there:

- Reference implementation: **31/31 pass**.
- Mutation check (error message changed to a superstring of the pinned string): exactly the 6 `Pin count exceeds pins on the lane` cases **fail** — confirming the exact-match assertion bites.
