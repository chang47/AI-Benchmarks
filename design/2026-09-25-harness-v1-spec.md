# Vetted Bench harness v1: runner, grader, report (spec)

_Created 2026-09-25. Status: DRAFT, awaiting Josh's review. Covers steps 1-3 of the build order._
_Implements "Phase 2 — a Harness" from `2026-07-11-vetted-bench-design.md`. The task format is the contract; no frozen file changes._

## Why

The bench has 17 frozen tasks with trusted graders, but nothing that runs a model:
- runs were started by hand from a chat session;
- the model used is recorded only in prose;
- no agent transcript was saved (the July runs are gone from `~/.claude/projects`);
- tokens, cost and time were never recorded;
- every task ran once (n=1).

So "16/16 PASS" can be neither replayed nor compared across models. v1 builds the machine:
**run task × model, n times → save everything → grade it → show it as a static HTML report.**

## Goals

1. **One command** runs a task against a model and saves the full trajectory, the artifacts and the metrics.
2. **One command** grades a run against the task's frozen answer key and writes a normalized result.
3. **One command** builds a static HTML report:
   - a model × task grid;
   - one page per run with a readable trajectory viewer.
4. Every number in the report traces to a file in `runs/<id>/` (anti-fabrication).

## Non-goals (v1)

- AI judge for visual rubric items. Those items are reported as `judge-pending`, not scored.
- Context-flooding and other experimental conditions. The `condition` field exists; only `baseline` is implemented.
- Non-Claude adapters (Codex, OpenRouter, Ollama). The adapter interface exists; only `claude-cli` ships. `claude-glm` is a stretch goal, since it is the same CLI with different env.
- Hosting and sharing (Cloudflare). The report is static files, so hosting is a later drop-in.
- Statistics beyond k/n pass rate and medians.

## Architecture

```
bench/                      new, plain Node ESM (.mjs), no build step, matches the repo
  cli.mjs                   bench run | grade | report | ls
  adapters/claude-cli.mjs   spawn `claude -p ... --output-format stream-json`
  run.mjs                   workspace setup → adapter → collect artifacts → meta
  grade.mjs                 sandbox → task grader → normalized result.json
  trajectory.mjs            stream-json → normalized steps (+ context growth, ported from CtxMap)
  report/                   build.mjs + template.html + style.css (vanilla JS, inline SVG charts)
tasks/<slug>/bench.json     NEW per-task harness config (sits beside the frozen files, not inside holdout/)
runs/<run-id>/              one folder per run (see "Run folder")
reports/site/               generated static report
```

Run id format: `<yyyymmdd-hhmmss>-<task#>-<model-alias>-<rand4>`, e.g. `20260925-141200-07-opus48-a1f3`.

### Per-task config: `tasks/<slug>/bench.json`

This is new and not frozen. It tells the harness what to collect and how to grade.

```json
{
  "artifacts": ["src/bowling.mjs"],
  "grader": { "kind": "vitest", "cwd": "holdout", "cmd": "npx vitest run --reporter=json" },
  "judgeItems": []
}
```

`kind` is one of `vitest` | `node-script` (e.g. `autochecks.mjs`, `verify-reference.mjs`) | `custom`. Each kind has a parser that turns the grader's output into the normalized result.

The v1 pilot needs `bench.json` for **07-bowling** (vitest) and **17-budget-dashboard** (`holdout/verify-reference.mjs`). Other tasks are added as they are wired.

## Step 1: Runner

`node bench/cli.mjs run --task 07 --model claude-opus-4-8 [--n 3] [--condition baseline] [--budget-usd 5]`

For each of the n attempts:

1. **Isolated workspace.**
   - Created in `os.tmpdir()/vbench/<run-id>/`, **outside the repo**, so the agent cannot `ls ..` its way to `holdout/`, the reference `src/`, or other runs.
   - It is empty except a `src/` dir when the artifact contract needs it.
2. **Prompt.** `tasks/<slug>/frozen-prompt.md`, verbatim, piped on stdin. Its sha256 is recorded in `meta.json`.
3. **Spawn** (`adapters/claude-cli.mjs`):
   ```
   claude -p --model <model> --output-format stream-json --verbose
          --bare --no-session-persistence
          --dangerously-skip-permissions
          --disallowed-tools WebSearch WebFetch
          --max-budget-usd <budget>
   ```
   - cwd is the workspace. stdout goes straight to `runs/<id>/trajectory.jsonl`; stderr goes to `stderr.log`.
   - `--bare` keeps Josh's global CLAUDE.md, hooks and skills from contaminating the baseline. Adding that setup back is a future `condition: "josh-harness"`, which is the "harness outlives the model" axis.
   - Web tools are off so the agent can't look up the answer key (contamination).
   - Wall-clock timeout: default 30 min, then kill and mark `status: "timeout"`.
