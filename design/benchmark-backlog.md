# Benchmark backlog — what we want to benchmark next

_Written 2026-09-26. Flagship already built: **task 18 "Wonders of the Universe"** (cinematic WebGL landing page; live at https://wonders-of-the-universe.iamjoshchang.workers.dev; grader next). These are the **four other ideas Josh wants to benchmark**, in build order. Full grading tables for 1–3 are in [`2026-09-26-web-3d-sheet-tasks-spec.md`](./2026-09-26-web-3d-sheet-tasks-spec.md). Idea sources: [`research/landscape-2026-09/benchmark-landscape-memo.md`](../research/landscape-2026-09/benchmark-landscape-memo.md)._

**Grading rule for all of them (Josh):** a **points checklist**.
- Every criterion is a true/false statement worth fixed points.
- Measured values (similarity, frame time, contrast…) map to points through **bands frozen in advance**.
- Subjectivity is **contained** in small yes/no judge questions (3 votes, majority wins). There is never a 1–10 taste score.
- Goal: tasks that frontier models **don't all get perfect**. Cheating or gaming the grader is acceptable for now.

---

## 1. Clone a page from screenshots — task 19 (two variants)
- **What the model gets:**
  - about 12 screenshots: 10 scroll positions plus a hover/click state and a mobile view;
  - **short written motion notes**, e.g. "the gallery pins while its cards slide left".
- **What it builds:** a working page that looks and moves like the original.
- **19a:** clone **our own task-18 page**. No model has seen its code, and it's ours to show on camera. It may be better to freeze the prettiest *model-built* page from the task-18 pilot instead: decide after that pilot.
- **19b:** clone a **real public page** (openly licensed, with real scroll motion). This is the contamination comparison: do models do better on a page they may have seen? The candidate isn't chosen yet; bring 3 license-checked options to Josh.
- **Grading (56 pts):**
  - visual: per-checkpoint SSIM bands (≥0.90 → 2, ≥0.75 → 1), with diff heatmaps saved for the video;
  - content: key text blocks present;
  - layout: box IoU ≥ 0.5;
  - motion: each described motion reproduced, and the pinned section stays pinned.
  - Motion and layout gates stop a static screenshot-perfect shell from scoring well.
- **Video angle:** "with vs without the motion notes" is a clean knob.

## 2. Three.js scene with a behaviour contract — task 20 (the game-equivalent)
- Josh: "three.js I imagine will be our game equivalent". It's non-game 3D with rules the grader can check.
- **Source:** 3–5 tasks in WorldCoder-Bench style (best published 27.8%) if its license allows freezing them locally; otherwise our own in the same style. Example: "boxes fall and stack; clicking spawns a box at the cursor; R resets".
- **Contract:** the scene exposes `window.__3D_STATE__`. The grader drives actions (click/key/wait) and compares state snapshots against frozen expectations (70%). Plus 1 pt each for renders non-blank, animates and ≥30 fps, plus a few yes/no judge questions.
- The vendored Three.js from task 18 (`inputs/vendor/three-r186.iife.js`) can be reused.

## 3. Spreadsheet / office work — task 21 (for diversity)
- Josh: "some spreadsheet work like you mention for diversity".
- **Source:** 3 tasks from SpreadsheetBench 2 (top published 34.8%) if its license allows; otherwise GDPval-style tasks we write with an answer workbook.
- **Inputs:** a starter `.xlsx`. The prompt says what to compute or restructure.
- **Grading:**
  - recalculate the output in headless LibreOffice, then points per correct target cell range;
  - 1 pt each for real formulas (not hard-coded values), sheet names, and no `#REF!`/`#VALUE!`.
- **Open:** LibreOffice (`soffice`) needs installing, so ask Josh.

## 4. Context flooding + harness comparison (an experiment on existing tasks)
- Josh's original ask: "what happens if we flood our context window". This connects to the channel thesis, *the harness outlives the model*.
- **Setup:**
  - pre-seed 0 / 32k / 128k tokens of near-miss distractors (e.g. a similar but different spec) into the agent's context before the frozen prompt, then plot pass rate or points vs flood size per model (Chroma "context rot" method);
  - add the `profile.contextPrefill` knob (it already exists in the profile schema but is ignored).
- **Harness arm:** the same model in Claude Code vs Codex vs pi (the adapters exist), plus clean vs Josh's full setup (`--profile josh`), reported as pass^k, tokens and wall-clock.
- **Tasks to run it on:** the ones that separate models: task 15/15b (Minecraft), task 18 (Wonders), and task 17 (budget dashboard).

---

### Also noted (not prioritised yet)
- **Impossible katas.** Flip one test in bowling/poker so it contradicts the spec; passing it means the model cheated. This revives the saturated logic tasks as an honesty test.
- **AlgoTune speedups** ("4.1× faster than SciPy"), **ALE-Bench heuristic contests** (percentile vs human contestants), **slide deck from a paper**, **CadQuery part from renders**, and **fresh repo work** (Terminal-Bench 2.1 + this month's SWE-rebench).
