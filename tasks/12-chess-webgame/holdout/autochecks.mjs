// Holdout autochecks for Task 12 — Playable Chess Web Game.
// Usage: node autochecks.mjs [path-to-candidate-index.html]   (default ../src/index.html)
// Prints one JSON document to stdout: {summary, gates, criteria, results:[{id,criterion,desc,status,detail}]}.
//   status: "pass" | "fail" | "skip"   (skip = needs human screenshot judgment per rubric.md).
// Exit code: 0 = ran, no FAILs; 1 = at least one FAIL (autocheck or gate); 2 = fatal (couldn't run).
//
// Design: window.__chess is the only reset mechanism the spec guarantees is absent — there is no
// resetBoard() hook — so every scenario RELOADS the page (file://) to get a fresh initial position.
// Console/dialog/request listeners persist across navigations and are aggregated into the gates.
// All 66 chess sequences below were validated move-by-move against chess.js (a FIDE-correct engine)
// before freezing; see the holdout author's oracle. If the candidate disagrees with any expected
// accept/reject/board-state, the candidate is wrong.

import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] ?? join(__dirname, '..', 'src', 'index.html'));
const ARTIFACTS = process.env.AUTOCHECK_ARTIFACTS || join(tmpdir(), '12-chess-autocheck-artifacts');

function fatal(msg) {
  console.log(JSON.stringify({ fatal: msg, summary: null, results: [] }, null, 2));
  process.exit(2);
}
try { mkdirSync(ARTIFACTS, { recursive: true }); } catch { /* ignore */ }

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { fatal('playwright not installed — run: npm install  (inside holdout/)'); }

let browser = null;
try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
catch {
  try { browser = await chromium.launch({ headless: true }); }
  catch (e) { fatal('no Chrome/Chromium — run: npx playwright install chromium  (' + String(e.message).split('\n')[0] + ')'); }
}

// ---------------------------------------------------------------- reporting
const results = [];
function report(id, criterion, desc, status, detail = '') { results.push({ id, criterion, desc, status, detail }); }
async function check(id, criterion, desc, fn) {
  try {
    const r = await fn();
    if (r === true) report(id, criterion, desc, 'pass');
    else if (r === false) report(id, criterion, desc, 'fail');
    else report(id, criterion, desc, r.status, r.detail || '');
  } catch (e) {
    report(id, criterion, desc, 'fail', 'checker exception: ' + String(e.message || e).slice(0, 300));
  }
}

// ---------------------------------------------------------------- page + aggregate trackers
const page = await browser.newPage();
await page.setViewportSize({ width: 900, height: 900 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 100)); await d.dismiss().catch(() => {}); });
const badRequests = [];
page.on('request', (r) => { const u = r.url(); if (!/^(file|data|blob|about):/i.test(u)) badRequests.push(u); });

const url = pathToFileURL(target).href;
async function reset() { await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(120); }
await reset();
const loadErrorCount = consoleErrors.length;

// ---------------------------------------------------------------- hook plumbing
const FILES = 'abcdefgh';
const INITIAL = {
  a1: 'wR', b1: 'wN', c1: 'wB', d1: 'wQ', e1: 'wK', f1: 'wB', g1: 'wN', h1: 'wR',
  a2: 'wP', b2: 'wP', c2: 'wP', d2: 'wP', e2: 'wP', f2: 'wP', g2: 'wP', h2: 'wP',
  a7: 'bP', b7: 'bP', c7: 'bP', d7: 'bP', e7: 'bP', f7: 'bP', g7: 'bP', h7: 'bP',
  a8: 'bR', b8: 'bN', c8: 'bB', d8: 'bQ', e8: 'bK', f8: 'bB', g8: 'bN', h8: 'bR',
};
function canon(obj) {
  if (!obj || typeof obj !== 'object') return String(obj);
  return JSON.stringify(Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : 1))));
}

const hookInfo = await page.evaluate(() => {
  const w = window.__chess;
  if (!w || typeof w !== 'object') return { exists: false };
  const boardIsFn = typeof w.board === 'function';
  const moveIsFn = typeof w.move === 'function';
  let turnVal = null; try { turnVal = w.turn; } catch { /* getter throw */ }
  const turnOk = turnVal === 'w' || turnVal === 'b';
  let freshOk = false, freshDetail = '';
  if (boardIsFn) {
    try {
      const b1 = w.board();
      const k = Object.keys(b1)[0];
      if (k) b1[k] = 'XX';
      b1.__inject = 'ZZ';
      const b2 = w.board();
      freshOk = b2 && b2.__inject === undefined && (!k || b2[k] !== 'XX');
      if (!freshOk) freshDetail = 'mutating board() leaked into next board()';
    } catch (e) { freshDetail = 'board() threw: ' + String(e.message || e).slice(0, 80); }
  }
  return { exists: true, boardIsFn, moveIsFn, turnOk, turnVal: String(turnVal), freshOk, freshDetail };
});
const hasHook = !!(hookInfo.exists && hookInfo.boardIsFn && hookInfo.moveIsFn && hookInfo.turnOk);
const HOOK_MISSING = { status: 'fail', detail: 'window.__chess hook missing/incomplete — cannot verify (see G1)' };

async function getBoard() { return page.evaluate(() => window.__chess.board()); }
async function getTurn() { return page.evaluate(() => window.__chess.turn); }
async function rawMove(from, to, promo) {
  return page.evaluate(([f, t, p]) => {
    try { const r = (p != null) ? window.__chess.move(f, t, p) : window.__chess.move(f, t); return { ok: true, r }; }
    catch (e) { return { ok: false, err: String((e && e.message) || e).slice(0, 120) }; }
  }, [from, to, promo ?? null]);
}
async function doMove(from, to, promo) { const r = await rawMove(from, to, promo); return r.ok ? r.r : { __threw: r.err }; }

