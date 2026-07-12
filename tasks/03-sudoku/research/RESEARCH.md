# Research: Sudoku Solver + Validator (task 03-sudoku)

Stage 1 (researcher + spec author), overnight Vetted Bench run, 2026-07-12.
Meta-rule honored: every correctness requirement below traces to an external authority; nothing invented.
Second brain: grepped `C:/Users/iamjo/second-brain` for "sudoku" (case-insensitive) — zero hits. No internal context exists.

## Sources

1. **Wikipedia — Sudoku** — https://en.wikipedia.org/wiki/Sudoku
   Standard rules; "well-posed puzzle has a single solution"; fewest clues for a proper Sudoku is 17.
2. **Peter Norvig — "Solving Every Sudoku Puzzle"** — https://norvig.com/sudoku.html
   Canonical solver essay: constraint propagation + backtracking search (MRV heuristic). Reported times: 50/50 easy avg 0.01s; 95/95 hard avg 0.04s max 0.18s; 11/11 hardest avg 0.01s. Quote: "with less than 17 squares filled in or less than 8 different digits it is known that there will be duplicate solutions." Quote: "Puzzles that appear in books and newspapers always have one unique solution." Source of the verbatim no-solution board (the "1439 seconds" puzzle). Fetched raw (HTTPS) and the grid extracted verbatim from the `<pre>` block this session.
3. **SudokuWiki — Escargot** — https://www.sudokuwiki.org/Escargot
   AI Escargot (Arto Inkala, 2006) puzzle string, 23 givens.
4. **SudokuWiki — Arto Inkala Sudoku** — https://www.sudokuwiki.org/Arto_Inkala_Sudoku
   Arto Inkala 2012 "world's hardest" puzzle string.
5. **McGuire, Tugemann, Civario — "There is no 16-Clue Sudoku"** — https://arxiv.org/abs/1201.0749
   Proof (exhaustive search, 2012) that no 16-clue proper puzzle exists; minimum is 17. Also the source of the "unavoidable set" concept used to build the 2-solution board below.
6. **ABC News (2012) — "Can You Solve the Hardest-Ever Sudoku?"** — https://abcnews.com/blogs/headlines/2012/06/can-you-solve-the-hardest-ever-sudoku
   Press coverage of Inkala 2012: "it has only one solution."
7. **Neatorama — "The World's Hardest Sudoku"** (Telegraph-derived) — https://www.neatorama.com/2012/06/28/the-worlds-hardest-sudoku/
   Published full solution grid for Inkala 2012 (812753649 943682175 ...).
