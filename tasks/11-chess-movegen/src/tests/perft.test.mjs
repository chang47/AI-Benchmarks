import { describe, it, expect } from "vitest";
import { perft } from "../movegen.mjs";

// Canonical perft node counts for the standard Chess Programming Wiki
// positions. These are community-canonical reference numbers used here to
// VALIDATE the generator (not hardcoded into movegen — the generator derives
// everything from the rules of chess).

const INITIAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const KIWIPETE =
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const POS3 = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
const POS4 = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";
const POS4_MIRROR =
  "r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1";
const POS5 = "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8";
const POS6 =
  "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10";

describe("perft — initial position", () => {
  it("depth 1 = 20", () => expect(perft(INITIAL, 1)).toBe(20));
  it("depth 2 = 400", () => expect(perft(INITIAL, 2)).toBe(400));
  it("depth 3 = 8902", () => expect(perft(INITIAL, 3)).toBe(8902));
  it("depth 4 = 197281", () => expect(perft(INITIAL, 4)).toBe(197281));
  it("depth 5 = 4865609", () => expect(perft(INITIAL, 5)).toBe(4865609));
});

describe("perft — Kiwipete", () => {
  it("depth 1 = 48", () => expect(perft(KIWIPETE, 1)).toBe(48));
  it("depth 2 = 2039", () => expect(perft(KIWIPETE, 2)).toBe(2039));
  it("depth 3 = 97862", () => expect(perft(KIWIPETE, 3)).toBe(97862));
  it("depth 4 = 4085603", () => expect(perft(KIWIPETE, 4)).toBe(4085603));
});

describe("perft — position 3 (endgame)", () => {
  it("depth 1 = 14", () => expect(perft(POS3, 1)).toBe(14));
  it("depth 2 = 191", () => expect(perft(POS3, 2)).toBe(191));
  it("depth 3 = 2812", () => expect(perft(POS3, 3)).toBe(2812));
  it("depth 4 = 43238", () => expect(perft(POS3, 4)).toBe(43238));
  it("depth 5 = 674624", () => expect(perft(POS3, 5)).toBe(674624));
});

describe("perft — position 4", () => {
  it("depth 1 = 6", () => expect(perft(POS4, 1)).toBe(6));
  it("depth 2 = 264", () => expect(perft(POS4, 2)).toBe(264));
  it("depth 3 = 9467", () => expect(perft(POS4, 3)).toBe(9467));
  it("depth 4 = 422333", () => expect(perft(POS4, 4)).toBe(422333));
});

describe("perft — position 4 mirror (same counts)", () => {
  it("depth 1 = 6", () => expect(perft(POS4_MIRROR, 1)).toBe(6));
  it("depth 2 = 264", () => expect(perft(POS4_MIRROR, 2)).toBe(264));
  it("depth 3 = 9467", () => expect(perft(POS4_MIRROR, 3)).toBe(9467));
  it("depth 4 = 422333", () => expect(perft(POS4_MIRROR, 4)).toBe(422333));
});

describe("perft — position 5", () => {
  it("depth 1 = 44", () => expect(perft(POS5, 1)).toBe(44));
  it("depth 2 = 1486", () => expect(perft(POS5, 2)).toBe(1486));
  it("depth 3 = 62379", () => expect(perft(POS5, 3)).toBe(62379));
});

describe("perft — position 6", () => {
  it("depth 1 = 46", () => expect(perft(POS6, 1)).toBe(46));
  it("depth 2 = 2079", () => expect(perft(POS6, 2)).toBe(2079));
  it("depth 3 = 89890", () => expect(perft(POS6, 3)).toBe(89890));
});

describe("perft — semantics", () => {
  it("depth 0 = 1 for any legal position", () => {
    expect(perft(INITIAL, 0)).toBe(1);
    expect(perft(KIWIPETE, 0)).toBe(1);
  });
  it("4-field FEN (no clocks) parses", () => {
    expect(perft("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", 2)).toBe(
      400
    );
  });
});
