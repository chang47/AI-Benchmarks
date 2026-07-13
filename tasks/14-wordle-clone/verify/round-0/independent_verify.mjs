// Independent verifier pass (round 0) — does NOT reuse holdout autochecks.
// Drives window.__wordle directly + captures screenshots for visual items.
import { chromium } from 'file:///C:/Users/iamjo/Projects/ai-benchmark/tasks/14-wordle-clone/holdout/node_modules/playwright/index.mjs';

const TARGET = 'file:///C:/Users/iamjo/Projects/ai-benchmark/tasks/14-wordle-clone/src/index.html';
const OUT = 'C:/Users/iamjo/Projects/ai-benchmark/tasks/14-wordle-clone/verify/round-0';

const results = [];
const rec = (id, ok, detail = '') => { results.push({ id, ok, detail }); };

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}
const page = await browser.newPage({ viewport: { width: 700, height: 900 } });

const consoleErrors = [];
const pageErrors = [];
const dialogs = [];
const netRequests = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('dialog', async d => { dialogs.push(d.type()); await d.dismiss().catch(() => {}); });
page.on('request', r => { const u = r.url(); if (/^https?:/i.test(u)) netRequests.push(u); });

await page.goto(TARGET, { waitUntil: 'load' });

// Screenshot ~0s: fresh board
await page.screenshot({ path: `${OUT}/at-0s.png` });

// Hook shape
const hookShape = await page.evaluate(() => {
  const w = window.__wordle;
  return w && ['setAnswer', 'guess', 'state'].every(k => typeof w[k] === 'function');
});
rec('H1-hook-shape', hookShape);

// Helper to run one duplicate-letter case
async function evalCase(answer, guess) {
  return await page.evaluate(({ answer, guess }) => {
    window.__wordle.setAnswer(answer);
    return window.__wordle.guess(guess);
  }, { answer, guess });
}

