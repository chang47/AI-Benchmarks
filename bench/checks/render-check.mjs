// C4: open the built report in a real browser at desktop and phone widths; collect console
// errors and horizontal overflow; save screenshots for a human (or agent) to LOOK at.
// Usage: node bench/checks/render-check.mjs [siteDir] [--all]  (default: index + up to 6 run pages)
import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CACHE_DIR, ROOT } from "../lib/util.mjs";

export async function renderCheck(site = join(ROOT, "reports", "site"), { all = false, shotsDir = join(CACHE_DIR, "shots") } = {}) {
  mkdirSync(shotsDir, { recursive: true });
  const runPages = existsSync(join(site, "runs")) ? readdirSync(join(site, "runs")).filter((f) => f.endsWith(".html")) : [];
  const pages = ["index.html", ...(all ? runPages : pickSpread(runPages, 6)).map((f) => `runs/${f}`)];
  let browser;
  try { browser = await chromium.launch({ channel: "chrome" }); } catch { browser = await chromium.launch(); }
  const problems = [];
  const shots = [];
  for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    for (const p of pages) {
      const page = await ctx.newPage();
      const errs = [];
      page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errs.push(m.text()); });
      page.on("pageerror", (e) => errs.push(String(e)));
      await page.goto(pathToFileURL(join(site, p)).href);
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const name = `${tag}-${p.replace(/[\\/]/g, "_").replace(/\.html$/, "")}.png`;
      await page.screenshot({ path: join(shotsDir, name), fullPage: false });
      shots.push(join(shotsDir, name));
      if (errs.length) problems.push(`${tag} ${p}: ${errs.length} console error(s): ${errs[0]}`);
      if (overflow > 1) problems.push(`${tag} ${p}: page scrolls horizontally by ${overflow}px`);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  return { pages: pages.length, problems, shots };
}

function pickSpread(list, k) {
  if (list.length <= k) return list;
  return Array.from({ length: k }, (_, i) => list[Math.floor((i * (list.length - 1)) / (k - 1))]);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const r = await renderCheck(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : undefined, { all: process.argv.includes("--all") });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.problems.length ? 1 : 0);
}
