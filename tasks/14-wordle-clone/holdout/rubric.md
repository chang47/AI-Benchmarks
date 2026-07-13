# Holdout Rubric — Task 14 Wordle Clone

Answer key for grading `src/index.html`. 37 items, **equal weight (1 point each, 37 total)**.
Weights are equal per item as directed; the research-justified emphasis (RESEARCH.md §7:
discrimination lives in duplicate-letter scoring, keyboard best-state, and hook-contract
compliance) is realized *structurally* — the spec's six C4 table rows are six separate items
because the spec enumerates each as an independently required exact output.

**How to check** legend:
- `HOOK` — fully programmatic via `window.__wordle` (`autochecks.mjs` covers it).
- `DOM` — programmatic via DOM/computed-style heuristics in `autochecks.mjs`; the checker
  reports `skip` if it cannot auto-locate the elements (non-standard DOM) → fall back to
  screenshot judgment for that item.
- `CONSOLE` / `NET` — playwright console/pageerror/dialog/request listeners.
- `JUDGE` — human screenshot judgment (only where stated).

Scoring convention: `pass` = 1, `fail` = 0, `skip` = grade manually from a screenshot/manual
session and record pass/fail.

---

## Hook contract (spec "Test hook" section)

1. **H1 — hook shape.** `window.__wordle` exists with function members `setAnswer`, `guess`,
   `state`. HOOK: feature-detect after `file://` load.
2. **H2 — setAnswer resets.** After playing ≥1 guess, `setAnswer("CRANE")` yields
   `state() === { status:"playing", answer:"CRANE", guesses:[], evaluations:[] }` (case-insensitive
   input accepted, answer stored uppercase), board rows cleared, keyboard keys back to neutral.
   HOOK + DOM (board letters gone; a previously-colored key's background equals its pre-game
   neutral background).
3. **H3 — guess() valid path.** While playing, `guess("slate")` returns an array of exactly 5
   strings, each literally `"green"|"yellow"|"gray"`, left-to-right; returns synchronously (not a
   Promise); `state().guesses` gains `"SLATE"`; the rendered row's tiles agree. HOOK + DOM.
4. **H4 — guess() invalid path.** `guess("abc")`, `guess("abcdef")`, `guess("ab1de")`,
   `guess("ab de")` each return `null` and consume no row (`state().guesses` unchanged); same for
   any guess after the game is over. HOOK.
5. **H5 — state() shape.** Returns `{status, answer, guesses, evaluations}` with
   `status ∈ {"playing","won","lost"}`, `answer` uppercase 5-letter A–Z, `guesses` uppercase
   strings, `evaluations[i]` deep-equal to what `guess()` returned for guess i. HOOK.

## Artifact contract

6. **AC1 — self-contained single file.** The given `src/index.html` loads standalone from
   `file://`; playwright request listener sees **zero** http(s) requests; static scan of the HTML
   finds no external `src=`/`href=`/`url(...)` resource references. NET + static scan. (That the
   builder shipped exactly one file is confirmed by the harness runner listing `src/`.)
7. **AC2 — no dictionary.** Non-words are legal guesses: `guess("ZZZZZ")` and `guess("QJXVZ")`
   return 5-color arrays (not `null`) during play. HOOK.
8. **AC3 — clean load.** Zero console errors / page errors from load until first interaction.
   CONSOLE.
9. **AC4 — no dialogs.** No `alert`/`confirm`/`prompt`/native dialog fires during load or a full
   played game (playwright `dialog` event count = 0). CONSOLE.

## A. Board and input

10. **A1 — 6×5 empty board at start.** At fresh load, 6 rows × 5 columns of visibly rendered
    empty tiles. DOM heuristic (≥6 y-clustered rows of exactly 5 empty leaf elements outside the
    keyboard); on `skip` → JUDGE from screenshot.
11. **A2 — both input paths exist.** Physical typing (A–Z, Enter, Backspace via real key events)
    submits a guess, AND the on-screen keyboard has 26 letter keys + Enter + Backspace and
    clicking them submits a guess. HOOK (state deltas) + DOM (key discovery); on key-discovery
    `skip` → JUDGE.
12. **A3 — tile fill/backspace/max-5.** Keystrokes `a,b,⌫,b,c,d,e,z,Enter` produce exactly the
    guess `"ABCDE"` (the `z` beyond 5 letters is ignored; backspace removed the first `b`).
    HOOK via `state().guesses`.
13. **A4 — short submit does not consume.** Type `abc` + Enter → `state().guesses` unchanged and
    row still editable (then typing `de` + Enter submits `"ABCDE"`). No dialog allowed (covered
    by item 9). HOOK.
14. **A5 — case-insensitivity + uppercase display.** Lowercase typed/hook input is accepted
    (items 3, 12) and the board renders letters uppercase: after typing `abcde` (pre-submit), no
    visible single-letter lowercase text node exists outside the keyboard. DOM; on `skip` →
    JUDGE.

## B. Tile feedback — core colors

15. **B1 — every submitted tile gets exactly one of 3 states.** After `setAnswer("CREPE")` +
    `guess("SPEED")` (a row containing all three states), each of the 5 tiles has a resolved,
    non-transparent background color and the row maps to exactly the 3 expected state groups.
    DOM; on `skip` → JUDGE.
16. **B2 — rendered colors agree with guess() and are distinct.** Tiles with the same returned
    state share one background color; the three state colors are pairwise visually distinct
    (channel distance above tolerance); mapping tile-index → color matches the `guess()` array
    exactly. DOM; on `skip` → JUDGE (compare screenshot vs the printed `guess()` array).

## C. Duplicate-letter scoring (model-killer)

17. **C1 — normative two-pass algorithm.** Aggregate: passes iff all of items 18–25 pass
    (greens-first consumption, left-to-right yellows). HOOK.
