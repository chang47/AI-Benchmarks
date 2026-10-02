// D7 worker (spawned by harness-selftests.mjs): the generic `services` hook (bench/lib/services.mjs) end to end with
// a GENERATED fixture service (a tiny loopback HTTP server that takes its admin secret over stdin) and scripted fake
// agents, through the real runner (+ grader for VBENCH_SERVICE_DIR). Env must be set before util.mjs is imported,
// hence a separate process. Prints one JSON line: { ok, evidence }.
//   node selftest-services.mjs <scratch>                 run every scenario
//   node selftest-services.mjs --sigint-child <scratch>  (internal) start a service, then raise SIGINT
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const sigintChild = process.argv[2] === "--sigint-child";
const scratch = sigintChild ? process.argv[3] : process.argv[2];
const tasks = join(scratch, "tasks"), runs = join(scratch, "runs");
process.env.VBENCH_TASKS_DIR = tasks;
process.env.VBENCH_RUNS_DIR = runs;
const put = (p, s) => { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, s); };
const hash = (s) => createHash("sha256").update(s).digest("hex");
const SERVICE = join(scratch, "fx", "fx-service.mjs");

// ---------------------------------------------------------------- fixture service (module + server + CLI)
const SERVER_SRC = `import http from "node:http";
let cfg = null, buf = "", hits = 0;
const integrity = [];
process.stdin.on("data", (d) => {
  buf += d;
  const i = buf.indexOf("\\n");
  if (cfg || i < 0) return;
  cfg = JSON.parse(buf.slice(0, i));
  const srv = http.createServer((req, res) => {
    const send = (code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/ping") { hits++; return send(200, { ok: true, hits }); }
    if (req.url === "/die") { send(200, { dying: true }); return setTimeout(() => process.exit(3), 50); }
    if (req.url.startsWith("/admin/")) {
      if (req.headers["x-admin"] !== cfg.secret) { integrity.push({ kind: "admin-probe", path: req.url }); return send(403, { error: "forbidden" }); }
      if (req.url === "/admin/dump") return send(200, { hits, integrity, argv: process.argv, execArgv: process.execArgv });
      if (req.url === "/admin/stop") { send(200, { stopping: true }); return setTimeout(() => process.exit(0), 20); }
    }
    send(404, { error: "no route" });
  });
  srv.listen(0, "127.0.0.1", () => process.stdout.write("READY " + srv.address().port + "\\n"));
});
process.stdin.on("end", () => process.exit(0)); // the runner went away: never outlive it
`;
const MODULE_SRC = `import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
export async function start({ name, runId, ws, dataDir, options }) {
  const secret = "fx-" + randomBytes(12).toString("hex");
  const child = spawn(process.execPath, [join(HERE, "fx-server.mjs")], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  child.stdin.write(JSON.stringify({ secret }) + "\\n");
  let log = "";
  child.stderr.on("data", (d) => (log += d));
  const port = await new Promise((res, rej) => {
    let out = "";
    child.stdout.on("data", (d) => { out += d; const m = /READY (\\d+)/.exec(out); if (m) res(Number(m[1])); });
    child.on("exit", (c) => rej(new Error("fixture server exited " + c)));
  });
  let exited = false;
  child.on("exit", () => (exited = true));
  if (options.pidFile) writeFileSync(options.pidFile, JSON.stringify({ pid: child.pid, port, secret }));
  const bin = join(dataDir, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "fxcli.mjs"), "console.log('fxcli ok ' + (process.env.FX_URL ? 'url' : 'no-url'));\\n");
  writeFileSync(join(bin, "fxcli.cmd"), '@node "%~dp0fxcli.mjs" %*\\r\\n');
  writeFileSync(join(bin, "fxcli"), '#!/bin/sh\\nexec node "$(dirname "$0")/fxcli.mjs" "$@"\\n');
  const url = "http://127.0.0.1:" + port;
  const call = async (p) => (await fetch(url + p, { method: "POST", headers: { "x-admin": secret } })).json();
  return {
    env: { FX_URL: url, FX_SESSION: runId, ...(options.badEnv ? { FX_ADMIN_SECRET: secret } : {}) },
    pathPrepend: [bin], pid: child.pid,
    dataDir: options.dataInside ? join(ws, "fxdata") : dataDir,
    meta: { port, viewUrl: url + "/ping" },
    async stop() {
      let dump = null;
      if (!exited) { try { dump = await call("/admin/dump"); await call("/admin/stop"); } catch { /* died meanwhile */ } }
      const early = !dump;
      for (let i = 0; i < 50 && !exited; i++) await new Promise((r) => setTimeout(r, 20));
      child.stdin.end();
      return { files: { "dump.json": JSON.stringify(dump), "server.log": log, "nested/secret-check.txt": dump ? String(JSON.stringify(dump.argv).includes(secret)) : "n/a" },
        meta: { exitedEarly: early, integrityEvents: dump?.integrity || [], trigger: null, secretSha256: (await import("node:crypto")).createHash("sha256").update(secret).digest("hex") } };
    },
  };
}
`;
put(join(scratch, "fx", "fx-server.mjs"), SERVER_SRC);
put(SERVICE, MODULE_SRC);

