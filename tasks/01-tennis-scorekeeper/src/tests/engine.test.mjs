// Builder's own quick tests against the spec's acceptance criteria (AC-1..26).
import { describe, it, expect } from "vitest";
import { createMatch, pointTo, scoreboard } from "../engine.mjs";

// ---------- helpers ----------

function play(state, players) {
  for (const p of players) state = pointTo(state, p);
  return state;
}

// Win one game with 4 straight points (valid in both ad and no-ad games).
function winGame(state, p) {
  return play(state, [p, p, p, p]);
}

function winGames(state, p, n) {
  for (let i = 0; i < n; i++) state = winGame(state, p);
  return state;
}

// Win a set 6-0 for `p`.
function winSet(state, p) {
  return winGames(state, p, 6);
}

// Drive the current set to 6-6 (tiebreak starts).
function reachSixSix(state) {
  state = winGames(state, "p1", 5); // 5-0
  state = winGames(state, "p2", 5); // 5-5
  state = winGame(state, "p1"); // 6-5
  state = winGame(state, "p2"); // 6-6
  return state;
}

function repeat(players, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...players);
  return out;
}

// ---------- AC-1/2: match creation ----------

describe("match creation", () => {
  it("AC-1: createMatch() defaults", () => {
    for (const st of [createMatch(), createMatch({})]) {
      const v = scoreboard(st);
      expect(v).toEqual({
        points: ["0", "0"],
        games: [0, 0],
        sets: [],
        inTiebreak: false,
        over: false,
        winner: null,
      });
    }
  });

  it("AC-2: {sets: 5} is best-of-5 (2 sets do not end it, 3 do)", () => {
    let st = createMatch({ sets: 5 });
    st = winSet(st, "p1");
    st = winSet(st, "p1");
    expect(scoreboard(st).over).toBe(false);
    st = winSet(st, "p1");
    const v = scoreboard(st);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p1");
    expect(v.sets).toEqual([[6, 0], [6, 0], [6, 0]]);
  });
});

// ---------- AC-3..8: standard game (ad scoring) ----------

describe("standard game", () => {
  it("AC-3: 0 -> 15 -> 30 -> 40 progression", () => {
    let st = createMatch();
    st = play(st, ["p1", "p1", "p2"]);
    expect(scoreboard(st).points).toEqual(["30", "15"]);
    st = play(st, ["p1"]);
    expect(scoreboard(st).points).toEqual(["40", "15"]);
  });

  it("AC-4: winning from 40 (not deuce) takes the game and resets points", () => {
    let st = createMatch();
    st = play(st, ["p1", "p1", "p1", "p1"]); // 40-0 then game
    const v = scoreboard(st);
    expect(v.games).toEqual([1, 0]);
    expect(v.points).toEqual(["0", "0"]);
  });

  it("AC-5: three points each is deuce 40/40", () => {
    let st = createMatch();
    st = play(st, ["p1", "p2", "p1", "p2", "p1", "p2"]);
    expect(scoreboard(st).points).toEqual(["40", "40"]);
  });

  it("AC-6: point after deuce gives Ad / 40 (both directions)", () => {
    let st = createMatch();
    st = play(st, ["p1", "p2", "p1", "p2", "p1", "p2"]);
    const adP1 = pointTo(st, "p1");
    expect(scoreboard(adP1).points).toEqual(["Ad", "40"]);
    const adP2 = pointTo(st, "p2");
    expect(scoreboard(adP2).points).toEqual(["40", "Ad"]);
  });

  it("AC-7: from advantage, holder wins the game; opponent returns it to deuce", () => {
    let st = createMatch();
    st = play(st, ["p1", "p2", "p1", "p2", "p1", "p2", "p1"]); // Ad p1
    const won = pointTo(st, "p1");
    expect(scoreboard(won).games).toEqual([1, 0]);
    expect(scoreboard(won).points).toEqual(["0", "0"]);
    const backToDeuce = pointTo(st, "p2");
    expect(scoreboard(backToDeuce).points).toEqual(["40", "40"]);
    expect(scoreboard(backToDeuce).games).toEqual([0, 0]);
  });

  it("AC-8: 20 alternating points after deuce never decide the game", () => {
    let st = createMatch();
    st = play(st, ["p1", "p2", "p1", "p2", "p1", "p2"]); // deuce
    st = play(st, repeat(["p1", "p2"], 10)); // 20 alternating points
    const v = scoreboard(st);
    expect(v.games).toEqual([0, 0]);
    expect(v.points).toEqual(["40", "40"]);
    // two consecutive points now win it
    st = play(st, ["p2", "p2"]);
    expect(scoreboard(st).games).toEqual([0, 1]);
  });
});

// ---------- AC-9..11: no-ad games ----------

