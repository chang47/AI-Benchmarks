# KCORES Rubric Retrofit — Bouncing Balls Inside a Spinning Heptagon

**Observe-only.** This applies the community KCORES 90-point rubric to the EXISTING artifact
`src/index.html` as a cross-benchmark sanity check. Nothing in `src/`, `holdout/`, or `spec.md`
was modified regardless of score.

## Citation

Rubric source: KCORES LLM Arena — "ball bouncing inside spinning heptagon" benchmark README
(<https://github.com/KCORES/kcores-llm-arena/blob/main/benchmark-ball-bouncing-inside-spinning-heptagon/README.md>,
raw: `raw.githubusercontent.com/KCORES/kcores-llm-arena/main/benchmark-ball-bouncing-inside-spinning-heptagon/README.md`).
The KCORES scale is **18 categories × 5 pts = 90**, defined for a **Python/tkinter** deliverable.
Fetched 2026-07-12.

## Translation note (Python/tkinter → JS/canvas)

Our task is the same physics scene but the artifact contract is a single self-contained **HTML +
vanilla-JS + Canvas** file (`file://`, no libraries, no physics engine), not a Python/tkinter
program. Categories were translated 1:1 where an analog exists:

- **k1 single-file** — KCORES "one `.py`" → our "one `index.html`".
- **k2 library compliance** — KCORES "only tkinter/math/numpy/dataclasses/typing/sys, physics
  library = 0" → our spec's "no external libraries/frameworks, no physics engine, vanilla JS +
  Canvas, hand-rolled collision, no network requests." Same intent (self-contained, hand-rolled),
  so it transfers.
- **k15 visual quality** — KCORES top tier (5) rewards a **"近似3D" (3D-like)** render; "clear" = 3.
  Our spec **deliberately mandates a flat 2D design**, so the top 2 points are unreachable *by
  design*, not a defect. Scored at the KCORES "clear" tier = **3/5** (see cap note below).
- All other categories (ball count/size/numbers/colors/drop/collisions/friction/gravity/
  elasticity/number-rotation/overlap/containment/heptagon/rotation-speed/smoothness) transfer
  directly.

**No category is fully N/A** — every KCORES category has a JS/canvas analog that yields a 0-5
score, so **transferable-max = 90**.

## Method

Local Node + Playwright scorer `verify/kcores-retrofit.mjs` — Chromium **`channel:'chrome'`**
(bundled-chromium fallback), headless, `file://` load, 1280×900. One 70-sim-second monitored run
(4,083 rendered frames) with an in-page rAF monitor computing per-frame containment, ball-ball
contact, overlap depth, KE, spin, free-flight ascent, and mean-y; plus a 4s window for rotation
rate / fps / sim-speed. Static source facts (single-file, no external refs) read directly from
`index.html`. Screenshots at 0s / 3s / end in `verify/kcores-retrofit/`. Raw numbers:
`verify/kcores-retrofit/results.json`.

## Score table (0-5 each, with one-line evidence)

