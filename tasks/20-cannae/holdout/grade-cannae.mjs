// Frozen grader for task 20 "Cannae" — a points checklist: contract + order of battle + determinism + rule compliance
// + the historical beats (measured on state() samples every 10 s of battle time) + rendering + yes/no judge questions
// (emitted as `skip` with their frames; the bench's blind 3-vote judge answers them).
// Usage: node grade-cannae.mjs [path/to/index.html]   (default ../src/index.html). Frames → $VBENCH_FRAMES_DIR.
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { changed } from "./lib/pix.mjs";
import { probeDeterminism, sampleBattle, scoreHistory } from "./probes-history.mjs";

const VERSION = "cannae-grader-1";
const file = resolve(process.argv[2] || "../src/index.html");
const framesDir = process.env.VBENCH_FRAMES_DIR || resolve("frames");
const Q = JSON.parse(readFileSync(new URL("./judge-questions.json", import.meta.url), "utf8"));

const PLAN = [
  ["L-errors", "Loads clean", "no console errors", 2], ["L-network", "Loads clean", "no network requests", 2], ["L-contract", "Loads clean", "window.__cannae seek/state/play/pause present", 2],
  ["S-ids", "Order of battle", "all required unit ids at t=0", 2], ["S-men", "Order of battle", "unit strengths match the order of battle (±2%)", 2], ["S-pos", "Order of battle", "positions, frontages and facings match the deployment", 2],
  ["D-same", "Determinism", "two fresh page loads give the same state at t = 1473 s", 2], ["D-path", "Determinism", "state at t does not depend on how you got there", 2], ["D-dur", "Determinism", "battle lasts ≥ 30 min of battle time", 1],
  ["R-speed", "Rules", "speed limits respected (sampled every 10 s)", 3], ["R-men", "Rules", "a unit's men never increase", 2], ["R-contact", "Rules", "men die only where an enemy is in reach", 3],
  ["R-overlap", "Rules", "no unit passes through an enemy", 3], ["R-rout", "Rules", "routed units flee away from the enemy", 2],
  ["H-rivercav", "History", "the Roman cavalry by the river breaks first, before the Libyans strike", 2], ["H-crescent", "History", "the crescent starts convex and bends concave before the encirclement", 3],
  ["H-centre", "History", "the Gallic/Spanish centre never breaks", 2], ["H-libyans", "History", "the Libyans turn ~90° to face inward", 2],
  ["H-alliedcav", "History", "Varro's allied cavalry breaks when Hasdrubal hits it from behind", 2], ["H-ride", "History", "Hasdrubal rides behind the whole Roman army, west to east", 2],
  ["H-encircle", "History", "the Roman infantry ends up surrounded on all four sides", 3], ["H-romandead", "History", "Roman losses are catastrophic (≥ 35,000 dead)", 2],
  ["H-ratio", "History", "Carthaginian dead ≤ 20% of Roman dead", 2], ["H-gauls", "History", "the Gauls and Spaniards take the largest share of Carthaginian losses", 2],
  ["V-anim", "Rendering", "the battlefield animates while playing", 2], ["V-scrub", "Rendering", "the timeline slider scrubs the battle", 2], ["V-play", "Rendering", "the play button starts and stops playback", 1],
  ["V-fps", "Rendering", "frame time while playing (p95)", 2], ["V-mobile", "Rendering", "no horizontal overflow at 390px, timeline visible", 1],
  ...Q.questions.map((q) => [q.id, "Judge checklist", q.q, 1]),
];

const consoleErrors = [], network = [], notes = [], got = {};
const put = (c) => { if (c && c.id) got[c.id] = c; };

