// Ten-pin bowling score engine (Exercism canonical).
// Pure logic: no I/O, no dependencies. Rolls entered one at a time.

const ERR_NEGATIVE = "Negative roll is invalid";
const ERR_EXCEEDS = "Pin count exceeds pins on the lane";
const ERR_AFTER_OVER = "Cannot roll after game is over";
const ERR_TOO_EARLY = "Score cannot be taken until the end of the game";

export class Bowling {
  constructor() {
    this.rolls = [];
  }

  /**
   * Record one throw. `pins` is the number of pins knocked down.
   * Throws Error on an invalid roll; game state is left unchanged.
   */
  roll(pins) {
    if (pins < 0) {
      throw new Error(ERR_NEGATIVE);
    }

    const state = this._analyze();

    if (state.over) {
      throw new Error(ERR_AFTER_OVER);
    }

    // `standing` is the number of pins on the lane facing this throw.
    // This also rejects any single roll greater than 10 (standing maxes at 10).
    if (pins > state.standing) {
      throw new Error(ERR_EXCEEDS);
    }

    this.rolls.push(pins);
  }

  /**
   * Total score for the completed game. Throws if the game is not over.
   */
  score() {
    const state = this._analyze();
    if (!state.over) {
      throw new Error(ERR_TOO_EARLY);
    }

    const r = this.rolls;
    let total = 0;
    let i = 0;

    for (let frame = 0; frame < 10; frame++) {
      if (r[i] === 10) {
        // Strike: 10 + next two throws.
        total += 10 + r[i + 1] + r[i + 2];
        i += 1;
      } else if (r[i] + r[i + 1] === 10) {
        // Spare: 10 + next throw.
        total += 10 + r[i + 2];
        i += 2;
      } else {
        // Open frame: the two throws.
        total += r[i] + r[i + 1];
        i += 2;
      }
    }

    return total;
  }

  /**
   * Walk the recorded rolls and report:
   *   - over:     is the game complete (all 10 frames + any owed fill balls)?
   *   - standing: pins on the lane facing the NEXT throw (only meaningful when !over).
   */
  _analyze() {
    const r = this.rolls;
    let i = 0;

    // Frames 1..9 (indices 0..8).
    for (let frame = 0; frame < 9; frame++) {
      if (i >= r.length) {
        // At the start of a fresh frame with no roll yet.
        return { over: false, standing: 10 };
      }
      if (r[i] === 10) {
        // Strike closes the frame in one throw.
        i += 1;
        continue;
      }
      if (i + 1 >= r.length) {
        // First throw taken, awaiting the second throw of this frame.
        return { over: false, standing: 10 - r[i] };
      }
      // Two throws recorded; advance to the next frame.
      i += 2;
    }

    return this._analyzeTenth(r, i);
  }

  _analyzeTenth(r, i) {
    const rem = r.length - i;

    if (rem === 0) {
      // Tenth frame not started.
      return { over: false, standing: 10 };
    }

    if (rem === 1) {
      if (r[i] === 10) {
        // Tenth-frame strike: two fill balls owed; next faces a fresh rack.
        return { over: false, standing: 10 };
      }
      // First throw taken; awaiting the second throw.
      return { over: false, standing: 10 - r[i] };
    }

    if (rem === 2) {
      if (r[i] === 10) {
        // Strike + one fill ball; one fill ball still owed.
        if (r[i + 1] === 10) {
          // Fill ball was a strike: second fill ball faces a fresh rack.
          return { over: false, standing: 10 };
        }
        // Non-strike fill ball: the two fill balls together may not exceed 10.
        return { over: false, standing: 10 - r[i + 1] };
      }
      if (r[i] + r[i + 1] === 10) {
        // Spare: exactly one fill ball owed, facing a fresh rack.
        return { over: false, standing: 10 };
      }
      // Open tenth frame: complete.
      return { over: true, standing: 0 };
    }

    // rem >= 3: strike or spare tenth frame with all fill balls thrown.
    return { over: true, standing: 0 };
  }
}