// contract tracker (spec criterion 12 / Rejected-move definition)
const contractViolations = [];
async function expectReject(from, to, promo, { contract = true } = {}) {
  const b0 = await getBoard(), t0 = await getTurn();
  const ret = await doMove(from, to, promo);
  const b1 = await getBoard(), t1 = await getTurn();
  const retFalse = ret === false, boardSame = canon(b0) === canon(b1), turnSame = t0 === t1;
  const ok = retFalse && boardSame && turnSame;
  if (contract && !ok) {
    contractViolations.push(`${from}${to}${promo ? '=' + promo : ''}: ret=${JSON.stringify(ret)} boardSame=${boardSame} turnSame=${turnSame}`);
  }
  return { ok, ret, retFalse, boardSame, turnSame };
}
async function expectAccept(from, to, promo) {
  const t0 = await getTurn();
  const ret = await doMove(from, to, promo);
  const t1 = await getTurn();
  const ok = ret === true && (t0 === 'w' || t0 === 'b') && t0 !== t1;
  return { ok, ret, t0, t1 };
}
async function expectLocked(from, to, promo) {
  const b0 = await getBoard();
  const ret = await doMove(from, to, promo);
  const b1 = await getBoard();
  return { ok: ret === false && canon(b0) === canon(b1), ret };
}
// reset + play a backbone of accepted moves; returns {ok, detail}
async function setup(moves) {
  await reset();
  if (!hasHook) return { ok: false, detail: 'no hook' };
  for (const [f, t, p] of moves) {
    const r = await expectAccept(f, t, p);
    if (!r.ok) return { ok: false, detail: `setup ${f}${t}${p ? '=' + p : ''} not accepted (ret=${JSON.stringify(r.ret)}, turn ${r.t0}->${r.t1})` };
  }
  return { ok: true };
}
async function bodyText() { return page.evaluate(() => (document.body.innerText || document.body.textContent || '')); }

