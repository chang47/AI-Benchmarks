# VERIFY — 03-sudoku

## Round 0

Independent verifier (did not build the candidate; did not read `src/tests/`).
Suite: `verify/tests/sudoku.test.mjs` (108 tests), run via `npx vitest run` from `verify/`.
Candidate imported directly from `../../src/sudoku.mjs`.

### Per-criterion results

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | validate accepts all 7 spec vectors + EASY solution | PASS | 8/8 boards returned `{valid: true, reason: null}`, including UNSOLVABLE_FAST/DEEP and TWO_SOLUTIONS |
| 2 | validate rejects malformed input | PASS | 15/15 malformed cases (non-array x4, 8/10 rows, string row, 8/10-cell rows, cells `10`, `-1`, `3.5`, `"5"`, `null`, `undefined`) all `valid:false` with non-empty string reason |
| 3 | validate detects row / column / box conflicts | PASS | All three conflict kinds caught, including box-only duplicate at r1c1/r2c2 (different row AND column) |
| 4 | solve returns exact stated solutions | PASS | EASY, ESCARGOT, HARDEST2012 each deep-equal the spec's unique solution; values are primitive integers in nested arrays |
| 5 | solve → null on malformed / inconsistent / unsolvable | PASS | null for all 15 malformed, 3 conflict boards, UNSOLVABLE_FAST, and UNSOLVABLE_DEEP |
| 6 | solve(EMPTY) solved grid; complete grid round-trips | PASS | EMPTY solution independently verified against the Sudoku rule (27 units); solve(EASY solution) returns same values in a NEW array (fresh references) |
| 7 | countSolutions = 1 for the three unique puzzles (cap 3) | PASS | 1 (not the cap) for EASY, ESCARGOT, HARDEST2012 |
| 8 | countSolutions = 0 where required | PASS | 0 for UNSOLVABLE_FAST, UNSOLVABLE_DEEP, all malformed, all inconsistent boards |
| 9 | cap semantics | PASS | TWO_SOLUTIONS cap 5 → exactly 2; EMPTY default cap → 2; EMPTY cap 1 → 1; solve(TWO_SOLUTIONS) is a valid solution agreeing with givens |
| 10 | no input mutation | PASS | solve + countSolutions over EASY/HARDEST2012/UNSOLVABLE_FAST/TWO_SOLUTIONS/EMPTY all deep-equal pre-call copies |
| 11 | time bounds (2 s general / 60 s deep) | PASS | All fast vectors < 2 s (typically <20 ms); solve(UNSOLVABLE_DEEP) 20.1 s, countSolutions(UNSOLVABLE_DEEP) 19.8 s — both well under 60 s |
| 12 | module hygiene | PASS | Exports exactly {solve, validate, countSolutions}; source has no console.* calls and no imports/require; fresh-process import prints nothing to stdout/stderr, exit 0 |

Research-derived extras: R3 16-clue board hits cap 2 (multi-solution as McGuire et al. guarantee); countSolutions(EMPTY, 3) returns 3 quickly (early stop) — both PASS.

### Summary

- Tests: **108 / 108 passed** → passRate = **1.00**
- Fake-convergence flag: **false** (builder claimed done; verifier verdict is pass)
- **Verdict: PASS**
