# VERIFY — 01-tennis-scorekeeper

## Round 0

Independent verifier (did not build the candidate; did not read `src/tests/`).
Suite: `verify/tests/engine.test.mjs` (53 tests, vitest 3.2.7), derived from `spec.md`
AC-1..AC-26 plus RESEARCH.md §4 edge cases. UI: `verify/ui-check.mjs` (playwright,
system Chrome, local static server per the spec's stated environment).

**Engine suite: 53/53 passed. UI smoke: 10/10 passed. passRate = 1.0. Verdict: PASS.**
**Fake-convergence flag: false** (builder claimed done in STATUS.md "BUILD r0"; verifier verdict is pass — claim confirmed).

### Per-criterion results

| AC | Criterion | Result | Evidence (one line) |
|----|-----------|--------|---------------------|
| 1 | createMatch defaults | PASS | `createMatch()` and `createMatch({})` read `["0","0"]`/`[0,0]`/`[]`/false/false/null; bo3, ad, no super-TB confirmed behaviorally |
| 2 | Config honored | PASS | `{sets:5}` needs 3 sets; `{noAd:true}` decides at deuce; `{superTiebreak:true}` fires at 1-1 |
| 3 | 0→15→30→40 | PASS | p1×2 + p2×1 reads `["30","15"]`; each step checked |
| 4 | Win from 40 (not deuce) | PASS | 40-30 +1 → games `[1,0]`, points reset; love game mirrors for p2 |
| 5 | Deuce at 3-3 points | PASS | Reads `["40","40"]` |
| 6 | Advantage display | PASS | Deuce +p1 → `["Ad","40"]`; deuce +p2 → `["40","Ad"]` |
| 7 | From advantage | PASS | Holder's point wins the game; opponent's point returns to `["40","40"]` |
| 8 | Deuce cycles indefinitely | PASS | 20 alternating post-deuce points leave `[0,0]` games; 2 consecutive then win |
| 9 | No-ad deciding point | PASS | Next point at deuce wins the game; `"Ad"` never appears in the full sequence |
| 10 | No-ad pre-deuce = standard | PASS | Progression and 40-30 win identical to AC-3/4 |
| 11 | No-ad leaves tiebreaks win-by-2 | PASS | noAd set-TB: 7-6 continues, 8-6 ends; noAd match-TB: 10-9 continues, 11-9 ends |
| 12 | Set at 6 games margin 2 | PASS | 6-0, 6-4, 7-5 all append and reset games |
| 13 | 6-5 not over | PASS | Games `[6,5]`, no set recorded, no tiebreak |
| 14 | 6-6 starts tiebreak | PASS | `inTiebreak` true, numeric `["0","0"]`, games `[6,6]` |
| 15 | TB first-to-7 margin-2 uncapped | PASS | 7-5 ends; 7-6 continues; 8-6 ends; 14-12 ends |
| 16 | TB numeric display | PASS | `["6","5"]` while games hold `[6,6]` |
| 17 | TB set recorded 7-6 | PASS | 7-0 internal → `sets [[6,7]]` (p2), indicator clears, games reset |
| 18 | Best-of-3 / best-of-5 end | PASS | bo3 ends at 2 sets (exactly 2 entries); bo5 at 3 |
| 19 | Match TB replaces decider | PASS | 1-1 (bo3) and 2-2 (bo5): `inTiebreak` true, games `[0,0]`, numeric points |
| 20 | Default decider ordinary | PASS | Third set plays games; 6-6 tiebreak works; `sets [[6,0],[0,6],[7,6]]` |
| 21 | Match TB first-to-10 margin-2 uncapped | PASS | 10-9 continues, 11-9 ends; 14-12 ends |
| 22 | Match TB win recorded 1-0 | PASS | 10-8 → last set `[1,0]`; p2 variant `[0,1]` |
| 23 | Match TB only on level sets | PASS | 2-0 bo3 and 3-1 bo5 finish with no tiebreak |
| 24 | pointTo pure | PASS | Prior state's scoreboard deep-equal after call: mid-game, in tiebreak, across a set boundary |
| 25 | Finished match frozen | PASS | 20 further points change nothing |
| 26 | Full point-by-point drive | PASS | bo5 super-TB 2-2 → 10-8 → 5 sets ending `[1,0]`; mixed deuce/7-5/TB match consistent |
| 27 | UI (secondary) | PASS | 10/10: loads from static server, buttons drive score, TB indicator shows/clears, winner shown, post-match clicks frozen, New Match resets, no console errors (favicon-404 harness artifact excluded) |

Researched extras (RESEARCH.md §4): TB internal 12-10 records as 7-6 — PASS; state
JSON-serializable at every phase — PASS; 6-5 inside a bo5 decider ends nothing — PASS.

### Notes
- The only anomaly during UI verification was a 404 console entry for `/favicon.ico`,
  produced by the verifier's own bare static server (Chrome auto-request). Not a candidate defect.
- `verify/` artifacts: `tests/engine.test.mjs`, `ui-check.mjs`, `package.json`.