// ---------------------------------------------------------------- DOM board locator (heuristic)
const LOCATE = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cand = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 20 || r.width > 240) continue;
    if (Math.abs(r.width - r.height) > Math.max(6, r.width * 0.30)) continue;
    cand.push({ el, x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 });
  }
  if (cand.length < 64) return null;
  const sizeCount = new Map();
  for (const c of cand) { const k = Math.round(c.w / 4) * 4; sizeCount.set(k, (sizeCount.get(k) || 0) + 1); }
  let bestSize = null, bestN = 0;
  for (const [k, n] of sizeCount) { if (n > bestN) { bestN = n; bestSize = k; } }
  const cells = cand.filter((c) => Math.abs(Math.round(c.w / 4) * 4 - bestSize) <= 8);
  const tol = bestSize * 0.5;
  const clusters = (vals) => {
    const sorted = [...vals].sort((a, b) => a - b), groups = [];
    for (const v of sorted) {
      const g = groups.find((g) => Math.abs(g.c - v) < tol);
      if (g) { g.vals.push(v); g.c = g.vals.reduce((a, b) => a + b, 0) / g.vals.length; }
      else groups.push({ c: v, vals: [v] });
    }
    return groups.map((g) => g.c);
  };
  const rowsC = clusters(cells.map((c) => c.cy)).sort((a, b) => a - b);
  const colsC = clusters(cells.map((c) => c.cx)).sort((a, b) => a - b);
  if (rowsC.length !== 8 || colsC.length !== 8) return null;
  const nearest = (v, arr) => { let bi = 0, bd = Infinity; arr.forEach((a, i) => { const d = Math.abs(a - v); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const grid = {};
  for (const c of cells) {
    const key = nearest(c.cx, colsC) + ',' + nearest(c.cy, rowsC);
    if (!grid[key] || c.w < grid[key].w) grid[key] = c;
  }
  const F = 'abcdefgh', map = {};
  for (let ci = 0; ci < 8; ci++) for (let ri = 0; ri < 8; ri++) {
    const cell = grid[ci + ',' + ri];
    if (!cell) return null;
    let node = cell.el, bg = getComputedStyle(node).backgroundColor, d = 0;
    while ((bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && node.parentElement && d < 3) { node = node.parentElement; bg = getComputedStyle(node).backgroundColor; d++; }
    map[F[ci] + (8 - ri)] = { x: cell.x, y: cell.y, w: cell.w, h: cell.h, cx: cell.cx, cy: cell.cy, bg };
  }
  return map;
})()`;
async function locate() { try { return await page.evaluate(LOCATE); } catch { return null; } }
function relLum(rgb) { const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(rgb || ''); if (!m) return null; const [r, g, b] = [+m[1], +m[2], +m[3]].map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
async function clickSquare(bm, sq) { await page.mouse.click(bm[sq].cx, bm[sq].cy); await page.waitForTimeout(70); }
async function shot(name, clip) { try { await page.screenshot({ path: join(ARTIFACTS, name), clip }); } catch { /* clip out of range */ } }

const FOOLS = [['f2', 'f3'], ['e7', 'e6'], ['g2', 'g4'], ['d8', 'h4']];
const LOYD = [['e2', 'e3'], ['a7', 'a5'], ['d1', 'h5'], ['a8', 'a6'], ['h5', 'a5'], ['h7', 'h5'],
  ['a5', 'c7'], ['a6', 'h6'], ['h2', 'h4'], ['f7', 'f6'], ['c7', 'd7'], ['e8', 'f7'],
  ['d7', 'b7'], ['d8', 'd3'], ['b7', 'b8'], ['d3', 'h7'], ['b8', 'c8'], ['f7', 'g6'], ['c8', 'e6']];

// ================================================================ GATE G1 (hook shape)
await check('G1', 'G', 'Test hook shape: window.__chess {board(),turn,move()} + fresh snapshot', async () => {
  if (!hookInfo.exists) return { status: 'fail', detail: 'window.__chess is missing after file:// load (G0)' };
  const problems = [];
  if (!hookInfo.boardIsFn) problems.push('board is not a function');
  if (!hookInfo.moveIsFn) problems.push('move is not a function');
  if (!hookInfo.turnOk) problems.push(`turn = ${hookInfo.turnVal} (expected "w"/"b")`);
  if (!hookInfo.freshOk) problems.push('board() not a fresh snapshot: ' + hookInfo.freshDetail);
  return problems.length ? { status: 'fail', detail: problems.join('; ') } : true;
});

// ================================================================ CRITERION 1 — board render (R1)
await check('R1', 1, 'Board render 8x8 alternating, a1 dark / h1 light (FIDE 2.1)', async () => {
  await reset();
  const bm = await locate();
  await shot('board.png');
  if (!bm) return { status: 'skip', detail: 'board not DOM-locatable (canvas/non-grid?) — judge board.png: 8x8, alternating, a1 dark bottom-left, h1 light' };
  const lightLum = [], darkLum = [];
  for (const f of FILES) for (let r = 1; r <= 8; r++) {
    const lum = relLum(bm[f + r].bg);
    if (lum == null) return { status: 'skip', detail: `square ${f}${r} bg unreadable (${bm[f + r].bg}) — judge board.png` };
    const expectLight = ((FILES.indexOf(f) + r) % 2 === 0);
    (expectLight ? lightLum : darkLum).push(lum);
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const aL = avg(lightLum), aD = avg(darkLum);
  const a1 = relLum(bm.a1.bg), h1 = relLum(bm.h1.bg);
  if (aL - aD < 0.04) return { status: 'skip', detail: `light/dark luminance separation weak (light≈${aL.toFixed(2)} dark≈${aD.toFixed(2)}) — judge board.png` };
  if (a1 >= h1) return { status: 'fail', detail: `a1 not darker than h1 (a1 lum ${a1.toFixed(2)} >= h1 lum ${h1.toFixed(2)}) — orientation/coloring wrong` };
  return true;
});

// ================================================================ CRITERION 2 — initial position (R2,R3)
await check('R2', 2, 'Initial position = exactly the 32 FIDE Art.2 pieces', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const b = await getBoard();
  if (canon(b) === canon(INITIAL)) return true;
  const bk = Object.keys(b || {});
  const diffs = [];
  for (const sq of new Set([...bk, ...Object.keys(INITIAL)])) if ((b || {})[sq] !== INITIAL[sq]) diffs.push(`${sq}:${(b || {})[sq]}!=${INITIAL[sq]}`);
  return { status: 'fail', detail: `${bk.length} entries; diffs: ` + diffs.slice(0, 10).join(', ') };
});
await check('R3', 2, 'Pieces visually distinguishable/identifiable (White vs Black, each type)', async () =>
  ({ status: 'skip', detail: 'visual — judge board.png: all 32 pieces drawn, White/Black distinguishable, each type identifiable' }));

// ================================================================ CRITERION 3 — white first + visible turn (R4,R5,R6)
await check('R4', 3, 'White to move at load (turn === "w")', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const t = await getTurn();
  return t === 'w' ? true : { status: 'fail', detail: `turn === ${JSON.stringify(t)} at load` };
});
await check('R5', 3, 'Visible turn indicator that updates after a move', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const before = (await bodyText()).replace(/\s+/g, ' ').trim();
  const t0 = await getTurn();
  await expectAccept('e2', 'e4');
  await page.waitForTimeout(200);
  const after = (await bodyText()).replace(/\s+/g, ' ').trim();
  const changed = before !== after;
  const mentionsWhite = /white/i.test(before);
  const mentionsBlack = /black/i.test(after);
  if (t0 === 'w' && changed && mentionsWhite && mentionsBlack) return true;
  if (changed) return { status: 'skip', detail: 'page text changed after 1.e4 but turn wording not matched by heuristic — judge screenshots (indicator must name the side to move and flip)' };
  return { status: 'skip', detail: `no page-text change detected after 1.e4 — judge whether a turn indicator is visible and updates (before="${before.slice(0, 60)}")` };
});
await check('R6', 3, 'Hook-driven move repaints the rendered board', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const bm = await locate();
  let clip;
  if (bm) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of FILES) for (let r = 1; r <= 8; r++) { const c = bm[f + r]; x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h); }
    clip = { x: Math.max(0, x0), y: Math.max(0, y0), width: Math.min(900 - x0, x1 - x0), height: Math.min(900 - y0, y1 - y0) };
  }
  const b0 = await page.screenshot({ clip });
  await shot('hookmove-before.png', clip);
  await expectAccept('e2', 'e4');
  await page.waitForTimeout(300);
  const b1 = await page.screenshot({ clip });
  await shot('hookmove-after.png', clip);
  if (Buffer.compare(b0, b1) !== 0) return true;
  return { status: 'fail', detail: 'board region pixel-identical before/after a hook move("e2","e4") — rendered board did not repaint' };
});

// ================================================================ CRITERION 4 — click-to-move (K1..K6)
{
  await reset();
  const bm = await locate();
  const clickSkip = { status: 'skip', detail: 'board not DOM-locatable — judge click-to-move manually / from screenshots' };

  await check('K1', 4, 'Clicking a piece shows a visible selection highlight', async () => {
    if (!bm) return clickSkip;
    const clip = { x: bm.e2.x, y: bm.e2.y, width: bm.e2.w, height: bm.e2.h };
    const before = await page.screenshot({ clip });
    await shot('select-e2-before.png', clip);
    await clickSquare(bm, 'e2');
    const after = await page.screenshot({ clip });
    await shot('select-e2-after.png', clip);
    if (Buffer.compare(before, after) !== 0) return true;
    return { status: 'skip', detail: 'e2 square pixel-identical after click — no highlight detected; judge select-e2-*.png (highlight may be off-cell)' };
  });

  await check('K2', 4, 'Click e2 then e4 completes the move + flips turn', async () => {
    if (!hasHook) return HOOK_MISSING;
    if (!bm) return clickSkip;
    await reset();
    const bm2 = await locate(); if (!bm2) return clickSkip;
    await clickSquare(bm2, 'e2'); await clickSquare(bm2, 'e4');
    await page.waitForTimeout(120);
    const b = await getBoard(), t = await getTurn();
    if (b.e4 === 'wP' && b.e2 === undefined && t === 'b') return true;
    return { status: 'fail', detail: `after click e2->e4: e4=${b.e4} e2=${b.e2} turn=${t}` };
  });

  await check('K3', 4, 'Click e2 then illegal e5 leaves position + turn unchanged', async () => {
    if (!hasHook) return HOOK_MISSING;
    if (!bm) return clickSkip;
    await reset();
    const bm2 = await locate(); if (!bm2) return clickSkip;
    await clickSquare(bm2, 'e2'); await clickSquare(bm2, 'e5');
    await page.waitForTimeout(120);
    const b = await getBoard(), t = await getTurn();
    if (canon(b) === canon(INITIAL) && t === 'w') return true;
    return { status: 'fail', detail: `illegal click e2->e5 changed state: turn=${t}, boardChanged=${canon(b) !== canon(INITIAL)}` };
  });

  await check('K4', 4, 'Click e2, then d2 (reselect), then d4 — d-pawn moves, e-pawn untouched', async () => {
    if (!hasHook) return HOOK_MISSING;
    if (!bm) return clickSkip;
    await reset();
    const bm2 = await locate(); if (!bm2) return clickSkip;
    await clickSquare(bm2, 'e2'); await clickSquare(bm2, 'd2'); await clickSquare(bm2, 'd4');
    await page.waitForTimeout(120);
    const b = await getBoard(), t = await getTurn();
    if (b.d4 === 'wP' && b.d2 === undefined && b.e2 === 'wP' && t === 'b') return true;
    return { status: 'fail', detail: `after click e2,d2,d4: d4=${b.d4} d2=${b.d2} e2=${b.e2} turn=${t}` };
  });

  await check('K5', 4, "Clicking Black's e7 then e5 at the start moves nothing (white to move)", async () => {
    if (!hasHook) return HOOK_MISSING;
    if (!bm) return clickSkip;
    await reset();
    const bm2 = await locate(); if (!bm2) return clickSkip;
    await clickSquare(bm2, 'e7'); await clickSquare(bm2, 'e5');
    await page.waitForTimeout(120);
    const b = await getBoard(), t = await getTurn();
    if (canon(b) === canon(INITIAL) && t === 'w') return true;
    return { status: 'fail', detail: `clicking black piece at white's turn changed state: turn=${t}, boardChanged=${canon(b) !== canon(INITIAL)}` };
  });

  await check('K6', 4, 'Full Fool\'s mate playable by clicks alone; game then ends', async () => {
    if (!hasHook) return HOOK_MISSING;
    if (!bm) return clickSkip;
    await reset();
    const bm2 = await locate(); if (!bm2) return clickSkip;
    for (const [f, t] of FOOLS) { await clickSquare(bm2, f); await clickSquare(bm2, t); }
    await page.waitForTimeout(200);
    await shot('mate-by-clicks.png');
    const b = await getBoard();
    if (b.h4 !== 'bQ') return { status: 'fail', detail: `Fool's mate not reached by clicks (h4=${b.h4}); board=${canon(b).slice(0, 160)}` };
    const locked = await expectLocked('a2', 'a3');
    return locked.ok ? true : { status: 'fail', detail: `game not locked after click-mate: move("a2","a3") ret=${JSON.stringify(locked.ret)}` };
  });
}

