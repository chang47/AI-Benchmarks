// Step 2 — the grader. For a run: tamper-check the frozen answer key, build a sandbox that
// mirrors the task layout (holdout copy + the run's output as src/), run the task's frozen
// grader UNMODIFIED, normalize to result.json, then add AI-judged items and the claim check.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  CACHE_DIR, ROOT, RUNS_DIR, ensureDir, listFiles, loadBenchConfig, nowIso, rand4, readJson, resolveTask,
  runProcess, sha256File, taskDir, writeJson,
} from "../lib/util.mjs";
import { classifyClaim, judgeVisualItems, JUDGE_MODEL } from "./judge.mjs";
import { NORMALIZERS } from "./normalize.mjs";

/** Verify every file in a holdout dir against FREEZE_MANIFEST.json. */
export function tamperCheck(holdoutDir) {
  const manPath = join(holdoutDir, "FREEZE_MANIFEST.json");
  if (!existsSync(manPath)) return { ok: false, detail: "no FREEZE_MANIFEST.json" };
  const man = readJson(manPath);
  const bad = [];
  // Manifests were written by different tools: {path: hash} maps and [{path, sha256}] lists both exist.
  const entries = Array.isArray(man.files) ? man.files.map((f) => [f.path, f.sha256 || f.hash]) : Object.entries(man.files || {});
  for (const [rel, v] of entries) {
    const want = typeof v === "string" ? v : v.sha256 || v.hash;
    const p = join(holdoutDir, rel);
    if (!existsSync(p)) bad.push(`${rel} (missing)`);
    else if (sha256File(p) !== String(want).toLowerCase()) bad.push(`${rel} (hash mismatch)`); // manifests mix hex case
  }
  return { ok: bad.length === 0, checked: entries.length, detail: bad.join(", ") || "all hashes match" };
}

/**
 * A fresh sandbox PER GRADE (holdout copy incl. node_modules + the candidate as src/), removed afterwards.
 * It used to be shared per task — two concurrent grades then swapped each other's src/ mid-run
 * (caught 2026-09-26: logged and stored scores disagreed). Isolation is worth the ~20 MB copy.
 */
function prepareSandbox(slug, cfg, outputDir) {
  const src = join(taskDir(slug), cfg.grader.cwd || "holdout");
  const box = join(CACHE_DIR, "sandbox", slug, `${process.pid}-${rand4()}`);
  const hold = join(box, cfg.grader.cwd || "holdout");
  mkdirSync(hold, { recursive: true });
  if (existsSync(join(src, "node_modules"))) cpSync(join(src, "node_modules"), join(hold, "node_modules"), { recursive: true });
  for (const rel of listFiles(src)) {
    mkdirSync(join(hold, rel, ".."), { recursive: true });
    copyFileSync(join(src, rel), join(hold, rel));
  }
  rmSync(join(box, "src"), { recursive: true, force: true });
  mkdirSync(join(box, "src"), { recursive: true });
  if (existsSync(join(outputDir, "src"))) cpSync(join(outputDir, "src"), join(box, "src"), { recursive: true });
  return { box, hold, sandboxTamper: tamperCheck(hold), cleanup: () => rmSync(box, { recursive: true, force: true }) };
}

async function runGrader(slug, cfg, hold, gradeDir) {
  const g = cfg.grader;
  const timeoutMs = (g.timeoutMin || 10) * 60_000;
  if (g.kind === "vitest") {
    const out = join(gradeDir, "vitest.json");
    const p = await runProcess(process.execPath, [join(hold, "node_modules", "vitest", "vitest.mjs"), "run", "--reporter=json", `--outputFile=${out}`],
      { cwd: hold, env: { ...process.env, CI: "1" }, stdoutPath: join(gradeDir, "grader-stdout.txt"), stderrPath: join(gradeDir, "grader-stderr.txt"), timeoutMs });
    const raw = existsSync(out) ? readJson(out) : null;
    return { proc: p, parsed: NORMALIZERS.vitest(raw, p) };
  }
  if (g.kind === "node-script") {
    const p = await runProcess(process.execPath, [g.script], {
      cwd: hold, env: { ...process.env }, stdoutPath: join(gradeDir, "grader-stdout.txt"), stderrPath: join(gradeDir, "grader-stderr.txt"), timeoutMs,
    });
    let raw = null;
    try { raw = JSON.parse(readFileSync(join(gradeDir, "grader-stdout.txt"), "utf8")); } catch { /* grader crashed */ }
    return { proc: p, parsed: NORMALIZERS[g.parse](raw, p) };
  }
  throw new Error(`unknown grader kind ${g.kind}`);
}

