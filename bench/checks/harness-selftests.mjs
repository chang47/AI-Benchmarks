// Self-tests for the generic harness capabilities added 2026-09-28 (no model calls, no browser, no real task):
//   D1 workspace prepare from a prepared dir (short root, node_modules + .git, links never leave the workspace)
//   D2 artifact collection with artifactExclude (+ size recorded)
//   D3 text-input judge (majority, retry on bad votes, "judge failed", empty text) — fake judge
//   D4 contamination scan over raw.jsonl (read-only; web tools / network commands / benchmark refs; loopback ignored)
//   D5 profiles: web-tool deny reaches claude / claude-glm / codex / pi; webToolsAvailable; bench.json denyWebTools
//   D6 end to end: a generated fixture task + a scripted fake agent → run → grade (text judge faked), in a child process
//   D7 services hook: fixture service + fake agents through the real runner — env/PATH injection, stop on normal end,
//      cap, crash, launch failure, service death and Ctrl-C (no process/port left), outputs hashed, VBENCH_SERVICE_DIR,
//      refusals (data dir inside the workspace, secret-looking env names), admin secret never in env/argv
import { spawnSync } from "node:child_process";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { judgeHooks } from "../grade/judge.mjs";
import { judgeText } from "../grade/judge-text.mjs";
import { HARNESSES } from "../harnesses/index.mjs";
import { scanRaw, webToolsAvailable } from "../lib/contamination.mjs";
import { ROOT, sha256File } from "../lib/util.mjs";
import {
  copyTreeExcluding, dirSize, makeExcluder, makeShortWorkspace, prepareFromDir, removeWorkspace, shortRootBase, walkNoFollow,
} from "../lib/workspace.mjs";
import { applyTaskToolPolicy, loadProfile } from "../run.mjs";

const FIX = join(ROOT, "bench", "fixtures");
const put = (p, s) => { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, s); };

/** A prepared repo like a whole-repo task ships: packages, npm-workspaces junctions, .git with a read-only object. */
export function makePreparedDir(root) {
  rmSync(root, { recursive: true, force: true });
  const src = join(root, "prepared"), outside = join(root, "outside-store");
  put(join(src, "package.json"), '{"name":"app","private":true,"workspaces":["packages/*"]}\n');
  put(join(src, "packages", "lib", "index.js"), "export const add = (a, b) => a - b; // bug\n");
  put(join(src, "src", "calc.js"), "export const add = (a, b) => a - b;\n");
  put(join(src, "node_modules", "left", "index.js"), "module.exports = 1;\n");
  put(join(outside, "ext", "index.js"), "module.exports = 'outside';\n");
  mkdirSync(join(src, "node_modules", "@app"), { recursive: true });
  symlinkSync(join(src, "packages", "lib"), join(src, "node_modules", "@app", "lib"), "junction"); // internal → retarget
  symlinkSync(join(outside, "ext"), join(src, "node_modules", "ext"), "junction"); // external → dereference
  // a deep path: > 260 chars once under the source root (MAX_PATH)
  const deep = join(src, "node_modules", ...Array.from({ length: 12 }, (_, i) => `pkg-with-a-long-name-${i}`), "leaf.js");
  put(deep, "// deep\n");
  const sha = "0123456789abcdef0123456789abcdef01234567";
  put(join(src, ".git", "HEAD"), "ref: refs/heads/main\n");
  put(join(src, ".git", "refs", "heads", "main"), `${sha}\n`);
  put(join(src, ".git", "objects", "01", "23456789"), "blob");
  chmodSync(join(src, ".git", "objects", "01", "23456789"), 0o444); // git objects are read-only
  return { src, outside, sha, deep };
}

