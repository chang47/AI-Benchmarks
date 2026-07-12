// Independent verifier — round 0 — task 06-solar-system
// Checks the 19 spec acceptance criteria against src/index.html as-is.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(here, "..", "src", "index.html");
const outDir = path.join(here, "round-0");
fs.mkdirSync(outDir, { recursive: true });

const results = [];
function record(id, name, pass, evidence) {
  results.push({ id, name, pass: !!pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} [${id}] ${name} :: ${evidence}`);
}

const SIZE_ORDER = ["Jupiter", "Saturn", "Uranus", "Neptune", "Earth", "Venus", "Mars", "Mercury"];
const SUN_ORDER = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];

let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
  console.log("launched: chrome channel");
} catch (e) {
  console.log("chrome channel failed (" + e.message.split("\n")[0] + "), falling back to bundled chromium");
  browser = await chromium.launch();
}

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
const pageErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => pageErrors.push(String(e)));

const t0 = Date.now();
await page.goto(pathToFileURL(indexPath).href);
await page.waitForTimeout(400); // let a few frames run
await page.screenshot({ path: path.join(outDir, "shot-0s.png") });

async function snap() {
  return page.evaluate(() => {
    const s = window.solarSystem;
    const hud = document.getElementById("fps-hud");
    const c = document.querySelector("canvas");
    const r = c ? c.getBoundingClientRect() : null;
    return {
      t: performance.now(),
      title: document.title,
      hudText: hud ? hud.textContent : null,
      hudRect: hud ? hud.getBoundingClientRect().toJSON() : null,
      canvas: c ? { w: c.width, h: c.height, rect: { x: r.x, y: r.y, w: r.width, h: r.height } } : null,
      scroll: {
        sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
        iw: window.innerWidth, ih: window.innerHeight
      },
      bodyBg: getComputedStyle(document.body).backgroundColor,
      state: s ? {
        fps: s.fps,
        fpsType: typeof s.fps,
        planetCount: Array.isArray(s.planets) ? s.planets.length : -1,
        planets: (s.planets || []).map((p) => ({
          name: p.name, orbitRadius: p.orbitRadius, displayRadius: p.displayRadius,
          angle: p.angle, periodSeconds: p.periodSeconds
        }))
      } : null
    };
  });
}

const s0 = await snap();

// ---- 5-second HUD sampling every 500 ms (criteria 15, 16); screenshot at ~3 s
const hudSamples = [];
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(500);
  const h = await page.evaluate(() => ({
    text: document.getElementById("fps-hud")?.textContent ?? null,
    fps: window.solarSystem?.fps
  }));
  hudSamples.push(h);
  if (i === 4) await page.screenshot({ path: path.join(outDir, "shot-3s.png") });
}
const s1 = await snap();

// ---- Pixel probes: planets drawn at state positions, sun at center, dark corner (atomic evaluate)
const pix = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const ctx = c.getContext("2d");
  const s = window.solarSystem;
  const cx = c.width / 2, cy = c.height / 2;
  const probe = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
  return {
    planets: s.planets.map((p) => {
      const x = cx + p.orbitRadius * Math.cos(p.angle);
      const y = cy + p.orbitRadius * Math.sin(p.angle);
      return { name: p.name, x: Math.round(x), y: Math.round(y), rgba: probe(x, y) };
    }),
    center: probe(cx, cy),
    corner: probe(3, 3)
  };
});

// ---- Real rAF rate, to cross-check the page's own FPS number (criterion 14)
const rafProbe = await page.evaluate(() => new Promise((res) => {
  let n = 0; let start;
  function cb(t) {
    if (start === undefined) start = t;
    else n++;
    if (t - start < 1000) requestAnimationFrame(cb);
    else res({ rafFps: (n * 1000) / (t - start), pageFps: window.solarSystem.fps });
  }
  requestAnimationFrame(cb);
}));

// ---- HUD refresh rate via MutationObserver (criterion 15: >= 4 refreshes/sec)
const hudMutations = await page.evaluate(() => new Promise((res) => {
  const hud = document.getElementById("fps-hud");
  let n = 0;
  const mo = new MutationObserver((muts) => { n += muts.length; });
  mo.observe(hud, { childList: true, characterData: true, subtree: true });
  setTimeout(() => { mo.disconnect(); res(n); }, 1000);
}));

// ---- HUD-vs-hook same-frame agreement (criterion 17: fps = HUD value before rounding)
const agree = await page.evaluate(() => {
  const hudVal = parseFloat(document.getElementById("fps-hud").textContent.replace(/^FPS:\s*/, ""));
  return { hudVal, hookFps: window.solarSystem.fps, diff: Math.abs(hudVal - window.solarSystem.fps) };
});

// ---- Criterion 18: simulate a background pause by stalling the main thread 2.5 s
const preBlock = await page.evaluate(() => ({
  t: performance.now(),
  mercuryAngle: window.solarSystem.planets[0].angle
}));
await page.evaluate(() => {
  const start = performance.now();
  while (performance.now() - start < 2500) { /* stall: rAF cannot fire */ }
});
await page.waitForTimeout(700); // let it resume and re-measure
const postBlock = await page.evaluate(() => ({
  t: performance.now(),
  mercuryAngle: window.solarSystem.planets[0].angle,
  hudText: document.getElementById("fps-hud").textContent,
  fps: window.solarSystem.fps
}));
const resumeSamples = [];
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(350);
  resumeSamples.push(await page.evaluate(() => ({
    hudText: document.getElementById("fps-hud").textContent,
    fps: window.solarSystem.fps
  })));
}

// ---- Criterion 19: resize must not throw
const errsBeforeResize = consoleErrors.length + pageErrors.length;
await page.setViewportSize({ width: 900, height: 600 });
await page.waitForTimeout(300);
await page.setViewportSize({ width: 1500, height: 950 });
await page.waitForTimeout(300);
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(400);
const errsAfterResize = consoleErrors.length + pageErrors.length;
const postResize = await snap();

// make sure total animated observation time exceeds 10 s for criterion 1
const elapsed = Date.now() - t0;
if (elapsed < 11000) await page.waitForTimeout(11000 - elapsed);

// ============================ EVALUATE CRITERIA ============================
const P = s1.state?.planets ?? [];
const names = P.map((p) => p.name);

// C1 zero console errors / uncaught exceptions over >= 10 s
record(1, "Zero console errors & uncaught exceptions over 10+ s",
  consoleErrors.length === 0 && pageErrors.length === 0,
  `consoleErrors=${consoleErrors.length}, pageErrors=${pageErrors.length}, observed ${(Date.now() - t0) / 1000}s` +
  (consoleErrors[0] ? ` first="${consoleErrors[0]}"` : "") + (pageErrors[0] ? ` firstPage="${pageErrors[0]}"` : ""));

// C2 auto-start (no interaction was performed; angles must have advanced)
const merc0 = s0.state?.planets?.[0]?.angle, merc1 = s1.state?.planets?.[0]?.angle;
const angleMoved = merc0 !== undefined && merc1 !== undefined && Math.abs(merc1 - merc0) > 0.05;
record(2, "Animation auto-starts without interaction", angleMoved,
  `Mercury angle ${merc0?.toFixed(3)} -> ${merc1?.toFixed(3)} over ~${((s1.t - s0.t) / 1000).toFixed(1)}s with zero input events`);

// C3 canvas visible in 1280x800 viewport, no scroll, whole system fits inside canvas
const cRect = s1.canvas?.rect;
const noScroll = s1.scroll.sw <= s1.scroll.iw + 1 && s1.scroll.sh <= s1.scroll.ih + 1;
const canvasInViewport = cRect && cRect.x >= -1 && cRect.y >= -1 && cRect.x + cRect.w <= 1281 && cRect.y + cRect.h <= 801;
const maxOrbit = Math.max(...P.map((p) => p.orbitRadius));
const outermostP = P[P.length - 1];
const fits = s1.canvas && (maxOrbit + (outermostP?.displayRadius ?? 0)) <= Math.min(s1.canvas.w, s1.canvas.h) / 2;
record(3, "Canvas visible at 1280x800 w/o scrolling; outermost orbit fits inside canvas",
  noScroll && canvasInViewport && fits,
  `canvas ${s1.canvas?.w}x${s1.canvas?.h} at (${cRect?.x},${cRect?.y}), scroll ${s1.scroll.sw}x${s1.scroll.sh} vs viewport ${s1.scroll.iw}x${s1.scroll.ih}, maxOrbit+disc=${(maxOrbit + (outermostP?.displayRadius ?? 0)).toFixed(0)}px vs halfMin=${Math.min(s1.canvas?.w ?? 0, s1.canvas?.h ?? 0) / 2}px`);

// C4 title + dark background (computed body bg + actual canvas corner pixel)
const bgMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s1.bodyBg || "");
const bgDark = bgMatch && (+bgMatch[1] + +bgMatch[2] + +bgMatch[3]) < 150;
const cornerDark = pix.corner[0] + pix.corner[1] + pix.corner[2] < 180;
record(4, "Has <title> and dark space-like background",
  !!s1.title && s1.title.length > 0 && bgDark && cornerDark,
  `title="${s1.title}", body bg=${s1.bodyBg}, canvas corner rgba=[${pix.corner}]`);

// C5 exactly 9 bodies: sun + the 8 planets with exact names (hook + visual for labels)
const namesOk = names.length === 8 && SUN_ORDER.every((n, i) => names[i] === n);
record(5, "Exactly Sun + 8 correctly-named planets (hook order check; labels judged on screenshots)",
  namesOk, `hook planets=[${names.join(", ")}]`);

// C6 sun at center, not orbiting: bright center pixel at two times + hook orbits centered on it
const sunBright = pix.center[0] > 180 && pix.center[1] > 120;
record(6, "Sun at center and does not orbit", sunBright,
  `canvas-center pixel rgba=[${pix.center}] (bright sun color) at t~6s; planet positions computed around canvas center`);

// C7 labels adjacent to bodies — judged visually on the two screenshots (recorded after human/vision review)
// placeholder set below after screenshot review — default from geometry: label drawn at disc bottom edge + 4px
record(7, "Every body labeled, labels track within ~30 px (visual check)", null, "JUDGED FROM SCREENSHOTS — see VERIFY.md");

// C8 planets are filled discs >= 2 px, individually visible (hook radii + pixel probes)
const minDisp = Math.min(...P.map((p) => p.displayRadius));
const bg = [5, 7, 15];
const allDrawn = pix.planets.every((pp) => {
  const d = Math.abs(pp.rgba[0] - bg[0]) + Math.abs(pp.rgba[1] - bg[1]) + Math.abs(pp.rgba[2] - bg[2]);
  return d > 40; // pixel at planet center differs clearly from background
});
record(8, "All 8 planets drawn as filled discs, radius >= 2 px", minDisp >= 2 && allDrawn,
  `min displayRadius=${minDisp}px; pixel probe at each planet center non-background for ${pix.planets.filter((pp) => Math.abs(pp.rgba[0] - 5) + Math.abs(pp.rgba[1] - 7) + Math.abs(pp.rgba[2] - 15) > 40).length}/8`);

// C9 orbit radii strictly increasing, >= 10 px apart, not stacked at origin
let radiiOk = P.length === 8;
let minGap = Infinity;
for (let i = 1; i < P.length; i++) {
  const gap = P[i].orbitRadius - P[i - 1].orbitRadius;
  minGap = Math.min(minGap, gap);
  if (gap <= 0) radiiOk = false;
}
const notAtOrigin = P.every((p) => p.orbitRadius > 20);
record(9, "Orbit radii strictly increasing, distinct (>=10 px), planets not stacked at center",
  radiiOk && minGap >= 10 && notAtOrigin,
  `radii=[${P.map((p) => p.orbitRadius.toFixed(1)).join(", ")}], min gap=${minGap.toFixed(1)}px`);

// C10 size ordering strict: J > S > U > N > E > V > Ma > Me, Sun > Jupiter
const byName = Object.fromEntries(P.map((p) => [p.name, p]));
let sizeOk = true;
for (let i = 1; i < SIZE_ORDER.length; i++) {
  if (!(byName[SIZE_ORDER[i - 1]]?.displayRadius > byName[SIZE_ORDER[i]]?.displayRadius)) sizeOk = false;
}
// Sun vs Jupiter: sun radius not in hook; probe: center pixel bright over radius > jupiter's? Use visual + code const.
// Estimate sun radius by scanning pixels rightward from center until non-sun color.
const sunRadiusPx = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const ctx = c.getContext("2d");
  const cx = Math.round(c.width / 2), cy = Math.round(c.height / 2);
  const row = ctx.getImageData(cx, cy, Math.min(200, c.width - cx), 1).data;
  let r = 0;
  for (let i = 0; i < row.length / 4; i++) {
    const R = row[i * 4], G = row[i * 4 + 1], B = row[i * 4 + 2];
    if (R > 200 && G > 150 && B < 160) r = i; else if (i - r > 6) break;
  }
  return r;
});
const jup = byName["Jupiter"]?.displayRadius ?? Infinity;
record(10, "Size ordering strict (J>S>U>N>E>V>Ma>Me) and Sun > Jupiter",
  sizeOk && sunRadiusPx > jup,
  `displayRadii ${SIZE_ORDER.map((n) => `${n}=${byName[n]?.displayRadius}`).join(", ")}; measured Sun core radius ~${sunRadiusPx}px vs Jupiter ${jup}px`);

// C11 speed ordering strict, Mercury period <= ~20 s, Neptune visibly moves
let periodOk = true;
for (let i = 1; i < P.length; i++) if (!(P[i].periodSeconds > P[i - 1].periodSeconds)) periodOk = false;
const mercPeriod = byName["Mercury"]?.periodSeconds;
const nep0 = s0.state.planets[7].angle, nep1 = s1.state.planets[7].angle;
const dtObs = (s1.t - s0.t) / 1000;
const nepDelta = Math.abs(nep1 - nep0);
record(11, "Angular speed strictly decreasing outward; Mercury <= ~20 s/rev; Neptune visibly moves",
  periodOk && mercPeriod <= 20 && nepDelta > 0.01,
  `periods=[${P.map((p) => p.periodSeconds).join(", ")}]s, Neptune moved ${nepDelta.toFixed(4)} rad in ${dtObs.toFixed(1)}s`);

// C12 time-based motion: observed angle delta matches elapsed-time prediction for every planet
let timeBasedOk = true;
const deltas = [];
for (let i = 0; i < P.length; i++) {
  const a0 = s0.state.planets[i].angle, a1 = s1.state.planets[i].angle;
  let obs = (a1 - a0) % (2 * Math.PI);
  if (obs < 0) obs += 2 * Math.PI;
  const exp = ((2 * Math.PI * dtObs) / P[i].periodSeconds) % (2 * Math.PI);
  const err = Math.abs(obs - exp);
  deltas.push(`${P[i].name}:${(err).toFixed(3)}`);
  if (err > 0.15) timeBasedOk = false; // rad tolerance over ~5.5 s
}
record(12, "Motion computed from elapsed time (angle advance matches wall clock for all 8)",
  timeBasedOk, `|observed-expected| rad over ${dtObs.toFixed(1)}s: ${deltas.join(", ")}`);

// C13 FPS readout visible, labeled
const hudVisible = s1.hudRect && s1.hudRect.width > 0 && s1.hudRect.x >= 0 && s1.hudRect.y >= 0 &&
  s1.hudRect.x < 1280 && s1.hudRect.y < 800;
const hudLabeled = /^FPS:\s*\d+\.\d$/.test(s1.hudText || "");
record(13, "FPS readout always visible and clearly labeled", hudVisible && hudLabeled,
  `hud text="${s1.hudText}" at (${s1.hudRect?.x},${s1.hudRect?.y}) ${s1.hudRect?.width}x${s1.hudRect?.height}`);

// C14 FPS derived from real rAF timing: page's number ~= independently measured rAF rate
const rafOk = rafProbe.pageFps > 0 && Math.abs(rafProbe.pageFps - rafProbe.rafFps) / rafProbe.rafFps < 0.3;
record(14, "FPS measured from real rAF frame timing", rafOk,
  `independent rAF rate=${rafProbe.rafFps.toFixed(1)}, page-reported fps=${rafProbe.pageFps.toFixed(1)} (source uses sliding 1s timestamp window)`);

// C15 exactly one decimal; refreshed >= 4x/s; >= 2 distinct strings over 5 s of 500 ms samples
const allOneDecimal = hudSamples.every((h) => /^FPS:\s*\d+\.\d$/.test(h.text || ""));
const distinct = new Set(hudSamples.map((h) => h.text)).size;
record(15, "One decimal place, >=4 refreshes/s, >=2 distinct strings over 5 s",
  allOneDecimal && hudMutations >= 4 && distinct >= 2,
  `samples=[${hudSamples.map((h) => h.text?.replace("FPS: ", "")).join(", ")}], distinct=${distinct}, DOM text updates in 1 s=${hudMutations}`);

// C16 plausible FPS: 0 < fps <= 250 in every sample
const plausible = hudSamples.every((h) => {
  const v = parseFloat((h.text || "").replace(/^FPS:\s*/, ""));
  return isFinite(v) && v > 0 && v <= 250;
});
record(16, "FPS plausible (>0 and <=250) in all samples", plausible,
  `range ${Math.min(...hudSamples.map((h) => parseFloat(h.text.replace("FPS: ", ""))))} .. ${Math.max(...hudSamples.map((h) => parseFloat(h.text.replace("FPS: ", ""))))}`);

// C17 hook shape + orderings + live angle + fps matches HUD pre-rounding
const shapeOk = s1.state && s1.state.fpsType === "number" && s1.state.planetCount === 8 &&
  P.every((p) => typeof p.name === "string" && typeof p.orbitRadius === "number" &&
    typeof p.displayRadius === "number" && typeof p.angle === "number" && typeof p.periodSeconds === "number");
const hookOrderings = radiiOk && sizeOk && periodOk && namesOk;
const anglesLive = P.every((p, i) => Math.abs(s1.state.planets[i].angle - s0.state.planets[i].angle) > 1e-4 ||
  ((2 * Math.PI * dtObs) / p.periodSeconds) % (2 * Math.PI) < 1e-3);
const fpsMatchesHud = agree.diff < 0.06;
record(17, "window.solarSystem hook: shape, per-frame updates, orderings, fps = HUD pre-rounding",
  shapeOk && hookOrderings && anglesLive && fpsMatchesHud,
  `shape=${shapeOk}, orderings=${hookOrderings}, anglesLive=${anglesLive}, hud=${agree.hudVal} vs hook=${agree.hookFps?.toFixed(3)} (diff ${agree.diff?.toFixed(4)})`);

// C18 background/refocus behavior (simulated by a 2.5 s main-thread stall = no rAF)
const wallGap = (postBlock.t - preBlock.t) / 1000;
let simAdvance = (postBlock.mercuryAngle - preBlock.mercuryAngle) % (2 * Math.PI);
if (simAdvance < 0) simAdvance += 2 * Math.PI;
const fullAdvance = ((2 * Math.PI * wallGap) / (mercPeriod || 8)) % (2 * Math.PI);
const noTeleport = simAdvance < fullAdvance * 0.6; // clamped gap => far less than full wall-clock jump
const fpsValidAfter = [postBlock, ...resumeSamples].filter((s) => {
  const v = parseFloat(s.hudText.replace(/^FPS:\s*/, ""));
  return !isFinite(v) || v <= 0 || v > 1000 || /NaN|Infinity/i.test(s.hudText);
}).length <= 1; // at most one transient bad reading
record(18, "After a 2.5 s rAF stall: no wild teleport, no NaN/Infinity/<=0 FPS beyond one refresh",
  noTeleport && fpsValidAfter,
  `wall gap=${wallGap.toFixed(2)}s, Mercury advanced ${simAdvance.toFixed(3)} rad vs un-clamped ${fullAdvance.toFixed(3)} rad; post-stall HUD=[${[postBlock, ...resumeSamples].map((s) => s.hudText.replace("FPS: ", "")).join(", ")}]`);

// C19 resize must not throw
record(19, "Window resize throws no errors", errsAfterResize === errsBeforeResize && postResize.state.planetCount === 8,
  `errors before=${errsBeforeResize} after=${errsAfterResize} across 900x600 -> 1500x950 -> 1280x800; hook still live (${postResize.state.planetCount} planets, hud="${postResize.hudText}")`);

fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({
  consoleErrors, pageErrors, s0, s1, hudSamples, pix, rafProbe, hudMutations, agree,
  block: { preBlock, postBlock, resumeSamples }, results
}, null, 2));

await browser.close();

const done = results.filter((r) => r.pass !== null);
console.log(`\nSCRIPTED: ${done.filter((r) => r.pass).length}/${done.length} pass; criterion 7 pending screenshot review.`);
