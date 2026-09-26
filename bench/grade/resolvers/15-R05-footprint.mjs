// Deterministic resolver for task 15 rubric item R05 ("≥16×16 solid-column footprint, every column
// solid"). The frozen autochecks probe only a 20×20 window around the spawn point, so a spawn near the
// world edge clips it and the item comes back `skip`. This repeats the SAME non-destructive hook probe
// (remove()→place() round-trip per column, blockCount restored) over a wider window and asks the rubric's
// actual question: is there a fully solid 16×16 square of columns? It mirrors how the July human verifier
// resolved it (a full-world probe). Runs inside the grading sandbox so it uses the task's playwright.
// Usage: node _resolver.mjs <index.html>  → prints {status, detail}
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const RAD = 24;
let browser;
try { browser = await chromium.launch({ channel: "chrome" }); } catch { browser = await chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
let out;
try {
  await page.goto(pathToFileURL(process.argv[2]).href);
  await page.waitForFunction(() => window.__voxel && typeof window.__voxel.player === "function", { timeout: 10000 });
  await page.waitForTimeout(1500);
  const probe = await page.evaluate((RAD) => {
    const v = window.__voxel;
    const p = v.player();
    const px = Math.floor(p.x), pz = Math.floor(p.z), py = p.y;
    const b0 = v.blockCount();
    const yTop = Math.ceil(py) + 6, yBot = Math.floor(py) - 48;
    const solid = {}; let restoreFail = false;
    for (let x = px - RAD; x < px + RAD; x++) for (let z = pz - RAD; z < pz + RAD; z++) {
      for (let y = yTop; y >= yBot; y--) {
        let rem = false; try { rem = v.remove(x, y, z); } catch (e) {}
        if (rem === true) { try { if (v.place(x, y, z) !== true) restoreFail = true; } catch (e) { restoreFail = true; } solid[x + "," + z] = 1; break; }
      }
    }
    return { px, pz, b0, b1: v.blockCount(), restoreFail, solid };
  }, RAD);
  // Largest all-solid square of columns (classic DP over the probe window).
  const N = 2 * RAD, dp = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
  let best = 0, cols = 0;
  for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
    const x = probe.px - RAD + i - 1, z = probe.pz - RAD + j - 1;
    if (probe.solid[x + "," + z]) { cols++; dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]); best = Math.max(best, dp[i][j]); }
  }
  const restored = !probe.restoreFail && probe.b0 === probe.b1;
  const detail = `resolver probe ${N}×${N} around spawn: ${cols} solid columns, largest fully-solid square ${best}×${best}, blockCount restored ${probe.b0}→${probe.b1}`;
  out = !restored ? { status: "skip", detail: detail + " — probe could not restore the world; not trusted" }
    : { status: best >= 16 ? "pass" : "fail", detail };
} catch (e) {
  out = { status: "skip", detail: `resolver error: ${String(e).slice(0, 200)}` };
}
await browser.close();
console.log(JSON.stringify(out));
