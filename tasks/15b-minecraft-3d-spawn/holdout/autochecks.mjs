// Holdout autochecks for Task 15 — Minecraft-style 3D voxel demo.
// Usage: node autochecks.mjs [path-to-candidate-index.html]   (default ../src/index.html)
// Prints one JSON document to stdout: {summary, results:[{id,desc,status,detail}]}.
// status: "pass" | "fail" | "skip" (skip = needs human screenshot judgment per rubric.md).
// Exit code: 0 = ran, no fails; 1 = ran, some fails; 2 = fatal (harness itself could not run).
//
// Almost every check is programmatic. Headless Chrome was verified (this task's probe) to
// support pointer lock, synthetic MouseEvent{movementX,movementY}, and real mouse deltas under
// lock, so first-person controls / block interaction are auto-checked, not screenshot-only.
// Missing candidate or missing window.__voxel hook => every check reports fail (all-fail), no throw.

import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] ?? join(__dirname, '..', 'src', 'index.html'));
const candidateMissing = !existsSync(target);

function fatal(msg) {
  console.log(JSON.stringify({ fatal: msg, summary: null, results: [] }, null, 2));
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  fatal('playwright not installed — run: npm install  (inside holdout/)');
}

let browser = null;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
} catch {
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    fatal('no Chrome/Chromium available — run: npx playwright install chromium  (' + e.message.split('\n')[0] + ')');
  }
}

// ---------------------------------------------------------------- reporting
const results = [];
function report(id, desc, status, detail = '') { results.push({ id, desc, status, detail }); }
async function check(id, desc, fn) {
  try {
    const r = await fn();
    if (r === true) report(id, desc, 'pass');
    else if (r === false) report(id, desc, 'fail');
    else report(id, desc, r.status, r.detail || '');
  } catch (e) {
    report(id, desc, 'fail', 'checker exception: ' + String(e && e.message || e).slice(0, 300));
  }
}
const HOOK_MISSING = { status: 'fail', detail: 'window.__voxel hook missing/incomplete — cannot verify' };

// ---------------------------------------------------------------- page setup + instrumentation
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e && e.message || e).slice(0, 200)));
const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(d.type()); await d.dismiss().catch(() => {}); });
const httpRequests = [];
page.on('request', (r) => { if (/^https?:/i.test(r.url())) httpRequests.push(r.url()); });

// Instrument requestAnimationFrame (frame cadence) + requestPointerLock (lock calls) BEFORE load.
await page.addInitScript(() => {
  try {
    window.__hx = { raf: [], rpl: 0, rplTag: null };
    const oraf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = function (cb) {
      return oraf(function (t) {
        try { const a = window.__hx.raf; a.push(performance.now()); if (a.length > 5000) a.splice(0, a.length - 5000); } catch (e) {}
        return cb(t);
      });
    };
    const orpl = Element.prototype.requestPointerLock;
    if (orpl) {
      Element.prototype.requestPointerLock = function () {
        try { window.__hx.rpl++; window.__hx.rplTag = this.tagName; } catch (e) {}
        return orpl.apply(this, arguments);
      };
    }
  } catch (e) {}
});

const loadUrl = candidateMissing ? 'about:blank' : pathToFileURL(target).href;
await page.goto(loadUrl, { waitUntil: 'load' }).catch(() => {});
await page.waitForTimeout(500);

// ---------------------------------------------------------------- generic helpers
const TAU = Math.PI;
async function hasHookFn() {
  return page.evaluate(() => {
    const v = window.__voxel;
    return !!v && typeof v.blockCount === 'function' && typeof v.place === 'function' &&
      typeof v.remove === 'function' && typeof v.player === 'function';
  }).catch(() => false);
}
async function player() {
  return page.evaluate(() => {
    try { const p = window.__voxel.player(); return { x: +p.x, y: +p.y, z: +p.z, yaw: +p.yaw, pitch: +p.pitch }; }
    catch { return null; }
  }).catch(() => null);
}
async function blockCount() {
  return page.evaluate(() => { try { const n = window.__voxel.blockCount(); return typeof n === 'number' ? n : null; } catch { return null; } }).catch(() => null);
}
async function placeHook(x, y, z) {
  return page.evaluate(([x, y, z]) => { try { return { v: window.__voxel.place(x, y, z) }; } catch (e) { return { threw: String(e && e.message || e) }; } }, [x, y, z]).catch(() => ({ threw: 'evaluate failed' }));
}
async function removeHook(x, y, z) {
  return page.evaluate(([x, y, z]) => { try { return { v: window.__voxel.remove(x, y, z) }; } catch (e) { return { threw: String(e && e.message || e) }; } }, [x, y, z]).catch(() => ({ threw: 'evaluate failed' }));
}
function fwdVec(yaw, pitch) { return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]; }
async function fpsOver(seconds) {
  return page.evaluate((s) => {
    try {
      const now = performance.now(), a = window.__hx.raf; let c = 0;
      for (let i = a.length - 1; i >= 0; i--) { if (a[i] >= now - s * 1000) c++; else break; }
      return c / s;
    } catch { return 0; }
  }, seconds).catch(() => 0);
}
async function rafCount() { return page.evaluate(() => { try { return window.__hx.raf.length; } catch { return 0; } }).catch(() => 0); }

async function canvasBox() {
  return page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cw: c.width, ch: c.height };
  }).catch(() => null);
}
function clampClip(x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.round(w); h = Math.round(h);
  if (x + w > 1280) w = 1280 - x;
  if (y + h > 800) h = 800 - y;
  if (w < 2 || h < 2) return null;
  return { x, y, width: w, height: h };
}
// Screenshot a viewport clip, decode in-page, downsample to nxn, return {px:[[r,g,b]...],n} or null.
async function grabRegion(clip, n) {
  if (!clip) return null;
  let buf;
  try { buf = await page.screenshot({ clip }); } catch { return null; }
  const b64 = buf.toString('base64');
  return page.evaluate(async ({ b64, n }) => {
    try {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
      const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, n, n);
      const d = ctx.getImageData(0, 0, n, n).data; const px = [];
      for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
      return { px, n };
    } catch { return null; }
  }, { b64, n }).catch(() => null);
}
function colorStats(px) {
  const total = px.length;
  const cbuckets = new Map(); const lbuckets = new Map();
  for (const [r, g, b] of px) {
    const ck = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
    cbuckets.set(ck, (cbuckets.get(ck) || 0) + 1);
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const lk = lum >> 4;
    lbuckets.set(lk, (lbuckets.get(lk) || 0) + 1);
  }
  const csorted = [...cbuckets.values()].sort((a, b) => b - a);
  const dominantFrac = csorted[0] / total;
  const colorGe5 = csorted.filter((c) => c / total >= 0.05).length;
  const colorGe1 = csorted.filter((c) => c / total >= 0.01).length;
  const lumGe1 = [...lbuckets.values()].filter((c) => c / total >= 0.01).length;
  return { total, dominantFrac, colorGe5, colorGe1, lumGe1 };
}
function meanAbsDiff(a, b) {
  if (!a || !b) return 0;
  const n = Math.min(a.px.length, b.px.length); let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(a.px[i][0] - b.px[i][0]) + Math.abs(a.px[i][1] - b.px[i][1]) + Math.abs(a.px[i][2] - b.px[i][2]);
  return s / (n * 3);
}