async function main() {
  if (!existsSync(file)) return;
  const url = pathToFileURL(file).href;
  let raw;
  try { raw = await chromium.launch({ channel: "chrome", args: ["--ignore-gpu-blocklist"] }); } catch { raw = await chromium.launch(); }
  const newPage = async (opts) => {
    const p = await raw.newPage(opts);
    p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    p.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
    p.on("request", (r) => { if (!/^(file|data|blob|about):/.test(r.url())) network.push(r.url().slice(0, 160)); });
    p.on("dialog", (d) => d.dismiss().catch(() => {}));
    return p;
  };
  const run = async (name, fn) => { const t = Date.now(); try { await fn(); } catch (e) { notes.push(`${name} probe crashed: ${String(e.message || e).split("\n")[0].slice(0, 200)}`); } process.stderr.write(`[cannae] ${name} ${((Date.now() - t) / 1000).toFixed(1)}s\n`); };
  try {
    const page = await newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url); await page.waitForTimeout(2500);
    const contract = await page.evaluate(() => { const c = window.__cannae; return !!c && ["seek", "state", "play", "pause"].every((k) => typeof c[k] === "function"); });
    put({ id: "L-contract", earned: contract ? 2 : 0, detail: contract ? "present" : "window.__cannae or one of seek/state/play/pause missing" });

    await run("history", async () => {
      const det = await probeDeterminism(page);
      // Determinism across page loads: a second fresh page must reach the identical state at the same time.
      const p2 = await newPage({ viewport: { width: 800, height: 600 } });
      await p2.goto(url); await p2.waitForTimeout(1500);
      const again = await probeDeterminism(p2); await p2.close();
      det.same = !!det.at1473 && det.at1473 === again.at1473;
      const B = await sampleBattle(page);
      if (B.error || !B.samples?.length) { notes.push(`sampling failed: ${B.error || "no samples"}`); return; }
      for (const c of scoreHistory(B, det)) put(c);
    });

    await run("rendering", async () => {
      const c = "window.__cannae";
      // Animates while playing.
      await page.evaluate(() => { const c = window.__cannae; c.pause(); c.seek(900); c.setSpeed?.(30); c.play(); });
      await page.waitForTimeout(800);
      const a = await page.screenshot(); await page.waitForTimeout(1000); const b = await page.screenshot();
      const moved = changed(a, b);
      put({ id: "V-anim", earned: moved >= 0.003 ? 2 : 0, detail: `${(moved * 100).toFixed(2)}% of pixels changed over 1 s of playback (need ≥ 0.3%)` });
      // Frame time while playing.
      const measure = () => page.evaluate(() => new Promise((res) => { const f = []; let last = performance.now(); const tick = (t) => { f.push(t - last); last = t; if (f.length < 150) requestAnimationFrame(tick); else { f.sort((x, y) => x - y); res({ p95: f[Math.floor(f.length * 0.95)], med: f[75] }); } }; requestAnimationFrame(tick); }));
      const m1 = await measure(), m2 = await measure(), ft = m1.p95 <= m2.p95 ? m1 : m2; // best of two: one GC pause should not decide it
      put({ id: "V-fps", earned: ft.p95 <= 33.4 ? 2 : ft.p95 <= 50 ? 1 : 0, detail: `p95 ${ft.p95.toFixed(1)} ms, median ${ft.med.toFixed(1)} ms while playing (≤ 33 → 2, ≤ 50 → 1)` });
      await page.evaluate(() => window.__cannae.pause());
      // Play button.
      const btn = page.locator("[data-play]").first();
      let playOk = false;
      if (await btn.count()) {
        await btn.click(); await page.waitForTimeout(300); const on = await page.evaluate(() => window.__cannae.playing?.());
        await btn.click(); await page.waitForTimeout(300); const off = await page.evaluate(() => window.__cannae.playing?.());
        playOk = on === true && off === false;
      }
      put({ id: "V-play", earned: playOk ? 1 : 0, detail: playOk ? "toggles playing() true → false" : "no [data-play] or it does not toggle playing()" });
      // Timeline scrubbing.
      const slider = page.locator("input[type=range][data-timeline]").first();
      let scrub = { ok: false, detail: "no input[type=range][data-timeline]" };
      if (await slider.count()) {
        const setTo = async (frac) => { await slider.evaluate((el, frac) => { const v = Number(el.min || 0) + (Number(el.max || 100) - Number(el.min || 0)) * frac; el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, frac); await page.waitForTimeout(1500); return page.evaluate(() => window.__cannae.state().t); };
        const t0 = await setTo(0.02); const s0 = await page.screenshot();
        const t1 = await setTo(0.6); const s1 = await page.screenshot();
        const diff = changed(s0, s1);
        scrub = { ok: t1 > t0 + 300 && diff >= 0.01, detail: `slider moved battle time ${Math.round(t0)}s → ${Math.round(t1)}s; ${(diff * 100).toFixed(1)}% of pixels changed` };
      }
      put({ id: "V-scrub", earned: scrub.ok ? 2 : 0, detail: scrub.detail });
      // Judge frames from the page's own camera: wide (default view) for landscape and colours, then zoomed in with the
      // mouse wheel (the prompt requires wheel zoom) — medium for the encirclement, close for the soldiers themselves.
      mkdirSync(framesDir, { recursive: true });
      const shot = async (t, name, notches) => {
        await page.reload(); await page.waitForTimeout(2000);
        await page.evaluate((t) => { window.__cannae.pause(); window.__cannae.seek(t); }, t);
        await page.mouse.move(640, 430);
        for (let k = 0; k < notches; k++) { await page.mouse.wheel(0, -250); await page.waitForTimeout(80); }
        await page.waitForTimeout(1500); await page.screenshot({ path: join(framesDir, name) });
      };
      const dur = await page.evaluate(() => window.__cannae.duration);
      await shot(0, "f-start.png", 0); await shot(1000, "f-mid.png", 0); await shot(Math.min(2300, dur), "f-end.png", 3); await shot(1000, "c-mid.png", 6);
      await page.close();
      const m = await newPage({ viewport: { width: 390, height: 844 } });
      await m.goto(url); await m.waitForTimeout(2500);
      await m.evaluate(() => window.__cannae?.seek?.(1300)); await m.waitForTimeout(1500);
      const mob = await m.evaluate(() => { const s = document.querySelector("input[type=range][data-timeline]"); const r = s?.getBoundingClientRect(); return { over: document.scrollingElement.scrollWidth - innerWidth, slider: !!r && r.width > 40 && r.bottom <= innerHeight && r.top >= 0 }; });
      put({ id: "V-mobile", earned: mob.over <= 1 && mob.slider ? 1 : 0, detail: `overflow ${mob.over}px; timeline visible: ${mob.slider}` });
      await m.screenshot({ path: join(framesDir, "m-mid.png") });
      await m.close();
    });
  } finally { await raw.close(); }
  const errs = [...new Set(consoleErrors)], nets = [...new Set(network)];
  put({ id: "L-errors", earned: errs.length ? 0 : 2, detail: `${errs.length} distinct console error(s)${errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""}` });
  put({ id: "L-network", earned: nets.length ? 0 : 2, detail: nets.length ? `${nets.length} request(s): ${nets.slice(0, 3).join(", ")}` : "no network requests" });
}

await main().catch((e) => notes.push(`grader error: ${String(e.stack || e).slice(0, 400)}`));
const judge = Object.fromEntries(Q.questions.map((q) => [q.id, q]));
const checks = PLAN.map(([id, group, name, points]) => {
  if (judge[id]) return { id, group, name, points, earned: null, status: "skip", method: "judge-checklist", frames: judge[id].frames, detail: "yes/no judge question — answered by the bench judge from the frames" };
  const g = got[id];
  if (!g) return { id, group, name, points, earned: 0, status: "fail", detail: existsSync(file) ? "not measured (probe crashed or contract missing — see notes)" : "no src/index.html" };
  return { id, group, name, points, earned: g.earned, status: g.earned === points ? "pass" : "fail", detail: g.detail };
});
console.log(JSON.stringify({ version: VERSION, file: "src/index.html", pointsPossible: PLAN.reduce((a, r) => a + r[3], 0), checks, notes }, null, 1));
