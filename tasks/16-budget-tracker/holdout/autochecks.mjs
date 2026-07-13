// Holdout autochecks for Task 16 — Budget Tracker.
// Usage: node autochecks.mjs [path-to-candidate-index.html]   (default ../src/index.html)
// Prints one JSON document to stdout: {summary, results:[{id,desc,status,detail}]}.
// status: "pass" | "fail" | "skip" (skip = needs human screenshot judgment per rubric.md).
// Exit code: 0 = ran, no fails; 1 = ran, >=1 fail; 2 = fatal (couldn't launch a browser).

import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] ?? join(__dirname, '..', 'src', 'index.html'));

// ---------------------------------------------------------------- rubric manifest
// (id -> short desc) so we can emit a full all-fail report when there is no candidate
// or no hook, and so the output ordering is stable.
const RUBRIC = [
  ['R01', 'H1 hook shape window.__budget {add,update,remove,list,balance}'],
  ['R02', 'H2 add() returns created tx with assigned id + fields'],
  ['R03', 'H3 list() new array of plain 6-field objects; mutation isolation'],
  ['R04', 'H8 balance() Number = income - expense (from list())'],
  ['R05', 'H4 update() applies fields, returns updated tx (same id)'],
  ['R06', 'H4/H6 update/remove unknown id -> null/false, no throw'],
  ['R07', 'H6 remove(id) -> true, drops the tx'],
  ['R08', 'invalid description (empty/whitespace) add() throws; state unchanged'],
  ['R09', 'invalid amount (0/neg/NaN/non-finite) add() throws; state unchanged'],
  ['R10', 'invalid type/category/date add() throws; state unchanged'],
  ['R11', 'update() invalid field throws atomically; state unchanged'],
  ['R12', 'self-contained: zero http(s) requests, no external refs in markup'],
  ['R13', 'zero console errors on fresh load'],
  ['R14', 'no alert/confirm/prompt/native dialogs'],
  ['R15', 'zero console errors across the full run'],
  ['R16', 'AC1 empty first load: list()=[], balance()=0, shows 0.00'],
  ['R17', 'AC1 form controls: type/description/amount#/>=4 categories/date'],
  ['R18', 'AC2 add income: balance +exact, row rendered, in localStorage'],
  ['R19', 'AC3 add expense: balance -exact, row rendered'],
  ['R20', 'AC4 balance = Sum(in)-Sum(ex), 2 decimals, balance() within 0.005'],
  ['R21', 'AC5 negative balance shown with leading minus, never clamped'],
  ['R22', 'AC5 negative balance visually distinct from non-negative'],
  ['R23', 'AC6 edit affordance per row'],
  ['R24', 'AC6 edit in place: same id, no dup, len same, balance+totals reflect'],
  ['R25', 'AC7 delete affordance per row'],
  ['R26', 'AC7 delete updates balance+totals; last delete -> empty state 0.00'],
  ['R27', 'AC8 total income & total expenses each exact (2 decimals)'],
  ['R28', 'AC8 per-category expense totals exact (2 decimals)'],
  ['R29', 'AC8 editing a category moves the amount between category totals'],
  ['R30', 'AC9 empty-description form submit adds nothing, no dialog'],
  ['R31', 'AC10 bad-amount form submit adds nothing, no dialog'],
  ['R32', 'AC11 add survives reload: same ids, same balance'],
  ['R33', 'AC11 edit & delete survive reload; ids unchanged'],
  ['R34', 'AC15 ids unique, stable, addressed by id (not position)'],
  ['R35', 'AC16 corrupt/missing storage -> empty, no crash, no console error'],
];
const RUBRIC_IDS = RUBRIC.map((r) => r[0]);

function emitAllFail(detail) {
  const results = RUBRIC.map(([id, desc]) => ({ id, desc, status: 'fail', detail }));
  const summary = { target, pass: 0, fail: results.length, skip: 0, total: results.length };
  console.log(JSON.stringify({ summary, results }, null, 2));
  process.exit(1);
}
function fatal(msg) {
  console.log(JSON.stringify({ fatal: msg, summary: null, results: [] }, null, 2));
  process.exit(2);
}

// Fail gracefully with a full all-fail report when the candidate is missing.
if (!existsSync(target)) emitAllFail('candidate file not found: ' + target);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  fatal('playwright not installed — run: npm install  (inside holdout/)');
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
function report(id, status, detail = '') {
  const desc = (RUBRIC.find((r) => r[0] === id) || [id, ''])[1];
  results.push({ id, desc, status, detail });
}
async function check(id, fn) {
  try {
    const r = await fn(); // {status, detail} | true | false
    if (r === true) report(id, 'pass');
    else if (r === false) report(id, 'fail');
    else report(id, r.status, r.detail || '');
  } catch (e) {
    report(id, 'fail', 'checker exception: ' + String(e && e.message || e).slice(0, 300));
  }
}
const HOOK_MISSING = { status: 'fail', detail: 'window.__budget hook missing/incomplete — cannot verify' };

// ---------------------------------------------------------------- page + listeners
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e && e.message || e).slice(0, 200)));
const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 100)); await d.dismiss().catch(() => {}); });
const httpRequests = [];
page.on('request', (r) => { if (/^https?:/i.test(r.url())) httpRequests.push(r.url()); });

const targetUrl = pathToFileURL(target).href;
await page.goto(targetUrl, { waitUntil: 'load' });
await page.waitForTimeout(350);
const loadErrorCount = consoleErrors.length;

// ---------------------------------------------------------------- hook plumbing
const hasHook = await page.evaluate(() => {
  const w = window.__budget;
  return !!w && ['add', 'update', 'remove', 'list', 'balance'].every((k) => typeof w[k] === 'function');
});