// pointer-lock + input helpers
async function lockCanvas() {
  const box = await canvasBox();
  if (!box) return false;
  const cx = Math.min(1279, Math.max(1, box.x + box.w / 2));
  const cy = Math.min(799, Math.max(1, box.y + box.h / 2));
  await page.mouse.click(cx, cy).catch(() => {});
  await page.waitForTimeout(150);
  return page.evaluate(() => !!document.pointerLockElement && document.pointerLockElement.tagName === 'CANVAS').catch(() => false);
}
async function isLocked() { return page.evaluate(() => !!document.pointerLockElement).catch(() => false); }
async function ensureLocked() { return (await isLocked()) ? true : await lockCanvas(); }
async function look(dx, dy, times = 1) {
  await page.evaluate(({ dx, dy, times }) => {
    const c = document.querySelector('canvas');
    for (let i = 0; i < times; i++) {
      const ev = new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true });
      document.dispatchEvent(ev); if (c) c.dispatchEvent(ev);
    }
  }, { dx, dy, times }).catch(() => {});
  await page.waitForTimeout(15);
}
async function clickButton(btn) {
  const box = await canvasBox();
  if (box) { const cx = Math.min(1279, Math.max(1, box.x + box.w / 2)), cy = Math.min(799, Math.max(1, box.y + box.h / 2)); await page.mouse.move(cx, cy).catch(() => {}); }
  await page.mouse.down({ button: btn }).catch(() => {});
  await page.waitForTimeout(20);
  await page.mouse.up({ button: btn }).catch(() => {});
  await page.waitForTimeout(60);
}
async function levelPitch() {
  const pa = await player(); if (!pa) return;
  if (Math.abs(pa.pitch) <= 0.05) return;
  await look(0, 40, 1);
  const pb = await player(); if (!pb) return;
  const sens = pb.pitch - pa.pitch;               // pitch delta for +40 movementY
  if (!isFinite(sens) || Math.abs(sens) < 1e-4) return; // unresponsive => cannot level
  for (let i = 0; i < 80; i++) {
    const p = await player(); if (!p) return;
    if (Math.abs(p.pitch) <= 0.05) return;
    const dir = (-p.pitch / sens) > 0 ? 1 : -1;
    const mag = Math.min(160, Math.max(8, Math.abs(p.pitch / sens) * 40));
    await look(0, dir * mag, 1);
  }
}
const centerFullClip = { x: 560, y: 320, width: 160, height: 160 };

const hasHook = await hasHookFn();

// ---------------------------------------------------------------- FIRST-FRAME capture (before any interaction)
let firstFrame = null;
try {
  const box = await canvasBox();
  if (box) firstFrame = await grabRegion(clampClip(box.x, box.y, box.w, box.h), 56);
} catch {}

// instructions-before-lock (captured before any click)
let instructionsFound = null;
try {
  instructionsFound = await page.evaluate(() => {
    const t = (document.body && (document.body.innerText || document.body.textContent) || '');
    return /click|lock|wasd|\bw\s*a\s*s\s*d\b|move|mouse|arrow|drag|look/i.test(t) ? t.slice(0, 120) : '';
  });
} catch {}

// ---------------------------------------------------------------- 10s idle monitor (R01 window + R19 idle fps)
const rafAtLoad = await rafCount();
await page.waitForTimeout(10000);
const errorsFirst10s = consoleErrors.length;
const rafAfter10s = await rafCount();
const idleFps5 = await fpsOver(5);

// ================================================================ CHECKS

// --- R15 hook shape (no lock) — run early, gates most others
await check('R15', 'E15 window.__voxel exists + functional without pointer lock', async () => {
  if (!hasHook) return HOOK_MISSING;
  const bc = await blockCount();
  if (!(typeof bc === 'number' && Number.isInteger(bc) && bc >= 0)) return { status: 'fail', detail: 'blockCount() = ' + JSON.stringify(bc) };
  const p = await player();
  if (!p || ![p.x, p.y, p.z, p.yaw, p.pitch].every(Number.isFinite)) return { status: 'fail', detail: 'player() = ' + JSON.stringify(p) };
  // place/remove return booleans, never throw — probe an air cell high above
  const y = Math.floor(p.y) + 20;
  const pr = await placeHook(Math.floor(p.x), y, Math.floor(p.z));
  if (pr.threw !== undefined) return { status: 'fail', detail: 'place() threw: ' + pr.threw };
  if (typeof pr.v !== 'boolean') return { status: 'fail', detail: 'place() returned non-boolean: ' + JSON.stringify(pr.v) };
  const rr = await removeHook(Math.floor(p.x), y, Math.floor(p.z));
  if (rr.threw !== undefined) return { status: 'fail', detail: 'remove() threw: ' + rr.threw };
  if (typeof rr.v !== 'boolean') return { status: 'fail', detail: 'remove() returned non-boolean: ' + JSON.stringify(rr.v) };
  return true;
});

// --- R01 clean load + 10s
await check('R01', 'A1 zero console errors/exceptions at load + over 10s running', async () => {
  if (candidateMissing) return { status: 'fail', detail: 'no candidate file present' };
  return errorsFirst10s === 0 ? true : { status: 'fail', detail: `${errorsFirst10s} error(s) in first 10s: ` + consoleErrors.slice(0, 5).join(' | ').slice(0, 400) };
});

