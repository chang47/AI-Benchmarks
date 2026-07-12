Build a standard 9x9 Sudoku library in plain modern JavaScript.

Create a single ES module file `src/sudoku.mjs` with no npm dependencies, no I/O, no side effects on import, and no console output, exporting exactly these three named functions:

1. `solve(grid)` — returns a NEW 9x9 nested array of integers 1-9 that solves the puzzle, or `null` if the input is not a valid board or has no solution. Any one solution is acceptable when several exist. Must not mutate the input.
2. `validate(grid)` — returns `{valid: boolean, reason: string | null}`; `{valid: true, reason: null}` for a valid board, otherwise `valid: false` with a non-empty human-readable `reason`.
3. `countSolutions(grid, cap)` — returns the number of distinct solutions as an integer, stopping early and returning `cap` once `cap` solutions are found; `cap` defaults to 2. Returns 0 for an invalid board. Must not mutate the input.

Grid format: an array of exactly 9 rows, each an array of exactly 9 integers; `0` means empty, `1`-`9` are filled digits.

Rules and semantics:
- A solved grid has each row, each column, and each of the nine non-overlapping 3x3 boxes containing all digits 1-9 exactly once, and must agree with every filled cell of the input puzzle.
- A board is VALID when it is well-formed (correct shape; every cell an integer 0-9 — reject values like 10, -1, 3.5, "5", null, wrong row counts/lengths, non-arrays) AND consistent (no digit repeated within any row, column, or box among filled cells). Validity does NOT require solvability: a rule-abiding board with zero solutions still validates as true. `validate`'s reason string must indicate what is wrong (malformed shape/value, or a row/column/box conflict).
- `solve` and `countSolutions` treat malformed or inconsistent boards as unsolvable (`null` / `0`).
- Solving an already-complete valid grid returns that grid's values; solving an empty grid returns any valid solved grid.

Performance requirement: each call must finish in under 2 seconds on ordinary modern hardware (Node 18+), except that boards which are unsolvable in computationally deep ways get up to 60 seconds. Concretely, your solver will be run against famous hardest-class puzzles (Arto Inkala's "AI Escargot" `100007090030020008009600500005300900010080002600004000300000010040000007007000300` and his 2012 "world's hardest" `800000000003600000070090200050007000000045700000100030001000068008500010090000400`, both written here as 81-character row-major strings with 0 = empty) which must solve in under 2 seconds each, and against a consistent-but-unsolvable board (`000005080000601043000000000010500000000106000300000005530000061000000004000000000`) whose unsolvability must be proven in under 60 seconds. Naive brute-force search will not meet these bounds; use an efficient backtracking search (e.g. bitmask candidate tracking with a most-constrained-cell-first heuristic and/or constraint propagation).

Your implementation will also be checked on: multi-solution boards (e.g. `countSolutions` must return exactly 2 with cap 5 for a board that has exactly two solutions, and must respect the cap — an empty grid returns 2 at the default cap and 1 with cap 1), uniqueness proofs (`countSolutions` with cap 3 must return exactly 1 for proper puzzles), duplicate detection in all three unit kinds (row, column, and box — including a duplicate that shares only a box), and input non-mutation.

Write only the library module. Do not write tests, a CLI, or documentation files.
