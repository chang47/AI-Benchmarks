# VERIFY — Bouncing Balls Inside a Spinning Heptagon

## Round 0

Independent verifier (did not build the candidate). Graded `src/index.html` as-is against the 16 numbered
acceptance criteria in `spec.md`, via a local Node+Playwright harness (`verify/check.mjs`, headless Chrome,
`file://` load, 1280x900). One full 314.9-sim-second (5.25 min) monitored run checking EVERY rendered frame
(18,842 frames) with an in-page rAF monitor; plus a 180s adjudication probe for criterion 9
(`verify/probe-c9.mjs`). Raw numbers: `verify/round-0/results.json`, `verify/round-0/probe-c9.json`.
Screenshots at ~0s / ~3s / ~315s: `verify/round-0/shot-{0s,3s,end}.png` — inspected visually.

| # | Criterion | Result | Evidence (one line) |
|---|---|---|---|
| 1 | Loads via file://, animates, zero console errors incl. after 5+ min | PASS | simT=314.9s, 18,848 frames, 0 console errors, 0 pageerrors, only network request = the document itself |
| 2 | Heptagon visibly rotates, 360deg/5s (+/-10%) | PASS | measured 72.07 deg/s over a 4s window; screenshots at 0s vs 3s show clearly different orientations |
| 3 | Exactly 20 balls, same radius, numbered 1-20 unique, 20 colors verbatim in order | PASS | count=20, numbers 1-20 unique, colors match spec list exactly (dupes preserved), shared radius 26.40px; numbers legible in screenshots |
| 4 | All balls drop from heptagon center at start | PASS | at t=0.00s max ball distance from center = 40.3px vs R=396px; 0s screenshot shows the tight center cluster, 3s shows them fallen |
| 5 | Gravity always screen-down, never rotates with heptagon | PASS | mean ball y (t>30s) = 662.3 vs center y 450.0 — balls pool below center for the whole run regardless of wall angle |
| 6 | Realistic bounce off ROTATING walls; moving wall imparts velocity | PASS | source applies wall-material velocity (omega x r) at the contact point (index.html line 109); pile is continuously stirred, max ball speed t>20s = 846px/s |
| 7 | Ball-ball collisions present | PASS | 17,101 of 18,842 frames had at least one ball-ball contact; balls visibly push apart from the initial cluster |
| 8 | Friction + spin; numbers rotate with spin | PASS | max ball spin t>20s = 23.85 rad/s; painted-number orientations advance between reads; KE damped 3.68M (drop) -> ~1.0M steady |
| 9 | Bounce bounded: typical bounce > 1 ball radius, never above circumradius | PASS (adjudicated) | free-flight bounce rise (the criterion's "impact bounce height"): max 141.8px << R=396px, 0 of 7,781 segments exceeded R, 560 exceeded one ball radius; see note below |
| 10 | Smooth ~60fps, no slow-motion/hyper-speed, stable timing | PASS | fps=60.1; sim-time/wall-time ratio 1.001; fixed-step accumulator with dt clamp in source for tab-blur recovery |
| 11 | CONTAINMENT: no ball ever escapes/tunnels, every frame | PASS | 0 of 18,842 monitored frames had any ball center on/outside the polygon; min center-to-wall distance 26.40px (= exactly r, the eroded-polygon clamp) over 5.25 min |
| 12 | Ball count stays exactly 20 forever | PASS | balls.length === 20 on all 18,842 frames |
| 13 | No persistent overlap after release | PASS | max overlap depth after t>10s = 2.25px (8.5% of r); longest consecutive run of >2px overlap = 1 frame; screenshots show clean piles |
| 14 | Corner safety: no ejection/energy gain at vertices | PASS | ~75 full revolutions of corner passes with zero escapes; late max speed 846px/s never exceeded the initial-drop max 880px/s |
| 15 | Long-run stability: energy never blows up; pile calms while walls stir | PASS | KE 10s-bucket maxima flat ~0.9-1.15M for minutes 1-5 after the 3.68M drop peak — bounded, non-growing, still stirred |
| 16 | Never scrolls, never blank, never stops animating | PASS | scroll overflow 0/0px (body overflow:hidden); frames still advancing at end (+91 in 1.5s); all three screenshots non-blank and correct |

**passRate: 16/16 = 1.00** (equal weights)

**Fake-convergence flag: false** — builder's STATUS line claimed DONE=yes and this verdict is pass.

**Verdict: PASS**

### Criterion 9 adjudication note (transparency)

The main harness's first-pass metric — "max continuous upward travel of any ball, window t>15s" — flagged one
415.6px event vs R=396px over 5.25 min. That metric over-reads the criterion: it compounds a bounce with
mid-air ball-ball boosts and with being carried upward by the rotating wall (which criterion 6 REQUIRES), and
its window included the not-yet-settled t=15-30s post-drop phase that the criterion's "after the initial drop
settles" clause excludes. A targeted 180s probe measuring the criterion's actual words — free-flight-only rise
per bounce, t>30s — gave max 141.8px (36% of R), zero exceedances of R across 7,781 bounce segments, and 560
bounces above one ball radius (restitution neither dead nor perpetual). Even the compound metric never exceeded
R in the settled window (max 357.8px). Criterion 9 is satisfied; the raw first-pass number is preserved in
`results.json` for the record.
