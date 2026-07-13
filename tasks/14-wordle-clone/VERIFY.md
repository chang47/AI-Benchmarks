# VERIFY — Task 14 Wordle Clone

## Round 0

**Role:** Independent verifier (did not build). Target: `src/index.html`.

### Step 0 — Tamper check (PASS)
Recomputed SHA-256 of the three files in `holdout/FREEZE_MANIFEST.json`; all match:
- `autochecks.mjs` = `bdc9d8…4bca0` ✓
- `rubric.md` = `0b2541…deddb` ✓
- `package.json` = `1aeb82…f55b3` ✓

No tampering. Holdout is frozen as recorded.

### Step 1a — Holdout autochecks (`node autochecks.mjs ../src/index.html`)
**37 pass / 0 fail / 0 skip / 37 total.** Every rubric item R01–R37 resolved programmatically
(no JUDGE fallbacks were forced — DOM heuristics located all board/keyboard elements).

### Step 1b — Independent playwright pass (my own script, chromium channel=chrome, file://)
`verify/round-0/independent_verify.mjs` — 23/23 pass, corroborating the holdout run with
independently-authored assertions:
- Hook shape `{setAnswer, guess, state}` present.
- All 6 spec C4 duplicate-letter cases + the excess-copy probe (HOTEL/LLAMA) return the exact
  color arrays.
- Invalid guesses (`abc`, `abcdef`, `ab1de`, `ab de`) → `null`, consume no row; non-word
  `ZZZZZ` accepted (5-gray).
- Win ends game + ignores further input (E1); win on the 6th guess counts as won (E4).
- Loss reveals the answer in-page and ignores further input (E2); answer hidden while playing (E3).
- Default answer playable with no `setAnswer` (F1; picked TRACE, played fine).
- Physical typing `a,b,⌫,b,c,d,e,z,Enter` → `ABCDE` (A3); on-screen key clicks → `ABCDE` (D5).
- Keyboard best-state after CREPE/SPEED: E=green, P=yellow, S=gray, D=gray, Z neutral (D1).
- Zero console errors, zero page errors, zero dialogs, zero http(s) requests (AC1/AC3/AC4/F3).

### Step 1c — Visual confirmation (screenshots)
- `verify/round-0/at-0s.png`: 6×5 empty tile grid + full QWERTY on-screen keyboard
  (26 letters + Enter + ⌫), all keys neutral. Confirms A1, A2.
- `verify/round-0/at-3s.png`: answer CREPE / guess SPEED renders S=gray, P=yellow, E=green,
  E=yellow, D=gray (matches C4-4), letters displayed UPPERCASE, the three tile colors visually
  distinct, keyboard best-state coloring correct with unguessed keys neutral. Confirms A5, B1,
  B2, C4-4, D1 visually.

### Step 2 — Fake-convergence check
Latest STATUS line: `BUILD r0: CLAIMED DONE=yes, self-checks 28/28 pass…`. Builder claimed done = **yes**.
Verdict = **pass**, so `fakeConvergence = (done) AND (verdict != pass) = FALSE`. Genuine convergence.

### Verdict
- **passRate = 37/37 = 1.00** (≥ 0.80 threshold)
- **fakeConvergence = false**
- **VERDICT = PASS**

No feedback required — all criteria met on round 0.
