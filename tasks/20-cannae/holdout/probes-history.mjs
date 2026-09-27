// Cannae grader, part 1: the contract, the order of battle, determinism, rule compliance and the historical beats,
// all measured on state() samples taken every STEP seconds of battle time via seek().
import { REQUIRED, alive, angDiff, band, dead, frontY, overlapDepth, rectDist, spec } from "./lib/geo.mjs";

export const STEP = 10;
const pick = (u) => ({ id: u.id, side: u.side, kind: u.kind, contingent: u.contingent, men: +u.men, men0: +u.men0, x: +u.x, y: +u.y, heading: +u.heading,
  frontage: +u.frontage, depth: +u.depth, status: u.status, engagedSides: u.engagedSides || [] });

/** Sample the whole battle. Returns { duration, samples: [{t, units}], events } or { error }. */
export async function sampleBattle(page) {
  return page.evaluate(async ({ STEP }) => {
    const c = window.__cannae;
    if (!c || typeof c.seek !== "function" || typeof c.state !== "function") return { error: "window.__cannae.seek/state missing" };
    const pick = (u) => ({ id: u.id, side: u.side, kind: u.kind, contingent: u.contingent, men: +u.men, men0: +u.men0, x: +u.x, y: +u.y, heading: +u.heading,
      frontage: +u.frontage, depth: +u.depth, status: u.status, engagedSides: u.engagedSides || [] });
    try {
      c.pause?.();
      const duration = Number(c.duration) || 0, samples = [];
      for (let t = 0; t <= Math.min(duration, 3600) + 1e-9; t += STEP) {
        await Promise.resolve(c.seek(t)); const s = c.state();
        samples.push({ t: +s.t, units: (s.units || []).map(pick) });
      }
      const last = c.state();
      return { duration, samples, events: (last.events || []).map((e) => ({ t: +e.t, type: e.type, id: e.id })) };
    } catch (e) { return { error: String(e).slice(0, 200) }; }
  }, { STEP });
}

export async function probeDeterminism(page) {
  return page.evaluate(async () => {
    const c = window.__cannae; if (!c) return { same: false, path: false, why: "no __cannae" };
    const snap = async (t) => { await Promise.resolve(c.seek(t)); return JSON.stringify((c.state().units || []).map((u) => [u.id, Math.round(u.men), +(+u.x).toFixed(1), +(+u.y).toFixed(1), u.status])); };
    try {
      // Off the likely checkpoint grid, and reached by different routes: a cached checkpoint cannot hide randomness.
      const direct = await snap(1473); await snap(611); const fromBefore = await snap(1473); await snap(Math.min(c.duration, 2003)); const fromAfter = await snap(1473);
      return { path: direct === fromBefore && direct === fromAfter, at1473: direct };
    } catch (e) { return { same: false, path: false, why: String(e).slice(0, 160) }; }
  });
}

