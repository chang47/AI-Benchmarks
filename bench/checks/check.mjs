// `npm run check` — the harness's regression gate. Every check is a falsifiable claim from
// design/2026-09-25-harness-v1-spec.md; each prints PASS/FAIL with the evidence.
//   A  parser fixtures round-trip (one per harness format)
//   B1 each wired task's own reference solution passes its frozen answer key
//   B2 a deliberately broken bowling scorer fails, with failing checks named
//   B3 a 1-byte edit to a (scratch copy of a) holdout is caught by the tamper check
//   B4 task 17's July realistic build still grades 7/8 failing V6 (matches disk)
//   C1 every scoreboard number equals its meta.json / result.json
//   C2 tool calls: rendered steps == steps.json == independent count from raw.jsonl
//   C4 browser render: zero console errors, no horizontal scroll (desktop + phone)
//   C5 the built site leaks no home paths / username / leak-guard terms
// Flags: --quick (skip B1 for slow browser tasks, skip C4), --no-browser (skip C4)
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gradeReference, tamperCheck } from "../grade/grade.mjs";
import { buildReport } from "../render/report.mjs";
import { REDACT_PROBES, ROOT, RUNS_DIR, readJson, taskDir } from "../lib/util.mjs";
import { parseFile, readJsonl } from "../trajectory/index.mjs";

