# Vetted Bench — Run Report

**Run date:** overnight 2026-07-11 → 2026-07-12
**Freeze commit:** `b17260b` — "freeze: research-outsourced specs for 6 tasks — committed before any implementation exists" (specs/prompts/research frozen BEFORE any builder ran)
**Pipeline:** research+spec → freeze → builder (self-checks, claims DONE) → **independent verifier** (own test suite, never reads builder tests) → verdict

## Results

| Task | Type | Rounds | Final passRate | Fake-convergence ever? | Verdict |
|---|---|---|---|---|---|
| 01-tennis-scorekeeper | A (logic) | 1 | 1.00 (53/53 engine + 10/10 UI) | No | **PASS** |
| 02-habit-streak | A (logic) | 1 | 1.00 (39/39) | No | **PASS** |
| 03-sudoku | — | 0 | — | — | **NOT RUN** — spec never frozen (missing from `b17260b`) |
| 04-bouncing-balls-polygon | B (visual) | 1 | 1.00 (16/16) | No | **PASS** |
| 05-svg-object | B (visual) | 1 | 1.00 (15/15) | No | **PASS** |
| 06-solar-system | B (visual) | 1 | 1.00 (19/19) | No | **PASS** |

**5/5 executed tasks passed independent verification on round 0. Zero fix-feedback rounds were needed.**

## Notable findings

### Fake-convergence moments: NONE

This is the headline number and it is a null result. In every executed task the builder wrote
`BUILD r0: CLAIMED DONE=yes` with self-checks, and the independent verifier — building its own
test suite from the frozen spec, explicitly NOT reading the builder's tests — confirmed the claim
on the first round. There was no case this run where the builder said "done" and the verifier
caught it lying. For the video: the interesting story here is the *inverse* event (below), where
the **verifier's first metric was wrong** and had to be adjudicated against the spec's own words.

### Near-misses and anomalies worth knowing about

1. **Verifier false-positive on task 04, criterion 9 (the one adjudication of the run).**
   The verifier's first-pass metric ("max continuous upward travel of any ball") flagged a 415.6px
   event vs the R=396px cap. That metric over-read the criterion: it compounded a free bounce with
   ball-ball boosts and rotating-wall carries (which criterion 6 *requires*), and included the
   not-yet-settled window the spec excludes. A targeted 180s probe measuring the criterion's actual
   words (free-flight rise per bounce, t>30s) gave max 141.8px — zero exceedances across 7,781
   bounce segments. Adjudicated PASS; raw first-pass number preserved in
   `tasks/04-bouncing-balls-polygon/verify/round-0/results.json`. Lesson: verifiers can be
   over-strict, not just builders over-generous — the spec text is the arbiter.

2. **03-sudoku never made it into the freeze.** The research stage produced 5 of 6 task folders;
   the freeze commit message says "6 tasks" but contains only 5. No spec, no build, no verdict.
   Needs a re-run of the research stage for that slug before it can enter the bench.

