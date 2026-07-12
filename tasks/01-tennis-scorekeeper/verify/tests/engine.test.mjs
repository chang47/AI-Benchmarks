// Independent verifier suite — round 0.
// Derived ONLY from spec.md acceptance criteria AC-1..AC-26 + research/RESEARCH.md
// edge cases (section 4). Builder tests in src/tests/ were NOT read.
import { describe, it, expect } from "vitest";
import { createMatch, pointTo, scoreboard } from "../../src/engine.mjs";

// ---------- helpers (spec-level driving only) ----------

/** Feed n points to `player`. */
function pts(state, player, n = 1) {
  for (let i = 0; i < n; i++) state = pointTo(state, player);
  return state;
}
/** Win one ordinary game with 4 straight points (valid from 0-0 points, non-tiebreak). */
function game(state, player) {
  return pts(state, player, 4);
}
/** Win n straight ordinary games. */
function games(state, player, n) {
  for (let i = 0; i < n; i++) state = game(state, player);
  return state;
}
/** Win a set 6-0 with straight games (valid from 0-0 games). */
function set(state, player) {
  return games(state, player, 6);
}
/** Alternate single points p1,p2 n times each (net 0 margin change). */
function alternatePoints(state, n) {
  for (let i = 0; i < n; i++) {
    state = pointTo(state, "p1");
    state = pointTo(state, "p2");
  }
  return state;
}
/** Alternate single games p1,p2 n times each. */
function alternateGames(state, n) {
  for (let i = 0; i < n; i++) {
    state = game(state, "p1");
    state = game(state, "p2");
  }
  return state;
}
/** Drive both players to deuce (3 points each). */
function toDeuce(state) {
  state = pts(state, "p1", 3);
  state = pts(state, "p2", 3);
  return state;
}
const sb = scoreboard;

// ---------- AC-1 / AC-2: match creation ----------

describe("AC-1 createMatch defaults", () => {
  it("no argument returns the initial scoreboard", () => {
    const v = sb(createMatch());
    expect(v.points).toEqual(["0", "0"]);
    expect(v.games).toEqual([0, 0]);
    expect(v.sets).toEqual([]);
    expect(v.inTiebreak).toBe(false);
    expect(v.over).toBe(false);
    expect(v.winner).toBe(null);
  });

  it("empty object argument returns the same initial scoreboard", () => {
    const v = sb(createMatch({}));
    expect(v).toEqual({
      points: ["0", "0"],
      games: [0, 0],
      sets: [],
      inTiebreak: false,
      over: false,
      winner: null,
    });
  });

  it("default is best-of-3: two sets end the match", () => {
    let s = createMatch();
    s = set(s, "p1");
    s = set(s, "p1");
    expect(sb(s).over).toBe(true);
    expect(sb(s).winner).toBe("p1");
  });

  it("default is ad scoring: deuce produces an Ad state, not a decided game", () => {
    let s = toDeuce(createMatch());
    s = pointTo(s, "p1");
    expect(sb(s).points).toEqual(["Ad", "40"]);
    expect(sb(s).games).toEqual([0, 0]);
  });

  it("default is no super tiebreak: at 1-1 sets an ordinary set is played", () => {
    let s = createMatch();
    s = set(s, "p1");
    s = set(s, "p2");
    expect(sb(s).inTiebreak).toBe(false);
    s = game(s, "p1");
    expect(sb(s).games).toEqual([1, 0]);
  });
});

describe("AC-2 config fields are honored", () => {
  it("{sets: 5} makes the match best-of-5", () => {
    let s = createMatch({ sets: 5 });
    s = set(s, "p1");
    s = set(s, "p1");
    expect(sb(s).over).toBe(false); // 2 sets is not enough in best-of-5
    s = set(s, "p1");
    expect(sb(s).over).toBe(true);
    expect(sb(s).winner).toBe("p1");
    expect(sb(s).sets).toHaveLength(3);
  });

  it("{noAd: true} enables the deciding point at deuce", () => {
    let s = toDeuce(createMatch({ noAd: true }));
    s = pointTo(s, "p2");
    expect(sb(s).games).toEqual([0, 1]); // single point decided the game
    expect(sb(s).points).toEqual(["0", "0"]);
  });

  it("{superTiebreak: true} replaces the deciding set with a match tiebreak", () => {
    let s = createMatch({ superTiebreak: true });
    s = set(s, "p1");
    s = set(s, "p2");
    expect(sb(s).inTiebreak).toBe(true);
  });
});

