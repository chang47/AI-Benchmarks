import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { solve, validate, countSolutions } from "../sudoku.mjs";

// ---------------------------------------------------------------------------
// Test vectors (81-char strings, row-major, 0 = empty) — from spec.md
// ---------------------------------------------------------------------------

const EASY =
  "003020600900305001001806400008102900700000008006708200002609500800203009005010300";
const EASY_SOL =
  "483921657967345821251876493548132976729564138136798245372689514814253769695417382";
const ESCARGOT =
  "100007090030020008009600500005300900010080002600004000300000010040000007007000300";
const ESCARGOT_SOL =
  "162857493534129678789643521475312986913586742628794135356478219241935867897261354";
const HARDEST2012 =
  "800000000003600000070090200050007000000045700000100030001000068008500010090000400";
const HARDEST2012_SOL =
  "812753649943682175675491283154237896369845721287169534521974368438526917796318452";
const UNSOLVABLE_FAST =
  "120007090030020008009600500005300900010080002600004000300000010040000007007000300";
const UNSOLVABLE_DEEP =
  "000005080000601043000000000010500000000106000300000005530000061000000004000000000";
const TWO_SOLUTIONS =
  "162850403534120608789643521475312986913586742628794135356478219241935867897261354";
const EMPTY = "0".repeat(81);

function fromString(s) {
  expect(s).toHaveLength(81);
  const grid = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) row.push(s.charCodeAt(r * 9 + c) - 48);
    grid.push(row);
  }
  return grid;
}

function deepCopy(grid) {
  return grid.map((row) => row.slice());
}

/** True iff grid is a complete solved grid per the Sudoku rule. */
function isSolvedGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 9) return false;
  const full = 0x1ff;
  for (let r = 0; r < 9; r++) {
    if (!Array.isArray(grid[r]) || grid[r].length !== 9) return false;
    let mask = 0;
    for (let c = 0; c < 9; c++) {
      const v = grid[r][c];
      if (!Number.isInteger(v) || v < 1 || v > 9) return false;
      mask |= 1 << (v - 1);
    }
    if (mask !== full) return false;
  }
  for (let c = 0; c < 9; c++) {
    let mask = 0;
    for (let r = 0; r < 9; r++) mask |= 1 << (grid[r][c] - 1);
    if (mask !== full) return false;
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      let mask = 0;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          mask |= 1 << (grid[br * 3 + dr][bc * 3 + dc] - 1);
        }
      }
      if (mask !== full) return false;
    }
  }
  return true;
}

function expectInvalid(grid) {
  const res = validate(grid);
  expect(res.valid).toBe(false);
  expect(typeof res.reason).toBe("string");
  expect(res.reason.length).toBeGreaterThan(0);
  return res;
}

const TWO_SECONDS = 2000;
const SIXTY_SECONDS = 60000;

function timeMs(fn) {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
}

// ---------------------------------------------------------------------------
// Criterion 1: validate accepts every listed board and solved grids
// ---------------------------------------------------------------------------

describe("validate: valid boards", () => {
  const vectors = {
    EASY,
    ESCARGOT,
    HARDEST2012,
    UNSOLVABLE_FAST,
    UNSOLVABLE_DEEP,
    TWO_SOLUTIONS,
    EMPTY,
  };
  for (const [name, s] of Object.entries(vectors)) {
    test(`accepts ${name}`, () => {
      expect(validate(fromString(s))).toEqual({ valid: true, reason: null });
    });
  }
  test("accepts a solved grid (EASY solution)", () => {
    expect(validate(fromString(EASY_SOL))).toEqual({ valid: true, reason: null });
  });
});

// ---------------------------------------------------------------------------
// Criterion 2: malformed inputs
// ---------------------------------------------------------------------------

