Build a ten-pin bowling score engine in plain modern JavaScript, per the Exercism "bowling" exercise.

The exercise instructions (verbatim from the Exercism problem specification):

> Score a bowling game.
>
> Bowling is a game where players roll a heavy ball to knock down pins arranged in a triangle.
> Write code to keep track of the score of a game of bowling.
>
> ## Scoring Bowling
>
> The game consists of 10 frames.
> A frame is composed of one or two ball throws with 10 pins standing at frame initialization.
> There are three cases for the tabulation of a frame.
>
> - An open frame is where a score of less than 10 is recorded for the frame.
>   In this case the score for the frame is the number of pins knocked down.
>
> - A spare is where all ten pins are knocked down by the second throw.
>   The total value of a spare is 10 plus the number of pins knocked down in their next throw.
>
> - A strike is where all ten pins are knocked down by the first throw.
>   The total value of a strike is 10 plus the number of pins knocked down in the next two throws.
>   If a strike is immediately followed by a second strike, then the value of the first strike cannot be determined until the ball is thrown one more time.
>
> Here is a three frame example:
>
> |  Frame 1   |  Frame 2   |     Frame 3      |
> | :--------: | :--------: | :--------------: |
> | X (strike) | 5/ (spare) | 9 0 (open frame) |
>
> Frame 1 is (10 + 5 + 5) = 20
>
> Frame 2 is (5 + 5 + 9) = 19
>
> Frame 3 is (9 + 0) = 9
>
> This means the current running total is 48.
>
> The tenth frame in the game is a special case.
> If someone throws a spare or a strike then they get one or two fill balls respectively.
> Fill balls exist to calculate the total of the 10th frame.
> Scoring a strike or spare on the fill ball does not give the player more fill balls.
> The total value of the 10th frame is the total number of pins knocked down.
>
> For a tenth frame of X1/ (strike and a spare), the total value is 20.
>
> For a tenth frame of XXX (three strikes), the total value is 30.
>
> ## Requirements
>
> Write code to keep track of the score of a game of bowling.
> It should support two operations:
>
> - `roll(pins : int)` is called each time the player rolls a ball.
>   The argument is the number of pins knocked down.
> - `score() : int` is called only at the very end of the game.
>   It returns the total score for that game.

Artifact contract (exact):

Create a single ES module file `src/bowling.mjs` with no npm dependencies, no I/O, no side effects on import, and no console output, exporting exactly one named class:

```js
export class Bowling { ... }
```

- `new Bowling()` constructs a new, empty game.
- `roll(pins)` records one throw. It must validate every roll and throw a plain `Error` with an exact message when the roll is invalid, leaving the game state unchanged:
  - a negative pin count throws `new Error("Negative roll is invalid")`;
  - a roll that would knock down more pins than are standing on the lane throws `new Error("Pin count exceeds pins on the lane")` — this covers any single roll greater than 10, two throws of one frame summing over 10, and the tenth-frame fill-ball constraints (after a tenth-frame strike the first fill ball faces a fresh rack of 10; if that fill ball is also a strike the second fill ball faces a fresh rack, otherwise the two fill balls together may not exceed 10; after a tenth-frame spare the single fill ball faces a fresh rack of 10);
  - rolling once the game is over throws `new Error("Cannot roll after game is over")`.
- `score()` returns the total score for the game as an integer, and may only be called at the very end of the game (all 10 frames complete, including any fill balls owed in the tenth frame). Calling it earlier — on an unstarted game, mid-game, or while fill balls are still owed — throws `new Error("Score cannot be taken until the end of the game")`.

The four error message strings above must match character-for-character.

Write only the library module. Do not write tests, a CLI, or documentation files.