if (sigintChild) {
  // (internal) start a service like the runner does, then raise SIGINT: the hook's handler must kill it and exit 130.
  const { startServices } = await import("../lib/services.mjs");
  const ws = join(scratch, "sig-ws");
  mkdirSync(ws, { recursive: true });
  await startServices({ cfg: { services: [{ name: "fx", module: SERVICE, options: { pidFile: join(scratch, "sig-pid.json") } }] }, slug: "x", runId: "sigint", runDir: join(scratch, "sig-run"), ws, log: () => {} });
  setInterval(() => {}, 1000);
  setTimeout(() => process.emit("SIGINT", "SIGINT"), 200);
} else await main();

async function main() {
  rmSync(tasks, { recursive: true, force: true });
  rmSync(runs, { recursive: true, force: true });
  // ---- fake agent: behaviour = the prompt (stdin). Writes agent-report.json (collected as the artifact).
  const agent = join(scratch, "fake-agent.mjs");
  put(agent, `import fs from "node:fs"; import { delimiter } from "node:path"; import { execSync } from "node:child_process";
let mode = ""; for await (const d of process.stdin) mode += d; mode = mode.trim();
const pathKeys = Object.keys(process.env).filter((k) => k.toUpperCase() === "PATH");
const report = { mode, pathKeys, first: (process.env[pathKeys[0]] || "").split(delimiter)[0], url: process.env.FX_URL || null, env: process.env };
const url = process.env.FX_URL;
if (mode === "hang") { fs.writeFileSync("agent-report.json", JSON.stringify(report)); setInterval(() => {}, 1000); }
else {
  report.ping = url ? (await (await fetch(url + "/ping")).json()).ok : false;
  try { report.cli = execSync("fxcli", { encoding: "utf8", shell: true }).trim(); } catch (e) { report.cli = "ERR " + e.message; }
  report.probe = url ? (await fetch(url + "/admin/dump", { method: "POST" })).status : null;
  if (mode === "kill-service") {
    await fetch(url + "/die").catch(() => {});
    for (let i = 0; i < 100; i++) { try { await fetch(url + "/ping"); await new Promise((r) => setTimeout(r, 20)); } catch { break; } }
  }
  fs.writeFileSync("agent-report.json", JSON.stringify(report));
  if (mode === "crash") throw new Error("fake agent crashed");
  console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "done" }));
}
`);
  const grader = `import { existsSync, readFileSync } from "node:fs"; import { join } from "node:path";
const d = process.env.VBENCH_SERVICE_DIR || "";
const dump = existsSync(join(d, "fx", "dump.json")) ? JSON.parse(readFileSync(join(d, "fx", "dump.json"), "utf8")) : null;
console.log(JSON.stringify({ pointsPossible: 1, checks: [{ id: "S1", group: "Service", name: "grader reads VBENCH_SERVICE_DIR", points: 1, earned: dump && dump.hits >= 1 ? 1 : 0, status: dump && dump.hits >= 1 ? "pass" : "fail", detail: d }] }));
`;
  const mkTask = (slug, mode, options = {}, extra = {}) => {
    const t = join(tasks, slug);
    put(join(t, "frozen-prompt.md"), `${mode}\n`);
    put(join(t, "bench.json"), JSON.stringify({ artifacts: ["agent-report.json"], extractFromFinal: false, timeoutMin: extra.timeoutMin || 2,
      services: [{ name: "fx", module: SERVICE, options: { pidFile: join(scratch, `${slug}-pid.json`), ...options } }],
      grader: { kind: "node-script", cwd: "holdout", script: "grade.mjs", parse: "points", timeoutMin: 1 }, judgeItems: [] }, null, 2));
    put(join(t, "holdout", "grade.mjs"), grader);
    put(join(t, "holdout", "FREEZE_MANIFEST.json"), JSON.stringify({ files: { "grade.mjs": hash(grader) } }));
  };
  mkTask("97a-svc-normal", "normal");
  mkTask("97b-svc-cap", "hang", {}, { timeoutMin: 0.05 });
  mkTask("97c-svc-crash", "crash");
  mkTask("97d-svc-killed", "kill-service");
  mkTask("97e-svc-launchfail", "normal");
  mkTask("97f-svc-inside", "normal", { dataInside: true });
  mkTask("97g-svc-badenv", "normal", { badEnv: true });

  const { HARNESSES } = await import("../harnesses/index.mjs");
  HARNESSES["selftest-svc"] = { id: "selftest-svc", rawFormat: "claude", command: () => ({ cmd: process.execPath, args: [agent], env: { ...process.env } }), version: async () => "selftest" };
  HARNESSES["selftest-missing"] = { id: "selftest-missing", rawFormat: "claude", command: () => ({ cmd: "vbench-no-such-binary-d7", args: [], env: { ...process.env } }), version: async () => "missing" };
  const { runOne } = await import("../run.mjs");
  const { gradeRun } = await import("../grade/grade.mjs");
  const { prependPath, isInside, serviceDataRoot } = await import("../lib/services.mjs");
  const { tmpdir } = await import("node:os");

  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const portOpen = (port) => new Promise((res) => { const s = connect(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });
  const pidOf = (slug) => { const p = join(scratch, `${slug}-pid.json`); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; };
  const settle = async (pid) => { for (let i = 0; i < 40 && pid && alive(pid); i++) await new Promise((r) => setTimeout(r, 50)); };
  const conds = {}, ev = [];
  const run = async (slug, harness = "selftest-svc") => runOne({ task: slug, harness, model: "fake", profile: "clean-room", log: () => {} });
  const leftovers = async (slug) => { const p = pidOf(slug); if (!p) return "no pid"; await settle(p.pid); return !alive(p.pid) && !(await portOpen(p.port)) ? null : `pid ${p.pid} alive ${alive(p.pid)} / port ${p.port} open`; };
  const filesOk = (meta) => {
    const s = meta.services?.[0];
    if (!s) return false;
    return Object.entries(s.files).every(([rel, sha]) => existsSync(join(runs, meta.runId, "service", "fx", rel)) && hash(readFileSync(join(runs, meta.runId, "service", "fx", rel))) === sha) && Object.keys(s.files).length === 3;
  };

  // 1. normal end: env + PATH injected, CLI resolves through PATH, outputs copied + hashed, grader sees VBENCH_SERVICE_DIR
  {
    const meta = await run("97a-svc-normal");
    const rep = JSON.parse(readFileSync(join(runs, meta.runId, "output", "agent-report.json"), "utf8"));
    const s = meta.services[0], pid = pidOf("97a-svc-normal");
    const secretInEnv = Object.values(rep.env).some((v) => String(v).includes(pid.secret));
    const secretInArgv = readFileSync(join(runs, meta.runId, "service", "fx", "nested", "secret-check.txt"), "utf8") !== "false";
    const result = await gradeRun(join(runs, meta.runId), { judge: false, log: () => {} });
    conds.normal = meta.status === "ok" && rep.pathKeys.length === 1 && rep.first.endsWith("bin") && rep.url === `http://127.0.0.1:${pid.port}` && rep.ping === true
      && rep.cli === "fxcli ok url" && rep.probe === 403 && !secretInEnv && !secretInArgv && s.port === pid.port && s.stopReason === "finished" && s.exitedEarly === false
      && s.integrityEvents.length === 1 && s.integrityEvents[0].kind === "admin-probe" && filesOk(meta) && !(await leftovers("97a-svc-normal")) && result.pointsEarned === 1
      && !isInside(join(serviceDataRoot(), meta.runId, "fx"), meta.workspace);
    ev.push(`normal: env+PATH (${rep.pathKeys.join("/")} ×1, first=…${rep.first.slice(-20)}), CLI via PATH "${rep.cli}", probe ${rep.probe} → ${s.integrityEvents.length} integrity event, secret in agent env ${secretInEnv} / server argv ${secretInArgv}, ${Object.keys(s.files).length} files hashed, grader S1 ${result.pointsEarned}/1, stop ${s.stopReason}`);
  }
  // 2. time cap: the hanging agent is killed, the service still stopped and collected
  {
    const meta = await run("97b-svc-cap"), s = meta.services?.[0];
    const left = await leftovers("97b-svc-cap");
    conds.cap = meta.status === "timeout" && s?.stopReason === "timeout" && filesOk(meta) && !left;
    ev.push(`cap: status ${meta.status}, stop ${s?.stopReason}, leftovers ${left || "none"}`);
  }
  // 3. agent crash
  {
    const meta = await run("97c-svc-crash"), s = meta.services?.[0];
    const left = await leftovers("97c-svc-crash");
    conds.crash = meta.status === "error" && s?.stopReason === "agent-error" && filesOk(meta) && !left;
    ev.push(`crash: status ${meta.status}, stop ${s?.stopReason}, leftovers ${left || "none"}`);
  }
  // 4. the agent kills the service: recorded as exitedEarly, stop() still returns
  {
    const meta = await run("97d-svc-killed"), s = meta.services?.[0];
    const left = await leftovers("97d-svc-killed");
    conds.killed = meta.status === "ok" && s?.exitedEarly === true && !left;
    ev.push(`service killed by agent: exitedEarly ${s?.exitedEarly}, leftovers ${left || "none"}`);
  }
  // 5. harness binary missing: launch failure still stops the service
  {
    const meta = await run("97e-svc-launchfail", "selftest-missing"), s = meta.services?.[0];
    const left = await leftovers("97e-svc-launchfail");
    conds.launchFail = meta.status === "error" && s?.stopReason === "launch-failure" && !left;
    ev.push(`launch failure: stop ${s?.stopReason}, leftovers ${left || "none"}`);
  }
  // 6/7. refused: a data dir inside the workspace, a secret-looking env name → run refused, nothing left running
  for (const [slug, key, re] of [["97f-svc-inside", "dataInside", /inside the agent's workspace/], ["97g-svc-badenv", "badEnv", /refusing env name/]]) {
    let err = null;
    try { await run(slug); } catch (e) { err = e.message; }
    const left = await leftovers(slug);
    conds[key] = re.test(err || "") && !left;
    ev.push(`${key}: ${err ? `refused (${err.slice(0, 70)}…)` : "NOT refused"}, leftovers ${left || "none"}`);
  }
  // 8. PATH merge unit checks (Windows-style Path key, no PATH key)
  {
    const a = prependPath({ Path: "C:\\x", Other: "1" }, ["C:\\bin"]), b = prependPath({}, ["/bin2"]);
    const sep = process.platform === "win32" ? ";" : ":";
    conds.pathMerge = a.Path === `C:\\bin${sep}C:\\x` && !("PATH" in a) && b.PATH === "/bin2" && Object.keys(a).length === 2;
    ev.push(`PATH merge: Path kept as one key ${conds.pathMerge}`);
  }
  // 9. Ctrl-C: a runner process with a live service gets SIGINT → service tree killed, exit 130
  {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--sigint-child", scratch], { encoding: "utf8", windowsHide: true, timeout: 60_000 });
    const p = existsSync(join(scratch, "sig-pid.json")) ? JSON.parse(readFileSync(join(scratch, "sig-pid.json"), "utf8")) : null;
    await settle(p?.pid);
    const ok = r.status === 130 && p && !alive(p.pid) && !(await portOpen(p.port));
    conds.sigint = !!ok;
    ev.push(`Ctrl-C: exit ${r.status}, server ${p ? (alive(p.pid) ? "ALIVE" : "gone") : "never started"}`);
  }
  const ok = Object.values(conds).every(Boolean);
  return console.log(JSON.stringify({ ok, evidence: `${ev.join("; ")}${ok ? "" : ` — FAILED: ${Object.entries(conds).filter(([, v]) => !v).map(([k]) => k).join(", ")}`}` }));
}
