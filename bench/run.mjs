// Step 1 — the runner: (task × harness × model × profile) → runs/<id>/
//   raw.jsonl (untouched harness stdout) · stderr.log · output/ (collected artifacts)
//   workspace-files.txt · steps.json (normalized) · meta.json (+ prompt.md copy)
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { getHarness, modelAlias } from "./harnesses/index.mjs";
import { scanRaw, webToolsAvailable } from "./lib/contamination.mjs";
import {
  ROOT, RUNS_DIR, ensureDir, listFiles, loadBenchConfig, nowIso, rand4, readJson, resolveTask,
  runProcess, sha256, sha256File, stamp, taskDir, writeJson,
} from "./lib/util.mjs";
import { copyTreeExcluding, dirSize, makeShortWorkspace, prepareFromDir, removeWorkspace } from "./lib/workspace.mjs";
import { parseFile } from "./trajectory/index.mjs";

export const WEB_TOOLS = ["WebFetch", "WebSearch"];

export function loadProfile(name = "clean-room", overrides = {}) {
  const p = join(ROOT, "bench", "profiles", `${name}.json`);
  return { ...readJson(p), ...overrides };
}

/** bench.json `denyWebTools: true` adds WebFetch/WebSearch to the profile's deny list for this task (whatever the profile). */
export function applyTaskToolPolicy(profile, cfg) {
  if (!cfg.denyWebTools) return profile;
  const deny = [...new Set([...(profile.tools?.deny || []), ...WEB_TOOLS])];
  return { ...profile, tools: { ...(profile.tools || {}), deny }, taskDeniedTools: WEB_TOOLS };
}

/** `workspace.from`: absolute, or relative to the task dir; `$VAR` / `${VAR}` expand from the environment. */
export function resolveWorkspaceFrom(slug, from) {
  const expanded = String(from).replace(/\$\{?([A-Z0-9_]+)\}?/gi, (_, v) => {
    if (process.env[v] == null) throw new Error(`workspace.from uses $${v}, which is not set`);
    return process.env[v];
  });
  return isAbsolute(expanded) ? expanded : join(taskDir(slug), expanded);
}

