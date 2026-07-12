# Spec — Tennis Scoring Engine + Scoreboard (task 01-tennis-scorekeeper)

## Purpose

Build a pure tennis-match scoring engine (a state machine over "player X won a point"
events) plus a minimal scoreboard web UI on top of it. The engine must implement official
tennis scoring — game points 0/15/30/40 with deuce/advantage (or no-ad deciding point),
tie-break sets with a 7-point tiebreak at 6-6, best-of-3 or best-of-5 matches, and an
optional 10-point match tiebreak in place of the deciding set. Scoring rules follow the
ITF Rules of Tennis; serve and side rotation are OUT of scope entirely.

## Artifact contract (exact)

Deliver exactly these two files:

### `src/engine.mjs` — pure ES module, no dependencies, no DOM access, exporting:

1. `createMatch(config) -> state`
   - `config` is an object: `{ sets: 3|5, noAd: boolean, superTiebreak: boolean }`.
   - Every field is optional; defaults are `{ sets: 3, noAd: false, superTiebreak: false }`.
   - `sets` means best-of: 3 = first to 2 sets wins, 5 = first to 3 sets wins.
   - `noAd: true` means games are decided by a single deciding point at deuce (see AC-9/10).
   - `superTiebreak: true` means the deciding set is replaced by a 10-point match tiebreak
     (see AC-19..22).
   - Returns the initial match state. State shape is otherwise up to the builder, but it
     must be a plain JSON-serializable object (no functions, no classes required to read it).

2. `pointTo(state, player) -> state`
   - `player` is exactly `"p1"` or `"p2"`.
   - Pure function: it MUST NOT mutate the input state; it returns a NEW state object
     reflecting one point won by `player`.
   - If the match is already over, it returns the state unchanged (the same state value;
     feeding points to a finished match is a no-op).

3. `scoreboard(state) -> view`
   - Returns a plain object:
     ```
     {
       points:     [string, string],  // current game (or tiebreak) points, [p1, p2] order
       games:      [int, int],        // games in the CURRENT set, [p1, p2] order
       sets:       [[int, int], ...], // completed sets in play order, each [p1, p2]
       inTiebreak: boolean,           // true during a 7-pt tiebreak or 10-pt match tiebreak
       over:       boolean,           // true once the match is decided
       winner:     null | "p1" | "p2"
     }
     ```
   - All arrays are ALWAYS `[p1, p2]` ordered (player-ordered; there is no serve concept).

### `src/index.html` — minimal scoreboard UI
- A single static HTML page that imports the engine with
  `<script type="module">` (`import ... from "./engine.mjs"`). No frameworks, no build
  step, no network requests; it must work opened from a static file server.
- Renders the full scoreboard view: both players' current points, current-set games,
  completed set scores, a visible indication when a tiebreak is in progress, and the
  winner when the match is over.
- Controls: a "Point P1" button, a "Point P2" button, and a "New Match" control that
  starts a fresh match (it may expose the three config options; plain defaults are fine).
- Point buttons must stop changing the score once the match is over.
- No `alert()`/`confirm()`/`prompt()`; render everything into the page.

No other files are required. Do not write tests (they are provided separately by the
benchmark).

## Scoring rules and display conventions (normative)

- Game points display as the strings `"0"`, `"15"`, `"30"`, `"40"`; advantage displays as
  exactly `"Ad"` for the player holding it while the opponent shows `"40"`; deuce shows
  `"40"` / `"40"`.
- Tiebreak and match-tiebreak points display as numeric strings: `"0"`, `"1"`, `"2"`, …
- Winning a game resets `points` to `["0","0"]` and increments the winner's entry in
  `games`. Winning a set appends the completed set's game score to `sets` and resets
  `games` to `[0,0]`. This applies uniformly, including the match-winning set — the final
  state shows `points ["0","0"]`, `games [0,0]`, all completed sets in `sets`.

## Acceptance criteria

### Match creation
1. `createMatch()` (no argument or `{}`) returns a state whose scoreboard reads:
   `points ["0","0"]`, `games [0,0]`, `sets []`, `inTiebreak false`, `over false`,
   `winner null`, with defaults best-of-3, ad scoring, no super tiebreak.
2. Config fields are honored: `{sets: 5}` makes the match best-of-5; `{noAd: true}`
   enables no-ad games; `{superTiebreak: true}` enables the match tiebreak.

### Standard game (ad scoring)
3. Points advance `"0" -> "15" -> "30" -> "40"` for each point a player wins; e.g. after
   p1 wins 2 points and p2 wins 1, the scoreboard shows `points ["30","15"]`.
