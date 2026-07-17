# Spec: Wordle (flagship, source-of-truth grade)

**Every rule here traces to `research/SOURCE-OF-TRUTH.md`** (community/canonical sources — Rosetta Code, cwackerfuss/react-wordle and verbatim ports, cfreshman word lists). Nothing is invented in this spec. Where the community had no verified source (hard mode, daily-answer scheduling) the feature is deferred, not guessed.

## Purpose

Build a correct, playable Wordle as a **single self-contained frontend**, whose tile-coloring is exactly right — including the duplicate-letter rule that breaks most clones — and whose game logic is exposed as a **headless test hook** so it can be graded objectively with no backend.

## Features

- **F1** — 6×5 grid; 6 guesses of 5-letter words.
- **F2** — per-tile coloring via the two-pass, count-consuming algorithm (below).
- **F3** — guess validity: a guess must be a member of the allowed word list (answers ∪ additional allowed guesses).
- **F4** — on-screen keyboard colored by each letter's best state so far.
- **F5** — win when a row is all-green; lose after 6 non-winning guesses (reveal the answer).
- **F6** — answer selection: random from the answer list, and settable via the test hook (see Deferred re: daily scheduling).

## The coloring algorithm (F2) — the core

```
function evaluate(answer, guess):            // both length 5, uppercased
  colors = ['gray','gray','gray','gray','gray']
  remaining = frequency count of each letter in answer
  // PASS 1 — greens: lock exact positions, CONSUME the count
  for i in 0..4:
    if guess[i] == answer[i]: colors[i] = 'green'; remaining[guess[i]] -= 1
  // PASS 2 — yellow only while an unconsumed copy remains, else gray
  for i in 0..4:
    if colors[i] == 'green': continue
    if remaining[guess[i]] > 0: colors[i] = 'yellow'; remaining[guess[i]] -= 1
  return colors
```

Invariants that MUST hold: (1) greens are computed and consumed **before** any yellow; (2) a repeated guess letter is colored green/yellow **at most** as many times as it occurs in the answer — every excess copy is gray. The naive "is this letter anywhere in the answer" check is WRONG and must not be used.

## Keyboard precedence (F4)

Each key shows its best state under the order `green > yellow > gray > unseen`. A green/yellow key is **never** downgraded to gray by a later guess; an unseen key may upgrade to any state; a yellow key **may** upgrade to green. (`state = max(state, tileColor)` under that order.)

## Acceptance criteria

- **AC1** — exactly 6 rows × 5 tiles rendered.
- **AC2** — a 5-letter guess **not** in the allowed list is rejected and does **not** consume a row (surface a non-blocking message; never a browser `alert()`/dialog).
- **AC3** — `evaluate()` locks all greens before assigning any yellow.
- **AC4** — a duplicate guess letter is green/yellow at most its count in the answer; extras gray.
- **AC5** — `evaluate()` passes **all** canonical vectors (G=green, Y=yellow, `-`=gray):

  | answer | guess | expected |
  |--------|-------|----------|
  | ALLOW | LOLLY | `Y Y G - -` |
  | BULLY | LOLLY | `- - G G G` |
  | ROBIN | SONIC | `- G Y G -` |
  | ROBIN | ALERT | `- - - Y -` |
  | ROBIN | ROBIN | `G G G G G` |
  | SPACE | PLACE | `Y - G G G` |
  | ABBEY | BOBBY | `Y - G - G` |
  | MAXIM | MAMMA | `G G Y - -` |
  | APPLE | ALLEY | `G Y - Y -` |

- **AC6** — a key at green/yellow is never downgraded to gray; unseen may upgrade to yellow/green; yellow may upgrade to green.
- **AC7** — win when a guessed row is all-green (game over, input disabled); loss after the 6th non-winning guess reveals the answer.
- **AC8** — the game logic is exposed as a headless test hook on `window.__wordle` (contract below), usable with no backend.

## Artifact contract (exact)

- `src/index.html` — a **self-contained** page (no network requests). A bundled local word-list module `src/words.js` loaded via a **relative** `<script>`/`import` is permitted (the list is large); no other external files, no CDNs.
- `src/words.js` — exports `ANSWERS` (the answer list) and `VALID_GUESSES` (answers ∪ allowed; used for F3 validity).
- **`window.__wordle` test hook** must expose:
  - `evaluate(answer, guess)` → array of 5 of `'green'|'yellow'|'gray'` (pure; the core).
  - `newGame(answer?)` → starts a game; if `answer` is given, uses it (uppercased); else random from `ANSWERS`.
  - `submitGuess(word)` → `{ accepted: boolean, reason?: string, colors?: [...], win?: boolean, over?: boolean }` (rejects invalid/short/not-in-list without consuming a row).
  - `keyboardState()` → `{ [letter]: 'green'|'yellow'|'gray' }` for letters seen so far.
  - `state()` → `{ answer, rows: [...], over: boolean, won: boolean }`.

## Deferred (no verified source of truth — do NOT invent)

- **Hard mode** — out of scope until the exact NYT rule is sourced.
- **Daily-deterministic answer** — the exact date-index formula was not verified; use random/settable instead of faking a daily schedule.
