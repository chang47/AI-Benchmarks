# VERIFY — 06-solar-system

## Round 0

Independent verifier (did not build the candidate). Harness: `verify/verify.mjs` (local
Playwright, Chrome channel, headless, `file://` load, 1280x800 viewport, ~13 s observed).
Raw data: `verify/round-0/results.json`; screenshots: `verify/round-0/shot-0s.png`,
`verify/round-0/shot-3s.png` (both visually inspected).

### Per-criterion results

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Zero console errors / uncaught exceptions over 10+ s | PASS | 0 console errors, 0 pageerrors across 13.2 s incl. resizes and a forced rAF stall |
| 2 | Animation auto-starts, no interaction | PASS | Mercury angle 0.750 → 4.863 rad over ~5.2 s with zero input events sent |
| 3 | Canvas visible at 1280x800, no scroll, system fits | PASS | canvas 1280x800 at (0,0); scrollSize == viewport; outermost orbit+disc 381 px ≤ half-min-dimension 400 px |
| 4 | `<title>` + dark space background | PASS | title "Animated Solar System"; body bg rgb(5,7,15); canvas corner pixel [5,7,15]; starfield visible in screenshots |
| 5 | Exactly Sun + 8 planets, exact names | PASS | hook order [Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune]; screenshots show all 9 labeled bodies, correct spelling, no Pluto |
| 6 | Sun centered, does not orbit | PASS | canvas-center pixel [255,215,94] (sun disc) at t≈6 s; center stays sun-colored across frames |
| 7 | Every body labeled; labels track within ~30 px | PASS | screenshots at 0 s and 3 s: each label sits directly under its disc, moves with it, white text with dark outline is readable |
| 8 | Planets are filled discs ≥ 2 px | PASS | min displayRadius 4 px; pixel probe at each of the 8 hook positions is clearly non-background (8/8) |
| 9 | Orbit radii strictly increasing, ≥ 10 px apart, not stacked at origin | PASS | radii 70.0 → 370.0 px, uniform min gap 42.9 px |
| 10 | Size order J>S>U>N>E>V>Ma>Me; Sun > Jupiter | PASS | 22>18>12.5>11>8>7>5>4; Uranus>Neptune trap avoided; measured Sun core ~33 px > Jupiter 22 px |
| 11 | Speed strictly decreasing outward; Mercury ≤ ~20 s; Neptune visibly moves | PASS | periods 8,13,18,26,42,58,76,95 s; Neptune moved 0.346 rad in 5.2 s |
| 12 | Time-based motion (not per-frame increment) | PASS | observed vs elapsed-time-predicted angle delta ≤ 0.001 rad for all 8 planets over 5.2 s; source drives angles from rAF timestamp |
| 13 | FPS readout visible and labeled | PASS | "FPS: 59.9" HUD at (10,10), 91×31 px, on-screen at all times |
| 14 | FPS from real rAF timing | PASS | independent in-page rAF measurement 59.9 fps vs page-reported 60.0 (within 0.2%); source = sliding 1 s timestamp window |
| 15 | One decimal; ≥ 4 refreshes/s; ≥ 2 distinct strings in 5 s | PASS | 10/10 samples match `FPS: d+.d`; 3 distinct values; 60 DOM text updates in 1 s |
| 16 | FPS plausible (>0, ≤250) | PASS | sampled range 47.0–60.0 |
| 17 | `window.solarSystem` hook: shape, per-frame update, orderings, fps = HUD pre-rounding | PASS | all fields correct types; 8 planets; all three orderings hold in the data; angles change every frame; hook fps 59.947 vs HUD 59.9 (diff 0.047 = rounding) |
| 18 | Background/refocus robustness | PASS | forced 2.5 s rAF stall: Mercury advanced 0.655 rad vs 2.523 rad un-clamped (no teleport); post-stall HUD 59.9/59.9/60.0/60.0 — no NaN/Infinity/≤0 |
| 19 | Resize throws no errors | PASS | 900x600 → 1500x950 → 1280x800: zero new errors, hook and HUD still live |

### Summary

- **passRate: 19/19 = 1.00**
- **Fake-convergence flag: NO** — builder's "BUILD r0: CLAIMED DONE=yes" is consistent with this independent result.
- **Verdict: PASS**

Notes: the first HUD sample after load read 47.0 (and the 0 s screenshot caught 16.6)
— a startup transient while the 1 s sliding window fills; both values are > 0 and ≤ 250,
so criterion 16 is unaffected. No feedback required.
