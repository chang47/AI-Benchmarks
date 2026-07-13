# AI Benchmark — Run TODO (overnight 2026-07-11 → 2026-07-12)

Legend: `[x]` done · `[!]` failed / did not run · `[ ]` pending

## Run-level
- [x] Freeze commit before any implementation (`b17260b`, ported from the mislocated run — see README relocation note)
- [x] REPORT.md written
- [x] TODO.md reconciled to reality
- [x] Final results commit (candidate implementations + independent verification)
- [x] 03-sudoku re-run (research recovered from stray path → frozen → built → verified)
- [x] Deep-research: community-vetted candidate task list → `research/candidate-tasks-report.md` (10-task shortlist + 2 upgrades to existing tasks)
- [ ] Josh reviews (existing 6 tasks + picks from the shortlist)

## 01-tennis-scorekeeper (type A, logic)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 27/27)
- [x] Verify r0 — PASS, passRate 1.00 (53/53 engine + 10/10 UI), fake-convergence: no

## 02-habit-streak (type A, logic)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 30/30)
- [x] Verify r0 — PASS, passRate 1.00 (39/39 incl. TZ-subprocess invariance), fake-convergence: no

## 03-sudoku (type A, logic)
- [x] Research + spec + frozen prompt + metadata (recovered — the agent wrote to a stray `undefined/` path due to the args bug, so it missed the freeze; frozen in its own pre-build commit)
- [x] Build r0 (builder claimed DONE, own tests passing)
- [x] Verify r0 — PASS, passRate 1.00 (108/108 incl. Inkala hard puzzles, deep-unsolvable ~20s < 60s bound, deadly-rectangle 2-solution board), fake-convergence: no

## 04-bouncing-balls-polygon (type B, visual)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 10/10)
- [x] Verify r0 — PASS, passRate 1.00 (16/16; criterion 9 adjudicated via free-flight probe), fake-convergence: no

## 05-svg-object (type B, visual)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks passed)
- [x] Verify r0 — PASS, passRate 1.00 (15/15), fake-convergence: no

## 06-solar-system (type B, visual)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 15/15)
- [x] Verify r0 — PASS, passRate 1.00 (19/19), fake-convergence: no

---

# Wave 2 (2026-07-12)

All stages (build AND verify) ran on **Opus**.

## Run-level
- [x] Freeze commit before any implementation (`04404e0`, 10 tasks — freeze check OK, 0 missing)
- [x] KCORES retrofit applied observe-only to Wave 1 task 04 (88/90; src/ untouched)
- [x] REPORT.md — Wave 2 section appended
- [x] TODO.md — Wave 2 section added, reality-matched
- [x] Final results commit (candidate implementations + independent verification)
- [ ] Josh reviews Wave 2 candidates (07–16)

## 07-bowling (type A, logic)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 30/30 own vitest + 4 pinned error strings)
- [x] Verify r0 — PASS, passRate 1.00 (31/31), tamper 4/4 sha256 match, fake-convergence: no

## 08-poker (type A, logic)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 37/37 own vitest + 10 edge cases)
- [x] Verify r0 — PASS, passRate 1.00 (37/37), tamper 4/4 sha256 match, fake-convergence: no

## 09-forth (type A, logic)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 45/45 own vitest)
- [x] Verify r0 — PASS, passRate 1.00 (55/55), tamper 4/4 sha256 match, fake-convergence: no

## 10-zebra-puzzle (type A, logic)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 7/7; genuine backtracking CSP + uniqueness throw)
- [x] Verify r0 — PASS, passRate 1.00 (2/2 + solver-structure anti-hardcode audit), tamper 4/4 sha256 match, fake-convergence: no

## 11-chess-movegen (type A, logic)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 54/54; initial perft d5=4865609, Kiwipete d4=4085603)
- [x] Verify r0 — PASS, passRate 1.00 (44/44, ~5s < 120s bound), tamper 5/5 sha256 match, fake-convergence: no

## 12-chess-webgame (type B, visual)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 40/40 + click-to-move, 0 console errors)
- [x] Verify r0 — PASS, passRate 1.00 (18/18; autochecks 49/50 + gates 4/4, R3 visual-only skip + criterion-2 resolved by screenshot; independent __chess Playwright pass all-true), tamper 3/3 sha256 match, fake-convergence: no

## 13-hn-clone (type B, visual)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 27/27)
- [x] Verify r0 — PASS, passRate 1.00 (16/16; harness scored 15/16, item-4 borderOk:false = wrong-element artifact resolved PASS by DOM read + screenshot), tamper 3/3 sha256 match, fake-convergence: no
- [ ] (non-scoring) prune extra src/ files (selfcheck.mjs, selfcheck.png) — single-file deliverable

## 14-wordle-clone (type B, visual)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 28/28, 0 console errors)
- [x] Verify r0 — PASS, passRate 1.00 (holdout 37/37 + independent 23/23 + screenshots), tamper 3/3 sha256 match, fake-convergence: no

## 15-minecraft-3d (type B, visual)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 26/26 SwiftShader, raw WebGL2 + __voxel hook, 0 console errors)
- [x] Verify r0 — PASS, passRate 1.00 (22/22; 21 auto-pass + R05 skip resolved via independent 32x32 full-world probe, blockCount 8616→8616), tamper 3/3 sha256 match, fake-convergence: no

## 16-budget-tracker (type B, visual)
- [x] Research + spec + frozen prompt + metadata
- [x] Build r0 (builder claimed DONE, self-checks 31/31, __budget hook + error contract + persistence)
- [x] Verify r0 — PASS, passRate 1.00 (holdout 35/35 + independent 30/30 + screenshots), tamper 4/4 sha256 match, fake-convergence: no
