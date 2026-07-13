# Holdout Rubric — Task 16 Budget Tracker

Answer key for grading `src/index.html`. **35 items, equal weight (1 point each, 35 total).**
Weights are equal per item as directed. The research-justified discrimination (RESEARCH.md §
"Contamination note": every model pattern-matches the app instantly — the score comes from
*edit-updates-everything, negative balance, hook error contract, reload survival, exact
per-category sums*, not from producing a tracker at all) is realized **structurally**: those
hard axes are each broken into their own item(s) because the spec enumerates each as an
independently-required output.

**How to check** legend:
- `HOOK` — fully programmatic via `window.__budget` (`autochecks.mjs` covers it).
- `DOM` — programmatic via DOM / computed-style heuristics in `autochecks.mjs`; the checker
  reports `skip` if it cannot auto-locate the elements (non-standard DOM) → fall back to
  screenshot judgment (`JUDGE`) for that item.
- `STORAGE` — programmatic via `localStorage` inspection + `page.reload()`.
- `CONSOLE` / `NET` — playwright console / pageerror / dialog / request listeners.
- `JUDGE` — human screenshot judgment (only where a `skip` is reported).

Scoring convention: `pass` = 1, `fail` = 0, `skip` = grade manually from a screenshot / manual
session and record pass/fail. `skip` items are **never auto-awarded**.

The candidate transaction shape (spec "Data model") is
`{ id, type:"income"|"expense", description, amount>0, category, date:"YYYY-MM-DD" }`;
**balance = Σincome − Σexpense** (may be negative). All amounts display with **exactly 2
decimals**. The hook is `window.__budget` = `{ add, update, remove, list, balance }`.

---

## Hook contract (spec "Test hook" section → AC12–AC14)

1. **R01 — H1 hook shape.** `window.__budget` exists after load with function members `add`,
   `update`, `remove`, `list`, `balance`. HOOK.
2. **R02 — H2 add() valid path.** `add({type,description,amount,category,date})` (no `id`)
   returns the **created transaction object including a newly-assigned `id`**, with the five
   supplied fields intact; `list()` grows by exactly one containing it. HOOK.
3. **R03 — H3 list() shape + isolation.** `list()` returns a **new array** of plain objects,
   each with **exactly** the keys `id,type,description,amount,category,date` and correct types
   (`type ∈ {income,expense}`, `amount` a positive finite Number, `date` matches
   `^\d{4}-\d{2}-\d{2}$`). Mutating the returned array (push / field-edit) does **not** change
   app state (a fresh `list()` is unaffected). HOOK.
4. **R04 — H8 balance() = Σincome − Σexpense.** `balance()` returns a **Number** equal to the
   income-minus-expense sum computed from `list()`, within ±0.005. HOOK.
5. **R05 — H4 update() valid path.** `update(id,{...})` applies the named mutable field(s) to
   the existing transaction and returns the updated object with the **same `id`**; `list()`
   length is unchanged and the change is reflected. HOOK.
6. **R06 — H4/H6 unknown-id is not an error.** `update(<unknownId>,{...})` returns `null` and
   `remove(<unknownId>)` returns `false`, **neither throws**, and state is unchanged. HOOK.
7. **R07 — H6 remove() deletes.** `remove(id)` of a live transaction returns `true` and drops
   exactly that transaction from `list()`. HOOK.

## Validation / error contract (spec "Validation rules" → AC14)

8. **R08 — invalid description throws.** `add({...,description:""})` and a whitespace-only
   description each **throw an `Error`**, and `list()`, `balance()`, and `localStorage` are all
   unchanged afterward. HOOK + STORAGE.
9. **R09 — invalid amount throws.** `add` with `amount` = `0`, a negative number, `NaN`, and a
   non-finite / non-number value each **throw an `Error`**; state unchanged. HOOK + STORAGE.
10. **R10 — invalid type / category / date throws.** `add` with `type` other than
    `"income"`/`"expense"`, with an empty `category`, and with a `date` that is not a
    `YYYY-MM-DD` string each **throw an `Error`**; state unchanged. HOOK + STORAGE.