const cases = [
  { a: 'HOTEL', g: 'LLAMA', want: ['yellow', 'gray', 'gray', 'gray', 'gray'] },
  { a: 'HOTEL', g: 'LEVEL', want: ['gray', 'gray', 'gray', 'green', 'green'] },
  { a: 'EATEN', g: 'LEVER', want: ['gray', 'yellow', 'gray', 'green', 'gray'] },
  { a: 'ERASE', g: 'SPEED', want: ['yellow', 'gray', 'yellow', 'yellow', 'gray'] },
  { a: 'CREPE', g: 'SPEED', want: ['gray', 'yellow', 'green', 'yellow', 'gray'] },
  { a: 'THOSE', g: 'GEESE', want: ['gray', 'gray', 'gray', 'green', 'green'] },
  { a: 'ROBOT', g: 'FLOOR', want: ['gray', 'gray', 'yellow', 'green', 'yellow'] },
];
for (const c of cases) {
  const got = await evalCase(c.a, c.g);
  const ok = Array.isArray(got) && JSON.stringify(got) === JSON.stringify(c.want);
  rec(`dup ${c.a}/${c.g}`, ok, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(c.want)}`);
}

// Invalid guesses -> null, consume nothing
const invalid = await page.evaluate(() => {
  window.__wordle.setAnswer('CRANE');
  const r = {
    short: window.__wordle.guess('abc'),
    long: window.__wordle.guess('abcdef'),
    digit: window.__wordle.guess('ab1de'),
    space: window.__wordle.guess('ab de'),
    zzzzz: window.__wordle.guess('ZZZZZ'),   // non-word must be accepted
    guessesLen: window.__wordle.state().guesses.length,
  };
  return r;
});
rec('invalid->null', invalid.short === null && invalid.long === null && invalid.digit === null && invalid.space === null,
  JSON.stringify(invalid));
rec('non-word accepted', Array.isArray(invalid.zzzzz) && invalid.zzzzz.length === 5, JSON.stringify(invalid.zzzzz));
rec('invalid consumed 0 rows, ZZZZZ consumed 1', invalid.guessesLen === 1, `guesses=${invalid.guessesLen}`);

// Win ends game (E1) + further input ignored
const win = await page.evaluate(() => {
  window.__wordle.setAnswer('MAGIC');
  const r = window.__wordle.guess('magic');
  const s1 = window.__wordle.state();
  const after = window.__wordle.guess('CRANE');
  return { r, status: s1.status, after };
});
rec('E1 win all-green + won', win.r && win.r.every(x => x === 'green') && win.status === 'won' && win.after === null, JSON.stringify(win));

// E4 win on 6th guess
const e4 = await page.evaluate(() => {
  window.__wordle.setAnswer('ZEBRA');
  for (let i = 0; i < 5; i++) window.__wordle.guess('CRONY');
  const r = window.__wordle.guess('zebra');
  return { r, status: window.__wordle.state().status };
});
rec('E4 6th-guess win = won', e4.r && e4.r.every(x => x === 'green') && e4.status === 'won', JSON.stringify(e4));

// E2 lose reveals answer + E3 hidden while playing
const lose = await page.evaluate(() => {
  window.__wordle.setAnswer('ZEBRA');
  const midHidden = !document.body.innerText.includes('ZEBRA'); // playing: hidden
  for (let i = 0; i < 6; i++) window.__wordle.guess('CRONY');
  const s = window.__wordle.state();
  const revealed = document.body.innerText.includes('ZEBRA');
  const after = window.__wordle.guess('CRANE');
  return { status: s.status, midHidden, revealed, after };
});
rec('E3 answer hidden mid-game', lose.midHidden);
rec('E2 lost + answer revealed + input ignored', lose.status === 'lost' && lose.revealed && lose.after === null, JSON.stringify(lose));

// Default answer playable without setAnswer (F1) — reload fresh
await page.goto(TARGET, { waitUntil: 'load' });
const f1 = await page.evaluate(() => {
  const s = window.__wordle.state();
  const played = window.__wordle.guess('SLATE');
  return { status: s.status, answer: s.answer, ansOk: /^[A-Z]{5}$/.test(s.answer), played };
});
rec('F1 default answer playable', f1.status === 'playing' && f1.ansOk && Array.isArray(f1.played), JSON.stringify(f1));

// Physical typing path: a,b,BS,b,c,d,e,z,Enter -> ABCDE (A3)
await page.evaluate(() => window.__wordle.setAnswer('CRANE'));
await page.focus('body').catch(() => {});
for (const k of ['a', 'b', 'Backspace', 'b', 'c', 'd', 'e', 'z', 'Enter']) {
  await page.keyboard.press(k.length === 1 ? `Key${k.toUpperCase()}` : k).catch(async () => { await page.keyboard.press(k); });
}
const a3 = await page.evaluate(() => window.__wordle.state().guesses);
rec('A3 physical typing -> ABCDE', a3.length === 1 && a3[0] === 'ABCDE', JSON.stringify(a3));

// On-screen keyboard click path (D5): click A,B,BACK,B,C,D,E,ENTER -> ABCDE
await page.evaluate(() => window.__wordle.setAnswer('CRANE'));
for (const lbl of ['A', 'B', 'BACK', 'B', 'C', 'D', 'E', 'ENTER']) {
  await page.click(`[data-key="${lbl}"]`);
}
const d5 = await page.evaluate(() => window.__wordle.state().guesses);
rec('D5 click keyboard -> ABCDE', d5.length === 1 && d5[0] === 'ABCDE', JSON.stringify(d5));

// Keyboard state after CREPE/SPEED for the ~3s screenshot + D-item visual
await page.evaluate(() => { window.__wordle.setAnswer('CREPE'); window.__wordle.guess('SPEED'); });
await page.waitForTimeout(500);
// keyboard classes for S,P,E,E,D
const kbState = await page.evaluate(() => {
  const g = l => { const el = document.querySelector(`[data-key="${l}"]`); return el ? (el.className.match(/green|yellow|gray/) || ['none'])[0] : 'missing'; };
  return { S: g('S'), P: g('P'), E: g('E'), D: g('D'), Z: g('Z') };
});
rec('D1 keyboard best-state CREPE/SPEED', kbState.S === 'gray' && kbState.P === 'yellow' && kbState.E === 'green' && kbState.D === 'gray' && (kbState.Z === 'none'),
  JSON.stringify(kbState));

// wait ~3s from load-ish then screenshot the colored game
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/at-3s.png` });

// hygiene
rec('AC3/F3 zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
rec('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
rec('AC4 no dialogs', dialogs.length === 0, dialogs.join(','));
rec('AC1 zero http(s) requests', netRequests.length === 0, netRequests.join(','));

await browser.close();

const passed = results.filter(r => r.ok).length;
console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
process.exit(0);
