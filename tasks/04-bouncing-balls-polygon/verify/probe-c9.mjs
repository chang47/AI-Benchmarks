// Targeted adjudication probe for criterion 9 (bounce energy bounded).
// The main harness measured "max continuous upward travel" = 415.6px > R = 396px, but that
// metric compounds: bounce + mid-air ball-ball boosts + being carried up a rotating wall.
// The spec's words are "a typical IMPACT BOUNCE rises ... NEVER above the circumradius".
// Here we measure FREE-FLIGHT rise only: upward travel accumulated solely on frames where
// the ball touches neither a wall nor another ball. Any contact closes the segment.
// Window: t > 30s (settled). Also re-records the compound ascent metric for t > 30s.
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcHtml = path.resolve(here, '..', 'src', 'index.html');
const RUN_SECONDS = Number(process.env.RUN_SECONDS || 180);

let browser;
try {
  try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
  catch { browser = await chromium.launch({ headless: true }); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => console.error('pageerror:', String(e)));
  await page.goto(pathToFileURL(srcHtml).href, { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    const sim = window.__sim;
    const cx = sim.cx, cy = sim.cy, r = sim.r, N = 7;
    const M = window.__probe9 = {
      R: sim.R, r: r,
      freeMax: 0, freeGtR: 0, freeGtRadius: 0, freeSegs: 0, topFree: [],
      compoundMax30: 0, compoundGtRadius30: 0, compoundSegs30: 0, topCompound: [],
    };
    const per = sim.balls.map((b) => ({ prevY: b.y, free: 0, comp: 0 }));
    function edges(verts) {
      const es = [];
      for (let i = 0; i < N; i++) {
        const A = verts[i], B = verts[(i + 1) % N];
        let nx = -(B[1] - A[1]), ny = B[0] - A[0];
        const L = Math.hypot(nx, ny); nx /= L; ny /= L;
        if ((cx - A[0]) * nx + (cy - A[1]) * ny < 0) { nx = -nx; ny = -ny; }
        es.push([A[0], A[1], nx, ny]);
      }
      return es;
    }
    function push(arr, v) { arr.push(v); arr.sort((a, b) => b.h - a.h); if (arr.length > 5) arr.pop(); }
    function tick() {
      const balls = sim.balls, t = sim.t;
      const es = edges(sim.verts());
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        const p = per[i];
        // contact detection
        let wallContact = false;
        for (let e = 0; e < N; e++) {
          const E = es[e];
          const d = (b.x - E[0]) * E[2] + (b.y - E[1]) * E[3];
          if (d <= r + 1) { wallContact = true; break; }
        }
        let ballContact = false;
        for (let j = 0; j < balls.length; j++) {
          if (j === i) continue;
          const c = balls[j];
          if (Math.hypot(c.x - b.x, c.y - b.y) <= 2 * r + 0.5) { ballContact = true; break; }
        }
        const contact = wallContact || ballContact;
        const dy = p.prevY - b.y; // >0 means moved UP this frame
        if (t > 30) {
          // free-flight bounce rise
          if (dy > 0 && !contact) { p.free += dy; }
          else if (p.free > 0) {
            M.freeSegs++;
            if (p.free > M.r) M.freeGtR++;
            if (p.free > M.R) M.freeGtRadius++;
            if (p.free > M.freeMax) M.freeMax = p.free;
            push(M.topFree, { h: +p.free.toFixed(1), t: +t.toFixed(1), n: b.n });
            p.free = 0;
          }
          // compound ascent (same metric as the main harness) but t>30 only
          if (dy > 0) { p.comp += dy; }
          else if (p.comp > 0) {
            M.compoundSegs30++;
            if (p.comp > M.R) M.compoundGtRadius30++;
            if (p.comp > M.compoundMax30) M.compoundMax30 = p.comp;
            push(M.topCompound, { h: +p.comp.toFixed(1), t: +t.toFixed(1), n: b.n });
            p.comp = 0;
          }
        }
        p.prevY = b.y;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  await page.waitForTimeout(RUN_SECONDS * 1000);
  const out = await page.evaluate(() => JSON.parse(JSON.stringify(window.__probe9)));
  fs.writeFileSync(path.join(here, 'round-0', 'probe-c9.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
} finally {
  if (browser) await browser.close();
}
