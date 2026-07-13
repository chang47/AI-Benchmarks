# Spec: Bowling Score Engine (Exercism canonical)

## Purpose

Implement a scorer for one complete game of ten-pin bowling, per the Exercism "bowling" exercise. Rolls are entered one at a time; the engine enforces the rules of the game (invalid rolls are rejected with an error) and computes the final score, including strike/spare bonuses and the tenth-frame fill-ball rules. It is a pure logic library: no I/O, no CLI, no dependencies beyond the Node.js standard runtime.

## Game rules (from the Exercism description)

- The game consists of **10 frames**. A frame is composed of one or two ball throws with **10 pins standing at frame initialization**.
- There are three cases for the tabulation of a frame:
  - **Open frame** — a score of less than 10 is recorded for the frame. The score for the frame is the number of pins knocked down.
  - **Spare** — all ten pins are knocked down by the second throw. The total value of a spare is 10 plus the number of pins knocked down in their next throw.
  - **Strike** — all ten pins are knocked down by the first throw. The total value of a strike is 10 plus the number of pins knocked down in the next two throws. If a strike is immediately followed by a second strike, the value of the first strike cannot be determined until the ball is thrown one more time.
- Worked example (from the description): frames `X`, `5/`, `9 0` score 20 + 19 + 9 = **48** running total.
- **Tenth frame special case:** if the player throws a spare or a strike in the tenth frame, they get **one or two fill balls respectively**. Fill balls exist only to calculate the total of the 10th frame; scoring a strike or spare on a fill ball does **not** grant more fill balls. The total value of the 10th frame is the total number of pins knocked down.
  - A tenth frame of `X1/` (strike then a spare) is worth **20**.
  - A tenth frame of `XXX` (three strikes) is worth **30**.
- The **game is over** when all 10 frames are complete, including any fill balls earned in the tenth frame (spare → exactly 1 fill ball; strike → exactly 2 fill balls; open tenth frame → no fill balls).

## Roll validity (the "pins on the lane" invariant)

A roll can never knock down more pins than are currently standing on the lane. 10 pins stand at the start of every frame; within a two-throw frame the second throw may knock down at most `10 − first throw`. In the tenth frame the pins are re-racked to a fresh 10 whenever all ten are down: after a tenth-frame strike the first fill ball faces 10 pins; if that fill ball is also a strike the second fill ball faces a fresh 10, otherwise the two fill balls together may not exceed 10. After a tenth-frame spare the single fill ball faces a fresh 10.

## Artifact contract (exact)

Create `src/bowling.mjs` (an ES module) exporting exactly one named class:

```js
export class Bowling { ... }
```

1. `new Bowling()` — constructs a new, empty game.
2. `roll(pins)` — records one throw; `pins` is the number of pins knocked down (an integer). Returns nothing meaningful. **Throws `Error` with the exact message below** when the roll is invalid; an invalid roll must not alter the game state:
   - `pins` is negative → `throw new Error("Negative roll is invalid")`
   - the roll would knock down more pins than are standing on the lane (including any single roll greater than 10, a two-throw frame summing over 10, or a tenth-frame fill ball violating the invariant above) → `throw new Error("Pin count exceeds pins on the lane")`
   - the game is already over → `throw new Error("Cannot roll after game is over")`
3. `score()` — returns the total score for the game as an integer. May only be called at the very end of the game; if the game is not yet over (including a fresh game with no rolls, or a tenth-frame spare/strike still owed fill balls) → `throw new Error("Score cannot be taken until the end of the game")`.

The four error message strings are pinned verbatim from the Exercism canonical data and must match character-for-character:

| Condition | Exact message |
|---|---|
| Negative pin count | `Negative roll is invalid` |
| More pins than standing on the lane | `Pin count exceeds pins on the lane` |
| Roll after the game is over | `Cannot roll after game is over` |
| Score before the game is over | `Score cannot be taken until the end of the game` |

## Acceptance criteria

1. Rolls are entered one at a time via `roll(pins)`; `score()` returns the final total only once the game is over.
2. Open frames score their pin count; spares score 10 plus the next throw; strikes score 10 plus the next two throws (consecutive strikes chain across frames, so a strike's value may depend on throws in the following two frames).
3. The worked example holds: frames `X`, `5/`, `9 0` produce a running total of 48 (20 + 19 + 9) with all remaining frames open.
4. Tenth-frame rules hold: spare grants exactly one fill ball, strike grants exactly two, fill balls never grant further fill balls, and the tenth frame's value is the plain sum of its pins (e.g. `X1/` = 20, `XXX` = 30 for the frame).
5. Every invalid roll throws `Error` with the pinned exact message and leaves the game state unchanged: negative pins; any roll exceeding the pins standing on the lane (single roll > 10, second throw of a frame exceeding the remainder, and tenth-frame fill balls per the invariant); any roll after the game is over.
6. `score()` throws `Error` with the pinned exact message whenever the game is not over: unstarted games, mid-game, and a tenth frame still owed one or both fill balls.
7. The module has no side effects on import, uses only standard JavaScript (no npm dependencies), performs no I/O, and contains no `console.log` output.
