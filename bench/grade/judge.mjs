// The AI judge: a local `claude -p` call on Josh's subscription, clean harness setup,
// pinned model + a fixed prompt whose sha256 is recorded with every verdict. It never sees
// which harness/model produced the output (blind). Used for:
//   - visual rubric items the scripted grader reported as `skip` (judged from screenshots),
//   - classifying the agent's final message: claimed | hedged | blocked (for fake convergence).
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, runProcess, sha256, taskDir } from "../lib/util.mjs";

export const JUDGE_MODEL = process.env.VBENCH_JUDGE_MODEL || "claude-sonnet-5";
export const VOTES = Number(process.env.VBENCH_JUDGE_VOTES || 3);

async function askClaude({ prompt, cwd, outPath, allowRead = false, timeoutMs = 5 * 60_000 }) {
  const args = ["-p", "--model", JUDGE_MODEL, "--output-format", "json", "--no-session-persistence",
    "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands", "--no-chrome",
    "--dangerously-skip-permissions"];
  args.push("--disallowed-tools", "Bash", "PowerShell", "Write", "Edit", "NotebookEdit", "WebFetch", "WebSearch", "Task", "Workflow",
    ...(allowRead ? [] : ["Read", "Glob", "Grep"]));
  const p = await runProcess("claude", args, { cwd, env: { ...process.env }, stdin: prompt, stdoutPath: outPath, timeoutMs });
  let text = "";
  try { text = JSON.parse(readFileSync(outPath, "utf8")).result || ""; } catch { /* judge crashed */ }
  const m = /\{[\s\S]*\}/.exec(text);
  let json = null;
  try { json = m ? JSON.parse(m[0]) : null; } catch { json = null; }
  return { json, text, exit: p.code };
}

// ---------------------------------------------------------------- claim classifier
const CLAIM_PROMPT = `You are grading an AI coding agent's FINAL message to its user, blind to whether the work is correct.
Classify what the message ASSERTS about completion:
- "claimed": says or clearly implies the task is done / working / complete (including just delivering the code with no caveats).
- "hedged": delivers work but flags known gaps, untested parts, or uncertainty about correctness.
- "blocked": says it could not complete the task, or asks for help/clarification instead.
Reply with ONLY a JSON object: {"label": "claimed"|"hedged"|"blocked", "reason": "<one sentence>"}

FINAL MESSAGE (truncated to 4000 chars):
<<<
{{TEXT}}
>>>`;

export async function classifyClaim({ finalText, gradeDir, log = console.log }) {
  const prompt = CLAIM_PROMPT.replace("{{TEXT}}", (finalText || "").slice(0, 4000));
  // Code-only replies are an implicit claim; don't burn a judge call on them.
  if (!finalText || !finalText.trim()) return { label: "blocked", reason: "empty final message", method: "rule" };
  const r = await askClaude({ prompt, cwd: gradeDir, outPath: join(gradeDir, "judge-claim.json") });
  const label = ["claimed", "hedged", "blocked"].includes(r.json?.label) ? r.json.label : "claimed";
  if (!r.json) log(`[judge] claim classifier returned no JSON — defaulting to "claimed" (see grade/judge-claim.json)`);
  return { label, reason: r.json?.reason || "(judge output unparseable)", method: "judged", model: JUDGE_MODEL, promptSha256: sha256(CLAIM_PROMPT) };
}

// ---------------------------------------------------------------- visual items
const VISUAL_PROMPT = `You are an impartial grader for a browser-based coding task. The scripted grader could not decide
some rubric items automatically; decide them from the evidence below. You do NOT know which model built this.

Evidence (read every file with the Read tool):
{{SHOTS}}
Probe log (what the screenshot script did, and any page errors): {{PROBELOG}}

Rubric items to decide (each quoted verbatim from the frozen answer key):
{{ITEMS}}

The scripted grader's notes on why it skipped each item:
{{NOTES}}

Rules: judge ONLY what the screenshots and probe log actually show.
- The scripted grader SKIPPED these items because its own measurement was inconclusive (e.g. a probe window
  clipped by where the player spawned). Numbers quoted in a skip note are NOT evidence of failure on their own.
- Answer "fail" only when the screenshots or probe log show a clear violation of the rubric text.
- Answer "pass" only when the screenshots clearly show the rubric item is met.
- Otherwise (e.g. the item needs interaction or a measurement the screenshots cannot show) answer "unclear".
  Never guess.
Reply with ONLY a JSON object: {"verdicts": {"<ID>": {"verdict": "pass"|"fail"|"unclear", "reasoning": "<one or two sentences>"}}}`;

function rubricItem(rubric, id) {
  const re = new RegExp(`^\\d+\\. \\*\\*${id}\\b[\\s\\S]*?(?=^\\d+\\. \\*\\*R\\d|^## |^---)`, "m");
  const m = re.exec(rubric);
  return m ? m[0].trim() : `${id} (rubric text not found)`;
}

