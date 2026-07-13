// Holdout autochecks for Task 14 — Wordle Clone.
// Usage: node autochecks.mjs [path-to-candidate-index.html]   (default ../src/index.html)
// Prints one JSON document to stdout: {summary, results:[{id,desc,status,detail}]}.
// status: "pass" | "fail" | "skip" (skip = needs human screenshot judgment per rubric.md).
// Exit code: 0 = ran to completion (even with fails), 2 = fatal (couldn't run).

import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] ?? join(__dirname, '..', 'src', 'index.html'));

function fatal(msg) {
  console.log(JSON.stringify({ fatal: msg, summary: null, results: [] }, null, 2));
  process.exit(2);
}

if (!existsSync(target)) fatal(`candidate file not found: ${target}`);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  fatal('playwright not installed — run: npm i -D playwright  (inside holdout/)');
}

let browser = null;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
} catch {
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    fatal('no Chrome/Chromium available — run: npx playwright install chromium  (' + e.message.split('\n')[0] + ')');
  }
}

// ---------------------------------------------------------------- reporting
const results = [];
function report(id, desc, status, detail = '') {
  results.push({ id, desc, status, detail });
}
async function check(id, desc, fn) {
  try {
    const r = await fn(); // {status, detail} or true/false
    if (r === true) report(id, desc, 'pass');
    else if (r === false) report(id, desc, 'fail');
    else report(id, desc, r.status, r.detail || '');
  } catch (e) {
    report(id, desc, 'fail', 'checker exception: ' + String(e.message || e).slice(0, 300));
  }
}

// ---------------------------------------------------------------- page setup
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 100)); await d.dismiss().catch(() => {}); });
const httpRequests = [];
page.on('request', (r) => { if (/^https?:/i.test(r.url())) httpRequests.push(r.url()); });

await page.goto(pathToFileURL(target).href, { waitUntil: 'load' });
await page.waitForTimeout(400);
const loadErrorCount = consoleErrors.length;

// ---------------------------------------------------------------- hook plumbing
const hasHook = await page.evaluate(() => {
  const w = window.__wordle;
  return !!w && typeof w.setAnswer === 'function' && typeof w.guess === 'function' && typeof w.state === 'function';
});

let sawAsyncGuess = false;
async function setAnswer(w) { return page.evaluate((x) => { window.__wordle.setAnswer(x); return true; }, w); }
async function guessRaw(w) {
  const r = await page.evaluate((x) => {
    const v = window.__wordle.guess(x);
    const isPromise = !!(v && typeof v.then === 'function');
    return { isPromise, value: isPromise ? null : v };
  }, w);
  if (r.isPromise) sawAsyncGuess = true;
  return r.value;
}
async function state() {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__wordle.state())));
}
const COLORS = ['green', 'yellow', 'gray'];
function validEval(r) {
  return Array.isArray(r) && r.length === 5 && r.every((x) => COLORS.includes(x));
}
function evalEq(a, b) { return validEval(a) && Array.isArray(b) && a.join(',') === b.join(','); }

