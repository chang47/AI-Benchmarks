# VERIFY — Task 15 Minecraft-Style 3D Voxel Demo

## Round 0

**Verifier:** independent (round 0). Did not build the candidate.
**Tamper check:** PASS — sha256 of `autochecks.mjs`, `rubric.md`, `package.json` all match `FREEZE_MANIFEST.json`.
**Candidate:** `src/index.html` (raw WebGL2 voxel world, 32×32×24, `window.__voxel` hook).

### Holdout autochecks (`node autochecks.mjs ../src/index.html`)
Result: **21 pass / 0 fail / 1 skip** (exit 0). Raw JSON saved to `verify/round-0/autochecks-output.json`.

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| R01 | Clean load + 10 s running, zero console errors | pass | 0 errors over the 10 s idle window |
| R02 | title, canvas in viewport, rAF loop live | pass | title present, canvas fills viewport, no scroll, rAF increments |
| R03 | Terrain on load, not monochrome, sky+terrain | pass | dominant color 36%, 4 colors ≥5% |
| R04 | Blocks read as 3D (shading / ≥2 colors) | pass | 6 luminance levels, 8 colors ≥1% |
| R05 | ≥16×16 solid connected footprint | **pass (resolved)** | holdout `skip` (probe window clipped by near-edge spawn z=29.5). Independent full-world probe: **32×32 = 1024 solid columns, 100% filled, blockCount restored 8616→8616** |
| R06 | Procedural height variation ≥2 | pass | height range 6 (min 4, max 10) |
| R07 | y-up, eye above surface | pass | player eye y=13 > surface top 6 |
| R08 | Click-to-lock + Escape + instructions | pass | click engaged pointer lock on canvas; instruction text present |
| R09 | Mouse-look yaw/pitch, pitch clamped ±π/2 | pass | yaw+pitch respond; pitch clamped [-1.55, 1.55] |
| R10 | WASD relative to yaw, no endless fall | pass | W 3.0u @0° off forward; S reverses; A/D strafe; y bounded |
| R11 | Crosshair at exact screen center | pass | DOM crosshair element centered on viewport |
| R12 | Center-ray raycast, reach [4,12] | pass | near target (~4) hit; far target (~12.5) missed |
| R13 | Left-click removes targeted block | pass | blockCount −1, correct cell, center pixels changed |
| R14 | Right-click places one block, no overwrite, ctx menu suppressed | pass | +1 into adjacent air; contextmenu preventDefault-ed |
| R15 | `window.__voxel` functional without lock | pass | blockCount/place/remove/player all well-typed, no throw |
| R16 | Angle convention (yaw0→−Z, forward formula) | pass | W-displacement aligns with reported-yaw forward at two orientations (dot 1.00, 1.00) |
| R17 | Hook edits remesh (+1/−1, pixels change) | pass | blockCount +1/−1; center pixel diff 36 |
| R18 | Live labeled real FPS counter | pass | HUD "FPS: 60" ≈ measured 60 |
| R19 | Idle FPS ≥30 | pass | idle 59.8 fps |
| R20 | 25 place() < 2 s, no errors, FPS sustained | pass | 25 places in <1 ms, 0 errors, post-edit 59.6 fps |
| R21 | Invalid place/remove return false, no corruption | pass | OOB/NaN/occupied/air all false, blockCount unchanged |
| R22 | Resize + background/refocus survive, FPS recovers | pass | no throw/error, rAF keeps ticking, post 31.5 fps |

### Independent verifier pass (own playwright script, chromium channel=chrome, file://)
- `verify/round-0/verify_pass.mjs` — full-world footprint probe + screenshots.
- Probe result: 1024 solid columns, bbox 32×32, filledFrac 1.0, blockCount round-trip clean (8616→8616), height range 6, player y=13.
- Screenshots `verify/round-0/shot-0s.png` and `shot-3s.png` (visually inspected):
  - Clear 3D voxel terrain with directional face shading (lighter top faces, darker side faces), blue sky + terrain both present.
  - Centered white crosshair, FPS HUD top-left (32 → 60 as the loop warms), full instruction bar at bottom ("Click to lock mouse • WASD to move • Left-click: remove block • Right-click: place block • Esc to release").
  - Observation (non-blocking): the terrain tint slowly cycles green→tan over ~3 s — a cosmetic animation, not a rubric item; R03/R04 grade the first frame (green grass + brown dirt/stone), which passes.

### Verdict
- **passRate = 22/22 = 1.0**
- **fakeConvergence = false** (builder claimed DONE=yes; verdict = pass).
- **VERDICT: PASS**
