// Independent verifier pass (round 0) — driven by window.__budget hook + form + screenshots.
// Does NOT reuse holdout autochecks; recomputes key spec behaviors from scratch.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve("C:/Users/iamjo/Projects/ai-benchmark/tasks/16-budget-tracker/src/index.html");
const OUT = path.resolve("C:/Users/iamjo/Projects/ai-benchmark/tasks/16-budget-tracker/verify/round-0");
const fileUrl = pathToFileURL(SRC).href;

const results = [];
const rec = (id, ok, detail) => { results.push({ id, ok: !!ok, detail: detail || "" }); };

const consoleErrors = [];
const pageErrors = [];
const dialogs = [];
const netRequests = [];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => { pageErrors.push(String(e)); });
page.on("dialog", async (d) => { dialogs.push(d.type()); await d.dismiss().catch(() => {}); });
page.on("request", (r) => { const u = r.url(); if (!u.startsWith("file:") && !u.startsWith("data:")) netRequests.push(u); });

// clear storage for clean first load
await page.goto(fileUrl);
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload();
await page.waitForFunction(() => window.__budget && typeof window.__budget.add === "function");

// ~0s screenshot (fresh, empty)
await page.screenshot({ path: path.join(OUT, "shot-0s.png"), fullPage: true });

// ---- Fresh state checks ----
const empty = await page.evaluate(() => ({ list: window.__budget.list(), bal: window.__budget.balance(), balText: document.getElementById("balanceValue").textContent }));
rec("A-empty", Array.isArray(empty.list) && empty.list.length === 0 && empty.bal === 0 && /0\.00/.test(empty.balText), `list.len=${empty.list.length} bal=${empty.bal} txt=${empty.balText}`);

// hook shape
const shape = await page.evaluate(() => {
  const b = window.__budget; return ["add","update","remove","list","balance"].every(k => typeof b[k] === "function");
});
rec("A-hookshape", shape, "");

// list isolation + key set
const iso = await page.evaluate(() => {
  const r = window.__budget.add({ type:"income", description:"Salary", amount:5000, category:"Salary", date:"2026-07-01" });
  const l1 = window.__budget.list();
  l1.push({ junk: true }); l1[0].amount = 999999;
  const l2 = window.__budget.list();
  const keys = Object.keys(l2[0]).sort().join(",");
  return { hasId: !!r.id, retAmt: r.amount, keys, len2: l2.length, amt2: l2[0].amount };
});
rec("A-add-returns-id", iso.hasId && iso.retAmt === 5000, `id present=${iso.hasId}`);
rec("A-list-isolation", iso.len2 === 1 && iso.amt2 === 5000, `mutation leaked? amt=${iso.amt2} len=${iso.len2}`);
rec("A-list-keys", iso.keys === "amount,category,date,description,id,type", `keys=${iso.keys}`);

// balance after income
const b1 = await page.evaluate(() => ({ bal: window.__budget.balance(), txt: document.getElementById("balanceValue").textContent }));
rec("A-income-balance", Math.abs(b1.bal - 5000) < 0.005 && /5000\.00/.test(b1.txt), `bal=${b1.bal} txt=${b1.txt}`);

// add expenses; per-category exact sums that match no single row
const exp = await page.evaluate(() => {
  window.__budget.add({ type:"expense", description:"Groceries A", amount:19.15, category:"Food", date:"2026-07-02" });
  window.__budget.add({ type:"expense", description:"Groceries B", amount:20.15, category:"Food", date:"2026-07-03" });
  window.__budget.add({ type:"expense", description:"Bus", amount:100.10, category:"Transport", date:"2026-07-04" });
  return { bal: window.__budget.balance() };
});
// balance = 5000 - (19.15+20.15+100.10) = 5000 - 139.40 = 4860.60
rec("A-mixed-balance", Math.abs(exp.bal - 4860.60) < 0.005, `bal=${exp.bal} (expect 4860.60)`);

// read DOM category totals & summary cards
const cat = await page.evaluate(() => {
  const txt = document.getElementById("categoryContainer").textContent;
  const inc = document.getElementById("incomeValue").textContent;
  const expn = document.getElementById("expenseValue").textContent;
  return { txt, inc, expn };
});
rec("A-cat-food", /39\.30/.test(cat.txt), `Food total present? cat="${cat.txt}"`); // 19.15+20.15=39.30 (no single row)
rec("A-cat-transport", /100\.10/.test(cat.txt), `Transport present? cat="${cat.txt}"`);
rec("A-total-income", /5000\.00/.test(cat.inc), `income card=${cat.inc}`);
rec("A-total-expense", /139\.40/.test(cat.expn), `expense card=${cat.expn}`);

