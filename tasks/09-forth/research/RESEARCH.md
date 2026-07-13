# Research — Task 09: Forth Mini-Interpreter

Stage-1 research notes. Meta-rule honored: every adopted rule traces to an external
authority; nothing was invented here except explicitly-marked conventions for points the
authorities leave open (each noted with rationale).

## Canonical sources (authorities)

1. **Exercism problem description** (the builder's brief; quoted verbatim in `spec.md` and
   `frozen-prompt.md`):
   https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/forth/description.md
   (fetched 2026-07-12)
2. **Exercism canonical test data** (the answer key; saved **verbatim** to
   `holdout/canonical-data.json`, 18,659 bytes, fetched 2026-07-12 via direct raw download —
   no transformation):
   https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/forth/canonical-data.json
3. **Aider polyglot-benchmark** (community-canonical use of this exact exercise as an AI
   coding benchmark; contains `javascript/exercises/practice/forth/` with `.docs`, `.meta`,
   `forth.spec.js` — existence verified 2026-07-12):
   https://github.com/Aider-AI/polyglot-benchmark

## Adopted rules and their citations

| Rule in spec.md | Source |
|---|---|
| Supported words `+ - * /`, `DUP DROP SWAP OVER`; `: name body ;` definitions; signed ints ≥16 bits; case-insensitive words | Description (source 1), verbatim |
| `evaluate(instructions: string[]) -> number[]` shape; per-case input is a list of instruction lines; expected value is the resulting stack | canonical-data.json top-level `comments` + every case's `input.instructions` / `expected` shape (source 2) |
| Result array ordered bottom-of-stack first | canonical-data.json: number-pushing cases show push order preserved in the expected array (source 2) |
| Error messages `empty stack`, `only one value on the stack`, `divide by zero`, `undefined operation`, `illegal operation` (exact strings) | canonical-data.json `expected.error` values — these five strings are the complete set present in the data (source 2) |
| Binary op on empty stack → `empty stack`; on 1-element stack → `only one value on the stack`; unary (`DUP`/`DROP`) on empty → `empty stack` | canonical-data.json error cases per word section (source 2) |
| Negative number literals are numbers (pushed), and defining `-1` is illegal like defining `1` | canonical-data.json "pushes negative numbers" + "cannot redefine negative numbers" cases (source 2) — see disagreement #1 below |
| Redefinition allowed incl. shadowing built-ins and operators; **early binding** at definition time; self-referencing redefinition uses the previous meaning | canonical-data.json "user-defined words" section semantics (override / same-name / uses-same-name cases) (source 2) |
| Each `evaluate` call independent (fresh dictionary + stack) | canonical-data.json `evaluateBoth` case, `scenarios: ["local-scope"]` — definitions must not leak across evaluations (source 2). Holdout note: this one case uses property `evaluateBoth` with `instructionsFirst`/`instructionsSecond`; mechanical translation = two independent `evaluate` calls asserted against `expected[0]`/`expected[1]`. |
| Integer division discards remainder | canonical-data.json "performs integer division" case (source 2) |

## Disagreements found + conventions picked

1. **Description vs canonical data on number syntax.** The description says "a number is a
   sequence of one or more (ASCII) digits" — under that rule `-1` would be a *word*. The
   canonical data, however, requires negative literals to parse as numbers AND treats them
   as numbers for the illegal-definition rule. **Convention picked: canonical data wins**
   (it is the answer key): a number = optional leading `-` + one or more ASCII digits. The
   description itself hedges ("Forth probably uses slightly different rules...") and lists
   *signed* integers as the data type, so this is consistent with its intent.
2. **Division rounding for negative operands.** Untested by the canonical data (only
   non-negative division appears); the description says only "integer arithmetic". ANS Forth
   permits either floored or symmetric division. **Convention picked: truncation toward zero**
   (JS `Math.trunc`), noted in spec.md as untested — no holdout case can hinge on it.
3. **Error mechanism.** canonical-data gives descriptor strings, not a language mechanism;
   Exercism tracks vary (some use custom error classes / different casing, e.g. the JS track's
   own `forth.spec.js`). **Convention picked:** throw a plain JS `Error` whose `message`
   equals the canonical descriptor string exactly — the most mechanical translation of
   `expected: {"error": "..."}`, and the one the holdout author will use.
4. **Definitions spanning lines / mid-line.** The canonical data always places a complete
   `: ... ;` definition on its own instruction line. **Convention picked:** definitions must
   be handled from any token position but may be assumed complete within one line (no
   spanning-lines requirement stated or tested).
5. **Operand order for `-` and `/`.** Not stated in the description; fixed by canonical
   arithmetic cases (e.g. subtraction/division of two pushed values) and by Forth itself
   (top of stack = right operand). Adopted as standard Forth order.

## Spec-leak audit

`spec.md` contains rules only — no canonical-data example programs, expected stacks, or case
descriptions. The five error strings and the early-binding rule are **error/API semantics**
(explicitly required to be pinned in the spec by the task brief), sourced from the canonical
data but stated as rules, not as test cases.

## Contamination note

**High.** Exercism's forth exercise and its canonical tests are ubiquitous in training data
(thousands of public solutions in every language), and the exercise ships verbatim inside the
aider polyglot-benchmark used to evaluate coding models. A model may well reproduce a
memorized solution; grading validity here rests on the *holdout translation* being mechanical
and exact (exact error strings, exact stack ordering, local-scope case), not on novelty.