function d1(record, scratch) {
  const { src, outside, sha, deep } = makePreparedDir(join(scratch, "d1"));
  const ws = makeShortWorkspace("st");
  try {
    const prep = prepareFromDir(src, ws);
    const srcWalk = walkNoFollow(src);
    const bad = srcWalk.files.filter((f) => !existsSync(join(ws, f.rel)) || sha256File(join(ws, f.rel)) !== sha256File(join(src, f.rel))).map((f) => f.rel);
    const libLink = join(ws, "node_modules", "@app", "lib");
    const linkOk = lstatSync(libLink).isSymbolicLink() && realpathSync(libLink).toLowerCase().startsWith(realpathSync(ws).toLowerCase())
      && readFileSync(join(libLink, "index.js"), "utf8") === readFileSync(join(ws, "packages", "lib", "index.js"), "utf8");
    const extOk = !lstatSync(join(ws, "node_modules", "ext")).isSymbolicLink() && readFileSync(join(ws, "node_modules", "ext", "index.js"), "utf8").includes("outside");
    const deepOk = existsSync(join(ws, relative(src, deep))) && join(src, relative(src, deep)).length > 260;
    removeWorkspace(ws);
    const intact = !existsSync(ws) && existsSync(join(src, "packages", "lib", "index.js")) && existsSync(join(outside, "ext", "index.js")) && existsSync(join(src, ".git", "objects", "01", "23456789"));
    const ok = !bad.length && linkOk && extOk && deepOk && intact && prep.gitHead === sha && prep.links.retargeted === 1 && prep.links.dereferenced === 1
      && prep.bytes > 0 && prep.copyMs >= 0 && ws.length < 24 && ws.startsWith(shortRootBase());
    record("D1", ok, `prepared dir → ${ws} (${ws.length} chars) via ${prep.method}: ${prep.files} files, ${prep.bytes} B, ${prep.copyMs} ms; links retargeted ${prep.links.retargeted}/dereferenced ${prep.links.dereferenced}; `
      + `${bad.length ? `MISMATCHED ${bad.slice(0, 3).join(", ")}` : "all files byte-identical"}; junction stays inside ws ${linkOk}; outside link copied ${extOk}; deep path ${deepOk}; .git HEAD ${prep.gitHead === sha}; cleanup left source intact ${intact}`);
  } catch (e) {
    removeWorkspace(ws);
    record("D1", false, `prepare threw: ${e.message}`);
  }
}

function d2(record, scratch) {
  const ws = join(scratch, "d2", "ws"), out = join(scratch, "d2", "out");
  rmSync(join(scratch, "d2"), { recursive: true, force: true });
  for (const f of ["src/a.js", "README.md", ".git/HEAD", ".git/objects/aa/bb", "dist/b.js", "node_modules/x/y.js", "pkg/node_modules/z.js", "var/cache.txt", "logs/run.log", ".git/objectsX/keep"]) put(join(ws, f), `// ${f}\n`);
  const exclude = ["node_modules", "dist", ".git/objects", "var", "*.log"];
  const st = copyTreeExcluding(ws, out, exclude);
  const got = walkNoFollow(out).files.map((f) => f.rel).sort();
  const want = [".git/HEAD", ".git/objectsX/keep", "README.md", "src/a.js"];
  const size = dirSize(out);
  const ex = makeExcluder(exclude);
  const unit = ex("a/b/node_modules/c") && ex(".git/objects/aa") && !ex(".git/objectsX") && ex("deep/x.log") && !ex("log.txt");
  record("D2", JSON.stringify(got) === JSON.stringify(want) && st.bytes === size.bytes && st.files === size.files && unit,
    `artifactExclude ${JSON.stringify(exclude)} → kept [${got.join(", ")}] (${st.excluded} excluded, ${size.files} files / ${size.bytes} B recorded); pattern unit checks ${unit}`);
}

async function d3(record, scratch) {
  const calls = {};
  const answer = (q, n) => {
    const script = { Q1: ["yes", "yes", "yes"], Q2: ["yes", "no", "junk", "no"], Q3: ["junk"] }[q];
    return script[Math.min(n, script.length - 1)];
  };
  let prompts = [];
  judgeHooks.ask = async ({ prompt }) => {
    prompts.push(prompt);
    const q = /QUESTION (Q\d)/.exec(prompt)[1];
    const n = (calls[q] = (calls[q] || 0) + 1) - 1;
    const a = answer(q, n);
    return a === "junk" ? { json: null, text: "not json", exit: 0 } : { json: { answer: a, reason: `${q} ${a}` }, text: "", exit: 0 };
  };
  try {
    const text = "## Findings\nRoot cause: add() subtracts. Literal $& and $1 must survive.";
    const questions = [{ id: "Q1", q: "Does it name the root cause?" }, { id: "Q2", q: "Does it cite a test?" }, { id: "Q3", q: "Is it signed?" }];
    const r = await judgeText({ text, file: "FINDINGS.md", questions, outDir: join(scratch, "d3"), log: () => {} });
    const v = r.verdicts;
    const onlyText = prompts.every((p) => p.includes("Literal $& and $1 must survive.") && !p.includes(scratch) && !/[A-Z]:\\/.test(p));
    prompts = [];
    const e = await judgeText({ text: "  \n", file: "FINDINGS.md", questions, outDir: join(scratch, "d3e"), log: () => {} });
    const ok = v.Q1.verdict === "yes" && v.Q2.verdict === "no" && v.Q2.attempts === 4 && v.Q3.verdict === "judge failed" && calls.Q3 === 9
      && onlyText && Object.values(e.verdicts).every((x) => x.verdict === "no" && x.method === "rule") && prompts.length === 0 && r.meta.votes === 3;
    record("D3", ok, `text judge: Q1 ${v.Q1.verdict} ${v.Q1.reasoning.match(/\[.*\]/)?.[0]}; Q2 ${v.Q2.verdict} after ${v.Q2.attempts} calls (1 bad vote retried); `
      + `Q3 ${v.Q3.verdict} after ${calls.Q3} calls; prompt holds only the text ${onlyText}; empty/missing file → all "no" with ${prompts.length} model calls`);
  } finally { judgeHooks.ask = null; }
}

