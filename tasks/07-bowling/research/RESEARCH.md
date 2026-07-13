# Research: Bowling Score Engine (task 07-bowling)

Stage 1 (researcher + spec author), Vetted Bench wave 2, 2026-07-12.
Meta-rule honored: every correctness requirement traces to an external authority (the Exercism problem-specifications repo — the community's canonical cross-track source); nothing invented.

## Sources

1. **Exercism problem-specifications — bowling description** — https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/bowling/description.md
   The canonical public exercise instructions. Fetched verbatim this session; sole basis for the game-rules portion of `spec.md` and quoted verbatim in `frozen-prompt.md`.
2. **Exercism problem-specifications — bowling canonical-data.json (ANSWER KEY)** — https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/bowling/canonical-data.json
   The community's own test data: 30 cases (uuid'd), two tested properties (`score`, `roll`), and the four exact error strings. Saved **verbatim** to `holdout/canonical-data.json` (11,564 bytes) this session for the holdout author to translate mechanically. Only the API shape and the four error strings were pinned into `spec.md` from this file (per the freeze protocol); no test cases were leaked into the spec beyond what the description itself states.
3. **Aider polyglot-benchmark — JavaScript bowling copy** — https://github.com/Aider-AI/polyglot-benchmark (path `javascript/exercises/practice/bowling/`, spec file `bowling.spec.js`)
   Independent corroboration that the established LLM-benchmark rendition of this exercise in JavaScript uses `class Bowling` with `new Bowling()`, `roll(roll)`, `score()`, and throws `Error` with exactly the same four message strings as [2]. Verified by fetching `bowling.spec.js` raw this session.
4. **Exercism JavaScript track config** — https://raw.githubusercontent.com/exercism/javascript/main/config.json
   The JS track rates the bowling practice exercise **difficulty 8 (of 10)**. Used to inform (not dictate) the metadata difficulty label — see Disagreements/conventions #4.

## Adopted correctness rules (each with citation)

| # | Rule | Authority |
|---|---|---|
| R1 | 10 frames; each frame is one or two throws with 10 pins standing at frame initialization. | Description [1] |
| R2 | Open frame scores its pin count; spare = 10 + next throw; strike = 10 + next two throws; a strike followed by a strike cannot be valued until one more ball is thrown. | Description [1] |
| R3 | Worked example: frames `X`, `5/`, `9 0` → 20 + 19 + 9 = 48 running total. | Description [1] |
| R4 | Tenth frame: spare → 1 fill ball, strike → 2 fill balls; fill balls never grant more fill balls; the 10th frame's value is the total pins knocked down (`X1/` = 20, `XXX` = 30). | Description [1] |
| R5 | API = `roll(pins : int)` called once per throw + `score() : int` called only at the very end of the game. | Description [1]; canonical-data comments [2] |
| R6 | In JavaScript the exercise is realized as `class Bowling` with instance methods `roll` / `score`, errors signaled by throwing `Error`. | Polyglot-benchmark JS copy [3]; canonical-data comment "expect an error as is idiomatic for your language" [2] |
| R7 | Exact error strings (pinned verbatim): `Negative roll is invalid`; `Pin count exceeds pins on the lane`; `Cannot roll after game is over`; `Score cannot be taken until the end of the game`. | canonical-data.json [2]; independently identical in [3] |
| R8 | Roll-validity invariant: a roll may not exceed the pins standing on the lane — single roll > 10 invalid; two throws of a frame may not sum over 10; tenth-frame re-rack semantics (fresh 10 after a strike/spare clears the deck; a non-strike first fill ball caps the second fill ball at the remainder). | Error cases in [2] (the "Pin count exceeds pins on the lane" family) + R1's "10 pins standing at frame initialization" [1] |
| R9 | Game-over definition: all 10 frames complete including owed fill balls; rolling after that is an error; scoring before that (unstarted, mid-game, or fill balls still owed) is an error. | Error cases in [2]; tenth-frame rules in [1] |

## Disagreements noted + conventions picked

1. **Class vs. bare functions.** The description [1] names only the two operations (`roll`, `score`); it never mandates a class. The canonical-data comments [2] say "Students should implement roll and score methods." **Convention picked:** `export class Bowling` with `new Bowling()` per instance-per-game — matching the polyglot-benchmark JavaScript rendition [3], our target language's established benchmark form.
2. **Error mechanism.** Canonical data [2] is language-agnostic ("via exceptions, optional values, or otherwise"). **Convention picked:** `throw new Error("<exact message>")`, matching [3]. Message strings pinned character-for-character from [2].
3. **`score()` semantics.** The description phrases "called only at the very end of the game" as a caller contract; the canonical data [2] makes premature calls a tested error. **Convention picked:** premature `score()` throws (the stricter, tested behavior).
4. **Difficulty label.** Exercism's JS track rates bowling 8/10 [4] (their scale would suggest "hard"), but the bowling kata is among the most contaminated exercises in existence (classic TDD kata since Robert Martin's 2000s writeups + every Exercism track + the aider polyglot benchmark itself). **Convention picked:** `medium` — the tenth-frame roll-validation edge cases are genuinely fiddly, but training-data familiarity offsets the raw rating.
5. **File naming.** Polyglot benchmark uses `bowling.js` (CommonJS-era Babel setup) [3]; this bench's house style is plain ES modules. **Convention picked:** `src/bowling.mjs`, ES module, same class/API.

## Contamination reality (for metadata)

**HIGH.** Exercism's bowling exercise, its canonical-data.json, and the bowling-kata generally are certainly in every modern model's training data (the aider polyglot benchmark that popularized it for LLM evals is itself public on GitHub). This task therefore measures faithful-contract execution (exact error strings, exact tenth-frame validation) more than novel problem solving. Grading must lean on the mechanical canonical-data translation in `holdout/`, character-exact error messages, and the state-machine edge cases — not on whether the model "knows bowling."

## Holdout note

`holdout/canonical-data.json` is byte-verbatim from [2] (30 cases: 17 `score`-property, 13 `roll`-property; every error case maps to one of the four pinned strings). The holdout author should translate it mechanically: for each case, feed `input.previousRolls` through `roll()` one at a time, then either compare `score()` to the integer `expected` or assert the expected throw (`expected.error` is the exact message) on the final `roll`/`score` call.
