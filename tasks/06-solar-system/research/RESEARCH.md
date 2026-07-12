# Research — 06-solar-system (Animated solar system + labels + live FPS counter)

Stage 1 (researcher + spec author) of the Vetted Bench pipeline. Meta-rule: every
correctness requirement below traces to an external authority; none is invented here.

## Second-brain check

Grepped `C:/Users/iamjo/second-brain` for "solar" — 4 hits, all irrelevant to this task
(TAN/AVAV solar-sector option trades, one AI-intel video note). No prior vault context.

## Sources

1. **MakeUseOf — "I asked Claude, ChatGPT, and Gemini to build a simulation, and one winner was obvious"**
   https://www.makeuseof.com/claude-vs-chatgpt-vs-gemini-simulation-obvious-winner/
   The canonical community version of this prompt (one-shot, single self-contained file,
   browser-runnable, no backend). Judging criteria used: runs without errors; orbital
   mechanics / sizes / spacing plausible; visual clarity; completeness; polish; one-shot
   (no retries). Notable failure mode observed: ChatGPT's planets all stacked at the origin
   (unit mismatch) — i.e., *distinct, correctly-ordered orbits* is the first thing judges check.
2. **NASA Science — "Planet Sizes and Locations in Our Solar System"**
   https://science.nasa.gov/solar-system/planets/planet-sizes-and-locations-in-our-solar-system/
   Authoritative size ordering and diameters (km): Jupiter 142,984 > Saturn 120,536 >
   Uranus 51,118 > Neptune 49,528 > Earth 12,756 > Venus 12,104 > Mars 6,792 > Mercury 4,880.
3. **NASA Space Place — "How Long is a Year on Other Planets?"**
   https://spaceplace.nasa.gov/years-on-other-planets/en/
   Orbital periods (days): Mercury 88, Venus 225, Earth 365, Mars 687, Jupiter 4,333,
   Saturn 10,759, Uranus 30,687, Neptune 60,190.
4. **Wikipedia — "Solar System"**
   https://en.wikipedia.org/wiki/Solar_System
   Cross-check for order, periods, and semi-major axes (AU): Mercury 0.39, Venus 0.72,
   Earth 1.0, Mars 1.52, Jupiter 5.20, Saturn 9.54, Uranus 19.19, Neptune 30.07.
5. **MDN — `Window.requestAnimationFrame()`**
   https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
   Authority for what makes an animation (and FPS counter) genuinely *live*: rAF fires at
   the display refresh rate, callback receives a `DOMHighResTimeStamp`, and animations MUST
   progress from the timestamp (not per-frame increments) or they run faster on
   high-refresh-rate screens. rAF pauses in background tabs.
6. **Growing with the Web — "Fast and Simple JavaScript FPS Counter"**
   https://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
   Standard FPS-measurement technique: sliding 1-second window of rAF timestamps;
   `fps = timestamps in the last 1000 ms`. More stable than single-frame delta.
