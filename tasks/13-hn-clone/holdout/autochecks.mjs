#!/usr/bin/env node
// Holdout autochecks for ai-benchmark task 13-hn-clone ("Create a Hacker News clone").
// See rubric.md — results[].item maps 1:1 to rubric item numbers (spec.md acceptance criteria).
//
// Usage:   node autochecks.mjs [path/to/candidate.html]
// Default candidate: ../src/index.html relative to this script.
// Output:  ONE JSON document on stdout.
// Exit:    0 = all automated checks pass, 1 = at least one failure, 2 = harness error.
//
// Browser: Chrome via playwright {channel:'chrome'}; falls back to bundled Chromium
// (auto `npx playwright install chromium` if missing). Candidate loads via file:// only.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidateArg = process.argv[2] || path.join(__dirname, '..', 'src', 'index.html');
const candidatePath = path.resolve(candidateArg);

function out(obj, code) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}

if (!fs.existsSync(candidatePath)) {
  out({ error: `candidate file not found: ${candidatePath}`, summary: { total: 16, passed: 0, failed: 16 }, results: [] }, 2);
}

const fileUrl = pathToFileURL(candidatePath).href;

// ---------------- Node-side color helpers ----------------
const parseColor = (s) => {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(s || '');
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
};
const isGray = (c, lo = 70, hi = 200, spread = 25) =>
  !!c && (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) <= spread &&
  (c.r + c.g + c.b) / 3 >= lo && (c.r + c.g + c.b) / 3 <= hi;
const isDark = (c) => !!c && (c.r + c.g + c.b) / 3 <= 150;
const isBlack = (c) => !!c && c.r <= 25 && c.g <= 25 && c.b <= 25;
const isWhiteOrTransparent = (s) => {
  if (!s || s === 'transparent') return true;
  const c = parseColor(s);
  if (!c) return false;
  if (c.a === 0) return true;
  return c.r >= 248 && c.g >= 248 && c.b >= 248;
};

// ---------------- browser launch (chrome channel -> bundled chromium) ----------------
async function launch() {
  const { chromium } = await import('playwright');
  try {
    return { browser: await chromium.launch({ channel: 'chrome', headless: true }), flavor: 'chrome-channel' };
  } catch {
    try {
      return { browser: await chromium.launch({ headless: true }), flavor: 'bundled-chromium' };
    } catch {
      try {
        execSync('npx playwright install chromium', { stdio: 'ignore', cwd: __dirname, timeout: 600000 });
      } catch { /* fall through; final launch below throws the real error */ }
      return { browser: await chromium.launch({ headless: true }), flavor: 'bundled-chromium-installed' };
    }
  }
}