describe("no-ad game", () => {
  it("AC-9: at deuce the next point decides the game; no Ad display", () => {
    let st = createMatch({ noAd: true });
    st = play(st, ["p1", "p2", "p1", "p2", "p1", "p2"]); // deuce
    expect(scoreboard(st).points).toEqual(["40", "40"]);
    st = pointTo(st, "p2");
    const v = scoreboard(st);
    expect(v.games).toEqual([0, 1]);
    expect(v.points).toEqual(["0", "0"]);
  });

  it("AC-10: before deuce a no-ad game matches standard scoring", () => {
    let st = createMatch({ noAd: true });
    st = play(st, ["p1", "p1", "p2"]);
    expect(scoreboard(st).points).toEqual(["30", "15"]);
    st = play(st, ["p1", "p1"]); // 40-15 then game
    expect(scoreboard(st).games).toEqual([1, 0]);
  });

  it("AC-11: noAd does not change the tiebreak margin-2 rule", () => {
    let st = createMatch({ noAd: true });
    st = reachSixSix(st);
    expect(scoreboard(st).inTiebreak).toBe(true);
    st = play(st, repeat(["p1", "p2"], 6)); // 6-6 in the tiebreak
    st = pointTo(st, "p1"); // 7-6: NOT over (needs margin 2)
    expect(scoreboard(st).inTiebreak).toBe(true);
    expect(scoreboard(st).points).toEqual(["7", "6"]);
    st = pointTo(st, "p1"); // 8-6 wins
    expect(scoreboard(st).sets).toEqual([[7, 6]]);
  });
});

// ---------- AC-12..14: set ----------

describe("set", () => {
  it("AC-12: 6 games with margin >= 2 wins the set (6-0 and 7-5)", () => {
    let st = createMatch();
    st = winGames(st, "p1", 6);
    let v = scoreboard(st);
    expect(v.sets).toEqual([[6, 0]]);
    expect(v.games).toEqual([0, 0]);

    // 7-5 path in set 2
    st = winGames(st, "p1", 5); // 5-0
    st = winGames(st, "p2", 5); // 5-5
    st = winGame(st, "p1"); // 6-5, not over
    expect(scoreboard(st).sets).toHaveLength(1);
    st = winGame(st, "p1"); // 7-5
    v = scoreboard(st);
    expect(v.sets).toEqual([[6, 0], [7, 5]]);
    expect(v.over).toBe(true); // best-of-3, p1 has 2 sets
  });

  it("AC-13: 6-5 does not end the set", () => {
    let st = createMatch();
    st = winGames(st, "p1", 5);
    st = winGames(st, "p2", 5);
    st = winGame(st, "p1"); // 6-5
    const v = scoreboard(st);
    expect(v.sets).toEqual([]);
    expect(v.games).toEqual([6, 5]);
    expect(v.inTiebreak).toBe(false);
  });

  it("AC-14: 6-6 starts a tiebreak with numeric points", () => {
    let st = reachSixSix(createMatch());
    const v = scoreboard(st);
    expect(v.inTiebreak).toBe(true);
    expect(v.points).toEqual(["0", "0"]);
    expect(v.games).toEqual([6, 6]);
  });
});

// ---------- AC-15..17: tiebreak ----------

describe("tiebreak", () => {
  it("AC-15: first to 7 with margin 2; 7-6 does not end it, 14-12 does", () => {
    // 7-5 ends it
    let st = reachSixSix(createMatch());
    st = play(st, repeat(["p1", "p2"], 5)); // 5-5
    st = play(st, ["p1", "p1"]); // 7-5
    expect(scoreboard(st).sets).toEqual([[7, 6]]);

    // 7-6 does not; margin-2 continues uncapped to 14-12
    st = reachSixSix(createMatch());
    st = play(st, repeat(["p1", "p2"], 6)); // 6-6
    st = pointTo(st, "p1"); // 7-6
    expect(scoreboard(st).inTiebreak).toBe(true);
    expect(scoreboard(st).sets).toEqual([]);
    st = play(st, repeat(["p2", "p1"], 6)); // 13-12 (p1)
    expect(scoreboard(st).inTiebreak).toBe(true);
    expect(scoreboard(st).points).toEqual(["13", "12"]);
    st = pointTo(st, "p1"); // 14-12
    expect(scoreboard(st).sets).toEqual([[7, 6]]);
  });

  it("AC-16: numeric display during tiebreak, games stay [6,6]", () => {
    let st = reachSixSix(createMatch());
    st = play(st, repeat(["p1", "p2"], 5)); // 5-5
    st = pointTo(st, "p1"); // 6-5
    const v = scoreboard(st);
    expect(v.points).toEqual(["6", "5"]);
    expect(v.games).toEqual([6, 6]);
  });

  it("AC-17: tiebreak winner takes the set 7-6; inTiebreak clears; games reset", () => {
    let st = reachSixSix(createMatch());
    st = play(st, repeat(["p2"], 7)); // p2 wins tiebreak 7-0
    const v = scoreboard(st);
    expect(v.sets).toEqual([[6, 7]]);
    expect(v.inTiebreak).toBe(false);
    expect(v.games).toEqual([0, 0]);
    expect(v.points).toEqual(["0", "0"]);
  });
});

// ---------- AC-18: match ----------