// call add(); returns {ok:true,value} on success or {ok:false,isError,name,message} on throw.
async function hookAdd(tx) {
  return page.evaluate((t) => {
    try { return { ok: true, value: window.__budget.add(t) }; }
    catch (e) { return { ok: false, isError: e instanceof Error, name: String(e && e.name), message: String(e && e.message).slice(0, 140) }; }
  }, tx);
}
async function hookUpdate(id, tx) {
  return page.evaluate(([i, t]) => {
    try { return { ok: true, value: window.__budget.update(i, t) }; }
    catch (e) { return { ok: false, isError: e instanceof Error, name: String(e && e.name), message: String(e && e.message).slice(0, 140) }; }
  }, [id, tx]);
}
async function hookRemove(id) { return page.evaluate((i) => window.__budget.remove(i), id); }
async function hookList() { return page.evaluate(() => JSON.parse(JSON.stringify(window.__budget.list()))); }
async function hookBalance() { return page.evaluate(() => window.__budget.balance()); }
async function snapshot() {
  return page.evaluate(() => JSON.stringify({
    list: window.__budget.list(),
    balance: window.__budget.balance(),
    storage: Object.entries(localStorage).sort(),
  }));
}
async function bodyText() { return page.evaluate(() => (document.body.innerText || document.body.textContent || '')); }
async function storageDump() { return page.evaluate(() => Object.entries(localStorage).map(([k, v]) => k + '=' + v).join('\n')); }

async function resetApp() {
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(200);
}

const okAdd = (r) => r && r.ok && r.value && (typeof r.value.id === 'string' || typeof r.value.id === 'number');
const VALID_CATS = ['Food', 'Entertainment']; // both appear in fCC + GfG canonical lists (RESEARCH.md)
function d(n) { return '2026-07-' + String(n).padStart(2, '0'); }
function near(a, b, eps = 0.005) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= eps; }
function money(n) { return n.toFixed(2); }

// ================================================================ discovery (fresh load)
let discoveredCats = null;   // category chooser option values (>=? )
let formControls = null;     // {type, desc, amount, date, catCount}
if (hasHook) {
  discoveredCats = await page.evaluate(() => {
    const selects = [...document.querySelectorAll('select')];
    for (const s of selects) {
      const opts = [...s.options].map((o) => (o.value || o.textContent || '').trim()).filter(Boolean);
      const lower = opts.map((o) => o.toLowerCase());
      const isType = opts.length <= 2 && lower.every((o) => o === 'income' || o === 'expense');
      if (isType) continue;
      if (opts.length >= 3) return opts;
    }
    return null;
  });
  formControls = await page.evaluate(() => {
    const q = (sel) => !!document.querySelector(sel);
    const amount = q('input[type="number"]');
    const date = q('input[type="date"]');
    // description: a text input that is not the amount/date
    const textInputs = [...document.querySelectorAll('input')].filter((i) => {
      const t = (i.getAttribute('type') || 'text').toLowerCase();
      return t === 'text' || t === '';
    });
    const desc = textInputs.length >= 1;
    // type choice: radios with income/expense OR a 2-option select of income/expense
    const radios = [...document.querySelectorAll('input[type="radio"]')].map((r) => (r.value || '').toLowerCase());
    const selects = [...document.querySelectorAll('select')];
    const typeSelect = selects.some((s) => {
      const opts = [...s.options].map((o) => (o.value || o.textContent || '').trim().toLowerCase());
      return opts.includes('income') && opts.includes('expense');
    });
    const typeRadio = radios.includes('income') && radios.includes('expense');
    const type = typeSelect || typeRadio || radios.length >= 2;
    // category count: largest non-type select's option count, or a set of category radios
    let catCount = 0;
    for (const s of selects) {
      const opts = [...s.options].map((o) => (o.value || o.textContent || '').trim()).filter(Boolean);
      const lower = opts.map((o) => o.toLowerCase());
      const isType = opts.length <= 2 && lower.every((o) => o === 'income' || o === 'expense');
      if (isType) continue;
      catCount = Math.max(catCount, opts.length);
    }
    return { type, desc, amount, date, catCount };
  });
}
const CAT_A = (discoveredCats && discoveredCats[0]) || VALID_CATS[0];
const CAT_B = (discoveredCats && discoveredCats[1]) || VALID_CATS[1];

// ================================================================ checks

// --- R01 hook shape
await check('R01', async () => hasHook ? true : { status: 'fail', detail: 'window.__budget missing or members not all functions' });

// --- R16 empty first load (before we mutate anything)
await check('R16', async () => {
  if (!hasHook) return HOOK_MISSING;
  const list = await hookList();
  const bal = await hookBalance();
  const txt = await bodyText();
  const problems = [];
  if (!(Array.isArray(list) && list.length === 0)) problems.push('list() not empty: ' + JSON.stringify(list).slice(0, 120));
  if (!near(bal, 0)) problems.push('balance() != 0: ' + JSON.stringify(bal));
  if (!/(^|[^\d])0\.00([^\d]|$)/.test(txt)) problems.push('no "0.00" displayed');
  return problems.length ? { status: 'fail', detail: problems.join(' | ') } : true;
});

// --- R17 form controls
await check('R17', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!formControls) return { status: 'skip', detail: 'form not introspectable — judge from screenshot' };
  const fc = formControls;
  const missing = [];
  if (!fc.type) missing.push('no income/expense type choice');
  if (!fc.desc) missing.push('no description text input');
  if (!fc.amount) missing.push('no input[type=number] amount');
  if (!fc.date) missing.push('no input[type=date]');
  if (fc.catCount < 4) missing.push(`category chooser has ${fc.catCount} options (<4)`);
  // If only the category-count / type is the issue but chooser may be non-<select>, skip to JUDGE.
  if (missing.length) {
    const hard = fc.amount && fc.date; // number+date are unambiguous; if those exist, others may just be non-standard markup
    return { status: hard ? 'skip' : 'fail', detail: missing.join('; ') + (hard ? ' — chooser/type may be non-<select> markup; judge from screenshot' : '') };
  }
  return true;
});

