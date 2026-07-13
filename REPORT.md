# Vetted Bench — Run Report

**Run date:** overnight 2026-07-11 → 2026-07-12
**Freeze commit:** `b17260b` — "freeze: research-outsourced specs for 6 tasks — committed before any implementation exists" (specs/prompts/research frozen BEFORE any builder ran)
**Pipeline:** research+spec → freeze → builder (self-checks, claims DONE) → **independent verifier** (own test suite, never reads builder tests) → verdict

## Results

| Task | Type | Rounds | Final passRate | Fake-convergence ever? | Verdict |
|---|---|---|---|---|---|
| 01-tennis-scorekeeper | A (logic) | 1 | 1.00 (53/53 engine + 10/10 UI) | No | **PASS** |
| 02-habit-streak | A (logic) | 1 | 1.00 (39/39) | No | **PASS** |
| 03-sudoku | A (logic) | 1 | 1.00 (108/108) | No | **PASS** (post-run re-run — see addendum) |
| 04-bouncing-balls-polygon | B (visual) | 1 | 1.00 (16/16) | No | **PASS** |
| 05-svg-object | B (visual) | 1 | 1.00 (15/15) | No | **PASS** |
| 06-solar-system | B (visual) | 1 | 1.00 (19/19) | No | **PASS** |

**6/6 tasks passed independent verification on round 0. Zero fix-feedback rounds were needed.**
(5 in the overnight run; 03-sudoku in a post-run re-run after its research was recovered — addendum below.)

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

---

## Post-run addendum (main thread, 2026-07-12)

1. **Relocation.** The orchestrator passed the base path as the literal string `"undefined"`
   (a Workflow-args serialization bug). Five tasks self-resolved into the `vetted-bench` folder;
   the run's two commits were made there. Both commits were ported here via
   `git format-patch`/`git am` (author timestamps preserved — the freeze-before-build ordering
   is verifiable in this repo's history) and `vetted-bench` was restored to its pre-run state
   (backup branch `overnight-run-mislocated` kept there until reviewed).
2. **03-sudoku recovered + re-run.** Its researcher wrote to a stray `undefined/` folder, so it
   missed the freeze. The research/spec were recovered intact, frozen in their own commit
   (before any sudoku implementation existed), then built + verified through the same
   blind-builder / independent-verifier pipeline with hardcoded paths: **PASS, 108/108
   independent tests, round 0, no fake convergence** — including the Inkala hard puzzles, a
   deep-unsolvable Norvig board (~20s, under the 60s bound), a deadly-rectangle 2-solution
   board, and the 16-clue multi-solution rule. Evidence: `tasks/03-sudoku/VERIFY.md`.
3. **Fake-convergence across the full suite: 0/6.** The builders' round-0 "done" claims all
   survived independent verification. Caveat for the video thesis: this run's builders had
   fix-round pressure and strong specs; the flagship video's raw-vs-loop comparison still needs
   the *raw* lane (frozen one-shot prompts are banked per task in `frozen-prompt.md`).

---

# Wave 2 (2026-07-12)

**Freeze commit:** `04404e0` (specs/prompts/research/holdouts frozen for all 10 tasks before any builder ran; freeze check: OK, 0 missing).
**Model:** **Opus was used for every stage — build AND verify — on all 10 tasks.**
**Pipeline (unchanged):** research+spec → freeze → blind builder (self-checks, claims DONE) → independent verifier (own suite / autochecks, tamper-checks the frozen holdout by SHA256, never trusts builder tests) → verdict.
Wave 2 adds 10 tasks (07–16) to the 6 from Wave 1, and a cross-benchmark **KCORES retrofit** applied observe-only to Wave 1's task 04.

## Results

| Task | Type | Source authority | Rounds | Final passRate | Fake-convergence ever? | Verdict |
|---|---|---|---|---|---|---|
| 07-bowling | A (logic) | Exercism canonical-data + aider polyglot | 1 | 1.00 (31/31) | No | **PASS** |
| 08-poker | A (logic) | Exercism canonical-data + aider polyglot | 1 | 1.00 (37/37) | No | **PASS** |
| 09-forth | A (logic) | Exercism canonical-data + aider polyglot | 1 | 1.00 (55/55) | No | **PASS** |
| 10-zebra-puzzle | A (logic) | Exercism canonical-data + aider polyglot | 1 | 1.00 (2/2 + solver-structure audit) | No | **PASS** |
| 11-chess-movegen | A (logic) | CPW Perft Results + FIDE E012023 | 1 | 1.00 (44/44) | No | **PASS** |
| 12-chess-webgame | B (visual) | WebDev Arena prompt + FIDE | 1 | 1.00 (18/18) | No | **PASS** |
| 13-hn-clone | B (visual) | WebDev Arena prompt + live HN ground truth | 1 | 1.00 (16/16) | No | **PASS** |
| 14-wordle-clone | B (visual) | AA MicroEvals prompt + NYT duplicate rules | 1 | 1.00 (37/37) | No | **PASS** |
| 15-minecraft-3d | B (visual) | AA MicroEvals prompt (WebGL2 voxel) | 1 | 1.00 (22/22) | No | **PASS** |
| 16-budget-tracker | B (visual) | AA MicroEvals prompt | 1 | 1.00 (35/35) | No | **PASS** |

**10/10 Wave 2 tasks passed independent verification on round 0. Zero fix-feedback rounds were needed.**
Every logic task's holdout was translated **mechanically** from the frozen canonical data; every visual task was corroborated by an **independent** Playwright pass (verifier's own script) plus screenshot review, on top of the frozen autochecks.