// --- R02 title / canvas in viewport / rAF loop
await check('R02', 'A2 <title>, canvas visible in initial viewport, render loop on rAF', async () => {
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c && c.getBoundingClientRect();
    return {
      title: (document.title || '').trim(),
      hasCanvas: !!c,
      box: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
      vis: c ? (getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden') : false,
      scrollX: window.scrollX, scrollY: window.scrollY,
    };
  }).catch(() => null);
  if (!info) return { status: 'fail', detail: 'page not evaluable' };
  if (!info.title) return { status: 'fail', detail: 'no <title>' };
  if (!info.hasCanvas || !info.box || !info.vis) return { status: 'fail', detail: 'canvas missing/hidden: ' + JSON.stringify(info) };
  const b = info.box;
  if (b.w < 50 || b.h < 50) return { status: 'fail', detail: 'canvas too small: ' + JSON.stringify(b) };
  if (b.x + b.w <= 4 || b.y + b.h <= 4 || b.x >= 1280 || b.y >= 800) return { status: 'fail', detail: 'canvas outside initial viewport: ' + JSON.stringify(b) };
  if (b.y < -4) return { status: 'fail', detail: 'canvas top above viewport: ' + JSON.stringify(b) };
  if (Math.abs(info.scrollX) > 4 || Math.abs(info.scrollY) > 4) return { status: 'fail', detail: 'page scrolled at load: ' + JSON.stringify(info) };
  const rafDelta = rafAfter10s - rafAtLoad;
  if (rafDelta < 30) return { status: 'fail', detail: `requestAnimationFrame loop not running (only ${rafDelta} frames in 10s)` };
  return true;
});

// --- R03 terrain visible, not monochrome, sky+terrain
await check('R03', 'A3 terrain on load, not monochrome (<90% one color, >=2 colors)', async () => {
  if (!firstFrame || firstFrame.px.length < 100) return { status: 'skip', detail: 'canvas not locatable/decodable on first frame — judge from screenshot' };
  const s = colorStats(firstFrame.px);
  if (s.dominantFrac > 0.90) return { status: 'fail', detail: `dominant color covers ${(s.dominantFrac * 100).toFixed(1)}% (>90% => monochrome)` };
  if (s.colorGe5 < 2) return { status: 'fail', detail: `only ${s.colorGe5} color(s) cover >=5% — sky/terrain not both present` };
  return { status: 'pass', detail: `dominant ${(s.dominantFrac * 100).toFixed(0)}%, ${s.colorGe5} colors>=5%` };
});

// --- R04 3D shading
await check('R04', 'A4 blocks read as 3D (shading / >=2 block colors, not flat silhouettes)', async () => {
  if (!firstFrame || firstFrame.px.length < 100) return { status: 'skip', detail: 'first frame not decodable — judge top-vs-side face shading from screenshot' };
  const s = colorStats(firstFrame.px);
  if (s.lumGe1 >= 3 || s.colorGe1 >= 4) return { status: 'pass', detail: `${s.lumGe1} luminance levels, ${s.colorGe1} colors (>=1%)` };
  if (s.lumGe1 === 2 || s.colorGe1 >= 2) return { status: 'skip', detail: `only ${s.lumGe1} luminance / ${s.colorGe1} color levels — judge shading from screenshot` };
  return { status: 'fail', detail: `flat: ${s.lumGe1} luminance / ${s.colorGe1} color levels` };
});

// --- R21 invalid place/remove (no lock) — run before probe (harmless, restores nothing)
await check('R21', 'G21 invalid place/remove return false, no throw, no corruption', async () => {
  if (!hasHook) return HOOK_MISSING;
  const b0 = await blockCount();
  const p = await player();
  const cases = [];
  const push = (label, res, wantFalse = true) => cases.push({ label, res, wantFalse });
  push('place far-OOB', await placeHook(1e6, 1e6, 1e6));
  push('remove far-OOB', await removeHook(1e6, 1e6, 1e6));
  push('place neg-OOB', await placeHook(-999999, -999999, -999999));
  push('remove neg-OOB', await removeHook(-999999, -999999, -999999));
  push('place NaN', await placeHook(NaN, 0, 0));
  push('remove NaN', await removeHook(NaN, 0, 0));
  push('remove air-cell', await removeHook(Math.floor(p.x), Math.floor(p.y) + 30, Math.floor(p.z)));
  for (const c of cases) {
    if (c.res.threw !== undefined) return { status: 'fail', detail: `${c.label} threw: ${c.res.threw}` };
    if (c.res.v === true) return { status: 'fail', detail: `${c.label} returned true (expected false)` };
  }
  const b1 = await blockCount();
  if (b0 !== b1) return { status: 'fail', detail: `blockCount corrupted ${b0} -> ${b1} by invalid calls` };
  return true;
});

// --- R17 hook edits remesh scene (place +1/remove -1, pixels change) — at SPAWN, no lock
await check('R17', 'E17 hook place +1 / remove -1 remesh scene (pixels change <=2 frames)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const p = await player();
  const f = fwdVec(p.yaw, p.pitch);
  const fh = fwdVec(p.yaw, 0);
  // candidate cells directly in front of spawn camera (first that is air)
  const cands = [
    [p.x + f[0] * 3, p.y + f[1] * 3, p.z + f[2] * 3],
    [p.x + f[0] * 4, p.y + f[1] * 4, p.z + f[2] * 4],
    [p.x + f[0] * 2.5, p.y + f[1] * 2.5, p.z + f[2] * 2.5],
    [p.x + fh[0] * 3, p.y + 1, p.z + fh[2] * 3],
    [p.x + fh[0] * 4, p.y + 1, p.z + fh[2] * 4],
  ].map((c) => [Math.floor(c[0]), Math.floor(c[1]), Math.floor(c[2])]);
  const before = await grabRegion(centerFullClip, 48);
  const b0 = await blockCount();
  let cell = null;
  for (const c of cands) { const r = await placeHook(c[0], c[1], c[2]); if (r.v === true) { cell = c; break; } }
  if (!cell) return { status: 'fail', detail: 'could not place a block in front of spawn camera (all candidate cells occupied/rejected)' };
  const b1 = await blockCount();
  if (b1 !== b0 + 1) { await removeHook(cell[0], cell[1], cell[2]); return { status: 'fail', detail: `place() changed blockCount ${b0} -> ${b1} (expected +1)` }; }
  await page.waitForTimeout(140);
  const afterPlace = await grabRegion(centerFullClip, 48);
  const dPlace = meanAbsDiff(before, afterPlace);
  const rr = await removeHook(cell[0], cell[1], cell[2]);
  const b2 = await blockCount();
  if (rr.v !== true || b2 !== b0) return { status: 'fail', detail: `remove() failed to restore: ret=${JSON.stringify(rr)}, blockCount ${b2} (expected ${b0})` };
  await page.waitForTimeout(140);
  const afterRemove = await grabRegion(centerFullClip, 48);
  const dRemove = meanAbsDiff(afterPlace, afterRemove);
  if (before && afterPlace && afterRemove) {
    if (dPlace > 5 || dRemove > 5) return { status: 'pass', detail: `blockCount +1/-1 ok; center pixel diff place=${dPlace.toFixed(1)} remove=${dRemove.toFixed(1)}` };
    return { status: 'skip', detail: `blockCount +1/-1 ok but center pixel change small (place=${dPlace.toFixed(1)} remove=${dRemove.toFixed(1)}) — judge remesh from screenshot` };
  }
  return { status: 'pass', detail: 'blockCount +1/-1 ok; pixels not capturable — remesh judged via R03 rendering' };
});

