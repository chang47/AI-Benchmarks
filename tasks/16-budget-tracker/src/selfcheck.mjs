import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Resolve the globally-installed playwright module by absolute path.
const PW_URL = "file:///C:/Users/iamjo/AppData/Roaming/npm/node_modules/playwright/index.mjs";
const pw = await import(PW_URL);
const chromium = pw.chromium || pw.default.chromium;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "index.html");
const htmlUrl = pathToFileURL(htmlPath).href;
const shotPath = path.join(__dirname, "selfcheck.png");

const problems = [];
function check(name, cond, detail) {
  if (cond) {
    console.log("PASS  " + name);
  } else {
    console.log("FAIL  " + name + (detail ? "  -> " + detail : ""));
    problems.push(name);
  }
}

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (e) {
    console.log("chrome channel failed (" + e.message + "), trying bundled chromium...");
    try {
      return await chromium.launch();
    } catch (e2) {
      console.log("bundled chromium failed, attempting install...");
      const { execSync } = await import("node:child_process");
      execSync("npx playwright install chromium", { stdio: "inherit" });
      return await chromium.launch();
    }
  }
}

const browser = await launch();
const page = await browser.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

// ---- fresh load (clear storage first) ----
await page.goto(htmlUrl);
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload();
await page.waitForFunction(() => !!window.__budget);

// Criterion 1: empty state, balance 0.00
let balText = await page.textContent("#balanceValue");
check("initial balance shows 0.00", /0\.00/.test(balText), balText);
let hookOk = await page.evaluate(() => {
  const b = window.__budget;
  return b && ["add", "update", "remove", "list", "balance"].every((k) => typeof b[k] === "function");
});
check("window.__budget has all 5 functions", hookOk);
check("initial list empty", (await page.evaluate(() => window.__budget.list().length)) === 0);

// Criterion 2/13: add income via hook
let addRes = await page.evaluate(() =>
  window.__budget.add({ type: "income", description: "Salary", amount: 5000, category: "Salary", date: "2026-07-01" })
);
check("add returns object with id", addRes && typeof addRes.id !== "undefined", JSON.stringify(addRes));
check("add returns amount 5000", addRes && addRes.amount === 5000);
let bal = await page.evaluate(() => window.__budget.balance());
check("balance() = 5000 after income", Math.abs(bal - 5000) < 0.005, String(bal));
balText = await page.textContent("#balanceValue");
check("displayed balance 5000.00", /5000\.00/.test(balText), balText);
let rowCount = await page.$$eval("#listContainer tbody tr", (r) => r.length);
check("one row rendered", rowCount === 1, String(rowCount));
let inStorage = await page.evaluate(() => {
  const raw = localStorage.getItem("budget_tracker_v1");
  return raw && raw.indexOf("Salary") !== -1;
});
check("income persisted to localStorage", inStorage);

// Criterion 3: add expense via hook
let expRes = await page.evaluate(() =>
  window.__budget.add({ type: "expense", description: "Groceries", amount: 25.5, category: "Food", date: "2026-07-02" })
);
bal = await page.evaluate(() => window.__budget.balance());
check("balance() = 4974.50 after expense", Math.abs(bal - 4974.5) < 0.005, String(bal));

// Criterion 8: category totals + row for Food
let foodTotal = await page.evaluate(() => {
  const items = [...document.querySelectorAll("#categoryContainer li")];
  const f = items.find((li) => li.textContent.indexOf("Food") !== -1);
  return f ? f.textContent : null;
});
check("Food category total shows 25.50", foodTotal && /25\.50/.test(foodTotal), foodTotal);

// Criterion 6: update via hook (change amount + category)
let upd = await page.evaluate((id) => window.__budget.update(id, { amount: 40, category: "Transport" }), expRes.id);
check("update returns object", upd && upd.amount === 40 && upd.category === "Transport", JSON.stringify(upd));
bal = await page.evaluate(() => window.__budget.balance());
check("balance() = 4960.00 after edit", Math.abs(bal - 4960) < 0.005, String(bal));
rowCount = await page.$$eval("#listContainer tbody tr", (r) => r.length);
check("still 2 rows after edit (no dup)", rowCount === 2, String(rowCount));
let hasTransport = await page.evaluate(() => {
  const items = [...document.querySelectorAll("#categoryContainer li")];
  return items.some((li) => li.textContent.indexOf("Transport") !== -1 && /40\.00/.test(li.textContent)) &&
         !items.some((li) => li.textContent.indexOf("Food") !== -1);
});
check("edit moved amount Food->Transport in category totals", hasTransport);