// --- R02 add() returns created tx with id
await check('R02', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const tx = { type: 'income', description: 'Zynqvex Salary', amount: 512.34, category: CAT_A, date: d(2) };
  const r = await hookAdd(tx);
  if (!okAdd(r)) return { status: 'fail', detail: 'add() did not return created tx with id: ' + JSON.stringify(r).slice(0, 160) };
  const v = r.value;
  const fieldsOk = v.type === 'income' && v.description === 'Zynqvex Salary' && near(v.amount, 512.34) && v.category === CAT_A && v.date === d(2);
  if (!fieldsOk) return { status: 'fail', detail: 'returned tx fields altered: ' + JSON.stringify(v).slice(0, 160) };
  const list = await hookList();
  const found = list.filter((t) => String(t.id) === String(v.id));
  if (list.length !== 1 || found.length !== 1) return { status: 'fail', detail: `list() length ${list.length}, matches ${found.length}` };
  return true;
});

// --- R03 list() shape + isolation
await check('R03', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'A', amount: 10, category: CAT_A, date: d(1) });
  await hookAdd({ type: 'expense', description: 'B', amount: 3.5, category: CAT_B, date: d(2) });
  const list = await hookList();
  const KEYS = ['amount', 'category', 'date', 'description', 'id', 'type'];
  for (const t of list) {
    const keys = Object.keys(t).sort();
    if (keys.join(',') !== KEYS.join(',')) return { status: 'fail', detail: 'tx keys != exactly the 6 fields: ' + JSON.stringify(keys) };
    if (!(typeof t.id === 'string' || typeof t.id === 'number')) return { status: 'fail', detail: 'id type ' + typeof t.id };
    if (!(t.type === 'income' || t.type === 'expense')) return { status: 'fail', detail: 'bad type ' + t.type };
    if (typeof t.description !== 'string') return { status: 'fail', detail: 'description not string' };
    if (typeof t.amount !== 'number' || !(t.amount > 0) || !isFinite(t.amount)) return { status: 'fail', detail: 'amount not positive finite number: ' + t.amount };
    if (typeof t.category !== 'string' || !t.category) return { status: 'fail', detail: 'category not non-empty string' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return { status: 'fail', detail: 'date not YYYY-MM-DD: ' + t.date };
  }
  // isolation: mutate the returned array + objects, confirm state unaffected
  const iso = await page.evaluate(() => {
    const a = window.__budget.list();
    const lenBefore = a.length;
    a.push({ id: '__junk__' });
    if (a[0]) { a[0].amount = 999999; a[0].description = '__tamper__'; }
    const b = window.__budget.list();
    return {
      sameRef: a === b,
      lenStable: b.length === lenBefore,
      untampered: !b.some((t) => t.description === '__tamper__' || t.amount === 999999 || t.id === '__junk__'),
    };
  });
  if (iso.sameRef) return { status: 'fail', detail: 'list() returns the same array reference on each call' };
  if (!iso.lenStable) return { status: 'fail', detail: 'pushing to returned array changed app state' };
  if (!iso.untampered) return { status: 'fail', detail: 'mutating returned objects changed app state' };
  return true;
});

// --- R04 balance() = income - expense
await check('R04', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'i1', amount: 300, category: CAT_A, date: d(1) });
  await hookAdd({ type: 'income', description: 'i2', amount: 50.25, category: CAT_A, date: d(2) });
  await hookAdd({ type: 'expense', description: 'e1', amount: 120.10, category: CAT_B, date: d(3) });
  const list = await hookList();
  const expected = list.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const bal = await hookBalance();
  if (typeof bal !== 'number') return { status: 'fail', detail: 'balance() not a Number: ' + typeof bal };
  return near(bal, expected) ? true : { status: 'fail', detail: `balance() ${bal} != income-expense ${expected}` };
});

// --- R05 update() valid
await check('R05', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const r = await hookAdd({ type: 'expense', description: 'orig', amount: 40, category: CAT_A, date: d(5) });
  if (!okAdd(r)) return { status: 'fail', detail: 'setup add failed' };
  const id = r.value.id;
  const u = await hookUpdate(id, { amount: 12.5, description: 'edited' });
  if (!u.ok || !u.value) return { status: 'fail', detail: 'update() did not return updated tx: ' + JSON.stringify(u).slice(0, 140) };
  if (String(u.value.id) !== String(id)) return { status: 'fail', detail: 'update() changed the id' };
  const list = await hookList();
  if (list.length !== 1) return { status: 'fail', detail: 'update() changed list length: ' + list.length };
  const t = list[0];
  if (!(near(t.amount, 12.5) && t.description === 'edited')) return { status: 'fail', detail: 'fields not applied: ' + JSON.stringify(t) };
  return true;
});

// --- R06 unknown id -> null/false, no throw
await check('R06', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'keep', amount: 5, category: CAT_A, date: d(1) });
  const before = await snapshot();
  const u = await hookUpdate('__nope__', { amount: 99 });
  if (!u.ok) return { status: 'fail', detail: 'update(unknownId) threw: ' + JSON.stringify(u).slice(0, 120) };
  if (u.value !== null) return { status: 'fail', detail: 'update(unknownId) returned ' + JSON.stringify(u.value) + ' (expected null)' };
  const rem = await hookRemove('__nope__');
  if (rem !== false) return { status: 'fail', detail: 'remove(unknownId) returned ' + JSON.stringify(rem) + ' (expected false)' };
  const after = await snapshot();
  return before === after ? true : { status: 'fail', detail: 'state changed by unknown-id ops' };
});