// --- PROBE the solid grid (feeds R05/R06/R07)
let probe = null;
if (hasHook) {
  probe = await page.evaluate(() => {
    const v = window.__voxel;
    let p; try { p = v.player(); } catch { return null; }
    const px = Math.floor(p.x), pz = Math.floor(p.z), py = p.y;
    const b0 = v.blockCount();
    const RAD = 10, yTop = Math.ceil(py) + 6, yBot = Math.floor(py) - 48;
    const surf = {}; let restoreFail = false;
    for (let x = px - RAD; x < px + RAD; x++) {
      for (let z = pz - RAD; z < pz + RAD; z++) {
        for (let y = yTop; y >= yBot; y--) {
          let rem = false; try { rem = v.remove(x, y, z); } catch (e) {}
          if (rem === true) {
            try { if (v.place(x, y, z) !== true) restoreFail = true; } catch (e) { restoreFail = true; }
            surf[x + ',' + z] = y; break;
          }
        }
      }
    }
    const b1 = v.blockCount();
    return { px, pz, py, b0, b1, restoreFail, surf, playerSurf: (surf[px + ',' + pz] ?? null) };
  }).catch(() => null);
}
function analyzeProbe() {
  if (!probe) return null;
  const keys = Object.keys(probe.surf);
  if (!keys.length) return { solidCount: 0 };
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity, minH = Infinity, maxH = -Infinity;
  for (const k of keys) {
    const [x, z] = k.split(',').map(Number); const h = probe.surf[k];
    minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z);
    minH = Math.min(minH, h); maxH = Math.max(maxH, h);
  }
  const bboxW = maxx - minx + 1, bboxD = maxz - minz + 1;
  return { solidCount: keys.length, bboxW, bboxD, filledFrac: keys.length / (bboxW * bboxD), minH, maxH, playerSurf: probe.playerSurf, py: probe.py, restoreOk: !probe.restoreFail && probe.b0 === probe.b1 };
}
const pa = analyzeProbe();

await check('R05', 'B5 >=16x16 solid-column footprint, every column solid (connected ground)', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!pa) return { status: 'fail', detail: 'probe failed (player()/hook unusable)' };
  if (pa.solidCount === 0) return { status: 'fail', detail: 'no solid columns found under/around player in probe window' };
  const d = `bbox ${pa.bboxW}x${pa.bboxD}, ${pa.solidCount} solid cols, filled ${(pa.filledFrac * 100).toFixed(0)}%`;
  if (pa.bboxW >= 16 && pa.bboxD >= 16 && pa.filledFrac >= 0.95) return { status: 'pass', detail: d };
  if (pa.solidCount >= 200) return { status: 'skip', detail: d + ' — judge footprint/connectivity from screenshot' };
  return { status: 'fail', detail: d };
});

await check('R06', 'B6 procedural height variation (max-min column height >= 2)', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!pa || pa.solidCount === 0) return { status: 'fail', detail: 'no columns probed' };
  const range = pa.maxH - pa.minH;
  return range >= 2 ? { status: 'pass', detail: `height range ${range} (min ${pa.minH}, max ${pa.maxH})` } : { status: 'fail', detail: `height range ${range} (flat slab fails; need >=2)` };
});

await check('R07', 'B7 y up; player camera eye above terrain surface', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!pa) return { status: 'fail', detail: 'probe failed' };
  const p = await player();
  if (!p || !Number.isFinite(p.y)) return { status: 'fail', detail: 'player().y not finite' };
  if (pa.playerSurf == null) {
    if (pa.minH == null) return { status: 'skip', detail: 'no surface under player column — judge from screenshot' };
    return p.y > pa.minH + 0.9 ? { status: 'pass', detail: `no col-surface; player y ${p.y.toFixed(2)} above min surface ${pa.minH}` } : { status: 'skip', detail: 'player not clearly above surface — judge from screenshot' };
  }
  if (p.y > pa.playerSurf + 0.9) return { status: 'pass', detail: `player eye y ${p.y.toFixed(2)} > surface top ${pa.playerSurf + 1}` };
  if (p.y > pa.playerSurf) return { status: 'skip', detail: `player y ${p.y.toFixed(2)} barely above surface ${pa.playerSurf} — judge from screenshot` };
  return { status: 'fail', detail: `player y ${p.y.toFixed(2)} not above surface ${pa.playerSurf} (buried / below terrain)` };
});

// --- R08 click-to-lock + Escape + instructions
await check('R08', 'C8 click canvas -> pointer lock; Escape releases; instructions before lock', async () => {
  if (!hasHook && candidateMissing) return { status: 'fail', detail: 'no candidate' };
  const box = await canvasBox();
  if (!box) return { status: 'fail', detail: 'no canvas to lock' };
  const rplBefore = await page.evaluate(() => (window.__hx && window.__hx.rpl) || 0).catch(() => 0);
  const locked = await lockCanvas();
  const rplAfter = await page.evaluate(() => ({ rpl: (window.__hx && window.__hx.rpl) || 0, tag: window.__hx && window.__hx.rplTag })).catch(() => ({ rpl: 0 }));
  const requested = rplAfter.rpl > rplBefore && rplAfter.tag === 'CANVAS';
  // Escape release is a browser (UA) guarantee, not candidate code — a synthetic Escape often
  // cannot be delivered to the UA under headless automation, so this is best-effort, never a fail.
  let released = null;
  if (locked) {
    await page.keyboard.press('Escape'); await page.waitForTimeout(120); released = !(await isLocked());
    if (!released) { await page.evaluate(() => document.exitPointerLock && document.exitPointerLock()).catch(() => {}); await page.waitForTimeout(60); } // cleanup
  }
  const escNote = released === true ? 'Escape released lock' : (released === false ? 'Escape release UA-guaranteed (not deliverable headlessly)' : 'lock requested');
  const instr = instructionsFound ? true : false;
  if (!locked && !requested) return { status: 'fail', detail: 'clicking canvas did not request/enter pointer lock' };
  if (!instr) return { status: 'skip', detail: `pointer lock ${locked ? 'engaged' : 'requested'}; ${escNote}; instructions text not auto-found (may be canvas-drawn) — judge from screenshot` };
  return { status: 'pass', detail: `click locks (${locked ? 'engaged' : 'requested'}); ${escNote}; instructions: "${String(instructionsFound).slice(0, 45)}"` };
});

