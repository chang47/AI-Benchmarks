# Holdout Rubric — 12-chess-webgame

Answer key for grading a candidate `src/index.html` against `spec.md` (which traces to FIDE
Handbook E.01 2023, the WebDev Arena canonical prompt, and Wikipedia-pinned test sequences — see
`research/RESEARCH.md`). The builder never sees this file.

## How to run the automated checks

```
cd holdout
npm install            # installs playwright (devDependency)
node autochecks.mjs [path/to/candidate/index.html]   # default: ../src/index.html
```

- Tries system Chrome (`channel:'chrome'`), falls back to bundled chromium (auto-installs via
  `npx playwright install chromium` if needed).
- Prints JSON to stdout: per-check results (`PASS` / `FAIL` / `MANUAL`), per-criterion rollup,
  and aggregates (console errors, external requests, dialogs, rejection-contract violations).
- Screenshots for the human-judgment items land in `$AUTOCHECK_ARTIFACTS` (default
  `<system temp>/12-chess-autocheck-artifacts`).
- Exit code: 0 = all automated checks pass, 1 = at least one FAIL, 2 = harness error.

`MANUAL` means the heuristic could not decide (e.g. canvas-drawn board, unusual turn-indicator
wording); a human must judge the referenced screenshot. `MANUAL` is not a failure by itself.

## Scoring

- **Gates (G1–G4) are hard requirements** from spec.md's "Artifact contract (exact)". Any gate
  failure = overall FAIL regardless of criterion score (the artifact violates its contract).
- **Criteria 1–18 carry equal weight (1 point each, 18 total).** RESEARCH.md §2 justifies the
  criteria mix (playable-in-browser behavior over engine internals) but supplies no numeric
  weighting, so weights are equal per the holdout instruction.
- A criterion scores its point only if ALL autochecks mapped to it PASS and every MANUAL item
  mapped to it is confirmed by a human from the saved screenshots.
- Note on rejection tests: the spec requires *rejection behavior*, not a stated reason, so a few
  rejection probes are satisfiable by more than one rule (e.g. a rook "diagonal" through an
  occupied square is both off-line and blocked). Each criterion also has at least one
  unambiguous probe.

## Gates — Artifact contract (hard fail if violated)

- **G1 Test hook shape.** `window.__chess` exists after `file://` load; `board()` is a function
  returning a fresh snapshot (mutating the returned object does not leak into the next call);
  `move` is a function; `turn` reads `"w"`/`"b"`. — *Programmatic: autocheck G1 (plus G0 if the
  hook never appears).*
- **G2 No blocking dialogs.** No `alert`/`confirm`/`prompt`/`beforeunload` dialog fires during
  any sequence. — *Programmatic: playwright `dialog` events aggregated across every scenario
  (autocheck G2).*
- **G3 Fully self-contained.** Zero non-`file:`/`data:`/`blob:`/`about:` requests across all
  loads and play. — *Programmatic: request listener aggregate (autocheck G3). Also confirm the
  deliverable is exactly one file by listing `src/`.*
