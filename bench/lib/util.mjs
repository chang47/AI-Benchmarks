// Shared helpers: paths, hashing, file copy, process spawning, redaction.
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  cpSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TASKS_DIR = join(ROOT, "tasks");
export const RUNS_DIR = process.env.VBENCH_RUNS_DIR || join(ROOT, "runs");
export const CACHE_DIR = join(ROOT, ".bench-cache");
export const HOME = homedir();

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
export const sha256File = (p) => sha256(readFileSync(p));
export const rand4 = () => randomBytes(2).toString("hex");

export const readJson = (p, fallback) => {
  if (!existsSync(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing JSON file: ${p}`);
  }
  return JSON.parse(readFileSync(p, "utf8"));
};
export const writeJson = (p, obj) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
};

/** Resolve "07", "7", "07-bowling" or "bowling" to a task slug under tasks/. */
export function resolveTask(q) {
  const slugs = readdirSync(TASKS_DIR).filter((d) => statSync(join(TASKS_DIR, d)).isDirectory());
  const s = String(q);
  const hit = slugs.find((d) => d === s)
    || slugs.find((d) => d.split("-")[0] === s.padStart(2, "0"))
    || slugs.find((d) => d.includes(s));
  if (!hit) throw new Error(`unknown task "${q}"`);
  return hit;
}

export const taskDir = (slug) => join(TASKS_DIR, slug);

export function loadBenchConfig(slug) {
  const p = join(taskDir(slug), "bench.json");
  if (!existsSync(p)) throw new Error(`task ${slug} has no bench.json — it is not wired into the harness yet`);
  return readJson(p);
}

/** List files under dir (relative paths), skipping node_modules. */
export function listFiles(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, base, out);
    else out.push(relative(base, p).split("\\").join("/"));
  }
  return out;
}

export function copyDir(src, dst, { skipNodeModules = false } = {}) {
  cpSync(src, dst, {
    recursive: true,
    filter: (p) => !(skipNodeModules && relative(src, p).split(/[\\/]/).includes("node_modules")),
  });
}

/**
 * Spawn a process, stream stdout to a file (untouched) and stderr to another.
 * Never uses a shell: args (including empty strings) pass through verbatim.
 * Resolves { code, signal, timedOut, ms }.
 */
export function runProcess(cmd, args, { cwd, env, stdin, stdoutPath, stderrPath, timeoutMs, onLine } = {}) {
  return new Promise((resolvePromise) => {
    const t0 = Date.now();
    const child = spawn(cmd, args, { cwd, env, windowsHide: true });
    const out = stdoutPath ? createWriteStream(stdoutPath) : null;
    const err = stderrPath ? createWriteStream(stderrPath) : null;
    let buf = "";
    child.stdout.on("data", (d) => {
      out?.write(d);
      if (onLine) {
        buf += d.toString("utf8");
        let i;
        while ((i = buf.indexOf("\n")) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
      }
    });
    child.stderr.on("data", (d) => err?.write(d));
    let timedOut = false;
    const timer = timeoutMs ? setTimeout(() => { timedOut = true; killTree(child.pid); }, timeoutMs) : null;
    child.on("error", (e) => { err?.write(String(e)); });
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      const done = () => resolvePromise({ code, signal, timedOut, ms: Date.now() - t0 });
      let pending = (out ? 1 : 0) + (err ? 1 : 0);
      if (!pending) return done();
      const fin = () => { if (--pending === 0) done(); };
      out?.end(fin); err?.end(fin);
    });
    if (stdin != null) child.stdin.end(stdin); else child.stdin.end();
  });
}

function killTree(pid) {
  if (process.platform === "win32") spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  else try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
}

/** Collect stdout of a short command (for --version probes). */
export async function capture(cmd, args, opts = {}) {
  return new Promise((res) => {
    const c = spawn(cmd, args, { windowsHide: true, ...opts });
    let s = "";
    c.stdout.on("data", (d) => (s += d));
    c.on("error", () => res(""));
    c.on("close", () => res(s.trim()));
    c.stdin.end();
  });
}

// ---- redaction (for anything rendered into HTML) ----
const USER = HOME.split(/[\\/]/).pop();
const extraTerms = (() => {
  const p = join(ROOT, "leakguard.local.txt");
  return existsSync(p) ? readFileSync(p, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
})();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const homeVariants = [HOME, HOME.split("\\").join("/"), HOME.split("\\").join("\\\\"), HOME.split("\\").join("\\\\\\\\")];

export function redact(text) {
  if (typeof text !== "string") return text;
  let t = text;
  for (const h of homeVariants) t = t.split(h).join("~");
  // Windows path fragments that sneak through with other casings/escapings
  t = t.replace(new RegExp(`([A-Za-z]:)?(\\\\{1,4}|/)Users(\\\\{1,4}|/)${esc(USER)}`, "gi"), "~");
  for (const term of extraTerms) t = t.replace(new RegExp(esc(term), "gi"), "[redacted]");
  return t;
}
export const REDACT_PROBES = [USER, ...extraTerms];

export function ensureDir(p) { mkdirSync(p, { recursive: true }); return p; }
export function nowIso() { return new Date().toISOString(); }
export function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
