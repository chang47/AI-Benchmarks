# Research — Task 14 Wordle Clone

Stage-1 research log. Every adopted rule/number below carries its citation.
Fetched 2026-07-12 via WebFetch/WebSearch.

## 1. Prompt canonicity (MicroEvals)

- Source: https://artificialanalysis.ai/microevals — lists the "Wordle Clone"
  MicroEval; detail page:
  https://artificialanalysis.ai/microevals/wordle-clone-1750214619418
- Verbatim canonical prompt (fetched from the detail page):
  > "Create a wordle clone using a large open source wordle dictionary for words"
  with the guidance "Use this as word source
  https://github.com/tabatkins/wordle-list/blob/main/words" and the note
  "A system prompt was added to support web rendering".
- **Deviation (documented):** the benchmark artifact must be ONE self-contained
  offline HTML file with deterministic verification, so the external-dictionary
  clause is dropped and replaced by "accept any 5-letter A–Z guess". The
  MicroEval's first clause ("Create a Wordle clone") is kept verbatim in
  `frozen-prompt.md`; the rule content is re-anchored to the NYT behavior
  authorities below.

## 2. Core game rules (correctness authority = published NYT Wordle behavior)

Note: nytimes.com/help.nytimes.com block the Anthropic crawler (WebSearch
returned a 400 "domains not accessible" for nytimes.com), so the NYT behavior is
sourced through Wikipedia and widely-cited explainers rather than the NYT help
page directly.

| Rule adopted | Source |
|---|---|
| "players have six attempts to guess a five-letter word" | Wikipedia, https://en.wikipedia.org/wiki/Wordle |
| "Green indicates a correct letter in the correct spot. Yellow signifies that the letter is in the word but in the wrong spot. Gray means the word doesn't contain that letter in any spot." | Wikipedia (same) |
| Input via physical keyboard or on-screen (virtual) keyboard; keyboard letters color-code as you guess | wordle-nyt.org how-to text via WebSearch; corroborated by nerdschalk color explainer https://nerdschalk.com/wordle-colors-what-does-yellow-and-green-mean/ |
| Lose state reveals the answer after 6 failed guesses; win = all five green | Universal in every explainer above; Wikipedia gameplay description |

## 3. Duplicate-letter tile logic (the model-killer edge case)

Adopted algorithm — greens first, then yellows strictly left-to-right, each
credit consuming one occurrence of that letter in the answer; excess copies
gray:

- Wikipedia: "If a guessed word contains multiple instances of the same
  letter—such as the 'o's in 'robot'—those letters will be marked green or
  yellow only if the answer also contains them multiple times. If not, extra
  occurrences will be marked gray." (https://en.wikipedia.org/wiki/Wordle)
- StuckOnAWord repeated-letters guide
  (https://www.stuckonaword.com/articles/wordle-repeated-letters-guide.html):
  "Wordle evaluates letters against the answer in a limited-count way. If the
  answer has one E and your guess has two, only one of your E tiles can be
  colored yellow or green." Tile meanings: "Green: right letter, right spot,
  and it consumes one occurrence of that letter. Yellow: right letter, wrong
  spot, and it also consumes one occurrence. Gray: either not in the word, or
  you guessed that letter more times than the answer allows."
- WordleSolverX double-letters explainer
  (https://wordlesolverx.org/past-wordle-words/does-wordle-repeat-letters/):
  "Wordle evaluates exact positions (Greens) first, and then doles out Yellows
  strictly left-to-right, never exceeding the total number of times that letter
  appears in the answer." Worked example: guess LEVEL vs answer HOTEL — "the
  last E and L turn green, but the earlier E and L turn gray since the answer
  only contains one of each." (= spec example row 1)
- WordFinder/YourDictionary
  (https://wordfinder.yourdictionary.com/blog/can-letters-repeat-in-wordle-a-closer-look-at-the-rules/):
  "if you guess 'lever' and the answer is 'eaten,' the first E in 'lever' will
  turn yellow, and the second one will turn green." (= spec example row 2)
- Nerdschalk same-letter-twice explainer
  (https://nerdschalk.com/wordle-same-letter-twice-rules-explained-how-does-it-work/):
  "If you repeat a letter more than it appears, then the excess will be
  highlighted in grey"; correct placements prioritized (green before yellow).

Spec examples 3–6 (ERASE/SPEED, CREPE/SPEED, THOSE/GEESE, ROBOT/FLOOR) were
hand-derived by the spec author with the exact two-pass algorithm quoted above;
they introduce no new rules — only additional coverage (both-yellow duplicates,
green+yellow same letter, excess-gray after green, 2-vs-2 duplicates). ROBOT is
Wikipedia's own duplicate-letter example word.

**Disagreements found:** none on substance. All sources agree on
greens-first + count-limited credit + left-to-right yellows. Explainer prose
varies in precision; the WordleSolverX phrasing is the most algorithmic and was
adopted as the normative wording (spec C1).

## 4. On-screen keyboard state coloring

- Explainers document that keyboard keys mirror the grid colors and that green
  is terminal/"highest" state: nerdschalk colors explainer, WordlyPlay
  (https://wordlyplay.com/blog/wordle-colors-meaning-green-yellow-gray-explained),
  ScreenRant (https://screenrant.com/wordle-boxes-colors-guess-words-meaning-hints/).
- No fetched explainer states the full precedence machine explicitly.
  **Convention picked (documented as such in spec D1–D4):** each key shows the
  best state achieved across all guesses, precedence green > yellow > gray,
  never downgrading. This matches the behavior of the original game and of the
  community-canonical open-source reference implementation Reactle
  (https://github.com/cwackerfuss/react-wordle), whose key-status logic awards
  'correct' over 'present' over 'absent'.
- Edge case adopted into spec (D4): a letter whose only gray was an excess
  duplicate (another copy green/yellow in the same row) must show its best
  state on the key — direct consequence of best-state precedence.

## 5. Input/validation behavior

- NYT rejects guesses that are too short ("Not enough letters") without
  consuming a turn — reflected in spec A4 as "does not consume a guess"; the
  exact toast/shake presentation is NOT required (presentation varies across
  sources and is irrelevant to correctness).
- **Convention picked (deviation from NYT, per task scope):** no dictionary —
  any 5-letter A–Z string is a legal guess. Stated explicitly in the spec so
  builders don't add a word list and verifiers can use arbitrary strings
  (e.g. GEESE vs THOSE).

## 6. Test-hook conventions (benchmark-only, not Wordle rules)

`window.__wordle = { setAnswer, guess, state }` — the hook shape, the
reset-on-setAnswer semantics, `guess()` returning
`["green"|"yellow"|"gray"] x 5` or `null`, and the `state()` shape are benchmark
conventions authored for deterministic verification (dictated by the task
brief), not sourced from Wordle. They are labeled as conventions in the spec.

## 7. Contamination assessment

HIGH. Wordle clones are among the most common web-app examples in training
data, and the MicroEval exists precisely because it is a popular one-shot test.
Discrimination therefore rests on the duplicate-letter examples (spec C4), the
keyboard best-state rules (D), and exact hook-contract compliance — the parts
models most often get wrong despite having seen thousands of clones.
