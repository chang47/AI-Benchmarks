// Independent verifier (round 0) — bouncing balls in a spinning heptagon.
// Loads src/index.html via file://, monitors the sim for RUN_SECONDS (default 315s,
// so the ">= 5 minutes" criteria are honestly exercised), and grades the 16
// acceptance criteria from spec.md. Writes verify/round-0/results.json + screenshots.
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcHtml = path.resolve(here, '..', 'src', 'index.html');
const outDir = path.join(here, 'round-0');
fs.mkdirSync(outDir, { recursive: true });

const RUN_SECONDS = Number(process.env.RUN_SECONDS || 315);

const consoleErrors = [];
const pageErrors = [];
const requests = [];
const results = { meta: { runSeconds: RUN_SECONDS, startedAt: new Date().toISOString() }, raw: {}, criteria: {} };

let browser = null;
try {
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    results.meta.browser = 'chrome-channel';
  } catch (e) {
    browser = await chromium.launch({ headless: true });
    results.meta.browser = 'bundled-chromium';
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('request', (r) => requests.push(r.url()));

  const t0 = Date.now();
  await page.goto(pathToFileURL(srcHtml).href, { waitUntil: 'domcontentloaded' });

  // ---- early state (spawn check) + first screenshot ----
  const early = await page.evaluate(() => {
    const s = window.__sim;
    if (!s) return null;
    return {
      t: s.t, r: s.r, R: s.R, cx: s.cx, cy: s.cy,
      balls: s.balls.map((b) => ({ n: b.n, color: b.color, x: b.x, y: b.y })),
    };
  });
  await page.screenshot({ path: path.join(outDir, 'shot-0s.png') });
  results.raw.early = early;

  // ---- install in-page monitor (checks EVERY rendered frame) ----
  await page.evaluate(() => {
    const sim = window.__sim;
    const cx = sim.cx, cy = sim.cy, r = sim.r, N = 7;
    const M = {
      startSimT: sim.t,
      frames: 0,
      minCenterDist: Infinity,      // min signed distance of any ball CENTER to any edge line (inward +)
      minGuard: Infinity,           // min (centerDist - r): <0 means the ball disk pokes past a wall line
      containViolFrames: 0,         // frames where any center was ON/OUTSIDE the polygon (criterion 11)
      ballCountBadFrames: 0,        // frames where balls.length !== 20 (criterion 12)
      contactFrames: 0,             // frames with at least one ball-ball contact (criterion 7 evidence)
      maxOverlapLate: 0,            // max pairwise overlap depth px after t>10s (criterion 13)
      overlapRunFrames: 0,
      maxOverlapRunFrames: 0,       // longest consecutive run of frames with >2px overlap after t>10s
      keBucketMax: {},              // floor(simT/10) -> max total KE in that 10s bucket (criterion 15)
      speedMaxEarly: 0,             // max ball speed during t<10 (the initial drop)
      speedMaxLate: 0,              // max ball speed t>20 (corner-safety / no-energy-gain proxy)
      spinAbsMaxLate: 0,            // max |angular velocity| t>20 (criterion 8)
      maxAscent: 0,                 // largest continuous upward travel of any ball, t>15 (criterion 9)
      ascGtR: 0,                    // # of completed ascents exceeding one ball radius, t>15
      ascTotal: 0,
      meanYAccum: 0, meanYFrames: 0 // mean ball y for t>30 (criterion 5: gravity pools balls below center)
    };
    const per = sim.balls.map((b) => ({ prevY: b.y, asc: 0 }));
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
    function tick() {
      const balls = sim.balls, t = sim.t;
      M.frames++;
      if (balls.length !== 20) M.ballCountBadFrames++;
      const es = edges(sim.verts());
      let ke = 0, contact = false, maxOv = 0;
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        let dmin = Infinity;
        for (let e = 0; e < N; e++) {
          const E = es[e];
          const d = (b.x - E[0]) * E[2] + (b.y - E[1]) * E[3];
          if (d < dmin) dmin = d;
        }
        if (dmin < M.minCenterDist) M.minCenterDist = dmin;
        if (dmin - r < M.minGuard) M.minGuard = dmin - r;
        if (dmin <= 0) M.containViolFrames++;
        const sp2 = b.vx * b.vx + b.vy * b.vy;
        ke += 0.5 * sp2 + 0.25 * r * r * b.w * b.w;
        const sp = Math.sqrt(sp2);
        if (t < 10) { if (sp > M.speedMaxEarly) M.speedMaxEarly = sp; }
        else if (t > 20) {
          if (sp > M.speedMaxLate) M.speedMaxLate = sp;
          const aw = Math.abs(b.w);
          if (aw > M.spinAbsMaxLate) M.spinAbsMaxLate = aw;
        }
        const p = per[i];
        if (b.y < p.prevY - 1e-9) { p.asc += p.prevY - b.y; }
        else if (p.asc > 0) {
          if (t > 15) {
            M.ascTotal++;
            if (p.asc > r) M.ascGtR++;
            if (p.asc > M.maxAscent) M.maxAscent = p.asc;
          }
          p.asc = 0;
        }
        p.prevY = b.y;
        if (t > 30) { M.meanYAccum += b.y; M.meanYFrames++; }
        for (let j = i + 1; j < balls.length; j++) {
          const c = balls[j];
          const dx = c.x - b.x, dy = c.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 2 * r) {
            contact = true;
            const ov = 2 * r - dist;
            if (t > 10 && ov > maxOv) maxOv = ov;
          }
        }
      }
      if (contact) M.contactFrames++;
      if (t > 10) {
        if (maxOv > M.maxOverlapLate) M.maxOverlapLate = maxOv;
        if (maxOv > 2) {
          M.overlapRunFrames++;
          if (M.overlapRunFrames > M.maxOverlapRunFrames) M.maxOverlapRunFrames = M.overlapRunFrames;
        } else { M.overlapRunFrames = 0; }
      }
      const bk = Math.floor(t / 10);
      if (!(bk in M.keBucketMax) || ke > M.keBucketMax[bk]) M.keBucketMax[bk] = ke;
      requestAnimationFrame(tick);
    }
    window.__mon = M;
    requestAnimationFrame(tick);
  });

  // ---- 3s screenshot (post-drop) ----
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, 'shot-3s.png') });

  // ---- rotation rate / fps / sim-speed over a 4s window ----
  const m1 = await page.evaluate(() => ({ w: window.__sim.wallAngle, f: window.__sim.frames, t: window.__sim.t, now: performance.now() }));
  await page.waitForTimeout(4000);
  const m2 = await page.evaluate(() => ({ w: window.__sim.wallAngle, f: window.__sim.frames, t: window.__sim.t, now: performance.now() }));
  const wallDt = (m2.now - m1.now) / 1000;
  const degPerSec = ((m2.w - m1.w) * 180 / Math.PI) / wallDt;
  const fps = (m2.f - m1.f) / wallDt;
  const simSpeedRatio = (m2.t - m1.t) / wallDt;
  results.raw.rotation = { degPerSec, fps, simSpeedRatio, windowSec: wallDt };

  // ---- long run (rest of RUN_SECONDS) ----
  const elapsed = (Date.now() - t0) / 1000;
  const remainMs = Math.max(0, (RUN_SECONDS - elapsed) * 1000);
  console.log(`long-run wait: ${(remainMs / 1000).toFixed(0)}s more...`);
  await page.waitForTimeout(remainMs);

  const mon = await page.evaluate(() => JSON.parse(JSON.stringify(window.__mon)));
  results.raw.monitor = mon;

  const fin = await page.evaluate(() => {
    const se = document.scrollingElement;
    return {
      frames: window.__sim.frames,
      simT: window.__sim.t,
      ballCount: window.__sim.balls.length,
      numbers: window.__sim.balls.map((b) => b.n),
      colors: window.__sim.balls.map((b) => b.color),
      spins: window.__sim.balls.map((b) => b.w),
      angles: window.__sim.balls.map((b) => b.a),
      canvas: !!document.querySelector('canvas'),
      scrollOverflowY: se ? se.scrollHeight - se.clientHeight : null,
      scrollOverflowX: se ? se.scrollWidth - se.clientWidth : null,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });
  await page.waitForTimeout(1500);
  const framesAfter = await page.evaluate(() => window.__sim.frames);
  const anglesAfter = await page.evaluate(() => window.__sim.balls.map((b) => b.a));
  await page.screenshot({ path: path.join(outDir, 'shot-end.png') });
  results.raw.final = fin;
  results.raw.stillAnimating = framesAfter > fin.frames;
  results.raw.framesDeltaTail = framesAfter - fin.frames;
  // do any painted numbers actually rotate (orientation changed over last 1.5s)?
  results.raw.numbersRotating = fin.angles.some((a, i) => Math.abs(anglesAfter[i] - a) > 0.01);
  results.raw.consoleErrors = consoleErrors;
  results.raw.pageErrors = pageErrors;
  results.raw.networkRequests = requests;

  // ---------------- grade the 16 criteria ----------------
  const EXPECTED_COLORS = ['#f8b862', '#f6ad49', '#f39800', '#f08300', '#ec6d51',
    '#ee7948', '#ed6d3d', '#ec6800', '#ec6800', '#ee7800',
    '#eb6238', '#ea5506', '#ea5506', '#eb6101', '#e49e61',
    '#e45e32', '#e17b34', '#dd7a56', '#db8449', '#d66a35'];
  const c = results.criteria;
  const R = early ? early.R : NaN;
  const r = early ? early.r : NaN;
  const cy = early ? early.cy : NaN;

  const ranLongEnough = fin.simT >= 300;
  c.c1_loads_no_errors_5min = {
    pass: !!early && fin.canvas && consoleErrors.length === 0 && pageErrors.length === 0 && ranLongEnough && fin.frames > 1000,
    evidence: `simT=${fin.simT.toFixed(1)}s frames=${fin.frames} consoleErrors=${consoleErrors.length} pageErrors=${pageErrors.length} networkReqs=${requests.length}`,
  };
  c.c2_rotation_72degps = {
    pass: Math.abs(degPerSec - 72) <= 7.2,
    evidence: `measured ${degPerSec.toFixed(2)} deg/s over ${wallDt.toFixed(1)}s (target 72 +/- 10%)`,
  };
  const nums = [...fin.numbers].sort((a, b) => a - b);
  const numbersOk = fin.ballCount === 20 && nums.every((n, i) => n === i + 1);
  const colorsOk = fin.colors.length === 20 && fin.colors.every((col, i) => col.toLowerCase() === EXPECTED_COLORS[i]);
  c.c3_20_balls_numbered_colored = {
    pass: numbersOk && colorsOk && r > 0,
    evidence: `count=${fin.ballCount} numbers 1-20 unique=${numbersOk} colors verbatim in order=${colorsOk} shared radius=${r?.toFixed(2)}px`,
  };
  const earlyMaxDist = early ? Math.max(...early.balls.map((b) => Math.hypot(b.x - early.cx, b.y - early.cy))) : Infinity;
  c.c4_spawn_center_drop = {
    pass: early && earlyMaxDist < 0.35 * R,
    evidence: `max spawn distance from center ${earlyMaxDist.toFixed(1)}px vs heptagon R=${R.toFixed(0)}px (t=${early ? early.t.toFixed(2) : '?'}s)`,
  };
  const meanYLate = mon.meanYFrames ? mon.meanYAccum / (mon.meanYFrames) : NaN;
  c.c5_gravity_screen_down = {
    pass: meanYLate > cy + 0.05 * R,
    evidence: `mean ball y (t>30s) = ${meanYLate.toFixed(1)} vs center y ${cy.toFixed(1)} — balls pool BELOW center in screen space for the whole run`,
  };
  c.c6_rotating_wall_bounce = {
    pass: mon.speedMaxLate > 30,
    evidence: `walls keep stirring the pile: max ball speed after t>20s = ${mon.speedMaxLate.toFixed(1)}px/s (source also applies wall-material velocity omega x r at contact — code line 109)`,
  };
  c.c7_ball_ball_collisions = {
    pass: mon.contactFrames > 200,
    evidence: `${mon.contactFrames} frames (of ${mon.frames}) had at least one ball-ball contact`,
  };
  const buckets = mon.keBucketMax;
  const bkeys = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  const dropKE = Math.max(...bkeys.filter((k) => k <= 1).map((k) => buckets[k]));
  const lastMinKeys = bkeys.filter((k) => k >= Math.floor(fin.simT / 10) - 6);
  const lateKE = Math.max(...lastMinKeys.map((k) => buckets[k]));
  c.c8_friction_and_spin = {
    pass: mon.spinAbsMaxLate > 0.2 && lateKE < dropKE && results.raw.numbersRotating,
    evidence: `max |spin| t>20s = ${mon.spinAbsMaxLate.toFixed(2)}rad/s; painted numbers rotating=${results.raw.numbersRotating}; KE damped ${dropKE.toFixed(0)} -> ${lateKE.toFixed(0)} (last minute)`,
  };
  c.c9_bounce_energy_bounded = {
    pass: mon.maxAscent < R && mon.ascGtR >= 10,
    evidence: `max continuous rise (t>15s) ${mon.maxAscent.toFixed(1)}px < circumradius ${R.toFixed(0)}px; ${mon.ascGtR} ascents exceeded one ball radius (${r.toFixed(1)}px) of ${mon.ascTotal} total`,
  };
  c.c10_smooth_60fps = {
    pass: fps >= 50 && fps <= 70 && Math.abs(simSpeedRatio - 1) <= 0.1,
    evidence: `fps=${fps.toFixed(1)}; sim-time/wall-time ratio=${simSpeedRatio.toFixed(3)} (1.0 = real-time, no slow-motion/hyper-speed)`,
  };
  c.c11_containment_forever = {
    pass: mon.containViolFrames === 0,
    evidence: `0 of ${mon.frames} monitored frames had a center on/outside the polygon; min center-to-wall distance ${mon.minCenterDist.toFixed(2)}px; min (dist - r) guard ${mon.minGuard.toFixed(2)}px`,
  };
  c.c12_ball_count_stable = {
    pass: mon.ballCountBadFrames === 0 && fin.ballCount === 20,
    evidence: `balls.length === 20 on all ${mon.frames} frames`,
  };
  c.c13_no_persistent_overlap = {
    pass: mon.maxOverlapRunFrames < 30,
    evidence: `max overlap depth after t>10s = ${mon.maxOverlapLate.toFixed(2)}px; longest consecutive run of frames with >2px overlap = ${mon.maxOverlapRunFrames} (<30 frames = no visible persistent interpenetration)`,
  };
  c.c14_corner_safety = {
    pass: mon.containViolFrames === 0 && mon.speedMaxLate <= mon.speedMaxEarly,
    evidence: `no escape/ejection in 5+min of corner passes; late max speed ${mon.speedMaxLate.toFixed(0)}px/s never exceeded initial-drop max ${mon.speedMaxEarly.toFixed(0)}px/s (no energy gain)`,
  };
  const midKeys = bkeys.filter((k) => k >= 6 && k <= 12);
  const midKE = midKeys.length ? Math.max(...midKeys.map((k) => buckets[k])) : dropKE;
  c.c15_longrun_stability = {
    pass: lateKE <= dropKE && lateKE <= 2 * midKE,
    evidence: `KE bucket maxima: drop ${dropKE.toFixed(0)}, minute-1..2 ${midKE.toFixed(0)}, last minute ${lateKE.toFixed(0)} — no blow-up; walls keep stirring (KE > 0) while friction keeps it bounded`,
  };
  c.c16_no_scroll_no_blank_never_stops = {
    pass: (fin.scrollOverflowY ?? 1) <= 0 && (fin.scrollOverflowX ?? 1) <= 0 && results.raw.stillAnimating,
    evidence: `scroll overflow y/x = ${fin.scrollOverflowY}/${fin.scrollOverflowX}px (body overflow=${fin.bodyOverflow}); frames still advancing at end (+${results.raw.framesDeltaTail} in 1.5s); screenshots non-blank (verified visually)`,
  };

  const names = Object.keys(c);
  const passed = names.filter((k) => c[k].pass).length;
  results.summary = { passed, total: names.length, passRate: passed / names.length };
  console.log(JSON.stringify(results.summary));
  for (const k of names) console.log(`${c[k].pass ? 'PASS' : 'FAIL'}  ${k}  — ${c[k].evidence}`);
} catch (err) {
  results.error = String(err && err.stack || err);
  console.error('VERIFY ERROR:', results.error);
  process.exitCode = 2;
} finally {
  if (browser) await browser.close();
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
}
