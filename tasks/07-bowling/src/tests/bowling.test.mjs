import { describe, it, expect } from "vitest";
import { Bowling } from "../bowling.mjs";

// Helper: roll the same value `n` times.
function playRolls(game, rolls) {
  for (const pins of rolls) {
    game.roll(pins);
  }
  return game;
}

function rollMany(game, n, pins) {
  return playRolls(game, new Array(n).fill(pins));
}

describe("scoring a game", () => {
  it("scores a game with all gutter balls as 0", () => {
    const game = rollMany(new Bowling(), 20, 0);
    expect(game.score()).toBe(0);
  });

  it("scores a game with all open frames of 3+6 as 90", () => {
    const g = new Bowling();
    for (let i = 0; i < 10; i++) {
      g.roll(3);
      g.roll(6);
    }
    expect(g.score()).toBe(90);
  });

  it("scores a spare followed by zeros as its 10", () => {
    const g = new Bowling();
    g.roll(6);
    g.roll(4); // spare
    g.roll(0);
    rollMany(g, 17, 0);
    expect(g.score()).toBe(10);
  });

  it("adds the points scored after a spare into the spare", () => {
    const g = new Bowling();
    g.roll(6);
    g.roll(4); // spare
    g.roll(3);
    rollMany(g, 17, 0);
    expect(g.score()).toBe(16);
  });

  it("does not carry a spare bonus into the next-next frame", () => {
    const g = new Bowling();
    g.roll(0);
    g.roll(0);
    g.roll(6);
    g.roll(4); // spare
    g.roll(3);
    rollMany(g, 15, 0);
    expect(g.score()).toBe(16);
  });

  it("adds the two points after a strike into the strike", () => {
    const g = new Bowling();
    g.roll(10); // strike
    g.roll(5);
    g.roll(3);
    rollMany(g, 16, 0);
    expect(g.score()).toBe(26);
  });

  it("does not carry a strike bonus into the next-next frame", () => {
    const g = new Bowling();
    g.roll(10); // strike
    g.roll(10); // strike
    g.roll(0);
    g.roll(0);
    rollMany(g, 14, 0);
    // frame1 = 10 + 10 + 0 = 20, frame2 = 10 + 0 + 0 = 10, rest 0
    expect(g.score()).toBe(30);
  });

  it("scores consecutive strikes correctly", () => {
    const g = new Bowling();
    g.roll(10);
    g.roll(10);
    g.roll(10);
    g.roll(5);
    g.roll(3);
    rollMany(g, 12, 0);
    // f1: 10+10+10=30, f2: 10+10+5=25, f3: 10+5+3=18, f4: 5+3=8
    expect(g.score()).toBe(81);
  });
});

describe("worked example from the spec", () => {
  it("X, 5/, 9 0, rest open runs to 48 total for those three frames", () => {
    const g = new Bowling();
    g.roll(10); // X -> 20
    g.roll(5);
    g.roll(5); // 5/ -> 19
    g.roll(9);
    g.roll(0); // 9 0 -> 9
    rollMany(g, 14, 0); // remaining frames open (7 frames * 2 rolls)
    expect(g.score()).toBe(48);
  });
});

describe("tenth-frame rules", () => {
  it("a strike in the tenth frame earns two fill balls", () => {
    const g = new Bowling();
    rollMany(g, 18, 0); // nine open frames
    g.roll(10); // tenth strike
    g.roll(7);
    g.roll(1);
    expect(g.score()).toBe(18);
  });

  it("a spare in the tenth frame earns one fill ball", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(7);
    g.roll(3); // spare
    g.roll(7);
    expect(g.score()).toBe(17);
  });

  it("X1/ tenth frame is worth 20", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(10); // X
    g.roll(1);
    g.roll(9); // /
    expect(g.score()).toBe(20);
  });

  it("XXX tenth frame is worth 30", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(10);
    g.roll(10);
    g.roll(10);
    expect(g.score()).toBe(30);
  });

  it("scores a perfect game as 300", () => {
    const g = rollMany(new Bowling(), 12, 10);
    expect(g.score()).toBe(300);
  });

  it("all spares with a fill ball score 150", () => {
    const g = new Bowling();
    rollMany(g, 21, 5); // 10 frames of 5/5 (spares) + one fill ball of 5
    expect(g.score()).toBe(150);
  });
});