11. **R11 — update() invalid field throws, atomically.** `update(id,{amount:-1})` (and other
    invalid field values) **throws an `Error`** and leaves the transaction and all state
    (`list()`, `balance()`, `localStorage`) exactly as they were. HOOK + STORAGE.

## Artifact contract & hygiene (spec "Artifact contract" → AC16)

12. **R12 — self-contained single file.** Loading `src/index.html` from `file://` issues
    **zero** http(s) requests and a static scan finds no external `src=`/`href=`/`url(...)`/
    `@import` resource references. NET + static scan.
13. **R13 — clean first load.** Zero console errors / page errors from a fresh load with no
    stored data. CONSOLE.
14. **R14 — no dialogs.** No `alert`/`confirm`/`prompt`/native dialog fires at any point in the
    run (load or any flow). CONSOLE (playwright `dialog` count = 0).
15. **R15 — zero console errors across the full run.** No console errors / uncaught page errors
    across the entire autocheck run (all adds, edits, deletes, reloads, invalid inputs). CONSOLE.

## Initial render (AC1)

16. **R16 — empty first load.** Fresh load, no stored data: `list()` is `[]`, `balance()` is
    `0`, and the rendered page shows a balance of `0.00`. HOOK + DOM.
17. **R17 — form controls present.** The add-transaction form offers: an income/expense **type**
    choice, a **description** text input, an **amount** `type="number"` input, a **category**
    chooser with **≥ 4** selectable categories, and a **date** `type="date"` input. DOM
    heuristic; on `skip` → JUDGE from screenshot.

## Create (AC2–AC5)

18. **R18 — add income updates row + balance + storage.** Adding an income transaction makes
    `balance()` increase by **exactly** its amount; the rendered page shows a row with the
    description, the amount formatted to **exactly 2 decimals**, and the category (date shown in
    some form); and the data is present in `localStorage` synchronously. HOOK + DOM + STORAGE;
    date-format / income-expense visual distinction on `skip` → JUDGE.
19. **R19 — add expense updates row + balance.** Adding an expense makes `balance()` decrease by
    **exactly** its amount and renders its row the same way. HOOK + DOM.
20. **R20 — balance = Σincome − Σexpense, 2 decimals.** After a mixed sequence of adds the
    rendered balance equals the income-minus-expense sum shown with **exactly 2 decimals**, and
    `balance()` equals the same value within ±0.005. HOOK + DOM.
21. **R21 — negative balance shown signed, never clamped.** When expenses exceed income,
    `balance()` is negative and the page displays it with a **leading minus sign** (e.g.
    `-25.50` / `-$25.50`), never clamped to 0 and never sign-dropped. HOOK + DOM.
22. **R22 — negative balance visually distinct.** The displayed negative balance is visually
    distinguished from a non-negative balance (e.g. different text color). DOM computed-color
    heuristic; on `skip` → JUDGE.

## Update (AC6)

23. **R23 — edit affordance per row.** Every listed transaction exposes an edit affordance
    (button / control). DOM heuristic; on `skip` → JUDGE.
24. **R24 — edit updates in place, everything reflects.** Editing a transaction (same mutation
    the UI edit performs) keeps the **same `id`**, adds **no duplicate row**, leaves `list()`
    **length unchanged**, and immediately updates the displayed **balance** and **per-category
    totals** to the new values. HOOK + DOM.

## Delete (AC7)

25. **R25 — delete affordance per row.** Every listed transaction exposes a delete affordance.
    DOM heuristic; on `skip` → JUDGE.
26. **R26 — delete updates everything; last → empty.** Deleting removes exactly that transaction
    and immediately updates the displayed balance and per-category totals; deleting the **last**
    transaction returns the app to the empty state of R16 (`list()` `[]`, balance `0.00`). HOOK +
    DOM.

## Category dashboard (AC8)

27. **R27 — total income & total expenses exact.** The dashboard shows a **total income** and a
    **total expenses** figure, each equal to the exact sum of that side (2-decimal display),
    verified with aggregate amounts that match no single row. HOOK + DOM.
