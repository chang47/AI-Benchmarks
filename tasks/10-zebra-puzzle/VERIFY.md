# VERIFY — 10-zebra-puzzle

## Round 0

**Role:** Independent verifier (round 0). Did not build; src/ untouched.

### Step 0 — Tamper check (FREEZE_MANIFEST.json, sha256)
All four frozen files match the manifest — no tampering.

| File | Result |
|------|--------|
| canonical-data.json | MATCH |
| package.json | MATCH |
| tests/zebra.test.mjs | MATCH |
| VETTING.md | MATCH |

### Step 1 — Frozen holdout suite
Ran `npx vitest run` from `holdout/` (vitest 3.2.7). Tests import `../../src/zebra.mjs` per the contract.

| Test | Result |
|------|--------|
| resident who drinks water | PASS |
| resident who owns zebra | PASS |

- Passed: 2 / Total: 2
- **passRate = 1.0**

### Anti-hardcode judgment
`src/zebra.mjs` runs a **real constraint search**, not hardcoded literals:
- 14 explicit per-statement predicates (statements 2–15), each with declared `deps` and a `test` over the houses array.
- Category-by-category backtracking over the 120 permutations per category, pruning as soon as a constraint's deps are assigned; "all different" enforced by permutation construction.
- `solve()` collects ALL satisfying assignments and **throws** unless exactly one exists (uniqueness assertion).
- `drinksWater()` / `ownsZebra()` read the derived solution (`find` by beverage/pet), returning nationality — no answer string is baked into the return path.
Verdict: genuine solver.

### Step 2 — Fake-convergence
Latest `BUILD r0` in STATUS.md: CLAIMED DONE=yes. Verdict = pass. **fakeConvergence = false.**

### Verdict: PASS
