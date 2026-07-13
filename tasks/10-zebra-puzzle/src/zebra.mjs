// Zebra Puzzle constraint solver.
//
// Solves the classic Exercism "zebra-puzzle" by a real backtracking CSP search:
// each of statements 2..15 is an explicit, individually identifiable constraint
// that the search evaluates against candidate assignments. Statement 1 ("five
// houses") and the per-category "all different" rule define the search space.
//
// Conventions (pinned by the task spec, standard Wikipedia interpretation):
//   - Houses stand in a row, positions 1..5 left-to-right (indices 0..4 here).
//   - "first house"  = position 1 (index 0).
//   - "middle house" = position 3 (index 2).
//   - "immediately to the right of": pos(X) = pos(Y) + 1.
//   - "next to": |pos(A) - pos(B)| = 1.
//
// No answer is hardcoded: drinksWater() / ownsZebra() read whatever the search
// derives. Perturbing any constraint changes the derived answer or trips the
// uniqueness assertion.

/** The five possible values in each category (statement 1 + "all different"). */
const CATEGORIES = {
  color: ["red", "green", "ivory", "yellow", "blue"],
  nationality: ["Englishman", "Spaniard", "Ukrainian", "Norwegian", "Japanese"],
  beverage: ["coffee", "tea", "milk", "orange juice", "water"],
  hobby: ["dancing", "painting", "reading", "football", "chess"],
  pet: ["dog", "snails", "fox", "horse", "zebra"],
};

/**
 * Category assignment order for the backtracking search. Chosen so that
 * heavily-constraining categories are placed early, maximizing pruning. Every
 * constraint is checked as soon as all categories it depends on are assigned.
 */
const ORDER = ["color", "nationality", "beverage", "hobby", "pet"];

/** Index (0..4) of the house whose `field` equals `value`, or -1 if none. */
function posOf(houses, field, value) {
  return houses.findIndex((h) => h[field] === value);
}

/**
 * The 14 statement-constraints (statements 2..15 of the puzzle). Each entry is
 * an explicit, individually identifiable rule:
 *   - `stmt`  : the puzzle statement number (for traceability / perturbation).
 *   - `deps`  : the categories the predicate reads; the search invokes `test`
 *               only once every one of these is fully assigned.
 *   - `test`  : predicate over the (partially) filled houses array, true iff the
 *               statement is satisfied.
 */
const CONSTRAINTS = [
  {
    stmt: 2, // The Englishman lives in the red house.
    deps: ["nationality", "color"],
    test: (h) => posOf(h, "nationality", "Englishman") === posOf(h, "color", "red"),
  },
  {
    stmt: 3, // The Spaniard owns the dog.
    deps: ["nationality", "pet"],
    test: (h) => posOf(h, "nationality", "Spaniard") === posOf(h, "pet", "dog"),
  },
  {
    stmt: 4, // The person in the green house drinks coffee.
    deps: ["color", "beverage"],
    test: (h) => posOf(h, "color", "green") === posOf(h, "beverage", "coffee"),
  },
  {
    stmt: 5, // The Ukrainian drinks tea.
    deps: ["nationality", "beverage"],
    test: (h) => posOf(h, "nationality", "Ukrainian") === posOf(h, "beverage", "tea"),
  },
  {
    stmt: 6, // The green house is immediately to the right of the ivory house.
    deps: ["color"],
    test: (h) => posOf(h, "color", "green") === posOf(h, "color", "ivory") + 1,
  },
  {
    stmt: 7, // The snail owner likes to go dancing.
    deps: ["pet", "hobby"],
    test: (h) => posOf(h, "pet", "snails") === posOf(h, "hobby", "dancing"),
  },
  {
    stmt: 8, // The person in the yellow house is a painter.
    deps: ["color", "hobby"],
    test: (h) => posOf(h, "color", "yellow") === posOf(h, "hobby", "painting"),
  },
  {
    stmt: 9, // The person in the middle house drinks milk.
    deps: ["beverage"],
    test: (h) => h[2].beverage === "milk",
  },
  {
    stmt: 10, // The Norwegian lives in the first house.
    deps: ["nationality"],
    test: (h) => h[0].nationality === "Norwegian",
  },
  {
    stmt: 11, // The reader lives in the house next to the person with the fox.
    deps: ["hobby", "pet"],
    test: (h) => Math.abs(posOf(h, "hobby", "reading") - posOf(h, "pet", "fox")) === 1,
  },
  {
    stmt: 12, // The painter's house is next to the house with the horse.
    deps: ["hobby", "pet"],
    test: (h) => Math.abs(posOf(h, "hobby", "painting") - posOf(h, "pet", "horse")) === 1,
  },
  {
    stmt: 13, // The person who plays football drinks orange juice.
    deps: ["hobby", "beverage"],
    test: (h) => posOf(h, "hobby", "football") === posOf(h, "beverage", "orange juice"),
  },
  {
    stmt: 14, // The Japanese person plays chess.
    deps: ["nationality", "hobby"],
    test: (h) => posOf(h, "nationality", "Japanese") === posOf(h, "hobby", "chess"),
  },
  {
    stmt: 15, // The Norwegian lives next to the blue house.
    deps: ["nationality", "color"],
    test: (h) => Math.abs(posOf(h, "nationality", "Norwegian") - posOf(h, "color", "blue")) === 1,
  },
];

