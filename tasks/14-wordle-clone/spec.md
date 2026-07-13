# Task 14 — Wordle Clone (one-shot, NYT rules)

## Purpose

Build a playable Wordle clone that reproduces the published NYT Wordle behavior:
6 guesses of 5-letter words, green/yellow/gray tile feedback **including the exact
duplicate-letter rules**, an on-screen keyboard with state coloring, and win/lose
end states. The duplicate-letter tile logic is the known model-killer edge case and
is tested explicitly below with concrete guess/answer examples.

All rules in this spec trace to external authorities (see `research/RESEARCH.md`);
nothing here was invented by the spec author.

## Artifact contract

1. **Deliverable:** exactly one file, `src/index.html`, fully self-contained
   (all CSS and JavaScript inline; no external resources, no network requests,
   no imports, no CDN links).
2. **No dictionary requirement.** The game MUST accept **any** 5-letter guess
   consisting of letters A–Z (case-insensitive). There is no valid-word check.
   (This deliberately deviates from NYT Wordle, which validates guesses against a
   word list — stated here so the builder does not add one.)
3. The page must work when opened directly from disk (`file://`) in a modern
   Chromium browser with zero console errors.
4. No `alert()`, `confirm()`, `prompt()`, or any other OS/browser dialog. All
   messages render in the page itself.

## Test hook (required for deterministic verification)

Expose a global object `window.__wordle` with exactly these members:

- `setAnswer(word)` — sets the secret answer to `word` (any 5-letter A–Z string,
  case-insensitive) **and resets the game to a fresh state** (empty board, all
  keyboard keys uncolored, status `"playing"`). This is a test convention, not a
  Wordle rule.
- `guess(word)` — plays `word` as a guess through the SAME code path as typing +
  Enter. On a valid 5-letter A–Z guess while the game is `"playing"`, it returns
  an array of exactly 5 strings, each `"green"`, `"yellow"`, or `"gray"`, in
  board (left-to-right) order, and the UI updates (tiles colored, keyboard
  updated, row consumed). On an invalid guess (wrong length, non-letter
  characters) or when the game is already over, it returns `null` and the game
  state is unchanged (no row consumed).
- `state()` — returns an object:
  `{ status: "playing"|"won"|"lost", answer: <uppercase string>, guesses: <array of uppercase guessed words>, evaluations: <array of per-guess color arrays as returned by guess()> }`.

## Acceptance criteria

### A. Board and input

- **A1.** The board is a 6-row × 5-column grid of tiles, all empty at start.
  (6 attempts at a 5-letter word — Wikipedia/NYT.)
- **A2.** Letters can be entered with the physical keyboard (A–Z, Enter,
  Backspace) AND by clicking the on-screen keyboard (26 letter keys plus an
  Enter key and a Backspace/delete key).
- **A3.** Typing a letter fills the next empty tile of the current row (max 5);
  Backspace clears the most recent letter of the current row.
- **A4.** Enter submits only when the current row has exactly 5 letters. A
  submission attempt with fewer than 5 letters does NOT consume a guess and
  leaves the row editable (a visible "not enough letters"-style message or shake
  is acceptable but not required; a dialog is not allowed).
- **A5.** Input is case-insensitive; the board displays letters uppercase.

### B. Tile feedback — core colors

- **B1.** After a submitted guess, every tile in that row is colored exactly one
  of: **green** = right letter in the right spot; **yellow** = letter is in the
  answer but in a different spot; **gray** = letter gets no credit (not in the
  answer at all, or all of its occurrences in the answer are already credited).
- **B2.** The three tile states must be visually distinct and ALSO must be
  programmatically distinguishable (the `guess()` return array is the source of
  truth for verification; the rendered tile colors must agree with it).

### C. Tile feedback — duplicate-letter rules (the model-killer; test these exactly)

The scoring algorithm, as documented for NYT Wordle (citations in
`research/RESEARCH.md`): each letter of the answer can be "consumed" at most
once. Greens are evaluated first; remaining yellows are awarded strictly
left-to-right; once all occurrences of a letter in the answer are consumed, any
further copies of that letter in the guess are gray.

