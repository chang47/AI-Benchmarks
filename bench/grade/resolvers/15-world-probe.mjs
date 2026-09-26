// Bench-side "world probe" for task 15 (grader v2, 2026-09-26). Runs inside the grading sandbox so it
// uses the task's own playwright. Loads the candidate ONCE and re-decides the rubric items whose frozen
// check assumed something the prompt never asked for — that the player SPAWNS STANDING ON THE TERRAIN —
// plus two checks for the prompt's headline requirement the frozen rubric never graded (greedy meshing,
// one draw call per chunk). Everything goes through the documented window.__voxel hook + real input.
//
// Found 2026-09-26: Opus 4.8 built a correct 32×32 world but put the camera at z=44 looking back at
// it. The frozen probes search only around the player's column, found "no ground" and failed
// R05/R06/R17/R20 — grading the camera placement, not the world.
//
// Usage: node _bench-world-probe.mjs <index.html>  → prints { items: { R05: {status, detail}, … } }
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const SCAN = { x0: -64, x1: 96, z0: -64, z1: 96, yTop: 72, yBot: -16 };
const items = {};
const put = (id, status, detail) => (items[id] = { status, detail });

let browser;
try { browser = await chromium.launch({ channel: "chrome" }); } catch { browser = await chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// Count draw calls + vertices per animation frame, installed before any page script runs.
await page.addInitScript(() => {
  const g = (window.__benchGL = { draws: 0, verts: 0, frames: 0, lastT: null });
  const origRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => origRaf((t) => { if (t !== g.lastT) { g.frames++; g.lastT = t; } cb(t); });
  const P = window.WebGL2RenderingContext && WebGL2RenderingContext.prototype;
  if (!P) return;
  const wrap = (name, countOf) => {
    const f = P[name];
    if (!f) return;
    P[name] = function (...a) { g.draws++; g.verts += countOf(a); return f.apply(this, a); };
  };
  wrap("drawArrays", (a) => a[2]);
  wrap("drawElements", (a) => a[1]);
  wrap("drawRangeElements", (a) => a[3]);
  wrap("drawArraysInstanced", (a) => a[2] * a[3]);
  wrap("drawElementsInstanced", (a) => a[1] * a[4]);
});

const nextFrames = (n = 2) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const center = () => page.screenshot({ clip: { x: 610, y: 370, width: 60, height: 60 } });

try {
  await page.goto(pathToFileURL(process.argv[2]).href);
  await page.waitForFunction(() => window.__voxel && typeof window.__voxel.player === "function", { timeout: 10000 });
  await page.waitForTimeout(1500);

  // ---- 1. Map the whole world: surface height of every solid column (non-destructive round-trips).
  const world = await page.evaluate((S) => {
    const v = window.__voxel;
    const b0 = v.blockCount();
    const H = {};
    let restoreFail = false;
    for (let x = S.x0; x < S.x1; x++) for (let z = S.z0; z < S.z1; z++) for (let y = S.yTop; y >= S.yBot; y--) {
      let r = false; try { r = v.remove(x, y, z); } catch (e) {}
      if (r === true) { try { if (v.place(x, y, z) !== true) restoreFail = true; } catch (e) { restoreFail = true; } H[x + "," + z] = y; break; }
    }
    return { H, b0, b1: v.blockCount(), restoreFail, player: v.player() };
  }, SCAN);
  const cols = Object.keys(world.H);
  const restored = !world.restoreFail && world.b0 === world.b1;
  if (!cols.length) throw new Error("hook reported no solid columns anywhere in the scanned area");
  const xs = cols.map((k) => +k.split(",")[0]), zs = cols.map((k) => +k.split(",")[1]), hs = Object.values(world.H);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), hMin: Math.min(...hs), hMax: Math.max(...hs) };
  const p0 = world.player;
  const pc = `${Math.floor(p0.x)},${Math.floor(p0.z)}`;
  const spawnInside = pc in world.H;
  const where = `world x ${box.x0}..${box.x1}, z ${box.z0}..${box.z1}, ${cols.length} solid columns; player spawns at (${p0.x.toFixed(1)}, ${p0.y.toFixed(1)}, ${p0.z.toFixed(1)}) ${spawnInside ? "INSIDE" : "OUTSIDE"} the footprint`;

  // R05 — largest fully-solid square of columns anywhere in the world.
  const W = box.x1 - box.x0 + 1, D = box.z1 - box.z0 + 1;
  const dp = Array.from({ length: W + 1 }, () => new Array(D + 1).fill(0));
  let best = 0;
  for (let i = 1; i <= W; i++) for (let j = 1; j <= D; j++) {
    if (`${box.x0 + i - 1},${box.z0 + j - 1}` in world.H) { dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]); best = Math.max(best, dp[i][j]); }
  }
  if (!restored) put("R05", "fail", `${where}; the hook could not restore the world after probing (blockCount ${world.b0}→${world.b1})`);
  else put("R05", best >= 16 ? "pass" : "fail", `${where}; largest fully-solid square ${best}×${best} (needs ≥16×16)`);

  // R06 — height variation across the whole world.
  put("R06", box.hMax - box.hMin >= 2 ? "pass" : "fail", `surface heights ${box.hMin}..${box.hMax} (range ${box.hMax - box.hMin}, needs ≥2)`);

  // R07 — y-up camera above the terrain: above its own column if it spawns on the terrain, else above the highest block.
  const eyeOk = Number.isFinite(p0.y) && (spawnInside ? p0.y > world.H[pc] + 1 : p0.y > box.hMax + 1);
  put("R07", eyeOk ? "pass" : "fail", spawnInside
    ? `eye y ${p0.y.toFixed(2)} vs surface top ${world.H[pc] + 1} in the player's column`
    : `spawns outside the footprint; eye y ${p0.y.toFixed(2)} vs highest block top ${box.hMax + 1}`);

  // Ray helpers (same forward convention the prompt pins).
  const fwd = (p) => [-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)];
  const solidAt = (x, y, z) => { const h = world.H[`${x},${z}`]; return h !== undefined && y <= h; }; // heightmap guess, confirmed via the hook
  function castRay(p, maxD = 64) {
    const f = fwd(p);
    let prev = null;
    for (let d = 0.05; d <= maxD; d += 0.05) {
      const c = [Math.floor(p.x + f[0] * d), Math.floor(p.y + f[1] * d), Math.floor(p.z + f[2] * d)];
      if (prev && c.join() === prev.join()) continue;
      if (solidAt(...c)) return { hit: c, before: prev, dist: d };
      prev = c;
    }
    return null;
  }
  const confirmSolid = (c) => page.evaluate((c) => { const v = window.__voxel; if (v.remove(...c)) { v.place(...c); return true; } return false; }, c);

  // R17 — hook place/remove on the face the camera looks at: count ±1 and the centre pixels change.
  {
    const ray = castRay(p0);
    if (!ray || !ray.before || !(await confirmSolid(ray.hit))) put("R17", "skip", "spawn camera's centre ray does not hit the terrain within 64 units");
    else {
      const b = await page.evaluate(() => window.__voxel.blockCount());
      const s0 = await center();
      const placed = await page.evaluate((c) => window.__voxel.place(...c), ray.before);
      await nextFrames(3);
      const s1 = await center();
      const b1 = await page.evaluate(() => window.__voxel.blockCount());
      const removed = await page.evaluate((c) => window.__voxel.remove(...c), ray.before);
      await nextFrames(3);
      const s2 = await center();
      const b2 = await page.evaluate(() => window.__voxel.blockCount());
      const ok = placed === true && b1 === b + 1 && !s0.equals(s1) && removed === true && b2 === b && !s1.equals(s2);
      put("R17", ok ? "pass" : "fail", `placed at ${ray.before} (${ray.dist.toFixed(1)} u along the spawn centre ray): place ${placed}, count ${b}→${b1}, pixels ${s0.equals(s1) ? "UNCHANGED" : "changed"}; remove ${removed}, count →${b2}, pixels ${s1.equals(s2) ? "UNCHANGED" : "changed"}`);
    }
  }

  // R20 — 25 hook edits on top of the terrain in <2 s, then ≥30 fps and no new console errors.
  {
    const errs0 = consoleErrors.length;
    const cx = (box.x0 + box.x1) >> 1, cz = (box.z0 + box.z1) >> 1;
    const targets = cols.map((k) => k.split(",").map(Number)).sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz))
      .slice(0, 60).map(([x, z]) => [x, world.H[`${x},${z}`] + 1, z]);
    const r = await page.evaluate(async (targets) => {
      const v = window.__voxel, done = [];
      const t0 = performance.now();
      for (const c of targets) { if (done.length >= 25) break; if (v.place(...c) === true) done.push(c); }
      const ms = performance.now() - t0;
      const fps = await new Promise((res) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 5000) requestAnimationFrame(f); else res(n / ((performance.now() - s) / 1000)); }; requestAnimationFrame(f); });
      for (const c of done) v.remove(...c);
      return { placed: done.length, ms, fps };
    }, targets);
    const newErr = consoleErrors.length - errs0;
    const ok = r.placed === 25 && r.ms < 2000 && r.fps >= 30 && newErr === 0;
    put("R20", r.placed < 25 ? "fail" : ok ? "pass" : "fail", `${r.placed}/25 placed on the terrain surface in ${r.ms.toFixed(0)} ms; ${r.fps.toFixed(1)} fps over the next 5 s; ${newErr} new console errors`);
  }

  // G1/G2 — the prompt's headline requirement (never in the frozen rubric): one draw call per chunk + greedy meshing.
  {
    const s = await page.evaluate(() => ({ ...window.__benchGL }));
    await page.waitForTimeout(1000);
    const e = await page.evaluate(() => ({ ...window.__benchGL }));
    const frames = e.frames - s.frames;
    const drawsPerFrame = frames ? (e.draws - s.draws) / frames : null;
    const vertsPerFrame = frames ? (e.verts - s.verts) / frames : null;
    const chunks = Math.ceil(W / 16) * Math.ceil(D / 16) * Math.max(1, Math.ceil((box.hMax - Math.min(0, box.hMin) + 1) / 16));
    if (!frames) { put("G1", "skip", "no animation frames observed"); put("G2", "skip", "no animation frames observed"); }
    else {
      put("G1", drawsPerFrame <= chunks + 4 ? "pass" : "fail", `${drawsPerFrame.toFixed(1)} draw calls per frame for ~${chunks} chunk(s) (allowed: chunks + 4 for HUD/crosshair/sky)`);
      // Unmerged ("naive culled") face count from the heightmap, assuming solid columns from the world floor up:
      // tops + bottoms + every exposed side step. A mesher that only culls hidden faces draws exactly this many;
      // greedy meshing merges coplanar neighbours into bigger quads, so it draws far fewer. 6 vertices/indices per quad.
      const floor = Math.min(0, box.hMin);
      let naive = 0;
      for (const k of cols) {
        const [x, z] = k.split(",").map(Number), h = world.H[k];
        naive += 2; // top + bottom
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = world.H[`${x + dx},${z + dz}`];
          naive += Math.max(0, h - (n === undefined ? floor - 1 : n));
        }
      }
      const quads = vertsPerFrame / 6;
      put("G2", quads <= 0.6 * naive ? "pass" : "fail", `${Math.round(quads)} quads drawn per frame vs ${naive} unmerged exposed faces (${(100 * quads / naive).toFixed(0)}%; greedy meshing should be ≤60%)`);
    }
  }

  // R18 — labeled live FPS readout within 0.5×–1.6× of the rAF-measured rate (the rubric's own rule). The frozen
  // parser only reads short elements, so a multi-line HUD (FPS on one line, position on the next) came back `skip`.
  {
    const r = await page.evaluate(async () => {
      const read = () => { const m = /fps\s*[:=]?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*fps/i.exec(document.body.innerText || ""); return m ? Number(m[1] ?? m[2]) : null; };
      const measured = await new Promise((res) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - s) / 1000)); }; requestAnimationFrame(f); });
      return { shown: read(), measured };
    });
    if (r.shown == null) put("R18", "fail", `no "FPS <number>" text anywhere on the page (measured ${r.measured.toFixed(0)} fps)`);
    else {
      const ratio = r.shown / r.measured;
      put("R18", r.shown > 0 && r.shown <= 250 && ratio >= 0.5 && ratio <= 1.6 ? "pass" : "fail", `page shows FPS ${r.shown}; measured ${r.measured.toFixed(1)} fps (ratio ${ratio.toFixed(2)}, rubric allows 0.5–1.6)`);
    }
  }

  // ---- 2. Interaction (R12–R14) needs a real click with pointer lock. Walk up to the terrain first
  //         (hold W, like a player would) so there is a block within reach on the centre ray.
  {
    let p = await page.evaluate(() => window.__voxel.player());
    for (let k = 0; k < 16; k++) {
      const r = castRay(p);
      if (r && r.dist <= 6) break;
      await page.keyboard.down("KeyW"); await page.waitForTimeout(250); await page.keyboard.up("KeyW");
      await nextFrames(2);
      p = await page.evaluate(() => window.__voxel.player());
    }
    const b0 = await page.evaluate(() => window.__voxel.blockCount());
    await page.mouse.click(640, 400);
    await page.waitForTimeout(400);
    const locked = await page.evaluate(() => !!document.pointerLockElement);
    const bLock = await page.evaluate(() => window.__voxel.blockCount());
    p = await page.evaluate(() => window.__voxel.player());
    const ray = castRay(p);
    const note = bLock !== b0 ? ` (the lock click itself changed the block count ${b0}→${bLock})` : "";
    if (!locked) {
      for (const id of ["R12", "R13", "R14"]) put(id, "skip", `pointer lock not granted after clicking the canvas centre${note}`);
    } else if (!ray || ray.dist > 12 || !(await confirmSolid(ray.hit))) {
      for (const id of ["R12", "R13", "R14"]) put(id, "skip", `after walking forward, no terrain within 12 units on the centre ray${note}`);
    } else {
      // R13 — left click removes exactly the aimed block.
      const c0 = await page.evaluate(() => window.__voxel.blockCount());
      await page.mouse.down({ button: "left" }); await page.mouse.up({ button: "left" });
      await nextFrames(3);
      const c1 = await page.evaluate(() => window.__voxel.blockCount());
      const gone = !(await confirmSolid(ray.hit));
      put("R13", c1 === c0 - 1 && gone ? "pass" : "fail", `aimed at ${ray.hit} (${ray.dist.toFixed(1)} u): count ${c0}→${c1}, aimed block ${gone ? "removed" : "still there"}`);
      if (gone) await page.evaluate((c) => window.__voxel.place(...c), ray.hit);

      // R14 — right click places exactly one block on the aimed face; context menu suppressed.
      const d0 = await page.evaluate(() => window.__voxel.blockCount());
      await page.mouse.down({ button: "right" }); await page.mouse.up({ button: "right" });
      await nextFrames(3);
      const d1 = await page.evaluate(() => window.__voxel.blockCount());
      const onFace = ray.before && (await page.evaluate((c) => { const v = window.__voxel; if (v.remove(...c)) { return true; } return false; }, ray.before));
      const menu = await page.evaluate(() => { const c = document.querySelector("canvas"); const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); c.dispatchEvent(ev); return ev.defaultPrevented; });
      put("R14", d1 === d0 + 1 && onFace && menu ? "pass" : "fail", `count ${d0}→${d1}; new block ${onFace ? "is on the aimed face" : "NOT on the aimed face"} (${ray.before}); context menu ${menu ? "suppressed" : "NOT suppressed"}`);

      // R12 — reach within [4, 12]: a block ~4.5 u away on the centre ray is removable, one ~13 u away is not.
      const f = fwd(p);
      const cellAt = (d) => [Math.floor(p.x + f[0] * d), Math.floor(p.y + f[1] * d), Math.floor(p.z + f[2] * d)];
      if (ray.dist < 5) put("R12", "skip", `nearest terrain is only ${ray.dist.toFixed(1)} u away — cannot stage a 4.5 u target in air`);
      else {
        const near = cellAt(4.5);
        const staged = await page.evaluate((c) => window.__voxel.place(...c), near);
        if (!staged) put("R12", "skip", `could not stage a target at ${near} (outside the world)`);
        else {
          const e0 = await page.evaluate(() => window.__voxel.blockCount());
          await page.mouse.down({ button: "left" }); await page.mouse.up({ button: "left" });
          await nextFrames(3);
          const e1 = await page.evaluate(() => window.__voxel.blockCount());
          const nearGone = e1 === e0 - 1 && !(await confirmSolid(near));
          if (!nearGone) await page.evaluate((c) => window.__voxel.remove(...c), near);
          put("R12", nearGone ? "pass" : "fail", `target at 4.5 u ${nearGone ? "removed by a centre click" : "NOT removed by a centre click"} (upper bound ≤12 not re-tested: the frozen check covers it when staging works)`);
        }
      }
    }
  }
} catch (e) {
  for (const id of ["R05", "R06", "R07", "R12", "R13", "R14", "R17", "R18", "R20", "G1", "G2"]) if (!items[id]) put(id, "skip", `world probe error: ${String(e).slice(0, 200)}`);
}
await browser.close();
console.log(JSON.stringify({ items }));