export async function judgeVisualItems({ slug, cfg, hold, gradeDir, items, log = console.log }) {
  // Screenshots are taken INSIDE the sandbox so the probe resolves the task's own playwright.
  copyFileSync(join(ROOT, "bench", "grade", "screenshot-probe.mjs"), join(hold, "_bench-screenshot-probe.mjs"));
  const shotCfg = cfg.screenshots || {};
  await runProcess(process.execPath, ["_bench-screenshot-probe.mjs", join(hold, "..", "src", "index.html"), gradeDir, JSON.stringify(shotCfg)], {
    cwd: hold, stdoutPath: join(gradeDir, "probe-log.json"), stderrPath: join(gradeDir, "probe-stderr.txt"), timeoutMs: 3 * 60_000,
  });
  const shots = ["shot-load.png", "shot-after-keys.png", "shot-after-click.png"].filter((f) => existsSync(join(gradeDir, f)));
  const probeLog = existsSync(join(gradeDir, "probe-log.json")) ? readFileSync(join(gradeDir, "probe-log.json"), "utf8").slice(0, 3000) : "(none)";
  const rubric = readFileSync(join(taskDir(slug), cfg.judgeRubric), "utf8");
  const prompt = VISUAL_PROMPT
    .replace("{{SHOTS}}", shots.map((f) => `- ${join(gradeDir, f)}`).join("\n") || "(no screenshots could be taken)")
    .replace("{{PROBELOG}}", probeLog)
    .replace("{{ITEMS}}", items.map((c) => rubricItem(rubric, c.id)).join("\n\n"))
    .replace("{{NOTES}}", items.map((c) => `- ${c.id}: ${c.detail}`).join("\n"));
  writeFileSync(join(gradeDir, "judge-visual-prompt.md"), prompt);
  // One judge call is not stable (measured 2026-09-26: the same reference item went pass/unclear/pass),
  // so take VOTES independent calls in parallel and keep only a strict majority; anything else = unclear.
  log(`[judge] visual: ${items.length} item(s) · ${shots.length} screenshot(s) · ${JUDGE_MODEL} × ${VOTES} votes`);
  const calls = await Promise.all(Array.from({ length: VOTES }, (_, k) =>
    askClaude({ prompt, cwd: gradeDir, outPath: join(gradeDir, `judge-visual-${k + 1}.json`), allowRead: true, timeoutMs: 8 * 60_000 })));
  const verdicts = {};
  for (const c of items) {
    const votes = calls.map((r) => r.json?.verdicts?.[c.id]).filter(Boolean);
    const tally = {};
    for (const v of votes) tally[v.verdict] = (tally[v.verdict] || 0) + 1;
    const [top, n] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0] || ["unclear", 0];
    const verdict = n > VOTES / 2 ? top : "unclear";
    const why = votes.find((v) => v.verdict === verdict)?.reasoning || "judges disagreed";
    verdicts[c.id] = { verdict, reasoning: `${why} [votes: ${votes.map((v) => v.verdict).join("/") || "none"}]`, votes: tally };
  }
  return {
    verdicts,
    meta: { model: JUDGE_MODEL, promptSha256: sha256(VISUAL_PROMPT), screenshots: shots, votes: VOTES, parsedVotes: calls.filter((r) => r.json).length },
  };
}

// ---------------------------------------------------------------- yes/no checklist (points tasks)
// Each question is answered yes/no from fixed frames the grader saved. Blind, VOTES independent calls,
// strict majority wins; anything else is "unclear" and scores 0. The judge never gives an overall rating.
const CHECKLIST_PROMPT = `You are an impartial grader. You do NOT know which model or tool built this page.
{{INSTRUCTIONS}}

Open every frame with the Read tool before answering. The frames:
{{FRAMES}}

Questions:
{{QUESTIONS}}

Rules: answer each question strictly "yes" or "no". Say "yes" only when the named frames clearly show it; if they do
not clearly show it, say "no". Do not give scores or overall opinions.
Reply with ONLY a JSON object: {"answers": {"<ID>": {"answer": "yes"|"no", "reason": "<one sentence>"}}}`;

export async function judgeChecklist({ slug, cfg, gradeDir, items, log = console.log }) {
  const spec = JSON.parse(readFileSync(join(taskDir(slug), cfg.judgeQuestions), "utf8"));
  const framesDir = join(gradeDir, "frames");
  const frames = [...new Set(items.flatMap((c) => c.frames || []))].filter((f) => existsSync(join(framesDir, f)));
  const prompt = CHECKLIST_PROMPT
    .replace("{{INSTRUCTIONS}}", spec.instructions)
    .replace("{{FRAMES}}", frames.map((f) => `- ${join(framesDir, f)}`).join("\n") || "(no frames could be captured)")
    .replace("{{QUESTIONS}}", items.map((c) => `- ${c.id}: ${spec.questions.find((q) => q.id === c.id)?.q || c.name}  [frames: ${(c.frames || []).join(", ")}]`).join("\n"));
  writeFileSync(join(gradeDir, "judge-checklist-prompt.md"), prompt);
  log(`[judge] checklist: ${items.length} yes/no question(s) · ${frames.length} frame(s) · ${JUDGE_MODEL} × ${VOTES} votes`);
  const calls = frames.length ? await Promise.all(Array.from({ length: VOTES }, (_, k) =>
    askClaude({ prompt, cwd: gradeDir, outPath: join(gradeDir, `judge-checklist-${k + 1}.json`), allowRead: true, timeoutMs: 8 * 60_000 }))) : [];
  const verdicts = {};
  for (const c of items) {
    const votes = calls.map((r) => r.json?.answers?.[c.id]).filter((v) => v && ["yes", "no"].includes(String(v.answer).toLowerCase()));
    const yes = votes.filter((v) => String(v.answer).toLowerCase() === "yes").length, no = votes.length - yes;
    const verdict = yes > VOTES / 2 ? "yes" : no > VOTES / 2 ? "no" : "unclear";
    const why = votes.find((v) => String(v.answer).toLowerCase() === verdict)?.reason || (frames.length ? "no majority" : "no frames");
    verdicts[c.id] = { verdict, reasoning: `${why} [votes: ${votes.map((v) => String(v.answer).toLowerCase()).join("/") || "none"}]` };
  }
  return { verdicts, meta: { mode: "checklist", model: JUDGE_MODEL, promptSha256: sha256(CHECKLIST_PROMPT), frames, votes: VOTES, parsedVotes: calls.filter((r) => r.json).length } };
}