// --- R07 remove() deletes
await check('R07', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const a = await hookAdd({ type: 'income', description: 'A', amount: 10, category: CAT_A, date: d(1) });
  const b = await hookAdd({ type: 'expense', description: 'B', amount: 4, category: CAT_B, date: d(2) });
  if (!okAdd(a) || !okAdd(b)) return { status: 'fail', detail: 'setup adds failed' };
  const rem = await hookRemove(b.value.id);
  if (rem !== true) return { status: 'fail', detail: 'remove() returned ' + JSON.stringify(rem) + ' (expected true)' };
  const list = await hookList();
  if (list.length !== 1 || String(list[0].id) !== String(a.value.id)) return { status: 'fail', detail: 'wrong tx remained: ' + JSON.stringify(list) };
  return true;
});

// --- R08 invalid description throws, state unchanged
await check('R08', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'base', amount: 5, category: CAT_A, date: d(1) });
  const before = await snapshot();
  for (const bad of ['', '   ', '\t\n ']) {
    const r = await hookAdd({ type: 'expense', description: bad, amount: 10, category: CAT_A, date: d(2) });
    if (r.ok) return { status: 'fail', detail: `add() with description=${JSON.stringify(bad)} did NOT throw` };
    if (!r.isError) return { status: 'fail', detail: 'threw a non-Error for empty description: ' + JSON.stringify(r).slice(0, 120) };
  }
  const after = await snapshot();
  return before === after ? true : { status: 'fail', detail: 'state changed after invalid-description throw' };
});

// --- R09 invalid amount throws, state unchanged
await check('R09', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'base', amount: 5, category: CAT_A, date: d(1) });
  const before = await snapshot();
  const bads = [0, -1, -0.01, NaN, Infinity, 'abc', null, undefined, ''];
  for (const amt of bads) {
    const r = await hookAdd({ type: 'expense', description: 'x', amount: amt, category: CAT_A, date: d(2) });
    if (r.ok) return { status: 'fail', detail: `add() with amount=${JSON.stringify(amt)} did NOT throw` };
    if (!r.isError) return { status: 'fail', detail: `threw non-Error for amount=${JSON.stringify(amt)}: ` + JSON.stringify(r).slice(0, 120) };
  }
  const after = await snapshot();
  return before === after ? true : { status: 'fail', detail: 'state changed after invalid-amount throw' };
});

// --- R10 invalid type/category/date throws, state unchanged
await check('R10', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'base', amount: 5, category: CAT_A, date: d(1) });
  const before = await snapshot();
  const bads = [
    { type: 'transfer', description: 'x', amount: 10, category: CAT_A, date: d(2) },
    { type: '', description: 'x', amount: 10, category: CAT_A, date: d(2) },
    { type: 'expense', description: 'x', amount: 10, category: '', date: d(2) },
    { type: 'expense', description: 'x', amount: 10, category: '   ', date: d(2) },
    { type: 'expense', description: 'x', amount: 10, category: CAT_A, date: '07/02/2026' },
    { type: 'expense', description: 'x', amount: 10, category: CAT_A, date: '2026-7-2' },
    { type: 'expense', description: 'x', amount: 10, category: CAT_A, date: 'not-a-date' },
  ];
  for (const tx of bads) {
    const r = await hookAdd(tx);
    if (r.ok) return { status: 'fail', detail: 'add() did NOT throw for invalid: ' + JSON.stringify(tx) };
    if (!r.isError) return { status: 'fail', detail: 'threw non-Error for ' + JSON.stringify(tx).slice(0, 90) };
  }
  const after = await snapshot();
  return before === after ? true : { status: 'fail', detail: 'state changed after invalid type/category/date throw' };
});

// --- R11 update() invalid field throws atomically
await check('R11', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const a = await hookAdd({ type: 'income', description: 'keep', amount: 50, category: CAT_A, date: d(1) });
  if (!okAdd(a)) return { status: 'fail', detail: 'setup add failed' };
  const id = a.value.id;
  const before = await snapshot();
  const bads = [{ amount: -1 }, { amount: 0 }, { amount: NaN }, { description: '' }, { type: 'nope' }, { category: '' }, { date: 'bad' }];
  for (const tx of bads) {
    const r = await hookUpdate(id, tx);
    if (r.ok) return { status: 'fail', detail: 'update() did NOT throw for invalid field: ' + JSON.stringify(tx) };
    if (!r.isError) return { status: 'fail', detail: 'update() threw non-Error for ' + JSON.stringify(tx) };
  }
  const after = await snapshot();
  return before === after ? true : { status: 'fail', detail: 'state changed after invalid update() throw' };
});

// --- R18 add income -> row + balance + storage
await check('R18', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const before = await hookBalance();
  const desc = 'Zqxwincome';
  const r = await hookAdd({ type: 'income', description: desc, amount: 512.34, category: CAT_A, date: d(2) });
  if (!okAdd(r)) return { status: 'fail', detail: 'add income failed: ' + JSON.stringify(r).slice(0, 120) };
  await page.waitForTimeout(150);
  const after = await hookBalance();
  if (!near(after - before, 512.34)) return { status: 'fail', detail: `balance delta ${after - before} != 512.34` };
  const txt = await bodyText();
  const problems = [];
  if (!txt.includes(desc)) problems.push('description not rendered');
  if (!txt.includes('512.34')) problems.push('2-decimal amount 512.34 not rendered');
  if (!txt.includes(CAT_A)) problems.push('category not rendered');
  const store = await storageDump();
  if (!store.includes(desc)) problems.push('not persisted to localStorage synchronously');
  if (problems.length) return { status: 'fail', detail: problems.join(' | ') };
  const dateShown = /2026-07-02/.test(txt) || /2026/.test(txt);
  if (!dateShown) return { status: 'skip', detail: 'row desc+amount+category+balance OK; date not found in a recognizable form — judge date display from screenshot' };
  return true;
});