18. **C2 — excess copies gray (probe).** `setAnswer("HOTEL")`, `guess("LLAMA")` →
    `["yellow","gray","gray","gray","gray"]` (answer has one L; second L is excess). HOOK.
    (Derived by holdout author with the spec C1 algorithm; independent of the spec's table.)
19. **C3 — greens consume before earlier yellows.** Verified by items 20 and 24: the leftmost
    duplicate copies go gray *because* a green further right consumed the letter. HOOK
    (passes iff items 20 AND 24 pass).
20. **C4-1.** `setAnswer("HOTEL")`, `guess("LEVEL")` → `["gray","gray","gray","green","green"]`. HOOK.
21. **C4-2.** `setAnswer("EATEN")`, `guess("LEVER")` → `["gray","yellow","gray","green","gray"]`. HOOK.
22. **C4-3.** `setAnswer("ERASE")`, `guess("SPEED")` → `["yellow","gray","yellow","yellow","gray"]`. HOOK.
23. **C4-4.** `setAnswer("CREPE")`, `guess("SPEED")` → `["gray","yellow","green","yellow","gray"]`. HOOK.
24. **C4-5.** `setAnswer("THOSE")`, `guess("GEESE")` → `["gray","gray","gray","green","green"]`. HOOK.
25. **C4-6.** `setAnswer("ROBOT")`, `guess("FLOOR")` → `["gray","gray","yellow","green","yellow"]`. HOOK.

## D. On-screen keyboard state coloring

Key state is read as the key's effective background color; the key palette is derived
empirically from the CREPE/SPEED game (S key = gray state, P = yellow, E = green, D = gray) and
each state color must differ from the key's recorded pre-game neutral color. If the checker
cannot auto-locate keyboard keys, these five items `skip` → JUDGE from screenshots at the stated
game positions.

26. **D1 — best-state coloring + neutral for unguessed.** After CREPE/SPEED: S and D keys share
    one color ≠ neutral; P ≠ S; E ≠ P ≠ S (three distinct guessed-states); an unguessed letter
    (Z) still has its neutral color. DOM.
27. **D2 — never downgrades.** `setAnswer("CRANE")`; after `CATER` → C key green-state, A
    yellow-state, E yellow-state; after `CRAMP` → A upgrades to green, C stays green, R green;
    after `MACRO` (where C, A, R all score only yellow in-row) → C, A, R keys STAY green and E
    stays yellow. DOM.
28. **D3 — yellow+green same row → key green.** `setAnswer("EATEN")`, `guess("LEVER")` (E is
    yellow at pos 2 AND green at pos 4) → E key shows green-state; L, V, R keys gray-state. DOM.
29. **D4 — excess-duplicate gray doesn't stick.** `setAnswer("HOTEL")`, `guess("LEVEL")` → L and
    E keys show green-state (their other copies were green) even though each also scored a gray
    tile; V key gray-state. DOM.
30. **D5 — clicking keys = typing.** Clicking on-screen `A,B,⌫,B,C,D,E,Enter` submits exactly
    `"ABCDE"` (letters fill, backspace deletes, Enter submits). HOOK via `state()` + DOM clicks.

## E. Win / lose end states

31. **E1 — win ends game.** `setAnswer("MAGIC")`, `guess("magic")` → all-green array; `state()`
    = `won`; subsequent `guess("CRANE")` returns `null`; typing 5 letters + Enter changes
    nothing; a visible in-page win message appears (checker greps rendered `innerText` for a
    win-ish message / any new text — if inconclusive it reports `skip` → JUDGE screenshot). HOOK
    + DOM/JUDGE for the message only.
32. **E2 — loss reveals answer.** `setAnswer("ZEBRA")`, 6 non-winning guesses → `state().status
    === "lost"`, rendered page `innerText` now CONTAINS `ZEBRA` (answer revealed), further
    `guess()` returns `null`. HOOK + DOM.
33. **E3 — answer hidden while playing.** With answer `ZEBRA`: at fresh state and after 1
    mid-game guess, `state().status === "playing"` and rendered `innerText` does NOT contain the
    substring `ZEBRA`. HOOK + DOM. (Final confirmation that no styling trick shows it: JUDGE
    screenshot, optional.)
34. **E4 — win on 6th guess is a win.** `setAnswer("ZEBRA")`, 5 wrong guesses, then
    `guess("zebra")` → all-green, `status === "won"` (not "lost"). HOOK.

## F. Determinism and hygiene

35. **F1 — default answer without setAnswer.** At first load (before any `setAnswer`),
    `state()` reports `status:"playing"` and a 5-letter A–Z uppercase `answer`; a guess can be
    played. HOOK.
36. **F2 — headless determinism.** Every `guess()` in this entire rubric returned its color
    array synchronously (never a Promise/undefined) and `state()` reflected it immediately, with
    no waits required for hook correctness (reveal animations may lag the DOM but never the hook).
    HOOK aggregate.
37. **F3 — no console errors across a full game.** Zero console errors / uncaught page errors
    across the whole autocheck run (load + full wins, losses, invalid inputs, clicks). CONSOLE.

---

### Runner notes

- `cd holdout && npm i -D playwright` once; then `node autochecks.mjs ../src/index.html`.
- The script prints a single JSON document: `{summary:{pass,fail,skip,total}, results:[{id,desc,status,detail}]}`
  with one result per rubric item (ids `R01`–`R37` matching the numbers above).
- Any `skip` items MUST be graded manually per the JUDGE fallback above, never auto-awarded.
- Expected answers in items 18–25 were hand-derived by the holdout author with the spec C1
  two-pass algorithm and match the spec's C4 table where they overlap (spec rows 1–6 =
  items 20–25).
