# Wordle — Community Source of Truth (for the flagship loop video)

**Compiled 2026-07-17 via the deep-research harness** (6 angles, 22 sources, 25 claims adversarially verified — **25 confirmed, 0 refuted**). Every rule below traces to an external source; nothing here was invented by us. This is the "how the world defines it" doc the video's spec + one-shot prompt are built from.

---

## 1. Official rules (NYT)

6 guesses to find a 5-letter word on a 6×5 grid. Tile colors: **green** = right letter, right position; **yellow** = right letter, wrong position; **gray** = no remaining unmatched copy of that letter. A guess must be a real word **in Wordle's allowed list** (it rejects some real words with "not in word list").
- Source: Beebom explainer (secondary, ubiquitous fact) + Wikipedia corroboration.
- Precision note: "gray = not in the answer" is the lay phrasing and is **wrong for duplicates** — see §2.

## 2. THE CORE — duplicate-letter coloring algorithm ★

This is the famous silent-failure that separates correct clones from broken ones. The canonical, verified-across-4-primary-implementations algorithm is a **two-pass, count-consuming** evaluator:

```
function evaluate(answer, guess):            // both length 5, uppercased
  colors = ['gray','gray','gray','gray','gray']
  remaining = frequency count of each letter in answer     // e.g. {A:1, B:2, ...}

  // PASS 1 — greens: lock exact positions, CONSUME that letter's count
  for i in 0..4:
    if guess[i] == answer[i]:
      colors[i] = 'green'
      remaining[guess[i]] -= 1

  // PASS 2 — yellow only while an unconsumed copy remains, else gray
  for i in 0..4:
    if colors[i] == 'green': continue
    if remaining[guess[i]] > 0:
      colors[i] = 'yellow'
      remaining[guess[i]] -= 1
    // else stays 'gray'

  return colors
```

**The only two invariants that matter:** (1) greens are computed and consumed **before** any yellow; (2) yellows are **bounded by the remaining count** of each letter. The naive "is this letter anywhere in the answer?" presence-check violates (2) and over-marks extra copies — that's the bug.

