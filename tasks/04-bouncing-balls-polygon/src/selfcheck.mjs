// Self-check for src/index.html — loads via file://, samples the sim, screenshots.
// Run: node selfcheck.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = pathToFileURL(path.join(here, 'index.html')).href;

const EXPECTED_COLORS = ['#f8b862', '#f6ad49', '#f39800', '#f08300', '#ec6d51',
  '#ee7948', '#ed6d3d', '#ec6800', '#ec6800', '#ee7800',
  '#eb6238', '#ea5506', '#ea5506', '#eb6101', '#e49e61',
  '#e45e32', '#e17b34', '#dd7a56', '#db8449', '#d66a35'];

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' });
} catch (e) {
  console.log('[info] chrome channel failed (' + e.message.split('\n')[0] + '), using bundled chromium');
  browser = await chromium.launch();
}

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(target);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(here, 'selfcheck-early.png') });

// --- static checks ---
const info = await page.evaluate(() => {
  const s = window.__sim;
  return { count: s.balls.length, nums: s.balls.map((b) => b.n), colors: s.balls.map((b) => b.color), r: s.r, R: s.R };
});

// --- dynamic sampling: containment, rotation rate, fps ---
const t0 = await page.evaluate(() => ({ a: window.__sim.wallAngle, f: window.__sim.frames, now: performance.now() }));
let minWallDist = Infinity;
let maxSpeed = 0;
const start = Date.now();
while (Date.now() - start < 5000) {
  const c = await page.evaluate(() => {
    const s = window.__sim;
    const v = s.verts();
    let min = Infinity;
    let vmax = 0;
    for (const b of s.balls) {
      for (let i = 0; i < v.length; i++) {
        const A = v[i], B = v[(i + 1) % v.length];
        let nx = -(B[1] - A[1]), ny = B[0] - A[0];
        const L = Math.hypot(nx, ny); nx /= L; ny /= L;
        if ((s.cx - A[0]) * nx + (s.cy - A[1]) * ny < 0) { nx = -nx; ny = -ny; }
        const d = (b.x - A[0]) * nx + (b.y - A[1]) * ny;
        if (d < min) min = d;
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > vmax) vmax = sp;
    }
    return { min, vmax };
  });
  if (c.min < minWallDist) minWallDist = c.min;
  if (c.vmax > maxSpeed) maxSpeed = c.vmax;
  await page.waitForTimeout(100);
}
const t1 = await page.evaluate(() => ({ a: window.__sim.wallAngle, f: window.__sim.frames, now: performance.now() }));
const secs = (t1.now - t0.now) / 1000;
const degPerSec = ((t1.a - t0.a) * 180 / Math.PI) / secs;
const fps = (t1.f - t0.f) / secs;

// --- overlap after settling ---
await page.waitForTimeout(3000);
const maxOverlap = await page.evaluate(() => {
  const s = window.__sim;
  let m = 0;
  for (let i = 0; i < s.balls.length; i++) {
    for (let j = i + 1; j < s.balls.length; j++) {
      const a = s.balls[i], b = s.balls[j];
      const o = 2 * s.r - Math.hypot(b.x - a.x, b.y - a.y);
      if (o > m) m = o;
    }
  }
  return m;
});
const spinning = await page.evaluate(() => window.__sim.balls.some((b) => Math.abs(b.w) > 0.05));

await page.screenshot({ path: path.join(here, 'selfcheck.png') });
await browser.close();

// --- report ---
const nums = [...info.nums].sort((a, b) => a - b);
const numsOK = nums.length === 20 && nums.every((n, i) => n === i + 1);
const colorsOK = JSON.stringify(info.colors) === JSON.stringify(EXPECTED_COLORS);
const results = [
  ['ball count == 20', info.count === 20, info.count],
  ['numbers are exactly 1..20', numsOK, info.nums.join(',')],
  ['colors match spec verbatim in order', colorsOK, ''],
  ['zero console/page errors', errors.length === 0, errors.join(' | ')],
  ['containment: min center-to-wall-line dist > 0 always (want ~ball radius ' + info.r.toFixed(1) + ')', minWallDist > 0, minWallDist.toFixed(2) + ' px'],
  ['rotation ~72 deg/s (±10%)', Math.abs(degPerSec - 72) < 7.2, degPerSec.toFixed(2) + ' deg/s'],
  ['fps ~60 (>=50)', fps >= 50, fps.toFixed(1)],
  ['max ball-ball overlap after settle < 1.5 px', maxOverlap < 1.5, maxOverlap.toFixed(2) + ' px'],
  ['balls have spin (some |w| > 0.05 rad/s)', spinning, String(spinning)],
  ['max ball speed sane (< 2500 px/s)', maxSpeed < 2500, maxSpeed.toFixed(0) + ' px/s'],
];
let pass = true;
for (const [name, ok, detail] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail !== '' ? '  -> ' + detail : ''));
  if (!ok) pass = false;
}
console.log(pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
process.exit(pass ? 0 : 1);
