# VERIFY — Task 13 "Hacker News clone"

## Round 0

**Role:** independent verifier (did not build). **Deliverable graded:** `src/index.html`.

### Step 0 — Tamper check (FREEZE_MANIFEST.json, sha256)
All three frozen files match — **no tampering**.

| File | Manifest sha256 | Recomputed | Match |
|---|---|---|---|
| autochecks.mjs | bd7fc87e…b4b7600 | bd7fc87e…b4b7600 | yes |
| rubric.md | e04b7a47…960ce78c | e04b7a47…960ce78c | yes |
| package.json | 3346d1fc…d6e3e091a | 3346d1fc…d6e3e091a | yes |

### Step 1 — Grading (16 items, equal weight)

Note: rubric.md states the spec defines **no `window.__*` test hook**, so all checks are DOM /
computed-style / console / network based (via `holdout/autochecks.mjs` + an independent Playwright
pass driving the DOM directly). Both ran in Chrome (`channel:'chrome'`) over `file://`.

Automated harness result: **15/16 automated pass, 1 automated fail (item 4), manualReview items: [4]**.
Independent pass + screenshot review resolves item 4 to PASS (see below). **Final: 16/16.**

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Loads clean (title exact, 0 console errors, 0 net) | PASS | `document.title === "Hacker News"`; consoleErrors=[], pageErrors=[], http/ws requests=[] (both harness + my pass) |
| 2 | Centered ~85% #f6f6ef column on white; Verdana | PASS | ratio 0.85, centered; html/body bg white; title+subtext font "Verdana, Geneva, sans-serif" |
| 3 | Orange #ff6600 bar spans column top | PASS | bar rgb(255,102,0), w=1088 == columnW, top=0 |
| 4 | Logo mark w/ 1px white border, bold "Hacker News", exact nav | **PASS** (screenshot-resolved) | Nav order exact; "Hacker News" weight 700. Harness `borderOk:false` is a **wrong-element artifact** — its "leftmost 12–28px square" heuristic selected the wrapping `<td id="logo-cell">` (22×18px, no border) instead of the actual `<span class="logo-mark">`. My DOM read of `.logo-mark`: 18×18, `border 1px solid rgb(255,255,255)`, white "Y" on orange. Top-bar screenshot (`round-0/shot-topbar.png`) shows the white-"Y"-with-white-border mark. |
| 5 | login flush right, dark top-bar text | PASS | gapToRightEdge=6px; nav+login color rgb(0,0,0) |
| 6 | 20+ varied stories | PASS | 30 stories; 30 distinct titles/points/comments/users; 17 distinct ages |
| 7 | Ranks "N." consecutive, right-aligned, gray | PASS | 30 ranks 1..30 consecutive; text-align:right; rank color rgb(130,130,130) |
| 8 | Gray ~10px upvote triangle, title="upvote", between rank & title | PASS | 30 arrows; 10×10px; cursor:pointer; color rgb(153,153,153); position between rank/title |
| 9 | Black ~10pt title link; gray parenthesized domain | PASS | title color rgb(0,0,0), 13.3px; 26 domain mentions; first domain 10.7px gray |
| 10 | Exact subtext format, ~7pt #828282, title-indented | PASS | 30 lines match `{points} points by {user} {age} \| hide \| {n} comments`; 9.3px; gray; indented to title |
| 11 | Relative ages, never absolute | PASS | all ages `\d+ (hour\|day\|...)s? ago`; badAges=[] |
| 12 | Subtext links same gray; dense rows | PASS | link color == subtext color rgb(130,130,130); median row pitch 37px |
| 13 | Upvote +1 scoped, no reload/dialog | PASS | story1 542→543 (Δ+1); others unchanged; no reload, no dialog (index + my pass agree) |
| 14 | Arrow disappears; at-most-once | PASS | visible arrows 30→29; second click no change (543→543); all subtexts still parse; `shot-3s.png` shows story1 arrow gone |
| 15 | "More" link below list, title-styled, click-safe | PASS | anchor "More" below last subtext; black 13.3px; click → no URL change, no error/dialog, page intact |
| 16 | No h-scroll @1024/1440; no blank; no uncaught | PASS | scrollWidth==clientWidth at both widths; body text ~3896 chars; 0 pageerrors |

**passRate = 16 / 16 = 1.00** (>= 0.80 threshold).

### Step 2 — Fake-convergence flag
Latest STATUS build line: `BUILD r0: CLAIMED DONE=yes …`. Verdict = **pass**.
`fakeConvergence = (claimed done) AND (verdict != pass) = true AND false = **false**`.

### Contract note (not a scored item)
`src/` contains extra files `selfcheck.mjs` and `selfcheck.png` (builder self-check leftovers).
The spec's artifact contract is "exactly ONE file, `src/index.html`". Per the frozen rubric's contract
preamble this is a deviation the grader should **note**, but it only zeroes the submission if
`index.html` is *missing* — it is present, self-contained (no test code inside the artifact), and
passes all 16 items. Recommend the builder remove the extra files, but this does not lower the score.

### Verdict — Round 0: **PASS** (passRate 1.00)

Artifacts: `verify/round-0/autochecks-output.json`, `verify/round-0/verify-pass.mjs`,
`verify/round-0/shot-0s.png`, `verify/round-0/shot-3s.png`, `verify/round-0/shot-topbar.png`.