7. **NASA NSSDCA Planetary Fact Sheet** (redirects; data cross-checked via #2/#3/#4)
   https://nssdc.gsfc.nasa.gov/planetary/factsheet/
8. **JavaScript in Plain English — "How to Calculate FPS in the Canvas Using requestAnimationFrame"**
   https://javascript.plainenglish.io/how-to-calculate-frames-per-second-in-the-canvas-using-javascripts-requestanimationframe-function-9447eaeeef70
   Corroborates the accumulate-frames-per-elapsed-second alternative and the convention of
   refreshing the displayed number a few times per second for readability.

## Adopted correctness rules (with citations)

| # | Rule | Source |
|---|------|--------|
| R1 | Planet order from the Sun: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune. Exactly 8 planets (Pluto excluded). | NASA (#2), Wikipedia (#4) |
| R2 | Orbital SPEED ordering: angular velocity strictly decreases with distance — Mercury fastest, Neptune slowest, strictly monotonic across all 8 (periods 88 d → 60,190 d). | NASA Space Place (#3) |
| R3 | SIZE ordering: Jupiter > Saturn > Uranus > Neptune > Earth > Venus > Mars > Mercury. Watch the classic trap: **Uranus (51,118 km) is LARGER than Neptune (49,528 km)**. Sun larger than everything. | NASA (#2) |
| R4 | Orbital RADIUS ordering: strictly increasing in the R1 order (0.39 → 30.07 AU); every planet on its own distinct orbit centered on the Sun. The "all planets stacked at origin" failure is an automatic fail. | Wikipedia (#4), MakeUseOf (#1) |
| R5 | Animation must be driven by `requestAnimationFrame`, with motion computed from elapsed time (rAF timestamp or `performance.now()`), so speed is refresh-rate-independent. | MDN (#5) |
| R6 | A *live* FPS counter measures real frame timing from rAF callbacks (sliding 1-s window of timestamps, or frames ÷ elapsed time). A hardcoded "60", a `setInterval`-driven guess, or a number not derived from actual frame callbacks does not qualify. | Growing with the Web (#6), MDN (#5), #8 |
| R7 | Judging basics from the community version: page loads and runs with zero console errors, one-shot, fully self-contained (no backend, no external services/CDN). | MakeUseOf (#1) |

## Disagreements / conventions chosen explicitly

1. **True-to-scale vs ordinal scale.** The MakeUseOf prompt asks for "believable" sizes and
   spatial scale; true scale is unusable on one screen (Neptune's orbit is ~77× Mercury's;
   the Sun is ~109 Earth diameters). The Vetted Bench scope already resolves this: sizes,
   radii, and speeds must be **at least ordinally correct** — compressed/non-linear scaling
   is acceptable as long as every strict ordering (R2/R3/R4) holds. CHOSEN: ordinal, not
   proportional.
2. **FPS display precision.** Sources show both integer FPS and decimal FPS. An integer
   display pinned at a rock-steady 60 could legitimately not change between two reads,
   which would break the "FPS text changes between reads" check. CHOSEN: display FPS with
   exactly one decimal place (e.g. `60.3`), refreshed at least ~4×/second — decimal FPS
   from real frame timing essentially always fluctuates, making the liveness check robust.
3. **FPS computation method.** Sliding 1-s timestamp window (#6) vs accumulate-and-divide
   (#8). Both are accepted; the spec requires only that the number derive from real rAF
   frame timing over roughly the last second (R6). CHOSEN: either method.
4. **Labels on canvas vs DOM.** Canvas text is invisible to DOM-based graders. CHOSEN:
   rendering may be canvas (per the artifact contract), but the page must expose a small
   read-only machine-readable state hook (`window.solarSystem`, updated every frame) so
   speed ordering, radius ordering, and FPS liveness are objectively checkable — the
   FrontendBench-style pattern of prompt–test pairs needs a test surface
   (https://arxiv.org/html/2506.13832v1). Labels themselves must still be visually rendered
   next to each body.
5. **2D vs 3D.** The community version was free-form (models chose 3D/Three.js and it caused
   the worst failures — broken clicks, unit mismatch). The bench scope pins **vanilla JS +
   canvas, no network dependencies**, which excludes Three.js/CDNs; a 2D top-down orbit view
   satisfies every requirement. CHOSEN: 2D canvas, top-down.
6. **Elliptical vs circular orbits.** Real orbits are ellipses (Wikipedia), but eccentricity
   is visually negligible for most planets and adds no ordinal information. CHOSEN: circular
   orbits acceptable (ellipses allowed but not required).

## Judging-criteria digest (for the future grader, from #1 + bench design)

- Loads from `file://`, animates immediately, zero console errors, no user interaction needed.
- 9 labeled bodies (Sun + 8 planets), correct names/spelling.
- Distinct concentric orbits, ordinally correct radii/sizes/speeds (R2–R4).
- FPS text present, plausible (1–250), and changing across reads while animating.
- One-shot: first output is graded as-is.
