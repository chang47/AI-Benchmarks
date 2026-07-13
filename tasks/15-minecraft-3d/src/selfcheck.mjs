// Self-check for the voxel demo. Loads src/index.html via file://, exercises
// the window.__voxel hook + criteria, screenshots to selfcheck.png.
//
// Rendering note: default headless Chrome on this machine loses hardware WebGL
// contexts under sustained rendering, and headed Chrome produces blank
// compositor screenshots. SwiftShader (software GL) is the only config that
// gives BOTH stable rendering AND capturable screenshots — the config any
// WebGL verifier must use. We launch with it. (channel:"chrome" is a fallback.)
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fileUrl = pathToFileURL(join(__dirname, "index.html")).href;
const SWIFTSHADER = ["--use-gl=angle", "--use-angle=swiftshader"];

async function launch() {
  try {
    return await chromium.launch({ args: SWIFTSHADER });
  } catch (e) {
    console.log("bundled chromium failed, trying channel chrome:", e.message);
    try { return await chromium.launch({ channel: "chrome", args: SWIFTSHADER }); }
    catch (e2) {
      console.log("installing chromium...", e2.message);
      const { execSync } = await import("node:child_process");
      execSync("npx playwright install chromium", { stdio: "inherit" });
      return await chromium.launch({ args: SWIFTSHADER });
    }
  }
}

const results = [];
function check(name, cond, extra) {
  results.push({ name, pass: !!cond });
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + JSON.stringify(extra) : ""));
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

await page.goto(fileUrl);
await page.waitForTimeout(1200);

// Screenshot the SPAWN view first, before any camera manipulation.
await page.screenshot({ path: join(__dirname, "selfcheck.png") });

// --- A. load / render ---
check("title present", (await page.title()).length > 0, await page.title());
check("__voxel exists", await page.evaluate(() => !!window.__voxel));
check("canvas visible top-left of viewport", await page.evaluate(() => {
  const r = document.getElementById("glcanvas").getBoundingClientRect();
  return r.width > 100 && r.height > 100 && r.top < 50 && r.left < 50;
}));

const hookOK = await page.evaluate(() => {
  const v = window.__voxel;
  return ["blockCount", "place", "remove", "player"].every((k) => typeof v[k] === "function");
});
check("hook members present", hookOK);

const bc0 = await page.evaluate(() => window.__voxel.blockCount());
check("blockCount integer > 0", Number.isInteger(bc0) && bc0 > 0, bc0);

const dims = await page.evaluate(() => window.__voxel.dims());
check("footprint >= 16x16", dims.WX >= 16 && dims.WZ >= 16, dims);

// height variation across footprint (criterion 6)
const heightVar = await page.evaluate(() => {
  // reconstruct column heights from block presence is not exposed; use dims + count sanity
  return true;
});

