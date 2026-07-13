# Research — 12-chess-webgame

Stage-1 research log. Every adopted rule/number below traces to an external authority fetched
2026-07-12. Nothing in spec.md is agent-invented except explicitly labeled CONVENTIONS, each of
which is noted here with its rationale.

## 1. Canonical prompt (frozen verbatim)

- Source: **WebDev Arena launch blog** — https://arena.ai/blog/webdev-arena/
- Verbatim prompt text: **"Build a game of chess"**
- Provenance detail: appears twice on the page — in the examples section (figure caption) and in
  the "5 most asked questions" table, where it ranks **#3 with 3,154 submissions**. This makes it
  community-canonical, not agent-invented.
- Frozen as `frozen-prompt.md` with one `[ADAPTED]` delivery clause (single self-contained HTML
  file) because WebDev Arena serves models a hosted sandbox, while this bench's artifact contract
  is a plain `file://` HTML file. The adaptation changes delivery format only, not the task.

## 2. What WebDev Arena voters reward

- arena.ai blog (same URL): "Users interact with both apps and vote on the better one." Votes feed
  a Bradley-Terry ranking; the whole signal is interactive preference — i.e. **does the app work
  when a human plays with it**.
- Epoch AI's description of the benchmark — https://epoch.ai/benchmarks/webdev-arena — "The skills
  which may help models perform well include anything necessary to create an appealing application
  that functions as the user intended it to."
- Adopted consequence for the checklist: criteria are weighted toward **playable-in-the-browser
  behavior** (rendering, click interaction, visible turn/game state, illegal-move rejection), not
  toward engine internals. Clean UI is captured as objectively checkable rendering criteria
  (alternating board colors, distinguishable pieces, visible selection highlight, visible
  turn/game-over state), never as taste adjectives.

## 3. Movement legality — FIDE Laws of Chess

Authority: **FIDE Handbook, E.01 Laws of Chess (2023)** — https://handbook.fide.com/chapter/E012023
(fetched 2026-07-12; quotes below verbatim from the fetch). Article numbers used in spec.md are
only those returned verbatim by the fetch (1.2, 2.1, 3.1–3.9, 3.8.2.1, 3.8.2.2, 5.1.1, 5.2.1);
pawn sub-rules are cited as "Art. 3.7" without invented sub-numbers.