## Notable findings

### Fake-convergence moments: NONE (0/10 this wave, 0/16 across both waves)

Same null result as Wave 1: in every task the builder wrote `BUILD r0: CLAIMED DONE=yes` and the
independent verifier confirmed it on round 0. There was no case where the builder claimed done and
the verifier caught it lying — so there is no "concrete botched behavior" to report for Wave 2,
because none occurred. What *did* recur (and is the more interesting on-camera story) is the
**inverse event** — the verifier/harness being wrong and getting adjudicated against the spec's own
words or an independent probe. Every such moment:

1. **13-hn-clone, rubric item 4 — harness false-NEGATIVE (wrong-element artifact).** The frozen
   `autochecks.mjs` scored item 4 (logo mark with a 1px white border) as `borderOk:false` and flagged
   it `manualReview`. The failure was in the *harness*, not the candidate: its "leftmost 12–28px
   square" heuristic latched onto the wrapping `<td id="logo-cell">` (22×18px, no border) instead of
   the actual `<span class="logo-mark">` (18×18, `border 1px solid white`, white "Y" on orange).
   Confirmed by a direct DOM read + the top-bar screenshot (`shot-topbar.png`). Resolved **PASS** →
   16/16. Harness scored 15/16 automatically; the one gap was its own measurement error.
2. **15-minecraft-3d, criterion R05 — holdout SKIP resolved to pass.** The frozen probe for
   "≥16×16 solid connected footprint" clipped its window because the player spawns near the world
   edge (z=29.5), so it emitted `skip`. The verifier's independent full-world probe measured the
   real thing: **32×32 = 1024 solid connected columns, 100% filled, blockCount round-tripped
   8616→8616** after edits. Resolved to pass → 22/22.
3. **12-chess-webgame, criterion 2 (R3) — visual-only SKIP.** Autochecks ran 49/50 with the one
   skip being the visual half of criterion 2 (piece distinguishability/identifiability), which is
   not programmatically decidable. Resolved PASS from screenshots (`at-0s-initial.png`: 32 pieces
   drawn, white-vs-black distinguishable, every R/N/B/Q/K/P identifiable; a1 dark / h1 light).
   Gates 4/4 and the verifier's own `window.__chess`-driven Playwright pass returned all-true.