/** Grade one run folder (a real run, or a reference/control pseudo-run). */
export async function gradeRun(runDir, { judge = true, log = console.log } = {}) {
  const meta = readJson(join(runDir, "meta.json"));
  const slug = resolveTask(meta.task);
  const cfg = loadBenchConfig(slug);
  const gradeDir = ensureDir(join(runDir, "grade"));
  const result = { runId: meta.runId, task: slug, gradedAt: nowIso(), graderKind: cfg.grader.kind, tamperCheck: null,
    passed: 0, total: 0, passRate: 0, allPass: false, checks: [], judge: null, claim: null, fakeConvergence: null, notes: [] };

  const tc = tamperCheck(join(taskDir(slug), cfg.grader.cwd || "holdout"));
  result.tamperCheck = tc.ok ? "ok" : `TAMPER: ${tc.detail}`;
  if (!tc.ok) {
    result.status = "tamper";
    writeJson(join(runDir, "result.json"), result);
    log(`[grade] ${meta.runId} ABORTED — answer key does not match its freeze manifest: ${tc.detail}`);
    return result;
  }

  const outputDir = join(runDir, "output");
  const missing = (meta.artifacts || []).filter((a) => !a.source).map((a) => a.path);
  if (missing.length) result.notes.push(`missing artifact(s): ${missing.join(", ")} — the frozen grader runs anyway and fails cleanly`);

  const { hold, sandboxTamper, cleanup } = prepareSandbox(slug, cfg, outputDir);
  try {
    if (!sandboxTamper.ok) throw new Error(`sandbox copy failed its own tamper check: ${sandboxTamper.detail}`);
    log(`[grade] ${meta.runId} · ${cfg.grader.kind}${cfg.grader.script ? " " + cfg.grader.script : ""}`);
    const { proc, parsed } = await runGrader(slug, cfg, hold, gradeDir);
    result.checks = parsed.checks;
    if (parsed.error) result.notes.push(parsed.error);
    if (proc.timedOut) result.notes.push("grader timed out");

    // Deterministic resolvers first (bench-side probes for items the frozen grader skips), then the AI judge.
    for (const c of result.checks.filter((x) => x.status === "skip" && cfg.resolvers?.[x.id])) {
      const script = join(ROOT, "bench", "grade", "resolvers", cfg.resolvers[c.id]);
      copyFileSync(script, join(hold, "_bench-resolver.mjs"));
      const out = join(gradeDir, `resolver-${c.id}.json`);
      await runProcess(process.execPath, ["_bench-resolver.mjs", join(hold, "..", "src", "index.html")], { cwd: hold, stdoutPath: out, timeoutMs: 5 * 60_000 });
      let r = null;
      try { r = JSON.parse(readFileSync(out, "utf8")); } catch { /* resolver crashed: leave the skip for the judge */ }
      if (r && r.status !== "skip") {
        c.status = r.status;
        c.method = "resolver";
        c.detail = `${c.detail} ⟶ RESOLVER (${cfg.resolvers[c.id]}): ${r.status} — ${r.detail}`;
      }
    }

    // AI judge for items still undecided.
    const skipped = result.checks.filter((c) => c.status === "skip");
    if (judge && skipped.length && cfg.judgeItems === "skipped-autochecks" && !missing.length) {
      const j = await judgeVisualItems({ slug, cfg, hold, gradeDir, items: skipped, log });
      result.judge = j.meta;
      for (const c of skipped) {
        const v = j.verdicts[c.id];
        if (!v) continue;
        c.status = v.verdict === "pass" ? "pass" : v.verdict === "fail" ? "fail" : "unclear";
        c.method = "judged";
        c.detail = `${c.detail} ⟶ JUDGE: ${v.verdict} — ${v.reasoning}`;
      }
    }

  } finally { cleanup(); }

  result.total = result.checks.length;
  result.passed = result.checks.filter((c) => c.status === "pass").length;
  result.passRate = result.total ? Number((result.passed / result.total).toFixed(4)) : 0;
  result.allPass = result.total > 0 && result.passed === result.total;
  result.unresolved = result.checks.filter((c) => c.status === "skip" || c.status === "unclear").length;

  if (judge && meta.finalText != null && !meta.reference) {
    result.claim = await classifyClaim({ finalText: meta.finalText, gradeDir, log });
    result.fakeConvergence = result.claim.label === "claimed" && !result.allPass;
  }
  result.status = "graded";
  writeJson(join(runDir, "result.json"), result);
  log(`[grade] ${meta.runId} → ${result.passed}/${result.total}${result.allPass ? " ALL PASS" : ""}${result.fakeConvergence ? " · FAKE CONVERGENCE" : ""}`);
  return result;
}

/** B1/B2 controls: grade the task's own reference src/ (or a supplied file) as a pseudo-run. */
export async function gradeReference(task, { candidate, label = "reference", log = console.log } = {}) {
  const slug = resolveTask(task);
  const cfg = loadBenchConfig(slug);
  const runDir = ensureDir(join(RUNS_DIR, "_controls", `${slug}-${label}`));
  rmSync(join(runDir, "output"), { recursive: true, force: true });
  const artifacts = [];
  for (const rel of cfg.artifacts) {
    const from = candidate || join(taskDir(slug), rel);
    mkdirSync(join(runDir, "output", rel, ".."), { recursive: true });
    copyFileSync(from, join(runDir, "output", rel));
    artifacts.push({ path: rel, source: candidate ? `control:${label}` : "reference" });
  }
  writeJson(join(runDir, "meta.json"), { runId: `${slug}-${label}`, task: slug, reference: true, label, harness: "control", model: label, artifacts, finalText: null });
  return gradeRun(runDir, { judge: true, log });
}

export const JUDGE_INFO = { model: JUDGE_MODEL };
