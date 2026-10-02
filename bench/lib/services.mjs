// Generic `services` hook (task 25 spec §7, AC-18..AC-22): local apps the agent works against during a run.
//
// bench.json: "services": [{ "name": "desk", "module": "service/service.mjs", "options": { ... } }]
//   `module` is absolute or task-relative; `$VAR` / `${VAR}` expand from the environment (like workspace.from).
//
// Module contract (an ES module exporting `start`):
//   start({ name, runId, runDir, ws, dataDir, options, log }) → {
//     env?: { NAME: value },     merged into the agent's env (names that look like secrets are refused, AC-22)
//     pathPrepend?: [dir, …],    prepended to the EXISTING PATH key whatever its case (Path on Windows), never a 2nd key
//     pid?: number,              the service process; killed as a tree on Ctrl-C / runner exit (safety net)
//     killSync?: () => void,     optional synchronous emergency kill (else taskkill /T /F on pid)
//     dataDir?: string,          where the service keeps files; refused if inside the workspace (AC-21)
//     meta?: { port, viewPort, viewUrl, … },
//     stop: async ({ reason }) → { files?: { relPath: Buffer|string }, meta?: { trigger, integrityEvents, exitedEarly, … } }
//   }
// The runner starts services after the workspace is prepared and before the agent, and stops them on every exit
// path (normal end, time cap, crash, launch failure, Ctrl-C). `stop()` output goes to runs/<id>/service/<name>/ with
// sha256 hashes in meta.services[]. Secrets (admin keys) are the module's business: they go to its process over
// stdin and never through this hook's env or argv.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { nowIso, sha256, taskDir } from "./util.mjs";

/** Env names a service may never inject (secrets travel over the service's stdin, never through the agent's env). */
export const SECRET_ENV_NAME = /secret|token|passw|admin|api[_-]?key|(^|_)key($|_)/i;
const STOP_TIMEOUT_MS = 60_000;

/** `$VAR` / `${VAR}` expansion + task-relative resolution (shared by workspace.from and services[].module). */
export function resolveTaskPath(slug, p, what = "path") {
  const expanded = String(p).replace(/\$\{?([A-Z0-9_]+)\}?/gi, (_, v) => {
    if (process.env[v] == null) throw new Error(`${what} uses $${v}, which is not set`);
    return process.env[v];
  });
  return isAbsolute(expanded) ? expanded : join(taskDir(slug), expanded);
}

const canon = (p) => {
  let r = resolve(p);
  try { r = realpathSync.native(r); } catch { /* not created yet: compare the resolved path */ }
  return process.platform === "win32" ? r.toLowerCase() : r;
};
/** True when `p` is `root` or inside it (case-insensitive on Windows, links resolved where they exist). */
export function isInside(p, root) {
  const rel = relative(canon(root), canon(p));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Prepend dirs to the env's existing PATH key (any case); add `PATH` only when there is none. Returns a new env. */
export function prependPath(env, dirs) {
  if (!dirs?.length) return { ...env };
  const out = { ...env };
  const keys = Object.keys(out).filter((k) => k.toUpperCase() === "PATH");
  if (!keys.length) { out.PATH = dirs.join(delimiter); return out; }
  for (const k of keys) out[k] = [...dirs, out[k]].filter(Boolean).join(delimiter);
  return out;
}

function killTreeSync(pid) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else { try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } } }
}

// ---- emergency stop (Ctrl-C / runner exit): one handler for every live controller in this process
const live = new Set();
let handlersInstalled = false;
function emergencyKillAll() {
  for (const c of live) c.killAllSync();
  live.clear();
}
function installHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  process.on("exit", emergencyKillAll);
  for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) {
    process.on(sig, () => {
      process.stderr.write(`[services] ${sig}: stopping ${live.size} live service set(s)\n`);
      emergencyKillAll();
      // A listener replaces Node's default "exit on signal": exit only if nobody else handles it.
      if (process.listenerCount(sig) <= 1) process.exit(sig === "SIGINT" ? 130 : 143);
    });
  }
}

/**
 * Start every service in cfg.services. Returns a controller:
 *   { list, applyEnv(env) → env, stopAll(reason) → meta.services[] }  (stopAll is idempotent)
 * If any service fails to start, the ones already started are stopped and the error is rethrown.
 */