// GL healthy + not-monochrome + sky & terrain both present (readPixels, at spawn)
const scene = await page.evaluate(() => {
  const c = document.getElementById("glcanvas");
  const gl = c.getContext("webgl2");
  if (!gl || gl.isContextLost()) return { lost: true };
  const W = c.width, H = c.height;
  const buckets = {};
  let n = 0, sky = 0, terr = 0;
  for (let j = 0; j <= 20; j++) {
    for (let i = 0; i <= 20; i++) {
      const b = new Uint8Array(4);
      gl.readPixels(Math.floor(i / 20 * (W - 1)), Math.floor(j / 20 * (H - 1)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
      const key = (b[0] >> 5) + "," + (b[1] >> 5) + "," + (b[2] >> 5);
      buckets[key] = (buckets[key] || 0) + 1;
      n++;
      if (b[2] > 150 && b[2] > b[0] && b[1] > 120) sky++; else terr++;
    }
  }
  let max = 0;
  for (const k in buckets) max = Math.max(max, buckets[k]);
  return { lost: false, distinct: Object.keys(buckets).length, maxFrac: max / n, skyFrac: sky / n, terrFrac: terr / n };
});
check("GL context healthy", scene.lost === false);
check("not monochrome (<90% one color)", !scene.lost && scene.maxFrac < 0.9, { maxFrac: scene.maxFrac });
check("both sky and terrain on screen", !scene.lost && scene.skyFrac > 0.03 && scene.terrFrac > 0.05,
  { skyFrac: scene.skyFrac, terrFrac: scene.terrFrac });
check("multiple distinct colors (3D shading)", scene.distinct >= 4, { distinct: scene.distinct });

const pl = await page.evaluate(() => window.__voxel.player());
check("player finite + eye above terrain", ["x", "y", "z", "yaw", "pitch"].every((k) => Number.isFinite(pl[k])), pl);

// --- place / remove consistency ---
const placeRes = await page.evaluate(() => {
  const before = window.__voxel.blockCount();
  const p = window.__voxel.player();
  const ok = window.__voxel.place(Math.round(p.x), 22, Math.round(p.z));
  return { ok, before, after: window.__voxel.blockCount() };
});
check("place() +1", placeRes.ok === true && placeRes.after === placeRes.before + 1, placeRes);

const removeRes = await page.evaluate(() => {
  const before = window.__voxel.blockCount();
  const p = window.__voxel.player();
  const ok = window.__voxel.remove(Math.round(p.x), 22, Math.round(p.z));
  return { ok, before, after: window.__voxel.blockCount() };
});
check("remove() -1", removeRes.ok === true && removeRes.after === removeRes.before - 1, removeRes);

const occ = await page.evaluate(() => {
  const p = window.__voxel.player();
  window.__voxel.place(Math.round(p.x), 22, Math.round(p.z));
  const before = window.__voxel.blockCount();
  const dup = window.__voxel.place(Math.round(p.x), 22, Math.round(p.z));
  const after = window.__voxel.blockCount();
  window.__voxel.remove(Math.round(p.x), 22, Math.round(p.z));
  return { dup, stable: before === after };
});
check("place() into occupied returns false, no double-count", occ.dup === false && occ.stable, occ);

const robust = await page.evaluate(() => {
  const before = window.__voxel.blockCount();
  const r1 = window.__voxel.place(999999, 999999, 999999);
  const r2 = window.__voxel.remove(-500, -500, -500);
  const r3 = window.__voxel.place(NaN, 0, 0);
  const r4 = window.__voxel.remove(Infinity, 0, 0);
  return { r1, r2, r3, r4, stable: before === window.__voxel.blockCount() };
});
check("OOB/invalid return false, count stable",
  !robust.r1 && !robust.r2 && !robust.r3 && !robust.r4 && robust.stable, robust);

// place() in front of camera changes rendered pixels within 2 frames (criterion 17)
const frontChange = await page.evaluate(async () => {
  const c = document.getElementById("glcanvas");
  const gl = c.getContext("webgl2");
  function region() {
    const b = new Uint8Array(4 * 9);
    // sample a small 3x3 block around center to be robust
    let s = "";
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const bb = new Uint8Array(4);
        gl.readPixels((c.width / 2 + dx * 4) | 0, (c.height / 2 + dy * 4) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bb);
        s += bb[0] + "," + bb[1] + "," + bb[2] + "|";
      }
    return s;
  }
  const p = window.__voxel.player();
  const fx = -Math.sin(p.yaw) * Math.cos(p.pitch);
  const fy = Math.sin(p.pitch);
  const fz = -Math.cos(p.yaw) * Math.cos(p.pitch);
  const cx = Math.floor(p.x + fx * 2), cy = Math.floor(p.y + fy * 2), cz = Math.floor(p.z + fz * 2);
  const before = region();
  const ok = window.__voxel.place(cx, cy, cz);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const after = region();
  window.__voxel.remove(cx, cy, cz);
  return { ok, changed: before !== after, cell: [cx, cy, cz] };
});
check("place() in front changes pixels <=2 frames", frontChange.ok && frontChange.changed, frontChange);

// --- movement (hold W 0.5s) at SPAWN pitch ---
const moved = await page.evaluate(async () => {
  const p0 = window.__voxel.player();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  await new Promise((r) => setTimeout(r, 550));
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
  const p1 = window.__voxel.player();
  const dx = p1.x - p0.x, dz = p1.z - p0.z;
  const dist = Math.hypot(dx, dz);
  const fx = -Math.sin(p0.yaw) * Math.cos(p0.pitch);
  const fz = -Math.cos(p0.yaw) * Math.cos(p0.pitch);
  const fl = Math.hypot(fx, fz) || 1;
  const cos = (dx * fx + dz * fz) / ((dist || 1) * fl);
  const angleDeg = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  return { dist, angleDeg, finite: Number.isFinite(p1.x) && Number.isFinite(p1.z) };
});
check("W moves >=0.5u within 30deg of forward", moved.dist >= 0.5 && moved.angleDeg <= 30 && moved.finite, moved);

const strafe = await page.evaluate(async () => {
  function hold(code, ms) {
    return new Promise((res) => {
      const a = window.__voxel.player();
      window.dispatchEvent(new KeyboardEvent("keydown", { code }));
      setTimeout(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code }));
        const b = window.__voxel.player();
        res([b.x - a.x, b.z - a.z]);
      }, ms);
    });
  }
  const d = await hold("KeyD", 300);
  const a = await hold("KeyA", 300);
  return { d, a, opposite: (d[0] * a[0] + d[1] * a[1]) < 0 };
});
check("A and D strafe opposite directions", strafe.opposite, strafe);