describe("invalid rolls throw the pinned messages and do not change state", () => {
  it("rejects a negative roll", () => {
    const g = new Bowling();
    expect(() => g.roll(-1)).toThrow(new Error("Negative roll is invalid"));
    // state unchanged: a full valid game still scores correctly afterward
    rollMany(g, 20, 0);
    expect(g.score()).toBe(0);
  });

  it("rejects a single roll greater than 10", () => {
    const g = new Bowling();
    expect(() => g.roll(11)).toThrow(
      new Error("Pin count exceeds pins on the lane"),
    );
  });

  it("rejects two rolls in a frame summing over 10", () => {
    const g = new Bowling();
    g.roll(5);
    expect(() => g.roll(6)).toThrow(
      new Error("Pin count exceeds pins on the lane"),
    );
    // the invalid roll left state unchanged; a valid 5 completes the frame
    g.roll(5); // spare
    rollMany(g, 18, 0);
    expect(g.score()).toBe(10);
  });

  it("rejects two fill balls after a final strike summing over 10", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(10); // tenth strike
    g.roll(5); // first fill ball
    expect(() => g.roll(6)).toThrow(
      new Error("Pin count exceeds pins on the lane"),
    );
  });

  it("rejects the second fill ball being a strike when the first is not", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(10); // tenth strike
    g.roll(6); // first fill ball (not a strike)
    expect(() => g.roll(10)).toThrow(
      new Error("Pin count exceeds pins on the lane"),
    );
  });

  it("allows a fresh rack fill ball after a fill-ball strike", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(10); // tenth strike
    g.roll(10); // fill ball strike -> fresh rack
    g.roll(10); // second fill ball can be a strike
    expect(g.score()).toBe(30);
  });

  it("allows the single fill ball after a tenth-frame spare to be a strike", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(5);
    g.roll(5); // spare
    expect(() => g.roll(10)).not.toThrow();
    expect(g.score()).toBe(20);
  });

  it("rejects a roll after the game is over", () => {
    const g = rollMany(new Bowling(), 20, 0);
    expect(() => g.roll(0)).toThrow(
      new Error("Cannot roll after game is over"),
    );
  });

  it("rejects a roll after a completed game with fill balls", () => {
    const g = rollMany(new Bowling(), 12, 10); // perfect game
    expect(() => g.roll(0)).toThrow(
      new Error("Cannot roll after game is over"),
    );
  });
});

describe("score() cannot be taken until the game is over", () => {
  it("throws on an unstarted game", () => {
    const g = new Bowling();
    expect(() => g.score()).toThrow(
      new Error("Score cannot be taken until the end of the game"),
    );
  });

  it("throws mid-game", () => {
    const g = new Bowling();
    rollMany(g, 10, 0);
    expect(() => g.score()).toThrow(
      new Error("Score cannot be taken until the end of the game"),
    );
  });

  it("throws when the tenth frame is a strike still owed both fill balls", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(10);
    expect(() => g.score()).toThrow(
      new Error("Score cannot be taken until the end of the game"),
    );
  });

  it("throws when the tenth-frame strike is owed one fill ball", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(10);
    g.roll(10);
    expect(() => g.score()).toThrow(
      new Error("Score cannot be taken until the end of the game"),
    );
  });

  it("throws when a tenth-frame spare is still owed its fill ball", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(5);
    g.roll(5);
    expect(() => g.score()).toThrow(
      new Error("Score cannot be taken until the end of the game"),
    );
  });

  it("returns the score once the last fill ball is thrown", () => {
    const g = new Bowling();
    rollMany(g, 18, 0);
    g.roll(5);
    g.roll(5);
    g.roll(7);
    expect(g.score()).toBe(17);
  });
});