// ================================================================ CRITERION 5 — turn alternation (L1)
await check('L1', 5, 'Turn alternation: after 1.e4 turn=b & d2d4 rejected; after 1...e5 turn=w', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  if ((await getTurn()) !== 'b') return { status: 'fail', detail: 'turn !== "b" after 1.e4' };
  const rej = await expectReject('d2', 'd4');
  if (!rej.ok) return { status: 'fail', detail: `White d2d4 on Black's turn not cleanly rejected: ${JSON.stringify(rej)}` };
  const acc = await expectAccept('e7', 'e5');
  if (!acc.ok) return { status: 'fail', detail: '1...e5 not accepted' };
  return (await getTurn()) === 'w' ? true : { status: 'fail', detail: 'turn !== "w" after 1...e5' };
});

// ================================================================ CRITERION 6 — self-capture + capture removal (L2,L3)
await check('L2', 6, 'Self-capture banned (a1a2, b1d2 from start rejected)', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const r1 = await expectReject('a1', 'a2'), r2 = await expectReject('b1', 'd2');
  return (r1.ok && r2.ok) ? true : { status: 'fail', detail: `a1a2 ok=${r1.ok}, b1d2 ok=${r2.ok}` };
});
await check('L3', 6, 'Capture removes the piece: 1.e4 d5 2.exd5 -> 31 entries, d5=wP', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const b = await getBoard(), n = Object.keys(b).length;
  if (n === 31 && b.d5 === 'wP') return true;
  return { status: 'fail', detail: `entries=${n} (want 31), d5=${b.d5} (want wP)` };
});

// ================================================================ CRITERION 7 — pawn pushes (L4,L5,L6,L7)
await check('L4', 7, 'Pawn pushes: e2e5 reject(3sq); e2e3 ok; d7d5 ok; e3e5 reject(double after moved); e3e4 ok', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const r0 = await expectReject('e2', 'e5');
  const a1 = await expectAccept('e2', 'e3');
  const a2 = await expectAccept('d7', 'd5');
  const r1 = await expectReject('e3', 'e5');
  const a3 = await expectAccept('e3', 'e4');
  if (r0.ok && a1.ok && a2.ok && r1.ok && a3.ok) return true;
  return { status: 'fail', detail: `e2e5rej=${r0.ok} e2e3=${a1.ok} d7d5=${a2.ok} e3e5rej=${r1.ok} e3e4=${a3.ok}` };
});
await check('L5', 7, 'Blocked double push: c2c4 rejected when c3 occupied (1.Nc3 a6)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['b1', 'c3'], ['a7', 'a6']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r = await expectReject('c2', 'c4');
  return r.ok ? true : { status: 'fail', detail: `c2c4 (c3 blocked) not cleanly rejected: ${JSON.stringify(r)}` };
});
await check('L6', 7, 'Backward (e4e3) and sideways (e4d4) pawn moves rejected', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['a7', 'a6']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r1 = await expectReject('e4', 'e3'), r2 = await expectReject('e4', 'd4');
  return (r1.ok && r2.ok) ? true : { status: 'fail', detail: `e4e3 ok=${r1.ok}, e4d4 ok=${r2.ok}` };
});
await check('L7', 7, 'Pawn captures: e2d3/e2f3 diag-empty reject; 1.e4 e5 then e4e5 straight-onto-enemy reject', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const r1 = await expectReject('e2', 'd3'), r2 = await expectReject('e2', 'f3');
  const a1 = await expectAccept('e2', 'e4'), a2 = await expectAccept('e7', 'e5');
  if (!(a1.ok && a2.ok)) return { status: 'fail', detail: '1.e4 e5 setup failed' };
  const r3 = await expectReject('e4', 'e5');
  return (r1.ok && r2.ok && r3.ok) ? true : { status: 'fail', detail: `e2d3=${r1.ok} e2f3=${r2.ok} e4e5=${r3.ok}` };
});

