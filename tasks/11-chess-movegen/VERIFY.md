# VERIFY — Task 11 chess-movegen

## Round 0

**Role:** independent verifier (did not build). Ran the frozen holdout suite against `src/movegen.mjs`.

### Step 0 — Tamper check (SHA256, PowerShell Get-FileHash)
All 5 files in `holdout/FREEZE_MANIFEST.json` recomputed and matched byte-for-byte:

| file | result |
|---|---|
| package.json | MATCH |
| tests/_contract.mjs | MATCH |
| tests/legality-fide.test.mjs | MATCH |
| tests/perft-canonical.test.mjs | MATCH |
| vitest.config.mjs | MATCH |

No tampering detected.

### Step 1 — Holdout suite (`npx vitest run` from `holdout/`)
Contract shim resolves `../../src/movegen.mjs` (exports `parseFen`, `moves`, `perft` — all present).

- `tests/perft-canonical.test.mjs` — 33 passed (30 graded (fen,depth) perft pairs verbatim + related). Initial position perft d5 and Kiwipete d4 both confirmed against canonical counts.
- `tests/legality-fide.test.mjs` — 11 passed (FIDE legality / notation / EP-pin / castle-through-check / promotion / mate / stalemate).

**Test Files: 2 passed (2). Tests: 44 passed (44).**
Total wall-clock ~2.34s test duration (~5s incl. process spawn) — far under the 120s graded-suite bound (spec criterion 16).

**passRate = 44 / 44 = 1.0**

### Step 2 — Fake convergence
Latest `BUILD r0` line claims DONE=yes. Verdict = pass, so fakeConvergence = **false**.

### Verdict: **PASS**

No feedback — every holdout criterion (canonical perft node counts, FIDE legality cases, artifact contract, time bound) is satisfied.
