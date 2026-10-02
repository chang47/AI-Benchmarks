// Step 2 — the grader. For a run: tamper-check the frozen answer key, build a sandbox that
// mirrors the task layout (holdout copy + the run's output as src/), run the task's frozen
// grader UNMODIFIED, normalize to result.json, then add AI-judged items and the claim check.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CACHE_DIR, ROOT, RUNS_DIR, ensureDir, listFiles, loadBenchConfig, nowIso, rand4, readJson, resolveTask,
  runProcess, sha256File, taskDir, writeJson,
} from "../lib/util.mjs";
import { classifyClaim, judgeChecklist, judgeVisualItems, JUDGE_MODEL } from "./judge.mjs";
import { judgeText, loadQuestions, snapshotText } from "./judge-text.mjs";
import { copyTreeExcluding } from "../lib/workspace.mjs";
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

async function runGrader(slug, cfg, hold, gradeDir, runDir, judge = true) {
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
      // points graders save their judge frames to VBENCH_FRAMES_DIR. Whole-repo tasks read the collected output
      // (VBENCH_OUTPUT_DIR) and may call the text judge themselves (VBENCH_JUDGE_TEXT_MODULE / _FILE).
      cwd: hold, env: { ...process.env, ...graderEnv(slug, cfg, gradeDir, runDir, judge) }, stdoutPath: join(gradeDir, "grader-stdout.txt"), stderrPath: join(gradeDir, "grader-stderr.txt"), timeoutMs,
    });
    let raw = null;
    try { raw = JSON.parse(readFileSync(join(gradeDir, "grader-stdout.txt"), "utf8")); } catch { /* grader crashed */ }
    return { proc: p, parsed: NORMALIZERS[g.parse](raw, p) };
  }
  throw new Error(`unknown grader kind ${g.kind}`);
}

/**
 * Extra env for node-script graders (ignored by graders that don't read it). VBENCH_JUDGE is "0" under --no-judge
 * (a grader that calls the text judge itself honours it); VBENCH_TASK_DIR is the ORIGINAL, tamper-checked task dir,
 * for heavy holdout content the sandbox copy leaves out (it skips every nested node_modules).
 */
function graderEnv(slug, cfg, gradeDir, runDir, judge = true) {
  const env = { VBENCH_FRAMES_DIR: join(gradeDir, "frames"), VBENCH_JUDGE: judge ? "1" : "0", VBENCH_TASK_DIR: taskDir(slug) };
  if (!runDir) return env;
  env.VBENCH_RUN_DIR = runDir;
  env.VBENCH_OUTPUT_DIR = join(runDir, "output");
  env.VBENCH_SERVICE_DIR = join(runDir, "service"); // bench.json services: runs/<id>/service/<name>/ (outputs of stop())
  env.VBENCH_JUDGE_TEXT_MODULE = pathToFileURL(join(ROOT, "bench", "grade", "judge-text.mjs")).href;
  if (cfg.judgeText?.file) env.VBENCH_JUDGE_TEXT_FILE = snapshotText(runDir, cfg.judgeText.file).path || "";
  return env;
}

/**
 * Fill judge-text checks. Checks the grader emitted with method "judge-text" and status "skip" are placeholders
 * (their points come from the grader); if the grader emitted none at all, one check per question is added.
 * A check the grader already decided is left alone (the grader may call the text judge itself).
 */