// ---------------- in-page analyzer (serialized; no outer-scope references) ----------------
function ANALYZE() {
  const norm = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const R = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height, cy: r.top + r.height / 2 };
  };
  const CS = (el) => getComputedStyle(el);
  const SKIP = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'];
  const all = Array.from(document.querySelectorAll('body *')).filter((el) => !SKIP.includes(el.tagName));
  const isVis = (el) => {
    const r = el.getBoundingClientRect();
    const s = CS(el);
    return r.width > 0.5 && r.height > 0.5 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || '1') > 0.05;
  };
  const deepest = (pred) =>
    all.filter((el) => pred(el) && !Array.from(el.querySelectorAll('*')).some((c) => !SKIP.includes(c.tagName) && pred(c)));

  // ---- beige column (largest element with exact #f6f6ef background) ----
  let colEl = null;
  let colArea = 0;
  for (const el of [document.body, ...all]) {
    let bg;
    try { bg = CS(el).backgroundColor; } catch { continue; }
    if (bg === 'rgb(246, 246, 239)') {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > colArea) { colArea = r.width * r.height; colEl = el; }
    }
  }
  const column = colEl ? Object.assign(R(colEl), { isBody: colEl === document.body }) : null;

  // ---- orange top bar (topmost sufficiently-wide element with exact #ff6600 bg) ----
  const oranges = [];
  for (const el of all) {
    let bg;
    try { bg = CS(el).backgroundColor; } catch { continue; }
    if (bg === 'rgb(255, 102, 0)') {
      const r = R(el);
      if (r.w >= 200 && r.h >= 8) oranges.push({ el, r });
    }
  }
  oranges.sort((a, b) => a.r.top - b.r.top || b.r.w * b.r.h - a.r.w * a.r.h);
  const barEl = oranges.length ? oranges[0].el : null;
  const bar = barEl ? oranges[0].r : null;

  // ---- top bar contents ----
  let topbar = null;
  if (barEl) {
    const inBar = (el) => barEl.contains(el);
    const loginEls = deepest((el) => inBar(el) && norm(el.textContent).toLowerCase() === 'login');
    const hnEls = deepest((el) => inBar(el) && /hacker news/i.test(norm(el.textContent)) && norm(el.textContent).length <= 30);
    const navEls = deepest((el) => inBar(el) && ['new', 'past', 'comments', 'ask', 'show', 'jobs', 'submit'].includes(norm(el.textContent)));
    const squares = [];
    for (const el of Array.from(barEl.querySelectorAll('*'))) {
      if (SKIP.includes(el.tagName)) continue;
      const r = R(el);
      if (r.w >= 12 && r.w <= 28 && r.h >= 12 && r.h <= 28 && Math.abs(r.w - r.h) <= 8) {
        const s = CS(el);
        squares.push({
          tag: el.tagName.toLowerCase(), left: r.left, w: r.w, h: r.h,
          borderWidth: s.borderTopWidth, borderColor: s.borderTopColor, borderStyle: s.borderTopStyle,
          text: norm(el.textContent).slice(0, 6),
        });
      }
    }
    squares.sort((a, b) => a.left - b.left);
    topbar = {
      text: norm(barEl.textContent),
      login: loginEls.length ? { r: R(loginEls[0]), color: CS(loginEls[0]).color } : null,
      hnWeight: hnEls.length ? CS(hnEls[0]).fontWeight : null,
      navColor: navEls.length ? CS(navEls[0]).color : CS(barEl).color,
      squares: squares.slice(0, 5),
    };
  }

  // ---- ranks ----
  const rankRe = /^\d{1,3}\.$/;
  const rankEls = deepest((el) => rankRe.test(norm(el.textContent)))
    .filter((el) => isVis(el) && (!bar || el.getBoundingClientRect().top > bar.top + 5))
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const ranks = rankEls.map((el) => {
    const s = CS(el);
    const p = el.parentElement;
    return {
      n: parseInt(norm(el.textContent), 10), r: R(el), color: s.color, fontFamily: s.fontFamily,
      textAlign: s.textAlign, parentAlign: p ? CS(p).textAlign : null,
    };
  });

  // ---- upvote arrows (tag them by visual order for Node-side clicking) ----
  const arrowEls = Array.from(document.querySelectorAll('[title="upvote"]'))
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  arrowEls.forEach((el, i) => el.setAttribute('data-hn-holdout-arrow', String(i)));
  const arrows = arrowEls.map((el) => {
    const s = CS(el);
    const t = norm(el.textContent);
    let colorGuess = null;
    if (/[▲△▴]/.test(t)) colorGuess = s.color;
    else if (parseFloat(s.borderBottomWidth) > 2) colorGuess = s.borderBottomColor;
    else if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') colorGuess = s.backgroundColor;
    const cursorOk = s.cursor === 'pointer' || (s.cursor === 'auto' && !!el.closest('a[href], a[onclick], button'));
    return { r: R(el), cursor: s.cursor, cursorOk, visible: isVis(el), colorGuess, tag: el.tagName.toLowerCase() };
  });

  // ---- story title links (leftmost anchor on each rank's line, right of the rank) ----
  const anchors = all.filter((el) => el.tagName === 'A' && isVis(el) && norm(el.textContent).length >= 4);
  const stories = ranks.map((rk) => {
    const cands = anchors
      .filter((a) => {
        const ar = a.getBoundingClientRect();
        return ar.top < rk.r.bottom + 4 && ar.bottom > rk.r.top - 4 && ar.left >= rk.r.right - 2;
      })
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const t = cands[0];
    if (!t) return { rank: rk.n, title: null };
    const s = CS(t);
    return { rank: rk.n, title: { text: norm(t.textContent), r: R(t), color: s.color, fontSize: parseFloat(s.fontSize), fontFamily: s.fontFamily } };
  });

  // ---- (domain.tld) elements ----
  const domRe = /^\((?:[a-z0-9-]+\.)+[a-z]{2,}\)$/i;
  const domEls = deepest((el) => domRe.test(norm(el.textContent))).filter(isVis);
  const domains = domEls.slice(0, 40).map((el) => {
    const s = CS(el);
    return { text: norm(el.textContent), fontSize: parseFloat(s.fontSize), color: s.color };
  });
  const domainMentions = (document.body.innerText.match(/\((?:[a-z0-9-]+\.)+[a-z]{2,}\)/gi) || []).length;

  // ---- subtext lines (exact spec shape) ----
  const subRe = /^(\d+)\s+points?\s+by\s+(\S+)\s+(.+?)\s+ago\s*\|\s*hide\s*\|\s*(\d+)\s+comments?$/i;
  const subEls = deepest((el) => subRe.test(norm(el.textContent)))
    .filter(isVis)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const subtexts = subEls.map((el) => {
    const m = subRe.exec(norm(el.textContent));
    const s = CS(el);
    const link = Array.from(el.querySelectorAll('a')).find((a) => norm(a.textContent).length > 0);
    return {
      text: norm(el.textContent), points: +m[1], user: m[2], ageBody: m[3], comments: +m[4],
      r: R(el), fontSize: parseFloat(s.fontSize), color: s.color, fontFamily: s.fontFamily,
      linkColor: link ? getComputedStyle(link).color : null, hasLinks: !!link,
    };
  });

  // ---- More link (bottom-most element whose exact text is "More"; tag it for clicking) ----
  const moreEls = deepest((el) => norm(el.textContent) === 'More')
    .filter(isVis)
    .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
  let more = null;
  if (moreEls.length) {
    const el = moreEls[0];
    el.setAttribute('data-hn-holdout-more', '1');
    const s = CS(el);
    more = { r: R(el), color: s.color, fontSize: parseFloat(s.fontSize), isAnchor: !!el.closest('a') };
  }

  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    htmlBg: CS(document.documentElement).backgroundColor,
    bodyBg: CS(document.body).backgroundColor,
    bodyFont: CS(document.body).fontFamily,
    bodyTextLen: document.body.innerText.length,
    column, bar, topbar, ranks, arrows, stories, domains, domainMentions, subtexts, more,
  };
}

