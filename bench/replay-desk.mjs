#!/usr/bin/env node
// Replay a recorded desk-service run (task 25a/25b) into a fresh desk so its live view can be filmed.
// It starts the task's own desk service, then sends the run's exact recorded commands (service/desk/actions.jsonl) in
// order, paced by their recorded wall-clock gaps divided by --speed, and prints the agent's narration (steps.json) and
// each command in the terminal as it goes. The view updates live, exactly as it did during the run.
//
//   node bench/replay-desk.mjs <runId> [--speed 8] [--max-gap 3] [--open] [--verify] [--quiet]
//     --speed N    divide the recorded gaps by N (default 8)
//     --max-gap S  never wait more than S seconds between events (default 3)
//     --open       open the live view in the default browser before replaying
//     --verify     stop afterwards and check the replay reproduced the recorded final state (exit 1 if not)
//   Without --verify the desk stays up after the replay (Ctrl-C stops it), so the end state can be filmed.
//   VBENCH_RUNS_DIR / VBENCH_TASKS_DIR point at other runs/ and tasks/ folders (e.g. from a worktree).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const RUNS = process.env.VBENCH_RUNS_DIR || join(ROOT, "runs");
const TASKS = process.env.VBENCH_TASKS_DIR || join(ROOT, "tasks");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : dflt; };
const runId = args.find((a, i) => !a.startsWith("--") && !["--speed", "--max-gap"].includes(args[i - 1]));
if (!runId) { console.error("usage: node bench/replay-desk.mjs <runId> [--speed 8] [--max-gap 3] [--open] [--verify] [--quiet]"); process.exit(2); }
const speed = opt("--speed", 8), maxGap = opt("--max-gap", 3), quiet = flag("--quiet");

const runDir = join(RUNS, runId);
const deskDir = join(runDir, "service", "desk");
if (!existsSync(join(deskDir, "actions.jsonl"))) { console.error(`no desk log in ${deskDir} — is this a task 25 run?`); process.exit(2); }
const meta = JSON.parse(readFileSync(join(runDir, "meta.json"), "utf8"));
const bench = JSON.parse(readFileSync(join(TASKS, meta.task, "bench.json"), "utf8"));
const svc = (bench.services || []).find((s) => s.name === "desk");
if (!svc) { console.error(`${meta.task} has no desk service`); process.exit(2); }

