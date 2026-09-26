// Frozen grader for task 18 "Wonders of the Universe" — the 82-point checklist
// (design/2026-09-26-web-3d-sheet-tasks-spec.md, Task 18). Scripted checks: 74 pts. Judge checklist: 8 pts
// (emitted here as `skip` with their frames; the bench's blind 3-vote judge answers them).
// Usage: node grade-wonders.mjs [path/to/index.html]   (default ../src/index.html)
// Frames for the judge go to $VBENCH_FRAMES_DIR (default ./frames). Prints one JSON object on stdout.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { probeChoreography, probeLoadAndContent, probeReveals, probeScenes, probeTitleOnLoad } from "./probes-scene.mjs";
import { captureFrames, probeCursor, probeInteraction, probeLegibility, probeQuality } from "./probes-ux.mjs";

const VERSION = "wonders-grader-1";
const file = resolve(process.argv[2] || "../src/index.html");
const framesDir = process.env.VBENCH_FRAMES_DIR || resolve("frames");
const Q = JSON.parse(readFileSync(new URL("./judge-questions.json", import.meta.url), "utf8"));

// The full checklist: every id always appears, so a crashed probe scores 0 instead of shrinking the total.
const PLAN = [
  ["L1", "Loads clean", "no console errors", 2], ["L2", "Loads clean", "no network requests", 2], ["L3", "Loads clean", "all 8 data-sections exist, in order", 2],
  ["C1", "Content", "copy: nav, hero, meteors", 1], ["C2", "Content", "copy: volcano, waterfall", 1], ["C3", "Content", "copy: wonders, ocean (+ counter)", 1], ["C4", "Content", "copy: voices, join, footer", 1], ["C5", "Content", "every nav link lands on its section", 2],
  ["S-galaxy", "Scenes animate", "galaxy scene animates while visible", 2], ["S-meteors", "Scenes animate", "meteors scene animates while visible", 2], ["S-waterfall", "Scenes animate", "waterfall scene animates while visible", 2], ["S-ocean", "Scenes animate", "ocean scene animates while visible", 2], ["S-mouse", "Scenes animate", "galaxy responds to mouse movement", 2], ["S-title", "Scenes animate", "title animates on load", 2],
  ["V-rise", "Scroll choreography", "volcano progress rises with scroll", 3], ["V-rewind", "Scroll choreography", "volcano rewinds when scrolling up", 2], ["V-pin", "Scroll choreography", "volcano stays pinned while its progress runs", 2], ["W-pin", "Scroll choreography", "wonders strip pins", 2], ["W-move", "Scroll choreography", "wonder cards move on X with scroll", 2], ["P-parallax", "Scroll choreography", "forest parallax: layers move at different speeds", 2], ["R-reveal", "Scroll choreography", "reveal-on-scroll in every section", 3],
  ["K-follow", "Cursor", "custom cursor follows the mouse (within 20px)", 2], ["K-trail", "Cursor", "trail appears along the mouse path", 1], ["K-hover", "Cursor", "cursor changes over a link or button", 1], ["K-reduced", "Cursor", "no custom cursor under reduced motion", 1], ["K-touch", "Cursor", "no custom cursor on touch devices", 1],
  ["I-next", "Interaction", "carousel next", 1], ["I-prev", "Interaction", "carousel previous", 1], ["I-auto", "Interaction", "carousel auto-advances within 8 s", 1], ["I-pause", "Interaction", "carousel pauses while hovered", 1], ["I-empty", "Interaction", "empty submit shows the error", 2], ["I-bad", "Interaction", "invalid email shows the error", 1], ["I-good", "Interaction", "valid email shows success, no reload", 1], ["I-menu", "Interaction", "mobile menu opens and closes at 375px", 2],
  ["Q-overflow-375", "Quality & performance", "no horizontal overflow at 375px", 1], ["Q-overflow-768", "Quality & performance", "no horizontal overflow at 768px", 1], ["Q-overflow-1440", "Quality & performance", "no horizontal overflow at 1440px", 1], ["Q-axe", "Quality & performance", "axe-core: serious + critical violations", 3], ["Q-cls", "Quality & performance", "CLS < 0.1 during load", 1], ["Q-frames", "Quality & performance", "frame-time p95 during a full-page scroll", 3], ["Q-pause", "Quality & performance", "off-screen scenes are paused", 2], ["Q-reduced", "Quality & performance", "reduced motion: static, everything visible", 2],
  ["T-legibility", "Legibility", "text contrast over the live background", 4],
  ...Q.questions.map((q) => [q.id, "Judge checklist", q.q, 1]),
];