// --- R19 add expense -> row + balance
await check('R19', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'seed', amount: 500, category: CAT_A, date: d(1) });
  const before = await hookBalance();
  const desc = 'Zqxwexpense';
  const r = await hookAdd({ type: 'expense', description: desc, amount: 100, category: CAT_B, date: d(2) });
  if (!okAdd(r)) return { status: 'fail', detail: 'add expense failed: ' + JSON.stringify(r).slice(0, 120) };
  await page.waitForTimeout(150);
  const after = await hookBalance();
  if (!near(before - after, 100)) return { status: 'fail', detail: `expense balance delta ${before - after} != 100` };
  const txt = await bodyText();
  const problems = [];
  if (!txt.includes(desc)) problems.push('expense description not rendered');
  if (!txt.includes('100.00')) problems.push('2-decimal amount 100.00 not rendered');
  return problems.length ? { status: 'fail', detail: problems.join(' | ') } : true;
});

// --- R20 balance formula + 2 decimals
await check('R20', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'i1', amount: 300, category: CAT_A, date: d(1) });
  await hookAdd({ type: 'income', description: 'i2', amount: 50.25, category: CAT_A, date: d(2) });
  await hookAdd({ type: 'expense', description: 'e1', amount: 120.10, category: CAT_B, date: d(3) });
  await hookAdd({ type: 'expense', description: 'e2', amount: 5.05, category: CAT_B, date: d(4) });
  await page.waitForTimeout(150);
  const bal = await hookBalance();
  const expected = 350.25 - 125.15; // 225.10
  if (!near(bal, expected)) return { status: 'fail', detail: `balance() ${bal} != ${expected}` };
  const txt = await bodyText();
  if (!txt.includes(money(expected))) return { status: 'fail', detail: `displayed balance did not show "${money(expected)}" (2-decimals)` };
  return true;
});

// --- R21 negative balance signed, never clamped
await check('R21', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'i', amount: 10, category: CAT_A, date: d(1) });
  await hookAdd({ type: 'expense', description: 'e', amount: 35.50, category: CAT_B, date: d(2) });
  await page.waitForTimeout(150);
  const bal = await hookBalance();
  if (!near(bal, -25.50)) return { status: 'fail', detail: `balance() ${bal} != -25.50 (clamped or wrong sign?)` };
  const txt = await bodyText();
  if (!/[-−]\s*\$?\s*25\.50/.test(txt)) return { status: 'fail', detail: 'no leading-minus "-25.50"/"-$25.50" displayed; text sample: ' + txt.replace(/\s+/g, ' ').slice(0, 160) };
  return true;
});

// --- R22 negative balance visually distinct
await check('R22', async () => {
  if (!hasHook) return HOOK_MISSING;
  // color of the balance element in negative state (from R21 setup) vs a positive state.
  const colorOf = async (numStr) => page.evaluate((s) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const cands = [...document.querySelectorAll('*')].filter((el) => el.childElementCount === 0 && vis(el));
    const re = new RegExp('^[\\s$−+-]*' + s.replace('.', '\\.') + '$');
    for (const el of cands) { if (re.test((el.textContent || '').trim())) return getComputedStyle(el).color; }
    // fallback: any leaf whose text contains the number
    for (const el of cands) { if ((el.textContent || '').includes(s)) return getComputedStyle(el).color; }
    return null;
  }, numStr);
  await resetApp();
  await hookAdd({ type: 'income', description: 'i', amount: 10, category: CAT_A, date: d(1) });
  await hookAdd({ type: 'expense', description: 'e', amount: 35.50, category: CAT_B, date: d(2) });
  await page.waitForTimeout(150);
  const negColor = await colorOf('25.50');
  await resetApp();
  await hookAdd({ type: 'income', description: 'i', amount: 25.50, category: CAT_A, date: d(1) });
  await page.waitForTimeout(150);
  const posColor = await colorOf('25.50');
  if (!negColor || !posColor) return { status: 'skip', detail: `could not locate balance element color (neg=${negColor}, pos=${posColor}) — judge distinction from screenshots` };
  if (negColor === posColor) return { status: 'fail', detail: `negative balance not visually distinct: both colored ${negColor}` };
  return { status: 'pass', detail: `neg=${negColor} vs pos=${posColor}` };
});

// --- R23 edit affordance per row
async function affordanceCount(kind) {
  return page.evaluate((k) => {
    const editRe = /edit|modify|pencil|✎|✏|✐/i;
    const delRe = /delete|remove|trash|✕|✖|×|🗑|❌|✗/i;
    const re = k === 'edit' ? editRe : delRe;
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const ctrls = [...document.querySelectorAll('button, a, [role="button"], [onclick], input[type="button"], input[type="submit"]')].filter(vis);
    let n = 0;
    for (const el of ctrls) {
      const label = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.title || '') + ' ' + (el.className || '') + ' ' + (el.value || '')).trim();
      if (re.test(label)) n++;
    }
    return n;
  }, kind);
}
await check('R23', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'row1', amount: 10, category: CAT_A, date: d(1) });
  await hookAdd({ type: 'expense', description: 'row2', amount: 4, category: CAT_B, date: d(2) });
  await page.waitForTimeout(150);
  const n = await affordanceCount('edit');
  if (n >= 2) return true;
  return { status: 'skip', detail: `found ${n} edit-like controls for 2 rows — judge edit affordance from screenshot` };
});

