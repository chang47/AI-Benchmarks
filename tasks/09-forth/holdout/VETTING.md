# Holdout Vetting — Task 09 (Forth Mini-Interpreter)

## Canonical source

- **canonical-data.json** saved verbatim from:
  `https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/forth/canonical-data.json`
  (Exercism problem-specifications, `forth` exercise; fetched 2026-07-12 per research stage).

## Case counts

| Metric | Count |
|---|---:|
| Total cases in canonical-data.json | 55 |
| Translated into vitest tests | 55 |
| Excluded | 0 |

Sections: parsing and numbers (2), addition (4), subtraction (4), multiplication (4),
division (6), combined arithmetic (4), dup (3), drop (3), swap (4), over (4),
user-defined words (11), case-insensitivity (6).

## Translation rules applied (mechanical)

- Tests are **generated at runtime directly from `canonical-data.json`** (the test file walks
  the JSON), so test names are the canonical case `description` strings verbatim and inputs /
  expectations cannot drift from the source data.
- `property: "evaluate"` (54 cases): `evaluate(input.instructions)` asserted `toEqual(expected)`
  (final stack, bottom-first, per the contract in spec.md).
- Error cases (`expected: {"error": "..."}`, 15 of the 54): assert `evaluate` throws an
  `instanceof Error` whose `message` **exactly equals** the canonical error string (manual
  try/catch — vitest's `toThrowError(string)` is substring-based, which would be weaker than
  the pinned contract).
- `property: "evaluateBoth"` (1 case, `only defines locally`, scenario `local-scope`): translated
  per the research note pinned in RESEARCH.md — two **independent** `evaluate` calls in order,
  asserted against `expected[0]` / `expected[1]`. This is the mechanical reading of
  `instructionsFirst` / `instructionsSecond` given the spec's "every call to `evaluate` is
  independent" contract.
- No case was skipped, weakened, or adapted.

## Validation

- The suite was run against a **scratchpad-only reference implementation** (never placed in
  the task's `src/`): **55/55 pass**.
- Mutation check: breaking the reference (subtraction operand order reversed; divide-by-zero
  message changed to `"division by zero"`) produced **4 failures** — the suite detects both
  wrong Forth operand order and inexact error strings.

## Contract path

Tests import the candidate from `../../src/forth.mjs` (i.e. `tasks/09-forth/src/forth.mjs`),
export `evaluate`, per spec.md.
