# Holdout Rubric — Task 15 Minecraft-Style 3D Voxel Demo

Answer key for grading `src/index.html`. **22 items, equal weight (1 point each, 22 total).**
The 22 items map 1:1 onto the spec's 22 numbered acceptance criteria (A1–G22); no criterion is
split or merged, so the equal-weight scheme matches the spec's own enumeration. RESEARCH.md §5
(contamination is HIGH) is honored *structurally*: grading leans on the pinned `window.__voxel`
hook contract, the pinned angle/coordinate convention, and behavioral/pixel checks — surfaces a
memorized clone does not automatically satisfy — rather than on prose the model could recite.

**How to check** legend:
- `HOOK` — programmatic via `window.__voxel` (`blockCount/place/remove/player`).
- `PROBE` — programmatic reconstruction of the solid grid by non-destructive `remove()`→`place()`
  round-trips through the hook (restores every cell); reported by `autochecks.mjs`.
- `PIXEL` — programmatic: a Playwright canvas screenshot decoded in-page (`Image`+2D-canvas
  `getImageData`) and analysed for color/luminance/change. Robust vs WebGL draw-buffer clearing.
- `RAF` — programmatic: `requestAnimationFrame` is instrumented via an init-script; frame
  timestamps give the true render-loop cadence / FPS.
- `INPUT` — programmatic: Playwright real pointer-lock + real mouse/keyboard, plus synthetic
  `MouseEvent{movementX,movementY}`. All three were verified to work in headless Chrome for this
  task (pointer lock engages, `movementX/Y` propagate), so these are auto-checks, not JUDGE.
- `DOM` — programmatic via DOM text / geometry / computed style.
- `CONSOLE` / `NET` — Playwright console/pageerror/dialog/request listeners.
- `JUDGE` — human screenshot judgment; used only as the stated fallback when an auto-heuristic
  reports `skip`.

Scoring convention: `pass` = 1, `fail` = 0, `skip` = grade manually from a screenshot per the
JUDGE fallback and record pass/fail. `skip` is NEVER auto-awarded.

Every item's checker fails gracefully (reports `fail`, no throw) when `src/index.html` is absent
or the `window.__voxel` hook is missing, so the script reports all-fail with no candidate.

---

## A. Load and first render

1. **R01 — clean load + 10 s of running.** Zero `console.error` and zero uncaught `pageerror`
   from load through ≥ 10 s of idle running. CONSOLE (listeners active from before navigation;
   R01 reads the error count accumulated over the initial 10 s idle-monitor window).

2. **R02 — title, canvas in initial viewport, rAF loop.** `document.title` is non-empty; a
   `<canvas>` exists, is visible, has non-zero size, and its bounding box sits within the
   1280×800 viewport with no page scroll (`scrollX/Y ≈ 0`, canvas top ≥ 0, bottom ≤ ~viewport);
   the instrumented `requestAnimationFrame` callback count strictly increases across a ~1 s
   sample (render loop is live on rAF). DOM + RAF.

3. **R03 — terrain visible on load, not monochrome, sky + terrain both present.** Captured from
   the FIRST post-load frame, before any click/key/lock/hook-edit: no single quantized color
   covers > 90 % of the canvas, and ≥ 2 quantized colors each cover ≥ 5 % (background + terrain
   both on screen). PIXEL; on inability to locate/decode the canvas → `skip` → JUDGE.

4. **R04 — blocks read as 3D (shading and/or ≥ 2 block colors).** On the same first frame, the
   terrain (non-background) pixels span ≥ 3 distinct luminance/color levels (directional shading
   or multiple block colors) — a flat, single-shade silhouette scene has ~1 level and fails.
   PIXEL heuristic; on inconclusive spread → `skip` → JUDGE ("do top vs side faces differ?").

## B. World and terrain

