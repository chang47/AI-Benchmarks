// UI smoke check (AC-27) — secondary to the engine suite.
// Serves ../src over a local static server (the spec's stated environment) and
// drives the page with playwright using the installed Chrome (channel: "chrome").
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const MIME = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript" };

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const file = path.join(SRC, path.normalize(urlPath));
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const loc = m.location()?.url ?? "";
    // Chrome auto-requests /favicon.ico; a 404 for it is a harness artifact, not a candidate defect.
    if (/favicon\.ico/.test(loc) && /404/.test(m.text())) return;
    consoleErrors.push(`${m.text()} [${loc}]`);
  });

  await page.goto(`${base}/index.html`, { waitUntil: "load" });

  const pointsP1 = () => page.locator("#points-p1").innerText();
  const pointsP2 = () => page.locator("#points-p2").innerText();
  const gamesP1 = () => page.locator("#games-p1").innerText();
  const clickP1 = (n = 1) => page.locator("#point-p1").click({ clickCount: 1 }).then(() => n > 1 ? clickP1(n - 1) : null);
  const clickP2 = (n = 1) => page.locator("#point-p2").click({ clickCount: 1 }).then(() => n > 1 ? clickP2(n - 1) : null);

  check("page loads with initial 0/0 points", (await pointsP1()) === "0" && (await pointsP2()) === "0");

  await clickP1();
  check('Point P1 advances score to "15"', (await pointsP1()) === "15");
  await clickP2();
  check('Point P2 advances score to "15"', (await pointsP2()) === "15");

  // Finish this game for p1 (needs 3 more points from 15-15), then check games column.
  await clickP1(3);
  check("winning a game increments games and resets points",
    (await gamesP1()) === "1" && (await pointsP1()) === "0");

  // Drive to 6-6 in games: p1 needs 5 more games (24 pts), p2 needs 6 (24 pts), alternating.
  for (let g = 0; g < 5; g++) { await clickP2(4); await clickP1(4); }
  await clickP2(4); // 6-6
  const tbVisible = await page.locator("#tiebreak-indicator").isVisible();
  check("tiebreak state is visibly indicated at 6-6", tbVisible);

  // p1 takes the tiebreak 7-0 -> set 1 recorded 7-6.
  await clickP1(7);
  const setsP1 = await page.locator("#sets-p1").innerText();
  const tbHidden = !(await page.locator("#tiebreak-indicator").isVisible());
  check("tiebreak win records the set and clears the indicator", setsP1.trim() === "7" && tbHidden);

  // p1 takes set 2 6-0 (24 points) -> match over, best-of-3 default.
  await clickP1(24);
  const winnerVisible = await page.locator("#winner").isVisible();
  const winnerText = winnerVisible ? await page.locator("#winner").innerText() : "";
  check("winner is displayed when the match ends",
    winnerVisible && /player 1/i.test(winnerText), winnerText);

  // Post-match clicks change nothing.
  const frozen = await page.locator("#sets-p1").innerText();
  await clickP2(5);
  await clickP1(3);
  const stillFrozen = (await page.locator("#sets-p1").innerText()) === frozen
    && (await pointsP1()) === "0" && (await pointsP2()) === "0";
  check("point clicks after match end change nothing", stillFrozen);

  // New Match resets.
  await page.locator("#new-match").click();
  const reset = (await pointsP1()) === "0" && (await pointsP2()) === "0"
    && (await page.locator("#sets-p1").innerText()).trim() === ""
    && !(await page.locator("#winner").isVisible());
  check("New Match resets to a fresh match", reset);

  check("no console/page errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (err) {
  check("ui-check ran to completion", false, String(err));
} finally {
  await browser?.close();
  server.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nUI CHECK: ${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