// ---------- AC-3..8: standard game (ad scoring) ----------

describe("AC-3 point progression 0 -> 15 -> 30 -> 40", () => {
  it("steps through 15/30/40 for each point", () => {
    let s = createMatch();
    s = pointTo(s, "p1");
    expect(sb(s).points).toEqual(["15", "0"]);
    s = pointTo(s, "p1");
    expect(sb(s).points).toEqual(["30", "0"]);
    s = pointTo(s, "p2");
    expect(sb(s).points).toEqual(["30", "15"]); // spec's example: p1 x2, p2 x1
    s = pointTo(s, "p1");
    expect(sb(s).points).toEqual(["40", "15"]);
  });
});

describe("AC-4 winning from 40 (not deuce) wins the game", () => {
  it("40-30: holder wins the point -> game", () => {
    let s = createMatch();
    s = pts(s, "p1", 3); // 40
    s = pts(s, "p2", 2); // 30
    s = pointTo(s, "p1");
    expect(sb(s).games).toEqual([1, 0]);
    expect(sb(s).points).toEqual(["0", "0"]);
  });

  it("40-0: love game for p2 mirrors", () => {
    let s = createMatch();
    s = pts(s, "p2", 4);
    expect(sb(s).games).toEqual([0, 1]);
    expect(sb(s).points).toEqual(["0", "0"]);
  });
});

describe("AC-5 deuce at three points each", () => {
  it("3 points each shows 40/40", () => {
    const s = toDeuce(createMatch());
    expect(sb(s).points).toEqual(["40", "40"]);
    expect(sb(s).games).toEqual([0, 0]);
  });
});

describe("AC-6 advantage display", () => {
  it("p1 wins from deuce -> [Ad, 40]", () => {
    let s = toDeuce(createMatch());
    s = pointTo(s, "p1");
    expect(sb(s).points).toEqual(["Ad", "40"]);
  });

  it("p2 wins from deuce -> [40, Ad]", () => {
    let s = toDeuce(createMatch());
    s = pointTo(s, "p2");
    expect(sb(s).points).toEqual(["40", "Ad"]);
  });
});

describe("AC-7 from advantage", () => {
  it("advantage holder wins the next point -> game", () => {
    let s = toDeuce(createMatch());
    s = pointTo(s, "p1"); // Ad p1
    s = pointTo(s, "p1");
    expect(sb(s).games).toEqual([1, 0]);
    expect(sb(s).points).toEqual(["0", "0"]);
  });

  it("opponent wins the next point -> back to deuce", () => {
    let s = toDeuce(createMatch());
    s = pointTo(s, "p1"); // Ad p1
    s = pointTo(s, "p2");
    expect(sb(s).points).toEqual(["40", "40"]);
    expect(sb(s).games).toEqual([0, 0]);
  });
});

describe("AC-8 deuce/advantage cycles indefinitely", () => {
  it("20 alternating points after deuce leave the game undecided", () => {
    let s = toDeuce(createMatch());
    s = alternatePoints(s, 10); // 20 points, alternating
    expect(sb(s).games).toEqual([0, 0]);
    expect(sb(s).over).toBe(false);
    expect(sb(s).points).toEqual(["40", "40"]); // even alternation lands back on deuce
  });

  it("two consecutive points from deuce take the game", () => {
    let s = toDeuce(createMatch());
    s = alternatePoints(s, 10);
    s = pointTo(s, "p2");
    s = pointTo(s, "p2");
    expect(sb(s).games).toEqual([0, 1]);
  });
});

// ---------- AC-9..11: no-ad ----------

describe("AC-9 no-ad deciding point", () => {
  it("at deuce the very next point wins the game", () => {
    let s = toDeuce(createMatch({ noAd: true }));
    expect(sb(s).points).toEqual(["40", "40"]);
    s = pointTo(s, "p1");
    expect(sb(s).games).toEqual([1, 0]);
    expect(sb(s).points).toEqual(["0", "0"]);
  });

  it('never displays "Ad" at any step of a no-ad game', () => {
    let s = createMatch({ noAd: true });
    const seen = [];
    const seq = ["p1", "p1", "p2", "p2", "p1", "p2", "p2"]; // reaches deuce then decides
    for (const p of seq) {
      s = pointTo(s, p);
      seen.push(...sb(s).points);
    }
    expect(seen).not.toContain("Ad");
    expect(sb(s).games).toEqual([0, 1]);
  });
});

