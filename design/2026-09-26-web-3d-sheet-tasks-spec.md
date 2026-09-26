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

## Task 18 — "Wonders of the Universe": immersive scroll-story landing page (flagship)

**Theme (Josh, 2026-09-26).** The feeling Josh wants is "mystical, wonderful and pretty", like walking into a teamLab-style exhibit in Japan.
- **Inspiration for feel only:** leoparpeix.com's fluid motion, scroll effects and cursor effects. We don't copy its design, and there is no audio.
- **All visuals are generated in code:** canvas/WebGL particles and shaders, plus layered SVG. There are no image, video or font files, so it's one offline file with nothing to license.
- **What it tests:** generative art from code, scroll choreography, and performance with many animated scenes. This is where frontier models differ most.
- **Possible later variant (18b):** supply a NASA public-domain image pack in `inputs/`, to test layout and motion instead of generative art.

**Prompt, frozen.** One page, with **all copy provided verbatim** in the prompt (so content is checkable and 19a can reuse the page).

| # | `data-section` | Scene | Motion |
|---|---|---|---|
| 1 | `hero` | A swirling **spiral galaxy** of particles that reacts to the mouse; the title animates in on load | always animating |
| 2 | `meteors` | Night sky over a **mountain** silhouette with a **meteor shower** | always animating |
| 3 | `volcano` | A **volcano eruption scrubbed by scroll**: it erupts as you scroll down and rewinds as you scroll up. The section pins while it plays | scroll-scrubbed |
| 4 | `waterfall` | A **waterfall** falling into a **lush forest**; forest layers move at different speeds | parallax |
| 5 | `wonders` | A pinned **horizontal strip** of ≥5 wonder cards (e.g. aurora, nebula, coral reef, dunes, lightning), each with a small generated visual | pinned horizontal scroll |
| 6 | `ocean` | **Ocean waves** at sunset, plus a stat that counts up (e.g. "2 trillion galaxies") | animating + counter |
| 7 | `voices` | A quote **carousel**: prev/next, auto-advance, pause on hover | interaction |
| 8 | `join` | A "Get the wonder letter" **signup form** with inline validation (empty / invalid email → error; valid → success, no reload) | interaction |

**The page must also have:**
- **Magical cursor:** a custom glowing cursor that follows the mouse with a sparkle/stardust trail, and grows or changes when over clickable things. It is turned off on touch devices and under reduced motion (Josh: "the cursor effects too, it's really magical").
- **Sticky nav:** links smooth-scroll to sections; it collapses to a menu button under 768px.
- **Reveal-on-scroll text** in every section (fade + translate).
- **`prefers-reduced-motion`:** no scroll-driven or ambient motion, no custom cursor, and all content visible immediately.
- **Performance:** scenes pause their animation loops while off-screen.
- **Packaging:** one self-contained `src/index.html`, no network (no CDNs, web fonts or media files; libraries only if inlined), zero console errors.

**Test contract (in the prompt), the landing-page equivalent of `window.__voxel`:**
- `data-section="<id>"` on each section; `data-anim="<id>"` on each reveal element (fixed list); `data-cursor` on the custom cursor element.
- `window.__wonder = { progress(id) → 0..1, playing(id) → boolean }`:
  - `progress` = how far that section's scroll-driven animation has advanced (volcano, wonders strip);
  - `playing` = whether that scene's animation loop is currently running (galaxy, meteors, waterfall, ocean).

**Checklist (points):**

| Group | Pts | Criteria (each a true/false statement; bands where noted) |
|---|---|---|
| Loads clean | 6 | no console errors (2) · no network requests (2) · all 8 `data-section`s exist (2) |
| Content | 6 | every frozen copy string present (1 per 2 sections, 4) · every nav link lands on its section (2) |
| Scenes animate | 12 | galaxy, meteors, waterfall, ocean: each scene's canvas/SVG pixels change over 1 s while visible (2 each, 8) · galaxy responds to mouse movement: pixels near the cursor differ from a no-mouse run (2) · title animates on load (2) |
| Scroll choreography | 16 | volcano: `progress` rises with scroll (3) and falls back when scrolling up (2) · volcano section stays pinned while progress runs 0→1 (2) · wonders strip pins (2) and its cards move on X with scroll (2) · forest parallax: two forest layers move by different amounts over the same scroll (2) · each of 8 `data-anim` reveals changes opacity/transform between its before/after offsets (3 pts, banded: 8/8 → 3, ≥6 → 2, ≥4 → 1) |
| Cursor | 6 | custom cursor within 20px of the mouse after a move (2) · trail appears along the path (1) · cursor changes state over a link or button (1) · hidden or disabled under reduced motion (1) · no custom cursor on touch emulation (1) |
| Interaction | 10 | carousel next, prev, auto-advance within 8 s and hover-pause (1 each, 4) · empty submit error (2) · bad email error (1) · good email success, no reload (1) · mobile menu opens and closes at 375px (2) |
| Quality & performance | 14 | no horizontal overflow at 375 / 768 / 1440 (1 each) · axe serious+critical: 0 → 3, 1–2 → 2, 3–5 → 1 · CLS < 0.1 (1) · frame-time p95 during a scripted full-page scroll: ≤ 20 ms → 3, ≤ 33 ms → 2, ≤ 50 ms → 1 · off-screen scenes paused: `playing()` is false for ≥ 3 of the 4 ambient scenes when scrolled away (2) · reduced motion: `progress` and transforms static, all content visible (2) |
| Judge checklist | 8 | yes/no, majority of 3, blind, from fixed frames: hero reads as a spiral galaxy (1) · meteors streak over a recognizable mountain (1) · volcano visibly erupting at 80% progress and not at 0% (1) · waterfall reads as falling water (1) · ≥ 5 visually distinct wonders in the strip (1) · no overlapping or clipped text (1) · mobile layout readable (1) · overall palette coherent (night / cosmic theme holds across sections) (1) |

Total 78 points. Scripted = 70 (90%); judged = 8 (10%).

**Reference.** I build one reference page (its art can be plain; it exists to prove the probes) that scores ≥ 95% on the scripted groups. Mutation controls, each of which must drop only its own group:
- a frozen volcano (`progress` stuck);
- a broken pin;
- scenes that never pause;
- the cursor removed;
- no form validation;
- no reduced-motion handling;
- one console error.

**Expected spread.**
- Art quality (the judge questions): gorgeous galaxy vs a grey dot cloud.
- Keeping 5+ animated scenes smooth (frame-time bands and pausing off-screen).
- Getting the scroll-scrubbed volcano to rewind cleanly.
- The cursor trail without jank.

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
3. Task 19a: freeze screenshots + motion notes of a clone target. The 18 reference's art is plain, so the better target may be the best-scoring MODEL page from the 18 pilot (prettier, harder to clone). Decide after the 18 pilot.
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
