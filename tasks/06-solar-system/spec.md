# Spec — Animated Solar System with Labels and a Live FPS Counter

## Purpose

Build a self-contained animated 2D solar system that runs in a browser straight from disk:
the Sun at the center with all 8 planets orbiting it, each body labeled by name, and a live
FPS counter that updates continuously from real frame timing. Relative sizes, orbital radii,
and orbital speeds must be at least ordinally correct (Mercury fastest, Neptune slowest);
exact astronomical scale is NOT required.

## Artifact contract

- Deliverable: `src/index.html` — exactly ONE self-contained HTML file.
- Vanilla JavaScript + the HTML `<canvas>` 2D API for rendering. No frameworks, no
  libraries, no Three.js.
- Zero network dependencies: no CDN scripts, no external stylesheets/fonts/images, no
  fetch/XHR. The page must work opened directly via `file://` with no server.
- No `alert()`, `confirm()`, `prompt()`, or any other blocking dialog. No user interaction
  required to start or keep the animation running.

## Acceptance criteria

### A. Page load and rendering

1. Opening `src/index.html` in a modern desktop browser produces zero console errors and
   zero uncaught exceptions, both at load and while animating for at least 10 seconds.
2. The animation starts automatically on page load — no clicks, keypresses, or scrolling
   needed.
3. The canvas is visible within the initial viewport at a typical desktop window size
   (e.g. 1280×800) without scrolling; the full orbital system (outermost orbit included)
   fits inside the canvas.
4. The page has a `<title>` and a dark, space-like background so bodies and labels are
   legible.

### B. Bodies and labels

5. Exactly 9 celestial bodies are drawn: the Sun plus the 8 planets — Mercury, Venus,
   Earth, Mars, Jupiter, Saturn, Uranus, Neptune. No Pluto, no moons required.
6. The Sun is at the center of the orbital system and does not orbit.
7. Every body (Sun included) has a visible text label with its exact English name spelled
   as above. Each planet's label stays adjacent to its planet as it moves (within ~30 px of
   the planet's disc), remaining readable against the background.
8. Each planet is drawn as a filled disc (any distinct color scheme); the drawn radius of
   every planet is at least 2 px so all 8 are individually visible.

### C. Ordinal correctness (the science rules)

9.  Order from the Sun (innermost orbit to outermost) is exactly: Mercury, Venus, Earth,
    Mars, Jupiter, Saturn, Uranus, Neptune. All 8 orbit radii are strictly increasing and
    clearly distinct (no two orbits closer than 10 px); every planet moves along its own
    circular (or near-circular) path centered on the Sun. Planets must never all sit at
    the center — overlapping the Sun at the origin is an automatic fail.
10. Drawn SIZE ordering is strictly: Jupiter > Saturn > Uranus > Neptune > Earth > Venus >
    Mars > Mercury, and the Sun is drawn larger than Jupiter. (Trap to avoid: Uranus is
    larger than Neptune.) Exact proportionality is NOT required — only this strict ordering.
11. Orbital SPEED ordering is strictly: Mercury has the highest angular velocity and each
    successive planet outward is slower, Neptune slowest. Mercury must complete a visible
    full revolution in no more than ~20 seconds of wall-clock time so motion is obvious, and
    Neptune must still visibly move. Real-period ratios are NOT required — only strict
    monotonic ordering.
12. Motion is time-based: planet angles are computed from elapsed time (the
    `requestAnimationFrame` timestamp or `performance.now()`), NOT from a fixed per-frame
    increment, so orbital speed is the same on 60 Hz and 144 Hz displays.

### D. Live FPS counter

13. An FPS readout is visible on screen at all times (e.g. a corner HUD), clearly labeled
    (e.g. `FPS: 60.3`).
14. The FPS value is measured from real `requestAnimationFrame` frame timing — either a
    sliding ~1-second window of frame timestamps or frames-counted ÷ elapsed-time. A
    hardcoded constant, a random number, or a value not derived from actual frame callbacks
    fails this criterion.
15. The FPS value is displayed with exactly one decimal place and the displayed text is
    refreshed at least 4 times per second. While the animation runs, the displayed value
    must change over time: sampling the FPS text every 500 ms for 5 seconds must yield at
    least two distinct strings.
16. The displayed FPS is plausible: strictly greater than 0 and at most 250 on ordinary
    hardware.

### E. Machine-readable state hook (test surface)

17. The page exposes a global `window.solarSystem` object, updated every animation frame:
    - `window.solarSystem.fps` — the current measured FPS (Number, same value the HUD shows
      before rounding).
    - `window.solarSystem.planets` — an array of exactly 8 objects, in order from the Sun,
      each `{ name: string, orbitRadius: number, displayRadius: number, angle: number,
      periodSeconds: number }`, where `name` matches criterion 5's spelling, `orbitRadius`
      and `displayRadius` are the drawn pixel values, `angle` is the current orbital angle
      in radians (changing over time), and `periodSeconds` is the wall-clock seconds for
      one full revolution.
    - The orderings of criteria 9–11 must hold in this data: `orbitRadius` strictly
      increasing, `displayRadius` obeying the size ordering of criterion 10, and
      `periodSeconds` strictly increasing from Mercury to Neptune.

### F. Robustness edge cases

18. If the browser tab is backgrounded and re-focused (rAF pauses in background tabs), the
    animation resumes without planets teleporting wildly or the FPS readout showing `NaN`,
    `Infinity`, or a value ≤ 0 more than transiently (one displayed refresh interval).
19. Resizing the browser window must not throw errors. (Re-centering/rescaling on resize is
    nice-to-have, not required.)

## Out of scope

Moons, asteroid belt, rings, elliptical eccentricity, textures, zoom/pan/click
interactivity, sound, mobile layouts. None of these earn or lose points, provided they do
not break any criterion above.
