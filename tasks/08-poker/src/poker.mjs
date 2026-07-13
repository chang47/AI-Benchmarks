// Poker hand ranking — Exercism "poker" exercise.
//
// bestHands(hands) -> array of the winning hand string(s), verbatim, in input order.
//
// Pure ES module: no dependencies, no I/O, no mutation of the input.

const RANK_VALUES = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

// Hand categories (higher number = stronger hand).
const STRAIGHT_FLUSH = 8;
const FOUR_OF_A_KIND = 7;
const FULL_HOUSE = 6;
const FLUSH = 5;
const STRAIGHT = 4;
const THREE_OF_A_KIND = 3;
const TWO_PAIR = 2;
const ONE_PAIR = 1;
const HIGH_CARD = 0;

function parseCard(card) {
  // A card is a rank immediately followed by a one-char suit. Ten is "10".
  const suit = card.slice(-1);
  const rankStr = card.slice(0, -1);
  const rank = RANK_VALUES[rankStr];
  return { rank, suit };
}

// Produce a comparable score array for a hand: [category, ...tiebreakers].
// Lexicographic comparison of two score arrays yields the correct ordering.
function evaluate(hand) {
  const cards = hand.split(" ").map(parseCard);
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a); // descending
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Count occurrences of each rank.
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);

  // Groups sorted by count (desc), then rank (desc). This ordering makes
  // `groups.map(rank)` the exact tie-break sequence for every count-based
  // category (quad, full house, trips, two pair, one pair) AND for
  // high-card / flush (all singletons -> ranks descending).
  const groups = [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const countsPattern = groups.map((g) => g.count);
  const groupRanks = groups.map((g) => g.rank);

  // Straight detection (needs five distinct ranks spanning a run of five).
  const uniqueRanks = groupRanks.length === 5 ? [...ranks] : null;
  let isStraight = false;
  let straightHigh = null;
  if (uniqueRanks) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[0];
    } else if (
      // Wheel: A-2-3-4-5. Ace counts low; the straight's high card is 5.
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isStraight && isFlush) return [STRAIGHT_FLUSH, straightHigh];
  if (countsPattern[0] === 4) return [FOUR_OF_A_KIND, ...groupRanks];
  if (countsPattern[0] === 3 && countsPattern[1] === 2)
    return [FULL_HOUSE, ...groupRanks];
  if (isFlush) return [FLUSH, ...groupRanks];
  if (isStraight) return [STRAIGHT, straightHigh];
  if (countsPattern[0] === 3) return [THREE_OF_A_KIND, ...groupRanks];
  if (countsPattern[0] === 2 && countsPattern[1] === 2)
    return [TWO_PAIR, ...groupRanks];
  if (countsPattern[0] === 2) return [ONE_PAIR, ...groupRanks];
  return [HIGH_CARD, ...groupRanks];
}

// Lexicographic comparison. Same-category hands always share tie-break length,
// and different categories differ at index 0, so this is total and correct.
function compareScores(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? -Infinity;
    const bv = b[i] ?? -Infinity;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function bestHands(hands) {
  const scored = hands.map((hand) => ({ hand, score: evaluate(hand) }));

  let best = scored[0].score;
  for (const s of scored) {
    if (compareScores(s.score, best) > 0) best = s.score;
  }

  return scored
    .filter((s) => compareScores(s.score, best) === 0)
    .map((s) => s.hand);
}

export default bestHands;