// negative balance: wipe, add small income + big expense
const neg = await page.evaluate(() => {
  window.__budget.list().forEach(t => window.__budget.remove(t.id));
  window.__budget.add({ type:"income", description:"Tip", amount:10, category:"Salary", date:"2026-07-05" });
  window.__budget.add({ type:"expense", description:"Dinner", amount:35.50, category:"Food", date:"2026-07-06" });
  const bv = document.getElementById("balanceValue");
  const cs = getComputedStyle(bv);
  return { bal: window.__budget.balance(), txt: bv.textContent, color: cs.color, cls: bv.className };
});
rec("A-negative-value", Math.abs(neg.bal - (-25.50)) < 0.005, `bal=${neg.bal}`);
rec("A-negative-signed", /-\s*\$?25\.50/.test(neg.txt) || /^-/.test(neg.txt.replace(/\$/,'')), `txt=${neg.txt}`);

// compare negative color vs a positive color
const posColor = await page.evaluate(() => {
  window.__budget.list().forEach(t => window.__budget.remove(t.id));
  window.__budget.add({ type:"income", description:"Pay", amount:100, category:"Salary", date:"2026-07-07" });
  const bv = document.getElementById("balanceValue");
  return getComputedStyle(bv).color;
});
rec("A-negative-distinct", posColor !== neg.color, `neg=${neg.color} pos=${posColor}`);

// ---- edit moves category money + keeps id, no dup ----
const editRes = await page.evaluate(() => {
  window.__budget.list().forEach(t => window.__budget.remove(t.id));
  const e1 = window.__budget.add({ type:"expense", description:"X", amount:40, category:"Food", date:"2026-07-08" });
  window.__budget.add({ type:"expense", description:"Y", amount:60, category:"Transport", date:"2026-07-09" });
  const beforeCat = document.getElementById("categoryContainer").textContent;
  const upd = window.__budget.update(e1.id, { category:"Transport" });
  const afterCat = document.getElementById("categoryContainer").textContent;
  const l = window.__budget.list();
  return { sameId: upd.id === e1.id, len: l.length, beforeCat, afterCat };
});
// after moving 40 from Food->Transport: Food gone, Transport=100.00
rec("A-edit-sameid", editRes.sameId && editRes.len === 2, `sameId=${editRes.sameId} len=${editRes.len}`);
rec("A-edit-cat-move", /100\.00/.test(editRes.afterCat) && !/Food/.test(editRes.afterCat), `afterCat="${editRes.afterCat}"`);

// ---- update unknown id => null, remove unknown => false, no throw ----
const unk = await page.evaluate(() => {
  let u, r, threw = false;
  try { u = window.__budget.update("nope_zzz", { amount: 5 }); r = window.__budget.remove("nope_zzz"); } catch (e) { threw = true; }
  return { u, r, threw };
});
rec("A-unknown-id", unk.u === null && unk.r === false && !unk.threw, `u=${unk.u} r=${unk.r} threw=${unk.threw}`);

// ---- error contract: invalid adds throw, state unchanged ----
const errc = await page.evaluate(() => {
  const before = JSON.stringify(window.__budget.list());
  const balBefore = window.__budget.balance();
  const cases = [
    { type:"income", description:"", amount:5, category:"Salary", date:"2026-07-01" },
    { type:"income", description:"ok", amount:0, category:"Salary", date:"2026-07-01" },
    { type:"income", description:"ok", amount:-5, category:"Salary", date:"2026-07-01" },
    { type:"income", description:"ok", amount:NaN, category:"Salary", date:"2026-07-01" },
    { type:"transfer", description:"ok", amount:5, category:"Salary", date:"2026-07-01" },
    { type:"income", description:"ok", amount:5, category:"", date:"2026-07-01" },
    { type:"income", description:"ok", amount:5, category:"Salary", date:"07/01/2026" },
  ];
  let allThrew = true;
  for (const c of cases) { let t=false; try { window.__budget.add(c); } catch(e){ t=true; } if(!t) allThrew=false; }
  const after = JSON.stringify(window.__budget.list());
  return { allThrew, unchanged: before === after, balSame: balBefore === window.__budget.balance() };
});
rec("A-error-throws", errc.allThrew, `allThrew=${errc.allThrew}`);
rec("A-error-unchanged", errc.unchanged && errc.balSame, `unchanged=${errc.unchanged} balSame=${errc.balSame}`);

// update invalid field throws atomically
const updErr = await page.evaluate(() => {
  const id = window.__budget.list()[0].id;
  const before = JSON.stringify(window.__budget.list());
  let threw = false;
  try { window.__budget.update(id, { amount: -1 }); } catch (e) { threw = true; }
  return { threw, unchanged: before === JSON.stringify(window.__budget.list()) };
});
rec("A-update-invalid-atomic", updErr.threw && updErr.unchanged, `threw=${updErr.threw} unchanged=${updErr.unchanged}`);