function writeJsonl(p, events) { put(p, events.map((e) => JSON.stringify(e)).join("\n") + "\n"); return p; }

function d4(record, scratch) {
  const cwd = "C:\\tmp\\ws";
  const tu = (id, name, input) => ({ type: "assistant", message: { model: "m", id: `msg_${id}`, role: "assistant", content: [{ type: "tool_use", id, name, input }] }, session_id: "s" });
  const tr = (id, content) => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content }] }, session_id: "s" });
  const claude = writeJsonl(join(scratch, "d4", "claude.jsonl"), [
    { type: "system", subtype: "init", cwd, session_id: "s", model: "m", tools: ["Bash", "Write", "WebFetch", "WebSearch"] },
    tu("t1", "WebFetch", { url: "https://example.com/answers", prompt: "x" }),
    tu("t2", "Bash", { command: "curl -s https://registry.example.org/pkg | head" }),
    tu("t3", "Bash", { command: "curl http://localhost:3000/api/health" }),
    tu("t4", "Write", { file_path: `${cwd}\\app.js`, content: "await fetch('https://api.example.com/x')" }),
    tu("t5", "Bash", { command: "gh repo view someone/thing" }),
    tr("t5", "see https://github.com/chang47/AI-Benchmarks for the key"),
    // false positives seen in real runs (2026-09-28 calibration): must NOT be flagged
    tu("t6", "Bash", { command: 'node -e "http.get({ host: \\"127.0.0.1\\", port: 9366, path: p })"' }),
    tu("t7", "Bash", { command: 'grep -n "fetch(\\|XMLHttpRequest" src/*.js; grep -rn "http://\\|https://\\" src/' }),
    { type: "assistant", message: { model: "m", id: "msg_9", role: "assistant", content: [{ type: "text", text: "Maybe the ai-benchmark repo has it." }] }, session_id: "s" },
    { type: "result", subtype: "success", is_error: false, result: "done" },
  ]);
  const codex = writeJsonl(join(scratch, "d4", "codex.jsonl"), [
    { type: "thread.started", thread_id: "th" },
    { type: "item.completed", item: { id: "i1", type: "web_search", query: "bowling kata answer" } },
    { type: "item.completed", item: { id: "i2", type: "command_execution", command: "git clone https://github.com/x/y", aggregated_output: "", exit_code: 0, status: "completed" } },
    { type: "item.completed", item: { id: "i3", type: "command_execution", command: "Invoke-WebRequest http://127.0.0.1:5173/", aggregated_output: "", exit_code: 0, status: "completed" } },
    { type: "item.completed", item: { id: "i5", type: "command_execution", command: "node -e \"await fetch(`http://127.0.0.1:${port}/json`)\"", aggregated_output: "", exit_code: 0, status: "completed" } },
    { type: "item.completed", item: { id: "i4", type: "agent_message", text: "done" } },
  ]);
  const pi = writeJsonl(join(scratch, "d4", "pi.jsonl"), [
    { type: "session", id: "p", version: "0.85.0", cwd },
    { type: "message_end", message: { role: "assistant", provider: "zai", model: "glm", content: [{ type: "toolCall", id: "c1", name: "bash", arguments: { command: "npm view left-pad version && pip download requests" } }], usage: {} } },
    { type: "message_end", message: { role: "toolResult", toolCallId: "c1", toolName: "bash", content: [{ type: "text", text: "1.3.0" }] } },
  ]);
  const before = [claude, codex, pi].map(sha256File);
  const c = scanRaw(claude, "claude"), x = scanRaw(codex, "codex"), p = scanRaw(pi, "pi");
  const unchanged = [claude, codex, pi].every((f, i) => sha256File(f) === before[i]);
  const cats = (r) => r.flags.map((f) => `${f.kind}:${f.category}`).sort().join(",");
  const clean = ["claude-headless.jsonl", "claude-glm.jsonl", "codex.jsonl", "pi.jsonl"].map((f) => scanRaw(join(FIX, f)));
  const ok = cats(c) === "benchmark-reference:agent-authored,benchmark-reference:seen-in-tool-output,network-command:gh-cli,network-command:http-client,web-tool:web-tool"
    && c.loopbackRequests === 2 && JSON.stringify(c.webToolsInInit) === '["WebFetch","WebSearch"]'
    && cats(x) === "network-command:git-remote,web-tool:web-tool" && x.loopbackRequests === 2 && x.webToolsInInit === null
    && cats(p) === "network-command:package-registry" && p.flags[0].match.startsWith("npm view")
    && clean.every((r) => !r.flagged) && unchanged;
  record("D4", ok, `claude [${cats(c)}] loopback ${c.loopbackRequests}, init web tools ${JSON.stringify(c.webToolsInInit)}; codex [${cats(x)}]; pi [${cats(p)}]; `
    + `4 real fixtures clean: ${clean.every((r) => !r.flagged)}; fetch() in a written file, http.get to 127.0.0.1 and grep "fetch(" not flagged; raw.jsonl bytes unchanged ${unchanged}`);
}

