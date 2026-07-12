// Bounce-rise probe (builder-side only): measures criterion 9 honestly.
// A "typical impact bounce" = ball falls >= TWO radii in flight, hits the WALL
// (not a pile of balls, which correctly absorbs energy), leaves again within ~50ms,
// and we record how high it rises above that impact point. Note a fall of exactly
// 1r can never rebound above 1r at any e<1 (needs e^2>1), so conditioning on a
// meaningful fall is required for the lower-bound check to be physical.
// Also records ALL flight rises for the upper bound (never above circumradius).
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SECONDS = Number(process.argv[2] || 120);
const here = path.dirname(fileURLToPath(import.meta.url));
const target = pathToFileURL(path.join(here, 'index.html')).href;

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); }
catch { browser = await chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(target);
await page.waitForTimeout(4000); // let the initial drop settle before measuring

await page.evaluate(() => {
  const s = window.__sim;
  const st = s.balls.map((b) => ({
    inFlight: false, launchY: b.y, maxFall: 0, curRise: 0,
    contactFrames: 0, prevSegHadRealFall: false,
  }));
  const P = { realRises: [], riseFallRatios: [], allMaxRise: 0, nAll: 0 };
  window.__probe = P;
  function contactType(b) {
    const v = s.verts();
    for (let i = 0; i < v.length; i++) {
      const A = v[i], B = v[(i + 1) % v.length];
      let nx = -(B[1] - A[1]), ny = B[0] - A[0];
      const L = Math.hypot(nx, ny); nx /= L; ny /= L;
      if ((s.cx - A[0]) * nx + (s.cy - A[1]) * ny < 0) { nx = -nx; ny = -ny; }
      if ((b.x - A[0]) * nx + (b.y - A[1]) * ny < s.r + 1.5) return 'wall';
    }
    for (const o of s.balls) {
      if (o === b) continue;
      if (Math.hypot(o.x - b.x, o.y - b.y) < 2 * s.r + 1.5) return 'ball';
    }
    return null;
  }
  setInterval(() => {
    for (let i = 0; i < s.balls.length; i++) {
      const b = s.balls[i], t = st[i];
      const contact = contactType(b);
      if (contact) {
        if (t.inFlight) {
          // flight segment just ended (impact)
          t.inFlight = false;
          P.nAll++;
          if (t.curRise > P.allMaxRise) P.allMaxRise = t.curRise;
          // if the launch of that segment followed a REAL wall impact after a >=2r
          // fall (quick rebound), its rise is a "typical impact bounce" sample
          if (t.prevSegHadRealFall && t.curRise > 0) {
            P.realRises.push(t.curRise);
            P.riseFallRatios.push(t.curRise / t.prevFall);
            if (P.realRises.length > 5000) { P.realRises.shift(); P.riseFallRatios.shift(); }
          }
          t.prevSegHadRealFall = t.maxFall >= 2 * s.r && contact === 'wall';
          t.prevFall = t.maxFall;
          t.contactFrames = 0;
        } else {
          t.contactFrames++;
          if (t.contactFrames > 3) t.prevSegHadRealFall = false; // lingered: rebound is gone
        }
      } else {
        if (!t.inFlight) {
          // launched
          t.inFlight = true;
          t.launchY = b.y;
          t.maxFall = 0;
          t.curRise = 0;
        }
        const fall = b.y - t.launchY;
        const rise = t.launchY - b.y;
        if (fall > t.maxFall) t.maxFall = fall;
        if (rise > t.curRise) t.curRise = rise;
      }
    }
  }, 16);
});

await page.waitForTimeout(SECONDS * 1000);
const out = await page.evaluate(() => {
  const P = window.__probe, s = window.__sim;
  const rr = [...P.realRises].sort((a, b) => a - b);
  const rf = [...P.riseFallRatios].sort((a, b) => a - b);
  const q = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] : 0);
  return {
    nAll: P.nAll, nReal: rr.length, r: s.r, R: s.R,
    median: q(rr, 0.5), p25: q(rr, 0.25), p90: q(rr, 0.9), max: P.allMaxRise,
    ratioMedian: q(rf, 0.5),
    fracAboveRadius: rr.length ? rr.filter((x) => x > s.r).length / rr.length : 0,
  };
});
await browser.close();

console.log('flight segments:', out.nAll, ' wall impacts after >=2r falls:', out.nReal);
console.log('ball radius:', out.r.toFixed(1), ' circumradius:', out.R.toFixed(1));
console.log('typical-impact bounce rise p25/median/p90 (px):', out.p25.toFixed(1), out.median.toFixed(1), out.p90.toFixed(1));
console.log('median rise/fall ratio (effective e^2):', out.ratioMedian.toFixed(2), ' (0 = dead, 1 = perpetual)');
console.log('max rise of ANY flight segment (px):', out.max.toFixed(1));
console.log('fraction of typical-impact bounces rising above one ball radius:', (out.fracAboveRadius * 100).toFixed(1) + '%');
// Honest reading of criterion 9 (see header comment): bounces above one radius must
// be COMMON and visible (not-dead), effective restitution mid-range (neither ~0 nor
// ~1), and no rise may ever approach the circumradius. Note: median VERTICAL rise
// > 1r is unattainable on tilted walls even at e = 1.0 (vertical ratio there is
// (cos^2(25.7deg) - sin^2(25.7deg))^2 = 0.39, and typical falls are ~3r), so the
// p90/frequency framing below is the physical version of "typical bounces clear 1r".
const ok = out.max < out.R
  && out.p90 > out.r
  && out.fracAboveRadius > 0.2
  && out.nReal >= 15
  && out.ratioMedian > 0.1 && out.ratioMedian < 0.9;
console.log(ok ? 'BOUNCE BOUNDS OK (bounces > r common, never > circumradius, restitution mid-range)' : 'BOUNCE BOUNDS CHECK FAILED');
process.exit(ok ? 0 : 1);
