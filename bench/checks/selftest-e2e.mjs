// D6 worker (spawned by harness-selftests.mjs): a GENERATED fixture task (never a real one) + a scripted fake agent,
// run through the real runner and grader with the judge faked. Env must be set before util.mjs is imported, hence
// a separate process. Prints one JSON line: { ok, evidence }.
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const scratch = process.argv[2];
rmSync(scratch, { recursive: true, force: true });
const tasks = join(scratch, "tasks"), runs = join(scratch, "runs"), slug = "99-selftest", task = join(tasks, slug);
process.env.VBENCH_TASKS_DIR = tasks;
process.env.VBENCH_RUNS_DIR = runs;
const put = (p, s) => { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, s); };
const hash = (s) => createHash("sha256").update(s).digest("hex");

const { makePreparedDir } = await import("./harness-selftests.mjs");
const prepared = makePreparedDir(join(scratch, "prep"));
process.env.VBENCH_SELFTEST_PREPARED = prepared.src;

// ---- the fixture task
put(join(task, "frozen-prompt.md"), "Fix the bug in add() and write FINDINGS.md.\n");
put(join(task, "bench.json"), JSON.stringify({
  artifacts: ["src/calc.js"], artifactDirs: ["."], artifactExclude: ["node_modules", "dist", ".git/objects", "var"],
  extractFromFinal: false, timeoutMin: 2, denyWebTools: true,
  workspace: { from: "$VBENCH_SELFTEST_PREPARED", shortRoot: true },
  judgeText: { file: "FINDINGS.md", questions: "holdout/findings-questions.json" },
  grader: { kind: "node-script", cwd: "holdout", script: "grade.mjs", parse: "points", timeoutMin: 2 },
  judgeItems: [],
}, null, 2));
const grader = `import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const out = process.env.VBENCH_OUTPUT_DIR || "";
const calc = existsSync(join(out, "src", "calc.js")) ? readFileSync(join(out, "src", "calc.js"), "utf8") : "";
const leaked = ["node_modules", "dist", "var", ".git/objects"].filter((d) => existsSync(join(out, d)));
const env = !!process.env.VBENCH_JUDGE_TEXT_MODULE && /FINDINGS\\.md$/.test(process.env.VBENCH_JUDGE_TEXT_FILE || "");
const c = (id, name, points, ok, detail = "") => ({ id, group: "Bugs", name, points, earned: ok ? points : 0, status: ok ? "pass" : "fail", detail });
console.log(JSON.stringify({ pointsPossible: 9, checks: [
  c("B1", "add() fixed", 3, calc.includes("a + b")),
  c("B2", "excluded dirs not collected", 1, !leaked.length, leaked.join(",")),
  c("B3", "grader sees text-judge env", 1, env),
  { id: "F1", group: "Findings", name: "names the root cause", points: 2, earned: 0, status: "skip", method: "judge-text" },
  { id: "F2", group: "Findings", name: "cites a failing test", points: 2, earned: 0, status: "skip", method: "judge-text" },
] }));
`;
const questions = JSON.stringify({ instructions: "The document is a bug-fix report.", questions: [
  { id: "F1", q: "Does the report name the root cause of the add() bug?" },
  { id: "F2", q: "Does the report cite a failing test that reproduces it?" },
] }, null, 2);
put(join(task, "holdout", "grade.mjs"), grader);
put(join(task, "holdout", "findings-questions.json"), questions);
put(join(task, "holdout", "FREEZE_MANIFEST.json"), JSON.stringify({ files: { "grade.mjs": hash(grader), "findings-questions.json": hash(questions) } }));

// ---- the fake agent: edits the repo, writes FINDINGS.md + junk dirs, prints Claude stream-json
const agent = join(scratch, "fake-agent.mjs");
put(agent, `import fs from "node:fs";
let stdin = ""; for await (const d of process.stdin) stdin += d;
fs.writeFileSync("src/calc.js", fs.readFileSync("src/calc.js", "utf8").replace("a - b", "a + b"));
fs.writeFileSync("packages/lib/index.js", "export const add = (a, b) => a + b;\\n");
const live = fs.readFileSync("node_modules/@app/lib/index.js", "utf8").includes("a + b"); // junction points at the workspace copy
fs.writeFileSync("FINDINGS.md", "# Findings\\nRoot cause: add() subtracted instead of adding. Fixed in src/calc.js.\\n");
for (const d of ["dist", "var"]) { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(d + "/junk.txt", "x"); }
const cwd = process.cwd(), ev = (e) => console.log(JSON.stringify({ session_id: "s", ...e }));
const tu = (id, command) => ev({ type: "assistant", message: { model: "fake", id: "m" + id, role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } });
const tr = (id, content) => ev({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content }] } });
ev({ type: "system", subtype: "init", cwd, model: "fake", tools: ["Bash", "Read", "Write", "Edit"] });
tu("t1", "curl -s https://example.com/data"); tr("t1", "ok");
tu("t2", "curl http://localhost:3000/"); tr("t2", "ok");
ev({ type: "assistant", message: { model: "fake", id: "m9", role: "assistant", content: [{ type: "text", text: "done" }] } });
ev({ type: "result", subtype: "success", is_error: false, result: "done; prompt " + (stdin.includes("FINDINGS") ? "received" : "MISSING") + "; junction-live=" + live });
`);