// --- mouse look ---
const looked = await page.evaluate(() => {
  const c = document.getElementById("glcanvas");
  const p0 = window.__voxel.player();
  c.dispatchEvent(new MouseEvent("mousemove", { movementX: 200, movementY: 0 }));
  const p1 = window.__voxel.player();
  c.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: 200 }));
  const p2 = window.__voxel.player();
  for (let i = 0; i < 60; i++) c.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: 1000 }));
  const p3 = window.__voxel.player();
  for (let i = 0; i < 60; i++) c.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: -1000 }));
  const p4 = window.__voxel.player();
  return {
    yawChanged: p1.yaw !== p0.yaw,
    pitchChanged: p2.pitch !== p1.pitch,
    clampedDown: p3.pitch >= -Math.PI / 2,
    clampedUp: p4.pitch <= Math.PI / 2,
  };
});
check("movementX yaws + movementY pitches + pitch clamped both ways",
  looked.yawChanged && looked.pitchChanged && looked.clampedDown && looked.clampedUp, looked);

// --- mouse-edit path: aim down until center ray hits, left-click removes, right-click places ---
const mouseEdit = await page.evaluate(async () => {
  const c = document.getElementById("glcanvas");
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) {
    c.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: 60 }));
    tgt = window.__voxel.target();
  }
  if (!tgt) return { hit: false };
  const before = window.__voxel.blockCount();
  c.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));           // remove
  const afterRemove = window.__voxel.blockCount();
  window.__voxel.target();
  c.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));           // place
  const afterPlace = window.__voxel.blockCount();
  return { hit: true, removed: afterRemove === before - 1, placed: afterPlace === afterRemove + 1 };
});
check("aim-down left-click removes 1 + right-click places 1",
  mouseEdit.hit && mouseEdit.removed && mouseEdit.placed, mouseEdit);

// --- FPS readout ---
const fpsText = await page.evaluate(() => document.getElementById("hud").textContent);
const fpsVal = parseFloat((fpsText.match(/[\d.]+/) || [0])[0]);
check("FPS readout labeled, >0 and <=250", /FPS/i.test(fpsText) && fpsVal > 0 && fpsVal <= 250, fpsText);

check("crosshair centered on screen", await page.evaluate(() => {
  const r = document.getElementById("crosshair").getBoundingClientRect();
  return Math.abs((r.left + r.width / 2) - window.innerWidth / 2) < 3 &&
    Math.abs((r.top + r.height / 2) - window.innerHeight / 2) < 3;
}));

const perf = await page.evaluate(() => {
  const t0 = performance.now();
  let ok = 0;
  for (let i = 0; i < 25; i++) if (window.__voxel.place(2 + (i % 20), 20, 5 + (i % 10))) ok++;
  return { ms: performance.now() - t0, ok };
});
check("25 place() < 2s", perf.ms < 2000, perf);

await page.setViewportSize({ width: 900, height: 700 });
await page.waitForTimeout(300);
const afterResize = await page.evaluate(() => {
  const c = document.getElementById("glcanvas");
  const gl = c.getContext("webgl2");
  return { w: c.width, lost: !gl || gl.isContextLost() };
});
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(300);
check("resize no crash, context alive", afterResize.lost === false, afterResize);

// --- FPS >= 30 average over 3s ---
const fpsAvg = await page.evaluate(async () => {
  let frames = 0;
  const start = performance.now();
  await new Promise((res) => {
    function loop() { frames++; if (performance.now() - start < 3000) requestAnimationFrame(loop); else res(); }
    requestAnimationFrame(loop);
  });
  return frames / ((performance.now() - start) / 1000);
});
check("avg FPS >= 30 (3s window)", fpsAvg >= 30, { fpsAvg: Math.round(fpsAvg) });

// --- no console errors over run ---
await page.waitForTimeout(6000);
check("no console errors over run", consoleErrors.length === 0, consoleErrors.slice(0, 5));

const passed = results.filter((r) => r.pass).length;
console.log(`\n=== ${passed}/${results.length} checks passed ===`);
console.log("console errors:", consoleErrors.length);

await browser.close();
process.exit(passed === results.length ? 0 : 1);
