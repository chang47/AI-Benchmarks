import { describe, it, expect } from "vitest";
import { bestHands } from "../poker.mjs";

// Helper: order-insensitive winner-set comparison where input order does not matter.
function sortedSet(arr) {
  return [...arr].sort();
}

describe("single hand", () => {
  it("returns the only hand", () => {
    expect(bestHands(["4S 5S 7H 8D JC"])).toEqual(["4S 5S 7H 8D JC"]);
  });

  it("returns a single hand verbatim regardless of contents", () => {
    expect(bestHands(["10D JH QS KD AC"])).toEqual(["10D JH QS KD AC"]);
  });
});

describe("category order (each beats all below)", () => {
  const straightFlush = "6S 7S 8S 9S 10S";
  const fourKind = "6S 6H 6D 6C KS";
  const fullHouse = "6S 6H 6D KS KH";
  const flush = "2S 5S 7S 9S JS";
  const straight = "2S 3H 4D 5C 6S";
  const trips = "6S 6H 6D 2C 3S";
  const twoPair = "6S 6H 4D 4C 3S";
  const onePair = "6S 6H 4D 2C 3S";
  const highCard = "6S 8H 4D 2C 3S";

  it("one pair beats high card", () => {
    expect(bestHands([onePair, highCard])).toEqual([onePair]);
  });
  it("two pair beats one pair", () => {
    expect(bestHands([twoPair, onePair])).toEqual([twoPair]);
  });
  it("three of a kind beats two pair", () => {
    expect(bestHands([trips, twoPair])).toEqual([trips]);
  });
  it("straight beats three of a kind", () => {
    expect(bestHands([straight, trips])).toEqual([straight]);
  });
  it("flush beats straight", () => {
    expect(bestHands([flush, straight])).toEqual([flush]);
  });
  it("full house beats flush", () => {
    expect(bestHands([fullHouse, flush])).toEqual([fullHouse]);
  });
  it("four of a kind beats full house", () => {
    expect(bestHands([fourKind, fullHouse])).toEqual([fourKind]);
  });
  it("straight flush beats four of a kind", () => {
    expect(bestHands([straightFlush, fourKind])).toEqual([straightFlush]);
  });

  it("straight flush beats everything below in one list", () => {
    const all = [
      highCard,
      onePair,
      twoPair,
      trips,
      straight,
      flush,
      fullHouse,
      fourKind,
      straightFlush,
    ];
    expect(bestHands(all)).toEqual([straightFlush]);
  });
});

describe("high-card tiebreak descending", () => {
  it("compares all five cards high to low", () => {
    const winner = "3S 5H 6S 8D 7H"; // 8 7 6 5 3
    const loser = "2S 5D 6D 8C 7S"; // 8 7 6 5 2
    expect(bestHands([loser, winner])).toEqual([winner]);
  });

  it("a hand can win the tiebreak while holding the single lowest card in the pool", () => {
    // winner has the pool's lowest card (2) but higher on every earlier compare
    const winner = "4S 5S 7H 8D KC"; // K 8 7 5 4
    const loser = "2S 3H 6D 9C JC"; // J 9 6 3 2  -> loser is lower at top card
    // Reverse so the low-card holder is genuinely stronger:
    const strong = "2H 4S 5S 7H AD"; // A 7 5 4 2 (holds the 2)
    const weak = "3S 4D 6H 9C KD"; // K 9 6 4 3
    expect(bestHands([weak, strong])).toEqual([strong]);
    // sanity for the first pair too
    expect(bestHands([loser, winner])).toEqual([winner]);
  });
});

describe("group tiebreaks", () => {
  it("four of a kind: quad rank first, then kicker", () => {
    const high = "8S 8H 8D 8C 2S"; // quad 8, kicker 2
    const low = "5S 5H 5D 5C AS"; // quad 5, kicker A
    expect(bestHands([low, high])).toEqual([high]);
  });

  it("four of a kind: equal quad decided by kicker", () => {
    const a = "3S 3H 3D 3C 6S"; // multi-deck: same quad
    const b = "3S 3H 3D 3C 9S";
    expect(bestHands([a, b])).toEqual([b]);
  });

  it("full house: triplet decides before pair", () => {
    const a = "4S 5H 4D 5D 4H"; // trip 4, pair 5
    const b = "3S 3H 2S 3D 2H"; // trip 3, pair 2
    expect(bestHands([a, b])).toEqual([a]);
  });

  it("full house: equal triplet decided by pair", () => {
    const a = "5S 5H 5D 8S 8D"; // trip 5, pair 8
    const b = "5S 5H 5D 6S 6D"; // trip 5, pair 6
    expect(bestHands([b, a])).toEqual([a]);
  });

  it("three of a kind: triplet first then kickers", () => {
    const a = "2S 2H 2D 8C KS"; // trips 2
    const b = "4S 4H 4D 5C 3S"; // trips 4
    expect(bestHands([a, b])).toEqual([b]);
  });

  it("two pair: higher pair, then lower pair, then kicker", () => {
    const a = "2S 8H 2D 8D 3H"; // pairs 8 & 2, kicker 3
    const b = "4S 5H 4C 8C 5C"; // pairs 5 & 4, kicker 8
    expect(bestHands([b, a])).toEqual([a]); // 8-high pair wins
  });

  it("two pair: equal high pair decided by low pair", () => {
    const a = "9S 9H 7S 7H 2C"; // 9s and 7s
    const b = "9S 9H 5S 5H KC"; // 9s and 5s
    expect(bestHands([b, a])).toEqual([a]);
  });

  it("two pair: equal both pairs decided by kicker", () => {
    const a = "9S 9H 5S 5H KC"; // kicker K
    const b = "9S 9H 5S 5H 2C"; // kicker 2
    expect(bestHands([b, a])).toEqual([a]);
  });

  it("one pair: pair rank then remaining three high to low", () => {
    const a = "6S 6H 3S 2D KC"; // pair 6, kicker K
    const b = "6S 6H 3S 2D QC"; // pair 6, kicker Q
    expect(bestHands([b, a])).toEqual([a]);
  });
});