describe("AC-10 no-ad identical to standard before deuce", () => {
  it("progression and 40-30 game win match standard behavior", () => {
    let s = createMatch({ noAd: true });
    s = pts(s, "p1", 2);
    s = pointTo(s, "p2");
    expect(sb(s).points).toEqual(["30", "15"]);
    s = pointTo(s, "p1"); // 40-15
    s = pointTo(s, "p2"); // 40-30
    s = pointTo(s, "p1"); // game, no deuce reached
    expect(sb(s).games).toEqual([1, 0]);
    expect(sb(s).points).toEqual(["0", "0"]);
  });
});

describe("AC-11 noAd does not change tiebreak rules", () => {
  it("7-pt set tiebreak still needs the 2-point margin under noAd", () => {
    let s = createMatch({ noAd: true });
    s = alternateGames(s, 3); // 3-3
    s = alternateGames(s, 3); // 6-6 -> tiebreak
    expect(sb(s).inTiebreak).toBe(true);
    s = alternatePoints(s, 6); // 6-6 in the tiebreak
    s = pointTo(s, "p1"); // 7-6: NOT over
    expect(sb(s).inTiebreak).toBe(true);
    expect(sb(s).sets).toEqual([]);
    s = pointTo(s, "p1"); // 8-6: set over
    expect(sb(s).sets).toEqual([[7, 6]]);
  });

  it("10-pt match tiebreak still needs the 2-point margin under noAd", () => {
    let s = createMatch({ noAd: true, superTiebreak: true });
    s = set(s, "p1");
    s = set(s, "p2"); // 1-1 -> match tiebreak
    expect(sb(s).inTiebreak).toBe(true);
    s = alternatePoints(s, 9); // 9-9
    s = pointTo(s, "p1"); // 10-9: NOT over
    expect(sb(s).over).toBe(false);
    s = pointTo(s, "p1"); // 11-9: match over
    expect(sb(s).over).toBe(true);
    expect(sb(s).winner).toBe("p1");
  });
});

// ---------- AC-12..14: set ----------

describe("AC-12 set won at 6 games with margin >= 2", () => {
  it("6-0 set is appended and games reset", () => {
    let s = set(createMatch(), "p1");
    expect(sb(s).sets).toEqual([[6, 0]]);
    expect(sb(s).games).toEqual([0, 0]);
    expect(sb(s).points).toEqual(["0", "0"]);
  });

  it("6-4 wins the set", () => {
    let s = alternateGames(createMatch(), 4); // 4-4
    s = game(s, "p1"); // 5-4
    s = game(s, "p1"); // 6-4
    expect(sb(s).sets).toEqual([[6, 4]]);
    expect(sb(s).games).toEqual([0, 0]);
  });

  it("7-5 wins the set", () => {
    let s = alternateGames(createMatch(), 5); // 5-5
    s = game(s, "p1"); // 6-5
    s = game(s, "p1"); // 7-5
    expect(sb(s).sets).toEqual([[7, 5]]);
    expect(sb(s).games).toEqual([0, 0]);
  });
});

describe("AC-13 6-5 does not end the set", () => {
  it("games read 6-5 with no completed set and no tiebreak", () => {
    let s = alternateGames(createMatch(), 5); // 5-5
    s = game(s, "p1"); // 6-5
    expect(sb(s).games).toEqual([6, 5]);
    expect(sb(s).sets).toEqual([]);
    expect(sb(s).inTiebreak).toBe(false);
    expect(sb(s).over).toBe(false);
  });
});

describe("AC-14 6-6 starts a tiebreak", () => {
  it("inTiebreak true, numeric points from 0-0", () => {
    let s = alternateGames(createMatch(), 6); // 6-6
    expect(sb(s).inTiebreak).toBe(true);
    expect(sb(s).points).toEqual(["0", "0"]);
    expect(sb(s).games).toEqual([6, 6]);
  });
});

