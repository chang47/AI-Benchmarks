// Tennis match scoring engine — pure ES module, no dependencies, no DOM access.
//
// Implements official tennis scoring per the spec (ITF Rules of Tennis):
//   - games 0/15/30/40 with deuce/advantage, or no-ad single deciding point
//   - sets to 6 games (margin 2), 7-point tiebreak at 6-6 (margin 2, uncapped)
//   - best-of-3 or best-of-5 matches
//   - optional 10-point match tiebreak replacing the deciding set (margin 2, uncapped)
// Serve/side rotation are out of scope.

const PLAYER_INDEX = { p1: 0, p2: 1 };
const GAME_LABELS = ["0", "15", "30", "40"];

const deepClone =
  typeof structuredClone === "function"
    ? structuredClone
    : (value) => JSON.parse(JSON.stringify(value));

/**
 * Create a fresh match state.
 * config: { sets: 3|5, noAd: boolean, superTiebreak: boolean } — all optional.
 * Defaults: { sets: 3, noAd: false, superTiebreak: false }.
 */
export function createMatch(config = {}) {
  if (config === null || typeof config !== "object") {
    throw new TypeError("createMatch(config): config must be an object");
  }
  const sets = config.sets === undefined ? 3 : config.sets;
  if (sets !== 3 && sets !== 5) {
    throw new RangeError("createMatch(config): config.sets must be 3 or 5");
  }
  return {
    config: {
      sets,
      noAd: config.noAd === undefined ? false : Boolean(config.noAd),
      superTiebreak:
        config.superTiebreak === undefined ? false : Boolean(config.superTiebreak),
    },
    // mode: "game" (ordinary game) | "tiebreak" (7-pt set tiebreak) | "matchTiebreak" (10-pt)
    mode: "game",
    points: [0, 0], // raw point counts within the current game / tiebreak, [p1, p2]
    games: [0, 0], // games in the current set, [p1, p2]
    sets: [], // completed sets in play order, each [p1Games, p2Games]
    over: false,
    winner: null,
  };
}

/**
 * Award one point to `player` ("p1" | "p2"). Pure: never mutates `state`.
 * On a finished match this is a no-op and returns `state` itself.
 */
export function pointTo(state, player) {
  const idx = PLAYER_INDEX[player];
  if (idx === undefined) {
    throw new RangeError('pointTo(state, player): player must be "p1" or "p2"');
  }
  if (state.over) return state;

  const s = deepClone(state);
  const other = 1 - idx;
  s.points[idx] += 1;

  if (s.mode === "game") {
    const won = s.config.noAd
      ? s.points[idx] >= 4 // deciding point at deuce; identical to standard before deuce
      : s.points[idx] >= 4 && s.points[idx] - s.points[other] >= 2;
    if (won) winGame(s, idx);
  } else if (s.mode === "tiebreak") {
    if (s.points[idx] >= 7 && s.points[idx] - s.points[other] >= 2) {
      s.games[idx] += 1; // tiebreak winner takes the set 7-6
      winSet(s, idx);
    }
  } else {
    // matchTiebreak: first to 10, margin 2, uncapped
    if (s.points[idx] >= 10 && s.points[idx] - s.points[other] >= 2) {
      s.sets.push(idx === 0 ? [1, 0] : [0, 1]); // 1-0 set convention
      s.points = [0, 0];
      s.games = [0, 0];
      s.mode = "game";
      s.over = true;
      s.winner = idx === 0 ? "p1" : "p2";
    }
  }
  return s;
}

function winGame(s, idx) {
  const other = 1 - idx;
  s.games[idx] += 1;
  s.points = [0, 0];
  if (s.games[idx] >= 6 && s.games[idx] - s.games[other] >= 2) {
    winSet(s, idx);
  } else if (s.games[0] === 6 && s.games[1] === 6) {
    s.mode = "tiebreak";
  }
}

function winSet(s) {
  s.sets.push([s.games[0], s.games[1]]);
  s.games = [0, 0];
  s.points = [0, 0];
  s.mode = "game";

  const needed = s.config.sets === 5 ? 3 : 2;
  const wonP1 = s.sets.filter(([a, b]) => a > b).length;
  const wonP2 = s.sets.filter(([a, b]) => b > a).length;

  if (wonP1 >= needed || wonP2 >= needed) {
    s.over = true;
    s.winner = wonP1 >= needed ? "p1" : "p2";
  } else if (s.config.superTiebreak && wonP1 === needed - 1 && wonP2 === needed - 1) {
    // sets are level going into what would be the final set: play a 10-pt match tiebreak
    s.mode = "matchTiebreak";
  }
}

/**
 * Read-only view of a match state. All arrays are [p1, p2] ordered.
 */
export function scoreboard(state) {
  const inTiebreak = state.mode !== "game";
  const points = inTiebreak
    ? [String(state.points[0]), String(state.points[1])]
    : gamePointLabels(state.points[0], state.points[1]);
  return {
    points,
    games: [state.games[0], state.games[1]],
    sets: state.sets.map(([a, b]) => [a, b]),
    inTiebreak,
    over: state.over,
    winner: state.winner,
  };
}

function gamePointLabels(a, b) {
  if (a >= 3 && b >= 3) {
    if (a === b) return ["40", "40"]; // deuce
    return a > b ? ["Ad", "40"] : ["40", "Ad"];
  }
  return [GAME_LABELS[a], GAME_LABELS[b]];
}