| # | KCORES category (translated) | Score | Transfers | Evidence |
|---|---|:--:|:--:|---|
| k1 | Single-file implementation | **5** | ✓ | one `src/index.html` (10,162 B); no external `<script src>` / `<link>` / `<img>` |
| k2 | Library / no-physics-engine compliance | **5** | ✓ | 0 off-document network requests; vanilla JS + Canvas, hand-rolled `resolveWall`/`resolvePairs`, no CDN/framework/physics lib |
| k3 | Ball count = 20 | **5** | ✓ | 20 balls at load and on all 4,083 monitored frames (bad-count frames = 0) |
| k4 | Uniform ball size | **5** | ✓ | single shared radius `r=26.40px` (one `RB` constant drives every ball) |
| k5 | Numbers 1-20, unique | **5** | ✓ | sorted numbers = 1..20, unique = true; count = 20 |
| k6 | Initial drop from center | **5** | ✓ | t=0.00s max spawn dist from center = 40.3px vs R=396px (tight central cluster) |
| k7 | Color palette (all 20 verbatim, in order) | **5** | ✓ | all 20 spec colors present in order, duplicates preserved = true |
| k8 | Collision physics (ball-ball AND ball-wall) | **5** | ✓ | ball-ball contact on 3,752/4,083 frames; ball-wall guard `(dist−r)` min = −0.00px (balls ride the wall) |
| k9 | Friction + rotation | **5** | ✓ | max \|spin\| (t>8s) = 21.3 rad/s; KE damps drop-peak 3.67M → settled-peak 1.06M |
| k10 | Gravity (down, screen-space) | **5** | ✓ | mean ball y (t>20s) = 661 vs center y 450 → pools below center; `G` applied +y only, never rotated |
| k11 | Elasticity / bounce bounded | **5** | ✓ | free-flight max rise 378px < R=396px; 638 rises > 1 radius, 0 exceeded R (e_wall=0.85, neither dead nor perpetual) |
| k12 | Numbers rotate with ball spin | **5** | ✓ | painted-number orientation advances over final 1.5s = true (`ctx.rotate(b.a)`) |
| k13 | No persistent overlap | **5** | ✓ | max overlap depth (t>10s) = 1.78px (3.4% of a diameter); longest >2px run = 0 frames |
| k14 | Boundary containment (never escapes) | **5** | ✓ | 0 of 4,083 frames had a center on/outside the polygon; min center-to-wall dist = 26.40px. KCORES #1 fail mode. |
| k15 | Visual rendering quality | **3** | ✓* | crisp flat 2D: filled heptagon w/ rounded stroke, per-ball dark outline, bold centered numbers scaled to radius, legible in screenshots. **Cap: KCORES 5-tier needs "3D-like" shading; our spec mandates flat design → top 2 pts forgone by design.** |
| k16 | Heptagon accuracy (7 equal sides, fits) | **5** | ✓ | 7 vertices; side lengths equal within 0.000%; all vertices inside 1280×900 viewport |
| k17 | Rotation speed 360°/5s about center | **5** | ✓ | measured 72.00 deg/s (target 72, within 0.0%); rotates about canvas center |
| k18 | Animation smoothness | **5** | ✓ | fps = 59.5; sim-time/wall-time ratio = 1.000; fixed-step accumulator, still animating at end |

\* k15 transfers but its 5-point tier is unreachable by design (flat-design spec).

## Result

**Score: 88 / 90** (transferable-max = 90; all 18 categories transfer, 0 N/A).

The only sub-5 is **k15 visual quality = 3/5**, and that is a **by-design ceiling**, not a defect:
the KCORES 5-point tier rewards a pseudo-3D render, while our `spec.md` deliberately specifies a
flat 2D aesthetic. Against the full KCORES 90 that flat-design choice costs exactly 2 points
(88/90). Every physics/containment/count/color/rotation category — including KCORES's single
most-failed criterion, **containment (k14)** — scores a clean 5/5. Clean execution guard passed
(canvas present, 0 console/page errors, frames advancing at end).

This corroborates the round-0 spec verdict (16/16 acceptance criteria PASS) from an independent
rubric. **Observe-only: no artifact changes made.**

### Methodology honesty note

The first scorer pass read **k9 friction = 3/5** because its KE-damping check compared a t=2s
snapshot (balls still mid-drop near center, low KE) against end-of-run KE — a bug in the
*measurement*, not the artifact (round-0 already established KE damps from the 3.67M drop peak to
~1M steady, with clear spin acquisition). Per project rule (a surprising result is a debugging
signal — suspect the harness, not silently penalize the artifact), the monitor was fixed to track
the true drop-peak KE vs a settled-window (t>40s) peak; friction then scored the correct **5/5**
(3.67M → 1.06M). The fix touched only `verify/kcores-retrofit.mjs`, never `src/`.