async function applyTextJudge({ slug, cfg, runDir, gradeDir, result, judge, log }) {
  const jt = cfg.judgeText;
  const spec = loadQuestions(join(taskDir(slug), jt.questions));
  const snap = snapshotText(runDir, jt.file);
  if (!result.checks.some((c) => c.method === "judge-text")) {
    for (const q of spec.questions) result.checks.push({ id: q.id, name: q.name || q.q, group: q.group || jt.group || "Findings (judge)",
      ...(typeof q.points === "number" ? { points: q.points, earned: 0 } : {}), status: "skip", method: "judge-text", detail: "" });
  }
  const todo = result.checks.filter((c) => c.method === "judge-text" && c.status === "skip");
  if (!todo.length) return;
  if (!judge) {
    for (const c of todo) { c.status = "fail"; if (typeof c.points === "number") c.earned = 0; c.detail = "judge disabled (--no-judge): scored 0"; }
    return;
  }
  const questions = todo.map((c) => spec.questions.find((q) => q.id === c.id) || { id: c.id, q: c.name });
  const j = await judgeText({ text: snap.text, file: jt.file, questions, instructions: spec.instructions, outDir: join(gradeDir, "judge-text"), log });
  for (const c of todo) {
    const v = j.verdicts[c.id];
    c.status = v.verdict === "yes" ? "pass" : v.verdict === "no" ? "fail" : "unclear"; // "judge failed" → unclear, 0 points
    if (typeof c.points === "number") c.earned = v.verdict === "yes" ? c.points : 0;
    c.judgeVerdict = v.verdict;
    c.detail = `TEXT JUDGE (${jt.file}): ${v.verdict} — ${v.reasoning}`;
  }
  result.judgeText = { ...j.meta, snapshot: snap.path ? "present" : "missing", verdicts: j.verdicts };
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
  // Which frozen answer key graded this (scores are only comparable within one manifest).
  result.graderManifestSha256 = tc.ok ? sha256File(join(taskDir(slug), cfg.grader.cwd || "holdout", "FREEZE_MANIFEST.json")) : null;
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
    const { proc, parsed } = await runGrader(slug, cfg, hold, gradeDir, runDir, judge);
    result.checks = parsed.checks;
    // Some frozen browser checks are timing-sensitive (measured 2026-09-26: task 15 R10 passed 2 of 3 grades of
    // the same build). With grader.repeat N, re-run the frozen grader and mark any check whose verdict
    // disagrees across runs as "unclear (flaky)" instead of letting one run's luck decide it.
    for (let k = 2; k <= (cfg.grader.repeat || 1); k++) {
      const again = await runGrader(slug, cfg, hold, gradeDir, runDir, judge);
      for (const c of result.checks) {
        const o = again.parsed.checks.find((x) => x.id === c.id);
        if (o && o.status !== c.status) {
          c.flaky = [...(c.flaky || [c.status]), o.status];
          c.detail = `${c.detail} ⟶ FLAKY across frozen-grader runs (${c.flaky.join("/")}): ${o.detail}`;
          c.status = "unclear";
        }
      }
    }
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

    // Grader-v2 world probe (bench-side, one page load): OVERRIDE frozen checks that graded an assumption the
    // prompt never stated, FILL checks the frozen grader skipped, ADD checks for prompt requirements the frozen
    // rubric never graded. The frozen verdict is always kept on the check (frozenStatus) — nothing is hidden.
    if (cfg.benchProbe) {
      const bp = cfg.benchProbe;
      copyFileSync(join(ROOT, "bench", "grade", "resolvers", bp.script), join(hold, "_bench-world-probe.mjs"));
      const out = join(gradeDir, "world-probe.json");
      await runProcess(process.execPath, ["_bench-world-probe.mjs", join(hold, "..", "src", "index.html")], { cwd: hold, stdoutPath: out, stderrPath: join(gradeDir, "world-probe-stderr.txt"), timeoutMs: 8 * 60_000 });
      let items = {};
      try { items = JSON.parse(readFileSync(out, "utf8")).items || {}; } catch { result.notes.push("world probe produced no output — frozen verdicts kept (see grade/world-probe-stderr.txt)"); }
      const apply = (c, v, why) => {
        c.frozenStatus = c.status; c.frozenDetail = c.detail;
        c.status = v.status; c.method = "bench-probe";
        c.detail = `${v.detail} [grader v2 — ${why}; frozen check said ${c.frozenStatus}: ${c.frozenDetail}]`;
      };
      for (const id of bp.override || []) {
        const c = result.checks.find((x) => x.id === id), v = items[id];
        if (c && v && v.status !== "skip") apply(c, v, bp.why?.[id] || "re-measured over the whole world");
      }
      for (const id of bp.fillSkip || []) {
        const c = result.checks.find((x) => x.id === id), v = items[id];
        if (c && v && c.status === "skip" && v.status !== "skip") apply(c, v, bp.why?.[id] || "frozen check could not decide");
      }
      for (const [id, name] of Object.entries(bp.add || {})) {
        const v = items[id] || { status: "skip", detail: "world probe did not report this check" };
        result.checks.push({ id, name, status: v.status, method: "bench-check", detail: `${v.detail} [grader v2 — added: a prompt requirement the frozen rubric never graded]` });
      }
    }

    // Judge checklist (points tasks): blind yes/no questions answered from the grader's fixed frames.
    const questions = result.checks.filter((c) => c.status === "skip" && c.method === "judge-checklist");
    if (cfg.judgeItems === "checklist" && questions.length) {
      if (judge && !missing.length) {
        const j = await judgeChecklist({ slug, cfg, gradeDir, items: questions, log });
        result.judge = j.meta;
        for (const c of questions) {
          const v = j.verdicts[c.id];
          c.status = v.verdict === "yes" ? "pass" : v.verdict === "no" ? "fail" : "unclear";
          c.earned = v.verdict === "yes" ? c.points : 0; // a tie or no majority scores 0 (spec: contain the subjectivity)
          c.detail = `JUDGE: ${v.verdict} — ${v.reasoning}`;
        }
      } else for (const c of questions) { c.earned = 0; c.status = "fail"; c.detail = missing.length ? "no artifact to judge" : "judge disabled (--no-judge): scored 0"; }
    }

    // Text judge (judgeText): yes/no questions answered from ONE agent-written file, snapshotted when the run ended.
    if (cfg.judgeText) await applyTextJudge({ slug, cfg, runDir, gradeDir, result, judge, log });

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
  // Points checklists: the score is points earned / points possible, next to the k/n count.
  if (result.checks.some((c) => typeof c.points === "number")) {
    result.pointsPossible = result.checks.reduce((a, c) => a + (c.points || 0), 0);
    result.pointsEarned = result.checks.reduce((a, c) => a + (c.earned || 0), 0);
    result.score = result.pointsPossible ? Number((result.pointsEarned / result.pointsPossible).toFixed(4)) : 0;
    const groups = {};
    for (const c of result.checks) { const g = (groups[c.group || "other"] ||= { earned: 0, possible: 0 }); g.earned += c.earned || 0; g.possible += c.points || 0; }
    result.groups = groups;
  }

  if (judge && meta.finalText != null && !meta.reference) {
    result.claim = await classifyClaim({ finalText: meta.finalText, gradeDir, log });
    // Points tasks: nobody is expected to hit 82/82, so a "done" claim is false only below the 90% pass line.
    // A run killed by the time limit never got to claim anything — its last message is mid-work, so no verdict.
    result.fakeConvergence = meta.status === "timeout" ? null
      : result.claim.label === "claimed" && (result.pointsPossible ? result.score < 0.9 : !result.allPass);
  }
  result.status = "graded";
  writeJson(join(runDir, "result.json"), result);
  log(`[grade] ${meta.runId} → ${result.passed}/${result.total}${result.pointsPossible ? ` · ${result.pointsEarned}/${result.pointsPossible} pts` : ""}${result.allPass ? " ALL PASS" : ""}${result.fakeConvergence ? " · FAKE CONVERGENCE" : ""}`);
  return result;
}

