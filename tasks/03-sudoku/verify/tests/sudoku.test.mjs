// Independent verifier suite for task 03-sudoku (round 0).
// Derived ONLY from spec.md acceptance criteria 1-12 + research/RESEARCH.md
// edge cases. Builder tests in src/tests/ were NOT read.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import * as sudoku from "../../src/sudoku.mjs";

const { solve, validate, countSolutions } = sudoku;

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(HERE, "../../src/sudoku.mjs");

// ---------------------------------------------------------------------------
// Helpers (independent implementations — no reliance on the candidate)
// ---------------------------------------------------------------------------

function fromString(s) {
  if (s.length !== 81) throw new Error(`bad vector length ${s.length}`);
  const g = [];
  for (let r = 0; r < 9; r++) {
    g.push([...s.slice(r * 9, r * 9 + 9)].map((ch) => Number(ch)));
  }
  return g;
}

function clone(g) {
  return g.map((row) => row.slice());
}

/** Full independent check of the Sudoku rule on a claimed solution. */
function isSolvedGrid(g) {
  if (!Array.isArray(g) || g.length !== 9) return false;
  for (let r = 0; r < 9; r++) {
    if (!Array.isArray(g[r]) || g[r].length !== 9) return false;
    for (let c = 0; c < 9; c++) {
      const v = g[r][c];
      if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 9) {
        return false;
      }
    }
  }
  const FULL = "123456789";
  for (let r = 0; r < 9; r++) {
    const digits = g[r].slice().sort().join("");
    if (digits !== FULL) return false;
  }
  for (let c = 0; c < 9; c++) {
    const digits = g.map((row) => row[c]).sort().join("");
    if (digits !== FULL) return false;
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box = [];
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) box.push(g[br * 3 + dr][bc * 3 + dc]);
      }
      if (box.sort().join("") !== FULL) return false;
    }
  }
  return true;
}

function agreesWithGivens(sol, puzzle) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (puzzle[r][c] !== 0 && sol[r][c] !== puzzle[r][c]) return false;
    }
  }
  return true;
}

function timed(fn) {
  const t0 = performance.now();
  const result = fn();
  return { result, ms: performance.now() - t0 };
}

// ---------------------------------------------------------------------------
// Spec test vectors (exact strings from spec.md "Test vectors")
// ---------------------------------------------------------------------------

const EASY_P =
  "003020600900305001001806400008102900700000008006708200002609500800203009005010300";
const EASY_S =
  "483921657967345821251876493548132976729564138136798245372689514814253769695417382";
const ESCARGOT_P =
  "100007090030020008009600500005300900010080002600004000300000010040000007007000300";
const ESCARGOT_S =
  "162857493534129678789643521475312986913586742628794135356478219241935867897261354";
const HARDEST2012_P =
  "800000000003600000070090200050007000000045700000100030001000068008500010090000400";
const HARDEST2012_S =
  "812753649943682175675491283154237896369845721287169534521974368438526917796318452";
const UNSOLVABLE_FAST =
  "120007090030020008009600500005300900010080002600004000300000010040000007007000300";
const UNSOLVABLE_DEEP =
  "000005080000601043000000000010500000000106000300000005530000061000000004000000000";
const TWO_SOLUTIONS =
  "162850403534120608789643521475312986913586742628794135356478219241935867897261354";

const easy = () => fromString(EASY_P);
const easySol = () => fromString(EASY_S);
const escargot = () => fromString(ESCARGOT_P);
const escargotSol = () => fromString(ESCARGOT_S);
const hardest = () => fromString(HARDEST2012_P);
const hardestSol = () => fromString(HARDEST2012_S);
const unsolvableFast = () => fromString(UNSOLVABLE_FAST);
const unsolvableDeep = () => fromString(UNSOLVABLE_DEEP);
const twoSolutions = () => fromString(TWO_SOLUTIONS);
const empty = () => fromString("0".repeat(81));