// --- R24 edit in place, everything reflects
await check('R24', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const a = await hookAdd({ type: 'income', description: 'inc', amount: 100, category: CAT_A, date: d(1) });
  const b = await hookAdd({ type: 'expense', description: 'exp', amount: 40, category: CAT_B, date: d(2) });
  if (!okAdd(a) || !okAdd(b)) return { status: 'fail', detail: 'setup adds failed' };
  const lenBefore = (await hookList()).length;
  const u = await hookUpdate(b.value.id, { amount: 10 });
  if (!u.ok || !u.value) return { status: 'fail', detail: 'update() failed: ' + JSON.stringify(u).slice(0, 120) };
  await page.waitForTimeout(150);
  const list = await hookList();
  if (list.length !== lenBefore) return { status: 'fail', detail: `list length changed ${lenBefore} -> ${list.length} (duplicate row?)` };
  if (String(u.value.id) !== String(b.value.id)) return { status: 'fail', detail: 'id changed on edit' };
  const bal = await hookBalance();
  if (!near(bal, 90)) return { status: 'fail', detail: `balance after edit ${bal} != 90` };
  const txt = await bodyText();
  if (!txt.includes('90.00')) return { status: 'fail', detail: 'displayed balance did not update to 90.00 after edit' };
  return true;
});

// --- R25 delete affordance per row
await check('R25', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'row1', amount: 10, category: CAT_A, date: d(1) });
  await hookAdd({ type: 'expense', description: 'row2', amount: 4, category: CAT_B, date: d(2) });
  await page.waitForTimeout(150);
  const n = await affordanceCount('delete');
  if (n >= 2) return true;
  return { status: 'skip', detail: `found ${n} delete-like controls for 2 rows — judge delete affordance from screenshot` };
});

// --- R26 delete updates + last delete -> empty
await check('R26', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const a = await hookAdd({ type: 'income', description: 'inc', amount: 100, category: CAT_A, date: d(1) });
  const b = await hookAdd({ type: 'expense', description: 'Zqexprow', amount: 40, category: CAT_B, date: d(2) });
  if (!okAdd(a) || !okAdd(b)) return { status: 'fail', detail: 'setup adds failed' };
  await hookRemove(b.value.id);
  await page.waitForTimeout(150);
  let bal = await hookBalance();
  if (!near(bal, 100)) return { status: 'fail', detail: `balance after 1st delete ${bal} != 100` };
  let txt = await bodyText();
  if (txt.includes('Zqexprow')) return { status: 'fail', detail: 'deleted expense row still rendered' };
  if (!txt.includes('100.00')) return { status: 'fail', detail: 'balance did not update to 100.00 after delete' };
  await hookRemove(a.value.id);
  await page.waitForTimeout(150);
  const list = await hookList();
  bal = await hookBalance();
  txt = await bodyText();
  if (list.length !== 0) return { status: 'fail', detail: 'list not empty after deleting last: ' + JSON.stringify(list) };
  if (!near(bal, 0)) return { status: 'fail', detail: `balance ${bal} != 0 after deleting last` };
  if (!/(^|[^\d])0\.00([^\d]|$)/.test(txt)) return { status: 'fail', detail: 'empty state does not show 0.00 balance' };
  return true;
});

// --- R27/R28/R29 dashboard (shared setup)
// Amounts chosen so aggregates match NO single row: total income 100.10 (40+60.10),
// total expenses 94.30; CAT_A expenses 13.10+26.20 = 39.30; CAT_B expense 55.00.
let dashSetupOk = false;
let expE3Id = null;
await check('R27', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const adds = [
    { type: 'income', description: 'inc1', amount: 40.00, category: CAT_A, date: d(1) },
    { type: 'income', description: 'inc2', amount: 60.10, category: CAT_A, date: d(2) },
    { type: 'expense', description: 'exA1', amount: 13.10, category: CAT_A, date: d(3) },
    { type: 'expense', description: 'exA2', amount: 26.20, category: CAT_A, date: d(4) },
    { type: 'expense', description: 'exB1', amount: 55.00, category: CAT_B, date: d(5) },
  ];
  const ids = [];
  for (const tx of adds) { const r = await hookAdd(tx); if (!okAdd(r)) return { status: 'fail', detail: 'dashboard setup add failed: ' + JSON.stringify(r).slice(0, 120) }; ids.push(r.value.id); }
  expE3Id = ids[4]; // the CAT_B 55.00 expense
  dashSetupOk = true;
  await page.waitForTimeout(150);
  const txt = await bodyText();
  const problems = [];
  if (!txt.includes('100.10')) problems.push('total income 100.10 not displayed');
  if (!txt.includes('94.30')) problems.push('total expenses 94.30 not displayed');
  return problems.length ? { status: 'fail', detail: problems.join(' | ') } : true;
});

await check('R28', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!dashSetupOk) return { status: 'fail', detail: 'dashboard setup (R27) did not complete' };
  const txt = await bodyText();
  const problems = [];
  // 39.30 is ONLY the CAT_A expense aggregate (no single row equals it) -> proves per-category summation.
  if (!txt.includes('39.30')) problems.push(`per-category total for ${CAT_A} (39.30) not displayed`);
  if (!txt.includes('55.00')) problems.push(`per-category total for ${CAT_B} (55.00) not displayed`);
  if (problems.length) return { status: 'skip', detail: problems.join(' | ') + ' — if categories are non-standard the summary may use different labels; judge per-category totals from screenshot' };
  return true;
});

await check('R29', async () => {
  if (!hasHook) return HOOK_MISSING;
  if (!dashSetupOk || !expE3Id) return { status: 'fail', detail: 'dashboard setup (R27) did not complete' };
  // move the CAT_B 55.00 expense into CAT_A: CAT_A total 39.30 -> 94.30, CAT_B -> 0.
  const u = await hookUpdate(expE3Id, { category: CAT_A });
  if (!u.ok) return { status: 'fail', detail: 'update(category) threw/failed: ' + JSON.stringify(u).slice(0, 120) };
  await page.waitForTimeout(150);
  const txt = await bodyText();
  // 39.30 was ONLY ever the CAT_A aggregate; it must be gone now. 94.30 = new CAT_A total.
  if (txt.includes('39.30')) return { status: 'fail', detail: 'old category total 39.30 still shown after moving the expense (breakdown did not update)' };
  if (!txt.includes('94.30')) return { status: 'skip', detail: 'destination category total 94.30 not found (labels may differ) — judge category-move from screenshot' };
  return true;
});