// --- R09 mouse-look yaw/pitch + clamp
await check('R09', 'C9 mouse movementX yaws, movementY pitches, pitch clamped +/-pi/2', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!(await ensureLocked())) return { status: 'skip', detail: 'could not acquire pointer lock — judge mouse-look from a manual session' };
  const p0 = await player();
  await look(40, 0, 4);
  const p1 = await player();
  const yawChanged = p0 && p1 && Math.abs(p1.yaw - p0.yaw) > 1e-3;
  const py0 = await player();
  await look(0, 40, 4);
  const py1 = await player();
  const pitchChanged = py0 && py1 && Math.abs(py1.pitch - py0.pitch) > 1e-3;
  if (!yawChanged && !pitchChanged) return { status: 'skip', detail: 'synthetic mousemove did not rotate view (handler may require trusted events) — judge manually' };
  // clamp: blast big movementY both directions
  await look(0, 600, 60);
  const up = await player();
  await look(0, -600, 120);
  const down = await player();
  const eps = 1e-3;
  const clamped = up && down && Math.abs(up.pitch) <= TAU / 2 + eps && Math.abs(down.pitch) <= TAU / 2 + eps;
  const fails = [];
  if (!yawChanged) fails.push('movementX did not change yaw');
  if (!pitchChanged) fails.push('movementY did not change pitch');
  if (!clamped) fails.push(`pitch not clamped to +/-pi/2 (up=${up && up.pitch.toFixed(3)}, down=${down && down.pitch.toFixed(3)})`);
  return fails.length ? { status: 'fail', detail: fails.join('; ') } : { status: 'pass', detail: `yaw+pitch respond; pitch clamped [${down.pitch.toFixed(2)}, ${up.pitch.toFixed(2)}]` };
});

// --- R16 angle convention (yaw formula alignment at 2 orientations)
await check('R16', 'E16 reported angle convention (yaw0->-Z, forward = -sinYcosP, sinP, -cosYcosP)', async () => {
  if (!hasHook) return HOOK_MISSING;
  await ensureLocked();
  await levelPitch();
  async function alignAt() {
    const p0 = await player(); if (!p0) return null;
    await page.keyboard.down('w'); await page.waitForTimeout(450); await page.keyboard.up('w'); await page.waitForTimeout(40);
    const p1 = await player(); if (!p1) return null;
    const dx = p1.x - p0.x, dz = p1.z - p0.z, mag = Math.hypot(dx, dz);
    if (mag < 0.2) return { mag, dot: null, yaw: p0.yaw };
    const f = [-Math.sin(p0.yaw), -Math.cos(p0.yaw)]; // expected horizontal forward
    const dot = (dx / mag) * f[0] + (dz / mag) * f[1];
    return { mag, dot, yaw: p0.yaw };
  }
  const a1 = await alignAt();
  if (!a1 || a1.dot == null) return { status: 'skip', detail: 'W produced no measurable displacement — cannot verify yaw convention headlessly; judge from movement' };
  // rotate to a second orientation
  await look(120, 0, 6);
  await levelPitch();
  const a2 = await alignAt();
  const p = await player();
  const pitchOk = p && Number.isFinite(p.pitch) && Math.abs(p.pitch) <= TAU / 2 + 1e-2;
  const cos25 = Math.cos(25 * Math.PI / 180);
  const align1 = a1.dot >= cos25;
  const align2 = a2 && a2.dot != null ? a2.dot >= cos25 : null;
  if (!pitchOk) return { status: 'fail', detail: `pitch out of range: ${p && p.pitch}` };
  if (!align1) return { status: 'fail', detail: `W-displacement not aligned with reported-yaw forward (dot ${a1.dot.toFixed(2)} < ${cos25.toFixed(2)})` };
  if (align2 === false) return { status: 'fail', detail: `2nd-orientation W-displacement misaligned (dot ${a2.dot.toFixed(2)})` };
  const two = align2 === true;
  return { status: 'pass', detail: `yaw convention confirmed at ${two ? 'two orientations' : 'one orientation'} (dot ${a1.dot.toFixed(2)}${two ? ', ' + a2.dot.toFixed(2) : ''}); pitch-up sign is JUDGE-confirmable` };
});

// --- R10 WASD movement
await check('R10', 'C10 WASD moves rel. to yaw; time-based; finite; no endless fall', async () => {
  if (!hasHook) return HOOK_MISSING;
  await ensureLocked();
  await levelPitch();
  const p0 = await player();
  await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w'); await page.waitForTimeout(40);
  const pw = await player();
  if (!p0 || !pw || ![p0.x, p0.y, p0.z, pw.x, pw.y, pw.z].every(Number.isFinite)) return { status: 'fail', detail: 'position became non-finite during W' };
  const dxW = pw.x - p0.x, dzW = pw.z - p0.z, magW = Math.hypot(dxW, dzW);
  if (magW < 0.5) return { status: 'skip', detail: `W moved only ${magW.toFixed(2)} units in 0.5s (need >=0.5) — if flying/collision blocked, judge manually` };
  const f = [-Math.sin(p0.yaw), -Math.cos(p0.yaw)];
  const dotW = (dxW / magW) * f[0] + (dzW / magW) * f[1];
  if (dotW < Math.cos(30 * Math.PI / 180)) return { status: 'fail', detail: `W displacement ${(Math.acos(Math.max(-1, Math.min(1, dotW))) * 180 / Math.PI).toFixed(0)}deg off forward (>30deg)` };
  // S reverses
  const ps0 = await player();
  await page.keyboard.down('s'); await page.waitForTimeout(400); await page.keyboard.up('s'); await page.waitForTimeout(40);
  const ps = await player();
  const dxS = ps.x - ps0.x, dzS = ps.z - ps0.z, magS = Math.hypot(dxS, dzS);
  const dotS = magS > 0.2 ? ((dxS / magS) * f[0] + (dzS / magS) * f[1]) : 0;
  // A strafe roughly perpendicular; D opposite of A
  const pa0 = await player();
  await page.keyboard.down('a'); await page.waitForTimeout(400); await page.keyboard.up('a'); await page.waitForTimeout(40);
  const pAa = await player();
  const dxA = pAa.x - pa0.x, dzA = pAa.z - pa0.z, magA = Math.hypot(dxA, dzA);
  await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d'); await page.waitForTimeout(40);
  const pDd = await player();
  const dxD = pDd.x - pAa.x, dzD = pDd.z - pAa.z, magD = Math.hypot(dxD, dzD);
  const dotAD = (magA > 0.2 && magD > 0.2) ? ((dxA / magA) * (dxD / magD) + (dzA / magA) * (dzD / magD)) : null;
  // no endless fall
  await page.waitForTimeout(1000);
  const pf = await player();
  const bounded = pf && Number.isFinite(pf.y) && pf.y > -1000;
  const fails = [];
  if (magS > 0.2 && dotS > -0.5) fails.push(`S did not reverse (dot ${dotS.toFixed(2)})`);
  if (dotAD != null && dotAD > -0.3) fails.push(`A and D not opposite strafes (dot ${dotAD.toFixed(2)})`);
  if (!bounded) fails.push(`player fell out of world (y=${pf && pf.y})`);
  if (fails.length) return { status: 'fail', detail: fails.join('; ') };
  return { status: 'pass', detail: `W ${magW.toFixed(2)}u @${(Math.acos(Math.max(-1, Math.min(1, dotW))) * 180 / Math.PI).toFixed(0)}deg; S reverses; A/D strafe; y bounded` };
});

