# Spec — Chess Legal-Move Generator with Perft (Task 11)

## Purpose

Build a correct chess **legal**-move generator in plain modern JavaScript: parse a FEN string, generate every legal move (castling, en passant, promotion, pins, checks — everything), and count leaf nodes of the legal-move tree to a given depth (perft). Correctness is graded against community-canonical perft node counts that are **withheld from you** — you must derive correctness from the rules of chess, not from remembered test tables. Exact counts are unforgiving: a single wrong edge case (e.g. one illegal en-passant capture) diverges by thousands of nodes at depth 4+.

Rules authority: FIDE Laws of Chess (in force from 1 January 2023), https://handbook.fide.com/chapter/E012023 — Articles 3.1–3.9 define piece movement, castling, en passant, promotion, and check. Perft definition authority: https://www.chessprogramming.org/Perft

## Artifact contract

One file: **`src/movegen.mjs`** (ES module, Node 18+, no dependencies) exporting exactly:

```js
export function parseFen(fen);   // -> position (opaque object)
export function moves(position); // -> array of legal moves as UCI strings
export function perft(fen, depth); // -> integer leaf-node count
```

- `position` is opaque: the grader only ever feeds `parseFen`'s output into `moves`. Any internal representation is fine.
- `moves(position)` must not mutate `position` (calling it twice returns the same set).
- `perft` must be equivalent to: depth 0 -> 1; otherwise sum of `perft(position-after-m, depth-1)` over every legal move `m`.

## Notation pins (exact)

1. **UCI move strings**: lowercase from-square then to-square in algebraic file+rank coordinates, e.g. `"e2e4"`, `"g8f6"`.
2. **Promotion**: append the promotion piece as a single lowercase letter `q`, `r`, `b`, or `n`: e.g. `"e7e8q"`, `"a2b1n"`. Every promoting push or capture yields four distinct moves.
3. **Castling**: written as the king's two-square move — `"e1g1"` (White kingside), `"e1c1"` (White queenside), `"e8g8"`, `"e8c8"`. NOT the king-takes-rook (Chess960) form.
4. **En passant**: written as the capturing pawn's normal diagonal move to the (empty) en-passant target square, e.g. `"e5d6"`.
5. Move order in the array is unspecified; duplicates are forbidden.

## FEN input

6. `parseFen` must accept standard 6-field FEN: piece placement, side to move (`w`/`b`), castling rights (`KQkq` subset or `-`), en-passant target square (or `-`), halfmove clock, fullmove number.
7. `parseFen` must ALSO accept a 4-field FEN (missing halfmove clock and fullmove number — some canonical published positions omit them); default halfmove 0, fullmove 1.
8. `perft(fen, depth)` takes the FEN string directly (it may call `parseFen` internally).

## Acceptance criteria (numbered, testable)

### Perft semantics
1. `perft(fen, 0)` returns `1` for any legal position.
2. `perft(fen, 1)` equals `moves(parseFen(fen)).length` for any legal position.
3. Perft counts **leaf nodes at exactly the given depth**. A checkmate or stalemate reached before the target depth contributes zero (it has no children); it is NOT counted as a node itself and does NOT terminate other branches.
4. Draw rules (fifty-move, threefold repetition, insufficient material) are IGNORED by perft — the halfmove clock never stops the search.
5. Return value is an exact JavaScript integer (safe-integer range is sufficient for the graded depths).

### Legality (FIDE Art. 3.9.2: "No piece can be moved that will either expose the king of the same colour to check or leave that king in check")
6. Moves that leave one's own king attacked are excluded: absolute pins are respected; a checked side only gets check-evading moves; the king may not move to an attacked square (including squares shielded from a slider only by the king itself — the king cannot retreat along the checking ray).
7. **En passant self-check**: an en-passant capture removes both the capturing and the captured pawn from the board; if this exposes one's own king (classic horizontal-pin case on the 4th/5th rank), the EP capture is illegal and must not be generated.

### Castling (FIDE Art. 3.8.2)
8. Castling requires: king and the involved rook have never moved (tracked via FEN castling-rights field), and every square strictly between king and rook is empty.
9. Castling is illegal if the king's start square, the square it crosses, or its destination square is attacked by the enemy. The queenside rook's crossed square (b1/b8) MAY be attacked — it must merely be empty.
10. Castling rights are correctly extinguished during the search: king move drops both rights; a rook moving from (or being captured on) its home corner drops that side's right.

### Pawns (FIDE Art. 3.7)
11. Single push to an empty square; double push from the pawn's starting rank only, both crossed squares empty; double push sets the en-passant target square for exactly the one following ply.
12. Diagonal captures only onto enemy-occupied squares (plus the en-passant case per pin 4).
13. En passant is generated only when the FEN (or the immediately preceding double push during the search) provides the target square, and only by a pawn attacking that square, and only when legal per criterion 7.
14. A pawn reaching the last rank must promote (no non-promoting move to the last rank), producing exactly the four moves of notation pin 2, for pushes and captures alike.

### All pieces
15. Knight, bishop, rook, queen, king move geometry per FIDE Art. 3.2–3.6/3.8.1; sliding pieces stop at the first occupied square (capture if enemy, blocked if friendly); no move may capture a friendly piece.

### Performance
16. The graded suite (six standard published positions plus one mirror, depths between 1 and 5, roughly 16–17 million total leaf nodes) must complete in **under 120 seconds total** on Node 18, single-threaded, commodity hardware. Practical target: at least ~250k nodes/second. A make/unmake or copy-make approach with a reasonable attack test suffices; bitboards are not required.

### Robustness
17. `moves` on a position with no legal moves (checkmate or stalemate) returns `[]` (empty array), and `perft` on such a position at depth >= 1 returns `0`.
18. No I/O, no globals leaking between calls, deterministic output.

## What is deliberately withheld

The grader holds the canonical perft node counts for the standard test positions published on the Chess Programming Wiki (initial position, "Kiwipete", positions 3–6, including a colour-mirrored variant), at depths chosen to run within the time bound, plus divide-style consistency checks on non-famous sub-positions. Do not hardcode any FEN-to-count table — the divide checks make lookup tables fail. Derive correctness from the rules above.
