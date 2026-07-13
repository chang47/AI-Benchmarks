import { describe, it, expect } from "vitest";
import { parseFen, moves, perft } from "../movegen.mjs";

function movesFromFen(fen) {
  return moves(parseFen(fen)).sort();
}

describe("notation & FEN", () => {
  it("initial position has the 20 expected UCI moves", () => {
    const m = movesFromFen(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    expect(m.length).toBe(20);
    expect(m).toContain("e2e4");
    expect(m).toContain("e2e3");
    expect(m).toContain("g1f3");
    expect(m).toContain("b1c3");
  });

  it("perft(fen,1) === moves length", () => {
    const fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
    expect(perft(fen, 1)).toBe(moves(parseFen(fen)).length);
  });

  it("moves() does not mutate the position (called twice, same set)", () => {
    const pos = parseFen(
      "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"
    );
    const a = moves(pos).sort();
    const b = moves(pos).sort();
    expect(a).toEqual(b);
  });

  it("4-field FEN defaults halfmove 0 / fullmove 1", () => {
    const pos = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -");
    expect(pos.halfmove).toBe(0);
    expect(pos.fullmove).toBe(1);
    expect(moves(pos).length).toBe(20);
  });
});

describe("promotion", () => {
  it("a pawn push to the last rank yields exactly 4 promotion moves", () => {
    // White pawn a7, kings well apart. a7a8{q,r,b,n}
    const m = movesFromFen("8/P7/8/8/8/k7/8/7K w - - 0 1");
    const promos = m.filter((x) => x.startsWith("a7a8"));
    expect(promos.sort()).toEqual(["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);
  });

  it("a promoting capture also yields 4 moves", () => {
    // White pawn b7 can push b8 or capture on a8/c8 (black rooks). Kings apart.
    const m = movesFromFen("r1r5/1P6/8/8/8/8/8/4K1k1 w - - 0 1");
    const capA = m.filter((x) => x.startsWith("b7a8")).sort();
    const capC = m.filter((x) => x.startsWith("b7c8")).sort();
    expect(capA).toEqual(["b7a8b", "b7a8n", "b7a8q", "b7a8r"]);
    expect(capC).toEqual(["b7c8b", "b7c8n", "b7c8q", "b7c8r"]);
  });

  it("no non-promoting move to the last rank exists", () => {
    const m = movesFromFen("8/P7/8/8/8/k7/8/7K w - - 0 1");
    expect(m).not.toContain("a7a8");
  });
});

describe("castling", () => {
  it("both sides available, written as king two-square move", () => {
    const m = movesFromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(m).toContain("e1g1"); // white kingside
    expect(m).toContain("e1c1"); // white queenside
  });

  it("black castling notation", () => {
    const m = movesFromFen("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1");
    expect(m).toContain("e8g8");
    expect(m).toContain("e8c8");
  });

  it("cannot castle through an attacked square (rook on f-file)", () => {
    // Black rook on f8 attacks f1: white may not castle kingside.
    const m = movesFromFen("5r2/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).toContain("e1c1"); // queenside path (b1/c1/d1) unattacked
  });

  it("cannot castle while in check", () => {
    // Black rook on e8 checks the white king along the e-file.
    const m = movesFromFen("4r3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });

  it("queenside b-file square MAY be attacked (only needs empty)", () => {
    // Black rook on b8 attacks b1, but b1 is only a 'must be empty' square,
    // not a king-crossed square, so queenside castling is still legal.
    const m = movesFromFen("1r6/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(m).toContain("e1c1");
  });

  it("no castling right -> no castle move", () => {
    const m = movesFromFen("r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });

  it("cannot castle when a square between king and rook is occupied", () => {
    // Bishop on f1 blocks kingside.
    const m = movesFromFen("r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
  });
});

describe("en passant", () => {
  it("legal en passant is generated with the diagonal-to-target notation", () => {
    // White pawn e5, black just played d7-d5, ep target d6. exd6 e.p.
    const m = movesFromFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(m).toContain("e5d6");
  });

  it("en passant self-check is illegal (horizontal pin on the rank)", () => {
    // Black king a4, white rook h4, white pawn d4 (just moved), black pawn e4.
    // exd3 e.p. would clear both d4 and e4 from rank 4, exposing the king.
    const m = movesFromFen("8/8/8/8/k2Pp2R/8/8/4K3 b - d3 0 1");
    expect(m).not.toContain("e4d3");
    expect(m).toContain("e4e3"); // the plain push is fine
  });

  it("no en passant when FEN target is '-'", () => {
    const m = movesFromFen("4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1");
    expect(m).not.toContain("e5d6");
  });
});

describe("pins & checks", () => {
  it("an absolutely pinned piece cannot move off the pin ray", () => {
    // White king e1, white knight e2, black rook e8: the knight is pinned.
    const m = movesFromFen("4r3/8/8/8/8/8/4N3/4K3 w - - 0 1");
    expect(m.some((x) => x.startsWith("e2"))).toBe(false);
  });

  it("king may not move into a slider's ray it currently blocks (retreat)", () => {
    // Black rook e8 checks white king e1; king cannot flee to e2 (still on ray).
    const m = movesFromFen("4r3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(m).not.toContain("e1e2");
    expect(m).toContain("e1d1");
    expect(m).toContain("e1f1");
    expect(m).toContain("e1d2");
    expect(m).toContain("e1f2");
  });

  it("in check, only check-evading moves are legal", () => {
    // Simple: king must respond to the rook check.
    const pos = parseFen("4r3/8/8/8/8/8/8/4K3 w - - 0 1");
    const m = moves(pos);
    expect(m.length).toBe(4); // d1,f1,d2,f2
  });
});

describe("robustness", () => {
  it("checkmate -> no legal moves, perft depth>=1 = 0", () => {
    // Fool's mate: White is checkmated.
    const fen =
      "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(moves(parseFen(fen))).toEqual([]);
    expect(perft(fen, 1)).toBe(0);
    expect(perft(fen, 3)).toBe(0);
  });

  it("stalemate -> no legal moves", () => {
    const fen = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
    expect(moves(parseFen(fen))).toEqual([]);
    expect(perft(fen, 1)).toBe(0);
  });

  it("no duplicate moves in the initial position", () => {
    const m = movesFromFen(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    expect(new Set(m).size).toBe(m.length);
  });

  it("sliders cannot capture friendly pieces", () => {
    // White rook a1, white pawn a2: rook cannot move up past its own pawn.
    const m = movesFromFen("4k3/8/8/8/8/8/P7/R3K3 w - - 0 1");
    expect(m).not.toContain("a1a2");
  });
});