5. **R05 — ≥ 16×16 solid-column footprint, every column solid (connected ground).** PROBE a
   20×20 area of columns centered on the player's column; the columns that contain a solid block
   form a bounding box ≥ 16 wide AND ≥ 16 deep with ≥ 95 % of the cells inside that box solid (a
   connected surface, not floating debris / gaps). PROBE; `blockCount()` is byte-for-byte
   restored afterward. (Necessary-and-strong: OOB/air columns return no surface.)

6. **R06 — procedural height variation ≥ 2.** From the per-column surface heights found in R05,
   `max(height) − min(height) ≥ 2` blocks. A perfectly flat slab yields 0 and fails. PROBE.

7. **R07 — y-up; player eye above the terrain surface.** `player().y` is finite and strictly
   above the top face of the highest solid block in the player's own column
   (`player().y > surfaceY(playerColumn)`), i.e. the camera sits above the ground with terrain
   below it (y is up). PROBE + HOOK. ("terrain in view" is covered visually by R03.)

## C. First-person controls

8. **R08 — click-to-lock + Escape releases + instructions before lock.** Before locking, a
   visible on-screen instruction referencing locking/movement is present (DOM text matches
   e.g. /click|lock|wasd|move|mouse/). A real click on the canvas triggers
   `Element.requestPointerLock` on the canvas (instrumented) and `document.pointerLockElement`
   becomes the canvas; pressing Escape returns `pointerLockElement` to null. DOM + INPUT; if the
   instruction text cannot be auto-located → that sub-part `skip` → JUDGE.

9. **R09 — mouse-look: movementX yaws, movementY pitches, pitch clamped ±π/2.** While locked,
   real mouse deltas (and synthetic `mousemove{movementX}`) change `player().yaw`; deltas with
   `movementY` change `player().pitch`; after blasting many large `movementY` deltas in each
   direction, `|player().pitch| ≤ π/2 + ε` (camera never flips). INPUT + HOOK.

10. **R10 — WASD moves relative to yaw; time-based; no NaN; no endless fall.** Keys sent as
    `KeyW/KeyA/KeyS/KeyD`. Holding W ~0.5 s moves the player ≥ 0.5 world units with horizontal
    displacement within 30° of the criterion-16 forward vector; S reverses it; A/D are roughly
    perpendicular (strafe). Position stays finite throughout, and after ~1 s of no input
    `player().y` remains finite and bounded (no endless fall). INPUT + HOOK.

## D. Block interaction

11. **R11 — crosshair fixed at exact screen center.** With pointer lock active, either a small
    visible DOM element is centered within a few px of the viewport center, OR a distinct
    high-contrast mark exists at the exact center of a 1:1 center screenshot (center pixels differ
    from the surrounding ring). DOM + PIXEL; if neither resolves → `skip` → JUDGE.

12. **R12 — center-ray voxel raycast, reach within [4, 12].** While locked, a solid target block
    placed (via the hook) along the reported forward vector with its near face ≈ 4 units from the
    camera IS removed by a left-click (center ray, not cursor → reach ≥ 4); a target whose near
    face is ≈ 12.5 units away is NOT removed by a left-click (reach ≤ 12). INPUT + HOOK; if lock
    or an air corridor cannot be established → `skip` → JUDGE from code/screenshot.

13. **R13 — left-click removes exactly the targeted block; scene updates ≤ 2 frames.** With a
    target block aimed at (center ray, locked), `button===0` click drops `blockCount()` by exactly
    1 and the center screenshot region changes within a couple of frames (no page navigation).
    INPUT + HOOK + PIXEL; if lock unavailable → `skip` → JUDGE (hook-side ±1 remove is still
    covered by R17).

14. **R14 — right-click places exactly one block on the targeted face; no overwrite; context menu
    suppressed.** `button===2` while aiming at a block raises `blockCount()` by exactly 1, into a
    cell that was air (never overwriting a solid). Independently, a `contextmenu` event dispatched
    on the canvas is `defaultPrevented` (browser menu suppressed). INPUT + HOOK + DOM; the
    place-on-face sub-part `skip` → JUDGE if lock unavailable, but the context-menu sub-part is
    always auto-checked.