// ================================================================ CRITERION 9 — knight (L8,L9)   [8 before 10]
await check('L8', 9, 'Knight L-moves over the pawn wall accepted; non-L (b1b3,b1d4) rejected', async () => {
  if (!hasHook) return HOOK_MISSING;
  for (const [f, t] of [['b1', 'c3'], ['b1', 'a3'], ['g1', 'f3'], ['g1', 'h3']]) {
    await reset();
    const a = await expectAccept(f, t);
    if (!a.ok) return { status: 'fail', detail: `knight ${f}${t} not accepted (ret=${JSON.stringify(a.ret)})` };
  }
  await reset();
  const r1 = await expectReject('b1', 'b3'), r2 = await expectReject('b1', 'd4');
  return (r1.ok && r2.ok) ? true : { status: 'fail', detail: `b1b3 ok=${r1.ok}, b1d4 ok=${r2.ok}` };
});
await check('L9', 9, 'All eight L-targets from d5 accepted (1.Nc3 a6 2.Nd5 b6)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const targets = ['c7', 'e7', 'f6', 'f4', 'e3', 'c3', 'b4', 'b6'];
  const bad = [];
  for (const t of targets) {
    const s = await setup([['b1', 'c3'], ['a7', 'a6'], ['c3', 'd5'], ['b7', 'b6']]);
    if (!s.ok) return { status: 'fail', detail: 'Nd5 setup failed: ' + s.detail };
    const a = await expectAccept('d5', t);
    if (!a.ok) bad.push(`${t}(ret=${JSON.stringify(a.ret)})`);
  }
  return bad.length ? { status: 'fail', detail: 'rejected d5-> ' + bad.join(', ') } : true;
});

// ================================================================ CRITERION 10 — slider/king geometry (L10..L13)
await check('L10', 10, 'Bishop: f1d3 accepted, off-line f1g3 rejected (path cleared by 1.e4)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['a7', 'a6']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r = await expectReject('f1', 'g3');
  const a = await expectAccept('f1', 'd3');
  return (r.ok && a.ok) ? true : { status: 'fail', detail: `f1g3 rej=${r.ok}, f1d3 acc=${a.ok}` };
});
await check('L11', 10, 'Rook: a1a3 accepted, off-line a1b3 rejected (path cleared by 1.a4)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['a2', 'a4'], ['h7', 'h6']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r = await expectReject('a1', 'b3');
  const a = await expectAccept('a1', 'a3');
  return (r.ok && a.ok) ? true : { status: 'fail', detail: `a1b3 rej=${r.ok}, a1a3 acc=${a.ok}` };
});
await check('L12', 10, 'Queen: d1h5 accepted, off-line d1e3 rejected (path cleared by 1.e4)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['a7', 'a6']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r = await expectReject('d1', 'e3');
  const a = await expectAccept('d1', 'h5');
  return (r.ok && a.ok) ? true : { status: 'fail', detail: `d1e3 rej=${r.ok}, d1h5 acc=${a.ok}` };
});
await check('L13', 10, 'King: e1e2 accepted; two-square e1e3 and off-line e1d3 rejected', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['a7', 'a6']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r1 = await expectReject('e1', 'e3'), r2 = await expectReject('e1', 'd3');
  const a = await expectAccept('e1', 'e2');
  return (r1.ok && r2.ok && a.ok) ? true : { status: 'fail', detail: `e1e3 rej=${r1.ok}, e1d3 rej=${r2.ok}, e1e2 acc=${a.ok}` };
});

// ================================================================ CRITERION 11 — path blocking (L14)
await check('L14', 11, 'Sliders cannot jump: a1a3, c1e3, d1d3, f1b5, h1h3 all rejected from start', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const bad = [];
  for (const [f, t] of [['a1', 'a3'], ['c1', 'e3'], ['d1', 'd3'], ['f1', 'b5'], ['h1', 'h3']]) {
    const r = await expectReject(f, t);
    if (!r.ok) bad.push(`${f}${t}(${JSON.stringify(r)})`);
  }
  return bad.length ? { status: 'fail', detail: 'not cleanly rejected: ' + bad.join(', ') } : true;
});