const quick = process.argv.includes("--quick");
const noBrowser = quick || process.argv.includes("--no-browser");
const results = [];
const quiet = () => {};
function record(id, ok, evidence) {
  results.push({ id, ok, evidence });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(4)} ${evidence}`);
}

// ---------------------------------------------------------------- A: parser fixtures
const FIX = join(ROOT, "bench", "fixtures");
const expect = {
  "claude-headless.jsonl": { format: "claude", tools: { Write: 1 }, final: "done", model: /haiku/ },
  "claude-glm.jsonl": { format: "claude", tools: { Write: 1 }, final: "done", model: /glm-5\.3/ },
  "codex.jsonl": { format: "codex", tools: { shell: 1 }, final: "done", model: null },
  "pi.jsonl": { format: "pi", tools: { write: 1 }, final: "done", model: /glm-5\.3-flash/ },
};
for (const [f, e] of Object.entries(expect)) {
  const r = parseFile(join(FIX, f));
  const ok = r.format === e.format && JSON.stringify(r.metrics.toolCalls) === JSON.stringify(e.tools)
    && r.info.finalText === e.final && (e.model ? e.model.test(r.info.modelReported || "") : r.info.modelReported == null);
  record("A", ok, `${f}: ${r.format}, ${r.steps.length} steps, tools ${JSON.stringify(r.metrics.toolCalls)}, final "${r.info.finalText}", model ${r.info.modelReported}`);
}

// ---------------------------------------------------------------- B: grader controls
const wired = readdirSync(join(ROOT, "tasks")).filter((d) => existsSync(join(taskDir(d), "bench.json")));
for (const slug of wired) {
  const slow = /15-|17-/.test(slug);
  if (quick && slow) continue;
  const r = await gradeReference(slug, { log: quiet });
  record("B1", r.allPass, `${slug} reference → ${r.passed}/${r.total}${r.unresolved ? `, ${r.unresolved} unresolved` : ""}`);
}

{
  const scratch = join(tmpdir(), "vbench-check");
  mkdirSync(scratch, { recursive: true });
  const src = readFileSync(join(taskDir("07-bowling"), "src", "bowling.mjs"), "utf8");
  const broken = src.replace("total += 10 + r[i + 2];", "total += 10;");
  writeFileSync(join(scratch, "bowling-broken.mjs"), broken);
  const r = await gradeReference("07", { candidate: join(scratch, "bowling-broken.mjs"), label: "broken-spare", log: quiet });
  const named = r.checks.filter((c) => c.status === "fail").map((c) => c.name);
  record("B2", broken !== src && !r.allPass && named.length > 0, `broken spare bonus → ${r.passed}/${r.total}; failing: ${named.slice(0, 2).join("; ")}…`);

  const copy = join(scratch, "holdout-tamper");
  rmSync(copy, { recursive: true, force: true });
  cpSync(join(taskDir("07-bowling"), "holdout"), copy, { recursive: true, filter: (p) => !p.includes("node_modules") });
  const before = tamperCheck(copy);
  const f = join(copy, "canonical-data.json");
  const buf = readFileSync(f);
  buf[10] = buf[10] === 32 ? 33 : 32;
  writeFileSync(f, buf);
  const after = tamperCheck(copy);
  record("B3", before.ok && !after.ok, `clean copy: ${before.detail}; after 1-byte edit: ${after.detail}`);
}

if (!quick) {
  const july = join(taskDir("17-budget-dashboard"), "raw-lane", "attempt-1-realistic", "index.html");
  const r = await gradeReference("17", { candidate: july, label: "realistic-attempt1", log: quiet });
  const failed = r.checks.filter((c) => c.status === "fail").map((c) => c.id);
  const disk = readJson(join(taskDir("17-budget-dashboard"), "raw-lane", "attempt-1-realistic", "verify-result.json"));
  record("B4", r.passed === disk.passed && r.total === disk.total && failed.join() === "V6", `now ${r.passed}/${r.total} failing ${failed.join(",")}; July verify-result.json says ${disk.passed}/${disk.total}`);
}

// ---------------------------------------------------------------- C: report
const site = join(ROOT, "reports", "site");
await buildReport({ outDir: site });
const embedded = (html) => JSON.parse(html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, "</"));
const runIds = existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR).filter((d) => !d.startsWith("_") && existsSync(join(RUNS_DIR, d, "meta.json"))) : [];
{
  const idx = embedded(readFileSync(join(site, "index.html"), "utf8"));
  const bad = [];
  for (const row of idx.rows) {
    const m = readJson(join(RUNS_DIR, row.id, "meta.json"));
    const g = readJson(join(RUNS_DIR, row.id, "result.json"), null);
    if (row.durationMs !== m.metrics.durationMs || row.outputTokens !== m.metrics.outputTokens || row.peakContextTokens !== m.metrics.peakContextTokens) bad.push(`${row.id} metrics`);
    if (g && (row.passed !== g.passed || row.total !== g.total || row.allPass !== g.allPass)) bad.push(`${row.id} score`);
  }
  for (const [key, cell] of Object.entries(idx.board.cells)) {
    const want = cell.runs.filter((r) => r.allPass).length;
    if (want !== cell.passedRuns) bad.push(`cell ${key}`);
  }
  record("C1", idx.rows.length === runIds.length && !bad.length, `${idx.rows.length} rows vs ${runIds.length} runs on disk; mismatches: ${bad.join(", ") || "none"}`);
}
{
  const bad = [];
  let n = 0;
  for (const id of runIds) {
    const page = embedded(readFileSync(join(site, "runs", `${id}.html`), "utf8"));
    const rendered = page.steps.filter((s) => s.kind === "tool-call").length;
    const stored = readJson(join(RUNS_DIR, id, "steps.json")).steps.filter((s) => s.kind === "tool-call").length;
    const raw = rawToolCount(join(RUNS_DIR, id, "raw.jsonl"));
    n += rendered;
    if (!(rendered === stored && stored === raw)) bad.push(`${id}: page ${rendered}, steps ${stored}, raw ${raw}`);
  }
  record("C2", !bad.length, `${runIds.length} run pages, ${n} tool calls; mismatches: ${bad.join("; ") || "none"}`);
}
if (!noBrowser) {
  const { renderCheck } = await import("./render-check.mjs");
  const r = await renderCheck(site, { all: true });
  record("C4", !r.problems.length, `${r.pages} pages × 2 widths; ${r.problems.join("; ") || "no console errors, no horizontal scroll"} (screenshots: .bench-cache/shots/)`);
}
{
  const hits = [];
  const walk = (d) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(html|m?js|css|json|svg|txt|md)$/.test(f.name)) {
        const t = readFileSync(p, "utf8");
        for (const probe of REDACT_PROBES) if (probe && t.toLowerCase().includes(probe.toLowerCase())) hits.push(`${p.slice(site.length + 1)} (${probe})`);
      }
    }
  };
  walk(site);
  record("C5", !hits.length, hits.length ? `leaks in: ${hits.slice(0, 5).join(", ")}` : "no home paths / username / leak-guard terms in the built site");
}

/** Count tool calls straight from raw events, independently of the parsers. */
function rawToolCount(path) {
  if (!existsSync(path)) return 0;
  const { events } = readJsonl(path);
  let c = 0;
  for (const e of events) {
    if (e.type === "assistant" && e.message) c += (e.message.content || []).filter((b) => b.type === "tool_use").length;
    if (e.type === "item.completed" && e.item && ["command_execution", "file_change", "mcp_tool_call", "web_search"].includes(e.item.type)) c++;
    if (e.type === "message_end" && e.message?.role === "assistant") c += (e.message.content || []).filter((b) => b.type === "toolCall").length;
  }
  return c;
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — FAILED: ${[...new Set(failed.map((f) => f.id))].join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