// Malformed inputs for criterion 2 (each with a label for readable output)
function makeMalformed() {
  const cases = [
    ["non-array: null", null],
    ["non-array: string", "003020600900305001..."],
    ["non-array: number", 42],
    ["non-array: plain object", {}],
    ["8 rows", easy().slice(0, 8)],
    ["10 rows", [...easy(), Array(9).fill(0)]],
  ];
  let g = easy();
  g[4] = "123456789";
  cases.push(["row is a string, not an array", g]);
  g = easy();
  g[2] = g[2].slice(0, 8);
  cases.push(["row of 8 cells", g]);
  g = easy();
  g[2] = [...g[2], 0];
  cases.push(["row of 10 cells", g]);
  for (const bad of [10, -1, 3.5, "5", null, undefined]) {
    g = easy();
    g[6][3] = bad;
    cases.push([`cell value ${JSON.stringify(bad) ?? "undefined"}`, g]);
  }
  return cases;
}

// Inconsistent boards for criterion 3
function rowConflict() {
  const g = empty();
  g[0][0] = 5;
  g[0][8] = 5; // same row, different column & box
  return g;
}
function colConflict() {
  const g = empty();
  g[0][0] = 5;
  g[8][0] = 5; // same column, different row & box
  return g;
}
function boxConflict() {
  const g = empty();
  g[0][0] = 5;
  g[1][1] = 5; // same 3x3 box, DIFFERENT row and DIFFERENT column
  return g;
}

// ---------------------------------------------------------------------------
// Criterion 1 — validate: {valid:true, reason:null} for all listed vectors
// ---------------------------------------------------------------------------

describe("C1: validate accepts every spec vector", () => {
  const boards = [
    ["EASY", easy()],
    ["EASY solution (solved grid)", easySol()],
    ["ESCARGOT", escargot()],
    ["HARDEST2012", hardest()],
    ["UNSOLVABLE_FAST (valid despite 0 solutions)", unsolvableFast()],
    ["UNSOLVABLE_DEEP (valid despite 0 solutions)", unsolvableDeep()],
    ["TWO_SOLUTIONS (valid despite 2 solutions)", twoSolutions()],
    ["EMPTY", empty()],
  ];
  it.each(boards)("%s -> {valid:true, reason:null}", (_name, board) => {
    expect(validate(board)).toEqual({ valid: true, reason: null });
  });
});

// ---------------------------------------------------------------------------
// Criterion 2 — validate rejects malformed input with non-empty reason
// ---------------------------------------------------------------------------