4. A player with `"40"` who wins the next point wins the game — UNLESS both players are
   at `"40"` (deuce, see 5): the winner's `games` count increments by 1 and `points`
   resets to `["0","0"]`.
5. When both players have won three points, the score is deuce: `points ["40","40"]`.
6. From deuce, the player who wins the next point holds advantage: scoreboard shows
   `"Ad"` for that player and `"40"` for the opponent (e.g. `["Ad","40"]` when p1 leads).
7. From advantage: if the advantage holder wins the next point they win the game; if the
   opponent wins it, the score returns to deuce (`["40","40"]`).
8. Deuce/advantage may cycle indefinitely — e.g. 20 consecutive alternating points after
   deuce leave the game still undecided; a player must win two consecutive points from
   deuce to take the game.

### No-ad game (`noAd: true`)
9. At deuce (`["40","40"]`), the very next point decides the game — the winner of that
   point wins the game; there is never an `"Ad"` display in a no-ad match.
10. Before deuce, no-ad games behave identically to standard games (criteria 3-4).
11. `noAd` does NOT change tiebreak or match-tiebreak rules — those always require the
    two-point margin (criteria 15, 21).

### Set
12. The first player to win 6 games with a margin of at least 2 wins the set (6-0 through
    6-4, or 7-5): the completed set's game pair is appended to `sets` and `games` resets
    to `[0,0]`.
13. At 6-5, the set is NOT over: the leader must reach 7-5, or the score goes to 6-6.
14. At 6-6, a tiebreak game begins: `inTiebreak` becomes `true` and `points` shows numeric
    strings starting `["0","0"]`.

### Tiebreak (at 6-6)
15. The tiebreak is won by the first player to reach 7 points with a margin of at least 2;
    at 6-6 or beyond within the tiebreak, play continues without cap until one player
    leads by 2 (e.g. 7-5 and 8-6 and 14-12 all end it; 7-6 does not).
16. Tiebreak points display numerically for both players during the tiebreak (e.g.
    `["6","5"]`), and `games` still reads `[6,6]`.
17. The tiebreak winner wins the set 7-6: `sets` records `[7,6]` (or `[6,7]`) regardless
    of the internal tiebreak point score; `inTiebreak` returns to `false`; `games` resets.

### Match
18. Best-of-3 ends the moment a player wins 2 sets; best-of-5 ends at 3 sets. `over`
    becomes `true`, `winner` is `"p1"` or `"p2"`, and no further set is played (a 2-0
    best-of-3 has exactly two entries in `sets`).

### Match tiebreak / super tiebreak (`superTiebreak: true`)
19. When the sets are level going into what would be the final set — 1-1 in best-of-3, or
    2-2 in best-of-5 — the deciding set is REPLACED by a 10-point match tiebreak: no
    games are played in that set; `inTiebreak` is `true`; `games` reads `[0,0]`; `points`
    count numerically from `["0","0"]`.
20. With `superTiebreak: false` (default), the deciding set is an ordinary set exactly
    like the others (tiebreak at 6-6, first to 7 — criteria 12-17).
21. The match tiebreak is won by the first player to reach 10 points with a margin of at
    least 2; at 9-9 or beyond, play continues without cap until one player leads by 2.
22. Winning the match tiebreak wins the match: the deciding set is recorded in `sets` as
    `[1,0]` (or `[0,1]`) — the 1-0 set convention — and `over`/`winner` are set.
23. The match tiebreak only triggers on level sets going into the final set; if a player
    reaches the winning set count before that (e.g. 2-0 in best-of-3), no match tiebreak
    occurs.

### Engine behavior
24. `pointTo` is pure: after `next = pointTo(prev, "p1")`, the `prev` state's scoreboard
    is unchanged (deep-equal to what it was before the call).
25. Once `over` is `true`, `pointTo` returns the state unchanged for any input — points,
    games, sets, and winner never change on a finished match.
26. A full match can be driven point-by-point through any sequence of the criteria above —
    e.g. a best-of-5 with `superTiebreak: true` reaching 2-2 then a 10-8 match tiebreak
    yields `sets` of length 5 ending `[1,0]`, `over true`.

### UI
27. Opening `src/index.html` from a static server shows both players' rows with points and
    games; clicking "Point P1" / "Point P2" advances the score per the engine; the
    tiebreak state is visibly indicated; when the match ends the winner is displayed and
    further point clicks change nothing; "New Match" resets to a fresh match.