3. **Orchestrator bug: BASE arrived as the literal string `"undefined"`.** Every stage of every
   task had to resolve the base path itself (all resolved consistently to
   `C:/Users/iamjo/Projects/vetted-bench`, so no data was misplaced — but several STATUS lines and
   this run's wrap-up brief carry `undefined` where paths should be). Fix the workflow script's
   variable interpolation before the next run.

4. **Harness artifacts, not candidate defects (recorded for honesty):** task 01's only console
   entry was a `/favicon.ico` 404 from the verifier's own bare static server; task 06's first HUD
   FPS sample read 47.0 (and 16.6 in the 0s screenshot) — a startup transient while the 1s sliding
   window fills, within the criterion's plausibility bounds.

## Review guide for Josh

Per task: the spec is `tasks/<slug>/spec.md`, the verbatim prompt the builder got is
`frozen-prompt.md`, the per-criterion verdict table is `VERIFY.md`, and the three-line
research→build→verify history is `STATUS.md`. Everything below is under
`C:/Users/iamjo/Projects/ai-benchmark/` (relocated post-run — see the addendum at the bottom).

### 01-tennis-scorekeeper (logic — the flagship task)
- **Eyeball:** open `tasks/01-tennis-scorekeeper/src/index.html` from a local static server and
  click through a game to deuce/ad and a tiebreak; the UI freezes after match point and "New
  Match" resets.
- **Verifier evidence:** `tasks/01-tennis-scorekeeper/VERIFY.md` (27-criterion table);
  independent suite at `verify/tests/engine.test.mjs` (53 tests — deuce cycling, no-ad, uncapped
  tiebreak margin-2, super-TB recorded 1-0, purity, frozen-after-final); UI smoke
  `verify/ui-check.mjs`.
- **Spot-check the fun ones:** AC-8 (20 alternating post-deuce points never end a game),
  AC-22 (match tiebreak recorded as a 1-0 set).

### 02-habit-streak (logic — dates/timezone)
- **Eyeball:** `tasks/02-habit-streak/src/streaks.mjs` — pure function, no `new Date(` anywhere.
- **Verifier evidence:** `tasks/02-habit-streak/VERIFY.md`; suite `verify/tests/streaks.test.mjs`
  (39 tests) + `verify/tests/tz-runner.mjs`, which re-runs the module in subprocesses under
  `TZ=Pacific/Kiritimati` vs `TZ=America/Los_Angeles` and demands identical output.
- **Spot-check:** C19 (2000 is a leap year, 2100 is not — `"2100-02-29"` must throw), C9 (grace
  for today never chains across a gap).

### 04-bouncing-balls-polygon (visual — the KCORES heptagon)
- **Eyeball:** open `tasks/04-bouncing-balls-polygon/src/index.html` in a browser and just watch
  it for a minute — 20 numbered balls, spinning heptagon, nothing escapes.
- **Screenshots:** `verify/round-0/shot-0s.png` (center cluster), `shot-3s.png` (fallen),
  `shot-end.png` (after 5.25 min — still contained).
- **Verifier evidence:** `VERIFY.md` (16/16, every one of 18,842 frames checked for containment);
  read the **criterion 9 adjudication note** at the bottom — the most instructive verification
  moment of the run. Raw data: `verify/round-0/results.json`, `probe-c9.json`.

### 05-svg-object (visual — pelican on a bicycle)
- **Eyeball:** open `tasks/05-svg-object/src/object.svg` — does it read cold as a pelican riding
  a bicycle? (Pouch under the beak, legs on opposite sides of the frame, wing to handlebars.)
- **Screenshots:** `verify/round-0/shot-0s.png` / `shot-3s.png` (byte-identical — proves static).
- **Verifier evidence:** `VERIFY.md` (15/15 — geometry checks programmatic: equal wheels, frame
  lines terminating at both hubs, wheel bottoms on the ground line within 1px).

### 06-solar-system (visual — canvas animation)
- **Eyeball:** open `tasks/06-solar-system/src/index.html` — Sun centered, 8 labeled planets,
  live FPS HUD top-left ticking with one decimal.
- **Screenshots:** `verify/round-0/shot-0s.png` / `shot-3s.png` (labels track the discs).
- **Verifier evidence:** `VERIFY.md` (19/19); best checks to skim: #12 (motion is
  timestamp-driven — a forced 2.5s rAF stall does not teleport planets), #14 (HUD FPS matches an
  independent in-page rAF measurement within 0.2%), #17 (`window.solarSystem` hook orderings:
  size J>S>U>N>E>V>Ma>Me, periods strictly increasing outward).

### Run-level
- Freeze integrity: `git show --stat b17260b` — all specs/prompts/research predate any `src/`.
- The builders' own self-check harnesses live in each `tasks/<slug>/src/` (e.g.
  `selfcheck.mjs`, `longrun-probe.mjs`) — compare against the verifier's independent harnesses in
  `tasks/<slug>/verify/` to see the two-lane design working.
