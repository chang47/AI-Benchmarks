// sudoku.mjs — 9x9 Sudoku solver, validator, and solution counter.
// Pure logic library: no I/O, no CLI, no dependencies beyond the Node.js runtime.
//
// Grid encoding: a 9x9 nested array of integers, 0 = empty, 1-9 = filled.
//
// Exports (exactly):
//   solve(grid)               -> new 9x9 nested array (a solution) or null
//   validate(grid)            -> { valid: boolean, reason: string | null }
//   countSolutions(grid, cap) -> integer count of distinct solutions, capped at `cap` (default 2)

const ALL = 0x1ff; // bits 0..8 represent candidate digits 1..9

// ---------------------------------------------------------------------------
// Precomputed lookup tables (pure computation; no side effects beyond these).
// ---------------------------------------------------------------------------

const ROW_OF = new Uint8Array(81);
const COL_OF = new Uint8Array(81);
const BOX_OF = new Uint8Array(81);
for (let i = 0; i < 81; i++) {
  const r = (i / 9) | 0;
  const c = i % 9;
  ROW_OF[i] = r;
  COL_OF[i] = c;
  BOX_OF[i] = ((r / 3) | 0) * 3 + ((c / 3) | 0);
}

// 27 units: indices 0-8 rows, 9-17 columns, 18-26 boxes; each is 9 cell indices.
const UNIT_CELLS = [];
for (let r = 0; r < 9; r++) {
  const cells = [];
  for (let c = 0; c < 9; c++) cells.push(r * 9 + c);
  UNIT_CELLS.push(cells);
}
for (let c = 0; c < 9; c++) {
  const cells = [];
  for (let r = 0; r < 9; r++) cells.push(r * 9 + c);
  UNIT_CELLS.push(cells);
}
for (let b = 0; b < 9; b++) {
  const cells = [];
  const r0 = ((b / 3) | 0) * 3;
  const c0 = (b % 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) cells.push((r0 + dr) * 9 + (c0 + dc));
  }
  UNIT_CELLS.push(cells);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function describeValue(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "bigint") return `${v}n`;
  return String(v);
}

function wellFormedReason(grid) {
  if (!Array.isArray(grid)) return "board is not an array";
  if (grid.length !== 9) {
    return `board has ${grid.length} rows; expected exactly 9`;
  }
  for (let r = 0; r < 9; r++) {
    const row = grid[r];
    if (!Array.isArray(row)) return `row ${r + 1} is not an array`;
    if (row.length !== 9) {
      return `row ${r + 1} has ${row.length} cells; expected exactly 9`;
    }
    for (let c = 0; c < 9; c++) {
      const v = row[c];
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 9) {
        return (
          `cell at row ${r + 1}, column ${c + 1} is ${describeValue(v)}; ` +
          `expected an integer from 0 to 9`
        );
      }
    }
  }
  return null;
}

function consistencyReason(grid) {
  // Rows
  for (let r = 0; r < 9; r++) {
    let seen = 0;
    for (let c = 0; c < 9; c++) {
      const v = grid[r][c];
      if (v === 0) continue;
      const bit = 1 << (v - 1);
      if ((seen & bit) !== 0) {
        return `digit ${v} appears more than once in row ${r + 1}`;
      }
      seen |= bit;
    }
  }
  // Columns
  for (let c = 0; c < 9; c++) {
    let seen = 0;
    for (let r = 0; r < 9; r++) {
      const v = grid[r][c];
      if (v === 0) continue;
      const bit = 1 << (v - 1);
      if ((seen & bit) !== 0) {
        return `digit ${v} appears more than once in column ${c + 1}`;
      }
      seen |= bit;
    }
  }
  // 3x3 boxes
  for (let b = 0; b < 9; b++) {
    let seen = 0;
    const cells = UNIT_CELLS[18 + b];
    for (let k = 0; k < 9; k++) {
      const i = cells[k];
      const v = grid[ROW_OF[i]][COL_OF[i]];
      if (v === 0) continue;
      const bit = 1 << (v - 1);
      if ((seen & bit) !== 0) {
        const r0 = ((b / 3) | 0) * 3 + 1;
        const c0 = (b % 3) * 3 + 1;
        return (
          `digit ${v} appears more than once in the 3x3 box at ` +
          `rows ${r0}-${r0 + 2}, columns ${c0}-${c0 + 2}`
        );
      }
      seen |= bit;
    }
  }
  return null;
}

/**
 * Validate a board: well-formed (9x9 nested array of integers 0-9) and
 * consistent (no repeated digit among filled cells of any row/column/box).
 * Validity does NOT require solvability or uniqueness.
 *
 * @param {unknown} grid
 * @returns {{valid: boolean, reason: string | null}}
 */
export function validate(grid) {
  const malformed = wellFormedReason(grid);
  if (malformed !== null) return { valid: false, reason: malformed };
  const conflict = consistencyReason(grid);
  if (conflict !== null) return { valid: false, reason: conflict };
  return { valid: true, reason: null };
}

// ---------------------------------------------------------------------------
// Solver core: bitmask candidates + constraint propagation (naked singles and
// hidden singles to a fixpoint) + most-constrained-cell (MRV) backtracking.
// ---------------------------------------------------------------------------

