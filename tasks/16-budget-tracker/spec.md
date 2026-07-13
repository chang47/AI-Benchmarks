# Spec — Budget Tracker CRUD app (`16-budget-tracker`)

## Purpose

A one-shot budget-tracking dashboard web app: the user records income and expense transactions
(each with a description, amount, category, and date), sees a running balance and per-category
totals that update on every change, can edit and delete any transaction, and never loses data on
reload (localStorage persistence). Semantics follow the community-canonical expense/budget
tracker contract (Traversy `vanillawebprojects` expense-tracker, freeCodeCamp expense-tracker
tutorial, GeeksforGeeks expense-tracker, budget-app-style category reports); the citation trail
is in `research/RESEARCH.md`.

## Artifact contract

Create exactly one source file: **`src/index.html`** — a single, completely self-contained HTML
file (all CSS and JavaScript inline). Constraints:

- Vanilla HTML/CSS/JavaScript only. No frameworks, no libraries, no CDN, fonts, images, or
  network resources of any kind.
- Must work when opened directly from disk via `file://`, rendering the full dashboard with
  zero console errors, both on first load (no stored data) and on every subsequent load.
- Never call `alert()`, `confirm()`, or `prompt()` — all feedback is in-page.

### Data model

A **transaction** is a plain object with exactly these fields:

- `id` — unique, stable identifier (string or number), assigned by the app.
- `type` — the string `"income"` or `"expense"`.
- `description` — non-empty string.
- `amount` — a finite number **> 0** (always positive; `type` carries the direction).
- `category` — non-empty string, one of the app's selectable categories.
- `date` — calendar-date string in exactly the form `"YYYY-MM-DD"` (the value format of
  `<input type="date">`). Treat it as an opaque string — no `Date`-object/timezone math needed.

**Balance** = (sum of all income amounts) − (sum of all expense amounts). May be negative.

### Test hook (required, for deterministic verification)

Expose a global **`window.__budget`** object with these functions, available as soon as the
page has loaded:

- `add(tx)` — `tx` is `{ type, description, amount, category, date }` (no `id`). Validates by
  the same rules as the form (see Validation below); on success creates the transaction,
  assigns its `id`, and **returns the created transaction object (including `id`)**. On invalid
  input **throws an `Error`** and leaves all state unchanged.
- `update(id, tx)` — `tx` is an object carrying one or more of the five mutable fields; the
  named fields are validated (same rules) and applied to the existing transaction. Returns the
  updated transaction object. If `id` matches no transaction, returns `null` (no throw). On
  invalid field values, throws an `Error` and leaves all state unchanged.
- `remove(id)` — deletes the transaction; returns `true`, or `false` if `id` matches nothing.
- `list()` — returns a **new array** of plain transaction objects (all of them, each with all
  six fields). Mutating the returned array must not affect app state.
- `balance()` — returns the balance as a Number (income − expense).

Every successful mutation through the hook must have exactly the same effect as doing it
through the UI: the rendered list, displayed balance, per-category totals, and localStorage all
update synchronously (by the time the call returns).

### Validation rules (form AND hook)

A transaction (or an updated field) is **invalid** if: `description` is empty (or only
whitespace); `amount` is empty, not a finite number, or ≤ 0; `type` is not `"income"` or
`"expense"`; `category` is empty; or `date` is not a `YYYY-MM-DD` string. Invalid form
submissions add nothing, change nothing, and surface an in-page message (any visible text —
never a dialog). Invalid hook calls throw, as specified above.

## Acceptance criteria

Initial render:

1. Opening `src/index.html` via `file://` with no stored data shows: an add-transaction form
   with (a) an income/expense type choice, (b) a description text input, (c) an amount
   `type="number"` input, (d) a category chooser offering at least 4 categories, (e) a date
   `type="date"` input; an empty transaction list; and a displayed balance of `0.00` — with
   zero console errors.

Create:

