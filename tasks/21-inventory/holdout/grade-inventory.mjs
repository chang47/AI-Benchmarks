// Frozen grader for task 21 (Pip's Outdoor Gear): a thin Node wrapper around grade_core.py (LibreOffice recalculation +
// openpyxl readout + the hidden-log live test), so the bench runs it like every other node-script grader.
// Usage: node grade-inventory.mjs [path/to/pips-q3-report.xlsx]   (default ../src/pips-q3-report.xlsx)
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(process.argv[2] || join(here, "..", "src", "pips-q3-report.xlsx"));
// The fixed checklist: every id always appears, so a crash scores 0 instead of shrinking the total.
const PLAN = [
  ["F-opens", "Deliverable", "workbook opens", 1], ["F-sheets", "Deliverable", "Summary, Stock and Exceptions sheets exist", 1],
  ["F-inputs", "Deliverable", "Opening and Transactions sheets kept with the same columns", 1], ["F-formulas", "Deliverable", "report cells are formulas, not typed-in numbers", 2],
  ["F-errors", "Deliverable", "no formula errors in the report after recalculation", 1],
  ...["2025-07", "2025-08", "2025-09"].flatMap((m) => [[`P-rev-${m}`, "P&L (this quarter)", `revenue ${m} (shipped units, incl. backorders)`, 1], [`P-cogs-${m}`, "P&L (this quarter)", `COGS ${m} (FIFO)`, 1], [`P-net-${m}`, "P&L (this quarter)", `net profit ${m}`, 1]]),
  ["P-refunds", "P&L (this quarter)", "refunds, all three months", 1], ["P-writeoffs", "P&L (this quarter)", "write-offs, all three months", 1],
  ["P-opex", "P&L (this quarter)", "operating expenses (duplicates dropped), all three months", 1], ["P-gross_profit", "P&L (this quarter)", "gross profit, all three months", 1],
  ["P-totals", "P&L (this quarter)", "Q3 total column", 1],
  ["S-on_hand", "Stock (this quarter)", "units on hand, all 12 products", 2], ["S-backordered", "Stock (this quarter)", "units still backordered, all 12 products", 2],
  ["S-stock_value", "Stock (this quarter)", "FIFO stock value, all 12 products", 3], ["S-reorder", "Stock (this quarter)", "reorder flags and quantities", 2],
  ["E-found", "Exceptions", "every ignored row is listed (duplicates + invalid return)", 2], ["E-clean", "Exceptions", "no valid rows wrongly listed as ignored", 1],
  ["L-live", "Live test (hidden log)", "with next quarter's log pasted in, the report is still right", 12], ["L-errors", "Live test (hidden log)", "no formula errors after the swap", 1],
];

const py = spawnSync(process.env.PYTHON || "python", [join(here, "grade_core.py"), file], { encoding: "utf8", timeout: 15 * 60_000, maxBuffer: 20e6 });
let core = { checks: [], notes: [`grade_core.py produced no JSON (exit ${py.status}): ${(py.stderr || "").slice(-300)}`] };
try { core = JSON.parse(py.stdout.trim().split("\n").pop()); } catch { /* keep the error note */ }
const got = Object.fromEntries(core.checks.map((c) => [c.id, c]));
const checks = PLAN.map(([id, group, name, points]) => {
  const g = got[id];
  if (!g) return { id, group, name, points, earned: 0, status: "fail", detail: "not measured (no workbook, or the grader could not open it — see notes)" };
  return { id, group, name: g.name || name, points, earned: g.earned, status: g.earned === points ? "pass" : "fail", detail: String(g.detail).slice(0, 600) };
});
console.log(JSON.stringify({ version: "inventory-grader-1", file: "src/pips-q3-report.xlsx", pointsPossible: PLAN.reduce((a, r) => a + r[3], 0), checks, notes: core.notes }, null, 1));
