// Independent verifier pass (round 0) — NOT the builder's harness.
// Loads src/index.html via file://, takes screenshots at ~0s and ~3s,
// and independently re-checks the items most in question (logo border,
// upvote scope/increment, arrow-hide, More link safety).
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const HOLDOUT = 'C:/Users/iamjo/Projects/ai-benchmark/tasks/13-hn-clone/holdout/';
const require = createRequire(HOLDOUT);
const { chromium } = require('playwright');

const CAND = 'C:/Users/iamjo/Projects/ai-benchmark/tasks/13-hn-clone/src/index.html';
const OUT = 'C:/Users/iamjo/Projects/ai-benchmark/tasks/13-hn-clone/verify/round-0';
const fileUrl = 'file:///' + CAND.replace(/\\/g, '/');

const out = {};

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' });
} catch (e) {
  out.channelNote = 'chrome channel failed, falling back to bundled chromium: ' + e.message;
  browser = await chromium.launch();
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
const netRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('request', (r) => { const u = r.url(); if (/^https?:|^ws:/.test(u)) netRequests.push(u); });
page.on('dialog', async (d) => { out.dialogFired = d.type(); await d.dismiss(); });

await page.goto(fileUrl, { waitUntil: 'load' });

// screenshot ~0s
await page.screenshot({ path: path.join(OUT, 'shot-0s.png'), fullPage: true });

// --- Independent logo inspection: find the element that visually IS the mark ---
out.logo = await page.evaluate(() => {
  // the actual logo mark per the DOM (the innermost styled box holding the "Y")
  const mark = document.querySelector('.logo-mark');
  const td = document.querySelector('#logo-cell');
  const info = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      borderTopWidth: s.borderTopWidth, borderTopStyle: s.borderTopStyle, borderTopColor: s.borderTopColor,
      color: s.color, bg: s.backgroundColor, text: (el.textContent || '').trim().slice(0, 4),
      fontWeight: s.fontWeight,
    };
  };
  return { mark: info(mark), td: info(td) };
});

out.title = await page.title();
out.consoleErrors = consoleErrors;
out.pageErrors = pageErrors;
out.netRequests = netRequests;

// --- Independent upvote check: increment scope + arrow hide ---
out.upvote = await page.evaluate(() => {
  const parsePts = () => Array.from(document.querySelectorAll('.score')).map((e) => {
    const m = (e.textContent || '').match(/(\d+)\s+points?/); return m ? +m[1] : null;
  });
  const before = parsePts();
  const arrows = Array.from(document.querySelectorAll('[title="upvote"]'));
  const visibleBefore = arrows.filter((a) => a.offsetParent !== null || a.getClientRects().length).length;
  arrows[0].click();
  const after = parsePts();
  const arrows2 = Array.from(document.querySelectorAll('[title="upvote"]'));
  const visibleAfter = arrows2.filter((a) => {
    const cs = getComputedStyle(a); return cs.display !== 'none' && cs.visibility !== 'hidden' && (a.getClientRects().length > 0);
  }).length;
  // second click attempt on story 0's arrow (should be gone/inert)
  let secondChanged = false;
  const a0 = document.querySelectorAll('[title="upvote"]')[0];
  const s0mid = after[0];
  // try clicking the first arrow that still maps to story 0 if visible
  if (a0) { try { a0.click(); } catch (e) {} }
  const after2 = parsePts();
  secondChanged = after2[0] !== s0mid;
  const othersUnchanged = before.slice(1).every((v, i) => v === after[i + 1]);
  return {
    before0: before[0], after0: after[0], delta0: after[0] - before[0],
    othersUnchanged, visibleBefore, visibleAfter,
    story0PointsAfterSecond: after2[0], secondClickChangedStory0: secondChanged,
    allParse: after2.every((v) => typeof v === 'number' && v > 0),
  };
});

// --- More link safety ---
out.more = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a')).filter((a) => (a.textContent || '').trim() === 'More');
  const el = links[links.length - 1];
  const beforeUrl = location.href;
  if (el) el.click();
  return { found: !!links.length, urlChanged: location.href !== beforeUrl, bodyLen: document.body.innerText.length };
});

// wait ~3s and screenshot again (post-interaction, steady state)
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(OUT, 'shot-3s.png'), fullPage: true });

// close-up screenshot of the top bar for the logo judgment
try {
  const bar = await page.$('#header');
  if (bar) await bar.screenshot({ path: path.join(OUT, 'shot-topbar.png') });
} catch (e) {}

out.consoleErrorsFinal = consoleErrors;
out.pageErrorsFinal = pageErrors;
out.netRequestsFinal = netRequests;

console.log(JSON.stringify(out, null, 2));
await browser.close();
