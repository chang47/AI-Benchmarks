# Spec — Poker Hand Ranking (task 08-poker)

## Purpose

Implement the Exercism "poker" exercise, exactly as the community defines it:

> Pick the best hand(s) from a list of poker hands.
>
> See [Wikipedia][poker-hands] for an overview of poker hands.
>
> [poker-hands]: https://en.wikipedia.org/wiki/List_of_poker_hands

Given a list of 5-card poker hands, return the best hand(s) according to standard
poker hand rankings. When several hands are exactly equal in strength, all of them
win (ties are possible). The ranking rules below are the standard rules from the
Wikipedia article the exercise itself cites; they are normative for this task.

## Artifact contract (exact)

Deliver exactly one file:

### `src/poker.mjs` — pure ES module, no dependencies, no I/O, exporting:

`bestHands(hands) -> array of winning hand strings`

- `hands` is a non-empty array of strings. Each string is one 5-card hand: five
  cards separated by single spaces, e.g. `"4S 5S 7H 8D JC"`.
- Each card is a rank immediately followed by a suit:
  - Ranks (low to high): `2 3 4 5 6 7 8 9 10 J Q K A`. Ten is the two-character
    string `10` (never `T`).
  - Suits: `S` (spades), `H` (hearts), `D` (diamonds), `C` (clubs).
- Return value: an array containing the winning hand string(s), each **exactly as
  it appeared in the input** (verbatim — same card order, same characters), in the
  **same relative order as the input list**. The array always has at least one
  element; it has more than one only when the top hands tie exactly.
- A single hand always wins outright (return it alone).
- Do not mutate the input array.
- No input validation is required: every hand is well-formed per the format above.
  Hands may be dealt from **multiple decks**, so the same card can appear in more
  than one hand (and hands can be entirely identical in rank structure).

No other files are required. Do not write tests (they are provided separately by
the benchmark).

## Hand rankings (normative, highest to lowest)

1. **Straight flush** — five cards of sequential rank, all of the same suit.
   (A royal flush — 10 J Q K A suited — is simply the highest straight flush,
   not a separate category.)
2. **Four of a kind** — four cards of one rank, plus one other card (the kicker).
3. **Full house** — three cards of one rank plus a pair of another rank.
4. **Flush** — five cards of the same suit, not all of sequential rank.
5. **Straight** — five cards of sequential rank, not all of the same suit.
6. **Three of a kind** — three cards of one rank, plus two other non-paired cards.
7. **Two pair** — two cards of one rank, two cards of another rank, plus a kicker.
8. **One pair** — two cards of one rank, plus three other non-paired cards.
9. **High card** — none of the above.

Any hand in a higher category beats every hand in a lower category. (Five of a
kind is out of scope: there are no wild cards in this exercise.)

## Aces and straights (normative)

- An ace ranks **high** by default (above the king).
- An ace may instead rank **low** to form the five-high straight
  `A 2 3 4 5` (the "wheel"). In that hand the ace counts as 1: the wheel is the
  **lowest**-ranked straight (its high card is the 5), even though an ace is
  usually high. The same applies to a five-high straight flush.
- An ace cannot rank high and low at once: `Q K A 2 3` is **not** a straight
  (and the suited version is not a straight flush — it is just a flush).

## Tie-breaking within a category (normative)

Compare hands of the same category by card ranks only, in this order:

- **Straight flush / straight:** by the highest card of the run (the wheel's
  high card is 5).
- **Four of a kind:** by the rank of the quadruplet, then by the kicker.
- **Full house:** by the rank of the triplet, then by the rank of the pair.
- **Flush / high card:** by the highest card, then the second highest, and so on
  down through all five cards (compare high to low).
- **Three of a kind:** by the rank of the triplet, then the remaining two cards
  compared high to low.
- **Two pair:** by the higher pair, then the lower pair, then the kicker.
- **One pair:** by the rank of the pair, then the remaining three cards compared
  high to low.

**Suits never break ties.** Hands that differ by suit alone are of equal rank.
If, after all applicable comparisons, two or more top hands are exactly equal,
they ALL win — return each of them (verbatim, input order).

## Acceptance criteria

1. `bestHands(["4S 5S 7H 8D JC"])` (any single hand) returns that one hand.
2. Category order is enforced pairwise: a hand of each category in the list above
   beats any hand of every category below it (e.g. one pair beats high card, a
   flush beats a straight, a straight flush beats four of a kind).
3. High-card ties compare all five cards high to low; the comparison must proceed
   in descending order (a hand can win the tiebreak while also holding the single
   lowest card in the pool).
4. Pair/triplet/quad tiebreaks use the group rank first, then kickers as listed
   above — e.g. two pair compares higher pair, then lower pair, then kicker;
   four of a kind compares the quad, then the kicker.
5. Full-house ties go to the triplet, then the pair.
6. `10 J Q K A` is a valid (ace-high) straight; `A 2 3 4 5` is a valid straight
   whose high card is 5; `Q K A 2 3` is not a straight. Ditto for straight
   flushes.
7. A five-high straight (or straight flush) loses to any six-high or better
   straight (or straight flush).
8. Exact ties return multiple winners, preserving input order — e.g. two
   identical straights in different suits both win.
9. Returned strings are byte-identical to the corresponding input strings.
10. With multiple decks in play, hands sharing the same quad/triplet/pairs are
    resolved by the remaining cards, and fully equal hands tie.