describe("aces and straights", () => {
  it("10 J Q K A is a valid ace-high straight", () => {
    const aceHigh = "10D JH QS KD AC";
    const lower = "6S 7H 8D 9C 10S"; // 10-high straight
    expect(bestHands([lower, aceHigh])).toEqual([aceHigh]);
  });

  it("A 2 3 4 5 is a valid straight with high card 5 (the wheel)", () => {
    const wheel = "4D AH 3S 2D 5C";
    const sixHigh = "2S 3H 4D 5C 6S"; // 6-high straight
    expect(bestHands([wheel, sixHigh])).toEqual([sixHigh]);
  });

  it("wheel beats a mere pair (it is still a straight)", () => {
    const wheel = "4D AH 3S 2D 5C";
    const pair = "AS AH 4D 2C 3S";
    expect(bestHands([pair, wheel])).toEqual([wheel]);
  });

  it("Q K A 2 3 is NOT a straight (ace cannot be both high and low)", () => {
    const notStraight = "QS KH AD 2C 3S"; // best is A-high, high card
    const realStraight = "2S 3H 4D 5C 6S";
    expect(bestHands([notStraight, realStraight])).toEqual([realStraight]);
  });

  it("Q K A 2 3 suited is a flush, not a straight flush", () => {
    const suited = "QS KS AS 2S 3S"; // flush only
    const straightFlush = "6S 7S 8S 9S 10S";
    expect(bestHands([suited, straightFlush])).toEqual([straightFlush]);
    // and the suited AKQ32 is a flush, beating a plain straight
    const plainStraight = "2H 3H 4D 5C 6S";
    expect(bestHands([plainStraight, suited])).toEqual([suited]);
  });

  it("five-high straight loses to six-high straight", () => {
    const five = "AH 2S 3D 4C 5H";
    const six = "2H 3S 4D 5C 6H";
    expect(bestHands([five, six])).toEqual([six]);
  });

  it("five-high straight flush loses to six-high straight flush", () => {
    const five = "AH 2H 3H 4H 5H";
    const six = "2D 3D 4D 5D 6D";
    expect(bestHands([five, six])).toEqual([six]);
  });

  it("wheel straight flush still beats four of a kind", () => {
    const wheelSF = "AH 2H 3H 4H 5H";
    const quads = "KS KH KD KC 2S";
    expect(bestHands([quads, wheelSF])).toEqual([wheelSF]);
  });
});

describe("ties (multiple winners, input order preserved)", () => {
  it("two identical straights in different suits both win", () => {
    const a = "4S 5H 6D 7C 8S"; // 8-high straight
    const b = "4D 5C 6H 7S 8H"; // same straight, different suits
    const result = bestHands([a, b]);
    expect(sortedSet(result)).toEqual(sortedSet([a, b]));
    expect(result).toEqual([a, b]); // input order preserved
  });

  it("two equal flushes tie", () => {
    const a = "2S 4S 6S 8S 10S";
    const b = "2H 4H 6H 8H 10H";
    expect(bestHands([a, b])).toEqual([a, b]);
  });

  it("preserves input order among winners with a loser interleaved", () => {
    const w1 = "2S 4S 6S 8S 10S";
    const loser = "2H 3H 4H 5H 7H"; // lower flush
    const w2 = "2D 4D 6D 8D 10D";
    expect(bestHands([w1, loser, w2])).toEqual([w1, w2]);
  });

  it("fully identical hands all win (multi-deck)", () => {
    const h = "3S 4S 5S 6S 7S";
    expect(bestHands([h, h, h])).toEqual([h, h, h]);
  });
});

describe("purity and format guarantees", () => {
  it("does not mutate the input array", () => {
    const input = ["4S 5S 7H 8D JC", "2S 3H 4D 5C 6S"];
    const copy = [...input];
    bestHands(input);
    expect(input).toEqual(copy);
  });

  it("returns byte-identical strings", () => {
    const input = ["10D JH QS KD AC", "3S 4S 5S 6S 7S"];
    const out = bestHands(input);
    expect(out[0]).toBe("3S 4S 5S 6S 7S"); // straight flush wins, exact string
  });

  it("handles 10 as a two-character rank everywhere", () => {
    const tenHighStraight = "6S 7H 8D 9C 10S";
    const nineHighStraight = "5S 6H 7D 8C 9S";
    expect(bestHands([nineHighStraight, tenHighStraight])).toEqual([
      tenHighStraight,
    ]);
  });
});
