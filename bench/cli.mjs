#!/usr/bin/env node
// Vetted Bench harness CLI.
//   bench run    --task 07[,15,17] (--harness claude --model claude-opus-5-5 | --arms bench/arms/pilot.json)
//                [--profile clean-room] [--n 1] [--fill] [--parallel 1] [--keep] [--grade] [--timeout-min N]
//   bench grade  <runId…> | --ungraded | --reference <task> | --control <task> <file> <label>
//   bench report [--out reports/site]
//   bench view   <any .jsonl> [--out file.html]
//   bench reparse [runId…]   (re-derive steps.json + metrics + contamination scan from raw.jsonl)
//   bench contamination [runId…]   (read-only raw.jsonl scan: web tools, network commands, benchmark refs)
//   bench judge-text --text FINDINGS.md --questions q.json [--out dir]
//   bench ls
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gradeReference, gradeRun } from "./grade/grade.mjs";
import { ROOT, RUNS_DIR, readJson, resolveTask } from "./lib/util.mjs";
import { runPool } from "./run.mjs";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const allRunDirs = () => (existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR).filter((d) => !d.startsWith("_") && existsSync(join(RUNS_DIR, d, "meta.json"))).sort() : []);

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);

  if (cmd === "run") {
    const tasks = String(a.task || "").split(",").filter(Boolean).map(resolveTask);
    if (!tasks.length) throw new Error("--task is required");
    const arms = a.arms ? readJson(resolve(a.arms)).arms : [{ harness: a.harness || "claude", model: a.model, profile: a.profile }];
    const n = Number(a.n || 1);
    const jobs = [];
    // --fill: top each (task, arm, profile) cell up to n finished runs instead of adding n more (resumable nights).
    const have = {};
    if (a.fill) for (const d of allRunDirs()) {
      const m = readJson(join(RUNS_DIR, d, "meta.json"));
      const k = `${m.task}|${m.harness}|${m.model}|${m.profile?.name}`;
      have[k] = (have[k] || 0) + 1;
    }
    // Attempt-major order: every arm gets attempt 1 before any gets attempt 2, so a partial night still yields a full grid.
    for (let k = 1; k <= n; k++) for (const task of tasks) for (const arm of arms) {
      const profile = a.profile && a.profile !== true ? a.profile : arm.profile || "clean-room";
      if (a.fill && (have[`${task}|${arm.harness}|${arm.model}|${profile}`] || 0) >= k) continue;
      jobs.push({ task, harness: arm.harness, model: arm.model, profile, attempt: k, of: n, keep: !!a.keep, timeoutMinOverride: a["timeout-min"] ? Number(a["timeout-min"]) : null });
    }
    console.log(`[bench] ${jobs.length} run(s) · parallel ${a.parallel || 1}`);
    const metas = await runPool(jobs, Number(a.parallel || 1));
    if (a.grade) for (const m of metas) if (m.runId) await gradeRun(join(RUNS_DIR, m.runId)).catch((e) => console.error(`[grade] ${m.runId}: ${e.message}`));
    return;
  }

  if (cmd === "grade") {
    if (a.reference) return void (await gradeReference(a.reference));
    if (a.control) {
      const [file, label] = a._;
      return void (await gradeReference(a.control, { candidate: resolve(file), label: label || "control" }));
    }
    const ids = a.ungraded ? allRunDirs().filter((d) => !existsSync(join(RUNS_DIR, d, "result.json"))) : a._;
    for (const id of ids) await gradeRun(join(RUNS_DIR, id), { judge: !a["no-judge"] }).catch((e) => console.error(`[grade] ${id}: ${e.message}`));
    return;
  }

  if (cmd === "report") {
    const { buildReport } = await import("./render/report.mjs");
    const out = await buildReport({ outDir: resolve(a.out && a.out !== true ? a.out : join(ROOT, "reports", "site")) });
    console.log(`[report] ${out}`);
    return;
  }

  if (cmd === "view") {
    const { viewFile } = await import("./render/report.mjs");
    const file = a._[0];
    if (!file) throw new Error("usage: bench view <file.jsonl> [--out page.html]");
    const out = await viewFile(resolve(file), a.out && a.out !== true ? resolve(a.out) : null);
    console.log(`[view] ${out}`);
    return;
  }

  if (cmd === "reparse") {
    // Raw is the source of truth: regenerate steps.json + parsed metrics for every run (or the named ones).
    const { reparseRun } = await import("./run.mjs");
    const done = new Set(allRunDirs());
    for (const id of (a._.length ? a._ : [...done]).map((x) => x.replace(/[\/]$/, ""))) {
      if (!done.has(id)) { console.log(`[reparse] ${id} skipped (no meta.json yet — still running?)`); continue; }
      console.log(`[reparse] ${id} → ${reparseRun(join(RUNS_DIR, id))}`);
    }
    return;
  }

  if (cmd === "contamination") {
    // Read-only scan of raw.jsonl for web tools / network commands / benchmark references → meta.contamination.
    const { rescanContamination } = await import("./run.mjs");
    const { writeJson } = await import("./lib/util.mjs");
    const done = new Set(allRunDirs());
    for (const id of (a._.length ? a._ : [...done]).map((x) => x.replace(/[\/]$/, ""))) {
      if (!done.has(id)) { console.log(`[contamination] ${id} skipped (no meta.json)`); continue; }
      const dir = join(RUNS_DIR, id);
      const m = rescanContamination(dir, readJson(join(dir, "meta.json")));
      writeJson(join(dir, "meta.json"), m);
      const c = m.contamination;
      console.log(`[contamination] ${id} → ${c.flagged ? `FLAGGED ${JSON.stringify(c.counts)}` : "clean"}${c.loopbackRequests ? ` · ${c.loopbackRequests} loopback request(s)` : ""} · web tools ${m.webToolsAvailable}`);
    }
    return;
  }

  if (cmd === "judge-text") {
    // Ad-hoc text judge: bench judge-text --text FINDINGS.md --questions q.json [--out dir]
    const { judgeText, loadQuestions } = await import("./grade/judge-text.mjs");
    if (!a.questions) throw new Error("usage: bench judge-text --text <file> --questions <json> [--out dir]");
    const text = a.text && existsSync(resolve(a.text)) ? readFileSync(resolve(a.text), "utf8") : "";
    const out = await judgeText({ text, file: a.text ? String(a.text).split(/[\\/]/).pop() : "document", ...loadQuestions(resolve(a.questions)), outDir: a.out && a.out !== true ? resolve(a.out) : null });
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (cmd === "ls") {
    for (const d of allRunDirs()) {
      const m = readJson(join(RUNS_DIR, d, "meta.json"));
      const r = readJson(join(RUNS_DIR, d, "result.json"), null);
      console.log(`${d}  ${m.status.padEnd(11)} ${r ? `${r.passed}/${r.total}` : "ungraded"}`);
    }
    return;
  }

  console.log("usage: bench run|grade|report|view|reparse|contamination|judge-text|ls  (see header of bench/cli.mjs)");
  process.exitCode = cmd ? 1 : 0;
}

main().catch((e) => { console.error(`[bench] ${e.message}`); process.exit(1); });
