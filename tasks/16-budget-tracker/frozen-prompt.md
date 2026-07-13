# Frozen prompt — 16-budget-tracker

Origin: Artificial Analysis MicroEvals, "Budget Tracker App"
(https://artificialanalysis.ai/microevals/budget-tracker-app-1753363368477, gallery:
https://artificialanalysis.ai/microevals). The complete canonical prompt there is the single
sentence quoted verbatim as the opening line below (MicroEvals adds an undisclosed
platform-side system prompt for web rendering; the single-file framing and the numbered
requirements below are this bench's objective equivalent — every requirement traces to the
authorities in `research/RESEARCH.md`, none is invented).

Run best-of-3 with this exact text. Never reword between runs or models.

---

Using javascript create budget tracking app dashboard.

Build it as one single, completely self-contained HTML file (call it `index.html`) — all CSS
and JavaScript inline, vanilla only: no frameworks, no libraries, no CDN or network resources
of any kind. It must work when opened directly from disk via `file://` and produce zero
console errors.

Requirements:

1. Transactions are income or expense entries, each with a description, a positive amount, a
   category, and a date. Provide an add-transaction form with: an income/expense type choice,
   a text description, a `type="number"` amount, a category chooser with at least 4
   categories, and a `type="date"` date (value format `YYYY-MM-DD`).
2. Validate on submit: reject an empty description, and an empty, non-numeric, zero, or
   negative amount — add nothing, change nothing, and show an in-page error message. Never
   use `alert()`, `confirm()`, or `prompt()` anywhere in the app.
3. Show all transactions in a list with their description, amount (formatted to exactly 2
   decimal places), category, date, and a visible income-vs-expense distinction. Every
   transaction has Edit and Delete controls. Editing changes that same transaction in place
   (no duplicate entry); deleting removes exactly that transaction.
4. Show a running balance = total income − total expenses, always formatted to exactly 2
   decimal places. Every add, edit, and delete updates the list and the balance immediately.
   When expenses exceed income, display the negative balance with a minus sign and a distinct
   visual treatment (e.g. red) — never clamp it to 0.
5. Show a dashboard summary: total income, total expenses, and a per-category expense
   breakdown where each category's total is the exact sum of that category's expense amounts,
   updated on every change.
6. Persist all transactions to `localStorage` so the full state (list, balance, category
   totals) survives a page reload. If stored data is missing or corrupt, start with an empty
   list instead of crashing.
7. Give every transaction a unique, stable id (unchanged by edits and reloads), and address
   edits/deletes by id.
8. Expose a global `window.__budget` object for verification, live as soon as the page loads:
   - `add(tx)` — `tx = { type, description, amount, category, date }`; validates by the same
     rules as the form; on success creates the transaction, updates the UI and localStorage,
     and returns the created transaction including its `id`; on invalid input throws an
     `Error` and changes nothing.
   - `update(id, tx)` — applies the given field(s) to the existing transaction with the same
     validation and UI/storage effects; returns the updated transaction, or `null` if the id
     is unknown; throws on invalid values, changing nothing.
   - `remove(id)` — deletes the transaction (UI + storage) and returns `true`, or `false` if
     the id is unknown.
   - `list()` — returns a new array of plain objects, each with `id`, `type`, `description`,
     `amount`, `category`, `date`.
   - `balance()` — returns the current balance as a Number.

Output the complete contents of `index.html` and nothing else.
