# Holdout Vetting — task 08-poker (Poker Hand Ranking)

Independent holdout author record. The builder never sees this directory.

## Answer-key source

- **Source:** Exercism problem-specifications — poker `canonical-data.json` (the community's own answer key; RESEARCH.md source S2)
- **URL:** https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/poker/canonical-data.json
- **Local copy:** `holdout/canonical-data.json` (byte-verbatim per RESEARCH.md)
- **SHA256 (verified this session with `Get-FileHash`):** `90E3333454675B72389FF04CC9C8123A2097800427215095FD91BF9611C2371A` — matches the hash recorded in `research/RESEARCH.md` ("Holdout integrity").

## Case accounting

| Count | What |
|---|---|
| **39** | Total raw cases in `canonical-data.json` (all `"property": "bestHands"`) |
| **37** | Translated into vitest tests (one test per effective case, description preserved verbatim as the test name) |
| **2** | Excluded |

### Excluded cases (and why)

Both exclusions are **superseded cases**, excluded per the problem-specifications
data format itself (RESEARCH.md source S6, convention C5): a case bearing
`"reimplements": "<uuid>"` REPLACES the referenced case, so a mechanical
translation includes only the newest version of each case. The reimplementing
versions ARE in the suite; the two originals they replace are not. This is
format-mandated deduplication, not an adaptation of any case.

1. `eb856cc2-481c-4b0d-9835-4d75d07a5d9d` — "with multiple decks, two players can
   have same three of a kind, ties go to highest remaining cards" — superseded by
   `26a4a7d4-34a2-4f18-90b4-4a8dd35d2bb1` (included; canonical comment: "Ensure
   that high cards are checked in the correct order (high to low).").
2. `4d90261d-251c-49bd-a468-896bf10133de` — "both hands have a flush, tie goes to
   high card, down to the last one if necessary" — superseded by
   `e04137c5-c19a-4dfc-97a1-9dfe9baaa2ff` (included; same canonical comment).

No case was excluded for translation difficulty; none was adapted or weakened.

### Error cases

The canonical data specifies **zero** error cases (no case has an `expected.error`
field), so the suite contains no thrown-Error tests. This matches spec.md ("No
input validation is required") and RESEARCH.md D2/D3.

## Translation mechanics

- `holdout/tests/poker.test.mjs` reads `../canonical-data.json` at test time and
  generates one `it(case.description, ...)` per effective case — zero hand
  transcription, so transcription drift is impossible.
- Candidate imported from the contract path: `../../src/poker.mjs`, named export
  `bestHands(hands)` (spec.md "Artifact contract").
- Assertion: `expect(bestHands(input.hands)).toEqual(expected)` — enforces
  verbatim winner strings AND input-relative order, exactly as pinned by spec.md
  and RESEARCH.md convention C3 (the canonical `expected` arrays are already in
  input order).
- Load-time integrity guards in the test file throw if the frozen data drifts
  from 39 raw / 37 effective cases or if any case's `property` is not
  `bestHands`.

## Harness validation (known-good reference)

The suite was executed against a throwaway reference implementation written by
the holdout author in the session scratchpad (never shipped, not in this repo):
**37/37 tests passed** (vitest 3.2.7, Node ES modules). This validates the
harness itself; the builder's `src/poker.mjs` was neither read nor executed.

## Run

```
cd holdout
npm install
npm test        # = vitest run
```