## E. Test hook — `window.__voxel`

15. **R15 — hook exists and is functional without pointer lock.** Before any lock: `window.__voxel`
    exists; `blockCount()` returns a non-negative integer; `place(x,y,z)`/`remove(x,y,z)` return
    booleans (never throw); `player()` returns `{x,y,z,yaw,pitch}` all finite Numbers. HOOK.

16. **R16 — reported angle convention (yaw 0 → −Z; forward = (−sin yaw·cos pitch, sin pitch,
    −cos yaw·cos pitch)).** At two different yaw orientations, the W-forward displacement unit
    vector aligns (dot ≥ cos 25°) with the horizontal forward `(−sin yaw, −cos yaw)` computed from
    the reported yaw, confirming the yaw sign and yaw-0→−Z convention; `pitch` is finite and within
    ±π/2. INPUT + HOOK; the pitch-sign ("positive looks up") aspect is JUDGE-confirmable and noted
    (not machine-decidable headlessly).

17. **R17 — hook edits remesh the scene (place +1 / remove −1, pixels change ≤ 2 frames).** A
    `place()` into an air cell directly along the spawn forward vector raises `blockCount()` by
    exactly 1 and changes the center screenshot region within a couple of frames; the matching
    `remove()` lowers it by exactly 1 and changes pixels back. HOOK + PIXEL. Works without lock.

## F. HUD and performance

18. **R18 — live, labeled, real FPS counter (not hardcoded).** A visible HUD element shows text
    matching /fps/ with a number in (0, 250]; the displayed value correlates with the
    independently RAF-measured frame rate (displayed within 0.5×–1.6× of measured), proving it is
    derived from real timing rather than a hardcoded constant. DOM + RAF; if no numeric /fps/
    readout is locatable → `skip` → JUDGE.

19. **R19 — idle playable frame rate ≥ 30.** RAF-measured average FPS over a 5 s idle window
    ≥ 30. RAF; 25–30 (borderline / possible headless throttle) → `skip` → JUDGE; < 25 → fail.

20. **R20 — editing stays responsive.** 25 consecutive `place()` calls via the hook complete in
    < 2 s total with zero console errors, and RAF-measured average FPS over the following 5 s
    stays ≥ 30. HOOK + RAF + CONSOLE.

## G. Robustness

21. **R21 — invalid place/remove return false without throwing or corrupting state.** Far
    out-of-bounds coords, a `place()` into an occupied cell, a `remove()` of an air cell, and
    non-finite coords each return `false` (never throw), and `blockCount()` is unchanged across
    all of them. HOOK.

22. **R22 — resize + tab background/refocus stay alive; FPS recovers cleanly.** Changing the
    viewport size throws nothing, adds no console error, and the rAF loop keeps ticking
    afterward; backgrounding then refocusing the page (a second tab brought to front and back)
    adds no console error, and the FPS readout recovers to a finite value > 0 (no `NaN`/`Infinity`/
    ≤ 0 persisting). RAF + CONSOLE + DOM.

---

### Runner notes

- `cd holdout && npm install` once (installs playwright); then `node autochecks.mjs [../src/index.html]`
  (defaults to `../src/index.html`).
- Prints one JSON document: `{summary:{target,pass,fail,skip,total}, results:[{id,desc,status,detail}]}`,
  one result per rubric item, ids `R01`–`R22` matching the numbers above. Exit 0 if no fails, 1 if
  any fail, 2 if the harness itself could not run.
- The instrumented `requestAnimationFrame` + `requestPointerLock` wrappers are installed via an
  init-script *before* the candidate loads, so they observe the candidate's own loop and lock calls.
- Every `skip` MUST be graded manually per its JUDGE fallback — never auto-awarded.
- Expected reach band (R12), footprint math (R05/06/07), and the forward-vector formula (R16) were
  derived by the holdout author directly from spec.md §B/§C/§E and RESEARCH.md §3–§4; they do not
  depend on any candidate implementation.