describe("validate: malformed input", () => {
  test("non-array inputs", () => {
    for (const bad of [null, undefined, 42, "not a grid", { a: 1 }, true]) {
      expectInvalid(bad);
    }
  });
  test("wrong number of rows", () => {
    expectInvalid(fromString(EASY).slice(0, 8)); // 8 rows
    const ten = fromString(EASY);
    ten.push(new Array(9).fill(0)); // 10 rows
    expectInvalid(ten);
    expectInvalid([]);
  });
  test("row that is not an array of exactly 9 elements", () => {
    const notArrayRow = fromString(EASY);
    notArrayRow[3] = "003020600";
    expectInvalid(notArrayRow);

    const shortRow = fromString(EASY);
    shortRow[5] = shortRow[5].slice(0, 8);
    expectInvalid(shortRow);

    const longRow = fromString(EASY);
    longRow[5] = [...longRow[5], 0];
    expectInvalid(longRow);
  });
  test.each([[10], [-1], [3.5], ["5"], [null], [undefined], [NaN]])(
    "bad cell value %s",
    (bad) => {
      const g = fromString(EMPTY);
      g[4][4] = bad;
      expectInvalid(g);
    },
  );
});

// ---------------------------------------------------------------------------
// Criterion 3: the three conflict kinds
// ---------------------------------------------------------------------------

describe("validate: rule conflicts", () => {
  test("duplicate in a row", () => {
    const g = fromString(EMPTY);
    g[0][0] = 5;
    g[0][8] = 5; // same row, different columns and boxes
    const res = expectInvalid(g);
    expect(res.reason).toMatch(/row/i);
  });
  test("duplicate in a column", () => {
    const g = fromString(EMPTY);
    g[0][0] = 7;
    g[8][0] = 7; // same column, different rows and boxes
    const res = expectInvalid(g);
    expect(res.reason).toMatch(/column/i);
  });
  test("duplicate sharing only a box (different row AND column)", () => {
    const g = fromString(EMPTY);
    g[0][0] = 9;
    g[1][1] = 9; // same 3x3 box only
    const res = expectInvalid(g);
    expect(res.reason).toMatch(/box/i);
  });
});

// ---------------------------------------------------------------------------
// Criteria 4 & 11: solve the three benchmark puzzles exactly, fast
// ---------------------------------------------------------------------------

describe("solve: benchmark puzzles", () => {
  test.each([
    ["EASY", EASY, EASY_SOL],
    ["ESCARGOT", ESCARGOT, ESCARGOT_SOL],
    ["HARDEST2012", HARDEST2012, HARDEST2012_SOL],
  ])("solves %s to the stated unique solution", (_name, puzzle, sol) => {
    const { value, ms } = timeMs(() => solve(fromString(puzzle)));
    expect(value).toEqual(fromString(sol));
    expect(ms).toBeLessThan(TWO_SECONDS);
  });
});

// ---------------------------------------------------------------------------
// Criterion 5: solve returns null for bad/unsolvable inputs
// ---------------------------------------------------------------------------

describe("solve: null cases", () => {
  test("malformed input", () => {
    expect(solve(null)).toBeNull();
    expect(solve("not a grid")).toBeNull();
    const g = fromString(EASY);
    g[2][2] = 10;
    expect(solve(g)).toBeNull();
  });
  test("inconsistent board", () => {
    const g = fromString(EMPTY);
    g[0][0] = 5;
    g[0][1] = 5;
    expect(solve(g)).toBeNull();
  });
  test("UNSOLVABLE_FAST", () => {
    const { value, ms } = timeMs(() => solve(fromString(UNSOLVABLE_FAST)));
    expect(value).toBeNull();
    expect(ms).toBeLessThan(TWO_SECONDS);
  });
  test(
    "UNSOLVABLE_DEEP (must finish under 60 s)",
    () => {
      const { value, ms } = timeMs(() => solve(fromString(UNSOLVABLE_DEEP)));
      expect(value).toBeNull();
      expect(ms).toBeLessThan(SIXTY_SECONDS);
    },
    SIXTY_SECONDS + 10000,
  );
});

// ---------------------------------------------------------------------------
// Criterion 6: EMPTY solves to some solved grid; complete grid round-trips
// ---------------------------------------------------------------------------