// ================================================================ CRITERION 13 — never leave king in check (L16,L17,L18)
await check('L16', 13, 'King may not step onto attacked square: 1.e4 d5 2.Ke2 dxe4 -> Kf3/Kd3 reject, Ke3 ok', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['d7', 'd5'], ['e1', 'e2'], ['d5', 'e4']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r1 = await expectReject('e2', 'f3'), r2 = await expectReject('e2', 'd3');
  const a = await expectAccept('e2', 'e3');
  return (r1.ok && r2.ok && a.ok) ? true : { status: 'fail', detail: `Kf3 rej=${r1.ok}, Kd3 rej=${r2.ok}, Ke3 acc=${a.ok}` };
});
await check('L17', 13, 'Pinned piece frozen: 1.e4 d5 2.Bb5+ Nc6 3.Nf3 -> Nc6 moves reject, Ng8f6 ok', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['d7', 'd5'], ['f1', 'b5'], ['b8', 'c6'], ['g1', 'f3']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r1 = await expectReject('c6', 'd4'), r2 = await expectReject('c6', 'e5');
  const a = await expectAccept('g8', 'f6');
  return (r1.ok && r2.ok && a.ok) ? true : { status: 'fail', detail: `Nc6d4 rej=${r1.ok}, Nc6e5 rej=${r2.ok}, Ng8f6 acc=${a.ok}` };
});
await check('L18', 13, 'In check must resolve: after 2.Bb5+ non-resolving moves reject, block c7c6 accepted', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['d7', 'd5'], ['f1', 'b5']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r1 = await expectReject('g8', 'f6'), r2 = await expectReject('h7', 'h6'), r3 = await expectReject('e8', 'd7');
  const a = await expectAccept('c7', 'c6');
  return (r1.ok && r2.ok && r3.ok && a.ok) ? true
    : { status: 'fail', detail: `Nf6 rej=${r1.ok}, h6 rej=${r2.ok}, Kd7 rej=${r3.ok}, c6 acc=${a.ok}` };
});

// ================================================================ CRITERION 12 — illegal-move contract aggregate (L15)
// (registered here so it observes every rejection probe above AND the special-move rejections below)
async function runContractAggregate() {
  await check('L15', 12, 'Illegal-move contract: every rejection returned false + left snapshot & turn unchanged', async () => {
    if (!hasHook) return HOOK_MISSING;
    return contractViolations.length === 0 ? true
      : { status: 'fail', detail: `${contractViolations.length} contract violation(s): ` + contractViolations.slice(0, 6).join(' | ') };
  });
}

// ================================================================ CRITERION 14 — checkmate (E1,E2,E3)
await check('E1', 14, "Checkmate (Fool's mate) ends game: 4 moves accepted, then every move rejected", async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup(FOOLS);
  if (!s.ok) return { status: 'fail', detail: "Fool's mate line not all accepted: " + s.detail };
  await shot('mate.png');
  const bad = [];
  for (const [f, t] of [['a2', 'a3'], ['g1', 'f3'], ['e1', 'f2'], ['g8', 'f6']]) {
    const l = await expectLocked(f, t);
    if (!l.ok) bad.push(`${f}${t}(ret=${JSON.stringify(l.ret)})`);
  }
  return bad.length ? { status: 'fail', detail: 'game NOT locked after mate; accepted/changed: ' + bad.join(', ') } : true;
});
await check('E2', 14, 'Checkmate visibly declared with winner (Black wins / 0-1 / mate)', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const before = await bodyText();
  for (const [f, t] of FOOLS) await expectAccept(f, t);
  await page.waitForTimeout(250);
  await shot('mate.png');
  const after = await bodyText();
  const marker = /(check\s*mate|checkmate|mate|black\s*win|0\s*[-–]\s*1|wins?|won|game\s*over)/i;
  if (marker.test(after) && after.trim() !== before.trim()) return true;
  return { status: 'skip', detail: 'no recognized mate/winner text appeared — judge mate.png (game-over + Black wins declared)' };
});
await check('E3', 14, 'Check is visibly indicated (after 1.e4 d5 2.Bb5+)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['d7', 'd5']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const before = await bodyText();
  await expectAccept('f1', 'b5');
  await page.waitForTimeout(250);
  await shot('check.png');
  const after = await bodyText();
  if (/check/i.test(after) && after.trim() !== before.trim()) return true;
  return { status: 'skip', detail: 'no "check" text appeared after 2.Bb5+ — judge check.png (visible check indication)' };
});

// ================================================================ CRITERION 15 — stalemate (E4,E5)
await check('E4', 15, 'Stalemate (Sam Loyd 10-move line) ends game: 19 moves accepted, then moves rejected', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup(LOYD);
  if (!s.ok) return { status: 'fail', detail: 'Loyd line not all accepted: ' + s.detail };
  await shot('stalemate.png');
  const bad = [];
  for (const [f, t] of [['a2', 'a3'], ['g1', 'f3'], ['g6', 'f5']]) {
    const l = await expectLocked(f, t);
    if (!l.ok) bad.push(`${f}${t}(ret=${JSON.stringify(l.ret)})`);
  }
  return bad.length ? { status: 'fail', detail: 'game NOT locked after stalemate; accepted/changed: ' + bad.join(', ') } : true;
});
await check('E5', 15, 'Draw-by-stalemate visibly declared', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const before = await bodyText();
  for (const [f, t] of LOYD) await expectAccept(f, t);
  await page.waitForTimeout(250);
  await shot('stalemate.png');
  const after = await bodyText();
  if (/(stale\s*mate|stalemate|draw|½|1\s*\/\s*2|½\s*[-–]\s*½)/i.test(after) && after.trim() !== before.trim()) return true;
  return { status: 'skip', detail: 'no recognized stalemate/draw text appeared — judge stalemate.png (draw by stalemate declared)' };
});

// ================================================================ CRITERION 16 — promotion (S1,S2)
const PROMO_LINE = [['a2', 'a4'], ['b7', 'b5'], ['a4', 'b5'], ['a7', 'a6'], ['b5', 'a6'], ['c8', 'b7'], ['a6', 'b7'], ['b8', 'c6']];
await check('S1', 16, 'Promotion default queen + capture-promotion: bxa8 (no arg) -> a8=wQ, 28 entries', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup(PROMO_LINE);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const a = await expectAccept('b7', 'a8'); // no promotion arg -> must auto-queen
  if (!a.ok) return { status: 'fail', detail: `bxa8 not accepted (ret=${JSON.stringify(a.ret)})` };
  const b = await getBoard();
  if (b.a8 === 'wQ' && Object.keys(b).length === 28) return true;
  return { status: 'fail', detail: `a8=${b.a8} (want wQ), entries=${Object.keys(b).length} (want 28)` };
});
await check('S2', 16, 'Promotion choices via 3rd arg: q/n/r/b -> wQ/wN/wR/wB', async () => {
  if (!hasHook) return HOOK_MISSING;
  const bad = [];
  for (const [p, code] of [['q', 'wQ'], ['n', 'wN'], ['r', 'wR'], ['b', 'wB']]) {
    const s = await setup(PROMO_LINE);
    if (!s.ok) return { status: 'fail', detail: s.detail };
    const a = await expectAccept('b7', 'a8', p);
    const b = await getBoard();
    if (!a.ok || b.a8 !== code) bad.push(`${p}->a8=${b.a8}(want ${code})`);
  }
  return bad.length ? { status: 'fail', detail: bad.join(', ') } : true;
});

