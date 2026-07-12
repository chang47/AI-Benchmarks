# Spec: Sudoku Solver + Validator

## Purpose

Build a standard 9x9 Sudoku library that solves puzzles (including the hardest known benchmark puzzles), validates boards against the Sudoku rules, and reports whether a board has 0, 1, or 2+ solutions. It is a pure logic library: no I/O, no CLI, no dependencies beyond the Node.js standard runtime.

## Definitions

- **Grid encoding:** a grid is a 9x9 nested array of integers — an array of exactly 9 rows, each an array of exactly 9 integers, where `0` means an empty cell and `1`-`9` are filled digits. Grids in this spec are written as 81-character strings in row-major order (first 9 characters = row 1 left-to-right, etc.), `0` = empty; convert accordingly.
- **Sudoku rule:** a solved grid has every cell filled with digits 1-9 such that each of the 9 rows, each of the 9 columns, and each of the 9 non-overlapping 3x3 boxes (rows 1-3/4-6/7-9 crossed with columns 1-3/4-6/7-9) contains all digits 1 through 9 exactly once.
- **Well-formed:** the value passed is an array of 9 arrays of 9 elements, and every element is an integer between 0 and 9 inclusive (rejecting e.g. `10`, `-1`, `3.5`, `"5"`, `null`, `undefined`, missing rows, rows of the wrong length, or a non-array input).
- **Consistent:** among the *filled* cells (non-zero), no digit repeats within any row, column, or box.
- **Valid board:** well-formed AND consistent. Note: validity does NOT require the board to be solvable or to have a unique solution — a rule-abiding board with zero solutions is still valid.
- **Solution of a puzzle:** a solved grid (per the Sudoku rule) that agrees with every filled cell of the puzzle.

## Artifact contract (exact)

Create `src/sudoku.mjs` (an ES module) exporting exactly these three named functions:

1. `solve(grid)` — returns a **new** 9x9 nested array of integers 1-9 that is a solution of `grid`, or `null` if `grid` is not a valid board or has no solution. If the puzzle has multiple solutions, returning any one solution is acceptable. Must not mutate the input.
2. `validate(grid)` — returns `{valid: boolean, reason: string | null}`. For a valid board: `{valid: true, reason: null}`. Otherwise `valid` is `false` and `reason` is a non-empty human-readable string describing the first problem found (e.g. what is malformed, or which kind of conflict — row, column, or box — was detected).
3. `countSolutions(grid, cap)` — returns an integer: the number of distinct solutions of `grid`, but stop counting and return `cap` once `cap` solutions are found. `cap` defaults to `2` when omitted. Returns `0` if `grid` is not a valid board. Must not mutate the input.

## Test vectors (use these exact boards)

- **EASY** puzzle `003020600900305001001806400008102900700000008006708200002609500800203009005010300`, unique solution `483921657967345821251876493548132976729564138136798245372689514814253769695417382`.
- **ESCARGOT** ("AI Escargot", a famous hardest-class puzzle) `100007090030020008009600500005300900010080002600004000300000010040000007007000300`, unique solution `162857493534129678789643521475312986913586742628794135356478219241935867897261354`.
- **HARDEST2012** (the 2012 "world's hardest sudoku") `800000000003600000070090200050007000000045700000100030001000068008500010090000400`, unique solution `812753649943682175675491283154237896369845721287169534521974368438526917796318452`.
- **UNSOLVABLE_FAST** `120007090030020008009600500005300900010080002600004000300000010040000007007000300` — consistent givens, zero solutions.
- **UNSOLVABLE_DEEP** `000005080000601043000000000010500000000106000300000005530000061000000004000000000` — consistent givens, zero solutions; proving this is known to be computationally punishing for weak search (a naive solver takes many minutes).
- **TWO_SOLUTIONS** `162850403534120608789643521475312986913586742628794135356478219241935867897261354` — has exactly 2 solutions.
- **EMPTY** — all 81 cells `0`; has an astronomically large number of solutions.

## Acceptance criteria

1. `validate` returns `{valid: true, reason: null}` for every board listed in Test vectors (including the unsolvable and multi-solution ones — they break no row/column/box rule) and for any solved grid such as the EASY solution.
2. `validate` returns `valid: false` with a non-empty `reason` for malformed input, including at least: a non-array; an array of fewer or more than 9 rows; a row that is not an array of exactly 9 elements; any cell that is not an integer in 0-9 (test values such as `10`, `-1`, `3.5`, `"5"`, `null`).
3. `validate` returns `valid: false` with a non-empty `reason` when a digit repeats in a row, when a digit repeats in a column, and when a digit repeats in a 3x3 box (each of the three conflict kinds must be detected; a duplicate that shares only a box — different row, different column — must still be caught).
4. `solve(EASY)`, `solve(ESCARGOT)`, and `solve(HARDEST2012)` each return exactly the stated unique solution, as a 9x9 nested array of integers.
5. `solve` returns `null` for: any malformed input per criterion 2; any inconsistent board per criterion 3; `UNSOLVABLE_FAST`; and `UNSOLVABLE_DEEP`.
6. `solve(EMPTY)` returns some fully solved grid satisfying the Sudoku rule. `solve` applied to an already-complete valid grid returns that same grid's values.
7. `countSolutions` returns `1` for EASY, ESCARGOT, and HARDEST2012 (call with cap 3 or higher to prove uniqueness, i.e. the result is 1, not the cap).
8. `countSolutions` returns `0` for `UNSOLVABLE_FAST`, for `UNSOLVABLE_DEEP`, for malformed input, and for inconsistent boards.
9. `countSolutions(TWO_SOLUTIONS, 5)` returns exactly `2`; `countSolutions(EMPTY)` (no cap argument) returns `2` (the default cap); `countSolutions(EMPTY, 1)` returns `1`.
10. Neither `solve` nor `countSolutions` mutates its input grid (the input compares deep-equal to a pre-call copy afterwards).
11. **Time bounds** (per individual call, on ordinary modern hardware, Node 18+): every `solve` and `countSolutions` call over the listed vectors completes in **under 2 seconds**, EXCEPT calls on `UNSOLVABLE_DEEP`, which must complete in **under 60 seconds**. Meeting the `UNSOLVABLE_DEEP` bound requires an efficient search (e.g. bitmask candidate tracking with a most-constrained-cell heuristic and/or constraint propagation); naive brute force will fail it.
12. The module has no side effects on import, uses only standard JavaScript (no npm dependencies), and contains no `console.log` output.