function d5(record) {
  const clean = loadProfile("clean-room"), noWeb = loadProfile("no-web");
  const args = (h, profile) => HARNESSES[h].command({ model: h === "pi" ? "zai/glm-5.3" : "m", profile, prompt: "P" }).args;
  const hasSeq = (a, seq) => a.some((_, i) => seq.every((s, k) => a[i + k] === s));
  const claudeOk = hasSeq(args("claude", noWeb), ["--disallowed-tools", "WebSearch", "WebFetch"]) && !args("claude", clean).includes("--disallowed-tools");
  // claude-glm with the josh setup so the test never reads ~/.claude-glm secrets; the deny args are shared code.
  const glmOk = hasSeq(args("claude-glm", { ...noWeb, harnessSetup: "josh" }), ["--disallowed-tools", "WebSearch", "WebFetch"]);
  const cx = args("codex", noWeb), cxClean = args("codex", clean);
  const codexOk = hasSeq(cx, ["-c", 'web_search="disabled"']) && cx.at(-1) === "-" && !cxClean.some((s) => s.startsWith("web_search"));
  const piA = args("pi", noWeb);
  const piOk = hasSeq(piA, ["--exclude-tools", "WebSearch,WebFetch"]) && piA.at(-1) === "P" && !args("pi", clean).includes("--exclude-tools");
  const avail = [webToolsAvailable("claude", clean), webToolsAvailable("claude", noWeb), webToolsAvailable("claude-glm", noWeb), webToolsAvailable("codex", clean),
    webToolsAvailable("codex", noWeb), webToolsAvailable("pi", clean), webToolsAvailable("pi", loadProfile("josh"))];
  const availOk = JSON.stringify(avail) === JSON.stringify([true, false, false, true, false, false, null]);
  const forced = applyTaskToolPolicy(clean, { denyWebTools: true });
  const policyOk = forced.tools.deny.join() === "WebFetch,WebSearch" && applyTaskToolPolicy(clean, {}) === clean && clean.tools.deny.length === 0;
  record("D5", claudeOk && glmOk && codexOk && piOk && availOk && policyOk,
    `no-web deny → claude ${claudeOk}, claude-glm ${glmOk}, codex -c web_search="disabled" ${codexOk}, pi --exclude-tools ${piOk}; clean-room args unchanged; `
    + `webToolsAvailable ${JSON.stringify(avail)}; bench.json denyWebTools forces deny ${policyOk}`);
}

function d7(record, scratch) {
  const r = spawnSync(process.execPath, [join(ROOT, "bench", "checks", "selftest-services.mjs"), join(scratch, "d7")], { encoding: "utf8", windowsHide: true, timeout: 5 * 60_000 });
  let s = null;
  try { s = JSON.parse(r.stdout.trim().split("\n").pop()); } catch { /* crashed */ }
  if (!s) return record("D7", false, `services worker crashed (exit ${r.status}): ${(r.stderr || r.stdout || "").slice(-600)}`);
  record("D7", s.ok, s.evidence);
}

function d6(record, scratch) {
  const r = spawnSync(process.execPath, [join(ROOT, "bench", "checks", "selftest-e2e.mjs"), join(scratch, "d6")], { encoding: "utf8", windowsHide: true, timeout: 5 * 60_000 });
  let s = null;
  try { s = JSON.parse(r.stdout.trim().split("\n").pop()); } catch { /* crashed */ }
  if (!s) return record("D6", false, `e2e worker crashed (exit ${r.status}): ${(r.stderr || r.stdout || "").slice(-600)}`);
  record("D6", s.ok, s.evidence);
}

export async function harnessSelfTests(record) {
  const scratch = join(tmpdir(), "vbench-selftest");
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  d1(record, scratch);
  d2(record, scratch);
  await d3(record, scratch);
  d4(record, scratch);
  d5(record);
  d6(record, scratch);
  d7(record, scratch);
  rmSync(scratch, { recursive: true, force: true });
}
