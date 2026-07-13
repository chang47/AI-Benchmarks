# Spec — Playable Chess Web Game

## Purpose

Build the reference implementation of the WebDev Arena canonical prompt "Build a game of chess"
(#3 most-asked prompt, 3,154 submissions): a playable two-player (hot-seat) chess game in one
self-contained HTML file — board rendering, click-to-move piece movement, FIDE-legal move
enforcement, turn alternation, and visible game state. Movement legality follows the FIDE Laws of
Chess (Handbook E.01, 2023). This reference is what benchmark candidates' outputs are compared
against, so it must nail every criterion below.

## Definitions

- **Square names:** algebraic notation. Files `a`–`h` left to right from White's point of view,
  ranks `1`–`8` starting from White's side. White's back rank is rank 1; Black's is rank 8.
- **Piece codes:** two-character strings — color `w`/`b` followed by piece letter `P` (pawn),
  `N` (knight), `B` (bishop), `R` (rook), `Q` (queen), `K` (king). Examples: `"wP"`, `"bK"`.
- **Board snapshot:** a plain object whose keys are exactly the occupied square names and whose
  values are piece codes (e.g. `{ "e1": "wK", "e8": "bK", ... }`).
- **Rejected move:** `move(from, to)` returns `false`, AND afterwards the board snapshot is
  deep-equal to the snapshot taken before the call, AND `turn` is unchanged.
- **Accepted move:** `move(from, to)` returns `true`, the position updates accordingly (in both
  the hook snapshot and the rendered board), and `turn` flips to the other color.

## Artifact contract (exact)

- Deliverable: `src/index.html` — exactly ONE file.
- Fully self-contained: no network requests of any kind (no CDN scripts, no external CSS/fonts/
  images). Inline everything; piece glyphs may be Unicode chess characters or inline-drawn/data-URI
  graphics.
- Opens directly via `file://` in a modern Chromium browser with zero console errors and no build
  step, server, or user interaction required to render the initial position.
- Interaction is **click-to-move**: click a piece of the side to move to select it (visible
  highlight), then click a destination square to attempt the move. Clicking another piece of the
  side to move switches the selection to it.
- Must never call `alert()`, `confirm()`, `prompt()`, or open any other blocking dialog.
- **Test hook (exact shape):** after load, `window.__chess` is an object with:
  - `board()` — function returning a fresh board snapshot (see Definitions). Mutating the returned
    object must not affect the game.
  - `turn` — reading it returns `"w"` or `"b"`, the side to move right now.
  - `move(from, to)` — function taking two square names; attempts the move for the side to move.
    Returns `true` and applies it if legal; returns `false` and changes nothing if illegal (see
    Rejected move). Castling is requested as the king's two-square move (e.g. `move("e1","g1")`);
    en passant as the capturing pawn's diagonal move onto the empty square. An optional third
    argument `"q" | "r" | "b" | "n"` selects the promotion piece when the move promotes
    (default `"q"` when omitted).
  - The hook and the rendered board must always agree: every accepted move (whether made by click
    or by `move()`) updates both.

## Acceptance criteria

Rendering & game state:

1. **Board render.** Opening `src/index.html` from disk renders an 8×8 chessboard of alternating
   light and dark squares, from White's perspective (a1 bottom-left), with a1 a DARK square and h1
   a LIGHT square (FIDE Art. 2.1: the near corner square to White's right is light). Zero console
   errors or uncaught exceptions at load and throughout every sequence below.
2. **Initial position.** At load, `board()` has exactly 32 entries matching FIDE Art. 2: White
   `a1:wR b1:wN c1:wB d1:wQ e1:wK f1:wB g1:wN h1:wR`, `a2..h2: wP`; Black `a8:bR b8:bN c8:bB
   d8:bQ e8:bK f8:bB g8:bN h8:bR`, `a7..h7: bP`. The rendered board
   shows all 32 pieces with White and Black pieces visually distinguishable and each piece type
   identifiable.
3. **White first + visible turn.** At load `turn === "w"` (FIDE Art. 1.2), and the page visibly
   indicates whose turn it is; the indicator changes after every accepted move.
4. **Click-to-move.** Clicking a piece of the side to move gives that square a visible selection
   indication; clicking a legal destination completes the move on screen; clicking an illegal
   destination does not change the position; clicking a different piece of the side to move moves
   the selection to it. A full game must be playable by clicks alone.

Legality (each rejection below must satisfy the Rejected-move definition):

5. **Turn alternation enforced.** After an accepted White move, `turn === "b"` and any
   `move()` of a White piece is rejected until Black moves (FIDE Art. 1.2) — e.g. from the start,
   after `move("e2","e4")` returns true, `move("d2","d4")` returns false.
6. **Self-capture ban + capture removal** (FIDE Art. 3.1). Moving onto a square occupied by an own
   piece is rejected (e.g. from the start, `move("a1","a2")` is false). A capturing move removes
   the captured piece: the snapshot entry count decreases by one and the destination square holds
   the mover's code.
7. **Pawn pushes** (FIDE Art. 3.7). A pawn may move one square straight forward onto an EMPTY
   square; two squares only from its starting rank with both squares empty. Rejected: a three-
   square move (e.g. `move("e2","e5")` from the start); a two-square move after the pawn has
   already moved; any forward push onto an occupied square; any backward or sideways pawn move.
8. **Pawn captures** (FIDE Art. 3.7). A pawn captures only one square diagonally forward onto a
   square occupied by an enemy piece. Rejected: straight-ahead "capture" of an enemy piece
   directly in front; a diagonal move onto an empty square (except a legal en passant, criterion
   17).
9. **Knight** (FIDE Art. 3.6). All eight L-shaped moves are available when on-board and legal, and
   the knight jumps over intervening pieces — from the initial position `move("b1","c3")` is
   accepted despite the pawn wall. Any non-L knight move is rejected.
10. **Bishop / rook / queen / king geometry** (FIDE Arts. 3.2, 3.3, 3.4, 3.8). Bishop moves only
    along diagonals; rook only along ranks/files; queen along ranks, files, or diagonals; king
    exactly one square in any direction (a two-square king move that is not castling is rejected).
    Any move off these lines is rejected.
11. **Path blocking** (FIDE Art. 3.5). Bishop, rook, and queen may not move over intervening
    pieces of either color — e.g. from the start `move("a1","a3")`, `move("c1","e3")`, and
    `move("d1","d3")` are all rejected.
12. **Illegal-move contract.** Every rejection in criteria 5–11 and 13–18 satisfies the
    Rejected-move definition exactly: `move()` returns `false`, the snapshot is unchanged, `turn`
    is unchanged, and the rendered board shows no change.
13. **Never leave the king in check** (FIDE Art. 3.9). A move that exposes or leaves one's own
    king in check is rejected — including moving a pinned piece off its pin line and moving the
    king onto an attacked square. While a king is in check, only moves that resolve the check are
    accepted.

End states (FIDE Art. 5) — verified with externally pinned sequences:

14. **Checkmate.** Playing the Fool's mate line `1. f3 e6 2. g4 Qh4#` (hook calls:
    `move("f2","f3")`, `move("e7","e6")`, `move("g2","g4")`, `move("d8","h4")` — all four return
    true) ends the game: the page visibly declares the result with the winner (Black wins, FIDE
    Art. 5.1.1), a check/checkmate indication is shown, and EVERY subsequent `move()` call returns
    false.
15. **Stalemate.** Playing Sam Loyd's 10-move stalemate `1.e3 a5 2.Qh5 Ra6 3.Qxa5 h5 4.Qxc7 Rah6
    5.h4 f6 6.Qxd7+ Kf7 7.Qxb7 Qd3 8.Qxb8 Qh7 9.Qxc8 Kg6 10.Qe6` (hook calls in order: e2→e3,
    a7→a5, d1→h5, a8→a6, h5→a5, h7→h5, a5→c7, a6→h6, h2→h4, f7→f6, c7→d7, e8→f7, d7→b7, d8→d3,
    b7→b8, d3→h7, b8→c8, f7→g6, c8→e6 — all nineteen return true) ends the game: the page visibly
    declares a draw by stalemate (FIDE Art. 5.2.1) and every subsequent `move()` returns false.

Special moves (FIDE Arts. 3.7, 3.8):

16. **Promotion** (FIDE Art. 3.7). A pawn reaching the far rank never remains a pawn. With no
    third argument the pawn becomes a queen (`"wQ"`/`"bQ"` in the snapshot); passing `"n"`, `"r"`,
    or `"b"` produces that piece instead (all four FIDE choices work through the hook). The click
    UI may auto-queen or offer a non-dialog picker. Promotion combined with capture works.
17. **En passant** (FIDE Art. 3.7). Immediately after an enemy pawn's two-square advance passes an
    adjacent friendly pawn's attack square, that pawn may capture it as if it had advanced only
    one square: the capturer lands on the crossed EMPTY square and the enemy pawn is removed from
    the snapshot. The right lasts only for the immediately following move — one move later the
    same capture is rejected.
18. **Castling** (FIDE Art. 3.8). Kingside and queenside castling for both colors via the king's
    two-square move: the king moves two squares toward the rook and that rook lands on the square
    the king crossed (e.g. after `move("e1","g1")`, the snapshot has `g1:wK` and `f1:wR`).
    Rejected whenever: the king or that rook has previously moved (FIDE Art. 3.8.2.1, permanent —
    even if they return to their original squares); any piece stands between king and rook; or the
    king's start, crossing, or landing square is attacked by an enemy piece (FIDE Art. 3.8.2.2).
