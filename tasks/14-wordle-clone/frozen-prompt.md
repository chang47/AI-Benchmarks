# Frozen one-shot prompt — Task 14 Wordle Clone

Community-canonical core wording ("Create a wordle clone") taken verbatim from
the Artificial Analysis MicroEval "Wordle Clone"
(https://artificialanalysis.ai/microevals/wordle-clone-1750214619418:
"Create a wordle clone using a large open source wordle dictionary for words").
The dictionary clause is replaced by the no-dictionary rule and the artifact/
hook contract required for offline deterministic verification — deviations
documented in `research/RESEARCH.md` §1.

---

Create a wordle clone as a single, fully self-contained HTML file (all CSS and
JavaScript inline; no external resources or network requests; must work opened
from disk). Follow the NYT Wordle rules:

- The player has 6 guesses to find a secret 5-letter word, on a 6x5 tile grid.
- Do NOT use a word dictionary: accept any 5-letter A-Z guess
  (case-insensitive). A submission with fewer than 5 letters is rejected
  without consuming a guess.
- Input works from both the physical keyboard and an on-screen keyboard
  (letter keys plus Enter and Backspace).
- After each guess, color the row's tiles: green = right letter right spot,
  yellow = letter in the word but wrong spot, gray = no credit. Implement the
  exact NYT duplicate-letter rules: greens are evaluated first and each
  green/yellow consumes one occurrence of that letter in the answer; remaining
  yellows are awarded left-to-right, never exceeding the number of times the
  letter appears in the answer; excess copies are gray. Example: guess LEVEL
  vs answer HOTEL scores gray, gray, gray, green, green.
- Color the on-screen keyboard keys with each letter's best result so far
  (green over yellow over gray); keys never downgrade.
- Win: all 5 tiles green — show an in-page win message and stop accepting
  input. Lose: after 6 failed guesses — reveal the answer in an in-page
  message and stop accepting input. Never use alert() or other dialogs.

For automated testing, expose window.__wordle with exactly:
- setAnswer(word): set the secret answer (5 letters, case-insensitive) and
  reset the game to a fresh state.
- guess(word): play a guess through the same logic as typing + Enter; return
  an array of 5 strings ("green" | "yellow" | "gray") in board order, or null
  if the guess is invalid or the game is over (in which case nothing changes).
- state(): return { status: "playing" | "won" | "lost", answer: <uppercase>,
  guesses: <uppercase words>, evaluations: <array of the per-guess color
  arrays> }.

Output the complete HTML file and nothing else.