// ---------------------------------------------------------------- DOM helpers (heuristic)
// Tag the on-screen keyboard: find the smallest container holding >=24 distinct single-letter
// leaf elements; tag each letter key with data-hk, Enter/Backspace with data-hkx.
const TAG_KEYBOARD = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const leaves = [...document.body.querySelectorAll('*')].filter((el) => el.childElementCount === 0 && vis(el));
  const letterLeaves = leaves.filter((el) => /^[a-z]$/i.test((el.textContent || '').trim()));
  const counts = new Map();
  for (const el of letterLeaves) {
    let a = el.parentElement, d = 0;
    while (a && a !== document.documentElement && d < 10) {
      let set = counts.get(a); if (!set) counts.set(a, (set = new Set()));
      set.add(el.textContent.trim().toUpperCase());
      a = a.parentElement; d++;
    }
  }
  let root = null, best = Infinity;
  for (const [el, set] of counts) {
    if (set.size >= 24) { const n = el.querySelectorAll('*').length; if (n < best) { best = n; root = el; } }
  }
  if (!root) return null;
  document.querySelectorAll('[data-hk],[data-hkx],[data-hkroot]').forEach((el) => {
    el.removeAttribute('data-hk'); el.removeAttribute('data-hkx'); el.removeAttribute('data-hkroot');
  });
  root.setAttribute('data-hkroot', '1');
  const seen = new Set();
  for (const el of letterLeaves) {
    if (!root.contains(el)) continue;
    const L = el.textContent.trim().toUpperCase();
    if (seen.has(L)) continue; seen.add(L);
    (el.closest('button') || el).setAttribute('data-hk', L);
  }
  const all = [...root.querySelectorAll('*')].filter(vis);
  const enterEl =
    all.find((el) => el.childElementCount === 0 && /^(enter|\\u21b5|\\u23ce|submit|go)$/i.test((el.textContent || '').trim())) ||
    all.find((el) => /enter|submit/i.test(el.getAttribute('aria-label') || ''));
  const backEl =
    all.find((el) => el.childElementCount === 0 && /^(\\u232b|\\u2190|del|delete|back|backspace)$/i.test((el.textContent || '').trim())) ||
    all.find((el) => /back|del/i.test(el.getAttribute('aria-label') || '')) ||
    all.find((el) => el.tagName === 'BUTTON' && el.querySelector('svg'));
  if (enterEl) (enterEl.closest('button') || enterEl).setAttribute('data-hkx', 'enter');
  if (backEl) (backEl.closest('button') || backEl).setAttribute('data-hkx', 'back');
  return { letters: seen.size, enter: !!enterEl, backspace: !!backEl };
})()`;

async function tagKeyboard() { return page.evaluate(TAG_KEYBOARD); }

async function keyColor(letter) {
  await tagKeyboard(); // re-tag: implementations may re-render keys
  return page.evaluate((L) => {
    let el = document.querySelector('[data-hk="' + L + '"]');
    if (!el) return null;
    for (let d = 0; d < 3 && el; d++, el = el.parentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
    }
    return 'rgba(0, 0, 0, 0)';
  }, letter);
}

async function clickKey(sel) {
  await tagKeyboard();
  await page.click(sel, { timeout: 3000 });
}

// Find the rendered row spelling `word` (outside the keyboard) and return its 5 effective
// tile background colors left-to-right, or null.
async function rowColors(word) {
  return page.evaluate((W) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const kb = document.querySelector('[data-hkroot]');
    const leaves = [...document.body.querySelectorAll('*')].filter((el) =>
      el.childElementCount === 0 && vis(el) && (!kb || !kb.contains(el)) &&
      /^[a-z]$/i.test((el.textContent || '').trim()));
    const items = leaves.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x: r.x, y: r.y + r.height / 2, L: el.textContent.trim().toUpperCase() };
    });
    const rows = [];
    for (const it of items) {
      let row = rows.find((r) => Math.abs(r.y - it.y) < 6);
      if (!row) rows.push((row = { y: it.y, items: [] }));
      row.items.push(it);
    }
    for (const row of rows) {
      if (row.items.length !== 5) continue;
      row.items.sort((a, b) => a.x - b.x);
      if (row.items.map((i) => i.L).join('') !== W.toUpperCase()) continue;
      return row.items.map((i) => {
        let el = i.el;
        for (let d = 0; d < 4 && el; d++, el = el.parentElement) {
          const c = getComputedStyle(el).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        }
        return 'rgba(0, 0, 0, 0)';
      });
    }
    return null;
  }, word);
}

async function bodyText() {
  return page.evaluate(() => (document.body.innerText || document.body.textContent || ''));
}

// Any single lowercase letter VISIBLY rendered outside the keyboard? (A5 uppercase-display
// check). CSS text-transform: uppercase/capitalize renders lowercase text uppercase — allowed.
async function lowercaseBoardLetters() {
  return page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const kb = document.querySelector('[data-hkroot]');
    return [...document.body.querySelectorAll('*')].filter((el) => {
      if (el.childElementCount !== 0 || !vis(el) || (kb && kb.contains(el))) return false;
      if (!/^[a-z]$/.test((el.textContent || '').trim())) return false;
      const tt = getComputedStyle(el).textTransform || '';
      return !/uppercase|capitalize/i.test(tt);
    }).length;
  });
}

// Empty-board geometry (A1): >=6 y-clustered rows of exactly 5 empty visible leaves.
async function emptyBoardShape() {
  return page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
    const kb = document.querySelector('[data-hkroot]');
    const empties = [...document.body.querySelectorAll('*')].filter((el) =>
      el.childElementCount === 0 && vis(el) && (!kb || !kb.contains(el)) &&
      (el.textContent || '').trim() === '');
    const rows = [];
    for (const el of empties) {
      const r = el.getBoundingClientRect();
      const y = r.y + r.height / 2;
      let row = rows.find((q) => Math.abs(q.y - y) < 6);
      if (!row) rows.push((row = { y, n: 0 }));
      row.n++;
    }
    return { rows5: rows.filter((r) => r.n === 5).length, totalEmpties: empties.length };
  });
}

// Color math: computed styles give rgb()/rgba() strings.
function parseColor(c) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c || '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function colorEq(a, b) {
  const pa = parseColor(a), pb = parseColor(b);
  if (!pa || !pb) return false;
  return pa.every((v, i) => Math.abs(v - pb[i]) <= 10);
}
function colorDistinct(a, b) {
  const pa = parseColor(a), pb = parseColor(b);
  if (!pa || !pb) return false;
  return pa.some((v, i) => Math.abs(v - pb[i]) >= 25);
}

const ANIM_WAIT = 2200; // grace for reveal animations before reading DOM colors/text

// ================================================================ checks
const HOOK_MISSING = { status: 'fail', detail: 'window.__wordle hook missing/incomplete — cannot verify' };

// --- R01 hook shape
await check('R01', 'H1 hook shape: window.__wordle {setAnswer,guess,state}', async () =>
  hasHook ? true : { status: 'fail', detail: 'missing or wrong-typed members' });

// --- keyboard discovery + neutral palette (before ANY guess)
let kbInfo = null;
const neutral = {};
if (hasHook) {
  kbInfo = await tagKeyboard();
  if (kbInfo) {
    for (const L of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') neutral[L] = await keyColor(L);
  }
}

// --- R35 F1 default answer (checked BEFORE first setAnswer)
await check('R35', 'F1 playable default answer without setAnswer', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await state();
  const ok = s && s.status === 'playing' && typeof s.answer === 'string' && /^[A-Z]{5}$/.test(s.answer);
  return ok ? true : { status: 'fail', detail: 'state() at load = ' + JSON.stringify(s).slice(0, 200) };
});

// --- R10 A1 empty board
await check('R10', 'A1 6x5 empty board at start', async () => {
  const shape = await emptyBoardShape();
  if (shape.rows5 >= 6) return true;
  return { status: 'skip', detail: `heuristic found ${shape.rows5} rows of 5 empty tiles (${shape.totalEmpties} empties) — judge from screenshot` };
});

// --- R05 H5 state shape / R03 H3 guess valid path
await check('R03', 'H3 guess() returns 5-color array, updates state + row', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('CRANE');
  const r = await guessRaw('slate');
  if (!validEval(r)) return { status: 'fail', detail: 'guess("slate") returned ' + JSON.stringify(r).slice(0, 120) };
  const s = await state();
  if (!s.guesses || s.guesses[s.guesses.length - 1] !== 'SLATE')
    return { status: 'fail', detail: 'state().guesses missing "SLATE": ' + JSON.stringify(s.guesses) };
  await page.waitForTimeout(ANIM_WAIT);
  const row = await rowColors('SLATE');
  if (!row) return { status: 'pass', detail: 'hook OK; rendered row not auto-locatable (DOM heuristic) — tile agreement judged in R16' };
  return true;
});

await check('R05', 'H5 state() shape {status,answer,guesses,evaluations}', async () => {
  if (!hasHook) return HOOK_MISSING;
  const s = await state();
  const ok = s && ['playing', 'won', 'lost'].includes(s.status) &&
    /^[A-Z]{5}$/.test(s.answer || '') &&
    Array.isArray(s.guesses) && s.guesses.every((g) => /^[A-Z]{5}$/.test(g)) &&
    Array.isArray(s.evaluations) && s.evaluations.length === s.guesses.length &&
    s.evaluations.every(validEval);
  return ok ? true : { status: 'fail', detail: JSON.stringify(s).slice(0, 250) };
});

// --- R04 H4 invalid guesses
await check('R04', 'H4 invalid guesses return null, consume nothing', async () => {
  if (!hasHook) return HOOK_MISSING;
  const before = (await state()).guesses.length;
  const bad = ['abc', 'abcdef', 'ab1de', 'ab de', 'ab-de', ''];
  for (const b of bad) {
    const r = await guessRaw(b);
    if (r !== null && r !== undefined)
      return { status: 'fail', detail: `guess(${JSON.stringify(b)}) returned ${JSON.stringify(r).slice(0, 80)} (expected null)` };
    if (r === undefined)
      return { status: 'fail', detail: `guess(${JSON.stringify(b)}) returned undefined (spec: null)` };
  }
  const after = (await state()).guesses.length;
  return after === before ? true : { status: 'fail', detail: `guess count ${before} -> ${after} on invalid input` };
});

// --- R02 H2 setAnswer resets
await check('R02', 'H2 setAnswer resets game (state + board + keys)', async () => {
  if (!hasHook) return HOOK_MISSING;
  // we have >=1 guess on the board from R03
  await setAnswer('crane');
  const s = await state();
  if (!(s.status === 'playing' && s.answer === 'CRANE' && s.guesses.length === 0 && s.evaluations.length === 0))
    return { status: 'fail', detail: 'post-reset state: ' + JSON.stringify(s).slice(0, 200) };
  await page.waitForTimeout(300);
  const stale = await rowColors('SLATE');
  if (stale) return { status: 'fail', detail: 'board still shows previous SLATE row after setAnswer' };
  if (kbInfo) {
    const kc = await keyColor('S'); // S was guessed in R03
    if (kc && neutral['S'] && !colorEq(kc, neutral['S']))
      return { status: 'fail', detail: `S key not back to neutral after reset (${kc} vs ${neutral['S']})` };
  }
  return true;
});

// --- R07 AC2 no dictionary
await check('R07', 'AC2 any 5-letter A-Z guess accepted (no dictionary)', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('CRANE');
  const a = await guessRaw('ZZZZZ');
  const b = await guessRaw('qjxvz');
  return validEval(a) && validEval(b) ? true
    : { status: 'fail', detail: `ZZZZZ -> ${JSON.stringify(a)}, qjxvz -> ${JSON.stringify(b)}` };
});

// --- C cases (R17..R25 + probes)
const cCases = [
  ['R20', 'C4-1 HOTEL / LEVEL', 'HOTEL', 'LEVEL', ['gray', 'gray', 'gray', 'green', 'green']],
  ['R21', 'C4-2 EATEN / LEVER', 'EATEN', 'LEVER', ['gray', 'yellow', 'gray', 'green', 'gray']],
  ['R22', 'C4-3 ERASE / SPEED', 'ERASE', 'SPEED', ['yellow', 'gray', 'yellow', 'yellow', 'gray']],
  ['R23', 'C4-4 CREPE / SPEED', 'CREPE', 'SPEED', ['gray', 'yellow', 'green', 'yellow', 'gray']],
  ['R24', 'C4-5 THOSE / GEESE', 'THOSE', 'GEESE', ['gray', 'gray', 'gray', 'green', 'green']],
  ['R25', 'C4-6 ROBOT / FLOOR', 'ROBOT', 'FLOOR', ['gray', 'gray', 'yellow', 'green', 'yellow']],
];
const cResults = {};
for (const [id, desc, ans, g, expected] of cCases) {
  await check(id, desc + ' -> ' + expected.join(','), async () => {
    if (!hasHook) return HOOK_MISSING;
    await setAnswer(ans);
    const r = await guessRaw(g);
    cResults[id] = evalEq(expected, r);
    if (!cResults[id]) return { status: 'fail', detail: `got ${JSON.stringify(r)}` };
    const s = await state();
    const last = s.evaluations[s.evaluations.length - 1];
    if (!evalEq(expected, last)) return { status: 'fail', detail: `state().evaluations disagrees: ${JSON.stringify(last)}` };
    return true;
  });
}

await check('R18', 'C2 excess-copy probe HOTEL / LLAMA -> yellow,gray,gray,gray,gray', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('HOTEL');
  const r = await guessRaw('LLAMA');
  cResults.R18 = evalEq(['yellow', 'gray', 'gray', 'gray', 'gray'], r);
  return cResults.R18 ? true : { status: 'fail', detail: `got ${JSON.stringify(r)}` };
});

await check('R19', 'C3 greens consume before earlier yellows (via C4-1 + C4-5)', async () =>
  hasHook
    ? (cResults.R20 && cResults.R24 ? true : { status: 'fail', detail: 'C4-1 and/or C4-5 failed' })
    : HOOK_MISSING);

await check('R17', 'C1 two-pass algorithm (aggregate of R18-R25)', async () =>
  hasHook
    ? (['R18', 'R20', 'R21', 'R22', 'R23', 'R24', 'R25'].every((k) => cResults[k])
      ? true : { status: 'fail', detail: 'one or more duplicate-letter cases failed' })
    : HOOK_MISSING);

// --- B1/B2 tile colors + key palette from CREPE/SPEED
let tilePalette = null; // {green,yellow,gray} from tiles
let keyPalette = null;  // {green,yellow,gray} from keyboard keys
await check('R15', 'B1 submitted tiles each render one of 3 states (CREPE/SPEED)', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('CREPE');
  const r = await guessRaw('SPEED');
  if (!evalEq(['gray', 'yellow', 'green', 'yellow', 'gray'], r))
    return { status: 'fail', detail: 'scoring wrong for CREPE/SPEED: ' + JSON.stringify(r) };
  await page.waitForTimeout(ANIM_WAIT);
  const cols = await rowColors('SPEED');
  if (!cols) return { status: 'skip', detail: 'row tiles not auto-locatable — judge tiles from screenshot' };
  if (cols.some((c) => !parseColor(c) || c === 'rgba(0, 0, 0, 0)'))
    return { status: 'fail', detail: 'some tiles have no resolved background: ' + JSON.stringify(cols) };
  tilePalette = { gray: cols[0], yellow: cols[1], green: cols[2] };
  return true;
});

await check('R16', 'B2 tile colors agree with guess() array + 3 distinct colors', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!tilePalette) return { status: 'skip', detail: 'tiles not auto-locatable — compare screenshot vs guess() array manually' };
  const cols = await rowColors('SPEED');
  const expected = ['gray', 'yellow', 'green', 'yellow', 'gray'];
  for (let i = 0; i < 5; i++) {
    if (!colorEq(cols[i], tilePalette[expected[i]]))
      return { status: 'fail', detail: `tile ${i + 1} color ${cols[i]} != expected ${expected[i]} color ${tilePalette[expected[i]]}` };
  }
  const p = tilePalette;
  if (!(colorDistinct(p.green, p.yellow) && colorDistinct(p.green, p.gray) && colorDistinct(p.yellow, p.gray)))
    return { status: 'fail', detail: 'tile state colors not visually distinct: ' + JSON.stringify(p) };
  return true;
});

// --- D checks
const kbSkip = { status: 'skip', detail: 'keyboard keys not auto-locatable — judge key colors from screenshots per rubric' };
await check('R26', 'D1 keys show best state; unguessed keys neutral (CREPE/SPEED)', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!kbInfo) return kbSkip;
  // board currently: fresh CREPE game with single guess SPEED (from R15)
  const [s, p, e, d, z] = await Promise.all(['S', 'P', 'E', 'D', 'Z'].map((L) => keyColor(L)));
  if (!s || !p || !e || !d) return kbSkip;
  if (!colorEq(s, d)) return { status: 'fail', detail: `S and D both gray-state but differ: ${s} vs ${d}` };
  if (!colorDistinct(e, p) || !colorDistinct(e, s) || !colorDistinct(p, s))
    return { status: 'fail', detail: `key states not distinct: green(E)=${e} yellow(P)=${p} gray(S)=${s}` };
  for (const [L, c] of [['S', s], ['P', p], ['E', e]]) {
    if (neutral[L] && colorEq(c, neutral[L]))
      return { status: 'fail', detail: `${L} key unchanged from neutral after scoring (${c})` };
  }
  if (neutral['Z'] && !colorEq(z, neutral['Z']))
    return { status: 'fail', detail: `unguessed Z key changed from neutral: ${z} vs ${neutral['Z']}` };
  keyPalette = { green: e, yellow: p, gray: s };
  return true;
});

await check('R28', 'D3 yellow+green same letter in row -> key green (EATEN/LEVER)', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!kbInfo || !keyPalette) return kbSkip;
  await setAnswer('EATEN');
  await guessRaw('LEVER');
  await page.waitForTimeout(ANIM_WAIT);
  const e = await keyColor('E'), l = await keyColor('L');
  if (!colorEq(e, keyPalette.green)) return { status: 'fail', detail: `E key ${e}, expected green ${keyPalette.green}` };
  if (!colorEq(l, keyPalette.gray)) return { status: 'fail', detail: `L key ${l}, expected gray ${keyPalette.gray}` };
  return true;
});

await check('R29', 'D4 excess-duplicate gray does not stick (HOTEL/LEVEL keys green)', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!kbInfo || !keyPalette) return kbSkip;
  await setAnswer('HOTEL');
  await guessRaw('LEVEL');
  await page.waitForTimeout(ANIM_WAIT);
  const l = await keyColor('L'), e = await keyColor('E'), v = await keyColor('V');
  if (!colorEq(l, keyPalette.green)) return { status: 'fail', detail: `L key ${l}, expected green ${keyPalette.green}` };
  if (!colorEq(e, keyPalette.green)) return { status: 'fail', detail: `E key ${e}, expected green ${keyPalette.green}` };
  if (!colorEq(v, keyPalette.gray)) return { status: 'fail', detail: `V key ${v}, expected gray ${keyPalette.gray}` };
  return true;
});

await check('R27', 'D2 key state never downgrades (CRANE: CATER, CRAMP, MACRO)', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!kbInfo || !keyPalette) return kbSkip;
  await setAnswer('CRANE');
  await guessRaw('CATER'); // C green, A yellow, T gray, E yellow, R yellow
  await page.waitForTimeout(ANIM_WAIT);
  let c = await keyColor('C'), a = await keyColor('A');
  if (!colorEq(c, keyPalette.green)) return { status: 'fail', detail: `after CATER: C key ${c}, expected green` };
  if (!colorEq(a, keyPalette.yellow)) return { status: 'fail', detail: `after CATER: A key ${a}, expected yellow` };
  await guessRaw('CRAMP'); // C,R,A green
  await page.waitForTimeout(ANIM_WAIT);
  a = await keyColor('A');
  if (!colorEq(a, keyPalette.green)) return { status: 'fail', detail: `after CRAMP: A key ${a}, expected upgraded to green` };
  await guessRaw('MACRO'); // C,A,R only yellow in this row — keys must STAY green
  await page.waitForTimeout(ANIM_WAIT);
  c = await keyColor('C'); a = await keyColor('A');
  const r = await keyColor('R'), e = await keyColor('E');
  if (!colorEq(c, keyPalette.green)) return { status: 'fail', detail: `after MACRO: C key downgraded: ${c}` };
  if (!colorEq(a, keyPalette.green)) return { status: 'fail', detail: `after MACRO: A key downgraded: ${a}` };
  if (!colorEq(r, keyPalette.green)) return { status: 'fail', detail: `after MACRO: R key ${r}, expected green (from CRAMP)` };
  if (!colorEq(e, keyPalette.yellow)) return { status: 'fail', detail: `after MACRO: E key ${e}, expected yellow (from CATER)` };
  return true;
});

// --- physical keyboard input
await check('R12', 'A3 typing fills tiles, backspace edits, max 5 (a,b,BS,b,c,d,e,z,Enter -> ABCDE)', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('QUERY');
  await page.keyboard.type('ab', { delay: 40 });
  await page.keyboard.press('Backspace');
  await page.keyboard.type('bcde', { delay: 40 });
  await page.keyboard.type('z', { delay: 40 }); // 6th letter must be ignored
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const s = await state();
  if (s.guesses.length === 1 && s.guesses[0] === 'ABCDE') return true;
  return { status: 'fail', detail: 'state().guesses = ' + JSON.stringify(s.guesses) };
});

await check('R13', 'A4 short submit does not consume a guess; row stays editable', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('QUERY');
  await page.keyboard.type('abc', { delay: 40 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  let s = await state();
  if (s.guesses.length !== 0) return { status: 'fail', detail: '3-letter Enter consumed a guess: ' + JSON.stringify(s.guesses) };
  await page.keyboard.type('de', { delay: 40 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  s = await state();
  if (s.guesses.length === 1 && s.guesses[0] === 'ABCDE') return true;
  return { status: 'fail', detail: 'after completing row: ' + JSON.stringify(s.guesses) };
});

await check('R14', 'A5 lowercase input accepted, board renders uppercase', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('QUERY');
  if (kbInfo) await tagKeyboard(); // refresh [data-hkroot] in case the keyboard re-rendered
  await page.keyboard.type('abcde', { delay: 40 });
  await page.waitForTimeout(200);
  const lc = await lowercaseBoardLetters();
  const s = await state();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const s2 = await state();
  const accepted = s2.guesses.length === 1 && s2.guesses[0] === 'ABCDE';
  if (!accepted) return { status: 'fail', detail: 'lowercase typed row not accepted: ' + JSON.stringify(s2.guesses) };
  if (lc > 0) return { status: 'fail', detail: `${lc} lowercase letter tile(s) rendered on board (must display uppercase)` };
  if (s.guesses.length !== 0) return { status: 'fail', detail: 'typing submitted early' };
  return true;
});

// --- on-screen keyboard clicks
await check('R30', 'D5 clicking keys inputs like typing (A,B,BS,B,C,D,E,Enter -> ABCDE)', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!kbInfo) return kbSkip;
  if (!kbInfo.enter || !kbInfo.backspace)
    return { status: 'skip', detail: `enter key found: ${kbInfo.enter}, backspace found: ${kbInfo.backspace} — judge manually` };
  await setAnswer('QUERY');
  for (const L of ['A', 'B']) await clickKey(`[data-hk="${L}"]`);
  await clickKey('[data-hkx="back"]');
  for (const L of ['B', 'C', 'D', 'E']) await clickKey(`[data-hk="${L}"]`);
  await clickKey('[data-hkx="enter"]');
  await page.waitForTimeout(200);
  const s = await state();
  if (s.guesses.length === 1 && s.guesses[0] === 'ABCDE') return true;
  return { status: 'fail', detail: 'state().guesses = ' + JSON.stringify(s.guesses) };
});

await check('R11', 'A2 both input paths: physical keys AND on-screen keyboard (26 letters + Enter + Backspace)', async () => {
  if (!hasHook) return HOOK_MISSING;
  const physical = results.find((r) => r.id === 'R12');
  const clicks = results.find((r) => r.id === 'R30');
  if (!kbInfo) return kbSkip;
  const missing = [];
  if (kbInfo.letters < 26) missing.push(`only ${kbInfo.letters}/26 letter keys found`);
  if (!kbInfo.enter) missing.push('no Enter key found');
  if (!kbInfo.backspace) missing.push('no Backspace key found');
  if (missing.length) return { status: 'fail', detail: missing.join('; ') };
  if (physical.status !== 'pass') return { status: 'fail', detail: 'physical-keyboard path failed (R12)' };
  if (clicks.status === 'fail') return { status: 'fail', detail: 'click path failed (R30)' };
  if (clicks.status === 'skip') return { status: 'skip', detail: 'click path not auto-verified (R30 skip)' };
  return true;
});

// --- end states
await check('R31', 'E1 win ends game, message shown, further input ignored', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('MAGIC');
  const before = await bodyText();
  const r = await guessRaw('magic');
  if (!evalEq(['green', 'green', 'green', 'green', 'green'], r))
    return { status: 'fail', detail: 'winning guess returned ' + JSON.stringify(r) };
  const s = await state();
  if (s.status !== 'won') return { status: 'fail', detail: `status ${s.status}, expected "won"` };
  const post = await guessRaw('CRANE');
  if (post !== null) return { status: 'fail', detail: 'guess() after win returned ' + JSON.stringify(post) };
  await page.keyboard.type('crane', { delay: 30 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const s2 = await state();
  if (s2.guesses.length !== 1) return { status: 'fail', detail: 'typing after win consumed a row: ' + JSON.stringify(s2.guesses) };
  await page.waitForTimeout(ANIM_WAIT);
  const after = await bodyText();
  const winish = /(you\s*win|you\s*won|\bwin\b|\bwon\b|congrat|genius|magnificent|splendid|great|impressive|phew|correct|victory|solved|nice|\u{1F389})/iu;
  if (winish.test(after) && !winish.test(before)) return true;
  if (after.trim() !== before.trim())
    return { status: 'pass', detail: 'page text changed after win (message wording not recognized) — spot-check screenshot if in doubt' };
  return { status: 'skip', detail: 'no visible text change detected after win — judge win message from screenshot' };
});

await check('R33', 'E3 answer hidden + status "playing" mid-game', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('ZEBRA');
  await page.waitForTimeout(200);
  let txt = await bodyText();
  if (/ZEBRA/i.test(txt)) return { status: 'fail', detail: 'answer visible in page at fresh state' };
  await guessRaw('SLATE');
  await page.waitForTimeout(ANIM_WAIT);
  txt = await bodyText();
  if (/ZEBRA/i.test(txt)) return { status: 'fail', detail: 'answer visible in page mid-game' };
  const s = await state();
  return s.status === 'playing' ? true : { status: 'fail', detail: `status ${s.status} mid-game` };
});

await check('R32', 'E2 loss after 6th guess: status "lost", answer revealed, input ignored', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('ZEBRA'); // self-contained: fresh game, 6 losing guesses
  for (let i = 0; i < 6; i++) {
    const r = await guessRaw('QUICK');
    if (!validEval(r)) return { status: 'fail', detail: `filler guess ${i + 1} returned ${JSON.stringify(r)}` };
  }
  const s = await state();
  if (s.status !== 'lost') return { status: 'fail', detail: `after 6 guesses status = ${s.status}` };
  if (s.guesses.length !== 6) return { status: 'fail', detail: `guess count ${s.guesses.length}` };
  const post = await guessRaw('ZEBRA');
  if (post !== null) return { status: 'fail', detail: 'guess() after loss returned ' + JSON.stringify(post) };
  await page.waitForTimeout(ANIM_WAIT);
  const txt = await bodyText();
  if (!/ZEBRA/i.test(txt)) return { status: 'fail', detail: 'answer ZEBRA not revealed in page after loss' };
  return true;
});

await check('R34', 'E4 win on the 6th guess is a win', async () => {
  if (!hasHook) return HOOK_MISSING;
  await setAnswer('ZEBRA');
  for (let i = 0; i < 5; i++) await guessRaw('QUICK');
  const r = await guessRaw('zebra');
  if (!evalEq(['green', 'green', 'green', 'green', 'green'], r))
    return { status: 'fail', detail: '6th winning guess returned ' + JSON.stringify(r) };
  const s = await state();
  return s.status === 'won' ? true : { status: 'fail', detail: `status ${s.status}, expected "won"` };
});

// --- hygiene
await check('R06', 'AC1 self-contained: zero http(s) requests, no external refs in markup', async () => {
  const html = readFileSync(target, 'utf8');
  const markupRefs = [
    ...html.matchAll(/\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+["']/gi),
    ...html.matchAll(/url\(\s*["']?(?:https?:)?\/\/[^)"']+/gi),
    ...html.matchAll(/@import\s+["'](?:https?:)?\/\//gi),
  ].map((m) => m[0].slice(0, 80));
  const problems = [];
  if (httpRequests.length) problems.push('runtime http(s) requests: ' + JSON.stringify([...new Set(httpRequests)].slice(0, 5)));
  if (markupRefs.length) problems.push('external refs in markup: ' + JSON.stringify(markupRefs.slice(0, 5)));
  return problems.length ? { status: 'fail', detail: problems.join(' | ') } : true;
});

await check('R08', 'AC3 zero console errors on load', async () =>
  loadErrorCount === 0 ? true : { status: 'fail', detail: consoleErrors.slice(0, loadErrorCount).join(' | ').slice(0, 400) });

await check('R09', 'AC4 no alert/confirm/prompt/native dialogs', async () =>
  dialogs.length === 0 ? true : { status: 'fail', detail: dialogs.slice(0, 5).join(' | ') });

await check('R36', 'F2 all guess() calls synchronous, no timing dependence for hook', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (sawAsyncGuess) return { status: 'fail', detail: 'guess() returned a Promise at least once (must return the array synchronously)' };
  const anyHookFail = results.some((r) => ['R03', 'R04', 'R05'].includes(r.id) && r.status === 'fail');
  return anyHookFail ? { status: 'fail', detail: 'hook contract checks failed (see R03-R05)' } : true;
});

await check('R37', 'F3 zero console errors across the full played run', async () =>
  consoleErrors.length === 0 ? true : { status: 'fail', detail: `${consoleErrors.length} error(s): ` + consoleErrors.slice(0, 5).join(' | ').slice(0, 400) });

// ---------------------------------------------------------------- output
await browser.close();

const order = Array.from({ length: 37 }, (_, i) => 'R' + String(i + 1).padStart(2, '0'));
results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
const summary = {
  target,
  pass: results.filter((r) => r.status === 'pass').length,
  fail: results.filter((r) => r.status === 'fail').length,
  skip: results.filter((r) => r.status === 'skip').length,
  total: results.length,
};
console.log(JSON.stringify({ summary, results }, null, 2));
process.exit(summary.fail > 0 ? 1 : 0);
