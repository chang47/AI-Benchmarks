# Frozen one-shot prompt — Wordle (STRONG / foundations version)

> This is the **strong** prompt: it hands the model the foundations (the exact duplicate-letter
> algorithm + the grading hook) so a good model can one-shot a *correct* Wordle. It's the "with
> a well-founded prompt, you get a reliable one-shot" lane. The **weak/naive** prompt for the
> raw-lane fake-convergence demo lives separately (see `research/SOURCE-OF-TRUTH.md` §7 — a bare
> "build a Wordle clone" with no duplicate guidance). Freeze this wording; run best-of-3.

---

Build a playable **Wordle** game as a single self-contained web page. Deliver two files only: `index.html` and `words.js` (a local module I will provide, exporting `ANSWERS` and `VALID_GUESSES` as arrays of uppercase 5-letter words). No network requests, no CDNs, no other files.

**Game:** 6 guesses to find a hidden 5-letter word on a 6×5 grid. After each guess, color its 5 tiles green / yellow / gray, color the on-screen keyboard, and win on all-green or lose after 6.

**Tile coloring — implement EXACTLY this two-pass algorithm (do not use a naive "is the letter in the word" check, which is wrong for repeated letters):**

```
evaluate(answer, guess):            // both length 5, uppercase
  colors = ['gray'] * 5
  remaining = letter-frequency count of answer
  // PASS 1 — greens first, and CONSUME the count
  for i in 0..4:
    if guess[i] == answer[i]: colors[i]='green'; remaining[guess[i]] -= 1
  // PASS 2 — a letter is yellow ONLY while an unconsumed copy remains, else gray
  for i in 0..4:
    if colors[i]=='green': continue
    if remaining[guess[i]] > 0: colors[i]='yellow'; remaining[guess[i]] -= 1
  return colors
```

Rule in words: a repeated guess letter is colored green/yellow **at most as many times as it occurs in the answer**; every extra copy is gray. Example: answer `APPLE`, guess `ALLEY` → `green, yellow, gray, yellow, gray` (the second `L` is gray because `APPLE` has only one `L`, already used).

**Keyboard:** each key shows its best state so far under `green > yellow > gray`. Never downgrade a green/yellow key to gray on a later guess; a yellow key may later upgrade to green.

**Guess validity:** a submitted guess must be exactly 5 letters AND a member of `VALID_GUESSES`. Reject anything else with a small inline message (a shake/toast) — do **not** use `alert()` or any blocking dialog, and do **not** consume a guess row for a rejected word.

**Answer:** pick a random word from `ANSWERS` at game start.

**Expose a headless test hook** on `window.__wordle` so the game can be graded without a UI:
- `evaluate(answer, guess)` → array of 5 of `'green'|'yellow'|'gray'` (the pure function above)
- `newGame(answer?)` → start a game; use `answer` (uppercased) if given, else random from `ANSWERS`
- `submitGuess(word)` → `{ accepted, reason?, colors?, win?, over? }`
- `keyboardState()` → `{ [letter]: 'green'|'yellow'|'gray' }`
- `state()` → `{ answer, rows, over, won }`

Make it clean and playable (grid, physical + on-screen keyboard, win/lose feedback), but correctness of the coloring and the hook is what matters most.