2. Adding an income transaction via the form (e.g. Salary / 5000 / Salary-category /
   2026-07-01) inserts a list row showing its description, amount formatted to exactly 2
   decimals, category, date, and a visible income/expense distinction — and the displayed
   balance increases by exactly that amount.
3. Adding an expense transaction via the form inserts its row the same way and decreases the
   displayed balance by exactly that amount.
4. After any sequence of adds, the displayed balance equals (sum of income amounts) − (sum of
   expense amounts), shown with exactly 2 decimal places, and `window.__budget.balance()`
   equals the same value within ±0.005.
5. When expenses exceed income, the balance is displayed as a negative number (leading minus
   sign, e.g. `-25.50` or `-$25.50`) and is visually distinguished from a non-negative balance
   (e.g. different color). It is never clamped to 0 and the sign is never dropped.

Update:

6. Every listed transaction has an edit affordance. Editing a transaction's amount (and/or
   type, description, category, date) updates that same row in place — same `id`, no duplicate
   row, list length unchanged — and the displayed balance and per-category totals immediately
   reflect the new values.

Delete:

7. Every listed transaction has a delete affordance. Deleting removes exactly that row and
   immediately updates the displayed balance and per-category totals; deleting the last
   transaction returns the app to the empty state of criterion 1 (balance `0.00`).

Category totals (the dashboard):

8. The page shows a summary with (a) total income, (b) total expenses, and (c) a per-category
   expense breakdown: for each category having at least one expense transaction, the displayed
   category total equals the exact sum of that category's expense amounts (2-decimal display).
   The breakdown updates on every add, edit, and delete — in particular, editing a
   transaction's category moves its amount between category totals.

Validation:

9. Submitting the form with an empty (or whitespace-only) description adds no transaction:
   list, balance, totals, and localStorage are unchanged, and a visible in-page message
   appears. No dialog is used.
10. Submitting the form with an empty, non-numeric (NaN), zero, or negative amount is rejected
    the same way.

Persistence:

11. Transactions persist in `localStorage`: after adding transactions and reloading the page,
    the same rows, balance, and category totals render. An edit followed by reload shows the
    edited values; a delete followed by reload stays deleted; `id`s are unchanged across
    reload.

Test hook:

12. `window.__budget` exists after page load with all five functions. `list()` returns an
    array of plain objects each carrying exactly `id`, `type`, `description`, `amount`,
    `category`, `date` (types as in the data model); `balance()` returns a Number consistent
    with criterion 4.
13. Hook mutations drive the whole app: `__budget.add(...)` returns the created transaction
    (with `id`) and its row appears in the DOM, the displayed balance updates, and the data is
    in localStorage — all by the time the call returns. `update(id, {...})` edits the row the
    same way and returns the updated object; `remove(id)` removes it and returns `true`.
14. Hook error contract: `add`/`update` with an invalid value (empty description; NaN, 0, or
    negative amount; a `type` other than `"income"`/`"expense"`) throws an `Error`, after which
    `list()`, `balance()`, the DOM, and localStorage are all unchanged. `update`/`remove` with
    an unknown `id` return `null`/`false` respectively without throwing.

Integrity and robustness:

15. Every transaction's `id` is unique among all live transactions and stable: it never changes
    across edits or reloads, and edits/deletes address transactions by `id` (never by list
    position).
16. The app never calls `alert()`/`confirm()`/`prompt()`, and produces zero console errors
    through all of the flows above. If localStorage is absent, empty, or contains corrupt
    (unparseable) data at load, the app starts with an empty transaction list instead of
    crashing.

## Freedoms (not judged)

Visual design, layout, currency symbol (2-decimal formatting is judged, the symbol is not),
the specific category names (≥ 4 required), list ordering, edit UX (prefill form, modal, or
inline), the localStorage key name, and any extra dashboard flourishes (charts, filters) —
provided no criterion above is violated.

## Out of scope

Multi-currency, recurring transactions, budgets/limits per category, month filtering, charts,
accounts/auth, import/export, server or build tooling, and any test code (the verifier writes
its own).