// ---------------- in-page state reader (post-interaction; lenient re allows "unvote |") ----------------
function READ_STATE() {
  const norm = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const subRe = /^(\d+)\s+points?\s+by\s+(\S+)\s+(.+?)\s+ago\s*\|\s*(?:unvote\s*\|\s*)?hide\s*\|\s*(\d+)\s+comments?$/i;
  const SKIP = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'];
  const all = Array.from(document.querySelectorAll('body *')).filter((el) => !SKIP.includes(el.tagName));
  const isVis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0.5 && r.height > 0.5 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || '1') > 0.05;
  };
  const subs = all
    .filter((el) => subRe.test(norm(el.textContent)) && !Array.from(el.querySelectorAll('*')).some((c) => !SKIP.includes(c.tagName) && subRe.test(norm(c.textContent))))
    .filter(isVis)
    .map((el) => ({ el, top: el.getBoundingClientRect().top }))
    .sort((a, b) => a.top - b.top)
    .map(({ el }) => {
      const m = subRe.exec(norm(el.textContent));
      return { points: +m[1], user: m[2], comments: +m[4] };
    });
  const arrowsAll = Array.from(document.querySelectorAll('[title="upvote"]'));
  const arrow0 = document.querySelector('[data-hn-holdout-arrow="0"]');
  return {
    points: subs.map((s) => s.points),
    users: subs.map((s) => s.user),
    comments: subs.map((s) => s.comments),
    visibleArrows: arrowsAll.filter(isVis).length,
    arrow0Visible: arrow0 ? isVis(arrow0) : false,
    marker: window.__hnHoldoutMarker === 'set',
  };
}