28. **R28 — per-category expense totals exact.** For each category with ≥1 expense the displayed
    category total equals the **exact sum** of that category's expense amounts (2 decimals),
    verified with a category whose two expenses sum to a value present in no single row. HOOK +
    DOM.
29. **R29 — editing a category moves the money.** Changing a transaction's category moves its
    amount **between** category totals: the source category's displayed total drops by that
    amount and the destination's rises by it. HOOK + DOM.

## Form validation (AC9–AC10)

30. **R30 — empty-description submit adds nothing.** Submitting the actual form with an empty /
    whitespace-only description adds no transaction (`list()`, `balance()`, `localStorage`
    unchanged) and uses **no dialog** (an in-page message is expected — verify wording via
    JUDGE). DOM form-drive; on `skip` → JUDGE (hook-path reject is covered by R08).
31. **R31 — bad-amount submit adds nothing.** Submitting the form with an empty / non-numeric /
    zero / negative amount is rejected the same way (nothing added, no dialog). DOM form-drive;
    on `skip` → JUDGE (hook-path reject is covered by R09).

## Persistence (AC11)

32. **R32 — add survives reload.** After adding transactions and reloading the page, `list()`
    returns the same transactions with the **same `id`s**, `balance()` is the same, and the rows
    / balance re-render. STORAGE + HOOK + DOM.
33. **R33 — edit & delete survive reload.** An edit followed by reload shows the edited values;
    a delete followed by reload stays deleted; `id`s are unchanged across reload. STORAGE + HOOK.

## Integrity & robustness (AC15–AC16)

34. **R34 — ids unique, stable, addressed by id.** Every live transaction's `id` is unique and
    stable (unchanged across edits and reloads); removing one specific `id` leaves the other
    transactions intact (operations address transactions by `id`, not list position). HOOK +
    STORAGE.
35. **R35 — corrupt/missing storage → empty, no crash.** With corrupt (unparseable) data written
    into the app's `localStorage` key(s), a reload starts the app with an **empty** transaction
    list (`list()` `[]`, balance `0`) instead of crashing, with **no console error**. STORAGE +
    HOOK + CONSOLE.

---

### Rule → item map (spec's 16 acceptance criteria)

| Spec AC | Rubric item(s) |
|---|---|
| AC1 initial render | R16, R17 |
| AC2 add income | R18 |
| AC3 add expense | R19 |
| AC4 balance formula/2-dec | R20 |
| AC5 negative balance | R21, R22 |
| AC6 edit in place | R23, R24 |
| AC7 delete | R25, R26 |
| AC8 category dashboard | R27, R28, R29 |
| AC9 empty-desc validation | R30 (+ R08 hook path) |
| AC10 amount validation | R31 (+ R09 hook path) |
| AC11 persistence | R32, R33 |
| AC12 hook + list/balance shape | R01, R03, R04 |
| AC13 hook drives app | R02, R05, R07, R18, R24, R26 |
| AC14 hook error contract | R08, R09, R10, R11, R06 |
| AC15 id integrity | R34 |
| AC16 no dialogs / corrupt-storage | R14, R15, R35 |

### Runner notes

- `cd holdout && npm install` once (installs playwright); then
  `node autochecks.mjs ../src/index.html` (path optional — defaults to `../src/index.html`).
- The script prints a single JSON document
  `{summary:{target,pass,fail,skip,total}, results:[{id,desc,status,detail}]}`, one result per
  rubric item (ids `R01`–`R35` matching the numbers above), and exits 0 (no fails) / 1 (≥1 fail)
  / 2 (fatal: could not launch a browser).
- If the candidate file is absent the script still emits the full results array with every item
  `fail` ("candidate not found"), i.e. it fails gracefully rather than crashing.
- Any `skip` MUST be graded manually per the JUDGE fallback above; never auto-award it.
- Expected category/total figures in R27–R29 were chosen by the holdout author so each asserted
  aggregate (e.g. `39.30`, `100.10`) matches **no single transaction row**, so its presence /
  disappearance proves the *summation* (not merely a row echo).