// ================================================================ CRITERION 17 — en passant (S3,S4)
await check('S3', 17, 'En passant works: 1.e4 a6 2.e5 d5 3.exd6ep -> d6=wP, d5 empty, 31 entries', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const a = await expectAccept('e5', 'd6');
  if (!a.ok) return { status: 'fail', detail: `en-passant e5d6 not accepted (ret=${JSON.stringify(a.ret)})` };
  const b = await getBoard();
  if (b.d6 === 'wP' && b.d5 === undefined && Object.keys(b).length === 31) return true;
  return { status: 'fail', detail: `d6=${b.d6} d5=${b.d5} entries=${Object.keys(b).length} (want wP/empty/31)` };
});
await check('S4', 17, 'En passant expires after one move (interpose 3.Nc3 a5, then e5d6 rejected)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5'], ['b1', 'c3'], ['a6', 'a5']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r = await expectReject('e5', 'd6');
  return r.ok ? true : { status: 'fail', detail: `stale en-passant e5d6 not cleanly rejected: ${JSON.stringify(r)}` };
});

// ================================================================ CRITERION 18 — castling (S5..S11)
await check('S5', 18, 'Kingside castling both colors: e1g1 -> g1=wK/f1=wR; e8g8 -> g8=bK/f8=bR', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['g8', 'f6'], ['f1', 'c4'], ['f8', 'c5']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const aw = await expectAccept('e1', 'g1');
  let b = await getBoard();
  if (!aw.ok || b.g1 !== 'wK' || b.f1 !== 'wR') return { status: 'fail', detail: `white O-O: acc=${aw.ok} g1=${b.g1} f1=${b.f1}` };
  const ab = await expectAccept('e8', 'g8');
  b = await getBoard();
  if (!ab.ok || b.g8 !== 'bK' || b.f8 !== 'bR') return { status: 'fail', detail: `black O-O: acc=${ab.ok} g8=${b.g8} f8=${b.f8}` };
  return true;
});
await check('S6', 18, 'Queenside castling both colors: e1c1 -> c1=wK/d1=wR; e8c8 -> c8=bK/d8=bR', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['d2', 'd4'], ['d7', 'd5'], ['b1', 'c3'], ['b8', 'c6'], ['c1', 'f4'], ['c8', 'f5'], ['d1', 'd2'], ['d8', 'd7']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const aw = await expectAccept('e1', 'c1');
  let b = await getBoard();
  if (!aw.ok || b.c1 !== 'wK' || b.d1 !== 'wR') return { status: 'fail', detail: `white O-O-O: acc=${aw.ok} c1=${b.c1} d1=${b.d1}` };
  const ab = await expectAccept('e8', 'c8');
  b = await getBoard();
  if (!ab.ok || b.c8 !== 'bK' || b.d8 !== 'bR') return { status: 'fail', detail: `black O-O-O: acc=${ab.ok} c8=${b.c8} d8=${b.d8}` };
  return true;
});
await check('S7', 18, 'Castling from start rejected (pieces between): e1g1, e1c1', async () => {
  if (!hasHook) return HOOK_MISSING;
  await reset();
  const r1 = await expectReject('e1', 'g1'), r2 = await expectReject('e1', 'c1');
  return (r1.ok && r2.ok) ? true : { status: 'fail', detail: `e1g1 rej=${r1.ok}, e1c1 rej=${r2.ok}` };
});
await check('S8', 18, 'Castling permanently illegal after king moved & returned (FIDE 3.8.2.1)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['a7', 'a6'], ['g1', 'f3'], ['h7', 'h6'], ['f1', 'e2'], ['h6', 'h5'], ['e1', 'f1'], ['b7', 'b6'], ['f1', 'e1'], ['b6', 'b5']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r = await expectReject('e1', 'g1');
  return r.ok ? true : { status: 'fail', detail: `O-O after king round-trip not rejected: ${JSON.stringify(r)}` };
});
await check('S9', 18, 'Castling illegal after that rook moved & returned (FIDE 3.8.2.1)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['a7', 'a6'], ['g1', 'f3'], ['b7', 'b6'], ['f1', 'e2'], ['h7', 'h6'], ['h1', 'g1'], ['h6', 'h5'], ['g1', 'h1'], ['b6', 'b5']]);
  if (!s.ok) return { status: 'fail', detail: s.detail };
  const r = await expectReject('e1', 'g1');
  return r.ok ? true : { status: 'fail', detail: `O-O after h1-rook round-trip not rejected: ${JSON.stringify(r)}` };
});
await check('S10', 18, 'Castling rejected when landing g1 attacked (Bc5 thru open f2); control (f2 home) accepted', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['e7', 'e6'], ['f1', 'c4'], ['f8', 'c5'], ['g1', 'h3'], ['a7', 'a6'], ['f2', 'f4'], ['a6', 'a5']]);
  if (!s.ok) return { status: 'fail', detail: 'attacked-line setup: ' + s.detail };
  const r = await expectReject('e1', 'g1');
  if (!r.ok) return { status: 'fail', detail: `O-O into attacked g1 not rejected: ${JSON.stringify(r)}` };
  const s2 = await setup([['e2', 'e4'], ['e7', 'e6'], ['f1', 'c4'], ['f8', 'c5'], ['g1', 'h3'], ['a7', 'a6']]);
  if (!s2.ok) return { status: 'fail', detail: 'control-line setup: ' + s2.detail };
  const a = await expectAccept('e1', 'g1');
  const b = await getBoard();
  if (a.ok && b.g1 === 'wK' && b.f1 === 'wR') return true;
  return { status: 'fail', detail: `control (f2 home) O-O should be legal: acc=${a.ok} g1=${b.g1} f1=${b.f1}` };
});
await check('S11', 18, 'Castling rejected when crossing f1 attacked (Ba6); control (Bb7) accepted', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await setup([['e2', 'e4'], ['b7', 'b6'], ['g2', 'g3'], ['c8', 'a6'], ['f1', 'h3'], ['h7', 'h6'], ['g1', 'f3'], ['h6', 'h5']]);
  if (!s.ok) return { status: 'fail', detail: 'attacked-line setup: ' + s.detail };
  const r = await expectReject('e1', 'g1');
  if (!r.ok) return { status: 'fail', detail: `O-O across attacked f1 not rejected: ${JSON.stringify(r)}` };
  const s2 = await setup([['e2', 'e4'], ['b7', 'b6'], ['g2', 'g3'], ['c8', 'b7'], ['f1', 'h3'], ['h7', 'h6'], ['g1', 'f3'], ['h6', 'h5']]);
  if (!s2.ok) return { status: 'fail', detail: 'control-line setup: ' + s2.detail };
  const a = await expectAccept('e1', 'g1');
  const b = await getBoard();
  if (a.ok && b.g1 === 'wK' && b.f1 === 'wR') return true;
  return { status: 'fail', detail: `control (Bb7) O-O should be legal: acc=${a.ok} g1=${b.g1} f1=${b.f1}` };
});

