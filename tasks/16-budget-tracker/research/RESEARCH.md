# Research — Budget Tracker (one-shot CRUD web app)

Stage 1 (researcher + spec author), 2026-07-12, wave 2.
Meta-rule honored: every correctness rule below traces to an external authority; none invented here.

## Second-brain check

Searched `C:/Users/iamjo/second-brain` for "budget track" — no prior notes on this task family
(single hit is an unrelated template doc). The wave-1 candidate report
(`research/candidate-tasks-report.md`, row 10) is the in-repo origin: *"Budget Tracker / Gantt
chart — small CRUD web app | B (web app) | MicroEvals gallery | CRUD + UI state — an app-type gap
in the current 6."*

## Prompt canonicity (MicroEvals)

1. **The gallery** — Artificial Analysis MicroEvals, ~280 community one-shot prompts run
   side-by-side across models. "Budget Tracker App" confirmed present (👍3), verified live this
   session: https://artificialanalysis.ai/microevals
2. **THE canonical prompt** — MicroEval "Budget Tracker App", verified live this session:
   https://artificialanalysis.ai/microevals/budget-tracker-app-1753363368477
   Verbatim, complete prompt text:
   > "Using javascript create budget tracking app dashboard."
   The page notes "a system prompt was added to support web rendering" (platform-side, not
   displayed — noted here so the frozen prompt's single-HTML-file framing is understood as the
   bench's equivalent of that rendering harness). No judging criteria are published; comparison
   there is informal eyeballing (the wave-1 report's caveat: MicroEvals supplies PROMPTS only —
   pair with our own objective checklist).
3. Because the canonical wording is one terse sentence, the objective contract (what "a budget
   tracking app dashboard" must DO to count as correct) is outsourced to the community-canonical
   expense/budget-tracker tutorial lineage below — the same pattern every model was trained on
   and every human grader implicitly judges against.

## The CRUD contract lineage (adopted correctness rules, each with citation)

**Baseline contract** — Brad Traversy, `vanillawebprojects` (16.1k-star repo), project #09
"Expense Tracker" (https://github.com/bradtraversy/vanillawebprojects, project folder
https://github.com/bradtraversy/vanillawebprojects/tree/master/expense-tracker). Its README
specification, quoted: *"Create UI for project, display transaction items in DOM, show balance,
expense and income totals, add new transaction and reflect in total, delete items from DOM,
persist to local storage."* This is the single most-replicated formulation of the app family.

**Validation + balance formula + formatting** — freeCodeCamp, "How to Build an Expense Tracker
with HTML, CSS, and JavaScript"
(https://www.freecodecamp.org/news/how-to-build-an-expense-tracker-with-html-css-and-javascript/):
rejects submission when *"description is empty, amount is non-numeric, or amount is ≤ 0"*
(message: "Please enter a valid expense description and amount."); balance =
`totalIncomes - totalExpenses`; amounts displayed with `.toFixed(2)` (two decimals); negative
balance color-coded red; expense categories (Housing, Food, Transportation, Entertainment,
Others).

**Edit + category + date fields** — GeeksforGeeks, "Build an Expense Tracker with HTML CSS and
JavaScript"
(https://www.geeksforgeeks.org/javascript/build-an-expense-tracker-with-html-css-and-javascript/):
four required form fields — name `type="text"`, amount `type="number"`, category `<select>`,
date `type="date"`; edit = retrieve by id and prefill the form, resubmit replaces the entry;
delete = `expenses.filter(e => e.id !== id)`; totals via `reduce`.

**Signed-amount variant (rejected, see disagreements)** — Tutor Joes, "Build an Income and
Expense Tracker using JavaScript"
(https://www.tutorjoes.in/JS_tutorial/income_expense_tracker_in_js): income/expense classified
by amount sign; localStorage; delete with confirm; no edit, no date, no categories.

**Per-category summary ("dashboard" axis)** — smircodes/Budget-app
(https://github.com/smircodes/Budget-app): *"The Budget App allows you to enter your sources of
income and expenses, categorizing them for better organization"*; *"the app calculates your
budget by subtracting expenses from income"*; report *"summarizes your income, expenses and the
resulting budget."* Corroborated by Zero To Mastery's "Build a Monthly Spending Tracker" course
(log expenses by category, per-category results in a chart, localStorage —
https://zerotomastery.io/courses/build-personal-finance-app/).

**Platform-level definitions:**
- CRUD = create, read, update, delete — the four basic operations of persistent storage
  (https://en.wikipedia.org/wiki/Create,_read,_update_and_delete). This is why EDIT (update) is
  in scope even though Traversy/fCC/TutorJoes omit it: the wave-1 report's row-10 rationale is
  literally "CRUD + UI state", and GfG supplies the community-canonical edit mechanic.
- localStorage — MDN `Window.localStorage`
  (https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage): *"the stored data is
  saved across browser sessions"*; keys/values are strings (hence the tutorials' universal
  `JSON.stringify`/`JSON.parse` convention); *"localStorage data has no expiration time"*.
- Date input — MDN `<input type="date">`
  (https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date): *"The value is
  normalized to the format `yyyy-mm-dd`."* Adopted as the transaction date format (pure string,
  no timezone math).

## Rule → source map (the 16 spec criteria)

| Spec criterion | Rule | Source |
|---|---|---|
| AC1 | Dashboard renders from `file://`: form (type/description/amount/category/date), empty list, 0.00 balance, zero console errors | Traversy README ("Create UI…, display transaction items in DOM, show balance"); GfG (the five fields); bench artifact convention (cf. tasks 04/06) |
| AC2–AC3 | Add income/expense updates BOTH list row and balance | Traversy ("add new transaction and reflect in total") |
| AC4 | balance = Σincome − Σexpense, shown with exactly 2 decimals | freeCodeCamp (`totalIncomes - totalExpenses`, `.toFixed(2)`); smircodes ("subtracting expenses from income") |
| AC5 | Negative balance displays with minus sign, visually distinct, never clamped | freeCodeCamp (red for negative); implied by the subtraction formula |
| AC6 | Edit updates row + balance + category totals in place (same id, no duplicate) | GfG (edit-by-id mechanic); Wikipedia CRUD (update) |
| AC7 | Delete removes row + updates balance + category totals | Traversy ("delete items from DOM"); GfG (`filter` by id) |
| AC8 | Per-category expense totals + total income + total expenses, each the exact sum, live-updated | smircodes (categorized report); freeCodeCamp (income/expense totals); ZTM (per-category results) |
| AC9–AC10 | Form validation rejects empty description; empty/non-numeric/≤0 amount; inline message, no dialog, state unchanged | freeCodeCamp (exact rejection conditions); GfG (`required` on all fields); bench hard rule bans `alert()` |
| AC11 | localStorage persistence: add/edit/delete all survive reload | Traversy ("persist to local storage"); MDN ("saved across browser sessions") |
| AC12–AC14 | `window.__budget` hook {add, update, remove, list, balance}; hook mutations drive UI + storage; invalid input throws, state unchanged | Bench convention (stage brief; cf. `window.solarSystem` in task 06) — semantics mirror the form's cited rules, nothing new invented |
| AC15 | Unique stable ids, addressed by id, survive reload | GfG (id-addressed edit/delete); Wikipedia CRUD (update/delete target an identified record) |
| AC16 | No alert/confirm/prompt; corrupt/missing stored data → start empty, no crash | Bench hard rule (no OS dialogs); MDN (strings — parse can fail, so guard) |

## Disagreements between sources, and the convention picked

1. **Income vs expense encoding: signed amount (Traversy, TutorJoes — negative = expense) vs
   explicit type/category field (freeCodeCamp, GfG).**
   → Picked **explicit `type: "income" | "expense"` with strictly positive amounts**. Reasons:
   the scope requires BOTH a type and a category per transaction, and the signed-amount trick
   conflates the two; fCC's "amount ≤ 0 is invalid" rule (adopted for validation) is coherent
   only with positive amounts; and the test hook needs unambiguous field semantics.
2. **Edit: absent (Traversy, fCC, TutorJoes) vs present (GfG).**
   → Picked **edit required** — the task family is defined in the wave-1 report as "CRUD + UI
   state," and update is one of CRUD's four operations (Wikipedia). Mechanism left free
   (prefill-form like GfG, or inline/modal), but it must mutate the SAME transaction (same id),
   never append a duplicate.
3. **Validation UX: `alert()` (Traversy's original, TutorJoes' confirm) vs message text (fCC) vs
   HTML5 `required` only (GfG).**
   → Picked **inline (non-dialog) feedback; `alert()`/`confirm()`/`prompt()` banned** — the
   bench's hard rule (no OS dialogs; headless verification would hang), consistent with tasks
   04/06. HTML5 `required` alone is insufficient because the hook path bypasses the form; the
   fCC rejection conditions (empty description / non-numeric / ≤ 0) are the normative rule.
4. **Categories: fixed dropdown lists (fCC: Housing/Food/Transportation/Entertainment/Others;
   GfG: Food/Transport/Entertainment/Other) vs free-text.**
   → Picked **any non-empty category set the builder ships, selected via `<select>` or text
   input** — sources disagree on the list, so the spec fixes only the behavior (per-category
   sums must be exact) and requires ≥ 4 selectable categories (both sources' lists have ≥ 4).
5. **Per-category totals: absent in the expense-tracker tier (Traversy, GfG show only a global
   total; GfG has a category FILTER instead) vs present in the budget-app tier (smircodes
   report, ZTM chart).**
   → Picked **per-category expense totals required** — the canonical prompt says budget tracking
   app **dashboard**, and the stage brief pins it; the budget-app tier is the matching lineage.
   Income participates as a separate "total income" line (fCC treats income as its own section),
   not mixed into expense-category sums.
6. **Money arithmetic: float sums with `.toFixed(2)` display (all tutorials) vs integer cents.**
   → Picked **display exactly 2 decimals (fCC convention); computed balance judged to a ±0.005
   tolerance** so both float and cent implementations pass — no source mandates cents, so the
   spec must not either.
7. **Date: no date (Traversy, fCC, TutorJoes) vs required `type="date"` (GfG).**
   → Picked **date required** (stage brief scope pins "category + date"; GfG is the canonical
   mechanic), stored/reported as the MDN-normalized `yyyy-mm-dd` string — no Date-object
   timezone math, which task 02's research showed is the classic footgun.

## Contamination note (for the bench runner, not the builder)

**High.** The expense/budget-tracker tutorial family is among the most duplicated beginner
content on the web (Traversy's 16.1k-star repo, freeCodeCamp, GfG, dozens of clones), and the
MicroEval itself is public with model outputs attached. Models will pattern-match the app
instantly; discrimination comes from the exact checklist (edit-updates-everything, negative
balance, hook semantics, reload survival), not novelty. At episode time the runner may swap a
personal variant (e.g. different field set or a budget-limit-per-category twist) per the
"Swap Josh's own variant each episode" principle; out of scope for this folder.
