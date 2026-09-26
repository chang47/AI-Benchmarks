# New tasks: landing page, page clone, Three.js scene, spreadsheet (spec)

_Created 2026-09-26. Status: DRAFT for Josh. Source of the ideas: `research/landscape-2026-09/benchmark-landscape-memo.md` §3 (#1, #2, #3, #8)._

## Goal

Four tasks that frontier models **don't all get perfect**. They cover:
- web craft;
- visual fidelity;
- the non-game 3D equivalent of the voxel task;
- office work.

Each is scored as a **points checklist**: a list of named criteria, each worth fixed points, with the score = points earned / points possible. Partial credit comes only from having more criteria, or from fixed bands written down in advance. It never comes from a free-floating "quality" number.

Not trying to be airtight: gaming and cheating are acceptable for now. The goal is a useful spread, and a good video.

## Decisions (Josh, 2026-09-26)

- **Clone target:** two variants.
  - **19a** clones our own task-18 reference page (never seen by any model; ours to show).
  - **19b** clones a real public page (a contamination comparison).
- **Clone input:** ~10 screenshots at fixed scroll positions, plus hover/click states, plus short written motion notes.
- **Scoring:** a points checklist (Josh: "still a checklist of points and grading criteria; contain the subjectivity").
  - Every criterion is a concrete statement that is either true or false, e.g. "gallery stays pinned while its cards move".
  - Measured quantities (similarity, frame time, violations) are turned into points by **bands frozen in advance**, e.g. SSIM ≥ 0.90 → 2 pts, ≥ 0.75 → 1 pt, else 0.
  - Subjective items are split into small yes/no questions (see "Judge checklist") and judged by majority vote. There is no 1–10 taste score anywhere.

## Harness changes needed (shared by all four)

1. **Task inputs.** `tasks/<slug>/inputs/` is copied into the agent's workspace (screenshots, vendored three.js, starter workbooks). The prompt references `inputs/…`. Inputs are hash-frozen like the holdout.
2. **Points checklist.**
   - Each check carries `points` (and optional frozen `bands` for measured values).
   - `result.json` gets `pointsEarned` / `pointsPossible` and `score` (%); the scoreboard shows the % next to k/n.
   - The run page lists every criterion with the points it earned.
3. **A shared web-probe library** (`bench/grade/web/`), used by 18/19/20:
   - Playwright helpers: fixed viewport, fonts settled, scroll-to-%, sample computed styles, frame timing, reduced-motion emulation, console/network capture;
   - axe-core (accessibility);
   - SSIM/pixel diff (`ssim.js`/`pixelmatch`);
   - element-by-text lookup.
4. **Judge checklist mode.**
   - Subjective criteria are written as short yes/no questions answered from screenshots or scroll frames, e.g. "Is the headline readable over the hero background?", "Do the sections use consistent left alignment?".
   - Each is worth 1 point: blind, 3 votes, majority wins, a tie scores 0.
   - The judge never gives an overall rating.
5. **Probe validation by mutation.** For every task, deliberately broken copies of the reference (animation removed, pin broken, validation removed, wrong formula…) must each lower the matching check. This is how we know a probe measures what it claims.

Grading runs a real Chrome, so it grabs the mouse (pointer lock or focus). Run grading when Josh is away, or build `--hidden-desktop` later.

---

## Task 18 — scroll-driven portfolio landing page (flagship)

**Prompt, frozen.** A one-page portfolio for a fictional designer, with **all copy provided verbatim** in the prompt (so content can be checked and 19a can reuse it). It needs:

1. A hero with an animated canvas/WebGL background and a headline that animates in on load.
2. A sticky nav whose links smooth-scroll to sections; it collapses to a menu button under 768px.
3. Four content sections whose elements **reveal on scroll** (fade + translate).
4. A **pinned horizontal gallery**: the section pins for about 3 viewport heights while cards slide sideways.
5. An animated number counter that counts up when visible.
6. A testimonials carousel: prev/next buttons plus auto-advance, pausing on hover.
7. A contact form with inline validation (empty or invalid email → error message; valid → success message, no page reload).
8. `prefers-reduced-motion`: no scroll or reveal motion, and everything visible immediately.

It must be one self-contained `src/index.html` with no network: no CDNs or web fonts, and GSAP only if inlined. It must have zero console errors.

**Test contract (in the prompt).** Every animated element carries `data-anim="<id>"` from a fixed list, and sections carry `data-section="<id>"`. This is the landing-page equivalent of `window.__voxel`.

**Checklist (points):**

| Group | Pts | Criteria (each a true/false statement; bands where noted) |
|---|---|---|
| Loads clean | 6 | no console errors (2) · no network requests (2) · all 8 required `data-section`s exist (2) |
| Content | 6 | every frozen copy string present (1 per section, 5) · every nav link lands on its section (1) |
| Motion | 24 | each of the 8 `data-anim` reveals changes opacity/transform between its before/after scroll offsets (1 each, 8) · hero headline animates on load (2) · hero canvas pixels change over 1 s (2) · gallery stays pinned (top within 2px) across its range (3) · gallery cards move on X while pinned (3) · counter reaches its frozen target number (2) · reduced-motion: no transforms change on scroll (2) · reduced-motion: all content visible without scrolling triggers (2) |
| Interaction | 12 | carousel next (1) · prev (1) · auto-advances within 8 s (1) · pauses on hover (1) · empty submit shows an error (2) · bad email shows an error (2) · good email shows success, no reload (2) · mobile menu opens and closes at 375px (2) |
| Quality | 12 | no horizontal overflow at 375 (1) · 768 (1) · 1440 (1) · axe serious+critical: 0 → 3 pts, 1–2 → 2, 3–5 → 1, else 0 · CLS < 0.1 (2) · frame-time p95 during auto-scroll: ≤ 20 ms → 3, ≤ 33 ms → 2, ≤ 50 ms → 1 (bands) |
| Judge checklist | 6 | yes/no, majority of 3, from 6 scroll frames + 1 mobile frame: headline readable over the hero (1) · no overlapping or clipped text (1) · consistent alignment/spacing between sections (1) · gallery cards fully visible while sliding (1) · mobile layout is single-column and readable (1) · form fields and messages clearly labelled (1) |

Total 66 points. Scripted = 60 (91%); judged = 6 (9%).

**Reference.** I write one reference that scores ≥ 95% on the scripted groups. Mutation controls: no reveal animation, broken pin, no validation, no reduced-motion handling, a console error. Each must drop its own group.

**Expected spread.** Motion + quality is where models split: "pretty but static", "pretty but janky", pins that fight the scroll, broken reduced-motion.

---

## Task 19 — clone a page from screenshots (19a our page, 19b a real page)

**Prompt, frozen.** "Recreate this web page as one self-contained `src/index.html`."
- **Inputs:** `inputs/` holds ~10 PNGs at fixed scroll positions at 1440×900 (0%, 10% … 100%), plus 1–2 hover/click-state PNGs and one 390px mobile PNG.
- **Motion notes:** a short plain-English list, for example: "the gallery pins while its cards slide left; section headings fade up as they enter; the hero background drifts slowly".
- **No test contract.** The clone is graded by how it looks and behaves, not by hooks.

**Grading.** Load the reference and the clone at identical viewports and scroll offsets.

| Group | Pts | Criteria (bands frozen in advance) |
|---|---|---|
| Visual | 24 | per checkpoint (12 checkpoints: 10 scroll positions + hover/click state + mobile): SSIM ≥ 0.90 → 2, ≥ 0.75 → 1, else 0. A diff heatmap is saved for the report |
| Content | 10 | each of ~10 frozen key text blocks (headings, CTA, nav items) present in the clone (1 each) |
| Layout | 10 | each of those ~10 blocks within a frozen position tolerance: box IoU ≥ 0.5 against the reference (1 each) |
| Motion | 12 | each motion described in the notes reproduced: the element (found by text) changes opacity/transform/position between the same two scroll offsets (2 each, ~5 motions) · the pinned section stays pinned (2) |

The motion and layout gates stop a static screenshot-perfect shell from scoring well. A flat image of the page scores high on visual and near 0 on motion.

- **19a** = the task-18 reference page, frozen as images. No model has seen its code.
- **19b** = a real public page. Criteria:
  - permissively licensed source;
  - real scroll motion;
  - buildable without a framework;
  - captured once and frozen locally (HTML snapshot + screenshots).

  Candidates are to be researched and confirmed with Josh. It exists to show the contamination effect: do models do better on a page they may have seen?

**Expected spread.** Continuous by construction. Motion inferred from notes plus stills is where models will differ most.

---

## Task 20 — Three.js scene with a behaviour contract (the non-game 3D task)

- **Source:** 3–5 tasks from WorldCoder-Bench (best published 27.8%), if its license allows freezing tasks locally; otherwise a small set of our own in the same style.
- **Inputs:** a vendored `three.module.js` in `inputs/`, so nothing touches the network.
- **Contract:** the scene exposes `window.__3D_STATE__`, with fields defined per task.
- **Grading:**
  - Playwright drives the task's actions (click, key, wait) and compares state snapshots against the frozen expectations: 70%.
  - Canvas renders non-blank (1 pt) and animates (1 pt).
  - Frame rate ≥ 30 fps (1 pt).
  - A few yes/no judge questions per task (e.g. "are the objects visibly resting on each other?").
- **Example task style:** "boxes fall under gravity and stack; clicking spawns a new box at the cursor; pressing R resets". The state must show positions and velocities consistent with the physics.

---

## Task 21 — spreadsheet (office work, for diversity)

- **Source:** 3 tasks from SpreadsheetBench 2 (top published 34.8%) if its license allows; otherwise GDPval-style tasks we author with an answer workbook.
- **Inputs:** a starter `.xlsx` in `inputs/`; the prompt says what to compute or restructure.
- **Grading:**
  - Recalculate the output in headless LibreOffice (needs `soffice`; to confirm it's installed), then diff cells against the answer workbook: each target cell range correct (points per range).
  - Structure checks, 1 pt each: formulas where formulas were asked for (not hard-coded values); sheet names; no `#REF!`/`#VALUE!`.

---

## Build order

1. Harness items 1–3 (inputs, continuous score, web-probe lib).
2. Task 18: prompt + reference + probes + mutation controls.
3. Task 19a: freeze screenshots of the 18 reference + motion notes.
4. Tasks 19b / 20 / 21: license and source check first, then the same pattern.
5. Run the pilot grid on 18 and 19a first. They reuse the web-probe lib, and they're the ones Josh wants on camera.

Each task lands only when:
- its reference scores ≥ 95% on the scripted groups;
- every mutation control drops its group;
- `npm run check` is green.

## Open questions

- **19b:** which real page? I'll bring 3 license-checked candidates.
- **21:** is LibreOffice installed / OK to install? It's needed for honest recalculation.
- **Judge checklist:** 6 yes/no questions is about 9% of task 18. Keep, trim, or add questions? (LLM judges agree with humans only ~60% on web work, so keep the share small.)