// --- form-driving helper for R30/R31
async function fillAndSubmit({ description, amount }) {
  return page.evaluate((vals) => {
    const forms = [...document.querySelectorAll('form')];
    const form = forms[0] || document.body;
    const setVal = (el, v) => {
      const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : (el.type === 'number' ? HTMLInputElement.prototype : HTMLInputElement.prototype);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, v); else el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const scope = form === document.body ? document : form;
    const numEl = scope.querySelector('input[type="number"]');
    const dateEl = scope.querySelector('input[type="date"]');
    const textEls = [...scope.querySelectorAll('input')].filter((i) => { const t = (i.getAttribute('type') || 'text').toLowerCase(); return t === 'text' || t === ''; });
    const descEl = textEls[0] || null;
    const selEl = [...scope.querySelectorAll('select')].find((s) => { const o = [...s.options].map((x) => (x.value || x.textContent || '').trim().toLowerCase()); return !(o.length <= 2 && o.every((z) => z === 'income' || z === 'expense')); });
    const info = { hasNum: !!numEl, hasDesc: !!descEl, hasForm: form !== document.body };
    if (dateEl) setVal(dateEl, '2026-07-09');
    if (selEl && selEl.options.length) setVal(selEl, selEl.options[selEl.options.length - 1].value);
    // type = expense if radios/select present
    const typeRadio = [...scope.querySelectorAll('input[type="radio"]')].find((r) => (r.value || '').toLowerCase() === 'expense');
    if (typeRadio) { typeRadio.checked = true; typeRadio.dispatchEvent(new Event('change', { bubbles: true })); }
    if (descEl) setVal(descEl, vals.description);
    if (numEl && vals.amount !== undefined) setVal(numEl, String(vals.amount));
    // submit
    let submitted = false;
    if (form !== document.body) {
      const btn = form.querySelector('button[type="submit"], input[type="submit"]') ||
        [...form.querySelectorAll('button')].find((b) => /add|save|submit|create/i.test(b.textContent || ''));
      if (form.requestSubmit) { form.requestSubmit(btn || undefined); submitted = true; }
      else if (btn) { btn.click(); submitted = true; }
      else { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); submitted = true; }
    } else {
      const btn = [...document.querySelectorAll('button')].find((b) => /add|save|submit|create/i.test(b.textContent || ''));
      if (btn) { btn.click(); submitted = true; }
    }
    return { ...info, submitted };
  }, { description, amount });
}

// --- R30 empty-description form submit adds nothing
await check('R30', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const before = await snapshot();
  const dlgBefore = dialogs.length;
  const info = await fillAndSubmit({ description: '   ', amount: 50 });
  if (!info.hasNum || !info.hasDesc || !info.submitted) return { status: 'skip', detail: 'could not drive the form (hasNum=' + info.hasNum + ', hasDesc=' + info.hasDesc + ', submitted=' + info.submitted + ') — judge empty-description rejection from a manual session; hook path is R08' };
  await page.waitForTimeout(200);
  const after = await snapshot();
  if (dialogs.length > dlgBefore) return { status: 'fail', detail: 'a dialog fired on empty-description submit' };
  return before === after ? { status: 'pass', detail: 'nothing added on empty-description submit (in-page message wording: judge from screenshot)' }
    : { status: 'fail', detail: 'empty-description submit changed state (added a transaction?)' };
});

// --- R31 bad-amount form submit adds nothing
await check('R31', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const dlgBefore = dialogs.length;
  let drove = false;
  for (const amt of [0, -5]) {
    const before = await snapshot();
    const info = await fillAndSubmit({ description: 'Testexp', amount: amt });
    if (!info.hasNum || !info.submitted) return { status: 'skip', detail: 'could not drive the form (hasNum=' + info.hasNum + ', submitted=' + info.submitted + ') — judge bad-amount rejection manually; hook path is R09' };
    drove = true;
    await page.waitForTimeout(150);
    const after = await snapshot();
    if (before !== after) return { status: 'fail', detail: `bad-amount (${amt}) submit changed state (added a transaction?)` };
  }
  if (dialogs.length > dlgBefore) return { status: 'fail', detail: 'a dialog fired on bad-amount submit' };
  return drove ? { status: 'pass', detail: 'nothing added on amount 0/-5 submit (message wording: judge from screenshot)' } : { status: 'skip', detail: 'form not drivable' };
});

// --- R32 add survives reload
await check('R32', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const a = await hookAdd({ type: 'income', description: 'persist1', amount: 77.70, category: CAT_A, date: d(1) });
  const b = await hookAdd({ type: 'expense', description: 'persist2', amount: 22.20, category: CAT_B, date: d(2) });
  if (!okAdd(a) || !okAdd(b)) return { status: 'fail', detail: 'setup adds failed' };
  const idA = String(a.value.id), idB = String(b.value.id);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(250);
  const list = await hookList();
  const bal = await hookBalance();
  if (list.length !== 2) return { status: 'fail', detail: 'after reload list length ' + list.length + ' (expected 2)' };
  const ids = list.map((t) => String(t.id));
  if (!(ids.includes(idA) && ids.includes(idB))) return { status: 'fail', detail: 'ids not stable across reload: ' + JSON.stringify(ids) + ' vs ' + JSON.stringify([idA, idB]) };
  if (!near(bal, 55.50)) return { status: 'fail', detail: 'balance after reload ' + bal + ' != 55.50' };
  const txt = await bodyText();
  if (!(txt.includes('persist1') && txt.includes('55.50'))) return { status: 'fail', detail: 'rows/balance did not re-render after reload' };
  return true;
});