/** B1/B2 controls: grade the task's own reference src/ (or a supplied file) as a pseudo-run. */
export async function gradeReference(task, { candidate, label = "reference", judge = true, log = console.log } = {}) {
  const slug = resolveTask(task);
  const cfg = loadBenchConfig(slug);
  const runDir = ensureDir(join(RUNS_DIR, "_controls", `${slug}-${label}`));
  rmSync(join(runDir, "output"), { recursive: true, force: true });
  const artifacts = [];
  // Folder deliverables (task 18): the control is a whole src/ folder (reference, or a mutated copy of it).
  if (cfg.artifactDirs?.length && (!candidate || statSync(candidate).isDirectory())) {
    // `referenceDir` (task-relative) = where the reference solution lives when it is not the task dir itself
    // (whole-repo tasks collect artifactDirs ["."]); artifactExclude applies like it does to a real run.
    const refRoot = cfg.referenceDir ? join(taskDir(slug), cfg.referenceDir) : taskDir(slug);
    for (const dir of cfg.artifactDirs) {
      const from = candidate || join(refRoot, dir), to = join(runDir, "output", dir);
      if (cfg.artifactExclude?.length) copyTreeExcluding(from, to, cfg.artifactExclude);
      else cpSync(from, to, { recursive: true });
    }
    artifacts.push(...cfg.artifacts.map((rel) => ({ path: rel, source: candidate ? `control:${label}` : "reference" })));
  } else for (const rel of cfg.artifacts) {
    const from = candidate || join(taskDir(slug), rel);
    mkdirSync(join(runDir, "output", rel, ".."), { recursive: true });
    copyFileSync(from, join(runDir, "output", rel));
    artifacts.push({ path: rel, source: candidate ? `control:${label}` : "reference" });
  }
  writeJson(join(runDir, "meta.json"), { runId: `${slug}-${label}`, task: slug, reference: true, label, harness: "control", model: label, artifacts, finalText: null });
  return gradeRun(runDir, { judge, log });
}

export const JUDGE_INFO = { model: JUDGE_MODEL };
