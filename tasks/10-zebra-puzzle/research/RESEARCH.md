# Research — Task 10: Zebra Puzzle (Exercism canonical)

Researched 2026-07-12. Meta-rule: every requirement traces to an external authority; nothing invented by an agent.

## Authorities (fetched 2026-07-12)

| # | Source | Role | URL |
|---|--------|------|-----|
| A1 | Exercism problem-specifications — `zebra-puzzle/instructions.md` | **Primary**: the 15 statements, the two questions, the note on 5!⁵ search-space pruning. Quoted verbatim in spec.md §1. | https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/zebra-puzzle/instructions.md |
| A2 | Exercism problem-specifications — `zebra-puzzle/introduction.md` | Framing: puzzle is a CSP; all statements needed jointly. Quoted verbatim in spec.md §1. | https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/zebra-puzzle/introduction.md |
| A3 | Exercism problem-specifications — `zebra-puzzle/canonical-data.json` | **Answer key** (2 cases: `drinksWater`, `ownsZebra`). Saved **verbatim** to `holdout/canonical-data.json`. Deliberately NOT restated here or in spec.md/frozen-prompt.md — the holdout author translates it mechanically. | https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/zebra-puzzle/canonical-data.json |
| A4 | Exercism problem-specifications — `zebra-puzzle/metadata.toml` | Attribution: `source = "Wikipedia"`, `source_url = "https://en.wikipedia.org/wiki/Zebra_Puzzle"`. | https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/zebra-puzzle/metadata.toml |
| A5 | Wikipedia — Zebra Puzzle (original: Life International, 17 Dec 1962) | Provenance of the puzzle + the standard left-to-right house-ordering interpretation pinned in spec.md §2. | https://en.wikipedia.org/wiki/Zebra_Puzzle |
| A6 | Aider polyglot-benchmark — `javascript/exercises/practice/zebra-puzzle/` | Community precedent that this exact exercise is used to benchmark coding LLMs; JS-track API surveyed (see Disagreements). Directory confirmed present 2026-07-12 (`zebra-puzzle.js`, `zebra-puzzle.spec.js`, `.docs`, `.meta`). | https://github.com/Aider-AI/polyglot-benchmark |

Fetch notes:
- The task brief's URL `exercises/zebra-puzzle/description.md` returned **404**; the repo's actual files are `instructions.md` + `introduction.md` (confirmed via the GitHub contents API for `exercises/zebra-puzzle`). A1/A2 are the correct canonical description.
- `holdout/canonical-data.json` was downloaded byte-verbatim with `Invoke-WebRequest` (not transcribed by a model).

## Adopted rules and where each comes from

| Adopted item | Authority |
|---|---|
| The 15 statements, exact wording (spec.md §1) | A1, verbatim |
| The two questions (water drinker, zebra owner) | A1 |
| "each house a different color / inhabitants different nationalities, pets, beverages, hobbies" (bijection per category) | A1, closing paragraph |
| 5 categories × 5 values; value lists (red/green/ivory/yellow/blue; Englishman/Spaniard/Ukrainian/Norwegian/Japanese; dog/snails/fox/horse/zebra; coffee/tea/milk/orange juice/water; dancing/painting/reading/football/chess) | A1 — every value is named in a statement or question; no extras invented |
| Puzzle is a CSP; solve by constraint search, not lookup | A2 (framing) + benchmark meta-rule (anti-hardcode contract is ours, see Conventions) |
| 5!⁵ = 24,883,200,000; naive full enumeration discouraged → 10 s bound | A1 note (the number is Exercism's own); the 10 s bound is our benchmark convention |
| Houses in a row, numbered 1–5 left to right; first = leftmost; middle = house 3; "immediately to the right" = position+1; "next to" = |Δpos| = 1 | A5 (standard interpretation of the original 1962 puzzle; Exercism inherits it via A4 attribution). Pinned explicitly because A1 leaves it implicit and the solution's uniqueness depends on a fixed orientation. |
| Answer strings = nationality demonyms exactly as spelled in A1 | A1 (statement wording) + A3 (the canonical `expected` values are nationality strings — string type confirmed; values not restated here) |

## Disagreements found + conventions picked

1. **API shape.** The Exercism **JavaScript track** (as vendored in A6's `zebra-puzzle.spec.js`) uses a class: `new ZebraPuzzle()` with methods `waterDrinker()` / `zebraOwner()`. The cross-track **canonical-data.json** (A3) names the properties `drinksWater` / `ownsZebra`.
   **Convention picked:** named function exports `drinksWater()` / `ownsZebra()` from `src/zebra.mjs`, matching the canonical-data property names — canonical-data is the language-neutral source of truth; the JS-track class is one track's stylistic wrapper. The holdout author maps A3's `property` fields 1:1 onto these exports.
2. **Hobbies vs. cigarette brands.** The original 1962 puzzle (A5) uses cigarette brands (Old Gold, Kools, Chesterfields, Lucky Strike, Parliaments); Exercism (A1) substitutes hobbies (dancing, painting, reading, football, chess) with the same constraint structure.
   **Convention picked:** Exercism wording (A1) verbatim — it is the pinned authority for this task and what the canonical answer key was written against. (The substitution is structure-preserving, so A5's solution discussion still applies.)
3. **Orientation of "right".** A1 never defines whether "right" means the reader's right or the residents'. A5 documents the standard interpretation under which the published unique solution holds: houses indexed left to right from the observer, "immediately to the right" = index+1.
   **Convention picked:** that standard interpretation, pinned in spec.md §2 so builder and verifier can't diverge.
4. **`description.md` path drift.** Brief's URL 404s (file renamed in the upstream repo to `instructions.md` at some point). Convention: cite and use the live filenames; noted above.

## Anti-hardcoding contract (benchmark-specific, not from Exercism)

Exercism's own tests only assert the two answers, which a memorizing model can satisfy with string literals. Since Exercism is heavily represented in training data, the spec adds a benchmark-layer contract (spec.md §3.2): constraints must be explicitly represented and searched, uniqueness must be asserted (throw on 0 or ≥2 solutions), and the verifier will perturb individual constraints and require observable behavior changes. Precedent for structure-inspection over answer-matching: the benchmark meta-rule (builder never grades own work; verifier inspects + perturb-tests).

## Contamination assessment

**HIGH.** The Zebra/Einstein puzzle is one of the most-published logic puzzles in existence (1962 Life International, Wikipedia, Rosetta Code, thousands of GitHub solutions in every language), and the Exercism exercise — including its exact answers — is in the aider polyglot-benchmark (A6) that frontier models are openly evaluated (and likely trained) on. Any competent model already "knows" both answers. The benchmark signal therefore comes **entirely** from the §3.2 solver-structure contract: real constraint representation, uniqueness assertion, and perturbation sensitivity — not from producing the two strings.

## Difficulty

**Medium.** The puzzle itself is famous and the algorithm (permutations + pruning) is standard, but a correct implementation must handle 5 interacting categories, positional constraints, early pruning for the time bound, and the uniqueness assertion — meaningfully harder than a toy, easier than an interpreter (cf. task 09-forth).
