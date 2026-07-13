# Frozen one-shot prompt — Task 09: Forth

<!-- This is the exact prompt a raw model under test receives. The problem statement is the
     Exercism forth exercise description, quoted verbatim (community-canonical wording):
     https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/forth/description.md
     The contract section pins the API and error semantics per this task's spec.md. -->

Implement an evaluator for a very simple subset of Forth.

Forth (https://en.wikipedia.org/wiki/Forth_%28programming_language%29) is a stack-based
programming language. Implement a very basic evaluator for a small subset of Forth.

Your evaluator has to support the following words:

- `+`, `-`, `*`, `/` (integer arithmetic)
- `DUP`, `DROP`, `SWAP`, `OVER` (stack manipulation)

Your evaluator also has to support defining new words using the customary syntax:
`: word-name definition ;`.

To keep things simple the only data type you need to support is signed integers of at least
16 bits size.

You should use the following rules for the syntax: a number is a sequence of one or more
(ASCII) digits, a word is a sequence of one or more letters, digits, symbols or punctuation
that is not a number. (Forth probably uses slightly different rules, but this is close
enough.)

Words are case-insensitive.

## Deliverable

Write a single ES module at `src/forth.mjs` that exports:

```js
export function evaluate(instructionList)
```

- `instructionList` is an array of strings; each string is one line of Forth source
  (whitespace-separated tokens). Evaluate the lines in order against one shared stack and
  one shared word dictionary.
- Return the final stack as an array of numbers, **bottom of the stack first** (last element
  = top of stack). Return `[]` for an empty stack.
- Each call to `evaluate` must be completely independent: a fresh stack and a fresh
  dictionary containing only the built-in words (definitions never leak between calls).
- Negative number literals (an optional leading `-` followed by digits, e.g. `-3`) are
  numbers and are pushed onto the stack.
- For `-` and `/`, the top of the stack is the right operand (`a b -` leaves `a - b`).
  Division is integer division.
- User-defined words may redefine existing user words and may shadow built-in words and
  operators. The body of a definition is resolved against the dictionary **at definition
  time**: later redefinitions of a word must not change the behavior of words that were
  defined earlier using it, and a definition that mentions its own name refers to the
  previous definition of that name.
- On an error condition, throw a JavaScript `Error` whose `message` is exactly one of the
  following strings (lowercase, nothing else appended):
  - `"empty stack"` — a word requires values but the stack is empty
  - `"only one value on the stack"` — a word requires two values but the stack holds one
  - `"divide by zero"` — division with a zero divisor
  - `"undefined operation"` — a token that is neither a number nor a known word
  - `"illegal operation"` — attempting to define a word whose name is a number (including
    a negative number)

Do not print anything, do not read input, and do not add any other exports.
