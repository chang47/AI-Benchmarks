# Vetted Bench harness v1 — runner, grader, report (spec)

_Created 2026-09-25 · rev 2 (Josh's answers folded in) · Status: DRAFT → ready to build step 1._
_Implements "Phase 2 — a Harness" from `2026-07-11-vetted-bench-design.md`. Task format is the contract; no frozen file changes._

## Why

The bench has 17 frozen tasks with trusted graders, but nothing that runs a model:
- runs were started by hand from a chat session;
- the model used is recorded only in prose;
- no agent transcript was saved (the July runs are gone);
- tokens, cost and time were never recorded;
- every task ran once (n=1).

v1 builds the machine: **run (task × harness × model × condition), n times → save everything → grade → render.**

## Principles (from Josh, 2026-09-25)

1. **Harness-agnostic.** The unit under test is **harness + model**, not model alone.
   - We support every harness we pay for, and we know how to set each one up reproducibly.
   - Three harnesses today: Claude Code (incl. `claude-glm`), Codex CLI, and pi (multi-provider).
2. **Subscriptions only.** There are no API keys, so cost is never "money billed".
   - **Tokens + wall-clock are the primary cost metrics.**
   - `$` is shown only where a harness reports an API-equivalent estimate, and it is labelled as an estimate.
3. **Every run produces an artifact.**
   - The task (or the skill under test) must ask for an output: a file, JSON, a diff/commit, or an image.
   - Grading is deterministic where possible, and an AI judge (run locally on the subscription) where not.
4. **Isolation and tool limits are per-experiment options, not hard rules.**
   - A clean-room benchmark task runs outside the repo.
   - A "skill on our own repo" experiment runs inside a worktree, where reading the repo is the point.
   - Tools are unrestricted by default.
5. **The answer key is frozen and durable.** Keep the sha256 manifest check — it's cheap and it's what makes a result trustworthy.
6. **Raw is the source of truth; everything else is re-derivable.**
   - Store the raw harness output untouched.
   - Parse it into a normalized form with a versioned parser.
   - Render from the normalized form.

## Architecture

```
bench/                          plain Node ESM (.mjs), no build step (matches repo)
  cli.mjs                       bench run | grade | report | view | ls
  harnesses/                    one adapter per harness (see "Harness adapters")
    claude.mjs                  claude / claude-glm   (stream-json)
    codex.mjs                   codex exec --json     (JSONL events)
    pi.mjs                      pi -p --mode json     (JSON events)
  trajectory/
    schema.md                   the normalized Step schema (versioned)
    parse-claude.mjs            raw → steps.json      (one parser per raw format)
    parse-codex.mjs
    parse-pi.mjs
    context.mjs                 context-growth math, ported from CtxMap attribution.ts
  grade/
    grade.mjs                   sandbox + tamper check + dispatch
    kinds/{tests,json-equiv,judge-text,judge-visual,diff}.mjs
  render/                       static HTML renderer (vanilla JS, inline SVG)
  profiles/                     experiment profiles (see "Profiles")
tasks/<slug>/bench.json         per-task harness config (new, sits beside frozen files)
runs/<run-id>/                  one folder per run
reports/site/                   generated scoreboard
```

### Harness adapters (the harness-agnostic contract)

Each adapter exports:

```js
{
  id,                                    // "claude" | "claude-glm" | "codex" | "pi"
  setup(profile),                        // how to make this harness reproducible
  command({ model, workspace, prompt, profile }),  // → argv + env
  rawFormat,                             // which parser reads its stdout
  version(),                             // CLI version, for meta.json
}
```

Verified CLI surfaces (2026-09-25):

| Harness | Headless invocation | Raw output | Model flag | Notes |
|---|---|---|---|---|
| Claude Code | `claude -p --output-format stream-json --verbose` | stream-json | `--model` | the final `result` event carries cost estimate, duration, turns, usage |
| claude-glm | same, via `~/.local/bin/claude-glm` | stream-json | `--model` | the wrapper just sets `CLAUDE_CONFIG_DIR=~/.claude-glm` — reuse the Claude adapter with that env |
| Codex CLI | `codex exec --json -C <dir> --skip-git-repo-check --ephemeral` | JSONL events | `-m` | `--output-schema` can force a JSON final answer; sandbox via `-s` |
| pi | `pi -p --mode json --no-session` | JSON events | `--provider` / `--model provider/id` | `--skill <path>` loads a skill directly; `--tools`/`--exclude-tools`; `--thinking` |

- **Clean baseline without API keys.** `claude --bare` may refuse subscription auth. The same `CLAUDE_CONFIG_DIR` trick claude-glm already uses solves it: a dedicated config dir per profile (e.g. `~/.vbench/claude-clean/`, logged in once, no CLAUDE.md, hooks or skills). The harness's own default stays the "clean" condition. Verified in step 1.
- **One harness, many models.** pi can run all three vendors under the same harness. That's the controlled "same harness, different model" arm. The native harnesses give "each model in its home harness".

### Profiles (experiment options, not hard-coded rules)

`bench/profiles/<name>.json` bundles the knobs. A run records the full resolved profile in `meta.json`.

```json
{
  "name": "clean-room",
  "isolation": "tmp",
  "harnessSetup": "clean",
  "tools": { "allow": null, "deny": [] },
  "skill": null,
  "contextPrefill": null,
  "timeoutMin": 30
}
```

- `isolation`:
  - `tmp` — empty dir outside the repo; the default for bench tasks, so the agent can't wander into `holdout/`.
  - `worktree:<repo>@<ref>` — a git worktree of a real repo, for "test a skill on our own code".
- `harnessSetup`: `clean` (bare config dir) | `josh` (your real setup: CLAUDE.md, skills, hooks). This is the "harness outlives the model" axis.
- `skill`: path to a skill file under test. pi uses `--skill`; Claude uses `--append-system-prompt-file` or a plugin dir; Codex uses AGENTS.md in the workspace.
- `contextPrefill`: reserved for the context-flooding experiment (v2). The field exists; v1 ignores it.
- Tools unrestricted by default; `deny: ["WebSearch","WebFetch"]` is available when contamination matters.

## Step 1 — Runner

`bench run --task 07 --harness claude --model claude-opus-4-8 --profile clean-room --n 3`

For each attempt:
1. **Build the workspace** per `profile.isolation`.
2. **Prompt.** Pipe in `frozen-prompt.md` verbatim (plus the skill, if the profile has one). Record `promptSha256`.
3. **Spawn** the adapter command. Stream stdout **untouched** to `runs/<id>/raw.jsonl`, and stderr to `stderr.log`. Apply the wall-clock timeout.
4. **Collect artifacts.** Copy `bench.json.artifacts` into `runs/<id>/output/`, and write a full listing to `workspace-files.txt`. For worktree isolation, also capture `git diff` as `output/changes.diff`.
5. **Parse** `raw.jsonl` with the adapter's parser, writing `steps.json` (normalized) and `meta.json`.
6. Clean up the tmp workspace. `--keep` skips cleanup.

**`meta.json`**

```json
{
  "runId": "…", "task": "07-bowling",
  "harness": "claude", "harnessVersion": "…", "model": "claude-opus-4-8", "modelReported": "…",
  "profile": { "…resolved…" }, "attempt": 1, "of": 3,
  "startedAt": "…", "endedAt": "…",
  "status": "ok|timeout|error|no-artifact",
  "promptSha256": "…", "parserVersion": "claude@1",
  "metrics": {
    "durationMs": 0, "numTurns": 0,
    "inputTokens": 0, "outputTokens": 0, "cacheReadTokens": 0, "cacheCreationTokens": 0,
    "peakContextTokens": 0, "toolCalls": { "Write": 0 },
    "costUsdEstimate": null,
    "artifactProduced": true
  }
}
```

- `modelReported` is what the harness says it actually ran. A mismatch with `model` is flagged.
- Each metric is `null` when a harness doesn't report it. Nulls are never filled with a guess (anti-fabrication).

**Step 1 acceptance**
- A1. Task 07 × {claude, codex, pi} × 1 model each produces, for every run: `raw.jsonl`, `steps.json`, `output/bowling.mjs`, and `meta.json`.
- A2. A script confirms that `meta.metrics` equals the numbers in each raw file's final/usage events. Harness-reported values only.
- A3. `modelReported` matches the requested model for every run.
- A4. With the `clean` setup, the raw transcript shows no CLAUDE.md, skills or hook content loaded (checked against the init event's tool/skill list).

## Step 2 — Grader

`bench grade <run-id|--ungraded>`

1. **Tamper check.** Re-hash `tasks/<slug>/holdout/` against `FREEZE_MANIFEST.json`. A mismatch means `status:"tamper"`, and the run is not graded.
2. **Sandbox that mirrors the task layout.** `runs/<id>/grade/` = a copy of `holdout/` + the run's `output/` as `src/`. The frozen graders import `../src/…` / `../../src/…`, so they run **unmodified**. The reference `src/` is never copied in.
3. **Grading ladder.** `bench.json.grader.kind` picks the most deterministic rung that fits the task:

| kind | when | how |
|---|---|---|
| `tests` | logic tasks with a suite (07–11, 01–03) | vitest / node script → per-check pass/fail |
| `script` | Playwright checks (12–17 autochecks, verify-reference) | the existing scripts → normalized |
| `json-equiv` | the output is structured data | deterministic deep-compare against `expected.json`; on mismatch, an AI judge decides *semantic* equivalence and says why |
| `judge-text` | prose / open-ended output | the AI judge compares expected vs actual against a rubric |
| `judge-visual` | games, 3D, UI | Playwright screenshots / short recording → a vision judge scores against the task's rubric items |
| `diff` | commit/PR-shaped output (worktree runs) | apply + run the repo's tests, then the AI judge compares the actual diff with a reference diff |

4. **The AI judge is local and on the subscription.**
   - It's a headless `claude -p` call with a fixed judge prompt and a pinned model.
   - It is **blind to which harness/model produced the output.**
   - It writes `{verdict, score, reasoning}` per item.
   - Every judged item records `judgeModel` + `judgePromptSha256`, and is tagged `judged` (vs `scripted`) in the report.
5. **Write `result.json`.**

```json
{
  "runId": "…", "gradedAt": "…", "tamperCheck": "ok",
  "passed": 31, "total": 31, "passRate": 1.0, "allPass": true,
  "checks": [{ "id": "…", "name": "…", "pass": true, "method": "scripted|judged", "detail": "…" }],
  "judge": { "model": "…", "promptSha256": "…" },
  "fakeConvergence": false
}
```

**Fake convergence** = the agent's final message claims completion **and** `allPass` is false. "Claims completion" is itself judged: a single AI-judge call on the last assistant message, classified `claimed | hedged | blocked`.

**Step 2 acceptance**
- B1. Reference sanity: grading each wired task's own reference `src/` gives `allPass` (07: 31/31).
- B2. Negative control: a deliberately broken bowling candidate fails, with the failing checks named.
- B3. Tamper control (run in a scratch copy, never on the frozen tree): a 1-byte edit makes grading abort.
- B4. Task 17's existing `raw-lane/attempt-1-realistic` grades 7/8, failing V6, matching `verify-result.json` on disk.
- B5. Judge sanity: the judge rates the reference and the broken candidate differently on a `judge-visual` item (task 15 or 17), and the verdict is stable across 3 re-judges.

## Step 3 — Renderer + report

### Storage and rendering: how it fits together (Q3)

There are three layers, each derived from the one before:

```
raw.jsonl  ──parse (versioned)──▶  steps.json + meta.json  ──render──▶  HTML
(immutable,                        (normalized, cheap to               (throwaway)
 harness-native)                    regenerate from raw)
```

- **Raw is kept forever and never edited.** If a parser has a bug or the schema grows (e.g. we start tracking thinking tokens), re-parse every run from raw. Nothing is lost.
- **Normalized is the contract the renderer (and later the platform) reads.** It is the same Step schema whichever harness produced the run. That makes the viewer harness-agnostic too.
- **Render is a pure function.** Delete it, rebuild it.
- **For now:** write all three, **gitignore `raw.jsonl` and `steps.json`**, and commit `meta.json`, `result.json` and `output/` (small, and they're the scoreboard).
- **For the platform later:** the same split maps directly:
  - raw → object storage (R2/S3), keyed by run id;
  - meta/result → a DB row;
  - steps → derived on demand or cached.

  Designing the split now means platformizing is a storage swap, not a rewrite.

**So it's both, as you suggested:**
- `bench view <any .jsonl>` renders **any** transcript directly — a bench run, or a random Claude/Codex/pi session from your machine. It auto-detects the format by the first event and writes one self-contained HTML file.
- `bench report` is just `view` applied to every run, plus the scoreboard index.

### Normalized Step schema (`trajectory/schema.md`, v1)

```json
{ "i": 12, "t": "2026-…", "kind": "user|assistant-text|thinking|tool-call|tool-result|system|final",
  "tool": "Write", "summary": "Write src/bowling.mjs (4.1 KB)", "body": "…full content…",
  "isError": false, "usage": { "in": 0, "out": 0, "cacheRead": 0, "cacheWrite": 0 },
  "contextTokens": 0, "contextDelta": 0, "subagent": null }
```

- `subagent` marks steps from a sub-agent or sidechain, so nested work is shown indented rather than dropped. (CtxMap drops them; that's the gap we fix.)
- `contextTokens` / `contextDelta` use CtxMap's formula (`input + cache_creation + cache_read`) and its 🔥 >5K / ⚠️ >1K thresholds. The math is ported with a source comment; there is no dependency on CtxMap.

### Pages

- **Scoreboard (`index.html`).**
  - Rows = task. Columns = harness × model (× profile).
  - Each cell: `k/n passed`, median tokens, median time, a fake-convergence count, and a `judged` marker if any check was AI-judged. The cell links to its runs.
  - Totals per column.
  - A footer with CLI versions, the date range, and "cost = subscription; $ is an API-equivalent estimate where shown".
- **Run page.**
  - Header: task, harness, model, profile, status, grade (failing checks named), fake-convergence badge, tokens, time, turns, peak context.
  - **Context-growth chart** (inline SVG): click a point to jump to its step.
  - **Trajectory timeline:** one row per Step, expandable bodies, errors in red, sub-agents indented.
  - **Output panel:** code (highlight.js), sandboxed `<iframe>` preview for HTML, images, and diffs.
  - **Grade panel:** each check marked scripted vs judged, with the judge's reasoning.
- **Redaction.** Before writing HTML, rewrite home-dir paths to `~` and strip anything matching `leakguard.local.txt`-style terms. This prepares for public sharing.

**Step 3 acceptance**
- C1. A script parses the built HTML and confirms every scoreboard number equals its `meta.json` / `result.json`.
- C2. Per run page, the rendered tool-call count equals the tool-call count in `steps.json`, which equals the count in `raw.jsonl`.
- C3. `bench view` renders one raw file from each of claude, codex and pi, plus one existing interactive Claude session.
- C4. Playwright screenshots at 1440px and 390px, looked at. Zero console errors, no horizontal scroll at 390px.
- C5. A grep of the built site for home paths / the username / leakguard terms finds zero hits.

## Pilot

- **Tasks:**
  - `07-bowling` (tests — plumbing);
  - `17-budget-dashboard` (script + judge — the one real miss);
  - `15-minecraft-3d` (judge-visual — the hardest existing visual task).
- **Arms:**
  - Claude Code × {Opus 5.5, Opus 4.8, Sonnet 5, Haiku 4.5};
  - claude-glm × GLM;
  - Codex × its default model;
  - pi × one model per vendor (the same-harness control).
- **n = 3 per arm.** Throttle to stay inside subscription limits: runs are serial by default, with `--parallel k` available.
- **Pass:** every run passes A1–A4, B1–B5 and C1–C5, and the scoreboard renders. A flat result is fine; the point is the infrastructure.

## Track B — harder tasks (separate, after the pilot)

Most models now pass text-logic tasks, so the current suite can't separate frontier models. The pilot will likely show that honestly, and it's the motivation for Track B.

- Author a **hard tier** using the same research → freeze → answer-key discipline:
  - a real rendered 3D game with a physics/gameplay contract;
  - multi-file apps with state;
  - repo-scale changes graded by `diff`.
- Grading for these leans on `judge-visual` + scripted invariants (e.g. frame-probe physics checks like task 04's 4,083-frame escape test).
- Candidate sources: the WebDev Arena / MicroEvals prompts (already used for 12, 13, 15, 16) at their hardest settings, plus a Josh-defined flagship game spec. Scope this in its own spec.

## Open items to verify in step 1 (not decisions — facts to check)

- Does `claude -p` with a dedicated `CLAUDE_CONFIG_DIR` (subscription login) give a clean baseline? Or does `--bare` work on subscription auth?
- Does each harness's JSON output include per-message token usage? Codex and pi may report totals only. If a harness doesn't, `peakContextTokens` is `null` for it, never estimated.
- pi's auth for each provider on subscriptions: `pi auth check --provider <p>`.
- Subscription rate limits: how many runs per hour before throttling. That sets the pilot's pacing.

## Build order and checks

1. Step 1 (runner + all three adapters) → A1–A4
2. Step 2 → B1–B5
3. Step 3 → C1–C5
4. Pilot
5. Track B spec

Root `npm run check` = B1 reference sanity for every wired task + C1 consistency + a parser round-trip over the fixture transcripts in `bench/fixtures/`. It is the regression gate, and each step lands on master only when its checks pass.