4. **10-zebra-puzzle — anti-hardcode adjudication (not an error, a judgment).** With only 2 canonical
   cases and a contamination-HIGH answer that is trivially memorizable, passRate alone is not
   evidence. The verifier separately audited `src/zebra.mjs` as a *genuine* backtracking CSP — 14
   explicit per-statement predicates, permutation all-diff, a uniqueness `throw`, and a derived
   (not baked-in) return path — before granting PASS.

### KCORES retrofit (cross-benchmark sanity check on Wave 1's task 04): **88/90**

The community **KCORES 90-point rubric** (18 categories × 5, from the KCORES LLM Arena
"ball bouncing inside spinning heptagon" README) was translated from its Python/tkinter framing to
our JS/canvas variant and applied **observe-only** to the UNCHANGED `tasks/04-bouncing-balls-polygon/src/index.html`
via a local Node+Playwright scorer (Chrome channel, `file://`, one 70-sim-second / 4,083-frame monitored run).

- **Score 88/90.** Every physics/containment/count/color/rotation category is 5/5 — including
  **containment (k14), KCORES's single most-failed criterion: 0 escapes over 4,083 frames.**
- The only sub-5 is **k15 visual-quality = 3/5, a by-design cap**: KCORES's top tier rewards a
  pseudo-3D render, while our `spec.md` deliberately mandates flat 2D, so those 2 points are forgone
  by design, not a defect. Corroborates the Wave 1 round-0 16/16 spec-acceptance PASS from an
  independent rubric.
- **Harness-honesty note (same discipline as the Wave 1 criterion-9 adjudication):** the first
  scorer pass mis-scored k9 friction 3/5 because of a bug in *its own* KE-damping metric (it compared
  a t=2s mid-drop snapshot to end-of-run KE). Per project rule — a surprising result is a debugging
  signal; suspect the harness, not the artifact — the *measurement* was fixed (true drop-peak 3.67M →
  settled-peak 1.06M), not the artifact, giving the correct **5/5**. The fix touched only the scorer.
- Deliverables: `tasks/04-bouncing-balls-polygon/verify/kcores-retrofit.md` (rubric table + citation +
  translation notes) and `verify/kcores-retrofit/{results.json, shot-0s-spawn.png, shot-3s-drop.png, shot-end.png}`.

### Contract deviations (recorded for honesty, non-scoring)

- **13-hn-clone** and **12-chess-webgame** carry builder self-check leftovers under `src/`
  (`selfcheck.mjs` / `selfcheck.png`) beyond the single-file `index.html` deliverable. The verifier
  noted this per the frozen rubric's contract preamble — it only zeroes a submission if `index.html`
  is *missing* (it is present, self-contained, and passes), so the score is unaffected. Recommend the
  builder prune the extras before these become episodes.

## Review guide for Josh (Wave 2 tasks)

Per task the layout mirrors Wave 1: spec `tasks/<slug>/spec.md`, verbatim builder prompt
`frozen-prompt.md`, per-criterion verdict `VERIFY.md`, three-line research→build→verify history
`STATUS.md`, and the SHA256-pinned frozen holdout under `holdout/FREEZE_MANIFEST.json`. All paths
below are under `C:/Users/iamjo/Projects/ai-benchmark/`.

### Logic tasks (07–11) — mechanically-translated frozen holdouts
- **07-bowling** — candidate `tasks/07-bowling/src/bowling.mjs`; holdout suite
  `tasks/07-bowling/holdout/tests/bowling.canonical.test.mjs` (31/31, `npx vitest run` from
  `holdout/`); verdict `tasks/07-bowling/VERIFY.md`. Spot-check: tenth-frame fill-ball state machine
  + the 4 exact-string error paths.
- **08-poker** — candidate `tasks/08-poker/src/poker.mjs` (`bestHands`); holdout
  `tasks/08-poker/holdout/tests/poker.test.mjs` (37/37); `tasks/08-poker/VERIFY.md`. Spot-check:
  group/kicker tiebreaks, exact-tie ordering, suits never break a tie.