// ---- form-drive validation: empty description ----
await page.evaluate(() => { window.__budget.list().forEach(t => window.__budget.remove(t.id)); });
await page.fill("#description", "");
await page.fill("#amount", "50");
await page.selectOption("#type", "expense");
await page.selectOption("#category", "Food");
await page.fill("#date", "2026-07-10");
await page.click("#submitBtn");
const afterEmptyDesc = await page.evaluate(() => ({ len: window.__budget.list().length, msg: document.getElementById("message").textContent, msgVisible: document.getElementById("message").className.includes("show") }));
rec("A-form-empty-desc", afterEmptyDesc.len === 0 && afterEmptyDesc.msg.trim().length > 0 && afterEmptyDesc.msgVisible, `len=${afterEmptyDesc.len} msg="${afterEmptyDesc.msg}"`);

// form-drive validation: bad amount
await page.fill("#description", "Valid desc");
await page.fill("#amount", "0");
await page.click("#submitBtn");
const afterBadAmt = await page.evaluate(() => ({ len: window.__budget.list().length, msg: document.getElementById("message").textContent }));
rec("A-form-bad-amount", afterBadAmt.len === 0 && afterBadAmt.msg.trim().length > 0, `len=${afterBadAmt.len} msg="${afterBadAmt.msg}"`);

// valid form submit adds a row
await page.fill("#description", "Coffee");
await page.fill("#amount", "4.25");
await page.click("#submitBtn");
const afterValid = await page.evaluate(() => ({ len: window.__budget.list().length, listTxt: document.getElementById("listContainer").textContent }));
rec("A-form-valid-add", afterValid.len === 1 && /Coffee/.test(afterValid.listTxt) && /4\.25/.test(afterValid.listTxt), `len=${afterValid.len}`);

// edit & delete affordances exist per row
const afford = await page.evaluate(() => {
  const rows = document.querySelectorAll("#listContainer tr[data-id]");
  let editAll = true, delAll = true;
  rows.forEach(r => { if (!r.querySelector('[data-action="edit"]')) editAll=false; if (!r.querySelector('[data-action="delete"]')) delAll=false; });
  return { n: rows.length, editAll, delAll };
});
rec("A-affordances", afford.n >= 1 && afford.editAll && afford.delAll, `rows=${afford.n} edit=${afford.editAll} del=${afford.delAll}`);

// ---- persistence across reload ----
await page.evaluate(() => {
  window.__budget.list().forEach(t => window.__budget.remove(t.id));
  window.__budget.add({ type:"income", description:"Persist Inc", amount:200, category:"Salary", date:"2026-07-11" });
  window.__budget.add({ type:"expense", description:"Persist Exp", amount:50, category:"Food", date:"2026-07-12" });
});
const preReload = await page.evaluate(() => ({ ids: window.__budget.list().map(t=>t.id), bal: window.__budget.balance() }));
await page.reload();
await page.waitForFunction(() => window.__budget && typeof window.__budget.list === "function");
const postReload = await page.evaluate(() => ({ ids: window.__budget.list().map(t=>t.id), bal: window.__budget.balance(), rowsTxt: document.getElementById("listContainer").textContent }));
rec("A-persist-reload", JSON.stringify(preReload.ids) === JSON.stringify(postReload.ids) && preReload.bal === postReload.bal && /Persist Inc/.test(postReload.rowsTxt), `preIds=${preReload.ids} postIds=${postReload.ids} bal ${preReload.bal}->${postReload.bal}`);

// ~3s screenshot (populated, after reload)
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "shot-3s.png"), fullPage: true });

// ---- corrupt storage => empty, no crash ----
await page.evaluate(() => { try { localStorage.setItem("budget_tracker_v1", "{not valid json ["); } catch(e){} });
const corruptErrorsBefore = consoleErrors.length + pageErrors.length;
await page.reload();
await page.waitForFunction(() => window.__budget && typeof window.__budget.list === "function");
const corrupt = await page.evaluate(() => ({ len: window.__budget.list().length, bal: window.__budget.balance() }));
rec("A-corrupt-storage", corrupt.len === 0 && corrupt.bal === 0 && (consoleErrors.length + pageErrors.length) === corruptErrorsBefore, `len=${corrupt.len} bal=${corrupt.bal}`);

// ---- global hygiene ----
rec("A-no-console-errors", consoleErrors.length === 0 && pageErrors.length === 0, `consoleErr=${consoleErrors.length} pageErr=${pageErrors.length} :: ${[...consoleErrors,...pageErrors].join(" | ")}`);
rec("A-no-dialogs", dialogs.length === 0, `dialogs=${dialogs.length}`);
rec("A-no-network", netRequests.length === 0, `net=${netRequests.length} :: ${netRequests.join(", ")}`);

// static scan for external resources
import fs from "node:fs";
const htmlSrc = fs.readFileSync(SRC, "utf8");
const extern = /(src|href)\s*=\s*["'](https?:|\/\/)/i.test(htmlSrc) || /@import/i.test(htmlSrc) || /url\(\s*["']?(https?:|\/\/)/i.test(htmlSrc);
rec("A-self-contained", !extern, `external refs found=${extern}`);

await browser.close();

const pass = results.filter(r => r.ok).length;
const total = results.length;
console.log(JSON.stringify({ summary: { pass, fail: total - pass, total }, results }, null, 2));
