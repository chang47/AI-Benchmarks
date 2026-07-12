# AI Benchmark — Run TODO (overnight 2026-07-11 → 2026-07-12)

Legend: `[x]` done · `[!]` failed / did not run · `[ ]` pending

## Run-level
- [x] Freeze commit before any implementation (`b17260b`, ported from the mislocated run — see README relocation note)
- [x] REPORT.md written
- [x] TODO.md reconciled to reality
- [x] Final results commit (candidate implementations + independent verification)
- [x] 03-sudoku re-run (research recovered from stray path → frozen → built → verified)
- [ ] Josh reviews

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