- Plain-English rule (Rosetta Code, verbatim): *"Multiple instances of the same letter in a guess … will be colored green or yellow only if the letter also appears multiple times in the answer; otherwise, excess repeating letters will be colored gray."*
- Verified verbatim in: [dgvai/wordle-algorithm](https://github.com/dgvai/wordle-algorithm) (boolean-ledger form), [NacomiTagiera/Wordle](https://github.com/NacomiTagiera/Wordle) (splice-from-copy form), [jlumbroso/wordle-react-clone](https://github.com/jlumbroso/wordle-react-clone) (`remainder.replace` form), [Rosetta Code "Wordle comparison"](https://rosettacode.org/wiki/Wordle_comparison) (blank-the-letter form). dgvai & NacomiTagiera are verbatim ports of the 18k-star [cwackerfuss/react-wordle](https://github.com/cwackerfuss/react-wordle) `statuses.ts`.
- Great teaching write-up: [jonahlawrence — "Why most Wordle clones are wrong"](https://jonahlawrence.hashnode.dev/why-most-wordle-clones-are-wrong).

## 3. Keyboard letter-state precedence

Each on-screen key shows its **best state so far**: `green > yellow > gray > unseen`. A green/yellow key must **never** be downgraded to gray by a later guess; an unseen key may upgrade to any state; **yellow may upgrade to green**.
- Source: NacomiTagiera reducer (verbatim). ⚠ Note: that reference has a *bug* — its guard also blocks yellow→green upgrades. A fully-correct clone must allow improvement in the upgrade direction. So we spec `state = max(state, tileColor)` under the precedence order.

## 4. Word lists (the two-list convention)

Extracted from the pre-NYT source code and mirrored by cfreshman's gists:
- **Answers list:** ~2,315 words ([cfreshman a03ef2](https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b)). (NYT later trimmed to 2,309 by removing agora, pupal, lynch, fibre, slave, wench.)
- **Additional allowed guesses:** 10,657 words ([cfreshman cdcdf777](https://gist.github.com/cfreshman/cdcdf777450c5b5301e439061d29694c)).
- **Total valid guesses = answers ∪ allowed = 12,972.** Combined single file: [tabatkins/wordle-list](https://github.com/tabatkins/wordle-list) (~12,966).
- A guess is valid iff it's a member of the union. Answers are a subset of the guess pool.

## 5. Canonical acceptance test vectors (the answer key) ★

`answer, guess → colors` (G=green, Y=yellow, `-`=gray). Duplicate-stressing cases marked ★.

| # | answer | guess | expected | source |
|---|--------|-------|----------|--------|
| 1 ★ | ALLOW | LOLLY | `Y Y G - -` | Rosetta Code (mandated test data) |
| 2 ★ | BULLY | LOLLY | `- - G G G` | Rosetta Code |
| 3 | ROBIN | SONIC | `- G Y G -` | Rosetta Code |
| 4 | ROBIN | ALERT | `- - - Y -` | Rosetta Code |
| 5 | ROBIN | ROBIN | `G G G G G` | Rosetta Code |
| 6 | SPACE | PLACE | `Y - G G G` | NacomiTagiera Jest (`place`/`space`) |
| 7 ★ | ABBEY | BOBBY | `Y - G - G` | hand-verified via §2 algorithm |
| 8 ★ | MAXIM | MAMMA | `G G Y - -` | hand-verified via §2 algorithm |
| — ★ | APPLE | ALLEY | `G Y - Y -` | classic teaching example (2nd L gray) |

## 6. Formal specs that already exist (citable)

- **Rosetta Code "Wordle comparison"** — a genuine formal task: `evaluate(answer, guess) → 5 colors`, mandated test data (vectors 1–5 above), correct two-pass reference in many languages. **Use verbatim as acceptance criteria.**
- **UNC COMP110 EX03 "Structured Wordle"** — clean function contract `emojified(guess, secret)` + `assert len(guess)==len(secret)`. ⚠ **Cite for the signature/emoji contract only — its algorithm is the NAIVE presence-check and its own worked example (`hello`/`world`) is *wrong* for the duplicate.** It is the canonical example of the bug, not the fix.

## 7. Discriminating surface (why it still catches models despite being common)

Wordle is heavily in training data, so a bare clone is easy. What still trips one-shot builds:
1. **The duplicate-letter rule (§2)** — the #1 silent failure. This is the video's catch.
2. **Keyboard best-state precedence (§3)** — downgrades and missed yellow→green upgrades.
3. Guess-validity against the real allowed list (§4) rather than "any 5 letters."

---

## Consolidated build spec (source-grounded)

**Features:** F1 6×5 grid, 6 guesses. F2 per-tile coloring via the §2 two-pass algorithm. F3 guess validity against the allowed list (answers ∪ 10,657). F4 keyboard best-state coloring. F5 win on all-green, lose after 6. F6 answer selection (see deferred).

**Acceptance criteria:**
- **AC1** exactly 6 rows × 5 tiles.
- **AC2** a 5-letter guess not in the allowed list is rejected and does **not** consume a row.
- **AC3** `evaluate()` locks all greens before any yellow.
- **AC4** a duplicate guess letter is colored green/yellow at most as many times as it occurs in the answer; extra copies gray.
- **AC5** `evaluate()` passes **all** of the §5 vectors.
- **AC6** a key at green/yellow is never downgraded to gray; unseen may upgrade to yellow/green; yellow may upgrade to green.
- **AC7** win when a guessed row is all-green (game over); loss after the 6th non-winning guess reveals the answer.
- **AC8** `evaluate(answer, guess)` is a **pure function exposed as a headless test hook** (e.g. `window.evaluate` / `window.__wordle`) returning 5 color codes — no backend.

## Deferred (NO verified source of truth found — do NOT invent)

Per our rule "don't invent rules," these are **out of scope** until sourced:
- **Hard Mode** — the exact NYT definition (revealed hints must be reused) was requested but **not covered by any verified claim**. Leave out, or research separately before adding.
- **Daily-deterministic answer selection** — the exact date-index formula original Wordle used was **not verified**. Default to a random/settable answer (settable via the test hook is what matters for grading); do not fake a "daily" schedule.

## Caveats (from the verification pass)

- Core algorithm / vectors / keyboard / word-list findings rest on **primary** sources (4 repos verified verbatim, cfreshman gists fetched directly, Rosetta via raw MediaWiki). High confidence.
- The official-rules finding rests on a **secondary** explainer (facts are ubiquitous + cross-corroborated), not an NYT-primary citation.
- Word lists are the **pre-NYT snapshot**; faithful to original Wordle, not today's hand-curated daily answer.
