#!/usr/bin/env node
// Unattended overnight batch: one run at a time, graded as soon as it finishes, resumable, and patient with the
// subscription's usage limit (a limit-hit run is moved to runs/_aborted/ and retried after the window resets).
//
//   node bench/overnight.mjs --arms bench/arms/sonnet55-vs-opus.json \
//        --plan "22a,21,20,18:1;22a,21:3;20,18:2" [--stop-at 09:00] [--dry-run]
//
// --plan = stages separated by ";", each "task,task:n". Within a stage the order is attempt-major (every arm gets
// attempt 1 before any gets attempt 2), so a night cut short still leaves a complete grid.
// --stop-at HH:MM (local) = start no new run after that time (Josh's own sessions share the plan's limit).
// Progress: .bench-cache/logs/overnight.log + overnight-status.json. Wrap with bench/keepawake.ps1 so the laptop
// doesn't sleep mid-run (a sleeping run gets logged as a timeout).
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR, ROOT, RUNS_DIR, readJson, resolveTask, writeJson } from "./lib/util.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const DRY = argv.includes("--dry-run");
const arms = readJson(join(ROOT, arg("arms", "bench/arms/sonnet55-vs-opus.json"))).arms;
const stages = arg("plan", "22a,21,20,18:1").split(";").filter(Boolean).map((s) => {
  const [tasks, n] = s.split(":");
  return { tasks: tasks.split(",").map(resolveTask), n: Number(n || 1) };
});
const stopAt = arg("stop-at", null);

const LOG_DIR = join(CACHE_DIR, "logs");
mkdirSync(LOG_DIR, { recursive: true });
const LOG = join(LOG_DIR, "overnight.log");
const STATUS = join(LOG_DIR, "overnight-status.json");
const log = (m) => { const line = `${new Date().toISOString()} ${m}`; process.stdout.write(line + "\n"); appendFileSync(LOG, line + "\n"); };
const status = existsSync(STATUS) ? readJson(STATUS) : { runs: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pastStop() {
  if (!stopAt) return false;
  const [h, m] = stopAt.split(":").map(Number);
  const now = new Date();
  const stop = new Date(now); stop.setHours(h, m, 0, 0);
  // a stop time earlier than the start of the night means "tomorrow morning"
  if (stop < startedAt) stop.setDate(stop.getDate() + 1);
  return now >= stop;
}
const startedAt = new Date();

const cellKey = (task, arm) => `${task}|${arm.harness}|${arm.model}|${arm.profile}`;
function cellRuns(task, arm) {
  return readdirSync(RUNS_DIR).filter((d) => !d.startsWith("_") && existsSync(join(RUNS_DIR, d, "meta.json")))
    .map((d) => ({ id: d, m: readJson(join(RUNS_DIR, d, "meta.json")) }))
    .filter(({ m }) => cellKey(m.task, { harness: m.harness, model: m.model, profile: m.profile?.name }) === cellKey(task, arm))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// The usage limit shows up as a rejected rate_limit_event or an error result that says so.
function limitHit(id) {
  const raw = join(RUNS_DIR, id, "raw.jsonl");
  let resetsAt = null, hit = false;
  if (existsSync(raw)) for (const line of readFileSync(raw, "utf8").split("\n")) {
    if (!line.includes("rate_limit") && !line.includes('"result"')) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const info = e.rate_limit_info;
    if (info?.resetsAt) resetsAt = info.resetsAt;
    if (info?.status === "rejected") hit = true;
    if (e.type === "result" && e.is_error && /limit/i.test(String(e.result || ""))) hit = true;
  }
  const m = readJson(join(RUNS_DIR, id, "meta.json"));
  if (m.status !== "ok" && /usage limit|limit reached|hit your limit/i.test(String(m.finalText || m.errorDetail || ""))) hit = true;
  return { hit, resetsAt };
}

const node = (args) => spawnSync(process.execPath, [join(ROOT, "bench", "cli.mjs"), ...args], { cwd: ROOT, stdio: "inherit" });

function record(task, arm, id) {
  const m = readJson(join(RUNS_DIR, id, "meta.json"));
  const r = readJson(join(RUNS_DIR, id, "result.json"), null);
  const row = {
    runId: id, task, model: arm.model, profile: arm.profile, status: m.status, timedOut: m.timedOut,
    points: r ? `${r.pointsEarned ?? r.passed}/${r.pointsPossible ?? r.total}` : "ungraded",
    minutes: m.metrics?.durationMs ? +(m.metrics.durationMs / 60000).toFixed(1) : null,
    outputTokens: m.metrics?.outputTokens ?? null, costUsdEstimate: m.metrics?.costUsdEstimate ?? null,
  };
  status.runs = status.runs.filter((x) => x.runId !== id).concat(row);
  writeJson(STATUS, status);
  log(`DONE ${task} ${arm.model} ${arm.profile}: ${row.points} · ${row.minutes} min · $${row.costUsdEstimate?.toFixed?.(2) ?? "—"} (list est.) · ${id}`);
}

log(`overnight start · ${arms.length} arms · plan ${arg("plan", "22a,21,20,18:1")} · stop-at ${stopAt || "none"}${DRY ? " · DRY RUN" : ""}`);
outer: for (const stage of stages) for (let k = 1; k <= stage.n; k++) for (const task of stage.tasks) for (const arm of arms) {
  for (;;) {
    const have = cellRuns(task, arm);
    if (have.length >= k) break;
    if (pastStop()) { log(`stop-at ${stopAt} reached; not starting more runs`); break outer; }
    log(`RUN ${task} ${arm.model} ${arm.profile} (attempt ${k}/${stage.n})`);
    if (DRY) break;
    node(["run", "--task", task, "--harness", arm.harness, "--model", arm.model, "--profile", arm.profile, "--n", String(k), "--fill"]);
    const after = cellRuns(task, arm);
    const fresh = after.find((x) => !have.some((h) => h.id === x.id));
    if (!fresh) { log(`no new run dir for ${task} ${arm.model}; stopping to avoid a loop`); break outer; }
    const { hit, resetsAt } = limitHit(fresh.id);
    if (hit) {
      mkdirSync(join(RUNS_DIR, "_aborted"), { recursive: true });
      renameSync(join(RUNS_DIR, fresh.id), join(RUNS_DIR, "_aborted", fresh.id));
      const waitMs = resetsAt ? Math.max(60_000, resetsAt * 1000 - Date.now() + 120_000) : 30 * 60_000;
      log(`USAGE LIMIT on ${fresh.id} → moved to runs/_aborted; waiting ${(waitMs / 60000).toFixed(0)} min for the reset`);
      await sleep(waitMs);
      continue;
    }
    node(["grade", fresh.id]);
    record(task, arm, fresh.id);
    break;
  }
}
log("overnight end");
