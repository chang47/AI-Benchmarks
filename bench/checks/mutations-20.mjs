#!/usr/bin/env node
// Probe validation by mutation for task 20 (Cannae) (spec: "each broken copy must drop only its own check").
// Grades the reference, then deliberately broken copies of it, and reports which checks each one lost.
// A mutation PASSES when every one of its target checks lost points and nothing outside its allowed set did.
// Usage: node bench/checks/mutations-18.mjs [name,name…]   (scripted only — the yes/no judge is skipped)
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gradeReference } from "../grade/grade.mjs";
import { CACHE_DIR, taskDir } from "../lib/util.mjs";

const SRC = join(taskDir("20-cannae"), "src");
const M = [
  { name: "libyans-never-turn", why: "the ambush never springs", target: ["H-libyans", "H-encircle"], allowGroup: "History",
    edits: [["sim.js", "if (crescentCurve(s) <= -RULES.libyanTriggerConcave)", "if (false)"]] },
  { name: "sprinting", why: "infantry advances at 5 m/s", target: ["R-speed"], allowGroup: "any", // overshooting into enemies at 5 m/s is a real consequence
    edits: [["sim.js", "speed: { press: 0.5, advance: 1.0,", "speed: { press: 0.5, advance: 5.0,"]] },
  { name: "walk-through", why: "units never stop at enemies", target: ["R-overlap"], allowGroup: "any",
    edits: [["sim.js", "    if (u.kind === \"light\") return false;\n    const g = { x: u.x + dx", "    return false;\n    const g = { x: u.x + dx"]] },
  { name: "remote-kill", why: "Varro's horse loses men before anyone is near", target: ["R-contact"], allowGroup: "History",
    edits: [["sim.js", "      loss.set(d.id, dLoss);", "      if (d.id === \"R-acav\" && s.t < 30) dLoss += 3 * RULES.dt;\n      loss.set(d.id, dLoss);"]] },
  { name: "random", why: "combat uses Math.random", target: ["D-same", "D-path"], allowGroup: "any",
    edits: [["sim.js", "      loss.set(d.id, dLoss);", "      dLoss *= 0.5 + Math.random();\n      loss.set(d.id, dLoss);"]] },
  { name: "wrong-oob", why: "Varro has 4,000 horse", target: ["S-men"], allowGroup: "History",
    edits: [["sim.js", "men: 3600, x: 795, w: 540, frontY: 300", "men: 4000, x: 795, w: 540, frontY: 300"]] },
  { name: "no-ride", why: "Hasdrubal never rides round", target: ["H-ride"], allowGroup: "History",
    edits: [["sim.js", "    if (!s.flags.ride && alive(hc)", "    if (false && !s.flags.ride && alive(hc)"]] },
  { name: "console-error", why: "one console.error at boot", target: ["L-errors"], allowGroup: null,
    edits: [["app.js", "  \"use strict\";\n", "  \"use strict\";\n  console.error(\"mutation: deliberate error\");\n"]] },
];

const quiet = () => {};
const only = process.argv[2] ? process.argv[2].split(",") : null;
const earned = (r) => Object.fromEntries(r.checks.filter((c) => c.method !== "judge-checklist" && typeof c.points === "number").map((c) => [c.id, c.earned || 0]));

const ref = await gradeReference("20", { judge: false, log: quiet });
const base = earned(ref);
console.log(`reference: ${ref.pointsEarned}/${ref.pointsPossible} (scripted ${Object.values(base).reduce((a, b) => a + b, 0)})${Object.entries(base).filter(([id, e]) => e < ref.checks.find((c) => c.id === id).points).map(([id, e]) => ` · ${id} ${e}`).join("")}`);
let ok = 0;
const rows = [];
for (const m of M.filter((m) => !only || only.includes(m.name))) {
  const dir = join(CACHE_DIR, "mut20", m.name);
  rmSync(dir, { recursive: true, force: true });
  cpSync(SRC, dir, { recursive: true });
  for (const [f, from, to] of m.edits) {
    const p = join(dir, f), s = readFileSync(p, "utf8"), eol = s.includes("\r\n") ? "\r\n" : "\n"; // sources may be CRLF
    const [a, b] = [from, to].map((x) => x.replace(/\n/g, eol));
    if (!s.includes(a)) throw new Error(`${m.name}: edit anchor not found in ${f}: ${from.slice(0, 60)}`);
    writeFileSync(p, s.replace(a, b));
  }
  const r = await gradeReference("20", { candidate: dir, label: `mut-${m.name}`, judge: false, log: quiet });
  const got = earned(r);
  const lost = Object.keys(base).filter((id) => (got[id] ?? 0) < base[id]);
  const missed = m.target.filter((id) => !lost.includes(id));
  const groupOf = (id) => r.checks.find((c) => c.id === id)?.group;
  const collateral = lost.filter((id) => !m.target.includes(id) && m.allowGroup !== "any" && groupOf(id) !== m.allowGroup);
  const pass = !missed.length && !collateral.length;
  if (pass) ok++;
  rows.push({ name: m.name, pass, lost, missed, collateral, score: `${r.pointsEarned}/${r.pointsPossible}` });
  console.log(`${pass ? "PASS" : "FAIL"} ${m.name.padEnd(18)} (${m.why}) → ${r.pointsEarned} pts; lost: ${lost.join(", ") || "nothing"}${missed.length ? `; DID NOT LOSE: ${missed.join(", ")}` : ""}${collateral.length ? `; COLLATERAL: ${collateral.join(", ")}` : ""}`);
}
console.log(`${ok}/${rows.length} mutations caught by exactly their own checks`);
writeFileSync(join(CACHE_DIR, "mut20", "summary.json"), JSON.stringify({ reference: base, rows }, null, 1));
process.exitCode = ok === rows.length ? 0 : 1;
