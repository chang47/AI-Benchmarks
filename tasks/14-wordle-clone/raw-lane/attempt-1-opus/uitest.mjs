import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';

const url = pathToFileURL(path.resolve('index.html')).href;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 420, height: 760 });
await page.goto(url);
await page.waitForFunction(() => !!window.__wordle);

// Force a known answer so we can produce a mix of colors deterministically.
await page.evaluate(() => window.__wordle.newGame('CRANE'));

// Type "SLATE" using the PHYSICAL keyboard path, then Enter.
for (const ch of 'SLATE') await page.keyboard.press(ch);
await page.keyboard.press('Enter');
await page.waitForTimeout(150);

// Read the first row's tiles from the DOM (visible layer).
const rowColors = await page.evaluate(() => {
  const tiles = document.querySelectorAll('.tile[data-row="0"]');
  return Array.from(tiles).map(t => ({
    letter: t.textContent,
    cls: ['green','yellow','gray'].find(c => t.classList.contains(c)) || null
  }));
});
console.log('Row 0 rendered tiles:', JSON.stringify(rowColors));

// SLATE vs CRANE: S gray, L gray, A yellow(A at pos2 vs answer N -> A present at pos3), T gray, E green
const letters = rowColors.map(t => t.letter).join('');
const anyColored = rowColors.every(t => t.cls !== null);
const eGreen = rowColors[4].cls === 'green';
console.log('letters=' + letters + ' allColored=' + anyColored + ' E-green=' + eGreen);

// keyboard key for E should be green in DOM
const eKeyGreen = await page.evaluate(() =>
  document.querySelector('.key[data-key="E"]').classList.contains('green'));
console.log('on-screen E key green:', eKeyGreen);

// invalid word via on-screen keys should not add a row & should not throw
await page.evaluate(() => window.__wordle.newGame('CRANE'));
await page.click('.key[data-key="Z"]');
await page.click('.key[data-key="Z"]');
await page.click('.key[data-key="Z"]');
await page.click('.key[data-key="Z"]');
await page.click('.key[data-key="Z"]');
await page.click('.key[data-key="ENTER"]');
await page.waitForTimeout(150);
const rowsAfterInvalid = await page.evaluate(() => window.__wordle.state().rows.length);
console.log('rows after invalid on-screen submit:', rowsAfterInvalid);

await page.screenshot({ path: 'screenshot.png' });

const good = letters === 'SLATE' && anyColored && eGreen && eKeyGreen && rowsAfterInvalid === 0;
console.log(good ? '\nUI SMOKE: PASS' : '\nUI SMOKE: FAIL');
await browser.close();
process.exit(good ? 0 : 1);
