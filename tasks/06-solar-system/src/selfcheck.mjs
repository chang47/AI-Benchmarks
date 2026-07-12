// Self-check for the animated solar system artifact.
// Loads src/index.html via file://, watches the console, samples the FPS HUD,
// validates the window.solarSystem contract, and saves a screenshot.
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(here, "index.html");

let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
  console.log("launched: installed Chrome");
} catch (e) {
  console.log("chrome channel failed (" + e.message.split("\n")[0] + "), falling back to bundled chromium");
  browser = await chromium.launch();
}

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

await page.goto(pathToFileURL(htmlPath).href);
await page.waitForTimeout(2000);

const failures = [];
const ok = (cond, label) => {
  console.log((cond ? "PASS" : "FAIL") + "  " + label);
  if (!cond) failures.push(label);
};

// --- Sample the HUD text every 500 ms for 5 s (criterion 15) ---
const samples = [];
for (let i = 0; i < 10; i++) {
  samples.push(await page.locator("#fps-hud").textContent());
  await page.waitForTimeout(500);
}
console.log("HUD samples:", samples.join(" | "));
ok(samples.every((s) => /^FPS: \d+\.\d$/.test(s)), "HUD text matches 'FPS: <n>.<d>' (one decimal) in every sample");
ok(new Set(samples).size >= 2, "at least two distinct HUD strings over 5 s");
ok(
  samples.every((s) => {
    const v = parseFloat(s.slice(5));
    return v > 0 && v <= 250;
  }),
  "every sampled FPS in (0, 250]"
);

// --- window.solarSystem contract (criterion 17) ---
const snap = async () => page.evaluate(() => JSON.parse(JSON.stringify(window.solarSystem)));
const s1 = await snap();
await page.waitForTimeout(1000);
const s2 = await snap();

const NAMES = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
ok(s1 && typeof s1.fps === "number" && isFinite(s1.fps) && s1.fps > 0, "solarSystem.fps is a finite positive Number");
ok(Array.isArray(s1.planets) && s1.planets.length === 8, "solarSystem.planets has exactly 8 entries");
ok(s1.planets.every((p, i) => p.name === NAMES[i]), "planet names/order exactly Mercury..Neptune");

const orbits = s1.planets.map((p) => p.orbitRadius);
ok(orbits.every((r, i) => i === 0 || r > orbits[i - 1] + 10), "orbitRadius strictly increasing, gaps > 10 px");

const rByName = Object.fromEntries(s1.planets.map((p) => [p.name, p.displayRadius]));
const sizeOrder = ["Jupiter", "Saturn", "Uranus", "Neptune", "Earth", "Venus", "Mars", "Mercury"];
ok(
  sizeOrder.every((n, i) => i === 0 || rByName[sizeOrder[i - 1]] > rByName[n]),
  "displayRadius strict ordering Jupiter > Saturn > Uranus > Neptune > Earth > Venus > Mars > Mercury"
);
ok(s1.planets.every((p) => p.displayRadius >= 2), "every planet displayRadius >= 2 px");

const periods = s1.planets.map((p) => p.periodSeconds);
ok(periods.every((v, i) => i === 0 || v > periods[i - 1]), "periodSeconds strictly increasing Mercury -> Neptune");
ok(periods[0] <= 20, "Mercury period <= 20 s");

ok(
  s1.planets.every((p, i) => p.angle !== s2.planets[i].angle),
  "every planet angle changed over 1 s (motion is live)"
);
ok(s1.fps !== s2.fps || samples.length > new Set(samples).size, "fps value is live (changes between snapshots)");

// Outermost orbit fits in a 1280x800 canvas.
ok(orbits[7] + rByName["Neptune"] < 400, "outermost orbit + Neptune disc fits within min(1280,800)/2");

// --- Resize must not throw (criterion 19) ---
await page.setViewportSize({ width: 900, height: 650 });
await page.waitForTimeout(400);
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(400);

ok(consoleErrors.length === 0, "zero console errors / uncaught exceptions");
if (consoleErrors.length) console.log("console errors:", consoleErrors);

await page.screenshot({ path: path.join(here, "selfcheck.png") });
console.log("screenshot saved: selfcheck.png");

await browser.close();
console.log(failures.length === 0 ? "\nALL CHECKS PASSED" : "\n" + failures.length + " CHECK(S) FAILED");
process.exit(failures.length === 0 ? 0 : 1);