const { HARNESSES } = await import("../harnesses/index.mjs");
HARNESSES.selftest = { id: "selftest", rawFormat: "claude", command: () => ({ cmd: process.execPath, args: [agent], env: { ...process.env } }), version: async () => "selftest" };
const { judgeHooks } = await import("../grade/judge.mjs");
judgeHooks.ask = async ({ prompt }) => {
  if (prompt.includes("Classify what the message ASSERTS")) return { json: { label: "claimed", reason: "says done" } };
  const yes = /QUESTION F1/.test(prompt) && prompt.includes("Root cause: add() subtracted");
  return { json: { answer: yes ? "yes" : "no", reason: "fake judge" } };
};
const { runOne } = await import("../run.mjs");
const { gradeRun } = await import("../grade/grade.mjs");
const { shortRootBase } = await import("../lib/workspace.mjs");

const out = { ok: false, evidence: "" };
try {
  const meta = await runOne({ task: "99", harness: "selftest", model: "fake", profile: "clean-room", log: () => {} });
  const runDir = join(runs, meta.runId);
  const result = await gradeRun(runDir, { log: () => {} });
  const w = meta.workspacePrep || {};
  const pts = Object.fromEntries(result.checks.map((c) => [c.id, `${c.earned}/${c.points}`]));
  const snap = meta.judgeTextSnapshot || {};
  const sourceIntact = readFileSync(join(prepared.src, "src", "calc.js"), "utf8").includes("a - b") && readFileSync(join(prepared.src, "packages", "lib", "index.js"), "utf8").includes("a - b");
  const conds = {
    status: meta.status === "ok",
    shortRoot: meta.workspace.startsWith(shortRootBase()) && w.files > 0 && w.bytes > 0 && typeof w.copyMs === "number",
    removed: !existsSync(meta.workspace),
    sourceIntact,
    junctionLive: /junction-live=true/.test(meta.finalText || ""),
    artifacts: meta.artifactSize?.files > 0 && !existsSync(join(runDir, "output", "node_modules")) && existsSync(join(runDir, "output", "FINDINGS.md")) && existsSync(join(runDir, "output", ".git", "HEAD")),
    snapshot: snap.present === true && snap.sha256 === hash(readFileSync(join(runDir, "judge-text", "FINDINGS.md"))),
    contamination: meta.contamination?.counts?.["network-command"] === 1 && meta.contamination.loopbackRequests === 1 && !meta.contamination.counts["web-tool"],
    // bench.json denyWebTools reached the effective profile (the fake harness itself has no web tools → webToolsAvailable null)
    webDenied: meta.profile.tools.deny.join() === "WebFetch,WebSearch" && meta.profile.taskDeniedTools?.length === 2 && meta.webToolsAvailable === null,
    grade: result.status === "graded" && result.pointsEarned === 7 && result.pointsPossible === 9 && pts.F1 === "2/2" && pts.F2 === "0/2" && pts.B2 === "1/1" && pts.B3 === "1/1",
    judgeMeta: result.judgeText?.mode === "text" && result.judgeText.snapshot === "present" && result.judgeText.votes === 3,
  };
  out.ok = Object.values(conds).every(Boolean);
  out.evidence = `fixture task run+grade: workspace ${meta.workspace.length}-char short root, ${w.files} files/${w.bytes} B in ${w.copyMs} ms, removed after run; `
    + `prepared source untouched ${sourceIntact}; collected ${meta.artifactSize?.files} files (excl. ${meta.artifactSize?.exclude?.join(",")}); FINDINGS snapshot ${snap.bytes} B; `
    + `contamination ${JSON.stringify(meta.contamination?.counts)} + ${meta.contamination?.loopbackRequests} loopback; denyWebTools → profile deny [${meta.profile.tools.deny}]; `
    + `graded ${result.pointsEarned}/${result.pointsPossible} ${JSON.stringify(pts)}${out.ok ? "" : ` — FAILED: ${Object.entries(conds).filter(([, v]) => !v).map(([k]) => k).join(", ")}`}`;
} catch (e) {
  out.evidence = `e2e threw: ${e.stack || e.message}`;
}
rmSync(scratch, { recursive: true, force: true });
console.log(JSON.stringify(out));
