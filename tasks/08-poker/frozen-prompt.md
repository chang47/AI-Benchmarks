# Frozen one-shot prompt — 08-poker

> This exact prompt is given verbatim to a raw model in benchmark runs. Do not reword it
> between runs — comparisons are only valid on the frozen text below. The task statement
> is the Exercism "poker" exercise description, quoted verbatim (source:
> https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/poker/description.md);
> the ranking rules follow the Wikipedia article that description cites
> (https://en.wikipedia.org/wiki/List_of_poker_hands).

---

Solve the following exercise (the Exercism "poker" exercise):

> Pick the best hand(s) from a list of poker hands.
>
> See [Wikipedia][poker-hands] for an overview of poker hands.
>
> [poker-hands]: https://en.wikipedia.org/wiki/List_of_poker_hands

**Deliver exactly one file: `src/poker.mjs`** — a pure ES module with no dependencies and
no I/O, exporting one function:

`bestHands(hands)` — takes a non-empty array of hand strings and returns an array of the
winning hand string(s).

**Input format:** each hand is five cards separated by single spaces, e.g.
`"4S 5S 7H 8D JC"`. A card is a rank followed by a suit. Ranks, low to high:
`2 3 4 5 6 7 8 9 10 J Q K A` (ten is the two-character string `10`, never `T`). Suits:
`S`, `H`, `D`, `C`. Input is always well-formed — do not validate. Hands may be dealt
from multiple decks, so the same card can appear in more than one hand.

**Output:** the best hand(s) under standard poker rankings. Return each winning string
exactly as it appeared in the input (byte-identical), preserving the input's relative
order. If several top hands are exactly equal in strength, they all win — return all of
them. A single input hand always wins alone. Do not mutate the input.

**Rankings, highest to lowest:** straight flush; four of a kind; full house; flush;
straight; three of a kind; two pair; one pair; high card. Any hand of a higher category
beats every hand of a lower category. There are no wild cards (no five of a kind).

**Aces and straights:** an ace can rank either high (as in 10 J Q K A) or low (as in
A 2 3 4 5, the five-high straight), but cannot rank both high and low at once — so
Q K A 2 3 is NOT a straight. The five-high straight is the lowest straight: its high
card counts as 5. The same rules apply to straight flushes.

**Ties within a category** are broken by card ranks only, never by suit (hands that
differ by suit alone are of equal rank):

- straight flush / straight: highest card of the run (the five-high run's high card is 5)
- four of a kind: rank of the quadruplet, then the kicker
- full house: rank of the triplet, then rank of the pair
- flush / high card: highest card, then next highest, and so on through all five cards
  (compare high to low)
- three of a kind: rank of the triplet, then the remaining two cards high to low
- two pair: higher pair, then lower pair, then the kicker
- one pair: rank of the pair, then the remaining three cards high to low

If hands remain exactly equal after all comparisons, they tie and all of them are
returned.

Write complete, working code for `src/poker.mjs`. Do not write tests.