4. **Collect artifacts.** Copy each path in `bench.json.artifacts` from the workspace to `runs/<id>/output/`. Also save a full file listing of the workspace (`workspace-files.txt`). A missing artifact means `status: "no-artifact"`.
5. **Write `meta.json`.**
   ```json
   {
     "runId": "…", "task": "07-bowling", "model": "claude-opus-4-8", "adapter": "claude-cli",
     "condition": "baseline", "attempt": 1, "of": 3, "startedAt": "…", "endedAt": "…",
     "status": "ok|timeout|error|no-artifact|budget-exceeded",
     "promptSha256": "…", "cliVersion": "…", "flags": ["…"],
     "metrics": {
       "costUsd": 0, "durationMs": 0, "numTurns": 0,
       "inputTokens": 0, "outputTokens": 0, "cacheReadTokens": 0, "cacheCreationTokens": 0,
       "peakContextTokens": 0, "toolCalls": { "Write": 0, "Bash": 0 },
       "claimedDone": true
     }
   }
   ```
   - `costUsd`, `durationMs`, `numTurns` and the token totals come from the stream-json final `result` event.
   - `peakContextTokens` and `toolCalls` are derived by `trajectory.mjs`.
   - `claimedDone` is true when the session ended normally (`is_error:false`), the agent did not report being blocked, and the artifact exists. Combined with a failing grade, this is **fake convergence**.
   - **Cost caveat:** on a Max subscription `costUsd` is the CLI's API-equivalent estimate, not money billed. The report labels it as such.
6. Clean up the tmp workspace after the artifacts are copied. Pass `--keep` to skip cleanup.

### Run folder

```
runs/<run-id>/
  meta.json          model, task, condition, status, metrics
  trajectory.jsonl   raw stream-json, byte-for-byte what the CLI emitted
  stderr.log
  output/            collected artifacts
  workspace-files.txt
  grade/             written by step 2 (sandbox + grader raw output)
  result.json        written by step 2
```

The committed default: `runs/*/trajectory.jsonl` and `runs/*/grade/` are **gitignored** (large and regenerable-ish); `meta.json`, `result.json` and `output/` are committed. Open question Q3 below.

### Step 1 acceptance (falsifiable)

- A1. `bench run --task 07 --model <any claude model> --n 1` produces a run folder with all of: non-empty `trajectory.jsonl`, `output/bowling.mjs`, and a `meta.json` with no null metrics.
- A2. `meta.metrics.costUsd`, `numTurns` and `durationMs` equal the values in the trajectory's `result` event (checked by a script, not by eye).
- A3. The agent's trajectory shows no reads outside the workspace. Grep the tool inputs for the repo path: 0 hits.
- A4. With `--model` set to two different models, `meta.model` and the stream-json `system/init` model field agree for each run.

## Step 2: Grader

`node bench/cli.mjs grade <run-id|--all-ungraded>`