const consoleErrors = [], network = [], notes = [], got = {};
let dialogs = 0;

async function main() {
  if (!existsSync(file)) return;
  const url = pathToFileURL(file).href;
  let raw;
  try { raw = await chromium.launch({ channel: "chrome", args: ["--ignore-gpu-blocklist"] }); } catch { raw = await chromium.launch(); }
  // Every page the grader opens is watched for console errors, network requests and native dialogs.
  const browser = {
    newPage: async (opts = {}) => {
      const p = await raw.newPage(opts);
      p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
      p.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
      p.on("request", (r) => { if (!/^(file|data|blob|about|chrome-extension):/.test(r.url())) network.push(r.url().slice(0, 160)); });
      p.on("dialog", async (d) => { dialogs++; await d.dismiss().catch(() => {}); });
      return p;
    },
  };
  const ctx = { vw: 1440, vh: 900 };
  const only = process.env.WONDERS_ONLY ? process.env.WONDERS_ONLY.split(",") : null; // dev aid: run a subset of probes
  const run = async (name, fn) => {
    if (only && !only.includes(name)) return;
    const t = Date.now();
    try { for (const c of [].concat(await fn())) if (c && c.id) got[c.id] = c; }
    catch (e) { notes.push(`${name} probe crashed: ${String(e.message || e).split("\n")[0].slice(0, 200)}`); }
    process.stderr.write(`[wonders] ${name} ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
  };
  try {
    const main = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await run("title", async () => (ctx.titleAnim = await probeTitleOnLoad(main, url)));
    await run("load+content", () => probeLoadAndContent(main, ctx));
    await run("scenes", () => probeScenes(main, ctx));
    await run("choreography", () => probeChoreography(main, ctx));
    await run("reveals", async () => { const p = await browser.newPage({ viewport: { width: 1440, height: 900 } }); await p.goto(url); await p.waitForTimeout(1500); try { return await probeReveals(p, got["S-title"]?.earned > 0); } finally { await p.close(); } });
    await run("cursor", () => probeCursor(main, browser, url, ctx));
    await run("interaction", () => probeInteraction(main, browser, url, ctx));
    await run("quality", () => probeQuality(main, browser, url, ctx));
    await main.close();
    await run("legibility", () => probeLegibility(browser, url));
    await run("frames", async () => { notes.push(`judge frames: ${(await captureFrames(browser, url, framesDir)).length}`); });
  } finally { await raw.close(); }

  const errs = [...new Set(consoleErrors)];
  got.L1 = { earned: errs.length || dialogs ? 0 : 2, detail: `${errs.length} distinct console error(s)${dialogs ? `, ${dialogs} native dialog(s)` : ""}${errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""}` };
  const nets = [...new Set(network)];
  got.L2 = { earned: nets.length ? 0 : 2, detail: nets.length ? `${nets.length} request(s): ${nets.slice(0, 3).join(", ")}` : "no network requests" };
}

await main().catch((e) => notes.push(`grader error: ${String(e.stack || e).slice(0, 400)}`));
const judge = Object.fromEntries(Q.questions.map((q) => [q.id, q]));
const checks = PLAN.map(([id, group, name, points]) => {
  if (judge[id]) return { id, group, name, points, earned: null, status: "skip", method: "judge-checklist", frames: judge[id].frames, detail: "yes/no judge question — answered by the bench judge from the frames" };
  const g = got[id];
  if (!g) return { id, group, name, points, earned: 0, status: "fail", detail: existsSync(file) ? "not measured (probe crashed — see notes)" : "no src/index.html" };
  return { id, group, name, points, earned: g.earned, status: g.earned === points ? "pass" : "fail", detail: g.detail };
});
console.log(JSON.stringify({ version: VERSION, file: "src/index.html", pointsPossible: PLAN.reduce((a, r) => a + r[3], 0), checks, notes }, null, 1));
