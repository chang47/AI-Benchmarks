# Research — Task 11: Chess Legal-Move Generator (perft-graded)

Stage 1 of research -> freeze -> build -> verify. Retrieved 2026-07-12.
Meta-rule honored: every number and rule below is adopted from an external authority, cited inline. Nothing is invented.

## Authorities

| # | Authority | URL | Used for |
|---|-----------|-----|----------|
| A1 | Chess Programming Wiki — Perft Results | https://www.chessprogramming.org/Perft_Results | Canonical FENs + node counts (the holdout answer key) |
| A2 | Chess Programming Wiki — Perft | https://www.chessprogramming.org/Perft | Definition of perft (what counts as a node) |
| A3 | FIDE Laws of Chess, effective 1 Jan 2023 (E.01) | https://handbook.fide.com/chapter/E012023 | Move legality (pawn/EP/promotion Art. 3.7, castling Art. 3.8, check Art. 3.9) |

## 1. Definition of perft (A2, verbatim where quoted)

- Perft is "a debugging function to walk the move generation tree of **strictly legal moves** to count all the **leaf nodes of a certain depth**." (A2)
- Nodes are counted **only at the last makemove**; "'higher' terminal nodes (e.g. mate or stalemate) are **not** counted" (A2). I.e., a checkmate/stalemate reached before the target depth simply contributes 0 leaves below it — no early +1.
- perft(0) = 1 (the current position is one leaf at depth 0). (A2)
- Perft "ignores draws by repetition, by the fifty-move rule and by insufficient material" (A2) — the halfmove clock never terminates the search.
- Counts are at **exactly** the given depth, not cumulative across depths. (A2)

## 2. Move legality (A3 — FIDE Laws of Chess, in force from 1 Jan 2023)

- **Pawn (Art. 3.7):** one square forward to an empty square (3.7.1); optionally two squares on its first move (3.7.2); captures diagonally forward (3.7.3); **en passant** per 3.7.3.1–3.7.3.2 (capture of a pawn that just advanced two squares, as if it had advanced one, available only on the immediately following move); **promotion** per 3.7.3.3–3.7.3.5 (pawn reaching the last rank MUST be exchanged for a queen, rook, bishop or knight of its own colour — 4 distinct moves per promoting push/capture).
- **King & castling (Art. 3.8):** king moves one square (3.8.1). Castling (3.8.2): right is **lost** if the king has moved, or with a rook that has moved (3.8.2.1). Castling is **prevented** "if the square on which the king stands, or the square which it must cross, or the square which it is to occupy, is attacked", or "if there is any piece between the king and the rook" (3.8.2.2). Note the asymmetry this implies for queenside: the b-file square must be **empty** (between king and rook) but may be **attacked** (the king does not cross it).
- **Check (Art. 3.9):** "No piece can be moved that will either expose the king of the same colour to check or leave that king in check" (3.9.2). This is what makes the generator *legal* (pins, EP-discovered-check, etc.), not pseudo-legal. The classic trap: an en-passant capture removes TWO pawns from the 4th/5th rank and can expose one's own king along that rank — Position 3 (below) exists to test exactly this.

## 3. Canonical holdout — FENs and node counts (A1, verbatim)

All numbers below were read from A1 on 2026-07-12 and are stored machine-readably in `canonical-data.json` (same folder). These are the HIDDEN answer key: they go to the verifier, never to the builder (spec.md and frozen-prompt.md contain no node counts).

### 3.1 Initial position — graded depths 1–5

