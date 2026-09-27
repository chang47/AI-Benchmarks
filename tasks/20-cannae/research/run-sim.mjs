// Dev aid: run the reference sim headless and print the battle as a timeline + the historical beats.
// node tasks/20-cannae/research/run-sim.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../src/sim.js", import.meta.url), "utf8"), ctx);
const { create, step, snapshot, RULES } = ctx.CannaeSim;
const s = create();
const t0 = Date.now();
const keep = {};
const cen = () => s.units.filter((u) => u.id.startsWith("C-cen"));
const curve = () => { const c = cen().map((u) => u.y + u.d / 2); const n = c.length; return (c[n / 2 - 1] + c[n / 2]) / 2 - (c[0] + c[n - 1]) / 2; }; // >0 convex (middle ahead/north)
while (s.t < RULES.duration) {
  step(s);
  if (s.step % 120 === 0) {
    const R = s.units.filter((u) => u.side === "R"), C = s.units.filter((u) => u.side === "C");
    const dead = (a) => Math.round(a.reduce((x, u) => x + (u.men0 - u.men), 0));
    const ri = s.units.filter((u) => u.id.startsWith("R-inf"));
    console.log(`t=${String(s.t).padStart(5)}  Rdead ${String(dead(R)).padStart(6)}  Cdead ${String(dead(C)).padStart(5)}  crescent ${curve().toFixed(0).padStart(5)}m  Rinf y ${Math.min(...ri.map((u) => u.y)).toFixed(0)}..${Math.max(...ri.map((u) => u.y)).toFixed(0)}  sides ${[...new Set(ri.flatMap((u) => u.engagedSides))].sort().join(",")}  ${s.units.filter((u) => ["C-cav", "R-cav", "R-acav", "C-num", "C-lib-W"].includes(u.id)).map((u) => `${u.id}:${u.status[0]}${Math.round(u.men)}@${u.x.toFixed(0)},${u.y.toFixed(0)}/${u.order.type}`).join(" ")}`);
  }
  if (keep.concaveAt == null && curve() < 0) keep.concaveAt = s.t;
}
console.log(`\n${s.step} steps in ${Date.now() - t0} ms`);
console.log("events:", s.events.filter((e) => e.type !== "order").map((e) => `${e.t}s ${e.type} ${e.id}${e.men != null ? ` (${e.men})` : ""}`).join(" | "));
const snap = snapshot(s);
const by = (p) => snap.units.filter((u) => u.id.startsWith(p));
const deadOf = (a) => a.reduce((x, u) => x + (u.men0 - u.men), 0);
console.log(`final: Roman dead ${deadOf(snap.units.filter((u) => u.side === "R"))} (inf ${deadOf(by("R-inf"))}), Carthaginian dead ${deadOf(snap.units.filter((u) => u.side === "C"))} (centre ${deadOf(by("C-cen"))}); concave first at t=${keep.concaveAt}`);
console.log(snap.units.map((u) => `${u.id}:${u.men0 - u.men}${u.status === "destroyed" ? "✝" : ""}`).join("  "));