- **C1.** Equivalent two-pass algorithm (normative):
  - Pass 1 (greens): for each position i, if `guess[i] === answer[i]`, mark
    green and consume one occurrence of that letter from the answer's letter
    counts.
  - Pass 2 (yellows/grays), left to right over the non-green positions: if the
    remaining count of `guess[i]` is > 0, mark yellow and consume one
    occurrence; otherwise mark gray.
- **C2.** A letter guessed more times than it appears in the answer gets credit
  (green/yellow) only as many times as it appears in the answer; the excess
  copies are gray.
- **C3.** Greens take priority over yellows: an exact match elsewhere in the row
  consumes an occurrence BEFORE any yellow for the same letter is awarded, even
  if the yellow candidate is further left in the row.
- **C4.** The following concrete cases must produce EXACTLY these outputs
  (format: result of `guess()` after `setAnswer()`):

  | # | Answer | Guess | Required result (positions 1→5) | What it proves |
  |---|--------|-------|--------------------------------|----------------|
  | 1 | HOTEL | LEVEL | gray, gray, gray, green, green | Excess L and E go gray even though L and E are in the answer; green consumed them (greens-first). |
  | 2 | EATEN | LEVER | gray, yellow, gray, green, gray | Same letter yellow AND green in one row when the answer has it twice (E at pos 2 yellow, E at pos 4 green). |
  | 3 | ERASE | SPEED | yellow, gray, yellow, yellow, gray | Both guessed E's earn yellow because the answer has two E's; S yellow; D gray. |
  | 4 | CREPE | SPEED | gray, yellow, green, yellow, gray | One E green (exact), the second E yellow (answer has two E's); P yellow; S and D gray. |
  | 5 | THOSE | GEESE | gray, gray, gray, green, green | Both extra E's gray: the answer's single E is consumed by the green at position 5. |
  | 6 | ROBOT | FLOOR | gray, gray, yellow, green, yellow | Guess has two O's, answer has two O's: one green, one yellow; R yellow. |

  Each row above was hand-derived with the normative C1 algorithm and
  cross-checked against the cited explainers (rows 1 and 2 appear verbatim in
  the sources; see `research/RESEARCH.md`).

### D. On-screen keyboard state coloring

- **D1.** After each submitted guess, each guessed letter's key on the on-screen
  keyboard is colored with the BEST state that letter has achieved across all
  guesses so far, with precedence **green > yellow > gray**. Unguessed letters
  stay in the neutral/uncolored state.
- **D2.** A key never downgrades: once green it stays green; once yellow it can
  only change to green; a gray key stays gray (it cannot become yellow/green
  under correct scoring, since gray means no remaining occurrences credit —
  but the precedence rule must be implemented, not assumed).
- **D3.** Within a single guess where the same letter is both yellow and green
  in the row (e.g. answer EATEN, guess LEVER), the key shows green.
- **D4.** A letter that scored gray only as an EXCESS duplicate (e.g. the L's of
  LEVEL vs HOTEL, where another copy was green) must NOT leave the key gray:
  the key shows the best state (green in that example).
- **D5.** Clicking keyboard keys must input letters exactly like the physical
  keyboard (A2), including Enter and Backspace keys.

### E. Win / lose end states

- **E1.** Win: a guess with all 5 tiles green immediately ends the game; a
  visible in-page win message appears; `state().status === "won"`; further
  guesses are ignored (`guess()` returns `null`, typing does nothing).
- **E2.** Lose: after the 6th submitted guess, if it is not all green, the game
  ends; the answer is revealed in a visible in-page message;
  `state().status === "lost"`; further guesses are ignored as in E1.
- **E3.** Before the game ends, `state().status === "playing"` and the answer is
  never displayed anywhere in the visible page.
- **E4.** A win on the 6th guess is a win (win check happens before the
  out-of-guesses check).

### F. Determinism and hygiene

- **F1.** Without `setAnswer`, the game must still be playable (pick any
  5-letter default/random answer at load — no dictionary required).
- **F2.** `setAnswer` + `guess` + `state` must allow a full game to be driven
  headlessly with no user interaction and no timing dependence (any reveal
  animation must not delay or corrupt the `guess()` return value or `state()`).
- **F3.** No console errors during load or a full played game.

## Out of scope (do NOT build)

Word-list validation, hard mode, daily-puzzle date logic, statistics/streaks,
share-to-emoji, dark-mode toggle, animations beyond basic tile coloring,
persistence/localStorage.
