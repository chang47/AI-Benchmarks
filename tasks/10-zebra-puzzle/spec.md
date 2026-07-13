# Task 10 — Zebra Puzzle Constraint Solver

**Source of truth:** the Exercism `zebra-puzzle` exercise (problem-specifications repo).
This spec is derived from the public exercise *description only* (introduction.md + instructions.md, fetched 2026-07-12). Full citations: `research/RESEARCH.md`.

---

## 1. Problem statement (Exercism wording, verbatim)

### Introduction

> The Zebra Puzzle is a famous logic puzzle in which there are five houses, each painted a different color.
> The houses have different inhabitants, who have different nationalities, own different pets, drink different beverages and enjoy different hobbies.
>
> To help you solve the puzzle, you're given 15 statements describing the solution.
> However, only by combining the information in _all_ statements will you be able to find the solution to the puzzle.
>
> The Zebra Puzzle is a Constraint satisfaction problem (CSP). In such a problem, you have a set of possible values and a set of constraints that limit which values are valid. Another well-known CSP is Sudoku.

### Instructions

> Your task is to solve the Zebra Puzzle to find the answer to these two questions:
>
> - Which of the residents drinks water?
> - Who owns the zebra?
>
> #### Puzzle
>
> The following 15 statements are all known to be true:
>
> 1. There are five houses.
> 2. The Englishman lives in the red house.
> 3. The Spaniard owns the dog.
> 4. The person in the green house drinks coffee.
> 5. The Ukrainian drinks tea.
> 6. The green house is immediately to the right of the ivory house.
> 7. The snail owner likes to go dancing.
> 8. The person in the yellow house is a painter.
> 9. The person in the middle house drinks milk.
> 10. The Norwegian lives in the first house.
> 11. The person who enjoys reading lives in the house next to the person with the fox.
> 12. The painter's house is next to the house with the horse.
> 13. The person who plays football drinks orange juice.
> 14. The Japanese person plays chess.
> 15. The Norwegian lives next to the blue house.
>
> Additionally, each of the five houses is painted a different color, and their inhabitants are of different national extractions, own different pets, drink different beverages and engage in different hobbies.
>
> Note: There are 24 billion (5!⁵ = 24,883,200,000) possible solutions, so try ruling out as many solutions as possible.

## 2. Pinned interpretation conventions

The exercise text leaves spatial wording implicit. This benchmark pins the standard (Wikipedia/original-puzzle) conventions so the task is deterministic:

- The five houses stand in a single row, numbered **1 through 5 from left to right** (observer facing the houses).
- "The **first** house" (statement 10) = house 1 (leftmost).
- "The **middle** house" (statement 9) = house 3.
- "Immediately to the **right** of" (statement 6): house *X* is immediately to the right of house *Y* iff `position(X) = position(Y) + 1`.
- "**Next to**" (statements 11, 12, 15): adjacent on either side, i.e. `|position(A) - position(B)| = 1`.

The five values per category are exactly those named in the statements:

- **Colors:** red, green, ivory, yellow, blue
- **Nationalities:** Englishman, Spaniard, Ukrainian, Norwegian, Japanese
- **Pets:** dog, snails, fox, horse, zebra
- **Beverages:** coffee, tea, milk, orange juice, water
- **Hobbies:** dancing, painting, reading, football, chess

Each house has exactly one value from each category; within a category, no two houses share a value (bijection per category).

## 3. Artifact contract

Deliverable: **`src/zebra.mjs`** — a plain modern JavaScript ES module, Node 18+, zero runtime dependencies.

### 3.1 Exports (exact API)

```js
export function drinksWater() // -> string
export function ownsZebra()   // -> string
```

- `drinksWater()` returns the **nationality** of the resident who drinks water.
- `ownsZebra()` returns the **nationality** of the resident who owns the zebra.
- Return values are exactly one of the five nationality strings: `"Englishman"`, `"Spaniard"`, `"Ukrainian"`, `"Norwegian"`, `"Japanese"` (exact spelling and capitalization).

### 3.2 The answers MUST be computed by a real constraint search

This is the core requirement of the task. The two exported functions must **derive** their answers by searching the space of candidate assignments against the 15 statements above. Concretely:

1. **No hardcoded answers.** The module must not contain the answer as a literal (directly or obfuscated — e.g. index constants, character codes, pre-baked lookup tables of the solved house/attribute grid). Returning a string literal, or reading from a hand-written "solved" data structure, is an automatic fail.
2. **Constraints as data/checks, not conclusions.** Each of statements 2–15 must appear in the code as an explicit, individually identifiable constraint (a predicate, a rule object, or an equivalent structure) that the search evaluates against candidate assignments. Statement 1 and the "all different within a category" condition define the search space itself.
3. **Actual search execution.** The solution grid must be produced at module load time or on first call by enumerating/propagating over candidate assignments (permutation enumeration with pruning, backtracking CSP, constraint propagation, etc. — any correct approach is acceptable) and testing them against the constraints.
4. **Uniqueness assertion.** The search must verify that **exactly one** complete assignment satisfies all constraints, and must `throw` an `Error` if zero or more than one satisfying assignment is found. (This makes the solver's dependence on the constraints observable.)
5. **Perturbation-sensitive structure.** The verifier will perturb-test the solver: individual constraints will be altered, removed, or swapped in a copy of the module, and the observed behavior (different derived answers, or a uniqueness error) must change accordingly. Code whose output is insensitive to constraint edits is treated as hardcoded and fails.
6. **Performance.** Naive enumeration of all 5!⁵ ≈ 24.9 billion combinations is not acceptable (the exercise's own note says to rule out solutions early). Both exported functions together must complete in **under 10 seconds** on Node 18 on commodity hardware. Interleaved pruning (test constraints as each category's permutation is chosen) comfortably meets this.

### 3.3 Purity

- Both functions are deterministic and side-effect free: no I/O, no network, no reading files, no environment inspection, no randomness affecting the result.
- Calling either function repeatedly returns the same value; the two functions may share one internally memoized solve.

## 4. Acceptance criteria

| # | Criterion |
|---|-----------|
| AC-1 | `src/zebra.mjs` is an ES module importable under Node 18+ with named exports `drinksWater` and `ownsZebra`. |
| AC-2 | `drinksWater()` returns a string that is one of the five nationalities (§3.1). |
| AC-3 | `ownsZebra()` returns a string that is one of the five nationalities (§3.1). |
| AC-4 | Both functions' return values match the unique solution of the 15 statements under the §2 conventions (checked against the held-out Exercism answer key). |
| AC-5 | All 15 statements are individually represented as explicit constraints evaluated by a search (§3.2.2); no answer literals or pre-solved grids (§3.2.1). |
| AC-6 | The search asserts uniqueness of the solution and throws if 0 or ≥2 assignments satisfy the constraints (§3.2.4). |
| AC-7 | Perturbing a constraint changes the observed behavior (different answer or uniqueness error) — the solver genuinely depends on the constraint set (§3.2.5). |
| AC-8 | Both functions complete within the §3.2.6 time bound. |
| AC-9 | Functions are pure and repeat-stable (§3.3). |

## 5. Out of scope

- No CLI, no UI, no tests shipped by the builder (verification is authored independently).
- No third-party constraint-solver libraries — the search itself is the exercise; standard library only.
