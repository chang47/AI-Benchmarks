# Spec — Minecraft-Style 3D Voxel Demo (First-Person, Place/Remove Blocks)

## Purpose

Build the community-canonical "Minecraft 3D clone" one-shot: a first-person 3D voxel
world running in the browser straight from disk. Procedurally generated ground terrain of
shaded/colored blocks, WASD movement + pointer-lock mouse-look, left-click removes the
targeted block, right-click places one on the targeted face, a center-screen crosshair,
and a live FPS counter. Canonical wording and feature set come from the Artificial
Analysis MicroEvals "Minecraft 3D" eval (see `research/RESEARCH.md`); this spec turns it
into objectively checkable criteria.

## Artifact contract

- Deliverable: `src/index.html` — ONE self-contained HTML file (HTML + CSS + JS inline).
- Must run opened directly via `file://` with NO network access of any kind: no CDN
  scripts, no external stylesheets/fonts/images, no fetch/XHR/WebSockets. The verifier
  runs offline.
- **Three.js policy (decided):** self-contained raw WebGL2 with no external libraries is
  the canon-faithful build and is strongly preferred (the canonical prompt forbids 3D/
  utility libraries). If Three.js is used anyway, it MUST be vendored at
  `src/vendor/three.min.js` and referenced relatively via a classic `<script>` tag —
  never a CDN URL. The vendored copy must be a UMD build (r160 or earlier; UMD builds
  were removed from three.js after r160), because ES-module imports of local files are
  CORS-blocked under `file://`. No other files are permitted.
- Rendering must use a WebGL2 context (`canvas.getContext('webgl2')` — Three.js r118+
  UMD satisfies this by default).
- No `alert()`, `confirm()`, `prompt()`, or other blocking dialogs. No build step.

## Acceptance criteria

### A. Load and first render

1. Opening `src/index.html` in a modern desktop browser (1280×800) yields zero console
   errors and zero uncaught exceptions at load and over at least 10 seconds of running.
2. The page has a `<title>`, the rendering canvas is visible in the initial viewport
   without scrolling, and the render loop runs on `requestAnimationFrame`.
3. Voxel terrain is visible immediately on load — before any click, key press, or
   pointer lock. The initial frame is not monochrome: no single color may cover more
   than 90% of the canvas, and both sky/background and terrain must be on screen.
4. Blocks read as 3D: top faces and side faces render with visibly different shades,
   colors, or textures (directional shading and/or ≥ 2 distinct block-type colors, e.g.
   grass top vs dirt side). A scene of flat, unshaded silhouettes fails.

### B. World and terrain

5. The world is a block grid with integer cells; 0/empty = air, solid otherwise. The
   ground footprint is at least 16×16 columns, and every column in the footprint has at
   least one solid block (a connected ground surface, not floating debris).
6. Terrain height is procedurally varied: across the footprint, (max column height −
   min column height) ≥ 2 blocks. A perfectly flat slab fails.
7. Coordinate convention: y is up; block (x,y,z) occupies world-space cube
   [x,x+1)×[y,y+1)×[z,z+1). The player spawns with the camera eye above the terrain
   surface and terrain in view.

### C. First-person controls

8. Clicking the canvas requests pointer lock on it (`document.pointerLockElement`
   becomes the canvas); Escape releases it. On-screen instructions (e.g. "Click to
   lock mouse, WASD to move") are visible before lock; they may hide during lock.
9. While locked, mouse movement drives the view: `movementX` yaws, `movementY` pitches.
   Synthetic `mousemove` events (dispatched on the canvas or `document`) with
   `movementX`/`movementY` set must rotate the camera. Pitch is clamped to ±π/2 — the
   camera can never flip upside down.
10. WASD moves the player horizontally relative to the current yaw: W forward,
    S backward, A strafe left, D strafe right. Keys are handled by `KeyboardEvent.code`
    (`KeyW` etc.) so synthetic key events work. Holding W for 0.5 s moves the player
    ≥ 0.5 world units, with horizontal displacement within 30° of the forward vector
    defined in criterion 16. Movement is time-based (frame-rate independent), position
    never becomes NaN/Infinity, and the player never falls endlessly out of the world.
    (Gravity/jumping/collision are optional; flying movement is acceptable.)

### D. Block interaction

11. A crosshair is fixed at the exact center of the screen (visible at minimum whenever
    pointer lock is active).
12. Targeting uses a voxel raycast from the camera position along the view direction
    (screen center) — never the mouse cursor position — with a reach of at least 4 and
    at most 12 blocks.
13. Left-click (`button === 0`) while locked and aiming at a block within reach removes
    exactly that block: `blockCount()` decreases by exactly 1 and the rendered scene
    updates within 2 frames (no page refresh).
14. Right-click (`button === 2`) places exactly one block in the empty cell adjacent to
    the targeted face: `blockCount()` increases by exactly 1. A placed block never
    overwrites an existing solid block. The browser context menu is suppressed on the
    canvas.

### E. Test hook — `window.__voxel` (required, extra members allowed)

15. `window.__voxel` exists after load and is fully functional WITHOUT pointer lock:
    - `blockCount()` → integer count of solid blocks currently in the world.
    - `place(x, y, z)` → places a solid block at integer block coords; returns `true` on
      success, `false` (never throws) when the cell is occupied or out of bounds.
    - `remove(x, y, z)` → clears the block at integer block coords; returns `true` on
      success, `false` (never throws) when the cell is already air or out of bounds.
    - `player()` → `{ x, y, z, yaw, pitch }`, all finite Numbers: camera eye position in
      world units and view angles in radians, live-updated as the player moves/looks.
16. Angle convention for `player()`: pitch 0 = level, positive pitch looks up; the
    camera forward vector is `(−sin(yaw)·cos(pitch), sin(pitch), −cos(yaw)·cos(pitch))`
    (yaw 0 faces −Z, right-handed y-up). Implementations may use any internal
    representation but must report in this convention.
17. Hook consistency with the render: a successful `place()` raises `blockCount()` by
    exactly 1, a successful `remove()` lowers it by exactly 1, and both visibly change
    the rendered scene when the affected cell is in view (same remesh path as mouse
    edits). A `place()` into the cell directly in front of the spawn camera must change
    rendered pixels within 2 frames.

### F. HUD and performance

18. A live FPS counter is visible at all times, clearly labeled (e.g. `FPS: 60`),
    measured from real `requestAnimationFrame` timing (sliding window or
    frames ÷ elapsed), refreshed at least once per second. Hardcoded or fabricated
    values fail. The displayed value stays > 0 and ≤ 250 while running.
19. Playable frame rate: with the world idle, average FPS over any 5-second window is
    ≥ 30 on ordinary desktop hardware.
20. Editing stays responsive: 25 consecutive `place()` calls via the hook complete in
    under 2 seconds total, produce no console errors, and average FPS over the following
    5 seconds remains ≥ 30.

### G. Robustness

21. Out-of-bounds or invalid `place()`/`remove()` calls (including far-outside coords)
    return `false` without throwing and without corrupting `blockCount()`.
22. Resizing the browser window does not throw and the scene keeps rendering (aspect
    correction is nice-to-have). Backgrounding and refocusing the tab does not crash the
    page or produce console errors; the FPS readout recovers without showing NaN,
    Infinity, or ≤ 0 more than transiently.

## Out of scope

Gravity/jumping/collision physics, inventory or hotbar block selection, multiple chunk
streaming / infinite terrain, saving, textures beyond simple shading, sound, mobile/touch
controls, multiplayer. None of these earn or lose points, provided they do not break any
criterion above (e.g. optional gravity must not drop the player through the world).
