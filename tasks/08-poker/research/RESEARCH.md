# Research — Poker Hand Ranking (task 08-poker)

Stage-1 research record. Every correctness rule in `spec.md` traces to a source below.
Meta-rule honored: no requirement was invented by the author. This task is fully
outsourced to the Exercism community: the exercise definition, the answer key, and the
ranking rules (via the reference the exercise itself cites) are all community-canonical.

---

## 1. Sources

| # | Source | Authority level | URL |
|---|--------|-----------------|-----|
| S1 | **Exercism problem-specifications — poker `description.md`** (the canonical exercise statement; saved verbatim to `research/description-verbatim.md`) | PRIMARY — defines the task | https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/poker/description.md |
| S2 | **Exercism problem-specifications — poker `canonical-data.json`** (the community's own answer key; saved verbatim to `holdout/canonical-data.json`) | PRIMARY — answer key | https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/poker/canonical-data.json |
| S3 | Exercism problem-specifications — poker exercise directory (confirms S1/S2 are the only spec files for this exercise) | Primary index | https://github.com/exercism/problem-specifications/tree/main/exercises/poker |
| S4 | **Wikipedia — List of poker hands** (the ranking reference S1 itself cites; hand categories, tie-breaks, ace-low rule, suit-equality rule) | PRIMARY-BY-REFERENCE — S1 delegates the rules to it | https://en.wikipedia.org/wiki/List_of_poker_hands |
| S5 | Aider polyglot-benchmark repo (community LLM benchmark; ships this exact exercise — `javascript/exercises/practice/poker/.docs/instructions.md` is byte-identical in body to S1, retitled "Instructions") | Corroborating / contamination evidence | https://github.com/Aider-AI/polyglot-benchmark |
| S6 | Exercism problem-specifications repo README (canonical-data format: `reimplements` semantics, case schema) | Primary — data-format authority | https://github.com/exercism/problem-specifications |

Fetch date for all sources: 2026-07-12.

**Holdout integrity:** `holdout/canonical-data.json` downloaded byte-verbatim from S2.
SHA256 = `90E3333454675B72389FF04CC9C8123A2097800427215095FD91BF9611C2371A`.
39 cases total, all `"property": "bestHands"`, of which 2 carry `"reimplements"`
(superseding earlier cases → 37 effective cases for a mechanical translation).

---

## 2. Adopted correctness rules (each with citation)

### R1. Task statement (S1, verbatim and complete)
The entire Exercism description is three lines: "Pick the best hand(s) from a list of
poker hands. See [Wikipedia][poker-hands] for an overview of poker hands." with the link
pointing to S4. Consequence: S4 is not a convenience source — it is the rules authority
**designated by the exercise itself**.

### R2. Hand categories, highest to lowest (S4)
Straight flush > four of a kind > full house > flush > straight > three of a kind >
two pair > one pair > high card. S4 lists "royal flush" first, but defines it as an
ace-high straight flush — see D1 for the convention adopted.

### R3. Kicker/tie-break comparisons within a category (S4)
S4: within a category, hands rank by the defining group's rank first, then remaining
cards ("kickers") compared in descending order — e.g. four of a kind "first by the rank
of its quadruplet, and then by the rank of its kicker"; flushes/high cards "first by the
rank of its highest-ranking card, then by the rank of its second highest-ranking card,"
and so on through all five. spec.md's per-category tie-break list is a direct transcription.

### R4. Ace high-or-low; wheel; no wrap-around (S4)
S4 (verbatim): "an ace can rank either high (as in A K Q J 10, a royal flush) or low
(as in 5 4 3 2 A, a five-high straight flush), but cannot simultaneously rank both high
and low (so Q K A 2 3 is an ace-high flush, but not a straight)." The five-high straight
(wheel) is the lowest straight; its high card is the 5.

### R5. Suits never break ties (S4)
S4: "hands that differ by suit alone ... are of equal rank." Consequence: exact ties are
possible and ALL tied top hands win — which is also the exercise's own framing ("best
hand(s)", S1).

### R6. Five of a kind OUT of scope (S4 + S2)
S4: five of a kind is "only possible when using one or more wild cards." This exercise
has no wild cards, and S2 contains no five-of-a-kind case. spec.md excludes it explicitly.

### R7. Return type is a LIST of winners (S1 + S2)
"Best hand(s)" (S1); S2's `expected` is always a JSON array of hand strings, singular or
plural. Pinned in spec.md: `bestHands(hands) -> array`, length >= 1.

---

## 3. Conventions pinned by research (where sources leave a choice open)

### C1. Card/hand string format — from the answer key's own inputs (S2)
S1 does not specify an input format, so the format is taken from S2 verbatim: hand =
five space-separated cards; card = rank+suit; ranks `2..10 J Q K A` with ten as the
two-character `10` (S2 uses `10H`, `10D`, `10C`, `10S`; `T` never appears); suits
`S H D C`. Pinned in spec.md exactly, with the task-brief example hand `"4S 5S 7H 8D JC"`
(which is S2's first case input — the one example the orchestrator's brief itself quotes).

### C2. API name and signature (S2 + task brief)
S2's single `property` is `bestHands` with `input.hands` an array of strings. Pinned:
`src/poker.mjs` exporting `bestHands(hands)`. File path/module form set by the
benchmark's house contract (ES module, `.mjs`, `src/`), matching sibling tasks.

### C3. Output = verbatim input strings, input order preserved (S2)
S2's `expected` arrays always contain the exact input strings; in the one multi-winner
case the winners appear in input order. Pinned in spec.md: byte-identical strings,
input-relative order. (A grader could sort instead; we pin order so the contract is
deterministic — the holdout author should compare as sets OR rely on this pinned order,
both consistent with S2.)

### C4. Multiple decks are legal input (S2)
Three S2 case descriptions begin "with multiple decks ..." — duplicate cards across
hands are legal and identical-structure hands must resolve by kickers or tie. Pinned in
spec.md as "no validation; multiple decks possible." Builders must NOT reject duplicate
cards.

### C5. `reimplements` semantics — for the holdout author (S6)
Per the problem-specifications format, a case bearing `"reimplements": "<uuid>"`
REPLACES the referenced case; a mechanical translation should include only the newest
version of each case (39 raw → 37 effective). The 2 reimplementations both exist to
"ensure that high cards are checked in the correct order (high to low)" (S2 comments) —
keep the reimplementing versions, drop the two superseded ones.

---

## 4. Disagreements / judgment calls noted

### D1. "Royal flush" as a category
S4's popular table lists royal flush above straight flush; S4's own text defines it as
just the ace-high straight flush, and S2 files its royal-flush-adjacent cases under
"straight flush" descriptions ("aces can end a straight flush"). **Convention picked:**
9 categories, no separate royal-flush category (it is the highest straight flush).
Zero behavioral impact — the ace-high straight flush still beats everything.

### D2. Input validation
S1 says nothing about malformed input and S2 contains no error cases. **Convention
picked:** no validation required; all inputs well-formed (C1). Spec says so explicitly
so builders don't burn effort or add behavior the answer key never exercises.

### D3. Empty input list
S2 never passes an empty `hands` array. **Convention picked:** input is non-empty
(stated in spec.md); behavior on `[]` is deliberately unspecified and MUST NOT be
tested by the holdout.

---

## 5. Contamination note

**HIGH.** The Exercism poker exercise is one of the most-solved public katas: the
problem-specifications repo, every language track's test suite, and thousands of public
solutions are certainly in model training data. It additionally ships verbatim in the
aider polyglot-benchmark (S5), a widely used LLM coding benchmark. Expect models to have
memorized both the exercise and typical solutions; this task measures faithful
spec-following and correctness on a known problem, not novel problem solving. Recorded
in `metadata.json`.

---

## 6. Files produced by this stage

- `spec.md` — builder brief (description-derived; no canonical-data cases leaked beyond
  the brief's own example hand and the rules S1 delegates to S4)
- `frozen-prompt.md` — one-shot prompt, community wording verbatim where it exists
- `holdout/canonical-data.json` — answer key, byte-verbatim from S2 (hash above)
- `research/description-verbatim.md` — S1 saved verbatim (evidence)
- `research/RESEARCH.md` — this file
- `metadata.json`
