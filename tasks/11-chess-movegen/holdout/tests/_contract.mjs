// Contract shim — resolves the candidate artifact.
//
// Artifact contract (spec.md "Artifact contract"): one file `src/movegen.mjs`
// at the task root, exporting parseFen, moves, perft. Relative to this file
// (holdout/tests/), that is ../../src/movegen.mjs.
//
// The verifier may point the suite at a different candidate file by setting
// the MOVEGEN_PATH environment variable (absolute or cwd-relative path).
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const defaultUrl = new URL("../../src/movegen.mjs", import.meta.url).href;
const target = process.env.MOVEGEN_PATH
  ? pathToFileURL(resolve(process.env.MOVEGEN_PATH)).href
  : defaultUrl;

const mod = await import(target);

for (const name of ["parseFen", "moves", "perft"]) {
  if (typeof mod[name] !== "function") {
    throw new Error(
      `Contract violation: candidate module (${target}) does not export function "${name}" ` +
        `(spec.md Artifact contract requires parseFen, moves, perft).`,
    );
  }
}

export const parseFen = mod.parseFen;
export const moves = mod.moves;
export const perft = mod.perft;
