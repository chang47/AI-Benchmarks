import { describe, it, expect } from "vitest";
import { evaluate } from "../forth.mjs";

describe("parsing and numbers", () => {
  it("pushes numbers onto the stack (bottom first)", () => {
    expect(evaluate(["1 2 3 4 5"])).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns an empty stack for empty input", () => {
    expect(evaluate([])).toEqual([]);
    expect(evaluate([""])).toEqual([]);
    expect(evaluate(["   "])).toEqual([]);
  });

  it("pushes negative number literals", () => {
    expect(evaluate(["-1 -2 3"])).toEqual([-1, -2, 3]);
  });
});

describe("addition", () => {
  it("adds two numbers", () => {
    expect(evaluate(["1 2 +"])).toEqual([3]);
  });
  it("errors on empty stack", () => {
    expect(() => evaluate(["+"])).toThrow("empty stack");
  });
  it("errors with only one value", () => {
    expect(() => evaluate(["1 +"])).toThrow("only one value on the stack");
  });
});

describe("subtraction", () => {
  it("subtracts top from second (a b -> a - b)", () => {
    expect(evaluate(["3 4 -"])).toEqual([-1]);
  });
  it("errors on empty stack", () => {
    expect(() => evaluate(["-"])).toThrow("empty stack");
  });
  it("errors with only one value", () => {
    expect(() => evaluate(["1 -"])).toThrow("only one value on the stack");
  });
});

describe("multiplication", () => {
  it("multiplies two numbers", () => {
    expect(evaluate(["2 4 *"])).toEqual([8]);
  });
  it("errors on empty stack", () => {
    expect(() => evaluate(["*"])).toThrow("empty stack");
  });
  it("errors with only one value", () => {
    expect(() => evaluate(["1 *"])).toThrow("only one value on the stack");
  });
});

describe("division", () => {
  it("divides two numbers", () => {
    expect(evaluate(["12 3 /"])).toEqual([4]);
  });
  it("performs integer division (discards remainder)", () => {
    expect(evaluate(["8 3 /"])).toEqual([2]);
  });
  it("errors on divide by zero", () => {
    expect(() => evaluate(["4 0 /"])).toThrow("divide by zero");
  });
  it("errors on empty stack", () => {
    expect(() => evaluate(["/"])).toThrow("empty stack");
  });
  it("errors with only one value", () => {
    expect(() => evaluate(["1 /"])).toThrow("only one value on the stack");
  });
});

describe("combined arithmetic", () => {
  it("adds then subtracts", () => {
    expect(evaluate(["1 2 + 4 -"])).toEqual([-1]);
  });
  it("multiplies then divides", () => {
    expect(evaluate(["2 4 * 3 /"])).toEqual([2]);
  });
});

describe("dup", () => {
  it("duplicates the top value", () => {
    expect(evaluate(["1 dup"])).toEqual([1, 1]);
    expect(evaluate(["1 2 dup"])).toEqual([1, 2, 2]);
  });
  it("errors on empty stack", () => {
    expect(() => evaluate(["dup"])).toThrow("empty stack");
  });
});

describe("drop", () => {
  it("removes the top value", () => {
    expect(evaluate(["1 drop"])).toEqual([]);
    expect(evaluate(["1 2 drop"])).toEqual([1]);
  });
  it("errors on empty stack", () => {
    expect(() => evaluate(["drop"])).toThrow("empty stack");
  });
});

describe("swap", () => {
  it("exchanges the top two values", () => {
    expect(evaluate(["1 2 swap"])).toEqual([2, 1]);
    expect(evaluate(["1 2 3 swap"])).toEqual([1, 3, 2]);
  });
  it("errors on empty stack", () => {
    expect(() => evaluate(["swap"])).toThrow("empty stack");
  });
  it("errors with only one value", () => {
    expect(() => evaluate(["1 swap"])).toThrow("only one value on the stack");
  });
});

describe("over", () => {
  it("copies the second-from-top value", () => {
    expect(evaluate(["1 2 over"])).toEqual([1, 2, 1]);
    expect(evaluate(["1 2 3 over"])).toEqual([1, 2, 3, 2]);
  });
  it("errors on empty stack", () => {
    expect(() => evaluate(["over"])).toThrow("empty stack");
  });
  it("errors with only one value", () => {
    expect(() => evaluate(["1 over"])).toThrow("only one value on the stack");
  });
});

describe("user-defined words", () => {
  it("can consist of built-in words", () => {
    expect(evaluate([": dup-twice dup dup ;", "1 dup-twice"])).toEqual([1, 1, 1]);
  });

  it("execute in the right order", () => {
    expect(evaluate([": countup 1 2 3 ;", "countup"])).toEqual([1, 2, 3]);
  });

  it("can override other user-defined words", () => {
    expect(
      evaluate([": foo dup ;", ": foo dup dup ;", "1 foo"]),
    ).toEqual([1, 1, 1]);
  });

  it("can override a built-in word", () => {
    expect(evaluate([": swap dup ;", "1 swap"])).toEqual([1, 1]);
  });

  it("can override a built-in operator", () => {
    expect(evaluate([": + * ;", "3 4 +"])).toEqual([12]);
  });

  it("is case-insensitive for definition and use", () => {
    expect(evaluate([": DUP-TWICE DUP DUP ;", "1 dup-twice"])).toEqual([1, 1, 1]);
    expect(evaluate(["1 DUP Dup dup"])).toEqual([1, 1, 1, 1]);
  });

  it("evaluates definitions across multiple lines with shared state", () => {
    expect(evaluate([": one 1 ;", "one one +"])).toEqual([2]);
  });
});

describe("early binding", () => {
  it("uses different words with the same name (snapshot at define time)", () => {
    expect(
      evaluate([": foo 5 ;", ": bar foo ;", ": foo 6 ;", "bar foo"]),
    ).toEqual([5, 6]);
  });

  it("can define a word that uses the word with the same name", () => {
    expect(evaluate([": foo 10 ;", ": foo foo 1 + ;", "foo"])).toEqual([11]);
  });

  it("keeps a definition's built-in meaning after that built-in is overridden", () => {
    expect(
      evaluate([": add-two + ;", ": + * ;", "3 4 add-two"]),
    ).toEqual([7]);
  });
});

describe("error conditions", () => {
  it("cannot redefine a number", () => {
    expect(() => evaluate([": 1 2 ;"])).toThrow("illegal operation");
  });

  it("cannot redefine a negative number", () => {
    expect(() => evaluate([": -1 2 ;"])).toThrow("illegal operation");
  });

  it("errors when executing a non-existent word", () => {
    expect(() => evaluate(["foo"])).toThrow("undefined operation");
  });

  it("throws a plain Error with the exact message (no decoration)", () => {
    try {
      evaluate(["1 +"]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toBe("only one value on the stack");
    }
  });
});

describe("call independence", () => {
  it("does not leak definitions between calls", () => {
    evaluate([": foo 1 ;"]);
    expect(() => evaluate(["foo"])).toThrow("undefined operation");
  });

  it("does not leak stack between calls", () => {
    evaluate(["1 2 3"]);
    expect(evaluate(["4"])).toEqual([4]);
  });
});
