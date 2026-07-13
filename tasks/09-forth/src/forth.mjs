// Forth mini-interpreter.
//
// evaluate(instructionList): array of source lines -> final stack (bottom first).
// Each call is fully independent: fresh stack + fresh dictionary of built-ins.
//
// Semantics are pinned by spec.md:
//  - number literal = optional leading '-' followed by one or more ASCII digits
//  - words are case-insensitive
//  - arithmetic: top of stack is the RIGHT operand ( `... a b` , `-` -> a - b )
//  - division is integer division truncated toward zero
//  - user definitions use EARLY BINDING: a body is resolved against the
//    dictionary at definition time (snapshot), not at execution time.

const NUMBER_RE = /^-?\d+$/;

function isNumber(token) {
  return NUMBER_RE.test(token);
}

function parseNumber(token) {
  return parseInt(token, 10);
}

// --- stack helpers (with pinned error messages) -------------------------

function popOne(stack) {
  if (stack.length === 0) {
    throw new Error("empty stack");
  }
  return stack.pop();
}

// Pops the top two values; returns [left, right] where `right` was the top.
function popTwo(stack) {
  if (stack.length === 0) {
    throw new Error("empty stack");
  }
  if (stack.length === 1) {
    throw new Error("only one value on the stack");
  }
  const right = stack.pop();
  const left = stack.pop();
  return [left, right];
}

// --- primitive built-in operations --------------------------------------

function execPrim(prim, stack) {
  switch (prim) {
    case "add": {
      const [a, b] = popTwo(stack);
      stack.push(a + b);
      break;
    }
    case "sub": {
      const [a, b] = popTwo(stack);
      stack.push(a - b);
      break;
    }
    case "mul": {
      const [a, b] = popTwo(stack);
      stack.push(a * b);
      break;
    }
    case "div": {
      const [a, b] = popTwo(stack);
      if (b === 0) {
        throw new Error("divide by zero");
      }
      stack.push(Math.trunc(a / b));
      break;
    }
    case "dup": {
      const a = popOne(stack);
      stack.push(a);
      stack.push(a);
      break;
    }
    case "drop": {
      popOne(stack);
      break;
    }
    case "swap": {
      const [a, b] = popTwo(stack);
      stack.push(b);
      stack.push(a);
      break;
    }
    case "over": {
      const [a, b] = popTwo(stack);
      stack.push(a);
      stack.push(b);
      stack.push(a);
      break;
    }
    /* c8 ignore next 2 */
    default:
      throw new Error("undefined operation");
  }
}

// Each dictionary entry is a flat array of ops. An op is either
//   { push: <number> }   or   { prim: <primitive name> }.
function buildBuiltins() {
  const dict = new Map();
  dict.set("+", [{ prim: "add" }]);
  dict.set("-", [{ prim: "sub" }]);
  dict.set("*", [{ prim: "mul" }]);
  dict.set("/", [{ prim: "div" }]);
  dict.set("dup", [{ prim: "dup" }]);
  dict.set("drop", [{ prim: "drop" }]);
  dict.set("swap", [{ prim: "swap" }]);
  dict.set("over", [{ prim: "over" }]);
  return dict;
}

function runOps(ops, stack) {
  for (const op of ops) {
    if (op.push !== undefined) {
      stack.push(op.push);
    } else {
      execPrim(op.prim, stack);
    }
  }
}

// Early binding: compile a definition body into a flat op list by expanding
// every word against the CURRENT dictionary. Later redefinitions of those
// words do not change this snapshot.
function compileBody(bodyTokens, dict) {
  const ops = [];
  for (const token of bodyTokens) {
    if (isNumber(token)) {
      ops.push({ push: parseNumber(token) });
    } else {
      const key = token.toLowerCase();
      const existing = dict.get(key);
      if (existing === undefined) {
        throw new Error("undefined operation");
      }
      // Splice a COPY of the current ops (share immutable op objects, but do
      // not alias the array so future redefinition can't mutate this body).
      for (const op of existing) {
        ops.push(op);
      }
    }
  }
  return ops;
}

function processTokens(tokens, stack, dict) {
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === ":") {
      // Definition: ": name body ;"
      i += 1;
      const nameToken = tokens[i];
      if (nameToken === undefined || nameToken === ";") {
        // Malformed definition (out of scope for canonical data); treat the
        // missing/numeric name uniformly as an illegal operation is wrong,
        // so simply skip an empty definition.
        i += 1;
        continue;
      }
      if (isNumber(nameToken)) {
        throw new Error("illegal operation");
      }
      const name = nameToken.toLowerCase();
      i += 1;

      const body = [];
      while (i < tokens.length && tokens[i] !== ";") {
        body.push(tokens[i]);
        i += 1;
      }
      // i points at ";" (or end). Skip the ";".
      i += 1;

      const ops = compileBody(body, dict);
      dict.set(name, ops);
      continue;
    }

    if (isNumber(token)) {
      stack.push(parseNumber(token));
      i += 1;
      continue;
    }

    const key = token.toLowerCase();
    const ops = dict.get(key);
    if (ops === undefined) {
      throw new Error("undefined operation");
    }
    runOps(ops, stack);
    i += 1;
  }
}

export function evaluate(instructionList) {
  const stack = [];
  const dict = buildBuiltins();

  for (const line of instructionList) {
    const tokens = line.split(/\s+/).filter((t) => t.length > 0);
    processTokens(tokens, stack, dict);
  }

  return stack;
}
