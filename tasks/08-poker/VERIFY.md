# VERIFY — 08-poker

## Round 0

**Role:** Independent verifier (round 0). Did not build; ran the frozen holdout suite against the candidate `src/poker.mjs` unmodified.

### Step 0 — Tamper check (SHA256 vs holdout/FREEZE_MANIFEST.json)

| File | Manifest | Recomputed | Match |
|---|---|---|---|
| canonical-data.json | 90E33334…C2371A | 90E33334…C2371A | yes |
| package.json | 98EA69F6…50F19C | 98EA69F6…50F19C | yes |
| tests/poker.test.mjs | 480D60A1…98E029 | 480D60A1…98E029 | yes |
| VETTING.md | 0FB953CF…E2CE32 | 0FB953CF…E2CE32 | yes |

All four frozen files are byte-identical to the manifest. No tampering.

### Step 1 — Holdout suite

- Contract confirmed: `holdout/tests/poker.test.mjs` imports `{ bestHands }` from `../../src/poker.mjs` (the candidate), so the run exercises the real submission.
- Command: `npx vitest run` from `holdout/` (deps already installed; vitest 3.2.7).
- Result: **1 test file passed, 37/37 tests passed** (7ms).
- passRate = 37/37 = **1.0**.

### Step 2 — Fake-convergence check

- Latest `BUILD r0` line in STATUS.md: `CLAIMED DONE=yes`.
- Verdict = pass, so `fakeConvergence = (claimed done) AND (verdict != pass) = false`.

### Verdict

**pass** — passRate 1.0, no tampering, no fake convergence. No feedback required.
