#!/usr/bin/env node
// Probe validation by mutation for task 18 (spec: "each broken copy must drop only its own check").
// Grades the reference, then deliberately broken copies of it, and reports which checks each one lost.
// A mutation PASSES when every one of its target checks lost points and nothing outside its allowed set did.
// Usage: node bench/checks/mutations-18.mjs [name,name…]   (scripted only — the yes/no judge is skipped)
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gradeReference } from "../grade/grade.mjs";
import { CACHE_DIR, taskDir } from "../lib/util.mjs";

const SRC = join(taskDir("18-wonders-landing"), "src");
const M = [
  { name: "frozen-volcano", why: "volcano progress stuck at 0", target: ["V-rise", "V-rewind"], allow: ["V-pin"],
    edits: [["world.js", "progress.volcano = reduce ? 0 : sectionProgress(CHAPTERS[2].el);", "progress.volcano = 0;"]] },
  { name: "broken-pin", why: "volcano text no longer sticky", target: ["V-pin"], allow: ["T-legibility"],
    edits: [["index.html", "#volcano .copy { position: sticky; top: 24vh; }", "#volcano .copy { position: relative; }"]] },
  { name: "never-pause", why: "scenes report playing everywhere", target: ["Q-pause"], allow: [],
    edits: [["world.js", "playing: (id) => playing.has(id),", "playing: (id) => true,"]] },
  { name: "no-cursor", why: "custom cursor never enabled", target: ["K-follow", "K-trail", "K-hover"], allow: [],
    edits: [["world.js", "const cursorOn = finePointer && !reduce;", "const cursorOn = false;"]] },
  { name: "no-validation", why: "submit handler does nothing", target: ["I-empty", "I-bad", "I-good"], allow: [],
    edits: [["world.js", "  form.addEventListener(\"submit\", (e) => {\n    e.preventDefault();\n", "  form.addEventListener(\"submit\", (e) => {\n    e.preventDefault(); return;\n"]] },
  { name: "no-reduced-motion", why: "prefers-reduced-motion ignored", target: ["Q-reduced", "K-reduced"], allow: [],
    edits: [["world.js", "const reduce = matchMedia(\"(prefers-reduced-motion: reduce)\").matches;", "const reduce = false;"], ["index.html", "@media (prefers-reduced-motion: reduce)", "@media (max-width: 1px)"]] },
  { name: "console-error", why: "one console.error at boot", target: ["L1"], allow: [],
    edits: [["world.js", "  \"use strict\";\n", "  \"use strict\";\n  console.error(\"mutation: deliberate error\");\n"]] },
  { name: "low-contrast", why: "readability scrims removed", target: ["T-legibility"], allow: [],
    edits: [["index.html", ".scrim::before { content: \"\";", ".scrim::before { display: none; content: \"\";"]] },
  { name: "no-mouse", why: "galaxy ignores the mouse", target: ["S-mouse"], allow: [],
    edits: [["world.js", "mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;", "mouse.sx = 0; mouse.sy = 0;"]] },
];

const quiet = () => {};
const only = process.argv[2] ? process.argv[2].split(",") : null;
const earned = (r) => Object.fromEntries(r.checks.filter((c) => c.method !== "judge-checklist" && typeof c.points === "number").map((c) => [c.id, c.earned || 0]));

const ref = await gradeReference("18", { judge: false, log: quiet });
const base = earned(ref);
console.log(`reference: ${ref.pointsEarned}/${ref.pointsPossible} (scripted ${Object.values(base).reduce((a, b) => a + b, 0)}/74)${Object.entries(base).filter(([id, e]) => e < ref.checks.find((c) => c.id === id).points).map(([id, e]) => ` · ${id} ${e}`).join("")}`);
let ok = 0;
const rows = [];
for (const m of M.filter((m) => !only || only.includes(m.name))) {
  const dir = join(CACHE_DIR, "mut18", m.name);
  rmSync(dir, { recursive: true, force: true });
  cpSync(SRC, dir, { recursive: true });
  for (const [f, from, to] of m.edits) {
    const p = join(dir, f), s = readFileSync(p, "utf8"), eol = s.includes("\r\n") ? "\r\n" : "\n"; // sources may be CRLF
    const [a, b] = [from, to].map((x) => x.replace(/\n/g, eol));
    if (!s.includes(a)) throw new Error(`${m.name}: edit anchor not found in ${f}: ${from.slice(0, 60)}`);
    writeFileSync(p, s.replace(a, b));
  }
  const r = await gradeReference("18", { candidate: dir, label: `mut-${m.name}`, judge: false, log: quiet });
  const got = earned(r);
  const lost = Object.keys(base).filter((id) => (got[id] ?? 0) < base[id]);
  const missed = m.target.filter((id) => !lost.includes(id));
  const collateral = lost.filter((id) => !m.target.includes(id) && !m.allow.includes(id));
  const pass = !missed.length && !collateral.length;
  if (pass) ok++;
  rows.push({ name: m.name, pass, lost, missed, collateral, score: `${r.pointsEarned}/${r.pointsPossible}` });
  console.log(`${pass ? "PASS" : "FAIL"} ${m.name.padEnd(18)} (${m.why}) → ${r.pointsEarned} pts; lost: ${lost.join(", ") || "nothing"}${missed.length ? `; DID NOT LOSE: ${missed.join(", ")}` : ""}${collateral.length ? `; COLLATERAL: ${collateral.join(", ")}` : ""}`);
}
console.log(`${ok}/${rows.length} mutations caught by exactly their own checks`);
writeFileSync(join(CACHE_DIR, "mut18", "summary.json"), JSON.stringify({ reference: base, rows }, null, 1));
process.exitCode = ok === rows.length ? 0 : 1;