// ---------- AC-15..17: tiebreak ----------

describe("AC-15 tiebreak: first to 7, margin 2, uncapped", () => {
  function toTiebreak() {
    return alternateGames(createMatch(), 6);
  }

  it("7-5 ends the tiebreak", () => {
    let s = toTiebreak();
    s = alternatePoints(s, 5); // 5-5
    s = pointTo(s, "p1"); // 6-5
    s = pointTo(s, "p1"); // 7-5
    expect(sb(s).sets).toEqual([[7, 6]]);
  });

  it("7-6 does NOT end the tiebreak", () => {
    let s = toTiebreak();
    s = alternatePoints(s, 6); // 6-6
    s = pointTo(s, "p1"); // 7-6
    expect(sb(s).sets).toEqual([]);
    expect(sb(s).inTiebreak).toBe(true);
    s = pointTo(s, "p1"); // 8-6 ends it
    expect(sb(s).sets).toEqual([[7, 6]]);
  });

  it("continues uncapped: 14-12 ends it (recorded 7-6)", () => {
    let s = toTiebreak();
    s = alternatePoints(s, 12); // 12-12
    s = pointTo(s, "p1"); // 13-12
    expect(sb(s).sets).toEqual([]);
    s = pointTo(s, "p1"); // 14-12
    expect(sb(s).sets).toEqual([[7, 6]]);
  });
});

describe("AC-16 tiebreak display", () => {
  it("numeric points for both players while games hold 6-6", () => {
    let s = alternateGames(createMatch(), 6);
    s = alternatePoints(s, 5); // 5-5
    s = pointTo(s, "p1"); // 6-5
    expect(sb(s).points).toEqual(["6", "5"]);
    expect(sb(s).games).toEqual([6, 6]);
    expect(sb(s).inTiebreak).toBe(true);
  });
});

describe("AC-17 tiebreak winner takes the set 7-6", () => {
  it("sets records [7,6] regardless of internal points; inTiebreak clears; games reset", () => {
    let s = alternateGames(createMatch(), 6);
    s = pts(s, "p2", 7); // p2 wins tiebreak 7-0
    expect(sb(s).sets).toEqual([[6, 7]]);
    expect(sb(s).inTiebreak).toBe(false);
    expect(sb(s).games).toEqual([0, 0]);
    expect(sb(s).points).toEqual(["0", "0"]);
  });
});

// ---------- AC-18: match ----------

describe("AC-18 match ends at the winning set count", () => {
  it("best-of-3 ends at 2 sets with exactly two entries", () => {
    let s = createMatch();
    s = set(s, "p2");
    s = set(s, "p2");
    const v = sb(s);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p2");
    expect(v.sets).toHaveLength(2);
  });

  it("best-of-5 ends at 3 sets", () => {
    let s = createMatch({ sets: 5 });
    s = set(s, "p1");
    s = set(s, "p2");
    s = set(s, "p1");
    s = set(s, "p1");
    const v = sb(s);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p1");
    expect(v.sets).toHaveLength(4);
  });
});

// ---------- AC-19..23: super tiebreak ----------

describe("AC-19 match tiebreak replaces the deciding set", () => {
  it("best-of-3 at 1-1: inTiebreak true, games [0,0], numeric points", () => {
    let s = createMatch({ superTiebreak: true });
    s = set(s, "p1");
    s = set(s, "p2");
    const v = sb(s);
    expect(v.inTiebreak).toBe(true);
    expect(v.games).toEqual([0, 0]);
    expect(v.points).toEqual(["0", "0"]);
    // numeric display, not tennis labels
    const v2 = sb(pointTo(s, "p1"));
    expect(v2.points).toEqual(["1", "0"]);
  });

  it("best-of-5 at 2-2: same trigger", () => {
    let s = createMatch({ sets: 5, superTiebreak: true });
    s = set(s, "p1");
    s = set(s, "p2");
    s = set(s, "p1");
    expect(sb(s).inTiebreak).toBe(false); // 2-1 is not level
    s = set(s, "p2"); // 2-2
    const v = sb(s);
    expect(v.inTiebreak).toBe(true);
    expect(v.games).toEqual([0, 0]);
    expect(v.points).toEqual(["0", "0"]);
  });
});

