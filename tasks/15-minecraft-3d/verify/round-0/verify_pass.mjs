// Independent verifier pass for task 15-minecraft-3d.
// Loads candidate via file://, screenshots at ~0s and ~3s, and runs an
// independent full-world footprint probe to resolve the R05 skip.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(join(__dirname, '..', '..', 'src', 'index.html'));
const outDir = __dirname;

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
catch { browser = await chromium.launch({ headless: true }); }

const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e && e.message || e).slice(0, 200)));

await page.goto(pathToFileURL(target).href, { waitUntil: 'load' }).catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, 'shot-0s.png') });

// Independent full-world footprint probe: sample a wide area, non-destructive
// remove()->place() round-trip to find the surface height of every column.
const probe = await page.evaluate(() => {
  const v = window.__voxel;
  if (!v) return { error: 'no __voxel hook' };
  const p = v.player();
  const b0 = v.blockCount();
  const surf = {}; let restoreFail = false;
  // sweep a generous 40x40 area covering the whole plausible world
  for (let x = 0; x < 40; x++) {
    for (let z = 0; z < 40; z++) {
      for (let y = 30; y >= -2; y--) {
        let rem = false; try { rem = v.remove(x, y, z); } catch (e) {}
        if (rem === true) {
          try { if (v.place(x, y, z) !== true) restoreFail = true; } catch (e) { restoreFail = true; }
          surf[x + ',' + z] = y; break;
        }
      }
    }
  }
  const b1 = v.blockCount();
  const keys = Object.keys(surf);
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity, minH = Infinity, maxH = -Infinity;
  for (const k of keys) {
    const [x, z] = k.split(',').map(Number); const h = surf[k];
    minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z);
    minH = Math.min(minH, h); maxH = Math.max(maxH, h);
  }
  const bboxW = maxx - minx + 1, bboxD = maxz - minz + 1;
  return {
    b0, b1, restoreOk: !restoreFail && b0 === b1,
    solidCols: keys.length, bboxW, bboxD,
    filledFrac: keys.length / (bboxW * bboxD),
    minH, maxH, heightRange: maxH - minH,
    player: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch },
  };
}).catch((e) => ({ error: String(e) }));

await page.waitForTimeout(2700);
await page.screenshot({ path: join(outDir, 'shot-3s.png') });

const title = await page.title();
const hudText = await page.evaluate(() => {
  const els = [...document.querySelectorAll('body *')];
  for (const el of els) { const t = (el.textContent || '').trim(); if (t.length < 60 && /fps/i.test(t)) return t; }
  return '';
}).catch(() => '');

console.log(JSON.stringify({ title, errors, hudText, probe }, null, 2));
await browser.close();
