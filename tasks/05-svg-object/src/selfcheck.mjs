// Self-check: render src/object.svg in Chromium, capture console errors + a screenshot.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const svgPath = join(here, "object.svg");
const svg = readFileSync(svgPath, "utf8");

// Minimal blank HTML page wrapping the SVG (per brief).
const htmlPath = join(here, "selfcheck.html");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>selfcheck</title></head><body style="margin:0">${svg}</body></html>`
);

const errors = [];
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch (e) {
  console.log("chrome channel failed, falling back to bundled chromium:", e.message);
  browser = await chromium.launch();
}
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

// 1) Load the raw .svg directly — the browser parses it as XML, surfacing parse errors.
await page.goto(pathToFileURL(svgPath).href);
await page.waitForTimeout(1000);
const rawDoc = await page.evaluate(() => ({
  rootTag: document.documentElement && document.documentElement.tagName,
  parseError: document.querySelector("parsererror") !== null,
  bodyText: (document.body && document.body.innerText) || "",
}));
console.log("raw .svg load:", JSON.stringify(rawDoc));

// 2) Load the HTML wrapper and screenshot.
await page.goto(pathToFileURL(htmlPath).href);
await page.waitForTimeout(2000);
await page.screenshot({ path: join(here, "selfcheck.png") });

// Basic geometry sanity from inside the page.
const facts = await page.evaluate(() => {
  const svgEl = document.querySelector("svg");
  const box = svgEl.getBoundingClientRect();
  const shapes = svgEl.querySelectorAll("path, circle, ellipse, rect, line").length;
  return { renderedWidth: box.width, renderedHeight: box.height, shapeCount: shapes };
});
console.log("wrapper facts:", JSON.stringify(facts));

await browser.close();

if (errors.length) {
  console.log("CONSOLE ERRORS:");
  for (const e of errors) console.log("  " + e);
  process.exitCode = 1;
} else {
  console.log("No console errors.");
}
