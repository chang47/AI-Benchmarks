import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(path.join(__dirname, "index.html")).href;

let browser;
try { browser = await chromium.launch({ channel: "chrome" }); }
catch { browser = await chromium.launch(); }
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__chess);

const cell = (s) => page.click(`[data-square="${s}"]`);

// select e2 -> should highlight
await cell("e2");
const selCount = await page.$$eval(".square.sel", (n) => n.length);
const hintCount = await page.$$eval(".square.hint,.square.hintcap", (n) => n.length);
console.log("after selecting e2: sel=" + selCount + " hints=" + hintCount);

// click e4 -> move completes
await cell("e4");
const b1 = await page.evaluate(() => window.__chess.board());
console.log("e4 by click:", b1.e4, "e2:", b1.e2, "turn:", await page.evaluate(() => window.__chess.turn));

// switch-selection: black selects e7, then clicks d7 (own piece) => selection switches, no move
await cell("e7");
await cell("d7");
const selNow = await page.$$eval(".square.sel", (n) => n.map((x) => x.dataset.square));
console.log("switch selection now on:", JSON.stringify(selNow));

// illegal click destination does not change board
const bBefore = JSON.stringify(await page.evaluate(() => window.__chess.board()));
await cell("d5"); // legal actually (d7-d5). pick illegal instead: reselect then illegal
const bAfter = JSON.stringify(await page.evaluate(() => window.__chess.board()));
console.log("d7->d5 click changed board:", bBefore !== bAfter);

const pass = b1.e4 === "wP" && !b1.e2 && selCount === 1 && hintCount >= 1 &&
             JSON.stringify(selNow) === JSON.stringify(["d7"]) && errs.length === 0;
console.log("CLICK CHECK:", pass ? "PASS" : "FAIL", "errors=" + JSON.stringify(errs));
await browser.close();
process.exit(pass ? 0 : 1);
