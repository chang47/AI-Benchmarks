# VERIFY — 07-bowling

## Round 0

**Role:** Independent verifier (did not build). Candidate under test: `src/bowling.mjs`.

### Step 0 — Tamper check (SHA256 vs holdout/FREEZE_MANIFEST.json)

| File | Result |
|---|---|
| `canonical-data.json` | OK (match) |
| `package.json` | OK (match) |
| `tests/bowling.canonical.test.mjs` | OK (match) |
| `VETTING.md` | OK (match) |

All four frozen files hash-match the manifest. No tampering. Proceeded to holdout run.

### Step 1 — Frozen holdout suite

- Command: `npx vitest run` from `holdout/` (vitest 3.2.7).
- Suite: `tests/bowling.canonical.test.mjs`, importing `../../src/bowling.mjs` (the candidate) and reading `../canonical-data.json`. Import target confirmed to be the candidate source.
- Result: **31 passed / 31 total**.
- passRate = 31 / 31 = **1.0**.

Every canonical case — opens, spares, strikes, tenth-frame fill balls (spare fill, strike two-fill, perfect game), and the four invalid-roll / premature-score error paths — passed with exact error-string matches.

### Step 2 — Fake-convergence check

- Latest builder line: `BUILD r0: CLAIMED DONE=yes`.
- Builder claimed done = **yes**; verdict = **pass**.
- fakeConvergence = (claimed done) AND (verdict != pass) = **false**.

### Verdict

**PASS** — passRate 1.0, no tamper, no fake convergence. No feedback (all holdout criteria satisfied).
