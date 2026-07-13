# Task 09 — Forth Mini-Interpreter

> Source of truth: the Exercism `forth` exercise (problem-specifications). This spec is the
> builder's brief. It restates the public exercise description and pins the artifact contract
> and error semantics. It deliberately contains **no test cases** from the canonical data.

## Problem (Exercism description, canonical wording)

Implement an evaluator for a very simple subset of Forth.

[Forth](https://en.wikipedia.org/wiki/Forth_%28programming_language%29) is a stack-based
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
that is not a number. (Forth probably uses slightly different rules, but this is close enough.)

Words are case-insensitive.

## Artifact contract (pinned)

- File: `src/forth.mjs` (ES module).
- Export: `export function evaluate(instructionList)`.
  - `instructionList`: an **array of strings**. Each string is one line of Forth source;
    tokens within a line are separated by whitespace. Lines are evaluated in order against
    one shared stack and one shared word dictionary.
  - Returns: the final stack as an **array of numbers, bottom of stack first** (index 0 =
    bottom, last element = top of stack). An empty stack returns `[]`.
  - **Every call to `evaluate` is independent**: a fresh empty stack and a fresh dictionary
    containing only the built-in words. Definitions made in one call must never be visible
    in another call.
- On any error condition below, **throw a JavaScript `Error`** whose `message` is **exactly**
  the pinned string (lowercase, no punctuation, no extra text).

## Semantics

### Tokens and numbers

- Split each instruction line on whitespace; evaluate tokens left to right.
- A token is a **number literal** if it is an optional leading `-` followed by one or more
  ASCII digits (i.e. signed integers — negative literals like `-3` are numbers, per the
  description's "signed integers" data type). A number is pushed onto the stack.
- Any other token is a **word**. Word lookup is **case-insensitive**.
- Integers must cover at least the signed 16-bit range; ordinary JavaScript numbers are
  sufficient. No overflow behavior is specified or required.

### Arithmetic words (`+ - * /`)

Each pops the top two values and pushes one result. The top of the stack is the **right**
operand, the second-from-top the **left** operand (standard Forth order): executing `-` on a
stack `... a b` (b on top) pushes `a - b`; executing `/` pushes the **integer division**
`a / b` (division of non-negative operands discards the remainder, e.g. 8/3 → 2; for
negative operands this project pins truncation toward zero — untested by the canonical data).

### Stack words

- `DUP` — duplicate the top value.
- `DROP` — remove the top value.
- `SWAP` — exchange the top two values.
- `OVER` — push a copy of the second-from-top value.

### User-defined words (`: name body ;`)

- A definition starts at a `:` token and ends at the matching `;` token; the first token
  after `:` is the word name, the remaining tokens are the body. Definitions in the
  canonical data always fit within a single instruction line.
- Defining a word makes it available immediately, for the rest of the current `evaluate`
  call. Names are case-insensitive.
- Redefinition is allowed, including **shadowing built-in words and built-in operators**
  (after `: swap dup ;`, the word `swap` behaves as `dup`).
- **Early binding (pinned):** the body of a definition is resolved against the dictionary
  **at definition time**. A word previously defined keeps the meaning its body had when it
  was defined, even if words it used are later redefined. Equivalently: expand/snapshot the
  body's word meanings when `;` is reached, not when the defined word is executed. A
  definition whose body mentions the word being (re)defined refers to the *previous*
  definition of that name.
- **Illegal names:** attempting to define a word whose name is a number literal (including
  a negative number) is an error → `Error("illegal operation")`.

### Error conditions (pinned messages)

| Condition | Thrown message |
|---|---|
| A word needs one or more values but the stack is empty (`+ - * / DUP DROP SWAP OVER` on an empty stack) | `empty stack` |
| A word needs two values but the stack holds exactly one (`+ - * / SWAP OVER`) | `only one value on the stack` |
| Division where the divisor (top of stack) is zero | `divide by zero` |
| Executing a word that is neither a number, a built-in, nor defined | `undefined operation` |
| Defining a word whose name is a number | `illegal operation` |

Throw a plain `Error` (or subclass) with the exact `message` above. Do not decorate the
message.

## Out of scope

Nothing beyond the above is required: no floating point, no comments, no strings, no I/O
words, no control flow (`IF`/`LOOP`), no return stack, no nested definitions.