export async function startServices({ cfg, slug, runId, runDir, ws, log = console.log }) {
  const specs = cfg.services || [];
  const started = [];
  const controller = {
    list: started,
    stopped: null,
    killAllSync() {
      for (const s of started) {
        if (s.stopped) continue;
        try { s.handle?.killSync ? s.handle.killSync() : killTreeSync(s.handle?.pid); } catch { /* best effort */ }
        // Emergency path (Ctrl-C / runner exit): outputs are not collected, but nothing may be left behind.
        try { removeDefaultDataDir(s); } catch { /* locked */ }
      }
    },
    applyEnv(env) {
      let out = { ...env };
      const dirs = [];
      for (const s of started) {
        Object.assign(out, s.handle.env || {});
        dirs.push(...(s.handle.pathPrepend || []));
      }
      out = prependPath(out, dirs);
      return out;
    },
    async stopAll(reason = "finished") {
      if (controller.stopped) return controller.stopped;
      const metas = [];
      for (const s of started) metas.push(await stopOne(s, { runDir, reason, log }));
      live.delete(controller);
      controller.stopped = metas;
      return metas;
    },
  };
  if (!specs.length) return controller;
  installHandlers();
  live.add(controller);
  try {
    for (const spec of specs) {
      if (!spec?.name || !/^[a-z0-9][a-z0-9_-]*$/i.test(spec.name)) throw new Error(`bench.json services[]: bad name ${JSON.stringify(spec?.name)}`);
      if (!spec.module) throw new Error(`service ${spec.name}: no module`);
      const modPath = resolveTaskPath(slug, spec.module, `service ${spec.name} module`);
      if (!existsSync(modPath)) throw new Error(`service ${spec.name}: module not found: ${modPath}`);
      // The runner's default data dir is outside both the workspace and the run dir (the agent never gets a path to it).
      const dataDir = spec.dataDir ? resolveTaskPath(slug, spec.dataDir, `service ${spec.name} dataDir`) : join(tmpdir(), "vbench-svc", runId, spec.name);
      if (isInside(dataDir, ws)) throw new Error(`service ${spec.name}: refusing a data dir inside the agent's workspace (${dataDir})`);
      mkdirSync(dataDir, { recursive: true });
      const mod = await import(pathToFileURL(modPath).href);
      if (typeof mod.start !== "function") throw new Error(`service ${spec.name}: ${modPath} exports no start()`);
      const rec = { name: spec.name, module: spec.module, startedAt: nowIso(), readyAt: null, handle: null, stopped: false, defaultDataDir: spec.dataDir ? null : dataDir };
      started.push(rec);
      rec.handle = await mod.start({ name: spec.name, runId, runDir, ws, dataDir, options: spec.options || {}, log });
      rec.readyAt = nowIso();
      const h = rec.handle || {};
      if (typeof h.stop !== "function") throw new Error(`service ${spec.name}: start() returned no stop()`);
      const reported = [h.dataDir, ...(h.pathPrepend || [])].filter(Boolean);
      const inside = reported.filter((p) => isInside(p, ws));
      if (inside.length) throw new Error(`service ${spec.name}: refusing a data dir inside the agent's workspace (${inside.join(", ")})`);
      const bad = Object.keys(h.env || {}).filter((k) => SECRET_ENV_NAME.test(k) || k.toUpperCase() === "PATH");
      if (bad.length) throw new Error(`service ${spec.name}: refusing env name(s) ${bad.join(", ")} (secrets go over the service's stdin; PATH via pathPrepend)`);
      log(`[run] ${runId} · service ${spec.name} ready${h.meta?.port ? ` on 127.0.0.1:${h.meta.port}` : ""}`);
      if (h.meta?.viewUrl) log(`[run] ${spec.name} view: ${h.meta.viewUrl}`);
    }
  } catch (e) {
    await controller.stopAll("launch-failure").catch(() => {});
    controller.killAllSync();
    throw e;
  }
  return controller;
}

function removeDefaultDataDir(s) {
  if (!s.defaultDataDir) return;
  rmSync(s.defaultDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  const parent = dirname(s.defaultDataDir);
  if (existsSync(parent) && !readdirSync(parent).length) rmSync(parent, { recursive: true, force: true });
}

async function stopOne(s, { runDir, reason, log }) {
  const meta = { name: s.name, module: s.module, ...(s.handle?.meta || {}), startedAt: s.startedAt, readyAt: s.readyAt,
    stoppedAt: null, stopReason: reason, exitedEarly: null, trigger: null, integrityEvents: [], files: {}, error: null };
  if (!s.handle) { s.stopped = true; meta.stoppedAt = nowIso(); meta.error = "start() did not return"; return meta; }
  let res = null;
  try {
    res = await Promise.race([
      s.handle.stop({ reason }),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`stop() timed out after ${STOP_TIMEOUT_MS / 1000}s`)), STOP_TIMEOUT_MS).unref()),
    ]);
  } catch (e) { meta.error = String(e.message || e); }
  // Whatever stop() did, make sure nothing is left running.
  try { s.handle.killSync ? s.handle.killSync() : killTreeSync(s.handle.pid); } catch { /* gone */ }
  s.stopped = true;
  meta.stoppedAt = nowIso();
  const outDir = join(runDir, "service", s.name);
  for (const [rel, data] of Object.entries(res?.files || {})) {
    if (rel.includes("..") || isAbsolute(rel)) { meta.error = `${meta.error ? meta.error + "; " : ""}refused output path ${rel}`; continue; }
    const p = join(outDir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, data);
    meta.files[rel.split("\\").join("/")] = sha256(typeof data === "string" ? Buffer.from(data) : data);
  }
  Object.assign(meta, res?.meta || {}, { files: meta.files, stopReason: reason, stoppedAt: meta.stoppedAt, error: meta.error });
  // The runner-chosen data dir is the runner's to clean: stop() has handed over everything worth keeping.
  try { removeDefaultDataDir(s); } catch (e) { meta.error = `${meta.error ? meta.error + "; " : ""}data dir not removed: ${e.message}`; }
  log(`[run] service ${s.name} stopped (${reason})${meta.exitedEarly ? " · EXITED EARLY" : ""}${meta.error ? ` · ${meta.error}` : ""} · ${Object.keys(meta.files).length} file(s)`);
  return meta;
}