// ---------------- main ----------------
async function main() {
  const { browser, flavor } = await launch();
  const results = [];
  const add = (item, name, pass, detail, manualReview = false) =>
    results.push({ item, name, pass: !!pass, manualReview, detail });

  let screenshotPath = null;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    const consoleErrors = [];
    const pageErrors = [];
    const dialogs = [];
    const httpRequests = [];
    const fileSubresources = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('dialog', async (d) => { dialogs.push(d.type()); try { await d.dismiss(); } catch { /* ignore */ } });
    page.on('request', (req) => {
      const u = req.url();
      if (/^(https?|wss?):/i.test(u)) httpRequests.push(u.slice(0, 200));
      else if (u.startsWith('file:') && req.resourceType() !== 'document') fileSubresources.push(u.slice(0, 200));
    });

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(500);
    const loadConsoleErrors = consoleErrors.slice();
    const loadPageErrors = pageErrors.slice();
    const title = await page.title();

    const A = await page.evaluate(ANALYZE);

    screenshotPath = path.join(os.tmpdir(), `hn-clone-holdout-${Date.now()}.png`);
    try { await page.screenshot({ path: screenshotPath, fullPage: true }); } catch { screenshotPath = null; }

    // ---- interactions: upvote story 1 ----
    await page.evaluate(() => { window.__hnHoldoutMarker = 'set'; });
    const before = await page.evaluate(READ_STATE);
    let clickError = null;
    try { await page.click('[data-hn-holdout-arrow="0"]', { timeout: 4000 }); } catch (e) { clickError = String(e).slice(0, 200); }
    await page.waitForTimeout(300);
    const after1 = await page.evaluate(READ_STATE).catch(() => null);

    // guarded second click (only meaningful if the arrow is still visible)
    const secondClick = { attempted: false, clicked: false };
    if (after1 && after1.arrow0Visible) {
      secondClick.attempted = true;
      try {
        await page.click('[data-hn-holdout-arrow="0"]', { timeout: 2000 });
        secondClick.clicked = true;
      } catch { /* not clickable -> fine */ }
      await page.waitForTimeout(300);
    }
    const after2 = await page.evaluate(READ_STATE).catch(() => null);

    // ---- More click (last: may legitimately reload the page) ----
    const errsBeforeMore = pageErrors.length;
    const dlgsBeforeMore = dialogs.length;
    let moreResult = null;
    if (A.more) {
      try {
        await page.click('[data-hn-holdout-more]', { timeout: 4000 });
        await page.waitForTimeout(600);
        const url = page.url();
        moreResult = {
          clicked: true,
          stillHere: url.split('#')[0] === fileUrl.split('#')[0],
          textLen: await page.evaluate(() => document.body.innerText.length).catch(() => 0),
          newErrors: pageErrors.length - errsBeforeMore,
          newDialogs: dialogs.length - dlgsBeforeMore,
        };
      } catch (e) {
        moreResult = { clicked: false, error: String(e).slice(0, 200) };
      }
    }

    // ---- viewport robustness (fresh loads) ----
    const widthChecks = [];
    for (const w of [1024, 1440]) {
      const p2 = await context.newPage();
      let entry = { width: w };
      try {
        await p2.setViewportSize({ width: w, height: 900 });
        await p2.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });
        await p2.waitForTimeout(250);
        entry = await p2.evaluate((wv) => ({
          width: wv,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          textLen: document.body.innerText.length,
        }), w);
      } catch (e) {
        entry.error = String(e).slice(0, 200);
      }
      widthChecks.push(entry);
      await p2.close();
    }

    // ================= grading =================

    // 1. loads clean
    {
      const titleOk = title === 'Hacker News';
      const errOk = loadConsoleErrors.length === 0 && loadPageErrors.length === 0;
      const netOk = httpRequests.length === 0;
      add(1, 'loads clean: zero console errors, zero network requests, title exactly "Hacker News"',
        titleOk && errOk && netOk,
        { title, titleOk, consoleErrorsAtLoad: loadConsoleErrors.slice(0, 5), pageErrorsAtLoad: loadPageErrors.slice(0, 5), httpRequests: httpRequests.slice(0, 10), fileSubresourceWarnings: fileSubresources.slice(0, 10) });
    }

    // 2. page frame
    {
      const col = A.column;
      const ratio = col ? col.w / A.innerWidth : 0;
      const widthOk = !!col && ratio >= 0.80 && ratio <= 0.90;
      const centeredOk = !!col && Math.abs(col.left - (A.innerWidth - col.right)) <= 30;
      const outsideOk = col
        ? (col.isBody ? isWhiteOrTransparent(A.htmlBg) : isWhiteOrTransparent(A.htmlBg) && isWhiteOrTransparent(A.bodyBg))
        : false;
      const tFam = (A.stories.find((s) => s.title) || {}).title;
      const fontOk = /verdana/i.test((tFam && tFam.fontFamily) || '') && /verdana/i.test((A.subtexts[0] && A.subtexts[0].fontFamily) || '');
      add(2, 'centered 85% beige #f6f6ef column on white page; Verdana typography',
        widthOk && centeredOk && outsideOk && fontOk,
        { columnFound: !!col, ratio: +ratio.toFixed(3), centeredOk, htmlBg: A.htmlBg, bodyBg: A.bodyBg, titleFont: tFam ? tFam.fontFamily : null, subtextFont: A.subtexts[0] ? A.subtexts[0].fontFamily : null });
    }

    // 3. orange top bar spans the column
    {
      const b = A.bar;
      const col = A.column;
      const pass = !!b && !!col && b.w >= 0.9 * col.w && b.w <= col.w + 8 &&
        b.left >= col.left - 8 && b.right <= col.right + 8 &&
        b.top >= col.top - 8 && b.top - col.top <= 30;
      add(3, 'orange #ff6600 bar at top of column, spanning its width', pass,
        { barFound: !!b, bar: b, columnTop: col ? col.top : null, columnW: col ? col.w : null });
    }

    // 4. top bar contents: logo mark, bold "Hacker News", exact nav
    {
      const t = A.topbar;
      const navRe = /new\s*\|\s*past\s*\|\s*comments\s*\|\s*ask\s*\|\s*show\s*\|\s*jobs\s*\|\s*submit/;
      const navOk = !!t && navRe.test(t.text);
      const hnOk = !!t && /Hacker News/.test(t.text);
      const boldOk = !!t && t.hnWeight !== null && (t.hnWeight === 'bold' || parseInt(t.hnWeight, 10) >= 600);
      const sq = t && t.squares.length ? t.squares[0] : null;
      const bw = sq ? parseFloat(sq.borderWidth) : 0;
      const bc = sq ? parseColor(sq.borderColor) : null;
      const borderOk = !!sq && bw >= 0.5 && bw <= 3 && !!bc && bc.r >= 200 && bc.g >= 200 && bc.b >= 200 && sq.borderStyle !== 'none';
      const graphical = !!sq && ['svg', 'img', 'canvas'].includes(sq.tag);
      add(4, 'top bar: ~18px square logo w/ 1px white border, bold "Hacker News", exact nav order',
        navOk && hnOk && boldOk && !!sq && (borderOk || graphical),
        { navOk, hnOk, hnWeight: t ? t.hnWeight : null, logoSquare: sq, borderOk, graphicalLogo: graphical, barText: t ? t.text.slice(0, 160) : null },
        /* manualReview: white-"Y" glyph look is a screenshot judgment; border too if graphical */ true);
    }

    // 5. login flush right; dark top-bar text
    {
      const t = A.topbar;
      const b = A.bar;
      const loginOk = !!t && !!t.login;
      const flushOk = loginOk && !!b && (b.right - t.login.r.right) <= 40 && (b.right - t.login.r.right) >= -2;
      const navC = t ? parseColor(t.navColor) : null;
      const loginC = loginOk ? parseColor(t.login.color) : null;
      const darkOk = isDark(navC) && (loginOk ? isDark(loginC) : false);
      add(5, 'login link flush at right edge; top-bar text dark (not white)', loginOk && flushOk && darkOk,
        { loginFound: loginOk, gapToRightEdge: loginOk && b ? +(b.right - t.login.r.right).toFixed(1) : null, navColor: t ? t.navColor : null, loginColor: loginOk ? t.login.color : null });
    }

    // 6. 20+ varied stories
    {
      const n = A.ranks.length;
      const distinct = (arr) => new Set(arr).size;
      const titles = A.stories.filter((s) => s.title).map((s) => s.title.text);
      const pts = A.subtexts.map((s) => s.points);
      const cms = A.subtexts.map((s) => s.comments);
      const users = A.subtexts.map((s) => s.user);
      const ages = A.subtexts.map((s) => s.ageBody);
      const titlesOk = titles.length >= 20 && distinct(titles) === titles.length;
      const ptsOk = pts.length >= 20 && distinct(pts) >= Math.ceil(0.8 * pts.length);
      const cmsOk = cms.length >= 20 && distinct(cms) >= Math.ceil(0.8 * cms.length);
      const miscOk = distinct(users) >= 3 && distinct(ages) >= 3;
      add(6, '20+ stories with varied titles/points/comments/authors/ages', n >= 20 && titlesOk && ptsOk && cmsOk && miscOk,
        { storyCount: n, titleCount: titles.length, distinctTitles: distinct(titles), distinctPoints: distinct(pts), distinctComments: distinct(cms), distinctUsers: distinct(users), distinctAges: distinct(ages) });
    }

    // 7. rank format: "N." consecutive from 1, right-aligned, gray
    {
      const ns = A.ranks.map((r) => r.n);
      const consecutive = ns.length >= 20 && ns.every((v, i) => v === i + 1);
      const colorOk = A.ranks.length > 0 && isGray(parseColor(A.ranks[0].color), 70, 200, 25);
      let alignOk = A.ranks.some((r) => r.textAlign === 'right' || r.parentAlign === 'right');
      let alignMethod = alignOk ? 'computed text-align' : 'none';
      if (!alignOk && A.ranks.length >= 10) {
        const r9 = A.ranks[8].r;
        const r10 = A.ranks[9].r;
        alignOk = Math.abs(r9.right - r10.right) <= 3 && r10.left <= r9.left - 2;
        if (alignOk) alignMethod = 'geometric (right edges of "9." and "10." align)';
      }
      add(7, 'ranks "1., 2., ..." consecutive, right-aligned, gray', consecutive && colorOk && alignOk,
        { count: ns.length, first5: ns.slice(0, 5), consecutive, rankColor: A.ranks[0] ? A.ranks[0].color : null, alignMethod });
    }

    // 8. upvote triangle: ~10px, cursor pointer, title="upvote", between rank and title, gray
    {
      const arr = A.arrows;
      const need = Math.min(20, A.ranks.length || 20);
      const countOk = arr.length >= need;
      const a0 = arr[0];
      const sizeOk = !!a0 && a0.r.w >= 5 && a0.r.w <= 22 && a0.r.h >= 5 && a0.r.h <= 22;
      const cursorOk = !!a0 && a0.cursorOk;
      let posOk = false;
      if (a0 && A.ranks[0] && A.stories[0] && A.stories[0].title) {
        posOk = a0.r.left >= A.ranks[0].r.right - 3 && A.stories[0].title.r.left >= a0.r.right - 3;
      }
      const gc = a0 && a0.colorGuess ? parseColor(a0.colorGuess) : null;
      const grayKnown = gc ? isGray(gc, 100, 210, 30) : null; // null => can't read fill (svg/img) -> screenshot
      add(8, 'gray ~10px upvote triangle with cursor:pointer and title="upvote", between rank and title',
        countOk && sizeOk && cursorOk && posOk && grayKnown !== false,
        { arrowCount: arr.length, first: a0 || null, positionOk: posOk, colorGuess: a0 ? a0.colorGuess : null, grayKnown },
        grayKnown === null);
    }

    // 9. black ~10pt title link; (domain) smaller gray
    {
      const t0 = (A.stories.find((s) => s.title) || {}).title;
      const blackOk = !!t0 && isBlack(parseColor(t0.color));
      const sizeOk = !!t0 && t0.fontSize >= 12 && t0.fontSize <= 15;
      const domCountOk = A.domainMentions >= 10;
      const d0 = A.domains[0] || null;
      const domStyleOk = d0 ? (d0.fontSize <= (t0 ? t0.fontSize - 0.5 : 12) && isGray(parseColor(d0.color), 90, 200, 30)) : null;
      add(9, 'title = black ~10pt link; domain in parens smaller + gray',
        blackOk && sizeOk && domCountOk && domStyleOk !== false,
        { titleColor: t0 ? t0.color : null, titleFontSize: t0 ? t0.fontSize : null, domainMentions: A.domainMentions, firstDomain: d0 },
        domStyleOk === null);
    }

    // 10. subtext exact shape, ~7pt #828282, indented to the title
    {
      const count = A.subtexts.length;
      const s0 = A.subtexts[0] || null;
      const sizeOk = !!s0 && s0.fontSize >= 8 && s0.fontSize <= 11.5;
      const gray = s0 ? parseColor(s0.color) : null;
      const grayOk = !!gray && isGray(gray, 110, 150, 20); // pinned near #828282 (avg 130)
      let indentOk = false;
      if (s0 && A.stories[0] && A.stories[0].title && A.ranks[0]) {
        indentOk = Math.abs(s0.r.left - A.stories[0].title.r.left) <= 25 &&
          s0.r.left >= A.ranks[0].r.left + 8 &&
          s0.r.top >= A.stories[0].title.r.top;
      }
      add(10, 'subtext "{points} points by {user} {age} | hide | {n} comments", ~7pt #828282, title-indented',
        count >= 20 && sizeOk && grayOk && indentOk,
        { matchingSubtextLines: count, sample: s0 ? s0.text : null, fontSize: s0 ? s0.fontSize : null, color: s0 ? s0.color : null, indentOk });
    }

    // 11. relative HN-style ages everywhere
    {
      const ageRe = /^\d+\s+(minute|hour|day|month|year)s?$/i;
      const ok = A.subtexts.length >= 20 && A.subtexts.every((s) => ageRe.test(s.ageBody));
      add(11, 'ages are relative strings ("2 hours ago"), never absolute dates', ok,
        { sampleAges: A.subtexts.slice(0, 5).map((s) => s.ageBody + ' ago'), badAges: A.subtexts.filter((s) => !ageRe.test(s.ageBody)).slice(0, 5).map((s) => s.ageBody) });
    }

    // 12. subtext links same gray; dense rows (~5px gaps)
    {
      const s0 = A.subtexts[0] || null;
      let linkParity = null;
      if (s0 && s0.hasLinks) {
        const a = parseColor(s0.linkColor);
        const b = parseColor(s0.color);
        linkParity = !!a && !!b && Math.abs(a.r - b.r) <= 30 && Math.abs(a.g - b.g) <= 30 && Math.abs(a.b - b.b) <= 30 && isGray(a, 100, 180, 25);
      } else if (s0) {
        linkParity = null; // no anchors in subtext: vacuous -> screenshot judgment
      } else {
        linkParity = false;
      }
      let pitchOk = false;
      let medianPitch = null;
      if (A.ranks.length >= 5) {
        const tops = A.ranks.map((r) => r.r.top);
        const pitches = tops.slice(1).map((t, i) => t - tops[i]).sort((x, y) => x - y);
        medianPitch = pitches[Math.floor(pitches.length / 2)];
        pitchOk = medianPitch > 20 && medianPitch <= 70;
      }
      add(12, 'subtext links same gray as subtext; list dense (~5px row gaps)',
        linkParity !== false && pitchOk,
        { subtextHasLinks: s0 ? s0.hasLinks : null, linkColor: s0 ? s0.linkColor : null, subtextColor: s0 ? s0.color : null, medianRowPitchPx: medianPitch },
        linkParity === null);
    }

    // 13. upvote increments exactly that story by 1, no reload/dialog
    {
      let pass = false;
      const detail = { clickError, dialogs: dialogs.slice(0, 3) };
      if (before && after1 && before.points.length >= 20 && after1.points.length === before.points.length) {
        let incOk = after1.points[0] === before.points[0] + 1;
        let othersOk = before.points.slice(1).every((p, i) => after1.points[i + 1] === p);
        let method = 'index';
        if (!(incOk && othersOk)) {
          // fallback: match stories by (user|comments) key in case the DOM reordered
          const keyB = before.users.map((u, i) => u + '|' + before.comments[i]);
          const keyA = after1.users.map((u, i) => u + '|' + after1.comments[i]);
          if (new Set(keyB).size === keyB.length && new Set(keyA).size === keyA.length) {
            const mapA = new Map(keyA.map((k, i) => [k, after1.points[i]]));
            let plusOne = 0;
            let same = 0;
            for (let i = 0; i < keyB.length; i++) {
              const av = mapA.get(keyB[i]);
              if (av === before.points[i] + 1) plusOne++;
              else if (av === before.points[i]) same++;
            }
            incOk = plusOne === 1;
            othersOk = same === keyB.length - 1;
            method = 'keyed (user|comments)';
          }
        }
        pass = incOk && othersOk && after1.marker === true && dialogs.length === 0 && !clickError;
        Object.assign(detail, { before0: before.points[0], after0: after1.points[0], incrementedExactlyOne: incOk, othersUnchanged: othersOk, noReload: after1.marker === true, method });
      } else {
        Object.assign(detail, { parsedBefore: before ? before.points.length : 0, parsedAfter: after1 ? after1.points.length : 0 });
      }
      add(13, 'clicking upvote increments THAT story by exactly 1 (no reload, no dialog)', pass, detail);
    }

    // 14. arrow disappears after voting; at most one increment; wording intact
    {
      let pass = false;
      const detail = { secondClick };
      if (before && after1) {
        const hidden = after1.visibleArrows === before.visibleArrows - 1 && after1.arrow0Visible === false;
        const wordingOk = after1.points.length === before.points.length;
        const singleIncrement = !!after2 && after2.points.length === before.points.length && after2.points[0] === before.points[0] + 1;
        pass = hidden && wordingOk && singleIncrement;
        Object.assign(detail, {
          visibleArrowsBefore: before.visibleArrows, visibleArrowsAfter: after1.visibleArrows,
          votedArrowStillVisible: after1.arrow0Visible, allSubtextsStillParse: wordingOk,
          pointsAfterSecondAttempt: after2 ? after2.points[0] : null, expected: before.points[0] + 1,
        });
      }
      add(14, 'voted arrow disappears; points can rise at most once; "N points" wording kept', pass, detail);
    }

    // 15. More link below the list; click-safe; styled like a title link
    {
      const m = A.more;
      const lastSub = A.subtexts[A.subtexts.length - 1] || null;
      const belowOk = !!m && !!lastSub && m.r.top >= lastSub.r.top;
      const styleOk = !!m && isBlack(parseColor(m.color)) && m.fontSize >= 11 && m.fontSize <= 15;
      const safeOk = !!moreResult && moreResult.clicked && moreResult.stillHere && moreResult.newErrors === 0 && moreResult.newDialogs === 0 && moreResult.textLen > 200;
      add(15, '"More" link below last story, styled like a title link, safe to click', belowOk && styleOk && safeOk,
        { moreFound: !!m, more: m, belowOk, styleOk, moreClick: moreResult });
    }

    // 16. desktop-width robustness + no uncaught exceptions during interactions
    {
      const wOk = widthChecks.every((w) => !w.error && w.scrollWidth <= w.clientWidth + 1 && w.textLen > 200);
      const interactionErrors = pageErrors.slice(loadPageErrors.length);
      add(16, 'no horizontal scroll at 1024/1440px; never blank; no uncaught exceptions', wOk && interactionErrors.length === 0 && A.bodyTextLen > 200,
        { widthChecks, interactionErrors: interactionErrors.slice(0, 5), bodyTextLen: A.bodyTextLen });
    }

    await browser.close();

    const passed = results.filter((r) => r.pass).length;
    out({
      candidate: candidatePath,
      fileUrl,
      browser: flavor,
      checkedAt: new Date().toISOString(),
      screenshot: screenshotPath,
      summary: { total: 16, passed, failed: 16 - passed, manualReviewItems: results.filter((r) => r.manualReview).map((r) => r.item) },
      results,
    }, passed === 16 ? 0 : 1);
  } catch (err) {
    try { await browser.close(); } catch { /* ignore */ }
    out({ error: String(err && err.stack ? err.stack : err).slice(0, 1500), candidate: candidatePath, browser: flavor, results }, 2);
  }
}

main().catch((err) => out({ error: String(err && err.stack ? err.stack : err).slice(0, 1500) }, 2));