function buildState(grid) {
  const board = new Uint8Array(81);
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const v = grid[ROW_OF[i]][COL_OF[i]];
    if (v === 0) continue;
    const bit = 1 << (v - 1);
    board[i] = v;
    rows[ROW_OF[i]] |= bit;
    cols[COL_OF[i]] |= bit;
    boxes[BOX_OF[i]] |= bit;
  }
  return { board, rows, cols, boxes };
}

function place(board, rows, cols, boxes, i, bit) {
  board[i] = 32 - Math.clz32(bit); // bit is a single set bit; digit = position + 1
  rows[ROW_OF[i]] |= bit;
  cols[COL_OF[i]] |= bit;
  boxes[BOX_OF[i]] |= bit;
}

function popcount9(x) {
  let n = 0;
  while (x !== 0) {
    x &= x - 1;
    n++;
  }
  return n;
}

/**
 * Assign all naked singles (cells with exactly one candidate) and hidden
 * singles (digits with exactly one possible cell in a unit) until a fixpoint.
 * Returns false on contradiction (a cell with no candidates, or a digit with
 * no possible cell in some unit); true otherwise. Mutates the state in place.
 */
function propagate(board, rows, cols, boxes) {
  let changed = true;
  while (changed) {
    changed = false;
    // Naked singles
    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0) continue;
      const cand = ALL & ~(rows[ROW_OF[i]] | cols[COL_OF[i]] | boxes[BOX_OF[i]]);
      if (cand === 0) return false;
      if ((cand & (cand - 1)) === 0) {
        place(board, rows, cols, boxes, i, cand);
        changed = true;
      }
    }
    // Hidden singles, per unit per missing digit
    for (let u = 0; u < 27; u++) {
      const cells = UNIT_CELLS[u];
      const used = u < 9 ? rows[u] : u < 18 ? cols[u - 9] : boxes[u - 18];
      let remaining = ALL & ~used;
      while (remaining !== 0) {
        const bit = remaining & -remaining;
        remaining ^= bit;
        let spot = -1;
        let count = 0;
        for (let k = 0; k < 9; k++) {
          const i = cells[k];
          if (board[i] !== 0) continue;
          const cand = ALL & ~(rows[ROW_OF[i]] | cols[COL_OF[i]] | boxes[BOX_OF[i]]);
          if ((cand & bit) !== 0) {
            count++;
            if (count > 1) break;
            spot = i;
          }
        }
        if (count === 0) return false;
        if (count === 1) {
          place(board, rows, cols, boxes, spot, bit);
          changed = true;
        }
      }
    }
  }
  return true;
}

/**
 * Depth-first search with propagation. Counts solutions up to `limit`.
 * If `out` is non-null, the first solution found is copied into it.
 * Returns the updated count of solutions found (never exceeds `limit`).
 */
function search(board, rows, cols, boxes, limit, out, found) {
  if (!propagate(board, rows, cols, boxes)) return found;

  // Most-constrained empty cell (fewest candidates).
  let best = -1;
  let bestCand = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const cand = ALL & ~(rows[ROW_OF[i]] | cols[COL_OF[i]] | boxes[BOX_OF[i]]);
    const n = popcount9(cand);
    if (n < bestCount) {
      bestCount = n;
      best = i;
      bestCand = cand;
      if (n <= 2) break; // after propagation the minimum possible is 2
    }
  }

  if (best === -1) {
    // No empty cells: the board is a complete solution.
    if (found === 0 && out !== null) out.set(board);
    return found + 1;
  }

  let cand = bestCand;
  while (cand !== 0) {
    const bit = cand & -cand;
    cand ^= bit;
    const b2 = board.slice();
    const r2 = rows.slice();
    const c2 = cols.slice();
    const x2 = boxes.slice();
    place(b2, r2, c2, x2, best, bit);
    found = search(b2, r2, c2, x2, limit, out, found);
    if (found >= limit) return found;
  }
  return found;
}

function toNestedArray(flat) {
  const grid = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) row.push(flat[r * 9 + c]);
    grid.push(row);
  }
  return grid;
}

/**
 * Solve a puzzle. Returns a NEW 9x9 nested array of integers 1-9 that is a
 * solution of `grid` (any one solution if several exist), or null if `grid`
 * is not a valid board or has no solution. Does not mutate the input.
 *
 * @param {unknown} grid
 * @returns {number[][] | null}
 */
export function solve(grid) {
  if (!validate(grid).valid) return null;
  const { board, rows, cols, boxes } = buildState(grid);
  const out = new Uint8Array(81);
  const found = search(board, rows, cols, boxes, 1, out, 0);
  if (found === 0) return null;
  return toNestedArray(out);
}

/**
 * Count distinct solutions of `grid`, stopping early once `cap` solutions
 * have been found (in which case `cap` is returned). `cap` defaults to 2.
 * Returns 0 if `grid` is not a valid board. Does not mutate the input.
 *
 * @param {unknown} grid
 * @param {number} [cap=2]
 * @returns {number}
 */
export function countSolutions(grid, cap = 2) {
  if (!validate(grid).valid) return 0;
  if (!(cap > 0)) return 0;
  const { board, rows, cols, boxes } = buildState(grid);
  return search(board, rows, cols, boxes, cap, null, 0);
}
