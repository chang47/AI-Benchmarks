// Step 3 — static HTML. `buildReport` = scoreboard + one page per run; `viewFile` = render ANY
// transcript (bench raw.jsonl, headless session, interactive Claude Code session) to one page.
// Pages read only runs/*/meta.json, result.json, steps.json (or re-parse raw.jsonl) and output/.
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ROOT, RUNS_DIR, listFiles, readJson, redact, taskDir } from "../lib/util.mjs";
import { parseFile } from "../trajectory/index.mjs";

const ASSETS = join(ROOT, "bench", "render", "assets");
const BODY_CAP = 24_000; // per-step body cap in HTML; the full body stays in steps.json

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const median = (xs) => {
  const v = xs.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

function page({ title, body, data, depth = 0, bodyClass = "" }) {
  const up = depth ? "../".repeat(depth) : "";
  // Data is embedded as JSON in a non-executing script tag, redacted, with "</" neutralised.
  const json = redact(JSON.stringify(data)).replace(/<\//g, "<\\/");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${up}assets/style.css">
</head>
<body class="${bodyClass}">
${redact(body)}
<script type="application/json" id="data">${json}</script>
<script src="${up}assets/app.js"></script>
</body>
</html>
`;
}

function loadRuns() {
  if (!existsSync(RUNS_DIR)) return [];
  const out = [];
  for (const d of readdirSync(RUNS_DIR)) {
    const dir = join(RUNS_DIR, d);
    if (d.startsWith("_") || !statSync(dir).isDirectory() || !existsSync(join(dir, "meta.json"))) continue;
    out.push({ dir, id: d, meta: readJson(join(dir, "meta.json")), result: readJson(join(dir, "result.json"), null) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function stepsFor(run) {
  const p = join(run.dir, "steps.json");
  if (existsSync(p)) return readJson(p).steps;
  const raw = join(run.dir, "raw.jsonl");
  return existsSync(raw) ? parseFile(raw).steps : [];
}

function capSteps(steps) {
  return steps.map((s) => (s.body && s.body.length > BODY_CAP
    ? { ...s, body: s.body.slice(0, BODY_CAP), truncated: s.body.length } : s));
}

function taskInfo(slug) {
  const md = readJson(join(taskDir(slug), "metadata.json"), {});
  const spec = existsSync(join(taskDir(slug), "spec.md")) ? readFileSync(join(taskDir(slug), "spec.md"), "utf8") : "";
  const h = /^#\s+(.+)$/m.exec(spec);
  // "# Spec — Budget Dashboard (flagship, `17-budget-dashboard`)" → "Budget Dashboard"
  const title = h ? h[1].replace(/^(Spec|Task\s*\d+)\s*[—:-]\s*/i, "").replace(/\s*\((?:[^()]*\d{2}-[a-z-]+[^()]*|task \d+|[^()]*canonical[^()]*)\)\s*$/i, "").replace(/`/g, "").trim() : slug;
  return { slug, title, type: md.type || "", difficulty: md.difficulty || "" };
}

const armKey = (m) => `${m.harness}|${m.model}|${m.profile?.name || "clean-room"}`;

function summarizeRun(r) {
  const m = r.meta, x = m.metrics || {}, g = r.result;
  return {
    id: r.id, task: m.task, harness: m.harness, model: m.model, modelReported: m.modelReported,
    profile: m.profile?.name, status: m.status, startedAt: m.startedAt, attempt: m.attempt,
    durationMs: x.durationMs, outputTokens: x.outputTokens, inputTokens: x.inputTokens,
    cacheReadTokens: x.cacheReadTokens, cacheCreationTokens: x.cacheCreationTokens, reasoningTokens: x.reasoningTokens,
    peakContextTokens: x.peakContextTokens, costUsdEstimate: x.costUsdEstimate, toolCalls: x.toolCalls, toolErrors: x.toolErrors,
    numTurns: x.numTurns,
    graded: !!g && g.status === "graded", passed: g?.passed ?? null, total: g?.total ?? null, allPass: g?.allPass ?? null,
    unresolved: g?.unresolved ?? 0, judged: !!g?.checks?.some((c) => c.method === "judged" || (c.method === "judge-checklist" && c.status !== "skip")),
    pointsEarned: g?.pointsEarned ?? null, pointsPossible: g?.pointsPossible ?? null, score: g?.score ?? null,
    claim: g?.claim?.label ?? null, fakeConvergence: g?.fakeConvergence ?? null,
  };
}

function buildScoreboard(rows) {
  const tasks = [...new Set(rows.map((r) => r.task))].sort().map(taskInfo);
  const arms = [];
  for (const r of rows) {
    const k = armKey({ harness: r.harness, model: r.model, profile: { name: r.profile } });
    if (!arms.find((a) => a.key === k)) arms.push({ key: k, harness: r.harness, model: r.model, profile: r.profile });
  }
  const order = ["claude", "claude-glm", "codex", "pi"];
  arms.sort((a, b) => (order.indexOf(a.harness) - order.indexOf(b.harness)) || a.model.localeCompare(b.model) || a.profile.localeCompare(b.profile));
  const cells = {};
  for (const t of tasks) for (const a of arms) {
    const rs = rows.filter((r) => r.task === t.slug && armKey({ harness: r.harness, model: r.model, profile: { name: r.profile } }) === a.key);
    if (!rs.length) continue;
    cells[`${t.slug}::${a.key}`] = {
      runs: rs.map((r) => ({ id: r.id, allPass: r.allPass, graded: r.graded, status: r.status, passed: r.passed, total: r.total, unresolved: r.unresolved,
        pointsEarned: r.pointsEarned, pointsPossible: r.pointsPossible, score: r.score })),
      n: rs.length, passedRuns: rs.filter((r) => r.allPass).length,
      // Points tasks (18+) score by points earned / possible; older tasks by checks passed.
      points: rs.some((r) => r.score != null),
      medianScore: median(rs.filter((r) => r.graded).map((r) => (r.score != null ? r.score : r.total ? r.passed / r.total : 0))),
      medianMs: median(rs.map((r) => r.durationMs)), medianOut: median(rs.map((r) => r.outputTokens)),
      fake: rs.filter((r) => r.fakeConvergence).length, judged: rs.some((r) => r.judged),
    };
  }
  const totals = {};
  for (const a of arms) {
    const rs = rows.filter((r) => armKey({ harness: r.harness, model: r.model, profile: { name: r.profile } }) === a.key);
    totals[a.key] = { n: rs.length, passedRuns: rs.filter((r) => r.allPass).length, fake: rs.filter((r) => r.fakeConvergence).length,
      medianMs: median(rs.map((r) => r.durationMs)), medianOut: median(rs.map((r) => r.outputTokens)) };
  }
  return { tasks, arms, cells, totals };
}

function copyAssets(outDir) {
  mkdirSync(join(outDir, "assets"), { recursive: true });
  for (const f of readdirSync(ASSETS)) copyFileSync(join(ASSETS, f), join(outDir, "assets", f));
}

function runPageData(run, steps) {
  const outputs = listFiles(join(run.dir, "output")).map((rel) => {
    const p = join(run.dir, "output", rel);
    const size = statSync(p).size;
    const isText = /\.(m?js|html?|css|json|md|txt|svg|ts|py)$/i.test(rel);
    return { rel, size, isHtml: /\.html?$/i.test(rel), text: isText && size < 400_000 ? readFileSync(p, "utf8") : null };
  });
  const shots = existsSync(join(run.dir, "grade")) ? readdirSync(join(run.dir, "grade")).filter((f) => f.endsWith(".png")) : [];
  const frames = existsSync(join(run.dir, "grade", "frames")) ? readdirSync(join(run.dir, "grade", "frames")).filter((f) => f.endsWith(".png")).map((f) => `frames/${f}`) : [];
  shots.push(...frames);
  return { meta: run.meta, result: run.result, steps: capSteps(steps), outputs, shots };
}

/** Build the whole site. */
export async function buildReport({ outDir }) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "runs"), { recursive: true });
  copyAssets(outDir);
  const runs = loadRuns();
  const rows = runs.map(summarizeRun);
  const board = buildScoreboard(rows);
  const versions = [...new Set(runs.map((r) => `${r.meta.harness}: ${r.meta.harnessVersion}`))].sort();
  const dates = runs.map((r) => r.meta.startedAt).filter(Boolean).sort();

  writeFileSync(join(outDir, "index.html"), page({
    title: "Vetted Bench — scoreboard",
    bodyClass: "p-index",
    body: `<div id="app" data-page="index"></div>`,
    data: { board, rows, versions, dateRange: [dates[0], dates.at(-1)], generatedAt: new Date().toISOString() },
  }));

  for (const run of runs) {
    const dir = join(outDir, "runs", run.id);
    if (existsSync(join(run.dir, "output"))) cpSync(join(run.dir, "output"), join(dir, "output"), { recursive: true });
    if (existsSync(join(run.dir, "grade"))) for (const f of readdirSync(join(run.dir, "grade")).filter((x) => x.endsWith(".png"))) {
      mkdirSync(join(dir, "grade"), { recursive: true });
      copyFileSync(join(run.dir, "grade", f), join(dir, "grade", f));
    }
    if (existsSync(join(run.dir, "grade", "frames"))) cpSync(join(run.dir, "grade", "frames"), join(dir, "grade", "frames"), { recursive: true }); // judge frames
    const data = runPageData(run, stepsFor(run));
    data.task = taskInfo(run.meta.task);
    data.prompt = existsSync(join(run.dir, "prompt.md")) ? readFileSync(join(run.dir, "prompt.md"), "utf8") : null;
    writeFileSync(join(outDir, "runs", `${run.id}.html`), page({
      title: `${data.task.title} · ${run.meta.harness}/${run.meta.model}`, bodyClass: "p-run",
      body: `<div id="app" data-page="run"></div>`, data, depth: 1,
    }));
  }
  return join(outDir, "index.html");
}

/** Render any transcript file to a single standalone page. */
export async function viewFile(file, outPath) {
  const parsed = parseFile(file);
  const out = outPath || join(ROOT, "reports", "view", `${basename(file).replace(/\.jsonl?$/, "")}.html`);
  mkdirSync(join(dirname(out), "assets"), { recursive: true });
  copyAssets(dirname(out));
  const meta = { runId: basename(file), harness: parsed.format, model: parsed.info.modelReported || "(not reported)",
    modelReported: parsed.info.modelReported, status: parsed.info.isError ? "error" : "ok", metrics: { durationMs: parsed.metrics.harnessDurationMs, ...parsed.metrics },
    parserVersion: parsed.parserVersion, init: parsed.info.init, finalText: parsed.info.finalText };
  writeFileSync(out, page({
    title: `Transcript · ${basename(file)}`, bodyClass: "p-run",
    body: `<div id="app" data-page="run"></div>`,
    data: { meta, result: null, steps: capSteps(parsed.steps), outputs: [], shots: [], viewOnly: true, source: basename(file) },
  }));
  return out;
}