function makeWorkspace(runId, profile, cfg = {}, slug = "") {
  const iso = profile.isolation || "tmp";
  const wcfg = cfg.workspace || {};
  if (wcfg.from && iso !== "tmp") throw new Error(`bench.json workspace.from needs isolation "tmp" (profile ${profile.name} uses "${iso}")`);
  if (iso === "tmp") {
    // Short root (C:\b\<task>-<4hex>) keeps deep node_modules paths under Windows MAX_PATH.
    const ws = wcfg.shortRoot ? makeShortWorkspace(slug.split("-")[0] || "run") : join(tmpdir(), "vbench", runId);
    mkdirSync(ws, { recursive: true });
    return { ws, cleanup: () => (wcfg.from ? removeWorkspace(ws) : rmSync(ws, { recursive: true, force: true })) };
  }
  const m = /^worktree:(.+?)(?:@(.+))?$/.exec(iso);
  if (m) {
    const [, repo, ref = "HEAD"] = m;
    const ws = join(tmpdir(), "vbench-wt", runId);
    const r = spawnSync("git", ["-C", repo, "worktree", "add", "--detach", ws, ref], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git worktree add failed: ${r.stderr}`);
    // Never --force: if the agent left changes, keep the worktree and say so.
    const cleanup = () => {
      const rm = spawnSync("git", ["-C", repo, "worktree", "remove", ws], { encoding: "utf8" });
      if (rm.status !== 0) process.stderr.write(`[bench] worktree kept (has changes): ${ws}\n`);
    };
    return { ws, cleanup, repo };
  }
  throw new Error(`unknown isolation "${iso}"`);
}

/** Pull the deliverable out of the final message when the agent replied with it instead of writing it. */
export function extractFromText(text, artifactPath) {
  if (!text) return null;
  const ext = artifactPath.split(".").pop().toLowerCase();
  const langs = { html: ["html", "htm", ""], mjs: ["js", "javascript", "mjs", ""], js: ["js", "javascript", ""], svg: ["svg", "xml", "html", ""] }[ext] || [ext, ""];
  const fences = [...text.matchAll(/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g)]
    .filter((f) => langs.includes(f[1].toLowerCase()))
    .map((f) => f[2]);
  if (fences.length) return fences.sort((a, b) => b.length - a.length)[0];
  const t = text.trim();
  if (ext === "html" && /^(<!doctype html|<html)/i.test(t)) return t;
  if (ext === "svg" && /^<svg/i.test(t)) return t;
  return null;
}

function collectArtifacts(cfg, ws, outDir, finalText) {
  const found = [];
  const all = listFiles(ws);
  for (const rel of cfg.artifacts) {
    const dst = join(outDir, rel);
    mkdirSync(dirname(dst), { recursive: true });
    if (existsSync(join(ws, rel))) {
      copyFileSync(join(ws, rel), dst);
      found.push({ path: rel, source: "file" });
      continue;
    }
    // Same file name elsewhere in the workspace (e.g. index.html at root instead of src/).
    const alt = all.find((f) => basename(f) === basename(rel));
    if (alt) {
      copyFileSync(join(ws, alt), dst);
      found.push({ path: rel, source: `file:${alt}` });
      continue;
    }
    const body = cfg.extractFromFinal ? extractFromText(finalText, rel) : null;
    if (body) {
      writeFileSync(dst, body);
      found.push({ path: rel, source: "final-message" });
      continue;
    }
    found.push({ path: rel, source: null });
  }
  // Multi-file deliverables (task 18: index.html + its own .js + vendor/): copy the whole folder. If the agent
  // put the entry file somewhere else, take the folder it actually lives in.
  // `"."` collects the whole workspace (whole-repo tasks); `artifactExclude` drops node_modules, dist, .git/objects, …
  for (const dir of cfg.artifactDirs || []) {
    const whole = dir === "." || dir === "./";
    const entry = found.find((f) => f.path.startsWith(`${dir}/`));
    const from = whole ? ws : existsSync(join(ws, dir)) ? join(ws, dir)
      : entry?.source?.startsWith("file:") ? join(ws, dirname(entry.source.slice(5))) : null;
    if (!from || (from === ws && !whole)) continue;
    const to = whole ? outDir : join(outDir, dir);
    if (cfg.artifactExclude?.length || whole) copyTreeExcluding(from, to, cfg.artifactExclude || []);
    else cpSync(from, to, { recursive: true, force: false, errorOnExist: false }); // unchanged path for tasks 18/20/21
  }
  return found;
}

/** Snapshot the text file the text judge will read (bench.json judgeText.file), exactly as the run left it. */
function snapshotJudgeText(cfg, ws, runDir) {
  if (!cfg.judgeText?.file) return null;
  const rel = cfg.judgeText.file;
  const src = join(ws, rel);
  if (!existsSync(src)) return { file: rel, present: false, bytes: 0, sha256: null, path: null };
  const buf = readFileSync(src);
  const dst = join(ensureDir(join(runDir, "judge-text")), basename(rel));
  writeFileSync(dst, buf);
  return { file: rel, present: true, bytes: buf.length, sha256: sha256(buf), path: `judge-text/${basename(rel)}` };
}

/** Copy tasks/<slug>/inputs/** into the workspace (vendored libs, screenshots) and record their hashes. */
function copyInputs(slug, ws) {
  const src = join(taskDir(slug), "inputs");
  if (!existsSync(src)) return null;
  cpSync(src, join(ws, "inputs"), { recursive: true });
  return Object.fromEntries(listFiles(src).map((rel) => [rel, sha256File(join(src, rel))]));
}

export async function runOne({ task, harness: harnessId, model, profile: profileName = "clean-room", attempt = 1, of = 1, keep = false, profileOverrides = {}, log = console.log }) {
  const slug = resolveTask(task);
  const cfg = loadBenchConfig(slug);
  const harness = getHarness(harnessId);
  model = model || harness.defaultModel;
  if (!model) throw new Error(`--model is required for harness ${harnessId}`);
  const profile = applyTaskToolPolicy(loadProfile(profileName, profileOverrides), cfg);
  const runId = `${stamp()}-${slug.split("-")[0]}-${harnessId}-${modelAlias(model)}-${rand4()}`;
  const runDir = ensureDir(join(RUNS_DIR, runId));
  const prompt = readFileSync(join(taskDir(slug), cfg.prompt || "frozen-prompt.md"), "utf8");
  writeFileSync(join(runDir, "prompt.md"), prompt);

  const { ws, cleanup } = makeWorkspace(runId, profile, cfg, slug);
  let workspacePrep = null;
  if (cfg.workspace?.from) {
    const from = resolveWorkspaceFrom(slug, cfg.workspace.from);
    log(`[run] ${runId} · preparing workspace from ${from} → ${ws}`);
    try { workspacePrep = { from: cfg.workspace.from, root: ws, shortRoot: !!cfg.workspace.shortRoot, ...prepareFromDir(from, ws) }; }
    catch (e) { cleanup(); throw e; }
    log(`[run] ${runId} · workspace ready: ${workspacePrep.files} files, ${(workspacePrep.bytes / 1e6).toFixed(1)} MB in ${(workspacePrep.copyMs / 1000).toFixed(1)}s (${workspacePrep.method})`);
  }
  for (const d of new Set(cfg.artifacts.map((a) => dirname(a)).filter((d) => d !== "."))) mkdirSync(join(ws, d), { recursive: true });
  const inputs = copyInputs(slug, ws);
  if (profile.skill && harnessId === "codex") copyFileSync(profile.skill, join(ws, "AGENTS.md"));

  const cmd = harness.command({ model, profile, prompt });
  const args = cmd.cwdFlag ? [...cmd.args.slice(0, -1), cmd.cwdFlag, ws, cmd.args.at(-1)] : cmd.args;
  const startedAt = nowIso();
  log(`[run] ${runId} · ${slug} · ${harnessId}/${model} · ${profile.name} · attempt ${attempt}/${of}`);
  const proc = await runProcess(cmd.cmd, args, {
    cwd: ws, env: cmd.env, stdin: cmd.promptInArgs ? null : prompt,
    stdoutPath: join(runDir, "raw.jsonl"), stderrPath: join(runDir, "stderr.log"),
    timeoutMs: (cfg.timeoutMin || profile.timeoutMin || 30) * 60_000, // a task may need longer than the profile default
  });
  const endedAt = nowIso();

  let parsed;
  try { parsed = parseFile(join(runDir, "raw.jsonl"), harness.rawFormat, { cwd: ws }); }
  catch (e) { parsed = { steps: [], metrics: {}, info: { isError: true, errorDetail: String(e) }, parserVersion: null, badLines: [] }; }
  writeJson(join(runDir, "steps.json"), { schemaVersion: parsed.schemaVersion, parserVersion: parsed.parserVersion, steps: parsed.steps });

  const wsFiles = listFiles(ws);
  writeFileSync(join(runDir, "workspace-files.txt"), wsFiles.join("\n") + "\n");
  const judgeTextSnapshot = snapshotJudgeText(cfg, ws, runDir);
  const artifacts = collectArtifacts(cfg, ws, ensureDir(join(runDir, "output")), parsed.info.finalText);
  const artifactProduced = artifacts.every((a) => a.source);
  const artifactSize = dirSize(join(runDir, "output"));
  let contamination;
  try { contamination = scanRaw(join(runDir, "raw.jsonl"), harness.rawFormat, { extraTerms: cfg.contamination?.extraTerms }); }
  catch (e) { contamination = { scanner: null, error: String(e.message || e) }; }

  let status = "ok";
  if (proc.timedOut) status = "timeout";
  else if (parsed.info.isError || proc.code !== 0) status = "error";
  else if (!artifactProduced) status = "no-artifact";

  const safeArgs = args.map((a) => (a === prompt ? "<prompt>" : a));
  const meta = {
    runId, task: slug, workspace: ws, harness: harnessId, harnessVersion: await harness.version(),
    model, modelReported: parsed.info.modelReported || null,
    modelMismatch: !!(parsed.info.modelReported && !parsed.info.modelReported.includes(model.split("/").pop().replace(/\[.*\]$/, ""))),
    profile, attempt, of, startedAt, endedAt, status,
    exitCode: proc.code, timedOut: proc.timedOut, errorDetail: parsed.info.errorDetail || null,
    promptFile: cfg.prompt || "frozen-prompt.md", promptSha256: sha256(prompt), inputs,
    parserVersion: parsed.parserVersion, command: [cmd.cmd === process.execPath ? "node" : cmd.cmd, ...safeArgs],
    init: parsed.info.init || null, sessionId: parsed.info.sessionId || null,
    artifacts, finalText: clipEnds(parsed.info.finalText),
    artifactSize: { ...artifactSize, exclude: cfg.artifactExclude || null },
    ...(workspacePrep ? { workspacePrep } : {}),
    ...(judgeTextSnapshot ? { judgeTextSnapshot } : {}),
    webToolsAvailable: webToolsAvailable(harnessId, profile),
    contamination,
    rawBadLines: parsed.badLines?.length || 0,
    metrics: { durationMs: proc.ms, ...parsed.metrics, artifactProduced },
  };
  writeJson(join(runDir, "meta.json"), meta);
  if (!keep) cleanup();
  log(`[run] ${runId} → ${status} · ${(proc.ms / 1000).toFixed(0)}s · artifacts ${artifacts.map((a) => `${a.path}:${a.source || "MISSING"}`).join(", ")}`);
  return meta;
}

/** Run a list of jobs with bounded concurrency. */
export async function runPool(jobs, parallel = 1, log = console.log) {
  const results = [];
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const job = jobs[i++];
      try { results.push(await runOne({ ...job, log })); }
      catch (e) { log(`[run] FAILED to launch ${JSON.stringify(job)}: ${e.message}`); results.push({ error: e.message, job }); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
  return results;
}

/** Keep the head AND tail of a long final message: code-only replies put their "done / caveats" at the end. */
export function clipEnds(t, head = 1500, tail = 2500) {
  if (t == null) return null;
  return t.length <= head + tail ? t : `${t.slice(0, head)}

[… ${t.length - head - tail} characters omitted …]

${t.slice(-tail)}`;
}

/** Re-derive steps.json and the parsed metrics from raw.jsonl (e.g. after a parser fix). */
export function reparseRun(runDir) {
  const meta = readJson(join(runDir, "meta.json"));
  const parsed = parseFile(join(runDir, "raw.jsonl"), getHarness(meta.harness).rawFormat, { cwd: meta.workspace || meta.init?.cwd || join(tmpdir(), "vbench", meta.runId) });
  writeJson(join(runDir, "steps.json"), { schemaVersion: parsed.schemaVersion, parserVersion: parsed.parserVersion, steps: parsed.steps });
  const keep = { durationMs: meta.metrics?.durationMs, artifactProduced: meta.metrics?.artifactProduced };
  meta.metrics = { ...keep, ...parsed.metrics };
  meta.parserVersion = parsed.parserVersion;
  meta.modelReported = parsed.info.modelReported || meta.modelReported || null;
  meta.finalText = clipEnds(parsed.info.finalText);
  rescanContamination(runDir, meta);
  writeJson(join(runDir, "meta.json"), meta);
  return `${parsed.steps.length} steps (${parsed.parserVersion})`;
}

/** Re-derive meta.contamination (+ webToolsAvailable) from raw.jsonl — read-only over raw. Mutates and returns meta. */
export function rescanContamination(runDir, meta) {
  let extraTerms = [];
  try { extraTerms = loadBenchConfig(resolveTask(meta.task)).contamination?.extraTerms || []; } catch { /* task no longer wired */ }
  meta.contamination = scanRaw(join(runDir, "raw.jsonl"), getHarness(meta.harness).rawFormat, { extraTerms });
  if (meta.webToolsAvailable === undefined) meta.webToolsAvailable = webToolsAvailable(meta.harness, meta.profile || {});
  return meta;
}

export const promptHash = (slug) => sha256(readFileSync(join(taskDir(slug), "frozen-prompt.md"), "utf8"));