// Criterion 5: negative balance sign + distinct class
await page.evaluate(() =>
  window.__budget.add({ type: "expense", description: "Big", amount: 100000, category: "Rent", date: "2026-07-03" })
);
balText = await page.textContent("#balanceValue");
check("negative balance shows leading minus", /^-/.test(balText.trim()) || /-\$/.test(balText), balText);
let negClass = await page.evaluate(() => document.getElementById("balanceValue").className.indexOf("negative") !== -1);
check("negative balance has 'negative' class", negClass);
// remove the big one to reset
let bigId = await page.evaluate(() => window.__budget.list().find((t) => t.description === "Big").id);
let remRes = await page.evaluate((id) => window.__budget.remove(id), bigId);
check("remove returns true", remRes === true);

// Criterion 14: error contract
let threwDesc = await page.evaluate(() => {
  const before = window.__budget.list().length;
  try { window.__budget.add({ type: "income", description: "   ", amount: 10, category: "Salary", date: "2026-07-01" }); return "no-throw"; }
  catch (e) { return (window.__budget.list().length === before) ? "threw-unchanged" : "threw-but-changed"; }
});
check("add empty description throws & unchanged", threwDesc === "threw-unchanged", threwDesc);
let threwAmt = await page.evaluate(() => {
  try { window.__budget.add({ type: "expense", description: "x", amount: -5, category: "Food", date: "2026-07-01" }); return "no-throw"; }
  catch (e) { return "threw"; }
});
check("add negative amount throws", threwAmt === "threw", threwAmt);
let threwType = await page.evaluate(() => {
  try { window.__budget.add({ type: "bogus", description: "x", amount: 5, category: "Food", date: "2026-07-01" }); return "no-throw"; }
  catch (e) { return "threw"; }
});
check("add bad type throws", threwType === "threw", threwType);
let unknownUpd = await page.evaluate(() => window.__budget.update("nope-id", { amount: 5 }));
check("update unknown id returns null", unknownUpd === null, JSON.stringify(unknownUpd));
let unknownRem = await page.evaluate(() => window.__budget.remove("nope-id"));
check("remove unknown id returns false", unknownRem === false, JSON.stringify(unknownRem));

// list() returns fresh plain objects with exactly 6 keys
let shapeOk = await page.evaluate(() => {
  const arr = window.__budget.list();
  return arr.every((t) => {
    const k = Object.keys(t).sort().join(",");
    return k === "amount,category,date,description,id,type";
  });
});
check("list() objects have exactly 6 fields", shapeOk);
let immutable = await page.evaluate(() => {
  const arr = window.__budget.list();
  const n = arr.length;
  arr.push({ junk: true });
  return window.__budget.list().length === n;
});
check("mutating list() result does not affect state", immutable);

// Criterion 11: persistence across reload
let preReload = await page.evaluate(() => ({ ids: window.__budget.list().map((t) => t.id), bal: window.__budget.balance() }));
await page.reload();
await page.waitForFunction(() => !!window.__budget);
let postReload = await page.evaluate(() => ({ ids: window.__budget.list().map((t) => t.id), bal: window.__budget.balance() }));
check("ids stable across reload", JSON.stringify(preReload.ids) === JSON.stringify(postReload.ids), JSON.stringify(postReload.ids));
check("balance stable across reload", Math.abs(preReload.bal - postReload.bal) < 0.005);

// Criterion 9/10: form validation via UI
await page.fill("#description", "   ");
await page.fill("#amount", "50");
await page.click("#submitBtn");
let msgShown = await page.evaluate(() => {
  const m = document.getElementById("message");
  return m.classList.contains("show") && m.textContent.trim().length > 0;
});
check("form empty-description shows in-page message", msgShown);

// Criterion 7: delete last -> empty state. Clear all then verify 0.00
await page.evaluate(() => { window.__budget.list().forEach((t) => window.__budget.remove(t.id)); });
balText = await page.textContent("#balanceValue");
check("cleared -> balance 0.00", /0\.00/.test(balText) && !/-/.test(balText), balText);
rowCount = await page.$$eval("#listContainer tbody tr", (r) => r.length);
check("cleared -> no rows", rowCount === 0, String(rowCount));

// Add a couple back for a nice screenshot
await page.evaluate(() => {
  window.__budget.add({ type: "income", description: "Salary", amount: 5000, category: "Salary", date: "2026-07-01" });
  window.__budget.add({ type: "expense", description: "Groceries", amount: 125.5, category: "Food", date: "2026-07-02" });
  window.__budget.add({ type: "expense", description: "Rent", amount: 1800, category: "Rent", date: "2026-07-03" });
});

check("zero console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

await page.screenshot({ path: shotPath, fullPage: true });
console.log("\nScreenshot: " + shotPath);
console.log("Console errors captured: " + consoleErrors.length);
if (consoleErrors.length) console.log(consoleErrors.join("\n"));

await browser.close();

console.log("\n==== SELF-CHECK SUMMARY ====");
console.log(problems.length === 0 ? "ALL CHECKS PASSED" : ("FAILURES: " + problems.join(", ")));
process.exit(problems.length === 0 ? 0 : 1);