const recorded = readFileSync(join(deskDir, "actions.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
// Narration: the agent's visible text and non-empty thinking, by time.
let narration = [];
if (existsSync(join(runDir, "steps.json"))) {
  const steps = JSON.parse(readFileSync(join(runDir, "steps.json"), "utf8")).steps || [];
  narration = steps.filter((s) => ["assistant-text", "thinking", "final"].includes(s.kind) && s.t && String(s.body || "").trim())
    .map((s) => ({ at: Date.parse(s.t), kind: s.kind, text: String(s.body).trim() }));
}
const timeline = [
  ...recorded.map((a) => ({ at: Date.parse(a.wall), action: a })),
  ...narration.map((n) => ({ at: n.at, say: n })),
].sort((x, y) => x.at - y.at || (x.say ? -1 : 1));

const dim = (s) => `\x1b[2m${s}\x1b[0m`, cyan = (s) => `\x1b[36m${s}\x1b[0m`, yellow = (s) => `\x1b[33m${s}\x1b[0m`, red = (s) => `\x1b[31m${s}\x1b[0m`;
const shellQuote = (a) => (/^[\w@.:\/,=+-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);
const wrap = (t, w = 100) => t.split("\n").flatMap((line) => { const out = []; let s = line; while (s.length > w) { const cut = s.lastIndexOf(" ", w) > 40 ? s.lastIndexOf(" ", w) : w; out.push(s.slice(0, cut)); s = s.slice(cut).trimStart(); } out.push(s); return out; });

const { startDesk } = await import(pathToFileURL(join(TASKS, meta.task, svc.module)).href);
const dataDir = mkdtempSync(join(tmpdir(), "vb-replay-"));
const desk = await startDesk({ variant: svc.options?.variant || "A", dataDir, log: () => {} });
const viewUrl = desk.meta.viewUrl;
console.log(`\nReplaying ${cyan(runId)} (${meta.model}, ${recorded.length} desk commands) at ${speed}x`);
console.log(`Live view: ${cyan(viewUrl)}\n`);
if (flag("--open")) spawn("cmd", ["/c", "start", "", viewUrl], { detached: true, stdio: "ignore", windowsHide: true }).unref();
await new Promise((r) => setTimeout(r, flag("--open") ? 2500 : 500));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cli = join(desk.binDir, "desk.mjs");
let prevAt = timeline[0]?.at ?? 0, mismatches = 0, lastUnread = null;
for (const ev of timeline) {
  await sleep(Math.min(Math.max(0, ev.at - prevAt) / speed, maxGap * 1000));
  prevAt = ev.at;
  if (ev.say) {
    if (quiet) continue;
    const tag = ev.say.kind === "thinking" ? "thinks" : ev.say.kind === "final" ? "final" : "says";
    for (const line of wrap(ev.say.text).slice(0, ev.say.kind === "final" ? 40 : 12)) console.log(yellow(`  ${tag} │ `) + line);
    continue;
  }
  const a = ev.action;
  const r = spawnSync(process.execPath, [cli, ...a.argv], { encoding: "utf8", windowsHide: true });
  const out = (r.stdout || "") + (r.stderr || "");
  const status = out.trim().split("\n").filter((l) => l.startsWith("[desk]")).pop() || "";
  const unread = Number((/inbox: (\d+) unread/.exec(status) || [])[1]);
  const jump = lastUnread !== null && unread > lastUnread ? red(`  ◀ NEW MAIL (${lastUnread} → ${unread} unread)`) : "";
  if (!Number.isNaN(unread)) lastUnread = unread;
  const same = (r.status ?? -1) === a.exit;
  if (!same) mismatches++;
  const shown = a.argv.map(shellQuote).join(" ").replace(/\r?\n/g, " ⏎ ");
  console.log(`${dim(`#${String(a.seq).padStart(3)}`)} $ desk ${shown.length > 150 ? `${shown.slice(0, 150)}…` : shown}${same ? "" : red(`  (exit ${r.status}, recorded ${a.exit})`)}${jump}`);
}

if (!flag("--verify")) {
  console.log(`\nReplay done. The desk stays up for filming at ${cyan(viewUrl)}. Ctrl-C to stop.`);
  const shutdown = async () => { await desk.stop({ reason: "replay ended" }); try { rmSync(dataDir, { recursive: true, force: true }); } catch {} process.exit(0); };
  process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
} else {
  const res = await desk.stop({ reason: "replay verify" });
  const norm = (buf) => { const s = JSON.parse(String(buf)); return JSON.stringify(s); };
  const want = norm(readFileSync(join(deskDir, "final-state.json")));
  const got = res.files["final-state.json"] ? norm(res.files["final-state.json"]) : null;
  const outsWant = recorded.map((a) => a.outSha256).join(",");
  const outsGot = String(res.files["actions.jsonl"] || "").split("\n").filter(Boolean).map((l) => JSON.parse(l).outSha256).join(",");
  try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
  const ok = got === want && outsGot === outsWant && mismatches === 0;
  console.log(`\nverify: final state ${got === want ? "IDENTICAL" : red("DIFFERS")} · every command's output ${outsGot === outsWant ? "IDENTICAL" : red("DIFFERS")} · exit codes ${mismatches ? red(`${mismatches} differ`) : "match"}`);
  console.log(ok ? "REPLAY OK" : red("REPLAY MISMATCH"));
  process.exit(ok ? 0 : 1);
}