// --- R11 crosshair at center
await check('R11', 'D11 crosshair fixed at exact screen center', async () => {
  await ensureLocked();
  // DOM: small visible element centered on viewport
  const domCentered = await page.evaluate(() => {
    const cx = 640, cy = 400;
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const els = [...document.querySelectorAll('body *')].filter((el) => el.tagName !== 'CANVAS' && vis(el));
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const ecx = r.x + r.width / 2, ecy = r.y + r.height / 2;
      if (Math.abs(ecx - cx) <= 8 && Math.abs(ecy - cy) <= 8 && r.width <= 80 && r.height <= 80 && r.width >= 2 && r.height >= 2) return true;
    }
    return false;
  }).catch(() => false);
  if (domCentered) return { status: 'pass', detail: 'DOM crosshair element centered on viewport' };
  // PIXEL: 1:1 center region, center vs corners
  const reg = await grabRegion({ x: 620, y: 380, width: 40, height: 40 }, 40);
  if (!reg) return { status: 'skip', detail: 'no DOM crosshair + center not capturable — judge crosshair from screenshot' };
  const at = (r, c) => reg.px[r * 40 + c];
  const mean = (pts) => { const m = [0, 0, 0]; for (const p of pts) { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; } return m.map((v) => v / pts.length); };
  const centerPts = []; for (let r = 16; r < 24; r++) for (let c = 16; c < 24; c++) centerPts.push(at(r, c));
  const cornerPts = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { cornerPts.push(at(r, c)); cornerPts.push(at(r, 39 - c)); cornerPts.push(at(39 - r, c)); cornerPts.push(at(39 - r, 39 - c)); }
  const mc = mean(centerPts), mk = mean(cornerPts);
  const diff = Math.abs(mc[0] - mk[0]) + Math.abs(mc[1] - mk[1]) + Math.abs(mc[2] - mk[2]);
  if (diff > 24) return { status: 'pass', detail: `center mark distinct from surround (diff ${diff.toFixed(0)})` };
  return { status: 'skip', detail: `no distinct center mark detected (diff ${diff.toFixed(0)}) — crosshair may be subtle; judge from screenshot` };
});

// --- helper: stage a solid target voxel ON the center ray at ~distance d. Uses FLOOR (the voxel
// a DDA raycast traverses at floor(cam + fwd*t)) — NOT round, which lands one voxel off the ray.
async function setupTarget(d) {
  const p = await player(); if (!p) return null;
  const f = fwdVec(p.yaw, p.pitch);
  const cell = [Math.floor(p.x + f[0] * d), Math.floor(p.y + f[1] * d), Math.floor(p.z + f[2] * d)];
  const camVox = Math.floor(p.x) + ',' + Math.floor(p.y) + ',' + Math.floor(p.z);
  const tgtKey = cell.join(',');
  const seen = new Set();
  // corridor voxels along the ray (before the target) must be air so the ray reaches the target
  for (let t = 0.34; t < d - 0.05; t += 0.34) {
    const c = [Math.floor(p.x + f[0] * t), Math.floor(p.y + f[1] * t), Math.floor(p.z + f[2] * t)];
    const key = c.join(',');
    if (key === tgtKey || key === camVox || seen.has(key)) continue;
    seen.add(key);
    const rr = await removeHook(c[0], c[1], c[2]);
    if (rr.v === true) { await placeHook(c[0], c[1], c[2]); return { blocked: c }; } // solid terrain in the way
  }
  const pr = await placeHook(cell[0], cell[1], cell[2]);
  if (pr.v !== true) return { occupied: cell };
  return { cell };
}

// --- R13 left-click removes targeted block (also feeds R12 near) + pixel change
let r13NearHit = null;
await check('R13', 'D13 left-click removes exactly the targeted block; scene updates', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!(await ensureLocked())) return { status: 'skip', detail: 'no pointer lock — mouse-click removal not testable headlessly (hook -1 covered by R17); judge manually' };
  await levelPitch();
  const t = await setupTarget(4.3);
  if (!t || !t.cell) return { status: 'skip', detail: 'could not stage a target block along forward ray (corridor occupied) — judge left-click removal manually' };
  const before = await grabRegion(centerFullClip, 48);
  const b0 = await blockCount();
  await clickButton('left');
  const b1 = await blockCount();
  const stillSolid = (await removeHook(t.cell[0], t.cell[1], t.cell[2])).v === true;
  if (stillSolid) await placeHook(t.cell[0], t.cell[1], t.cell[2]); // undo our probe removal
  r13NearHit = (b1 === b0 - 1) && !stillSolid;
  await page.waitForTimeout(120);
  const after = await grabRegion(centerFullClip, 48);
  const d = meanAbsDiff(before, after);
  // cleanup: ensure target cell removed (left-click should have removed it)
  await removeHook(t.cell[0], t.cell[1], t.cell[2]);
  if (b1 !== b0 - 1) return { status: 'fail', detail: `left-click changed blockCount ${b0} -> ${b1} (expected -1)` };
  if (stillSolid) return { status: 'fail', detail: 'blockCount dropped but targeted cell still solid (removed the wrong block)' };
  if (before && after && d <= 5) return { status: 'skip', detail: `block removed (blockCount -1) but center pixels barely changed (diff ${d.toFixed(1)}) — judge remesh from screenshot` };
  return { status: 'pass', detail: `left-click removed targeted block; blockCount -1; center pixel diff ${d.toFixed(1)}` };
});

