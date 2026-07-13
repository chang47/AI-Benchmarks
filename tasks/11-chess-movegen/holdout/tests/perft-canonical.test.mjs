// ============================================================================
// HOLDOUT ANSWER KEY — Task 11: chess legal-move generator (perft-graded)
// Written by the independent holdout author. The builder NEVER sees this file.
//
// Every FEN and node count below is copied VERBATIM from
// research/RESEARCH.md §3 (authority A1: Chess Programming Wiki,
// "Perft Results", https://www.chessprogramming.org/Perft_Results,
// retrieved 2026-07-12; machine-readable copy: research/canonical-data.json).
// Perft semantics per A2 (https://www.chessprogramming.org/Perft): strictly
// legal moves; leaf nodes at exactly the given depth; perft(0) = 1; draws
// (fifty-move / repetition / material) ignored.
//
// STATED TIME BOUNDS:
//   * per (fen, depth) pair: 2000 ms + nodes/125 ms   — i.e. 2x slack over
//     the spec's "~250k nodes/second" practical target (spec criterion 16).
//   * whole graded suite: < 120,000 ms wall clock (spec criterion 16 /
//     RESEARCH.md §4) — enforced by the final test in this file.
// Graded set: 30 (fen, depth) pairs, ~17M total leaf nodes.
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { moves, parseFen, perft } from "./_contract.mjs";

// --- Canonical positions (RESEARCH.md §3.1–3.6, verbatim) -------------------
const POSITIONS = [
  {
    name: "initial position (§3.1)",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    nodes: { 1: 20, 2: 400, 3: 8902, 4: 197281, 5: 4865609 },
  },
  {
    name: 'position 2 "Kiwipete" (§3.2, verbatim 4-field FEN)',
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -",
    nodes: { 1: 48, 2: 2039, 3: 97862, 4: 4085603 },
  },
  {
    name: "position 3 — EP-pin position (§3.3)",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    nodes: { 1: 14, 2: 191, 3: 2812, 4: 43238, 5: 674624 },
  },
  {
    name: "position 4 (§3.4)",
    fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    nodes: { 1: 6, 2: 264, 3: 9467, 4: 422333 },
  },
  {
    name: "position 4 — colour-mirrored (§3.4, same counts per A1)",
    fen: "r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1",
    nodes: { 1: 6, 2: 264, 3: 9467, 4: 422333 },
  },
  {
    name: "position 5 (§3.5)",
    fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    nodes: { 1: 44, 2: 1486, 3: 62379, 4: 2103487 },
  },
  {
    name: "position 6 (§3.6)",
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    nodes: { 1: 46, 2: 2079, 3: 89890, 4: 3894594 },
  },
];

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

// Per-pair time bound: 2x slack over the ~250k NPS practical target.
const timeBoundMs = (nodes) => 2000 + Math.ceil(nodes / 125);

const SUITE_BUDGET_MS = 120_000;
let suiteStart = 0;

beforeAll(() => {
  suiteStart = performance.now();
});

describe("perft(fen, 0) === 1 for every canonical position (A2: perft(0) = 1; spec criterion 1)", () => {
  it("returns exactly 1 at depth 0 for all 7 positions", () => {
    for (const p of POSITIONS) {
      expect(perft(p.fen, 0), `${p.name} depth 0`).toBe(1);
    }
  });
});

describe("moves() consistency with canonical depth-1 counts (spec criteria 2, notation pin 5)", () => {
  it("moves(parseFen(fen)) is a duplicate-free array of UCI strings whose length equals the canonical depth-1 count", () => {
    for (const p of POSITIONS) {
      const pos = parseFen(p.fen);
      const ms = moves(pos);
      expect(Array.isArray(ms), `${p.name}: moves() must return an array`).toBe(true);
      expect(ms.length, `${p.name}: moves().length`).toBe(p.nodes[1]);
      expect(new Set(ms).size, `${p.name}: duplicate moves forbidden`).toBe(ms.length);
      for (const m of ms) {
        expect(m, `${p.name}: malformed UCI move "${m}"`).toMatch(UCI_RE);
      }
      // perft(fen, 1) must equal moves().length (spec criterion 2)
      expect(perft(p.fen, 1), `${p.name}: perft(fen,1) === moves().length`).toBe(ms.length);
    }
  });
});

describe("canonical perft node counts (A1, verbatim — 30 graded pairs)", () => {
  for (const p of POSITIONS) {
    for (const [depthStr, expected] of Object.entries(p.nodes)) {
      const depth = Number(depthStr);
      it(
        `${p.name} — perft depth ${depth} === ${expected}`,
        () => {
          const n = perft(p.fen, depth);
          expect(Number.isSafeInteger(n), "perft must return an exact safe integer (spec criterion 5)").toBe(true);
          expect(n).toBe(expected);
        },
        timeBoundMs(expected),
      );
    }
  }
});

describe("total suite time bound (spec criterion 16 / RESEARCH.md §4)", () => {
  it(`entire graded perft suite completed in under ${SUITE_BUDGET_MS / 1000} seconds`, () => {
    const elapsed = performance.now() - suiteStart;
    expect(
      elapsed,
      `graded suite took ${(elapsed / 1000).toFixed(1)}s — bound is ${SUITE_BUDGET_MS / 1000}s total`,
    ).toBeLessThan(SUITE_BUDGET_MS);
  });
});