export function scoreHistory(B, det) {
  const out = [];
  const add = (id, group, name, points, earned, detail) => out.push({ id, group, name, points, earned, detail });
  const S = B.samples, s0 = S[0], end = S.at(-1);
  const at = (s, id) => s.units.find((u) => u.id === id);

  // ---------------- order of battle
  const missing = REQUIRED.filter((id) => !at(s0, id));
  add("S-ids", "Order of battle", "all required unit ids at t=0", 2, missing.length ? 0 : 2, missing.length ? `missing ${missing.join(", ")}` : `${REQUIRED.length} units`);
  const menBad = [], posBad = [];
  for (const id of REQUIRED) {
    const u = at(s0, id), sp = spec(id); if (!u) continue;
    if (Math.abs(u.men - sp[0]) > sp[0] * 0.02) menBad.push(`${id} ${Math.round(u.men)}≠${Math.round(sp[0])}`);
    if (Math.abs(u.x - sp[1]) > 15 || Math.abs(frontY(u) - sp[2]) > 15 || Math.abs(u.frontage - sp[3]) > 15 || angDiff(u.heading, sp[4]) > 0.1)
      posBad.push(`${id} (x ${u.x.toFixed(0)}, front ${frontY(u).toFixed(0)}, w ${u.frontage.toFixed(0)}, h ${u.heading.toFixed(2)})`);
  }
  add("S-men", "Order of battle", "unit strengths match the order of battle (±2%)", 2, menBad.length ? 0 : 2, menBad.slice(0, 4).join("; ") || "all match");
  add("S-pos", "Order of battle", "positions, frontages and facings match the deployment", 2, band(-posBad.length, [[0, 2], [-3, 1]]), posBad.slice(0, 3).join("; ") || "all match");

  // ---------------- determinism
  add("D-same", "Determinism", "two fresh page loads give the same state at t = 1473 s", 2, det.same ? 2 : 0, det.why || String(det.same));
  add("D-path", "Determinism", "state at t does not depend on how you got there", 2, det.path ? 2 : 0, det.why || String(det.path));
  add("D-dur", "Determinism", "battle lasts ≥ 30 min of battle time", 1, B.duration >= 1800 ? 1 : 0, `duration ${B.duration}s`);

  // ---------------- rules
  const vmax = (u) => (u.status === "routing" ? 4.5 : u.kind === "inf" ? (u.contingent === "libyan" ? 1.3 : 1.2) : u.kind === "cav" ? (u.contingent === "numidian" ? 7 : 6) : 5);
  let pairs = 0, fast = 0; const fastEx = [];
  let grow = 0; const growEx = [];
  let losses = 0, remote = 0; const remoteEx = [];
  let routObs = 0, routOk = 0;
  for (let k = 1; k < S.length; k++) {
    const A = S[k - 1], Bk = S[k], dt = Bk.t - A.t;
    for (const u of Bk.units) {
      const p = at(A, u.id);
      if (!p || !alive(p) || !alive(u)) continue;
      pairs++;
      const d = Math.hypot(u.x - p.x, u.y - p.y);
      if (d > dt * Math.max(vmax(u), vmax(p)) * 1.15 + 5) { fast++; if (fastEx.length < 3) fastEx.push(`${u.id} ${(d / dt).toFixed(1)} m/s @${Bk.t}`); }
      if (u.men > p.men + 1) { grow++; if (growEx.length < 3) growEx.push(`${u.id} @${Bk.t}`); }
      if (p.men - u.men > 10) {
        losses++;
        const reach = u.kind === "light" || p.kind === "light" ? 150 : 25;
        const near = [A, Bk].some((s) => s.units.some((e) => e.side !== u.side && alive(e) && rectDist(e, s === A ? p : u) <= reach));
        const shooters = [A, Bk].some((s) => s.units.some((e) => e.side !== u.side && alive(e) && ((e.kind === "light" && rectDist(e, s === A ? p : u) <= 150) || (e.contingent === "numidian" && rectDist(e, s === A ? p : u) <= 300))));
        if (!near && !shooters) { remote++; if (remoteEx.length < 3) remoteEx.push(`${u.id} −${Math.round(p.men - u.men)} @${Bk.t}`); }
      }
      if (p.status === "routing") {
        routObs++;
        // Flight direction: the step must point away from the nearest enemy at the start of the step (pursuers may still close in).
        const foes = A.units.filter((e) => e.side !== p.side && alive(e) && e.status !== "routing");
        const nf = foes.sort((a, b) => rectDist(a, p) - rectDist(b, p))[0];
        const mx = u.x - p.x, my = u.y - p.y;
        if (u.status === "left" || !nf || Math.hypot(mx, my) < 1 || mx * (p.x - nf.x) + my * (p.y - nf.y) > 0) routOk++;
      }
    }
  }
  const okFrac = pairs ? 1 - fast / pairs : 0;
  add("R-speed", "Rules", "speed limits respected (sampled every 10 s)", 3, band(okFrac, [[0.99, 3], [0.97, 2], [0.9, 1]]), `${fast}/${pairs} unit-steps too fast${fastEx.length ? ": " + fastEx.join(", ") : ""}`);
  add("R-men", "Rules", "a unit's men never increase", 2, grow ? 0 : 2, grow ? `${grow} increases: ${growEx.join(", ")}` : "never");
  const localFrac = losses ? 1 - remote / losses : 0;
  add("R-contact", "Rules", "men die only where an enemy is in reach", 3, !losses ? 0 : remote === 0 ? 3 : remote <= 2 ? 2 : localFrac >= 0.95 ? 1 : 0, `${remote}/${losses} loss events with no enemy in reach${remoteEx.length ? ": " + remoteEx.join(", ") : ""}`);
  let overlapSamples = 0; const overEx = [];
  for (const s of S) {
    const act = s.units.filter((u) => alive(u) && u.kind !== "light" && u.status !== "routing");
    let bad = false;
    for (let i = 0; i < act.length && !bad; i++) for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j];
      if (a.side !== b.side && overlapDepth(a, b) > 5) { bad = true; if (overEx.length < 3) overEx.push(`${a.id}×${b.id} @${s.t}`); break; }
    }
    if (bad) overlapSamples++;
  }
  const clean = 1 - overlapSamples / S.length;
  add("R-overlap", "Rules", "no unit passes through an enemy", 3, band(clean, [[1, 3], [0.95, 2], [0.85, 1]]), `${overlapSamples}/${S.length} samples with an enemy overlap > 5 m${overEx.length ? ": " + overEx.join(", ") : ""}`);
  add("R-rout", "Rules", "routed units flee away from the enemy", 2, routObs && routOk / routObs >= 0.9 ? 2 : routObs && routOk / routObs >= 0.7 ? 1 : 0, `${routOk}/${routObs} routing steps moved away (or left)`);

  // ---------------- the historical beats
  const routT = (id) => { const e = B.events.find((x) => x.type === "rout" && x.id === id); if (e) return e.t; const s = S.find((s) => ["routing", "destroyed", "left"].includes(at(s, id)?.status)); return s ? s.t : null; };
  const libInT = (() => { for (const s of S) for (const L of ["C-lib-W", "C-lib-E"]) { const l = at(s, L); if (l && alive(l) && angDiff(l.heading, 0) > 1 && s.units.some((r) => r.id.startsWith("R-inf") && alive(r) && rectDist(l, r) < 15)) return s.t; } return null; })();
  const rc = routT("R-cav");
  add("H-rivercav", "History", "the Roman cavalry by the river breaks first, before the Libyans strike", 2, rc != null && rc < 900 && (libInT == null || rc < libInT) ? 2 : 0, `R-cav broke at ${rc ?? "never"}s; Libyans in contact at ${libInT ?? "never"}s`);
  const curve = (s) => { const c = Array.from({ length: 10 }, (_, i) => at(s, `C-cen-${i + 1}`)); if (c.some((u) => !u)) return null; return (frontY(c[4]) + frontY(c[5])) / 2 - (frontY(c[0]) + frontY(c[9])) / 2; };
  const encT = (() => { for (const s of S) { if (s.t < 600) continue; const R = s.units.filter((u) => u.id.startsWith("R-inf") && alive(u)); if (!R.length) continue;
    const xs = R.flatMap((u) => [u.x - u.frontage / 2, u.x + u.frontage / 2]), ys = R.flatMap((u) => [u.y - u.depth / 2, u.y + u.depth / 2]);
    const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    const E = s.units.filter((e) => e.side === "C" && alive(e) && e.kind !== "light");
    const near = (e) => R.some((r) => rectDist(e, r) < 40);
    const sides = new Set(E.filter(near).map((e) => (e.y > box.y1 - 10 ? "N" : e.y < box.y0 + 10 ? "S" : e.x < box.x0 + 10 ? "W" : e.x > box.x1 - 10 ? "E" : "in")));
    if (["N", "S", "E", "W"].every((k) => sides.has(k))) return s.t; } return null; })();
  const c0 = curve(s0), concaveT = S.find((s) => (curve(s) ?? 1) <= -20)?.t ?? null;
  add("H-crescent", "History", "the crescent starts convex and bends concave before the encirclement", 3,
    (c0 != null && c0 >= 50 ? 1 : 0) + (concaveT != null ? 1 : 0) + (concaveT != null && encT != null && concaveT < encT ? 1 : 0),
    `start curvature ${c0?.toFixed(0) ?? "n/a"} m (need ≥ +50); concave (≤ −20 m) at ${concaveT ?? "never"}s; encircled at ${encT ?? "never"}s`);
  const cenAlive = Array.from({ length: 10 }, (_, i) => at(end, `C-cen-${i + 1}`)).filter(alive).length;
  add("H-centre", "History", "the Gallic/Spanish centre never breaks", 2, cenAlive >= 5 ? 2 : 0, `${cenAlive}/10 companies still standing at the end`);
  const turned = ["C-lib-W", "C-lib-E"].filter((id) => S.some((s) => { const l = at(s, id); return l && angDiff(l.heading, id.endsWith("W") ? Math.PI / 2 : -Math.PI / 2) < 0.5; }));
  add("H-libyans", "History", "the Libyans turn ~90° to face inward", 2, turned.length === 2 ? 2 : turned.length ? 1 : 0, `turned: ${turned.join(", ") || "neither"}`);
  const ra = routT("R-acav");
  // Look at the last sample BEFORE the rout: afterwards the fugitives have already run past their attacker.
  const acS = ra != null ? [...S].reverse().find((s) => s.t < ra) : null, acU = acS && (at(acS, "R-acav") || null);
  const fromBehind = acS && acU && acS.units.some((e) => e.id.startsWith("C-cav") && alive(e) && e.y > acU.y && Math.hypot(e.x - acU.x, e.y - acU.y) < 350);
  add("H-alliedcav", "History", "Varro's allied cavalry breaks when Hasdrubal hits it from behind", 2, ra != null && fromBehind ? 2 : ra != null ? 1 : 0, `R-acav broke at ${ra ?? "never"}s; Carthaginian horse behind it then: ${!!fromBehind}`);
  let west = null, east = null;
  for (const s of S) { const R = s.units.filter((u) => u.id.startsWith("R-inf") && alive(u)); if (!R.length) continue; const rear = Math.max(...R.map((u) => u.y + u.depth / 2));
    for (const e of s.units.filter((e) => e.id.startsWith("C-cav") && alive(e) && e.y > rear + 20)) { if (e.x < -250 && west == null) west = s.t; if (e.x > 250 && west != null && east == null) east = s.t; } }
  add("H-ride", "History", "Hasdrubal rides behind the whole Roman army, west to east", 2, west != null && east != null ? 2 : west != null || east != null ? 1 : 0, `behind the Roman rear on the west at ${west ?? "never"}s, then on the east at ${east ?? "never"}s`);
  add("H-encircle", "History", "the Roman infantry ends up surrounded on all four sides", 3, encT != null ? 3 : 0, encT != null ? `enemies on N, S, E and W at ${encT}s` : "never surrounded on all four sides");
  const dR = dead(end.units, "R"), dC = dead(end.units, "C");
  add("H-romandead", "History", "Roman losses are catastrophic (≥ 35,000 dead)", 2, dR >= 35000 ? 2 : dR >= 20000 ? 1 : 0, `${Math.round(dR).toLocaleString("en-US")} Roman dead`);
  add("H-ratio", "History", "Carthaginian dead ≤ 20% of Roman dead", 2, dR > 0 && dC <= 0.2 * dR ? 2 : dR > 0 && dC <= 0.35 * dR ? 1 : 0, `${Math.round(dC).toLocaleString("en-US")} Carthaginian dead (${dR ? ((dC / dR) * 100).toFixed(1) : "–"}% of Roman)`);
  const byC = {}; for (const u of end.units.filter((u) => u.side === "C")) { const k = /^C-cav/.test(u.id) ? "hasdrubal" : u.contingent === "gaul" || u.contingent === "spaniard" ? "gauls & spaniards" : u.contingent; byC[k] = (byC[k] || 0) + Math.max(0, u.men0 - u.men); }
  const top = Object.entries(byC).sort((a, b) => b[1] - a[1])[0];
  add("H-gauls", "History", "the Gauls and Spaniards take the largest share of Carthaginian losses", 2, top && top[0] === "gauls & spaniards" ? 2 : 0, Object.entries(byC).map(([k, v]) => `${k} ${Math.round(v)}`).join(", "));
  return out;
}