// --- R12 raycast reach [4,12]
await check('R12', 'D12 center-ray voxel raycast; reach within [4,12] blocks', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!(await ensureLocked())) return { status: 'skip', detail: 'no pointer lock — reach not testable headlessly; judge from code/screenshot' };
  await levelPitch();
  // near-hit (reach >= 4): use R13's result if available, else stage fresh
  let nearHit = r13NearHit;
  if (nearHit == null) {
    const t = await setupTarget(4.3);
    if (t && t.cell) {
      const b0 = await blockCount(); await clickButton('left'); const b1 = await blockCount();
      const still = (await removeHook(t.cell[0], t.cell[1], t.cell[2])).v === true;
      if (still) await placeHook(t.cell[0], t.cell[1], t.cell[2]);
      nearHit = b1 === b0 - 1 && !still;
      await removeHook(t.cell[0], t.cell[1], t.cell[2]);
    }
  }
  if (nearHit == null) return { status: 'skip', detail: 'could not stage a 4-block target — judge reach manually' };
  // far-miss (reach <= 12): a target whose near face is >12 must NOT be removed
  const tf = await setupTarget(13.5);
  let farHit = null;
  if (tf && tf.cell) {
    const b0 = await blockCount(); await clickButton('left'); const b1 = await blockCount();
    const still = (await removeHook(tf.cell[0], tf.cell[1], tf.cell[2])).v === true; // true => far block survived the click
    farHit = b1 === b0 - 1;              // block was removed by click => reach reached ~12.5
    if (still) await placeHook(tf.cell[0], tf.cell[1], tf.cell[2]); // restore if survived
    await removeHook(tf.cell[0], tf.cell[1], tf.cell[2]);            // cleanup
  }
  if (!nearHit) return { status: 'fail', detail: 'block ~4 units ahead was NOT removed by center-ray click (reach < 4 or ray not from center)' };
  if (farHit === null) return { status: 'skip', detail: 'near-target reach >=4 confirmed; far-target corridor unavailable — judge reach<=12 manually' };
  if (farHit === true) return { status: 'fail', detail: 'block ~12.5 units ahead WAS removed (reach > 12)' };
  return { status: 'pass', detail: 'reach >=4 (near target hit) and <=12 (far target missed); ray from screen center' };
});

// --- R14 right-click places on face + context menu suppressed
await check('R14', 'D14 right-click places one block on targeted face; no overwrite; ctx menu suppressed', async () => {
  if (!hasHook) return HOOK_MISSING;
  // context-menu suppression (lock-independent)
  const ctxPrevented = await page.evaluate(() => {
    const c = document.querySelector('canvas'); if (!c) return null;
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    c.dispatchEvent(ev);
    return ev.defaultPrevented;
  }).catch(() => null);
  if (ctxPrevented === false) return { status: 'fail', detail: 'contextmenu on canvas not preventDefault-ed (browser menu would appear)' };
  // place-on-face
  if (!(await ensureLocked())) {
    return ctxPrevented ? { status: 'skip', detail: 'context menu suppressed; right-click PLACE not testable without lock — judge manually' }
      : { status: 'skip', detail: 'no lock and contextmenu handler not detected — judge right-click place + suppression manually' };
  }
  await levelPitch();
  const t = await setupTarget(4.3);
  if (!t || !t.cell) return { status: 'skip', detail: 'could not stage a target block for right-click placement — judge manually' };
  const b0 = await blockCount();
  await clickButton('right');
  const b1 = await blockCount();
  const targetStillSolid = (await removeHook(t.cell[0], t.cell[1], t.cell[2])).v === true;
  if (targetStillSolid) await placeHook(t.cell[0], t.cell[1], t.cell[2]);
  const placedOne = b1 === b0 + 1;
  const noOverwrite = targetStillSolid; // original target must remain solid (new block went into an air cell)
  // cleanup: remove the newly placed block by removing along the corridor cells, then the target
  const p = await player(); const f = fwdVec(p.yaw, p.pitch);
  for (let k = 2; k <= 4; k++) { const c = [Math.round(p.x + f[0] * k), Math.round(p.y + f[1] * k), Math.round(p.z + f[2] * k)]; await removeHook(c[0], c[1], c[2]); }
  await removeHook(t.cell[0], t.cell[1], t.cell[2]);
  if (!placedOne) return { status: 'fail', detail: `right-click changed blockCount ${b0} -> ${b1} (expected +1)` };
  if (!noOverwrite) return { status: 'fail', detail: 'targeted block disappeared — placement overwrote a solid instead of an adjacent air cell' };
  if (ctxPrevented == null) return { status: 'pass', detail: 'right-click placed +1 into adjacent air cell (contextmenu handler not detectable but menu likely suppressed)' };
  return { status: 'pass', detail: 'right-click placed exactly +1 on targeted face; no overwrite; context menu suppressed' };
});

// --- R18 FPS counter labeled + correlates with measured
await check('R18', 'F18 live labeled FPS counter derived from real rAF timing', async () => {
  const readout = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const els = [...document.querySelectorAll('body *')].filter((el) => el.tagName !== 'CANVAS' && vis(el) && el.childElementCount === 0);
    for (const el of els) {
      const t = (el.textContent || '').trim();
      if (t.length > 0 && t.length < 40 && /fps/i.test(t)) { const m = t.match(/(\d+(?:\.\d+)?)/); if (m) return { text: t, value: parseFloat(m[1]) }; }
    }
    // label + adjacent number split across two elements
    for (const el of els) { const t = (el.textContent || '').trim(); if (/^fps\b/i.test(t) || /\bfps$/i.test(t)) return { text: t, value: NaN }; }
    return null;
  }).catch(() => null);
  if (!readout) return { status: 'skip', detail: 'no numeric /fps/ HUD readout auto-located — judge FPS counter from screenshot' };
  await page.waitForTimeout(2000);
  const measured = await fpsOver(2);
  if (!Number.isFinite(readout.value)) return { status: 'skip', detail: `found "${readout.text}" label but no parseable number — judge from screenshot (measured ~${measured.toFixed(0)})` };
  if (!(readout.value > 0 && readout.value <= 250)) return { status: 'fail', detail: `displayed FPS ${readout.value} out of (0,250]` };
  if (measured > 5 && (readout.value < 0.5 * measured || readout.value > 1.6 * measured))
    return { status: 'fail', detail: `displayed FPS ${readout.value} not correlated with measured ${measured.toFixed(0)} (likely hardcoded)` };
  return { status: 'pass', detail: `HUD "${readout.text}" ~ measured ${measured.toFixed(0)}fps` };
});

