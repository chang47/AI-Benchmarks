# Holdout Vetting — Task 10: Zebra Puzzle

Authored by the independent holdout author (never the builder). 2026-07-12.

## Canonical source

- **File:** `holdout/canonical-data.json` (saved byte-verbatim by the research stage)
- **URL:** https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/zebra-puzzle/canonical-data.json

## Case counts

| Metric | Count |
|---|---|
| Total canonical cases | 2 |
| Translated to vitest tests | 2 |
| Excluded | 0 |

## Translation notes

- Both cases translated mechanically in `tests/zebra.test.mjs`:
  - `description` → test name (verbatim: "resident who drinks water", "resident who owns zebra")
  - `property` → exported function called (`drinksWater`, `ownsZebra`) per spec.md §3.1 / RESEARCH.md convention 1 (canonical-data property names map 1:1 onto the named exports)
  - `input` is `{}` in both cases → functions called with no arguments
  - `expected` → `toBe(...)` string equality (`"Norwegian"`, `"Japanese"`)
- The canonical data specifies **no error cases**, so no thrown-Error tests exist here. (The spec's uniqueness-throw requirement, AC-6, and the anti-hardcode/perturbation requirements, AC-5/AC-7, are structural contracts checked by the verifier stage, not expressible as canonical-data translations — deliberately out of scope for this holdout.)
- Import path uses the spec contract path: `../../src/zebra.mjs` relative to `holdout/tests/`.