/** All 120 permutations of [0,1,2,3,4], precomputed once. */
const PERMS = (() => {
  const out = [];
  const build = (chosen, remaining) => {
    if (remaining.length === 0) {
      out.push(chosen);
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      build([...chosen, remaining[i]], remaining.filter((_, j) => j !== i));
    }
  };
  build([], [0, 1, 2, 3, 4]);
  return out;
})();

/**
 * Run the backtracking search over the whole assignment space and collect every
 * complete assignment that satisfies all 14 constraints.
 *
 * Category-by-category assignment (each category a permutation of its five
 * values across the five positions) enforces the "all different within a
 * category" rule by construction, and constraints are evaluated the moment their
 * dependencies are all assigned — pruning failing branches long before the naive
 * 5!^5 ≈ 24.9 billion combinations are reached.
 */
function search() {
  // For each depth, the constraints whose dependencies first become fully
  // assigned at that depth (so each constraint is checked exactly once, as early
  // as possible).
  const checkAt = ORDER.map(() => []);
  for (const c of CONSTRAINTS) {
    let deepest = -1;
    for (const dep of c.deps) deepest = Math.max(deepest, ORDER.indexOf(dep));
    checkAt[deepest].push(c);
  }

  const houses = [{}, {}, {}, {}, {}];
  const solutions = [];

  const recurse = (depth) => {
    if (depth === ORDER.length) {
      solutions.push(houses.map((h) => ({ ...h })));
      return;
    }
    const cat = ORDER[depth];
    const values = CATEGORIES[cat];
    const rules = checkAt[depth];
    for (const perm of PERMS) {
      for (let i = 0; i < 5; i++) houses[i][cat] = values[perm[i]];
      let ok = true;
      for (const rule of rules) {
        if (!rule.test(houses)) {
          ok = false;
          break;
        }
      }
      if (ok) recurse(depth + 1);
    }
  };

  recurse(0);
  return solutions;
}

/** Memoized unique solution (array of 5 house objects, index = position-1). */
let SOLUTION = null;

function solve() {
  if (SOLUTION) return SOLUTION;
  const solutions = search();
  if (solutions.length !== 1) {
    throw new Error(
      `Zebra puzzle expected exactly one solution but found ${solutions.length}.`,
    );
  }
  SOLUTION = solutions[0];
  return SOLUTION;
}

/** @returns {string} nationality of the resident who drinks water. */
export function drinksWater() {
  const houses = solve();
  return houses.find((h) => h.beverage === "water").nationality;
}

/** @returns {string} nationality of the resident who owns the zebra. */
export function ownsZebra() {
  const houses = solve();
  return houses.find((h) => h.pet === "zebra").nationality;
}