1. **Tamper check.** Re-hash every file in `tasks/<slug>/holdout/` against `FREEZE_MANIFEST.json`. A mismatch aborts with `status: "tamper"`, and nothing is graded.
2. **Sandbox that mirrors the task layout.**
   - The frozen graders import the candidate by relative path (`../../src/bowling.mjs`, `../src/index.html`). The harness builds `runs/<id>/grade/` as `holdout/` (a copy, including its `node_modules`) + `src/` (the run's `output/`).
   - The frozen suites then run **unmodified** against the candidate.
   - The task's reference `src/` is never copied in.
3. **Run the grader** from `bench.json.grader`, in the sandbox, with a 10-min timeout. Raw stdout and stderr go to `grade/grader-output.*`.
4. **Normalize to `result.json`.**
   ```json
   {
     "runId": "…", "gradedAt": "…", "graderKind": "vitest", "tamperCheck": "ok",
     "passed": 31, "total": 31, "passRate": 1.0, "allPass": true,
     "checks": [{ "id": "…", "name": "…", "pass": true, "detail": "…" }],
     "judgePending": [],
     "fakeConvergence": false
   }
   ```
   `fakeConvergence = meta.metrics.claimedDone && !allPass`.

### Step 2 acceptance

- B1. **Reference sanity.** Grading the task's own reference `src/` (via `bench grade --reference 07`) gives `allPass: true`, with 31/31 for bowling. This matches the counts already recorded in VERIFY.md.
- B2. **Negative control.** A deliberately broken candidate (one scoring rule flipped) is graded `allPass:false`, with the failing checks listed by name.
- B3. **Tamper control.** Editing one byte of a holdout copy in `tasks/` makes grading abort with `tamper`; revert afterwards. It must be run in a scratch copy, never on the frozen tree.
- B4. Task 17's reference grades 8/8, and its existing `raw-lane/attempt-1-realistic` build grades **7/8, failing V6**. That reproduces the on-disk `verify-result.json`.

## Step 3: HTML report

`node bench/cli.mjs report` → `reports/site/` (static; open `index.html` from disk, no server).

**Index page: the scoreboard.**
- Grid with rows = task and columns = model (× condition).
- Each cell shows `k/n passed`, median cost, and median time. It is colored by pass rate and clickable through to that cell's runs.
- A fake-convergence count is shown per model.
- A totals row per model.
- A footnote with the cost caveat, the CLI version, and the date range.

**Run page: `run/<id>.html`.**
- **Header.** Model, task, condition, status, the grade (k/n, with failing checks named), fake-convergence badge, cost, time, turns, and peak context.
- **Trajectory viewer.** A vertical timeline of normalized steps from `trajectory.mjs`:
  - `user` (prompt, collapsed by default, since it is the frozen prompt)
  - `assistant-text`
  - `thinking` (if present, collapsed)
  - `tool-call` (tool name + a one-line summary, e.g. `Write src/bowling.mjs (4.1 KB)`; expands to the full input)
  - `tool-result` (truncated to 2 KB, expandable; errors in red)
  - `result` (final)
- **Context-growth strip.** A context-tokens line chart across steps in inline SVG, with CtxMap's 🔥 markers for steps that add more than 5K tokens. Clicking a point scrolls to that step.
- **Artifacts panel.** A listing of `output/`. For HTML artifacts there is an `<iframe sandbox>` preview. For code, syntax-highlighted source (highlight.js from cdnjs).
- **Grade panel.** Every check with pass/fail, plus the `judgePending` items listed separately and labelled "not scored in v1".

**Redaction.** Any absolute path under the user's home is rewritten to `~` before it is written into HTML. This prepares for public sharing later.

**Source of truth.** The report reads only `runs/*/meta.json`, `result.json`, `trajectory.jsonl` and `output/`. It holds no numbers of its own.

### `trajectory.mjs` and CtxMap

- **Parser: new, about 150 lines.** It handles the stream-json event types `system/init`, `assistant` (text, thinking and tool_use blocks, all kept), `user` (tool_result), and `result`. CtxMap's parser can't be reused as-is: it drops sidechains, keeps one tool call per message, discards assistant text, and has no `result`/`init` events.
- **Ported from CtxMap** (`src/core/attribution.ts`): the context-tokens-per-turn formula (`input + cache_creation + cache_read`), the per-step delta, and the 🔥/⚠️ thresholds. They are copied with a source comment, not imported, so the bench keeps no TS/build dependency.

### Step 3 acceptance

- C1. After a step 1-2 run, `index.html` shows one cell whose k/n, cost and time equal that run's `result.json` / `meta.json`. This is checked by a script that parses the HTML against the JSON.
- C2. The run page shows every `tool_use` in the trajectory: the count of rendered tool-call steps equals the count of `tool_use` blocks in `trajectory.jsonl`.
- C3. **Visual check.** Open it with Playwright at 1440px and 390px wide, take screenshots, and look at them. Zero console errors. No horizontal scroll at 390px.
- C4. A grep of the built site for `C:\Users` / `/Users/` / the username finds nothing.

## Pilot (proof that steps 1-3 work end to end)

- **Tasks:** `07-bowling` (logic, vitest) and `17-budget-dashboard` (logic + visual, the one task with a real miss so far).
- **Models:** 2-3 Claude generations. **n=3 each**, for 12-18 runs total, with a per-run budget cap of $5.
- **Pass criterion:** the report renders the grid and every run page; and every run passes A1-A4, B1-B4 and C1-C4.

The pilot does **not** need a model to fail. Showing flat results honestly is fine. The point is the infrastructure.

## Open questions for Josh

- Q1. **Which models go in the pilot grid?** Proposal: Opus 5.5 vs Opus 4.8 vs Sonnet 5, plus Haiku 4.5 as the likely-to-fail baseline. The availability of older IDs via `--model` gets verified in step 1.
- Q2. **Billing.** Should runs use the Max subscription (free at the margin, cost shown as an estimate) or an API key (real spend)? `--bare` may require an API key; to be verified in step 1. If it does, the fallback is `--setting-sources ""` plus an empty `--system-prompt`, or a clean `CLAUDE_CONFIG_DIR`.
- Q3. **Commit raw trajectories?** It makes the report reproducible from a clone, but each is roughly 100-500 KB. The default is gitignored (see above).
- Q4. **`claimedDone` heuristic.** Is "exited normally + artifact exists" good enough, or should the agent's final message be classified as claiming done vs hedging? That classification would be an AI judge, deferred.

## Build order and checks

1. Step 1 on task 07 → A1-A4
2. Step 2 → B1-B4
3. Step 3 → C1-C4
4. Pilot grid

Each step lands on master when its acceptance checks pass. The repo has no `check:all` yet. v1 adds `npm run check` at the root, running the B1 reference sanity for every wired task plus a C1 consistency check. That is the regression gate: the graders still agree with the frozen answer keys.
