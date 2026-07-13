// ============================================================================
// HOLDOUT ANSWER KEY — Task 11: targeted legality cases.
// Written by the independent holdout author. The builder NEVER sees this file.
//
// Each expected behaviour below is derived from the FIDE Laws of Chess
// (in force 1 Jan 2023, https://handbook.fide.com/chapter/E012023) as cited
// in research/RESEARCH.md §2 (authority A3), and from the perft definition
// (A2, https://www.chessprogramming.org/Perft) as cited in RESEARCH.md §1.
// The only counted quantities used ("4 distinct moves per promoting
// push/capture", "perft(0) = 1", mate/stalemate contribute 0 leaves) are
// taken from those citations — nothing is invented.
//
// The test positions themselves are minimal constructions that isolate one
// rule each; every FEN was verified square-by-square against an independent
// reference implementation before freezing.
// ============================================================================
import { describe, expect, it } from "vitest";
import { moves, parseFen, perft } from "./_contract.mjs";

const uci = (fen) => moves(parseFen(fen));

describe("castling (FIDE Art. 3.8.2, RESEARCH.md §2)", () => {
  it("kingside castling is FORBIDDEN when the crossed square (f1) is attacked (Art. 3.8.2.2)", () => {
    // Ke1 + Rh1 (right K); black Rf8 attacks f1 down the empty f-file.
    const fen = "4kr2/8/8/8/8/8/8/4K2R w K - 0 1";
    const ms = uci(fen);
    expect(ms).not.toContain("e1g1"); // castling through check
    expect(ms).not.toContain("e1f1"); // king may not step onto an attacked square either
    expect(ms).toContain("e1d1"); // sanity: the king is not paralysed
  });

  it("kingside castling is generated when path is empty and unattacked (positive control)", () => {
    const fen = "4k3/8/8/8/8/8/8/4K2R w K - 0 1";
    expect(uci(fen)).toContain("e1g1");
  });

  it("queenside castling is ALLOWED when b1 is attacked but empty (Art. 3.8.2.2 asymmetry; spec criterion 9)", () => {
    // Black Ba2 attacks b1 only among the king's start/cross/destination
    // squares (e1, d1, c1 are all unattacked); b1 merely must be empty.
    const fen = "4k3/8/8/8/8/8/b7/R3K3 w Q - 0 1";
    expect(uci(fen)).toContain("e1c1");
  });

  it("queenside castling is FORBIDDEN when the crossed square (d1) is attacked (Art. 3.8.2.2)", () => {
    // Black Rd8 attacks d1 down the empty d-file.
    const fen = "3rk3/8/8/8/8/8/8/R3K3 w Q - 0 1";
    const ms = uci(fen);
    expect(ms).not.toContain("e1c1");
    expect(ms).not.toContain("e1d1"); // moving into the rook's file is also illegal
  });
});

describe("en passant (FIDE Art. 3.7.3.1-3.7.3.2 and Art. 3.9.2, RESEARCH.md §2)", () => {
  it("en passant capture is generated onto the FEN target square (written as the pawn's diagonal move)", () => {
    // White Pe5, black Pd5 just double-pushed (target d6).
    const fen = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1";
    const ms = uci(fen);
    expect(ms).toContain("e5d6"); // the EP capture
    expect(ms).toContain("e5e6"); // the ordinary push coexists
  });

  it("en passant is EXCLUDED when removing both pawns exposes one's own king (Art. 3.9.2; the Position-3 motif; spec criterion 7)", () => {
    // Rank 5: black Ra5, black Pd5 (just double-pushed), white Pe5, white Kh5.
    // Capturing e5xd6 e.p. removes BOTH rank-5 pawns and opens a5-h5.
    const fen = "4k3/8/8/r2pP2K/8/8/8/8 w - d6 0 1";
    const ms = uci(fen);
    expect(ms).not.toContain("e5d6"); // horizontally-pinned EP is illegal
    expect(ms).toContain("e5e6"); // the plain push keeps d5 as a blocker and stays legal
  });
});

describe("promotion (FIDE Art. 3.7.3.3-3.7.3.5, RESEARCH.md §2: 4 distinct moves per promoting push/capture)", () => {
  it("a promoting push and a promoting capture each yield exactly the 4 lowercase-suffixed moves, and no bare move to the last rank", () => {
    // White Pb7: push to empty b8, or capture black Ra8.
    const fen = "r3k3/1P6/8/8/8/8/8/4K3 w - - 0 1";
    const ms = uci(fen);
    const pawnMoves = ms.filter((m) => m.startsWith("b7")).sort();
    expect(pawnMoves).toEqual(
      ["b7a8b", "b7a8n", "b7a8q", "b7a8r", "b7b8b", "b7b8n", "b7b8q", "b7b8r"].sort(),
    );
    expect(ms).not.toContain("b7b8"); // non-promoting move to the last rank is forbidden
    expect(ms).not.toContain("b7a8");
  });
});

describe("absolute pins (FIDE Art. 3.9.2, RESEARCH.md §2)", () => {
  it("a knight absolutely pinned to its king generates NO moves at all", () => {
    // e-file: black Re8, white Ne4, white Ke1 — the knight can never stay on the ray.
    const fen = "4r2k/8/8/8/4N3/8/8/4K3 w - - 0 1";
    const ms = uci(fen);
    expect(ms.filter((m) => m.startsWith("e4"))).toEqual([]);
    expect(ms).toContain("e1d1"); // sanity: other moves still exist
  });
});

describe("no-legal-move positions (spec criterion 17; A2: mate/stalemate contribute zero leaves)", () => {
  it("checkmate: moves() === [] and perft() === 0 at every depth >= 1", () => {
    // Back-rank mate: Ra8 checks Kh8; g8 is attacked, g7/h7 are own pawns.
    const fen = "R6k/6pp/8/8/8/8/8/7K b - - 0 1";
    expect(uci(fen)).toEqual([]);
    expect(perft(fen, 1)).toBe(0);
    expect(perft(fen, 4)).toBe(0); // a pre-depth mate is NOT counted as a node (spec criterion 3)
  });

  it("stalemate: moves() === [], perft depth 1 === 0, but perft depth 0 === 1 (A2: perft(0) = 1)", () => {
    // Ka8 not in check; Qc7 covers a7, b7 and b8.
    const fen = "k7/2Q5/8/8/8/8/8/4K3 b - - 0 1";
    expect(uci(fen)).toEqual([]);
    expect(perft(fen, 1)).toBe(0);
    expect(perft(fen, 0)).toBe(1);
  });
});

describe("determinism and non-mutation (spec artifact contract + notation pin 5)", () => {
  it("calling moves() twice on the same position returns the same duplicate-free set (canonical Kiwipete, depth-1 count 48 per RESEARCH.md §3.2)", () => {
    const pos = parseFen(
      "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -",
    );
    const first = [...moves(pos)].sort();
    const second = [...moves(pos)].sort();
    expect(first).toEqual(second);
    expect(first.length).toBe(48); // RESEARCH.md §3.2 depth-1 count
    expect(new Set(first).size).toBe(first.length);
  });
});
