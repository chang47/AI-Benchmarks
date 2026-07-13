# Frozen one-shot prompt — Task 11: Chess Legal-Move Generator (perft)

> This exact prompt is what a raw model under test receives. It contains the contract and the rules (community-canonical wording verbatim, cited) but NOT the answer key: the canonical perft node counts are withheld and used only by the grader.

---

Write a chess legal-move generator in plain modern JavaScript as a single ES module for Node 18+, with **no dependencies**, in a file `src/movegen.mjs` exporting exactly three functions:

```js
export function parseFen(fen);     // FEN string -> position object (any internal representation)
export function moves(position);   // position -> array of ALL legal moves as UCI strings
export function perft(fen, depth); // FEN string + integer depth -> integer leaf-node count
```

**Perft definition** (Chess Programming Wiki, https://www.chessprogramming.org/Perft): perft is "a debugging function to walk the move generation tree of strictly legal moves to count all the leaf nodes of a certain depth". Nodes are counted only after the last move is made, so "'higher' terminal nodes (e.g. mate or stalemate) are not counted"; perft "ignores draws by repetition, by the fifty-move rule and by insufficient material". `perft(fen, 0)` returns 1. `perft(fen, 1)` equals the number of legal moves.

**Move legality** follows the FIDE Laws of Chess in force from 1 January 2023 (https://handbook.fide.com/chapter/E012023):

- Article 3.9.2: "No piece can be moved that will either expose the king of the same colour to check or leave that king in check." Your generator must be strictly legal (pins respected, check evasion only when in check, king never steps onto an attacked square).
- Article 3.7 (pawns): single push to an empty square; a two-square advance on the pawn's first move; diagonal captures; **en passant** (capture of an enemy pawn that has just advanced two squares, as if it had advanced only one, available only on the immediately following move); **promotion** — a pawn reaching the last rank must be exchanged for a queen, rook, bishop or knight of its own colour.
- Article 3.8.2 (castling): the right to castle is lost if the king has already moved, or with a rook that has already moved; castling is prevented "if the square on which the king stands, or the square which it must cross, or the square which it is to occupy, is attacked", or "if there is any piece between the king and the rook".

Watch the classic exact-count traps: an en-passant capture removes two pawns from the same rank and may illegally expose your own king along that rank; queenside castling requires the b-file square to be empty but it may be attacked; every promotion generates four distinct moves; castling rights must be dropped when a rook is captured on its home corner.

**Notation (exact):** UCI coordinate strings, lowercase: `"e2e4"`; promotions append `q`/`r`/`b`/`n` as in `"e7e8q"`; castling is the king's two-square move (`"e1g1"`, `"e1c1"`, `"e8g8"`, `"e8c8"`); en passant is the pawn's diagonal move to the empty target square. No duplicate moves; order does not matter.

**FEN:** accept standard 6-field FEN, and also 4-field FEN with the halfmove clock and fullmove number omitted (default 0 and 1) — some canonical published test positions omit them.

**Grading:** your `perft` will be run against the community-canonical node counts for the standard test positions published on the Chess Programming Wiki (initial position, "Kiwipete", positions 3–6 and a colour-mirrored variant) at depths from 1 up to at most 5, plus divide-style consistency checks on sub-positions reached during the search — so hardcoding famous FEN-to-count tables will fail. Exact match is required at every graded depth. The full graded suite is roughly 16–17 million leaf nodes and must complete in under 120 seconds single-threaded on Node 18, so use make/unmake or copy-make with a reasonable attacked-square test (bitboards not required).

Output the complete contents of `src/movegen.mjs` and nothing else.