describe("solve: empty and complete grids", () => {
  test("EMPTY yields a fully solved grid", () => {
    const { value, ms } = timeMs(() => solve(fromString(EMPTY)));
    expect(isSolvedGrid(value)).toBe(true);
    expect(ms).toBeLessThan(TWO_SECONDS);
  });
  test("an already-complete valid grid returns the same values, as a new array", () => {
    const input = fromString(EASY_SOL);
    const result = solve(input);
    expect(result).toEqual(fromString(EASY_SOL));
    expect(result).not.toBe(input);
    for (let r = 0; r < 9; r++) expect(result[r]).not.toBe(input[r]);
  });
  test("solve returns a new array even for a puzzle with blanks", () => {
    const input = fromString(EASY);
    const result = solve(input);
    expect(result).not.toBe(input);
    for (let r = 0; r < 9; r++) expect(result[r]).not.toBe(input[r]);
  });
});

// ---------------------------------------------------------------------------
// Criteria 7-9: countSolutions
// ---------------------------------------------------------------------------

describe("countSolutions", () => {
  test.each([
    ["EASY", EASY],
    ["ESCARGOT", ESCARGOT],
    ["HARDEST2012", HARDEST2012],
  ])("%s has exactly 1 solution (cap 3 proves uniqueness)", (_name, puzzle) => {
    const { value, ms } = timeMs(() => countSolutions(fromString(puzzle), 3));
    expect(value).toBe(1);
    expect(ms).toBeLessThan(TWO_SECONDS);
  });
  test("0 for UNSOLVABLE_FAST", () => {
    const { value, ms } = timeMs(() => countSolutions(fromString(UNSOLVABLE_FAST)));
    expect(value).toBe(0);
    expect(ms).toBeLessThan(TWO_SECONDS);
  });
  test(
    "0 for UNSOLVABLE_DEEP (must finish under 60 s)",
    () => {
      const { value, ms } = timeMs(() => countSolutions(fromString(UNSOLVABLE_DEEP)));
      expect(value).toBe(0);
      expect(ms).toBeLessThan(SIXTY_SECONDS);
    },
    SIXTY_SECONDS + 10000,
  );
  test("0 for malformed and inconsistent input", () => {
    expect(countSolutions(null)).toBe(0);
    expect(countSolutions([[1]])).toBe(0);
    const g = fromString(EMPTY);
    g[0][0] = 5;
    g[0][1] = 5;
    expect(countSolutions(g)).toBe(0);
  });
  test("TWO_SOLUTIONS has exactly 2 solutions with cap 5", () => {
    const { value, ms } = timeMs(() => countSolutions(fromString(TWO_SOLUTIONS), 5));
    expect(value).toBe(2);
    expect(ms).toBeLessThan(TWO_SECONDS);
  });
  test("EMPTY hits the default cap of 2", () => {
    const { value, ms } = timeMs(() => countSolutions(fromString(EMPTY)));
    expect(value).toBe(2);
    expect(ms).toBeLessThan(TWO_SECONDS);
  });
  test("EMPTY with cap 1 returns 1", () => {
    const { value, ms } = timeMs(() => countSolutions(fromString(EMPTY), 1));
    expect(value).toBe(1);
    expect(ms).toBeLessThan(TWO_SECONDS);
  });
});

// ---------------------------------------------------------------------------
// Criterion 10: no input mutation
// ---------------------------------------------------------------------------

describe("no input mutation", () => {
  test("solve does not mutate its input", () => {
    for (const s of [EASY, UNSOLVABLE_FAST, TWO_SOLUTIONS, EMPTY, EASY_SOL]) {
      const input = fromString(s);
      const before = deepCopy(input);
      solve(input);
      expect(input).toEqual(before);
    }
  });
  test("countSolutions does not mutate its input", () => {
    for (const s of [EASY, UNSOLVABLE_FAST, TWO_SOLUTIONS, EMPTY]) {
      const input = fromString(s);
      const before = deepCopy(input);
      countSolutions(input, 5);
      expect(input).toEqual(before);
    }
  });
});

// ---------------------------------------------------------------------------
// Criterion 12: module hygiene
// ---------------------------------------------------------------------------

describe("module hygiene", () => {
  test("source contains no console output calls", () => {
    const srcPath = fileURLToPath(new URL("../sudoku.mjs", import.meta.url));
    const src = readFileSync(srcPath, "utf8");
    expect(src).not.toMatch(/console\s*\./);
  });
  test("exports exactly solve, validate, countSolutions", async () => {
    const mod = await import("../sudoku.mjs");
    expect(Object.keys(mod).sort()).toEqual(["countSolutions", "solve", "validate"]);
  });
});