describe("match end", () => {
  it("AC-18: best-of-3 ends at 2 sets with exactly 2 entries in sets", () => {
    let st = createMatch();
    st = winSet(st, "p2");
    st = winSet(st, "p2");
    const v = scoreboard(st);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p2");
    expect(v.sets).toEqual([[0, 6], [0, 6]]);
    expect(v.points).toEqual(["0", "0"]);
    expect(v.games).toEqual([0, 0]);
  });
});

// ---------- AC-19..23: match tiebreak ----------

describe("match tiebreak (superTiebreak)", () => {
  function reachOneAll(config) {
    let st = createMatch(config);
    st = winSet(st, "p1");
    st = winSet(st, "p2");
    return st;
  }

  it("AC-19: 1-1 in best-of-3 starts a 10-pt match tiebreak (games [0,0])", () => {
    const st = reachOneAll({ superTiebreak: true });
    const v = scoreboard(st);
    expect(v.inTiebreak).toBe(true);
    expect(v.games).toEqual([0, 0]);
    expect(v.points).toEqual(["0", "0"]);
    expect(v.over).toBe(false);
  });

  it("AC-20: with superTiebreak false the deciding set is an ordinary set", () => {
    let st = reachOneAll({});
    let v = scoreboard(st);
    expect(v.inTiebreak).toBe(false);
    st = winGames(st, "p1", 3);
    v = scoreboard(st);
    expect(v.games).toEqual([3, 0]);
    expect(v.inTiebreak).toBe(false);
  });

  it("AC-21: first to 10 with margin 2; 10-9 does not end it, 12-10 does", () => {
    let st = reachOneAll({ superTiebreak: true });
    st = play(st, repeat(["p1", "p2"], 9)); // 9-9
    st = pointTo(st, "p1"); // 10-9: not over
    expect(scoreboard(st).over).toBe(false);
    expect(scoreboard(st).points).toEqual(["10", "9"]);
    st = pointTo(st, "p2"); // 10-10
    st = play(st, ["p1", "p1"]); // 12-10
    const v = scoreboard(st);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p1");
  });

  it("AC-22: match tiebreak win records the set as [1,0] / [0,1]", () => {
    let st = reachOneAll({ superTiebreak: true });
    st = play(st, repeat(["p2"], 10)); // p2 10-0
    const v = scoreboard(st);
    expect(v.sets).toEqual([[6, 0], [0, 6], [0, 1]]);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p2");
    expect(v.points).toEqual(["0", "0"]);
    expect(v.games).toEqual([0, 0]);
  });

  it("AC-23: no match tiebreak when a player wins before the sets are level", () => {
    let st = createMatch({ superTiebreak: true });
    st = winSet(st, "p1");
    expect(scoreboard(st).inTiebreak).toBe(false); // 1-0: ordinary set 2
    st = winSet(st, "p1"); // 2-0: match over, no tiebreak ever
    const v = scoreboard(st);
    expect(v.over).toBe(true);
    expect(v.sets).toEqual([[6, 0], [6, 0]]);
  });
});

// ---------- AC-24..26: engine behavior ----------

describe("engine behavior", () => {
  it("AC-24: pointTo does not mutate its input state", () => {
    const st = play(createMatch(), ["p1", "p2", "p1"]);
    const snapshot = JSON.parse(JSON.stringify(scoreboard(st)));
    const frozen = JSON.stringify(st);
    pointTo(st, "p1");
    pointTo(st, "p2");
    expect(scoreboard(st)).toEqual(snapshot);
    expect(JSON.stringify(st)).toBe(frozen);
  });

  it("AC-25: finished match ignores further points (same state value)", () => {
    let st = createMatch();
    st = winSet(st, "p1");
    st = winSet(st, "p1");
    expect(scoreboard(st).over).toBe(true);
    const after1 = pointTo(st, "p2");
    const after2 = pointTo(after1, "p1");
    expect(after1).toBe(st);
    expect(after2).toBe(st);
    expect(scoreboard(after2)).toEqual(scoreboard(st));
  });

  it("AC-26: best-of-5 superTiebreak, 2-2 then 10-8 -> sets length 5 ending [1,0]", () => {
    let st = createMatch({ sets: 5, superTiebreak: true });
    st = winSet(st, "p1");
    st = winSet(st, "p2");
    st = winSet(st, "p1");
    expect(scoreboard(st).inTiebreak).toBe(false); // 2-1: not level-final yet
    st = winSet(st, "p2"); // 2-2 -> match tiebreak
    expect(scoreboard(st).inTiebreak).toBe(true);
    st = play(st, repeat(["p1", "p2"], 8)); // 8-8
    st = play(st, ["p1", "p1"]); // 10-8
    const v = scoreboard(st);
    expect(v.over).toBe(true);
    expect(v.winner).toBe("p1");
    expect(v.sets).toHaveLength(5);
    expect(v.sets[4]).toEqual([1, 0]);
    expect(v.inTiebreak).toBe(false);
  });

  it("state is a plain JSON-serializable object", () => {
    const st = play(createMatch({ sets: 5, noAd: true, superTiebreak: true }), ["p1", "p2"]);
    expect(JSON.parse(JSON.stringify(st))).toEqual(st);
  });
});