- **09-forth** — candidate `tasks/09-forth/src/forth.mjs` (`evaluate`); holdout
  `tasks/09-forth/holdout/tests/forth.canonical.test.mjs` (55/55); `tasks/09-forth/VERIFY.md`.
  Spot-check: word redefinition / early-binding, case-insensitivity, local-scope `evaluateBoth`.
- **10-zebra-puzzle** — candidate `tasks/10-zebra-puzzle/src/zebra.mjs`; holdout
  `tasks/10-zebra-puzzle/holdout/tests/zebra.test.mjs` (2/2); `tasks/10-zebra-puzzle/VERIFY.md`
  carries the **solver-structure audit** (read this one — it's why 2 passing tests is still evidence).
- **11-chess-movegen** — candidate `tasks/11-chess-movegen/src/movegen.mjs` (`parseFen`/`moves`/`perft`);
  holdout `tasks/11-chess-movegen/holdout/tests/{perft-canonical,legality-fide}.test.mjs` (44/44, ~5s
  under the 120s bound); `tasks/11-chess-movegen/VERIFY.md`. Spot-check: initial perft d5 = 4,865,609
  and Kiwipete d4 = 4,085,603.

### Visual tasks (12–16) — autochecks + independent Playwright pass + screenshots
- **12-chess-webgame** — open `tasks/12-chess-webgame/src/index.html`; verdict
  `tasks/12-chess-webgame/VERIFY.md`; screenshots `verify/round-0/{at-0s-initial,select-e2,at-3s-foolsmate,check-indication}.png`;
  autochecks + `verify/round-0/verify_pass.mjs` (drives `window.__chess`). Eyeball: Fool's-mate locks
  the game and declares mate; a1 dark / h1 light.
- **13-hn-clone** — open `tasks/13-hn-clone/src/index.html`; verdict `tasks/13-hn-clone/VERIFY.md`
  (read the item-4 wrong-element adjudication); screenshots
  `verify/round-0/{shot-0s,shot-3s,shot-topbar}.png`; independent pass `verify/round-0/verify-pass.mjs`.
  Eyeball: #ff6600 bar, 30 stories, upvote +1 scoped and arrow disappears once.
- **14-wordle-clone** — open `tasks/14-wordle-clone/src/index.html`; verdict
  `tasks/14-wordle-clone/VERIFY.md`; screenshots `verify/round-0/{at-0s,at-3s}.png`; independent pass
  `verify/round-0/independent_verify.mjs` (23/23). Spot-check: all 6 duplicate-letter cases (CREPE/SPEED
  → S gray, P yellow, E green) + keyboard best-state precedence.
- **15-minecraft-3d** — open `tasks/15-minecraft-3d/src/index.html` (raw WebGL2, `window.__voxel` hook);
  verdict `tasks/15-minecraft-3d/VERIFY.md` (read the R05 full-world-probe resolution); screenshots
  `verify/round-0/{shot-0s,shot-3s}.png`; probe `verify/round-0/verify_pass.mjs`. Eyeball: 3D-shaded
  voxel terrain, pointer-lock look, WASD, place/remove, live FPS HUD.
- **16-budget-tracker** — open `tasks/16-budget-tracker/src/index.html` (`window.__budget` hook);
  verdict `tasks/16-budget-tracker/VERIFY.md`; screenshots `verify/round-0/{shot-0s,shot-3s}.png`;
  independent pass `verify/round-0/independent.mjs` (30/30). Spot-check: edit moves money between
  per-category totals, negative balance signed + distinctly colored, reload keeps stable ids.

### Run-level
- Freeze integrity: `git show --stat 04404e0` — all specs/prompts/research/holdouts predate any `src/`.
- Both lanes visible per task: builder self-checks live in `tasks/<slug>/src/` (e.g. `selfcheck.mjs`),
  the verifier's independent harnesses in `tasks/<slug>/verify/` — compare them to see the two-lane
  design working.
- KCORES cross-benchmark: `tasks/04-bouncing-balls-polygon/verify/kcores-retrofit.md` (88/90, observe-only).
