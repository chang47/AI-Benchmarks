# Frozen prompt — 06-solar-system

Create a single, completely self-contained HTML file (call it `index.html`) containing an
animated 2D solar system, using only vanilla JavaScript and the HTML canvas 2D API — no
frameworks, no libraries, no CDN or network resources of any kind. It must work when opened
directly from disk via `file://`, start animating immediately with no user interaction, and
produce zero console errors.

Requirements:

1. Draw the Sun at the center and exactly the 8 planets — Mercury, Venus, Earth, Mars,
   Jupiter, Saturn, Uranus, Neptune — each orbiting the Sun on its own distinct circular
   path, innermost to outermost in exactly that order. Use a dark space-like background and
   make sure the whole system fits on screen in a 1280×800 window without scrolling.
2. Label every body with its name (Sun included). Each planet's label must move with its
   planet and stay readable.
3. Relative scale must be ordinally correct (exact proportions are not required):
   - Drawn sizes: Sun > Jupiter > Saturn > Uranus > Neptune > Earth > Venus > Mars >
     Mercury (note: Uranus is larger than Neptune). Every planet at least 2 px radius.
   - Orbit radii strictly increasing from Mercury out to Neptune, visually distinct.
   - Orbital speeds strictly decreasing from Mercury (fastest) to Neptune (slowest).
     Mercury should complete a lap in ~20 seconds or less so motion is obvious, and Neptune
     should still visibly move.
4. Animate with `requestAnimationFrame`, computing each planet's angle from elapsed time
   (the rAF timestamp or `performance.now()`), not a fixed per-frame increment, so the
   speeds are identical on any monitor refresh rate.
5. Show a live FPS counter in a corner HUD, labeled (e.g. `FPS: 60.3`), with exactly one
   decimal place. Measure it from real frame timing (a sliding ~1-second window of rAF
   timestamps, or frames counted divided by elapsed time), refresh the displayed text at
   least 4 times per second, and never display 0, negative, NaN, or Infinity while running.
   Do not hardcode or fake the number.
6. Expose a global `window.solarSystem` object updated every frame for verification:
   - `fps`: the current measured FPS as a Number;
   - `planets`: an array of exactly 8 objects in order from the Sun, each
     `{ name, orbitRadius, displayRadius, angle, periodSeconds }` — `name` spelled as in
     requirement 1, `orbitRadius`/`displayRadius` the drawn pixel values, `angle` the
     current orbital angle in radians, `periodSeconds` the wall-clock seconds per full
     revolution. The strict orderings from requirement 3 must hold in this data.
7. Never call `alert()`, `confirm()`, or `prompt()`. Handle background-tab pauses
   gracefully (no NaN FPS or planet teleport-glitches on refocus), and window resizes must
   not throw.

Output the complete contents of `index.html` and nothing else.
