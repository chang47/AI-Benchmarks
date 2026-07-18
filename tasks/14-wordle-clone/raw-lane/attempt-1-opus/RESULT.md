# Raw-lane attempt 1 — Opus, blind, weak prompt

**Date:** 2026-07-17 · **Model:** Claude Opus 4.8 · **Lane:** raw (no fix loop against our answer key)

## Setup

A fresh general-purpose subagent with **no conversation context** and **no access to this repo**
(spec, answer key, and reference implementation all hidden). It was given only a **weak prompt**:
the standard Wordle rules (6 guesses; green = right spot, yellow = in word wrong spot, gray = not
in word) + the `window.__wordle` hook contract so it would be gradable — but **the duplicate-letter
algorithm was deliberately withheld**, and it was told to implement the coloring from its own
understanding and not to search the web. A `words.js` (same canonical list) was staged in its
isolated dir. It was free to write and run its own tests before claiming done.

Prompt: this task's `frozen-prompt.md` is the *strong* version; the weak wording used here is the
"raw lane" described in `research/SOURCE-OF-TRUTH.md` §7.

## Result — PASS (no fake convergence)

Graded against the frozen 9 canonical vectors + ACs (`../../holdout/vectors.json`):

```
vectorsPass: true      // all 9, incl. every duplicate case:
                       //   ALLOW/LOLLY, BULLY/LOLLY, ABBEY/BOBBY, MAXIM/MAMMA, APPLE/ALLEY
failed: []
AC2 (rejects invalid/short guesses, no row consumed): pass
AC7 (win locks the game): pass
console/page errors: none
```

Its `evaluate` is a correct **two-pass, count-consuming** implementation ("two-pass, duplicate-safe"
in its own comment). It also wrote its own `test.mjs` + `uitest.mjs` and screenshotted before
finishing.

## Takeaway

**Wordle does not produce the fake-convergence beat on a frontier model.** It's saturated enough
(and Opus strong enough) that a blind one-shot lands the duplicate rule correctly. This is the
outcome flagged as likely in `SOURCE-OF-TRUTH.md` §7 / §caveats.

Implications for the flagship loop video:
- To keep a **catchable failure**, either (a) move to a **multi-feature app** where many *visible*
  requirements can be missed (e.g. a budget/finance dashboard — running balance, category totals,
  edit/delete, rounding, persistence), or (b) run the raw lane on a **weaker/smaller model** (likely
  botches the duplicate), or (c) use a **less-saturated Wordle variant** (novel rule not in training
  data).
- The strong-prompt "foundations → reliable one-shot" positive demo still holds and is worth keeping.

Files here: `index.html` (the blind build), `test.mjs` / `uitest.mjs` (its own self-checks),
`screenshot.png`. It imports the same `words.js` as `../../src/`. Grade reproducible via the frozen
harness pointed at this `index.html`.