describe("AC-20 without superTiebreak the deciding set is ordinary", () => {
  it("third set plays games and a 6-6 tiebreak like any other set", () => {
    let s = createMatch(); // default superTiebreak: false
    s = set(s, "p1");
    s = set(s, "p2");
    expect(sb(s).inTiebreak).toBe(false);
    s = alternateGames(s, 6); // 6-6 in the deciding set
    expect(sb(s).inTiebreak).toBe(true);
    s = pts(s, "p1", 7); // 7-0 tiebreak
    const v = sb(s);
    expect(v.sets).toEqual([[6, 0], [0, 6], [7, 6]]);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p1");
  });
});

describe("AC-21 match tiebreak: first to 10, margin 2, uncapped", () => {
  function toMatchTiebreak() {
    let s = createMatch({ superTiebreak: true });
    s = set(s, "p1");
    s = set(s, "p2");
    return s;
  }

  it("10-9 does not end it; 11-9 does", () => {
    let s = toMatchTiebreak();
    s = alternatePoints(s, 9); // 9-9
    s = pointTo(s, "p2"); // 9-10
    expect(sb(s).over).toBe(false);
    expect(sb(s).inTiebreak).toBe(true);
    s = pointTo(s, "p2"); // 9-11
    expect(sb(s).over).toBe(true);
    expect(sb(s).winner).toBe("p2");
  });

  it("continues uncapped past 9-9 (e.g. 14-12)", () => {
    let s = toMatchTiebreak();
    s = alternatePoints(s, 12); // 12-12
    s = pts(s, "p1", 2); // 14-12
    expect(sb(s).over).toBe(true);
    expect(sb(s).winner).toBe("p1");
  });
});

describe("AC-22 winning the match tiebreak wins the match, recorded 1-0", () => {
  it("p1 wins 10-8: deciding set recorded [1,0]", () => {
    let s = createMatch({ superTiebreak: true });
    s = set(s, "p1");
    s = set(s, "p2");
    s = alternatePoints(s, 8); // 8-8
    s = pts(s, "p1", 2); // 10-8
    const v = sb(s);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p1");
    expect(v.sets).toEqual([[6, 0], [0, 6], [1, 0]]);
  });

  it("p2 winning records [0,1]", () => {
    let s = createMatch({ superTiebreak: true });
    s = set(s, "p2");
    s = set(s, "p1");
    s = pts(s, "p2", 10); // 10-0
    const v = sb(s);
    expect(v.winner).toBe("p2");
    expect(v.sets[2]).toEqual([0, 1]);
  });
});

describe("AC-23 match tiebreak only on level sets into the final set", () => {
  it("2-0 in best-of-3 with superTiebreak on: no tiebreak ever, match over", () => {
    let s = createMatch({ superTiebreak: true });
    s = set(s, "p1");
    expect(sb(s).inTiebreak).toBe(false);
    s = set(s, "p1");
    const v = sb(s);
    expect(v.over).toBe(true);
    expect(v.sets).toHaveLength(2);
    expect(v.inTiebreak).toBe(false);
  });

  it("3-1 in best-of-5 with superTiebreak on: no match tiebreak", () => {
    let s = createMatch({ sets: 5, superTiebreak: true });
    s = set(s, "p1");
    s = set(s, "p2");
    s = set(s, "p1");
    expect(sb(s).inTiebreak).toBe(false); // 2-1: not level, ordinary 4th set
    s = set(s, "p1");
    const v = sb(s);
    expect(v.over).toBe(true);
    expect(v.sets).toHaveLength(4);
  });
});

// ---------- AC-24..26: engine behavior ----------

describe("AC-24 pointTo is pure", () => {
  it("does not mutate the previous state (mid-game)", () => {
    let prev = createMatch();
    prev = pts(prev, "p1", 2);
    prev = pointTo(prev, "p2");
    const snapshot = JSON.parse(JSON.stringify(sb(prev)));
    const next = pointTo(prev, "p1");
    expect(sb(prev)).toEqual(snapshot);
    expect(sb(next)).not.toEqual(snapshot);
  });

  it("does not mutate the previous state (in a tiebreak)", () => {
    let prev = alternateGames(createMatch(), 6);
    prev = pts(prev, "p1", 3);
    const snapshot = JSON.parse(JSON.stringify(sb(prev)));
    pointTo(prev, "p2");
    expect(sb(prev)).toEqual(snapshot);
  });

  it("does not mutate across a set boundary", () => {
    let prev = createMatch();
    prev = games(prev, "p1", 5);
    prev = pts(prev, "p1", 3); // one point from taking the set 6-0
    const snapshot = JSON.parse(JSON.stringify(sb(prev)));
    const next = pointTo(prev, "p1");
    expect(sb(prev)).toEqual(snapshot);
    expect(sb(next).sets).toEqual([[6, 0]]);
  });
});