- **G4 Zero console errors.** No console `error` entries and no uncaught page errors at load or
  during any scripted sequence (spec criterion 1's error clause). — *Programmatic: console +
  pageerror aggregate (autocheck G4).*

## Criteria checklist (equal weight, 1/18 each)

1. **Board render — 8×8 alternating, a1 dark / h1 light (FIDE 2.1), no errors.**
   *Programmatic (heuristic): autocheck R1 locates 64 equal-size square elements in an 8×8
   lattice, extracts computed background colors, and verifies checkerboard parity with a1-group
   darker (clean luminance separation; inverted separation = FAIL). Error clause via gate G4.
   If the DOM heuristic can't find the board (e.g. canvas): MANUAL — judge `board.png`
   (8×8, alternating colors, a1 bottom-left dark, h1 light).*
2. **Initial position — exactly the 32 FIDE Art. 2 pieces.**
   *Programmatic: autocheck R2 deep-compares `board()` to the pinned 32-entry object.
   Visual half (pieces distinguishable/identifiable): MANUAL from `board.png` (autocheck R3
   placeholder reminds the grader).*
3. **White first + visible turn indicator that updates.**
   *Programmatic: autocheck R4 (`turn === "w"` at load). Indicator: autocheck R5 heuristic
   (body text mentions White at load, mentions Black and changes after 1.e4); wording that
   defeats the regex → MANUAL from screenshots. Hook-move must also repaint: autocheck R6
   (full-page screenshot before/after `move("e2","e4")` must differ).*
4. **Click-to-move: select highlight, legal completes, illegal no-op, reselect.**
   *Programmatic via the DOM grid (MANUAL for all of K1–K6 if the board isn't DOM-locatable):
   K1 pixel-diff of the e2 square before/after clicking it (highlight visible);
   K2 click e2→e4 moves the pawn and flips `turn` (verified through the hook);
   K3 click e2→e5 leaves the snapshot and turn unchanged;
   K4 click e2, then d2, then d4 — d-pawn moves (selection switched), e2 pawn untouched;
   K5 clicking Black's e7 then e5 at the start moves nothing;
   K6 the whole Fool's mate is played by clicks alone and ends the game.*
5. **Turn alternation enforced (FIDE 1.2).**
   *Programmatic: autocheck L1 — after `e2e4` returns true, `turn === "b"` and `d2d4` is cleanly
   rejected; after `e7e5`, `turn === "w"`. K5 covers the click path.*
6. **Self-capture ban + capture removes the captured piece (FIDE 3.1).**
   *Programmatic: L2 rejects `a1a2` and `b1d2` from the start; L3 plays 1.e4 d5 2.exd5 and
   asserts 31 entries with `d5 === "wP"`.*
7. **Pawn pushes (FIDE 3.7).**
   *Programmatic: L4 rejects `e2e5` (three squares), accepts e3 then rejects `e3e5` (double after
   moving), accepts single pushes and Black's double push; L5 rejects `c2c4` when c3 is occupied
   (blocked double); L6 rejects backward (`e4e3`) and sideways (`e4d4`) pawn moves; L7's
   `e4e5`-onto-occupied covers the blocked forward push.*
8. **Pawn captures only diagonal-forward onto an enemy (FIDE 3.7).**
   *Programmatic: L7 rejects straight-ahead "capture" (1.e4 e5 then `e4e5`) and diagonal moves
   onto empty squares from the start (`e2d3`, `e2f3`); L3 verifies the legal diagonal capture.*
9. **Knight L-moves + jumping (FIDE 3.6).**
   *Programmatic: L8 accepts `b1c3`, `b1a3`, `g1f3`, `g1h3` over the pawn wall and rejects
   non-L `b1b3` and `b1d4`; L9 replays 1.Nc3 a6 2.Nd5 b6 and confirms all eight L-targets from
   d5 are accepted (one fresh replay per target).*
10. **Bishop / rook / queen / king geometry (FIDE 3.2/3.3/3.4/3.8).**
    *Programmatic: L10 bishop `f1d3` accepted, off-line `f1g3` rejected; L11 rook `a1a3`
    accepted, off-line `a1b3` rejected; L12 queen `d1h5` accepted, off-line `d1e3` rejected;
    L13 king `e1e2` accepted, two-square `e1e3` and off-line `e1d3` rejected (all with cleared
    paths so geometry is the only reason).*
11. **Path blocking for sliders (FIDE 3.5).**
    *Programmatic: L14 rejects `a1a3`, `c1e3`, `d1d3`, `f1b5`, `h1h3` from the start.*
12. **Illegal-move contract (false + snapshot unchanged + turn unchanged).**
    *Programmatic: every single rejection probe in the suite runs through a helper that asserts
    all three conditions; L15 fails if ANY rejection anywhere violated the contract. Rendered
    no-change is implied by R6-style hook/render agreement plus the K3 click no-op; spot-check
    screenshots if in doubt.*
13. **Never leave own king in check (FIDE 3.9): pins, king-into-attack, must-resolve-check.**
    *Programmatic: L16 — after 1.e4 d5 2.Ke2 dxe4 the king may not step to f3/d3 (attacked by
    the e4 pawn) but e3 is accepted; L17 — after 1.e4 d5 2.Bb5+ Nc6 3.Nf3 the pinned c6 knight
    is frozen (`c6d4`, `c6e5` rejected) while `g8f6` is accepted; L18 — while in check from
    2.Bb5+, non-resolving `g8f6`/`h7h6` and king-stays-in-check `e8d7` are rejected, blocking
    `c7c6` is accepted.*
14. **Checkmate ends the game (Fool's mate, FIDE 5.1.1) + check/mate indication.**
    *Programmatic: E1 — `f2f3, e7e6, g2g4, d8h4` all return true, then `a2a3`, `g1f3`, `e1f2`,
    `g8f6` are all cleanly rejected (game locked). E2 — page text gains a mate/`Black wins`/
    `0-1` marker (else MANUAL from `mate.png`). E3 — after 1.e4 d5 2.Bb5+ the page text gains a
    "check" indication (else MANUAL from `check.png`). K6 covers the click path.*
15. **Stalemate ends the game (Sam Loyd 10-move line, FIDE 5.2.1).**
    *Programmatic: E4 — all nineteen pinned hook calls return true, then `a2a3`, `g1f3`, `g6f5`
    are cleanly rejected. E5 — page text gains a stalemate/draw marker (else MANUAL from
    `stalemate.png`).*
16. **Promotion — auto-queen default, all four choices via 3rd arg, capture-promotion.**
    *Programmatic: on the line 1.a4 b5 2.axb5 a6 3.bxa6 Bb7 4.axb7 Nc6 5.bxa8: S1 — no third
    argument yields `a8 === "wQ"` (never stays a pawn; entry count drops to 28 because the a8
    rook is captured — capture+promotion combined); S2 — fresh replays with `"q"`, `"n"`, `"r"`,
    `"b"` yield wQ/wN/wR/wB. Click-UI promotion may auto-queen (no dialog allowed — gate G2).*
17. **En passant — immediate capture works, right expires after one move.**
    *Programmatic: S3 — 1.e4 a6 2.e5 d5 then `e5d6` is accepted, lands `wP` on the crossed empty
    d6, removes the d5 pawn (31 entries); S4 — same position but after interposed 3.Nc3 a5,
    `e5d6` is cleanly rejected.*
18. **Castling — both sides both colors; rejected on moved king/rook, blocked, attacked path.**
    *Programmatic: S5 white+black kingside (Italian-style line; asserts king AND rook landing
    squares); S6 white+black queenside (d4-line; same assertions); S7 rejects `e1g1`/`e1c1`
    from the start (pieces between); S8 king moved away and back → castling still rejected
    (permanent, FIDE 3.8.2.1); S9 rook h1 moved away and back → rejected; S10 landing square g1
    attacked by a c5 bishop through the opened f2 hole → rejected, with a control replay
    (f2 pawn still home) where the same `e1g1` is accepted; S11 crossing square f1 attacked by
    a bishop on a6 → rejected, with a control (bishop on b7 instead) where `e1g1` is accepted
    (FIDE 3.8.2.2).*

## Human-judgment items (screenshots in the artifacts dir)

| Artifact | What to confirm |
|---|---|
| `board.png` | 8×8 board, alternating colors, a1 dark bottom-left, all 32 pieces drawn, White/Black distinguishable, each piece type identifiable |
| `select-e2-before/after.png` | clicking e2 produced a visible selection highlight |
| `mate.png` | game-over + winner (Black) visibly declared after Fool's mate |
| `check.png` | visible check indication after 2.Bb5+ |
| `stalemate.png` | visible draw-by-stalemate declaration after the Loyd line |
| `hookmove-before/after.png` | the rendered board repainted after a hook-driven move |

Any autocheck reported as MANUAL must be resolved by a human against these images before the
criterion's point is awarded.