8. **dailysudoku.com forum — "AI Escargot (revisited)"** — https://dailysudoku.com/sudoku/forums/viewtopic.php?p=28825
   Community-published AI Escargot solution grid (162857493 534129678 ...), corroborated by search results incl. the Hindawi hybrid-tabu paper instance (https://www.hindawi.com/journals/cin/2015/286354/).

## Adopted correctness rules (each with citation)

| # | Rule | Authority |
|---|---|---|
| R1 | A solution fills the 9x9 grid so each row, each column, and each of the nine 3x3 boxes contains all digits 1-9 (hence no duplicates anywhere). | Wikipedia [1] |
| R2 | A *proper* (well-posed) puzzle has exactly one solution; multi-solution and zero-solution boards exist and must be distinguishable. | Wikipedia [1], Norvig [2] |
| R3 | Any grid with fewer than 17 clues (or fewer than 8 distinct digits among clues) necessarily has multiple solutions — 17 is the proven minimum. | McGuire et al. [5], Norvig [2], Wikipedia [1] |
| R4 | A board whose givens already violate R1 (duplicate in a row/column/box) is invalid — it can never be part of a proper puzzle. | Direct consequence of R1 [1] |
| R5 | Solver approach: constraint propagation + backtracking search is the accepted standard and solves the hardest known puzzles in hundredths of a second (2008-era Python). | Norvig [2] |
| R6 | Time bound: "hardest" benchmark puzzles must solve well under a few seconds. Norvig reports max 0.18s across all suites; we adopt a generous 2 s/puzzle bound in modern Node. | Norvig [2] |
| R7 | Deleting an "unavoidable set" (e.g., a 4-cell deadly rectangle: 2 rows x 2 cols x 2 boxes with crossed value pair) from a completed grid yields a multi-solution board. | McGuire et al. [5] (unavoidable sets) |

## Verified test vectors (all 81-char strings, row-major, 0 = empty)

Every vector below was **computationally cross-checked this session** (scratchpad backtracking counters, naive-MRV and bitmask-MRV): each solution is a complete valid grid per R1, matches its puzzle's givens, and the solution count is as stated. Timings are from the bitmask counter on this machine (Node, Windows 11) unless noted.

### V0 — Easy happy-path puzzle (Norvig's grid1) [2], verified unique
Puzzle (extracted verbatim from the raw essay HTML this session):
`003020600900305001001806400008102900700000008006708200002609500800203009005010300`
Solution (derived mechanically from the puzzle; uniqueness proven, count capped at 3 -> 1):
`483921657967345821251876493548132976729564138136798245372689514814253769695417382`

### V1 — AI Escargot (Arto Inkala 2006), 23 givens, verified unique (count capped at 3 -> 1, 26 ms)
Puzzle [3]:
`100007090030020008009600500005300900010080002600004000300000010040000007007000300`
Solution [8]:
`162857493534129678789643521475312986913586742628794135356478219241935867897261354`

### V2 — Arto Inkala 2012 "world's hardest", 21 givens, verified unique (count capped at 3 -> 1, 138 ms)
Puzzle [4]:
`800000000003600000070090200050007000000045700000100030001000068008500010090000400`
Solution [7]:
`812753649943682175675491283154237896369845721287169534521974368438526917796318452`
**Source disagreement noted:** press coverage [6] says "23 of the 81 boxes filled"; the actual grid published by SudokuWiki [4] has **21** givens (counted this session). We adopt the grid itself as authoritative — the digits, not the journalism.

### V3 — Norvig's no-solution board (the "1439 seconds" puzzle) [2], extracted verbatim from the essay's `<pre>` block
`.....5.8....6.1.43..........1.5........1.6...3.......553.....61........4.........`
As 0-form:
`000005080000601043000000000010500000000106000300000005530000061000000004000000000`
**Verified: 0 solutions.** Timing calibration (key spec input): naive MRV counter (candidate lists recomputed per node) = **419 s**; bitmask MRV counter = **21.1 s**; Norvig's own solver (2006 Python) = 1439 s. Proving unsolvability on this board legitimately punishes weak implementations — the spec therefore gives it a separate 60 s bound instead of the general 2 s bound.

### V3b — Fast-refuting unsolvable board (constructed, verified)
`120007090030020008009600500005300900010080002600004000300000010040000007007000300`
= V1 with one extra given r1c2=2. The extra given is pairwise-consistent (no duplicate in its row/column/box — verified) but contradicts V1's unique solution (r1c2 must be 6), so 0 solutions. **Verified: consistent givens, 0 solutions, refuted in 2 ms.** This is the vector for "solve returns null fast on a consistent but unsolvable board"; it also pins R2/R4's distinction: this board VALIDATES as true (no rule violation) yet has no solution.

### V4 — Multi-solution board A: the empty grid
All 81 cells 0. Guaranteed multiple solutions by R3 (0 clues < 17). **Verified: countSolutions(empty, cap 2) = 2** (<1 ms).

### V5 — Multi-solution board B: exactly-2-solution board (deadly rectangle)
`162850403534120608789643521475312986913586742628794135356478219241935867897261354`
Constructed per R7 by blanking the verified 4-cell unavoidable set {r1c6, r1c8, r2c6, r2c8} (crossed value pair 7/9, spanning exactly 2 boxes) from the V1 solution grid. **Verified: brute-force count with cap 5 = exactly 2.**

### Computational verification log (scratchpad runs, this session — all values read back from job output)
```
escargot givens count                          23
inkala12 givens count                          21
escargot solution complete+valid               true
escargot solution matches givens               true
inkala12 solution complete+valid               true
inkala12 solution matches givens               true
escargot countSolutions cap3 (want 1)          1   (26 ms)
inkala12 countSolutions cap3 (want 1)          1   (138 ms)
norvig impossible countSolutions (want 0)      0   (419328 ms naive / 21141 ms bitmask)
empty grid countSolutions cap2 (want 2)        2
deadly rect rows 1,2 cols 6,8 vals 7,9         count 2 -> V5 board emitted
fast-unsolvable V3b count (want 0)             0   (2 ms), 24 givens, consistent
norvig grid1 easy count (want 1)               1   -> V0 solution emitted
```
Doc-QA note (anti-fabrication log): an initial draft of this file briefly contained a mangled 84-char V1 puzzle string (transcription slip, caught same-session during doc QA and replaced with the string fetched from SudokuWiki; every string now present was mechanically re-verified above).

## Conventions chosen where sources vary

- **Empty-cell encoding:** sources use `.` or `0`; the bench artifact contract uses integer `0` (nested arrays of integers). Chosen to match the frozen contract; no authority conflict.
- **"Valid board" vs "proper puzzle":** validation checks *consistency* (no R1 violation among filled cells + well-formed shape). It does NOT require solvability or uniqueness — those are what `solve` and `countSolutions` report. This split follows the standard framing in [1]/[2]: rules violations vs. solution count are separate questions.
- **Clue-count claims:** grid digits outrank press prose (see V2 disagreement).
- **Time bound (two-tier, calibrated by measurement this session):** Norvig's numbers justify sub-second solves for solvable puzzles; we spec **2 s per call** for all vectors except V3, which gets **60 s** — measured: proving V3 unsolvable took 21 s even with a competent bitmask-MRV backtracker and 419 s with a naive one, so a uniform 2 s bound would demand propagation strength beyond the scoped task, while 60 s still fails naive implementations. This preserves the scope line "solve very hard puzzles within a reasonable time bound" without inventing an unattainable requirement.
