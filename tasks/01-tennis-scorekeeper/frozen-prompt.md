# Frozen one-shot prompt — 01-tennis-scorekeeper

> This exact prompt is given verbatim to a raw model in benchmark runs. Do not reword it
> between runs — comparisons are only valid on the frozen text below.

---

Build a tennis scoring engine and a minimal scoreboard UI, as exactly two files.

**File 1: `src/engine.mjs`** — a pure ES module (no dependencies, no DOM) exporting three functions:

- `createMatch(config) -> state` — `config = { sets: 3|5, noAd: boolean, superTiebreak: boolean }`, all fields optional, defaults `{ sets: 3, noAd: false, superTiebreak: false }`. `sets` is best-of (3 = first to 2 sets, 5 = first to 3 sets). Returns the initial match state as a plain JSON-serializable object.
- `pointTo(state, player) -> state` — `player` is `"p1"` or `"p2"`. Pure function: never mutates the input; returns a NEW state with one point awarded. If the match is already over it returns the state unchanged.
- `scoreboard(state) -> view` — returns `{ points: [string, string], games: [int, int], sets: [[int, int], ...], inTiebreak: boolean, over: boolean, winner: null|"p1"|"p2" }`. `points` is the current game or tiebreak score, `games` the current set's game count, `sets` the completed sets in order. Every array is `[p1, p2]` ordered.

**Scoring rules (ITF):**

- Standard game: points display `"0"`, `"15"`, `"30"`, `"40"`; the fourth point wins the game — except when both players have won three points, which is deuce (`"40"`/`"40"`). From deuce, the next point gives that player advantage (displayed exactly `"Ad"`, opponent stays `"40"`); the advantage holder winning the next point wins the game, losing it returns to deuce. Deuce can recur indefinitely — winning a game from deuce requires two consecutive points.
- No-ad mode (`noAd: true`): at deuce the very next point decides the game; `"Ad"` never appears. Games before deuce are unchanged, and tiebreaks are NOT affected by no-ad.
- Set: first to 6 games with a margin of 2 (6-0..6-4, 7-5). 6-5 does not end a set. At 6-6 play a tiebreak game: points count numerically (`"0"`, `"1"`, `"2"`, …), first to 7 with a margin of 2, continuing without cap until the margin is reached (7-6 does not end it; 8-6 or 14-12 does). The tiebreak winner takes the set 7-6 — record `[7,6]`/`[6,7]` in `sets` regardless of the tiebreak's internal points. `inTiebreak` is `true` only while a tiebreak is being played.
- Match: best-of-3 ends at 2 sets won, best-of-5 at 3. The match ends immediately — no extra sets are played.
- Super tiebreak (`superTiebreak: true`): when sets are level going into the final set (1-1 in best-of-3, 2-2 in best-of-5), the deciding set is replaced entirely by a 10-point match tiebreak — no games, `inTiebreak: true`, `games` reads `[0,0]`, numeric points, first to 10 with a margin of 2, no cap. Winning it wins the match; record that set as `[1,0]`/`[0,1]` in `sets`. When `superTiebreak` is false the deciding set is an ordinary set with a normal 6-6 tiebreak.
- Display/reset conventions: winning a game resets `points` to `["0","0"]` and increments `games`; winning a set appends its game pair to `sets` and resets `games` to `[0,0]` — uniformly, including the match-winning set (final state: `points ["0","0"]`, `games [0,0]`, `over: true`, `winner` set).
- Serve and side rotation are out of scope: nothing in the engine or UI tracks the server; all outputs are player-ordered `[p1, p2]`.

**File 2: `src/index.html`** — a minimal static scoreboard page that imports the engine via `<script type="module">` from `./engine.mjs` (no frameworks, no build step, no network). It shows both players' current points, current-set games, completed set scores, a visible tiebreak indicator, and the winner when the match ends. It has a "Point P1" button, a "Point P2" button, and a "New Match" control. Point buttons do nothing once the match is over. Do not use `alert()`/`confirm()`/`prompt()`.

Write complete, working code for both files. Do not write tests.