describe("AC-25 finished match is frozen", () => {
  it("no field changes for any further input", () => {
    let s = createMatch();
    s = set(s, "p1");
    s = set(s, "p1");
    const before = JSON.parse(JSON.stringify(sb(s)));
    expect(before.over).toBe(true);
    let after = s;
    for (let i = 0; i < 10; i++) {
      after = pointTo(after, "p1");
      after = pointTo(after, "p2");
    }
    expect(sb(after)).toEqual(before);
  });
});

describe("AC-26 full point-by-point drive", () => {
  it("best-of-5 superTiebreak: 2-2 then 10-8 -> 5 sets ending [1,0]", () => {
    let s = createMatch({ sets: 5, superTiebreak: true });
    s = set(s, "p1");
    s = set(s, "p2");
    s = set(s, "p1");
    s = set(s, "p2"); // 2-2 -> match tiebreak
    expect(sb(s).inTiebreak).toBe(true);
    s = alternatePoints(s, 8); // 8-8
    s = pts(s, "p1", 2); // 10-8
    const v = sb(s);
    expect(v.sets).toHaveLength(5);
    expect(v.sets[4]).toEqual([1, 0]);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p1");
    expect(v.inTiebreak).toBe(false);
    expect(v.points).toEqual(["0", "0"]);
    expect(v.games).toEqual([0, 0]);
  });

  it("mixed realistic match: deuce battles, 7-5 set, tiebreak set", () => {
    let s = createMatch();
    // Set 1: p1 wins 7-5 including a deuce game
    s = alternateGames(s, 5); // 5-5
    s = toDeuce(s); // deuce in game 11
    s = pointTo(s, "p1"); // Ad
    s = pointTo(s, "p2"); // deuce
    s = pts(s, "p1", 2); // game -> 6-5
    s = game(s, "p1"); // 7-5
    expect(sb(s).sets).toEqual([[7, 5]]);
    // Set 2: tiebreak, p1 takes it 7-3
    s = alternateGames(s, 6); // 6-6
    s = alternatePoints(s, 3); // 3-3
    s = pts(s, "p1", 4); // 7-3
    const v = sb(s);
    expect(v.sets).toEqual([[7, 5], [7, 6]]);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p1");
  });
});

// ---------- researched edge cases (RESEARCH.md section 4) ----------

describe("RESEARCH edge cases", () => {
  it("tiebreak internal score never leaks into sets (12-10 records 7-6)", () => {
    let s = alternateGames(createMatch(), 6);
    s = alternatePoints(s, 10); // 10-10
    s = pts(s, "p2", 2); // 10-12
    expect(sb(s).sets).toEqual([[6, 7]]);
  });

  it("state is JSON-serializable at every phase", () => {
    let s = createMatch({ sets: 5, superTiebreak: true });
    const phases = [s];
    s = pts(s, "p1", 2);
    phases.push(s);
    s = set(s, "p1");
    s = set(s, "p2");
    s = set(s, "p1");
    s = set(s, "p2");
    phases.push(s); // in match tiebreak
    for (const phase of phases) {
      const round = JSON.parse(JSON.stringify(phase));
      expect(round).toEqual(phase);
    }
  });

  it("6-5 within the deciding set of a best-of-5 still does not end anything", () => {
    let s = createMatch({ sets: 5 });
    s = set(s, "p1");
    s = set(s, "p2");
    s = set(s, "p1");
    s = set(s, "p2"); // 2-2
    s = alternateGames(s, 5); // 5-5 in the decider
    s = game(s, "p2"); // 5-6
    const v = sb(s);
    expect(v.over).toBe(false);
    expect(v.games).toEqual([5, 6]);
    expect(v.sets).toHaveLength(4);
  });
});