// --- R19 idle fps
await check('R19', 'F19 idle average FPS over 5s >= 30', async () => {
  const fps = idleFps5;
  if (fps >= 30) return { status: 'pass', detail: `idle ${fps.toFixed(1)} fps` };
  if (fps >= 25) return { status: 'skip', detail: `idle ${fps.toFixed(1)} fps (borderline / possible headless throttle) — judge on real hardware` };
  return { status: 'fail', detail: `idle ${fps.toFixed(1)} fps (<30)` };
});

// --- R20 25 place() calls perf + sustained fps
await check('R20', 'F20 25 place() calls < 2s, no errors, following 5s fps >= 30', async () => {
  if (!hasHook) return HOOK_MISSING;
  const errBefore = consoleErrors.length;
  const p = await player();
  // Stage: find 25 distinct AIR cells high above terrain (place() returns true), then remove them
  // so they can be re-placed for the timed run.
  const cells = await page.evaluate(([bx, bz, byBase]) => {
    const v = window.__voxel; const out = [];
    for (let layer = 0; layer < 6 && out.length < 25; layer++) {
      for (let i = 0; i < 5 && out.length < 25; i++) for (let j = 0; j < 5 && out.length < 25; j++) {
        const x = bx + i, y = byBase + layer, z = bz + j;
        let ok = false; try { ok = v.place(x, y, z); } catch (e) {}
        if (ok === true) { out.push([x, y, z]); try { v.remove(x, y, z); } catch (e) {} }
      }
    }
    return out;
  }, [Math.floor(p.x) - 2, Math.floor(p.z) - 2, Math.floor(p.y) + 10]).catch(() => []);
  if (!cells || cells.length < 25) return { status: 'fail', detail: `could not stage 25 placeable air cells (got ${cells ? cells.length : 0})` };
  // Timed run: exactly 25 fresh place() calls on the (now-empty) staged cells.
  const timing = await page.evaluate(([cells]) => {
    const v = window.__voxel; const t0 = performance.now(); let ok = 0;
    for (const c of cells) { try { if (v.place(c[0], c[1], c[2]) === true) ok++; } catch (e) {} }
    return { elapsed: performance.now() - t0, ok, n: cells.length };
  }, [cells]).catch(() => null);
  if (!timing) return { status: 'fail', detail: 'timed place() run failed' };
  await page.waitForTimeout(5000);
  const fps = await fpsOver(5);
  const errAfter = consoleErrors.length;
  // cleanup
  await page.evaluate(([cells]) => { const v = window.__voxel; for (const c of cells) { try { v.remove(c[0], c[1], c[2]); } catch (e) {} } }, [cells]).catch(() => {});
  const fails = [];
  if (timing.elapsed >= 2000) fails.push(`25 place() calls took ${timing.elapsed.toFixed(0)}ms (>=2000)`);
  if (errAfter > errBefore) fails.push(`${errAfter - errBefore} console error(s) during editing`);
  if (fps < 30) { if (fps >= 25) return { status: 'skip', detail: `post-edit fps ${fps.toFixed(1)} borderline; places ${timing.elapsed.toFixed(0)}ms — judge on hardware` }; fails.push(`post-edit fps ${fps.toFixed(1)} (<30)`); }
  if (fails.length) return { status: 'fail', detail: fails.join('; ') };
  return { status: 'pass', detail: `25 places in ${timing.elapsed.toFixed(0)}ms, 0 new errors, post-edit ${fps.toFixed(1)}fps` };
});

// --- R22 resize + background/refocus
await check('R22', 'G22 resize + tab background/refocus: no throw/error, FPS recovers', async () => {
  const errBefore = consoleErrors.length;
  let threw = false;
  try { await page.setViewportSize({ width: 1024, height: 720 }); } catch { threw = true; }
  await page.waitForTimeout(500);
  const rafA = await rafCount(); await page.waitForTimeout(700); const rafB = await rafCount();
  try { await page.setViewportSize({ width: 1280, height: 800 }); } catch { threw = true; }
  await page.waitForTimeout(300);
  // background then refocus via a second tab
  let other = null;
  try {
    other = await context.newPage(); await other.goto('about:blank'); await other.bringToFront(); await page.waitForTimeout(1200);
    await page.bringToFront(); await other.close(); other = null;
  } catch { if (other) { try { await other.close(); } catch {} } }
  await page.waitForTimeout(1000);
  const fps = await fpsOver(2);
  const readoutText = await page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')];
    for (const el of els) { const t = (el.textContent || '').trim(); if (t.length < 40 && /fps/i.test(t)) return t; }
    return '';
  }).catch(() => '');
  const errAfter = consoleErrors.length;
  const fails = [];
  if (threw) fails.push('setViewportSize threw');
  if (errAfter > errBefore) fails.push(`${errAfter - errBefore} console error(s) during resize/background`);
  if (rafB - rafA < 5) fails.push(`render loop stalled after resize (${rafB - rafA} frames)`);
  if (/NaN|Infinity/.test(readoutText)) fails.push(`FPS readout shows "${readoutText}" after refocus`);
  if (!(fps > 0)) fails.push(`no frames after refocus (fps ${fps.toFixed(1)})`);
  if (fails.length) return { status: 'fail', detail: fails.join('; ') };
  return { status: 'pass', detail: `resize+background survived; post ${fps.toFixed(1)}fps; readout "${readoutText || 'n/a'}"` };
});

// ---------------------------------------------------------------- output
await browser.close();

const order = Array.from({ length: 22 }, (_, i) => 'R' + String(i + 1).padStart(2, '0'));
results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
const summary = {
  target: candidateMissing ? '(no candidate present)' : target,
  pass: results.filter((r) => r.status === 'pass').length,
  fail: results.filter((r) => r.status === 'fail').length,
  skip: results.filter((r) => r.status === 'skip').length,
  total: results.length,
};
console.log(JSON.stringify({ summary, results }, null, 2));
process.exit(summary.fail > 0 ? 1 : 0);
