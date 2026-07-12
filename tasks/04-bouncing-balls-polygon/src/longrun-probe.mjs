// Long-run stability probe (builder-side only): samples containment, count, speeds for N seconds.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SECONDS = Number(process.argv[2] || 150);
const here = path.dirname(fileURLToPath(import.meta.url));
const target = pathToFileURL(path.join(here, 'index.html')).href;

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); }
catch { browser = await chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(target);

let minDist = Infinity, maxSpeed = 0, badCount = 0, maxRise = 0;
const start = Date.now();
while (Date.now() - start < SECONDS * 1000) {
  const s = await page.evaluate(() => {
    const s = window.__sim;
    const v = s.verts();
    let min = Infinity, vmax = 0, top = Infinity, bottom = -Infinity;
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
      if (b.y < top) top = b.y;
    }
    for (const p of v) if (p[1] > bottom) bottom = p[1];
    return { min, vmax, count: s.balls.length, riseSpan: bottom - top, t: s.t };
  });
  if (s.min < minDist) minDist = s.min;
  if (s.vmax > maxSpeed) maxSpeed = s.vmax;
  if (s.count !== 20) badCount++;
  if (s.t > 4 && s.riseSpan > maxRise) maxRise = s.riseSpan; // after initial drop
  await page.waitForTimeout(150);
}
await page.screenshot({ path: path.join(here, 'longrun.png') });
await browser.close();

console.log('duration(s):', SECONDS);
console.log('min center-to-wall dist ever (px):', minDist.toFixed(2), '(ball r ~21.1; >0 required, ~r expected)');
console.log('max speed ever (px/s):', maxSpeed.toFixed(0));
console.log('ball-count!=20 samples:', badCount);
console.log('max highest-ball height above lowest vertex after settle (px):', maxRise.toFixed(0), '(heptagon circumradius ~316.8)');
console.log('console/page errors:', errors.length ? errors.join(' | ') : 'none');
const ok = minDist > 0 && badCount === 0 && errors.length === 0 && maxSpeed < 2500;
console.log(ok ? 'LONGRUN OK' : 'LONGRUN FAIL');
process.exit(ok ? 0 : 1);