// contract aggregate observes all rejections above
await runContractAggregate();

// ================================================================ GATES G2/G3/G4 (aggregates over the whole run)
await check('G2', 'G', 'No blocking dialogs (alert/confirm/prompt/beforeunload) anywhere', async () =>
  dialogs.length === 0 ? true : { status: 'fail', detail: dialogs.slice(0, 5).join(' | ') });
await check('G3', 'G', 'Fully self-contained: zero non-file/data/blob requests + no external markup refs', async () => {
  const html = readFileSync(target, 'utf8');
  const markupRefs = [
    ...html.matchAll(/\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+["']/gi),
    ...html.matchAll(/url\(\s*["']?(?:https?:)?\/\/[^)"']+/gi),
    ...html.matchAll(/@import\s+["'](?:https?:)?\/\//gi),
  ].map((m) => m[0].slice(0, 80));
  const problems = [];
  if (badRequests.length) problems.push('external requests: ' + JSON.stringify([...new Set(badRequests)].slice(0, 5)));
  if (markupRefs.length) problems.push('external refs in markup: ' + JSON.stringify(markupRefs.slice(0, 5)));
  return problems.length ? { status: 'fail', detail: problems.join(' | ') } : true;
});
await check('G4', 'G', 'Zero console errors / uncaught page errors across load + every sequence', async () =>
  consoleErrors.length === 0 ? true
    : { status: 'fail', detail: `${consoleErrors.length} error(s) (${loadErrorCount} at load): ` + consoleErrors.slice(0, 6).join(' | ').slice(0, 400) });

// ---------------------------------------------------------------- output
await browser.close();

// per-criterion rollup (1..18): fail if any mapped autocheck failed; else manual if any skip; else pass
const CRIT_LABELS = {
  1: 'Board render', 2: 'Initial position', 3: 'White first + visible turn', 4: 'Click-to-move',
  5: 'Turn alternation', 6: 'Self-capture + capture removal', 7: 'Pawn pushes', 8: 'Pawn captures',
  9: 'Knight', 10: 'Bishop/rook/queen/king geometry', 11: 'Path blocking', 12: 'Illegal-move contract',
  13: 'Never leave king in check', 14: 'Checkmate', 15: 'Stalemate', 16: 'Promotion', 17: 'En passant', 18: 'Castling',
};
// criterion 8 (pawn captures) shares probes L7 (straight/diag reject) + L3 (legal diagonal capture)
const CRIT_EXTRA = { 8: ['L7', 'L3'] };
const criteria = [];
for (let c = 1; c <= 18; c++) {
  let ids = results.filter((r) => r.criterion === c).map((r) => r.id);
  if (CRIT_EXTRA[c]) ids = [...new Set([...ids, ...CRIT_EXTRA[c]])];
  const rs = results.filter((r) => ids.includes(r.id));
  const anyFail = rs.some((r) => r.status === 'fail');
  const anySkip = rs.some((r) => r.status === 'skip');
  criteria.push({ criterion: c, label: CRIT_LABELS[c], checks: ids, status: anyFail ? 'fail' : anySkip ? 'manual' : 'pass' });
}

const gateChecks = results.filter((r) => r.criterion === 'G');
const gatesPass = gateChecks.every((r) => r.status === 'pass');
const summary = {
  target,
  artifacts: ARTIFACTS,
  hook: hasHook ? 'present' : 'MISSING',
  gates: { pass: gateChecks.filter((r) => r.status === 'pass').length, fail: gateChecks.filter((r) => r.status === 'fail').length, allPass: gatesPass },
  criteria: {
    pass: criteria.filter((c) => c.status === 'pass').length,
    fail: criteria.filter((c) => c.status === 'fail').length,
    manual: criteria.filter((c) => c.status === 'manual').length,
    total: 18,
  },
  autochecks: {
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    skip: results.filter((r) => r.status === 'skip').length,
    total: results.length,
  },
  overall: gatesPass && criteria.every((c) => c.status !== 'fail') ? (criteria.some((c) => c.status === 'manual') ? 'PASS-pending-manual' : 'PASS') : 'FAIL',
};
console.log(JSON.stringify({ summary, gates: gateChecks, criteria, results }, null, 2));
try { writeFileSync(join(ARTIFACTS, 'result.json'), JSON.stringify({ summary, gates: gateChecks, criteria, results }, null, 2)); } catch { /* ignore */ }
process.exit(results.some((r) => r.status === 'fail') ? 1 : 0);