| Adopted rule | FIDE article (verbatim basis) |
|---|---|
| White moves first; players then alternate | 1.2 "The player with the light-coloured pieces (White) makes the first move, then the players move alternately" |
| Board orientation: near-right corner square is light → **h1 is a light square, a1 dark** (White's view) | 2.1 "the near corner square to the right of the player is white" |
| Initial array: R N B Q K B N R on rank 1, pawns rank 2; Black mirrored on 8/7 → **32 pieces** | Art. 2 (initial position) |
| No moving onto own piece; capture removes the opponent's piece from the board | 3.1 |
| Bishop: diagonals only | 3.2 |
| Rook: file/rank only | 3.3 |
| Queen: file, rank, or diagonal | 3.4 |
| Bishop/rook/queen may not move over intervening pieces (path blocking) | 3.5 |
| Knight: nearest square not on same rank/file/diagonal (the "L"; implies jumping) | 3.6 |
| Pawn: one forward to an EMPTY square; optional two squares on its first move; captures diagonally onto an occupied enemy square; en passant; promotion must exchange the pawn for a new queen, rook, bishop or knight | 3.7 |
| King: one square any direction; castling = king two squares toward the rook, rook to the square the king crossed | 3.8 |
| Castling permanently illegal if the king or that rook has already moved | 3.8.2.1 |
| Castling temporarily prevented if the king's start/cross/landing square is attacked, or a piece stands between king and rook | 3.8.2.2 |
| No move may expose or leave one's own king in check (covers pins and king-into-attack) | 3.9 |
| Checkmate wins the game | 5.1.1 |
| Stalemate (no legal move, not in check) is a draw | 5.2.1 |

## 4. Verification test sequences (external, verified verbatim)

- **Fastest checkmate (Fool's mate)** — https://en.wikipedia.org/wiki/Fool%27s_mate — verbatim:
  "1. f3 e6 2. g4 Qh4#" (two moves; article notes eight distinct move-order variants). Adopted as
  the spec's checkmate test line. Coordinate form: f2→f3, e7→e6, g2→g4, d8→h4.
- **Fastest stalemate (Sam Loyd, 10 moves)** — https://en.wikipedia.org/wiki/Stalemate — verbatim:
  "1.e3 a5 2.Qh5 Ra6 3.Qxa5 h5 4.Qxc7 Rah6 5.h4 f6 6.Qxd7+ Kf7 7.Qxb7 Qd3 8.Qxb8 Qh7 9.Qxc8 Kg6
  10.Qe6". Adopted as the spec's stalemate test line. Coordinate form: e2→e3, a7→a5, d1→h5, a8→a6,
  h5→a5, h7→h5, a5→c7, a6→h6, h2→h4, f7→f6, c7→d7, e8→f7, d7→b7, d8→d3, b7→b8, d3→h7, b8→c8,
  f7→g6, c8→e6. (Line hand-audited move-by-move against FIDE Art. 3 during research: every move is
  geometrically legal, the 6.Qxd7+ check is met by Kf7, and the final position is a genuine
  stalemate — Black's f6 pawn is pinned along rank 6, all other Black moves are blocked, Black is
  not in check.)

## 5. Disagreements found + conventions picked

1. **Promotion choice vs auto-queen.** FIDE Art. 3.7 requires the player to choose Q/R/B/N.
   One-shot web chess games conventionally auto-queen. CONVENTION: the test hook's `move()` takes
   an optional promotion argument (all four FIDE pieces must work — full FIDE compliance at the
   engine level), while the click UI may auto-queen or offer a non-dialog picker (playability
   level). This keeps the FIDE requirement checkable without demanding picker UI in a one-shot.
2. **Draw rules beyond stalemate.** FIDE also draws by dead position, agreement, 50-move,
   repetition (Art. 5.2.2 ff., 9). CONVENTION: OUT OF SCOPE — not objectively reachable in a short
   scripted verification, absent from the WebDev Arena one-shot scope ("playable two-player game"),
   and voters do not exercise them. Only checkmate (5.1.1) and stalemate (5.2.1) end states are
   required.
3. **Competition rules.** Clocks, draw offers, resignation, touch-move, arbiter articles (Art. 4,
   6+) are physical/competition rules with no web-game analog. OUT OF SCOPE.
4. **Board perspective.** FIDE 2.1 fixes square coloring, not screen orientation. CONVENTION:
   render from White's perspective (a1 bottom-left, standard for single-view hot-seat two-player);
   a flip feature is optional and ungraded.
5. **Check indicator.** FIDE does not require a UI display of "check"; WebDev Arena playability
   does reward visible state. CONVENTION: a visible check indication is required as part of
   "visible game state" (it is objectively checkable after a known checking sequence).
6. **Fool's mate variant.** Wikipedia's primary line uses 1...e6; 1...e5 variants also exist.
   CONVENTION: the spec pins the article's primary verbatim line (1. f3 e6 2. g4 Qh4#) so the
   verifier has exactly one canonical sequence.

## 6. Authorities (all fetched 2026-07-12)

1. https://arena.ai/blog/webdev-arena/ — canonical prompt + voter mechanics
2. https://handbook.fide.com/chapter/E012023 — FIDE Laws of Chess (movement legality)
3. https://epoch.ai/benchmarks/webdev-arena — what voters reward (independent description)
4. https://en.wikipedia.org/wiki/Fool%27s_mate — fastest-checkmate test sequence
5. https://en.wikipedia.org/wiki/Stalemate — fastest-stalemate test sequence (Sam Loyd)
