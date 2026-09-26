// Copied into a task's grading sandbox (holdout/) and run there, so it uses the task's own
// playwright. Loads the candidate, takes 3 screenshots (after load, after a click on the
// center, after holding keys) and prints a JSON log of what happened + any page errors.
// Usage: node _bench-screenshot-probe.mjs <index.html> <outDir> '<{"waitMs":3000,"keys":["w"]}>'
import { chromium } from "playwright";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [, , file, outDir, cfgJson] = process.argv;
const cfg = { waitMs: 3000, keys: [], ...(cfgJson ? JSON.parse(cfgJson) : {}) };
const log = { file: "src/index.html", steps: [], consoleErrors: [], pageErrors: [], dialogs: 0 };
let browser;
try { browser = await chromium.launch({ channel: "chrome" }); } catch { browser = await chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (m) => { if (m.type() === "error") log.consoleErrors.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => log.pageErrors.push(String(e).slice(0, 300)));
page.on("dialog", async (d) => { log.dialogs++; await d.dismiss().catch(() => {}); });
try {
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(cfg.waitMs);
  await page.screenshot({ path: join(outDir, "shot-load.png") });
  log.steps.push(`loaded; waited ${cfg.waitMs}ms; shot-load.png; title="${await page.title()}"`);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(800);
  await page.mouse.move(700, 380, { steps: 8 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, "shot-after-click.png") });
  log.steps.push("clicked center (640,400), moved mouse to (700,380); shot-after-click.png");
  for (const k of cfg.keys) { await page.keyboard.down(k); await page.waitForTimeout(600); await page.keyboard.up(k); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, "shot-after-keys.png") });
  log.steps.push(`held keys ${JSON.stringify(cfg.keys)} for 600ms each; shot-after-keys.png`);
} catch (e) {
  log.steps.push(`probe error: ${String(e).slice(0, 300)}`);
}
await browser.close();
console.log(JSON.stringify(log, null, 2));