// --- R33 edit & delete survive reload
await check('R33', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const a = await hookAdd({ type: 'income', description: 'keepinc', amount: 100, category: CAT_A, date: d(1) });
  const b = await hookAdd({ type: 'expense', description: 'editme', amount: 30, category: CAT_B, date: d(2) });
  if (!okAdd(a) || !okAdd(b)) return { status: 'fail', detail: 'setup adds failed' };
  const idB = String(b.value.id);
  await hookUpdate(b.value.id, { amount: 10 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(250);
  let list = await hookList();
  const edited = list.find((t) => String(t.id) === idB);
  if (!edited || !near(edited.amount, 10)) return { status: 'fail', detail: 'edit did not survive reload: ' + JSON.stringify(edited) };
  if (!near(await hookBalance(), 90)) return { status: 'fail', detail: 'balance after edit+reload != 90' };
  // now delete the income, reload, confirm it stays deleted + ids unchanged
  await hookRemove(a.value.id);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(250);
  list = await hookList();
  if (list.length !== 1 || String(list[0].id) !== idB) return { status: 'fail', detail: 'delete did not survive reload / id changed: ' + JSON.stringify(list) };
  return true;
});

// --- R34 ids unique, stable, addressed by id
await check('R34', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  const a = await hookAdd({ type: 'income', description: 'A', amount: 10, category: CAT_A, date: d(1) });
  const b = await hookAdd({ type: 'expense', description: 'B', amount: 20, category: CAT_B, date: d(2) });
  const c = await hookAdd({ type: 'expense', description: 'C', amount: 30, category: CAT_A, date: d(3) });
  if (!okAdd(a) || !okAdd(b) || !okAdd(c)) return { status: 'fail', detail: 'setup adds failed' };
  const idA = String(a.value.id), idB = String(b.value.id), idC = String(c.value.id);
  if (new Set([idA, idB, idC]).size !== 3) return { status: 'fail', detail: 'ids not unique: ' + JSON.stringify([idA, idB, idC]) };
  // remove the MIDDLE one -> address by id, not position
  await hookRemove(b.value.id);
  let list = await hookList();
  let ids = list.map((t) => String(t.id));
  if (list.length !== 2 || ids.includes(idB) || !(ids.includes(idA) && ids.includes(idC)))
    return { status: 'fail', detail: 'remove-by-id removed the wrong tx: remaining ' + JSON.stringify(ids) };
  // edit A -> id must not change
  await hookUpdate(a.value.id, { description: 'A-renamed' });
  // reload -> ids stable
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(250);
  list = await hookList();
  ids = list.map((t) => String(t.id));
  if (!(ids.length === 2 && ids.includes(idA) && ids.includes(idC)))
    return { status: 'fail', detail: 'ids not stable across edit+reload: ' + JSON.stringify(ids) };
  const renamed = list.find((t) => String(t.id) === idA);
  if (!renamed || renamed.description !== 'A-renamed') return { status: 'fail', detail: 'edit not persisted / id remapped' };
  return true;
});

// --- R35 corrupt/missing storage -> empty, no crash, no console error
await check('R35', async () => {
  if (!hasHook) return HOOK_MISSING;
  await resetApp();
  await hookAdd({ type: 'income', description: 'seed', amount: 12.34, category: CAT_A, date: d(1) });
  // corrupt every key the app created + a decoy
  await page.evaluate(() => {
    const garbage = '{corrupt[[[not-json,,,';
    for (const k of Object.keys(localStorage)) localStorage.setItem(k, garbage);
    localStorage.setItem('__decoy_budget__', garbage);
  });
  const errBefore = consoleErrors.length;
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  const stillHook = await page.evaluate(() => {
    const w = window.__budget;
    return !!w && ['add', 'update', 'remove', 'list', 'balance'].every((k) => typeof w[k] === 'function');
  });
  if (!stillHook) return { status: 'fail', detail: 'app crashed on corrupt storage (hook missing after reload)' };
  const list = await hookList();
  const bal = await hookBalance();
  const newErrors = consoleErrors.slice(errBefore);
  const problems = [];
  if (!(Array.isArray(list) && list.length === 0)) problems.push('list() not empty on corrupt load: ' + JSON.stringify(list).slice(0, 120));
  if (!near(bal, 0)) problems.push('balance() != 0 on corrupt load: ' + bal);
  if (newErrors.length) problems.push(newErrors.length + ' console error(s) on corrupt load: ' + newErrors.slice(0, 3).join(' | ').slice(0, 200));
  return problems.length ? { status: 'fail', detail: problems.join(' | ') } : true;
});

// --- R12 self-contained (static + runtime)
await check('R12', async () => {
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

// --- R13 clean first load
await check('R13', async () =>
  loadErrorCount === 0 ? true : { status: 'fail', detail: consoleErrors.slice(0, loadErrorCount).join(' | ').slice(0, 400) });

// --- R14 no dialogs
await check('R14', async () =>
  dialogs.length === 0 ? true : { status: 'fail', detail: dialogs.slice(0, 5).join(' | ') });

// --- R15 zero console errors across the full run
await check('R15', async () =>
  consoleErrors.length === 0 ? true : { status: 'fail', detail: `${consoleErrors.length} error(s): ` + consoleErrors.slice(0, 6).join(' | ').slice(0, 400) });

// ---------------------------------------------------------------- output
await browser.close();
results.sort((a, b) => RUBRIC_IDS.indexOf(a.id) - RUBRIC_IDS.indexOf(b.id));
const summary = {
  target,
  pass: results.filter((r) => r.status === 'pass').length,
  fail: results.filter((r) => r.status === 'fail').length,
  skip: results.filter((r) => r.status === 'skip').length,
  total: results.length,
};
console.log(JSON.stringify({ summary, results }, null, 2));
process.exit(summary.fail > 0 ? 1 : 0);