describe("C2: validate rejects malformed input", () => {
  it.each(makeMalformed())("%s -> valid:false + non-empty reason", (_n, bad) => {
    const res = validate(bad);
    expect(res.valid).toBe(false);
    expect(typeof res.reason).toBe("string");
    expect(res.reason.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Criterion 3 — validate detects row / column / box duplicates
// ---------------------------------------------------------------------------

describe("C3: validate detects each conflict kind", () => {
  it("row duplicate -> valid:false + non-empty reason", () => {
    const res = validate(rowConflict());
    expect(res.valid).toBe(false);
    expect(typeof res.reason).toBe("string");
    expect(res.reason.length).toBeGreaterThan(0);
  });
  it("column duplicate -> valid:false + non-empty reason", () => {
    const res = validate(colConflict());
    expect(res.valid).toBe(false);
    expect(typeof res.reason).toBe("string");
    expect(res.reason.length).toBeGreaterThan(0);
  });
  it("box-only duplicate (different row AND column) -> valid:false", () => {
    const res = validate(boxConflict());
    expect(res.valid).toBe(false);
    expect(typeof res.reason).toBe("string");
    expect(res.reason.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Criterion 4 — solve returns the exact stated unique solutions
// ---------------------------------------------------------------------------

describe("C4: solve returns the exact unique solutions", () => {
  it("solve(EASY) === EASY solution", () => {
    expect(solve(easy())).toEqual(easySol());
  });
  it("solve(ESCARGOT) === ESCARGOT solution", () => {
    expect(solve(escargot())).toEqual(escargotSol());
  });
  it("solve(HARDEST2012) === HARDEST2012 solution", () => {
    expect(solve(hardest())).toEqual(hardestSol());
  });
  it("solutions are nested arrays of primitive integers", () => {
    const s = solve(easy());
    expect(Array.isArray(s)).toBe(true);
    for (const row of s) {
      expect(Array.isArray(row)).toBe(true);
      for (const v of row) {
        expect(typeof v).toBe("number");
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Criterion 5 — solve returns null for malformed/inconsistent/unsolvable
// ---------------------------------------------------------------------------

describe("C5: solve returns null on bad or unsolvable boards", () => {
  it.each(makeMalformed())("malformed (%s) -> null", (_n, bad) => {
    expect(solve(bad)).toBeNull();
  });
  it("row conflict -> null", () => expect(solve(rowConflict())).toBeNull());
  it("column conflict -> null", () => expect(solve(colConflict())).toBeNull());
  it("box conflict -> null", () => expect(solve(boxConflict())).toBeNull());
  it("UNSOLVABLE_FAST -> null", () => {
    expect(solve(unsolvableFast())).toBeNull();
  });
  // UNSOLVABLE_DEEP covered in the C11 timed section (60 s bound).
});

// ---------------------------------------------------------------------------
// Criterion 6 — solve(EMPTY) and solve(complete grid)
// ---------------------------------------------------------------------------

describe("C6: solve on empty and already-complete grids", () => {
  it("solve(EMPTY) returns a fully solved grid per the Sudoku rule", () => {
    const s = solve(empty());
    expect(isSolvedGrid(s)).toBe(true);
  });
  it("solve(complete valid grid) returns that grid's values", () => {
    const input = easySol();
    const s = solve(input);
    expect(s).toEqual(easySol());
  });
  it("solve returns a NEW array (not the input reference)", () => {
    const input = easySol();
    const s = solve(input);
    expect(s).not.toBe(input);
    for (let r = 0; r < 9; r++) expect(s[r]).not.toBe(input[r]);
  });
});

// ---------------------------------------------------------------------------
// Criterion 7 — countSolutions === 1 for the three unique puzzles (cap 3+)
// ---------------------------------------------------------------------------

describe("C7: countSolutions proves uniqueness (cap 3)", () => {
  it("EASY -> 1", () => expect(countSolutions(easy(), 3)).toBe(1));
  it("ESCARGOT -> 1", () => expect(countSolutions(escargot(), 3)).toBe(1));
  it("HARDEST2012 -> 1", () => expect(countSolutions(hardest(), 3)).toBe(1));
});

// ---------------------------------------------------------------------------
// Criterion 8 — countSolutions === 0 for unsolvable/malformed/inconsistent
// ---------------------------------------------------------------------------

describe("C8: countSolutions returns 0 where required", () => {
  it("UNSOLVABLE_FAST -> 0", () => {
    expect(countSolutions(unsolvableFast(), 2)).toBe(0);
  });
  it.each(makeMalformed())("malformed (%s) -> 0", (_n, bad) => {
    expect(countSolutions(bad)).toBe(0);
  });
  it("row conflict -> 0", () => expect(countSolutions(rowConflict())).toBe(0));
  it("column conflict -> 0", () => expect(countSolutions(colConflict())).toBe(0));
  it("box conflict -> 0", () => expect(countSolutions(boxConflict())).toBe(0));
  // UNSOLVABLE_DEEP covered in the C11 timed section (60 s bound).
});

// ---------------------------------------------------------------------------
// Criterion 9 — counting caps
// ---------------------------------------------------------------------------

describe("C9: countSolutions cap semantics", () => {
  it("countSolutions(TWO_SOLUTIONS, 5) === 2 exactly", () => {
    expect(countSolutions(twoSolutions(), 5)).toBe(2);
  });
  it("countSolutions(EMPTY) with no cap arg === 2 (default cap)", () => {
    expect(countSolutions(empty())).toBe(2);
  });
  it("countSolutions(EMPTY, 1) === 1", () => {
    expect(countSolutions(empty(), 1)).toBe(1);
  });
  it("solve(TWO_SOLUTIONS) returns some valid solution agreeing with givens", () => {
    const p = twoSolutions();
    const s = solve(p);
    expect(isSolvedGrid(s)).toBe(true);
    expect(agreesWithGivens(s, p)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Criterion 10 — no input mutation
// ---------------------------------------------------------------------------

describe("C10: solve/countSolutions never mutate the input", () => {
  const boards = [
    ["EASY", easy()],
    ["HARDEST2012", hardest()],
    ["UNSOLVABLE_FAST", unsolvableFast()],
    ["TWO_SOLUTIONS", twoSolutions()],
    ["EMPTY", empty()],
  ];
  it.each(boards)("solve does not mutate %s", (_n, board) => {
    const before = clone(board);
    solve(board);
    expect(board).toEqual(before);
  });
  it.each(boards)("countSolutions does not mutate %s", (_n, board) => {
    const before = clone(board);
    countSolutions(board, 2);
    expect(board).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Criterion 11 — time bounds (2 s general; 60 s for UNSOLVABLE_DEEP)
// ---------------------------------------------------------------------------

describe("C11: time bounds", () => {
  const fastVectors = [
    ["EASY", easy()],
    ["ESCARGOT", escargot()],
    ["HARDEST2012", hardest()],
    ["UNSOLVABLE_FAST", unsolvableFast()],
    ["TWO_SOLUTIONS", twoSolutions()],
    ["EMPTY", empty()],
  ];
  it.each(fastVectors)("solve(%s) completes in < 2 s", (_n, board) => {
    const { ms } = timed(() => solve(board));
    expect(ms).toBeLessThan(2000);
  });
  it.each(fastVectors)(
    "countSolutions(%s, 3) completes in < 2 s",
    (_n, board) => {
      const { ms } = timed(() => countSolutions(board, 3));
      expect(ms).toBeLessThan(2000);
    },
  );
  it(
    "solve(UNSOLVABLE_DEEP) -> null in < 60 s",
    { timeout: 90_000 },
    () => {
      const { result, ms } = timed(() => solve(unsolvableDeep()));
      expect(result).toBeNull();
      expect(ms).toBeLessThan(60_000);
    },
  );
  it(
    "countSolutions(UNSOLVABLE_DEEP, 2) -> 0 in < 60 s",
    { timeout: 90_000 },
    () => {
      const { result, ms } = timed(() => countSolutions(unsolvableDeep(), 2));
      expect(result).toBe(0);
      expect(ms).toBeLessThan(60_000);
    },
  );
  it("UNSOLVABLE_DEEP does not mutate its input either", () => {
    // cheap re-check using the already-fast validate path: compare to fresh copy
    const board = unsolvableDeep();
    const before = clone(board);
    validate(board);
    expect(board).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Criterion 12 — module hygiene: exact exports, no console.log, no import
// side effects, no dependencies
// ---------------------------------------------------------------------------

describe("C12: module hygiene", () => {
  it("exports exactly {solve, validate, countSolutions}", () => {
    expect(Object.keys(sudoku).sort()).toEqual([
      "countSolutions",
      "solve",
      "validate",
    ]);
    expect(typeof solve).toBe("function");
    expect(typeof validate).toBe("function");
    expect(typeof countSolutions).toBe("function");
  });
  it("source contains no console output calls and no imports", () => {
    const src = readFileSync(SRC_PATH, "utf8");
    expect(src).not.toMatch(/console\s*\.\s*(log|info|warn|error|debug)/);
    // no npm dependencies / no runtime imports at all
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/\brequire\s*\(/);
  });
  it("importing the module in a fresh process prints nothing", () => {
    const url = pathToFileURL(SRC_PATH).href;
    const script = `import(${JSON.stringify(url)}).then(() => process.exit(0), (e) => { process.stderr.write(String(e)); process.exit(1); });`;
    const res = spawnSync(process.execPath, ["-e", script], {
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe("");
    expect(res.stderr).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Research-derived edge cases (RESEARCH.md R3, R7)
// ---------------------------------------------------------------------------

describe("Research edge cases", () => {
  it("R3: a 16-clue board necessarily has multiple solutions (count hits cap 2)", () => {
    // Keep only the first 16 cells of the EASY solution; blank the rest.
    // McGuire et al.: no 16-clue proper puzzle exists -> must be 0 or 2+
    // solutions; givens here come from a real solution, so 2+.
    const g = easySol();
    let kept = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (kept < 16) kept++;
        else g[r][c] = 0;
      }
    }
    expect(countSolutions(g, 2)).toBe(2);
  });
  it("countSolutions(EMPTY, 3) returns the cap 3 (stops early)", () => {
    const { result, ms } = timed(() => countSolutions(empty(), 3));
    expect(result).toBe(3);
    expect(ms).toBeLessThan(2000);
  });
});