FEN: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`

| Depth | Nodes |
|---|---|
| 1 | 20 |
| 2 | 400 |
| 3 | 8,902 |
| 4 | 197,281 |
| 5 | 4,865,609 |
| 6 (extended, not graded) | 119,060,324 |

### 3.2 Position 2 "Kiwipete" — graded depths 1–4

FEN (verbatim from A1, note it is **4-field** — no halfmove/fullmove counters):
`r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -`

| Depth | Nodes |
|---|---|
| 1 | 48 |
| 2 | 2,039 |
| 3 | 97,862 |
| 4 | 4,085,603 |
| 5 (extended, not graded) | 193,690,690 |

### 3.3 Position 3 — graded depths 1–5 (the EP-pin position)

FEN: `8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1`

| Depth | Nodes |
|---|---|
| 1 | 14 |
| 2 | 191 |
| 3 | 2,812 |
| 4 | 43,238 |
| 5 | 674,624 |
| 6 (extended, not graded) | 11,030,083 |

### 3.4 Position 4 — graded depths 1–4, PLUS its mirror at depths 1–4

FEN: `r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1`

Mirrored FEN (A1 publishes it as behaving identically — same node counts at every depth):
`r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1`

| Depth | Nodes (both FENs) |
|---|---|
| 1 | 6 |
| 2 | 264 |
| 3 | 9,467 |
| 4 | 422,333 |
| 5 (extended, not graded) | 15,833,292 |

### 3.5 Position 5 — graded depths 1–4

FEN: `rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8`

| Depth | Nodes |
|---|---|
| 1 | 44 |
| 2 | 1,486 |
| 3 | 62,379 |
| 4 | 2,103,487 |
| 5 (extended, not graded) | 89,941,194 |

### 3.6 Position 6 — graded depths 1–4

FEN: `r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10`

| Depth | Nodes |
|---|---|
| 1 | 46 |
| 2 | 2,079 |
| 3 | 89,890 |
| 4 | 3,894,594 |
| 5 (extended, not graded) | 164,075,551 |

## 4. Depth selection — stated time bound

Graded suite = **30 (fen, depth) pairs** totaling ≈ **16.5M leaf nodes** (largest single case: initial-position depth 5 at 4,865,609). Judgment: a straightforward legal (or pseudo-legal + verify) move generator in plain JS runs ~0.25–1M NPS on Node 18 commodity hardware, so the whole graded suite completes in roughly 20–70 s. **Bound adopted: the graded suite must finish in under 120 s total** (spec criterion). Depths beyond the graded set (initial d6, Kiwipete d5, etc.) are recorded above as *extended* — informational only, never graded, because they are 25–200x more nodes and would blow the budget on a naive JS implementation.

## 5. Conventions adopted (disagreement notes)

1. **UCI move notation** (pinned in spec.md): lowercase `from`+`to` coordinates; promotion appends a lowercase piece letter (`q r b n`), e.g. `e7e8q`; **castling is written as the king's two-square move** (`e1g1`, `e1c1`, `e8g8`, `e8c8`) — the standard UCI convention, NOT the Chess960 king-takes-rook form (`e1h1`); en passant is written as the capturing pawn's diagonal move to the (empty) target square. This is the universal UCI protocol convention; no disagreement in the community for standard chess.
2. **4-field FEN tolerance:** A1 publishes Kiwipete WITHOUT halfmove/fullmove fields. Convention adopted: `parseFen` must accept both 6-field and 4-field FENs, defaulting halfmove=0, fullmove=1. (Spec pins this; the grader will use the verbatim A1 string.)
3. **EP-square-in-FEN disagreement (noted, immaterial here):** some tools emit the FEN en-passant field only when an EP capture is actually possible; the FEN standard emits it after every double push. This affects FEN *generation*, not perft counts (an unusable EP square yields no legal move either way). We only ever *parse* published FENs, so no convention is needed beyond: use the EP field if present and legal. No graded number depends on this disagreement.
4. **perft counts leaf nodes only** (no early counting of mates/stalemates at shallower depths) — per A2, quoted in §1. Some hobby implementations count terminal mates early; that convention is explicitly REJECTED because it diverges from A1's published tables.
5. **Fifty-move / repetition ignored** in perft — per A2. The halfmove clock is parsed but never terminates the search.

## 6. Contamination assessment (for metadata + verifier design)

**Medium.** The six CPW positions and their node counts are among the most heavily reproduced numbers in chess-programming literature; any strong model has them memorized. Memorization does NOT trivially defeat grading (the graded artifact is a *function*, not the numbers) — but a lookup table keyed on the six famous FENs would. **Verifier guidance (binding):** in addition to the 30 canonical pairs, grade (a) `moves()` output piped through sub-positions — divide-style: apply one legal move, then perft(depth−1) on the result must sum to the parent count; and (b) the mirrored Position 4 FEN (already in the holdout) plus at least one FEN the verifier derives itself by making 1–2 moves from a canonical position (its expected count is derivable from the frozen implementation-independent recursion, i.e. cross-check with a trusted engine or the divide identity). Any hardcoded FEN→count map fails (a) immediately.

## 7. Cross-verification note

The A1 fetch was cross-checked against widely mirrored values for all six positions at the graded depths (e.g. initial 1–6: 20 / 400 / 8,902 / 197,281 / 4,865,609 / 119,060,324; Kiwipete 1–4: 48 / 2,039 / 97,862 / 4,085,603). No discrepancies. Numbers in `canonical-data.json` are copied verbatim from the A1 fetch of 2026-07-12.
