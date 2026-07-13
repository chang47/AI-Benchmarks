# VERIFY — Task 16 Budget Tracker

## Round 0

**Verifier:** independent (round 0). Did not build. `src/` untouched.

### Step 0 — Tamper check (sha256 vs FREEZE_MANIFEST.json)

| File | Status |
|---|---|
| autochecks.mjs | MATCH |
| rubric.md | MATCH |
| package.json | MATCH |
| .gitignore | MATCH |

All 4 frozen files match. **Not tampered.**

### Step 1 — Grading

**A. Holdout autochecks** (`node autochecks.mjs ../src/index.html`, playwright/chrome, file://):
`{pass:35, fail:0, skip:0, total:35}`, exit 0. Full output: `verify/round-0/autochecks-output.json`.
No `skip` items — every rubric item (R01–R35) auto-resolved to `pass`; no JUDGE fallback needed for scoring, but visual items independently confirmed below.

**B. Independent playwright pass** (`verify/round-0/independent.mjs`, own hook/DOM/console/net logic, not reusing holdout): `{pass:30, fail:0, total:30}`. Output: `verify/round-0/independent-output.json`. Recomputed from scratch and confirmed:
- Hook shape `{add,update,remove,list,balance}`; `add` returns created object incl. new `id`; `list()` returns isolated new array of plain objects with exactly the 6 keys (mutating it leaves state intact).
- Balance = Σincome − Σexpense (5000 income → 5000.00; mixed → 4860.60; negative → −25.50), 2-decimal display.
- Per-category exact sums that match no single row: Food `39.30` (19.15+20.15), Transport `100.10`; totals income `5000.00` / expenses `139.40`.
- Negative balance shown signed (`-$25.50`) and rendered in a distinct color from a positive balance.
- Edit keeps same `id`, no duplicate row, list length unchanged, and moves money between category totals (Food→Transport, Food disappears, Transport 100.00).
- Error contract: 7 invalid `add` shapes (empty desc, amount 0/neg/NaN, bad type, empty category, bad date) all throw with state + balance unchanged; `update(id,{amount:-1})` throws atomically; unknown id → `update`=null / `remove`=false, no throw.
- Form-drive validation: empty-description and amount=0 submits add nothing and surface a visible in-page `#message.show`; no dialog. Valid submit adds the row.
- Persistence: add → reload keeps same ids and balance and re-renders rows. Corrupt localStorage → reload starts empty (list `[]`, balance 0), no console error.
- Hygiene: 0 console errors, 0 pageerrors, 0 dialogs, 0 external network requests; static scan finds no external `src`/`href`/`@import`/`url(http…)`.

**C. Visual JUDGE items** (screenshots `verify/round-0/shot-0s.png`, `shot-3s.png`, read):
- R17 form controls (`shot-0s`): Type income/expense select, Category select (8 options), Description text input, Amount `number` input, Date `date` input — all present. PASS.
- R18/R19/R22 (`shot-3s`): income row green `+$200.00` tag "income", expense row red `-$50.00` tag "expense" — clear income/expense visual distinction, 2-decimal amounts, dates shown `2026-07-11`. Positive balance rendered green. PASS.
- R23/R25 (`shot-3s`): every row exposes Edit + Delete buttons. PASS.
- R27/R28 (`shot-3s`): Total Income `$200.00`, Total Expenses `$50.00`, Expenses-by-Category Food `$50.00`. PASS.
- R30/R31 wording: in-page error message (e.g. "Invalid description…", "Invalid amount…") shown in `#message`, no dialog. PASS.

### passRate

35 / 35 rubric items pass (equal weight). **passRate = 1.00.**

### Fake-convergence flag

Latest `BUILD r0` line claims DONE=yes; verdict = pass ⇒ **fakeConvergence = false.**

### Verdict

**PASS** (passRate 1.00 ≥ 0.80). No feedback required.
