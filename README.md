# AI Benchmark

Candidate tasks for the **Vetted Bench** project (design doc folded in at [`design/2026-07-11-vetted-bench-design.md`](./design/2026-07-11-vetted-bench-design.md)) — a personal AI-coding benchmark where the "correct answer" is defined by *other people* (official rules, published eval suites, canonical community prompts), so no spec has to be hand-invented.

**Status:** 16 tasks built and independently verified — **16/16 PASS**, all round 0, zero fake-convergence. Awaiting Josh's review before any are promoted into the real Vetted Bench. Full results: [`REPORT.md`](./REPORT.md). Candidate sources: [`research/candidate-tasks-report.md`](./research/candidate-tasks-report.md).

---

## Getting Started

**Prereqs:** Node 18+ and npm; Google Chrome (the visual auto-checks drive it via Playwright's `channel: "chrome"`).

**Just want to review it?** Open [`REPORT.md`](./REPORT.md) — it has a per-task "what to eyeball" guide with file paths and screenshots. Fastest tour: open the visual tasks in a browser (below) and skim two or three `VERIFY.md` tables.

**Open a VISUAL task (04, 05, 06, 12, 13, 14, 15, 16):**
```
# just double-click, or:
start tasks/14-wordle-clone/src/index.html      # Windows
```
(Task 05 is an SVG: open `tasks/05-svg-object/src/object.svg`.) Screenshots the verifier took are in each task's `verify/round-0/`.

**Run a LOGIC task's graded answer key (01–03, 07–11):**
```
cd tasks/07-bowling/holdout      # wave-2 tasks: answer key under holdout/
npm install
npx vitest run
# wave-1 logic tasks (01,02,03) keep the independent suite under verify/tests/ instead
```
Every rule those tests assert traces to a cited source in the task's `research/RESEARCH.md`.

**Test a NEW model against a task (the whole point of the bench):**
1. Give the model `tasks/<slug>/frozen-prompt.md` **verbatim** (that's the frozen one-shot prompt).
2. Save its output to the file path named in `tasks/<slug>/spec.md`'s artifact contract.
3. Grade it: for logic, run the `holdout/` (or `verify/tests/`) suite against the new file; for visual, run `holdout/autochecks.mjs` with node + open it in Chrome.

**Re-run the autonomous build/verify pipeline:** that's driven by the `Workflow` tool from a Claude Code session, not a shell script — just ask me ("re-run the bench", "add a task", "run the raw lane").

---

## The harness — run, grade and view any harness × model (added 2026-09-26)

`bench/` runs a task against a **harness + model**, saves everything, grades it against the frozen answer key, and renders a static HTML report. Spec: [`design/2026-09-25-harness-v1-spec.md`](./design/2026-09-25-harness-v1-spec.md). Plain Node ESM, no build step. Subscriptions only — no API keys.

```
npm install                                   # once (playwright, for the report check)
node bench/cli.mjs run --task 07 --harness claude --model claude-sonnet-5 --grade
node bench/cli.mjs run --task 07,15,17 --arms bench/arms/pilot.json --n 3 --parallel 3 --grade
node bench/cli.mjs report                     # → reports/site/index.html (open from disk)
node bench/cli.mjs view <any .jsonl>          # render ANY Claude Code / Codex / pi transcript
node bench/cli.mjs contamination [runId…]     # read-only raw.jsonl scan: web tools / network / benchmark refs
npm run check                                 # the regression gate (see below)
```

**Harnesses** (`bench/harnesses/index.mjs`) — each in a *clean* setup by default (no user CLAUDE.md/AGENTS.md, skills, hooks, plugins, MCP), or your real setup with `--profile josh`:

| `--harness` | model examples | notes |
|---|---|---|
| `claude` | `claude-opus-5-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5` | `claude -p --output-format stream-json`; clean = `--setting-sources "" --strict-mcp-config --disable-slash-commands` |
| `claude-glm` | `glm-5.3` | Claude Code pointed at `~/.claude-glm` (GLM env injected in clean mode) |
| `codex` | `gpt-6-astra` | `codex exec --json`; clean = `--ignore-user-config --ignore-rules`; does not report the model or per-step context |
| `pi` | `zai/glm-5.3`, `openai-codex/gpt-6-astra`, `claude-bridge/claude-sonnet-5` | one harness, every vendor — the "same harness, different model" control |

**Profiles** (`bench/profiles/*.json`) are per-experiment options, not rules: `clean-room` (default: empty temp dir outside the repo, bare harness, all tools), `josh` (your full setup), `no-web` (web tools denied). A profile can also point at a `skill` file under test or a `worktree:<repo>@<ref>` isolation.

**Denying web tools** (`tools.deny: ["WebSearch", "WebFetch"]`, the `no-web` profile, or `"denyWebTools": true` in a task's `bench.json`, which forces it whatever the profile):

| harness | how the deny is applied | notes |
|---|---|---|
| `claude`, `claude-glm` | `--disallowed-tools WebSearch WebFetch` | the init event lists the tools actually offered → `meta.contamination.webToolsInInit` proves it per run |
| `codex` | `-c web_search="disabled"` | Codex has no per-tool deny list; its only web tool is the native `web_search`, set by the top-level config key `web_search` = `disabled`/`cached`/`indexed`/`live` (0.155.1 validates the value). The default when unset can't be seen without an agent run — assume earlier Codex runs could search (none did: 0 web_search calls in the local runs) |
| `pi` | `--exclude-tools WebSearch,WebFetch` | pi's built-ins (read, bash, powershell, edit, write, grep, find, ls) have no web tool; the deny only matters for extensions loaded by the `josh` setup |

No harness blocks the network from the **shell** (`curl`, `npm install`) — every harness runs with approvals/sandbox bypassed. That is what the contamination scan is for. `meta.webToolsAvailable` records what the harness + effective profile offered (`true` / `false` / `"partial"` / `null` = unknown).

**A run** writes `runs/<id>/`: `raw.jsonl` (the harness's stdout, untouched — source of truth), `steps.json` (normalized, re-derivable with `bench reparse`), `meta.json` (model, profile, command, metrics), `output/` (the artifact), then `result.json` after grading. Raw + steps are gitignored; meta/result/output are small and committed.

**Grading** re-hashes the answer key against its `FREEZE_MANIFEST.json` (refuses on mismatch), runs the task's frozen grader **unmodified** in a sandbox that mirrors the task layout, and normalizes the checks. Items a script can't decide go to a local **AI judge** (`claude -p`, clean, blind to the model, prompt hash recorded, tagged "AI judge" in the report). The judge also classifies the agent's final message (claimed / hedged / blocked) → **fake convergence** = claimed done but failed the key.

**Task inputs.** If `tasks/<slug>/inputs/` exists it is copied into the agent's workspace as `inputs/` (task 18: the vendored Three.js); the input hashes are recorded in `meta.json`. `bench.json` can set `artifactDirs` (collect a whole folder, e.g. `src/`, not just the entry file) and `timeoutMin` (overrides the profile's 30 min).

**Whole-repo tasks** (added 2026-09-28, generic — for tasks where the agent works inside a big prepared repo). `bench.json` options:

- `"workspace": { "from": "<dir>", "shortRoot": true }` — copy a prepared directory (a whole repo **including `node_modules` and `.git`**) into the agent's workspace instead of starting empty. `from` is absolute or task-relative; `$VAR` / `${VAR}` expand from the environment (keep big or private prepared dirs outside the repo). `shortRoot` puts the workspace at `C:\b\<task>-<4hex>` (override the base with `VBENCH_SHORT_ROOT`) to stay under Windows MAX_PATH. Copies are real (robocopy `/MT` on Windows, Node elsewhere). Links in the source (npm-workspaces junctions) are re-created pointing at the same place **inside the workspace**; links that point outside the source are copied as content; a final walk refuses any link that leaves the workspace. `meta.workspacePrep` records files, bytes, `copyMs`, link counts and the prepared repo's `gitHead`. Removed after the run unless `--keep`. Needs isolation `tmp`.
- `"artifactDirs": ["."]` collects the whole workspace; `"artifactExclude": ["node_modules", "dist", ".git/objects", "var"]` drops matches — a pattern without `/` matches any path segment (glob `*` `?`), one with `/` matches consecutive segments anywhere. Links are never collected. `meta.artifactSize` = files + bytes collected (recorded for every run). Tasks without `artifactExclude` keep the old copy path. `"referenceDir"` (task-relative) is where `grade --reference` takes the reference solution from for such tasks.
- `"judgeText": { "file": "FINDINGS.md", "questions": "holdout/findings-questions.json" }` — a **text-input judge**. The runner snapshots `file` when the run ends (`runs/<id>/judge-text/`, sha256 in `meta.judgeTextSnapshot`; missing = empty text). Each question (`{instructions?, questions: [{id, q, points?, group?, name?}]}`) is its own `claude -p` prompt holding **only** that text — no repo, no tools — 3 votes (claude-sonnet-5, clean, prompt sha256 recorded), majority yes; a failed/unparseable vote is retried (2 extra attempts); fewer than 3 valid votes → `"judge failed"` (status unclear, 0 points, never guessed); an empty file → every answer "no" by rule. Checks the grader emits with `method: "judge-text"`, `status: "skip"` are filled (their points come from the grader); if it emits none, one check per question is added. Summary in `result.judgeText`. A task grader can call it itself: `const { judgeText } = await import(process.env.VBENCH_JUDGE_TEXT_MODULE)` (the snapshot path is `VBENCH_JUDGE_TEXT_FILE`), or `node bench/cli.mjs judge-text --text F.md --questions q.json`.
- node-script graders also get `VBENCH_RUN_DIR` and `VBENCH_OUTPUT_DIR` (the collected artifacts) — existing graders ignore them.
- `"contamination": { "extraTerms": [...] }` — extra strings for the contamination scan.

**Contamination scan** (every run, unscored). A read-only pass over `raw.jsonl` → `meta.contamination`: web-tool calls, shell commands that reach the network (curl / wget / Invoke-WebRequest / iwr / irm / git clone|fetch|pull / gh / npm view|install / pip download|install / `fetch(` or `http.get(` with a remote URL …; requests whose every target is localhost are counted, not flagged), and strings naming this benchmark (`github.com/chang47`, `AI-Benchmarks`, `ai-benchmark`, `vetted-bench`). Shown as a "contamination" flag next to the score and a panel on the run page — never folded into the score. `node bench/cli.mjs contamination [runId…]` re-scans existing runs (so does `reparse`). First scan of the 72 local runs (2026-09-28): no web-tool calls at all; 3 runs ran `npm install` of a test dependency (jsdom / puppeteer-core).

**Points checklists** (task 18 on). The grader emits checks with `points` / `earned`; `result.json` gets `pointsEarned`, `pointsPossible`, `score` and per-group totals, and the scoreboard shows "% of points". Measured values become points through bands frozen in the grader. Subjective items are **yes/no judge questions** (`judgeItems: "checklist"`): answered blind from fixed frames the grader saves, 3 votes, strict majority, a tie scores 0, never an overall rating. A points run counts as a false "done" when the agent claimed done and scored under 90%.

**Wired tasks** (have `tasks/<slug>/bench.json`): 07 bowling, 08 poker, 09 forth, 10 zebra (vitest) · 15 Minecraft-3D (autochecks + visual judge) · 17 budget dashboard (verify-reference) · 18 Wonders landing page (82-point checklist: 74 scripted + 8 yes/no judge) · 21 Pip's inventory (a LIVE spreadsheet: FIFO + backorders + monthly P&L; LibreOffice recalculates it, then the grader pastes in a hidden second transaction log and re-scores — typed-in numbers fail; answer key agreed 81/81 by an event engine, a live-formula workbook and a blind solver) · 20 Cannae battle sim (65-point checklist: rule compliance + 10 historical beats sampled from `window.__cannae.state()` every 10 s; ~30 s per grade; `node bench/checks/mutations-20.mjs` = 8 probe-validation mutations). Wiring another task = one `bench.json`.

**Task 18 probe validation:** `node bench/checks/mutations-18.mjs` grades the reference, then broken copies of it (frozen volcano, broken pin, never-pausing scenes, no cursor, no validation, no reduced motion, a console error, no scrims, galaxy ignores the mouse) and checks each loses exactly its own checks. Slow (~1 h, one Chrome at a time); not part of `npm run check`.

**`npm run check`** — parser fixtures per harness; every wired task's reference passes its key; a broken bowling scorer fails with named checks; a 1-byte holdout edit is caught; task 17's July realistic build still grades 7/8 (V6); every report number equals its JSON; tool-call counts agree across page / steps / raw; browser render has zero console errors and no horizontal scroll at 1440px and 390px; no home paths leak into the site; D1–D6 self-test the whole-repo options without a model or a real task (prepared-dir workspace at a short root with junctions + a read-only `.git` object + a >260-char path, `artifactExclude`, the text judge with a faked judge incl. retries and "judge failed", the contamination scan on crafted raws for all 3 formats + the 4 real fixtures, the web-tool deny args per harness, and an end-to-end run → grade of a generated fixture task driven by a scripted fake agent). `--quick` skips the slow browser tasks.

---

## The meta-experiment

Each task rehearses the vetted-bench loop with one twist: **"what to build" and "what counts as correct" are outsourced** — external authorities and community consensus, never hand-invented. Per task:

1. **Research** — read the second brain + the web; write `spec.md` (numbered acceptance criteria, every rule traceable to an external source), `frozen-prompt.md` (the one-shot prompt for future runs), `research/RESEARCH.md` (sources). Wave-2 logic tasks also freeze a machine-readable **answer key** (`holdout/`, e.g. Exercism's own `canonical-data.json`).
2. **Freeze** — specs + answer keys committed to git **before any implementation exists** (verifiable in history).
3. **Build** — an implementer agent builds from `spec.md` only, blind to the answer key.
4. **Verify** — a separate agent (never the builder) tamper-checks the frozen key by hash, then grades the candidate against it: unit tests for logic, browser checks + screenshots for visual. On fail, the builder gets behavioral feedback and retries (max 2 rounds). It also records a **fake-convergence** flag: did the builder claim done while failing the key?

Wave 1 (tasks 01–06) ran on Fable; wave 2 (07–16) ran build **and** verify on Opus.

## Tasks

| # | Task | Type | Correctness authority |
|---|------|------|----------------------|
| 01 | Tennis scoring engine + scoreboard | A logic | ITF Rules of Tennis |
| 02 | Habit-streak engine | A logic | Streaks/Loop/Duolingo conventions |
| 03 | Sudoku solver + validator | A logic | Known hard puzzles (Inkala) |
| 04 | Bouncing balls in a spinning polygon | B visual | KCORES 90-pt rubric |
| 05 | SVG pelican on a bicycle | B visual | Simon Willison's eval |
| 06 | Animated solar system + FPS counter | B visual | Ordinal planetary facts |
| 07 | Bowling score engine | A logic | Exercism canonical-data |
| 08 | Poker hand ranking | A logic | Exercism canonical-data |
| 09 | Forth mini-interpreter | A logic | Exercism canonical-data |
| 10 | Zebra puzzle solver | A logic | Exercism canonical-data |
| 11 | Chess legal-move generator (perft) | A logic | Chess Programming Wiki perft + FIDE |
| 12 | Chess web game | B visual | WebDev Arena prompt + FIDE |
| 13 | Hacker News clone | B visual | WebDev Arena prompt + live HN |
| 14 | Wordle clone | B visual | NYT rules (duplicate-letter logic) |
| 15 | Minecraft-style 3D voxel demo | B visual | MicroEvals canonical prompt |
| 16 | Budget tracker (CRUD) | B visual | MicroEvals prompt + CRUD lineage |

## Per-task layout

```
tasks/<slug>/
  research/RESEARCH.md   sources + adopted correctness rules
  spec.md                the builder's only brief (+ artifact contract)
  frozen-prompt.md       one-shot prompt for future bench runs
  metadata.json          {type, difficulty, status, authorities, contamination}
  holdout/               frozen answer key (wave-2): canonical tests / rubric + autochecks + FREEZE_MANIFEST
  src/                   the candidate implementation
  verify/                verifier's independent run: tests, screenshots
  VERIFY.md              verdict, per-check results, feedback history
  STATUS.md              append-only stage log
```

## Caveats for review

- **Research-vetted ≠ Josh-vetted.** Promotion into the real Vetted Bench still needs the human vetting gates in the design doc.
- **Contamination:** the most canonical prompts (pelican, KCORES heptagon) are heavily in training data — the real bench swaps in personal variants. Tonight's rule was deliberately "what other people defined."
- **The fake-convergence metric is 16/16 null** — a strong frozen spec + the builder's own TDD didn't produce a caught lie. That drama lives in the **raw lane** (one-shot from `frozen-prompt.md`, no fix loop, no self-tests), which hasn't been run yet.

## Public vs private (contamination) — decided public

Repo visibility barely matters for *this* suite, so it's public. The usual "keep your benchmark private" advice doesn't apply here, for two reasons:

- **The answers are already public.** The logic tasks are graded by Exercism's own `canonical-data.json`, FIDE laws, and Chess Programming Wiki perft counts — all public. This repo *repackages* public data; hiding it conceals nothing a model or a person couldn't already find.
- **Live look-up is a run-mode choice, not a visibility choice.** A model can only "look up" an answer mid-eval if you run it *with tools/web access*. A sealed one-shot (paste `frozen-prompt.md`, take the output) generates from weights and can't search — public repo or not.

Privacy only earns its keep for tasks whose answer is **not** already on the web — future *personal-variant* or bespoke tasks. Keep **those** in a private holdout; for the community-canonical 16, privacy is theater. The lever that actually protects an eval is **how you run the model** (tools vs sealed one-shot), not repo visibility.

## Integrity: the builder never sees the answer key

Each task's answer key (`holdout/`) is frozen and committed *before* the candidate is built, hash-pinned in `FREEZE_MANIFEST.json`, and the builder agent is instructed never to read `holdout/`, `research/`, or `verify/`. A post-run transcript audit of the wave-2 run confirmed **zero** builders opened any answer-key or research file. Note this is currently enforced by instruction + freeze-ordering + tamper-check, **not** physical isolation — before running a model you don't control, build in a checkout that omits `holdout/` and auto-void any run whose builder reads it.

## Relocation note (2026-07-12)

The wave-1 overnight orchestrator had an args bug: the base path reached agents as the literal string `"undefined"`, so five tasks self-resolved into the `vetted-bench` folder and one (03-sudoku) wrote to a stray `undefined/` dir. Post-run the two run commits were ported here via `git format-patch`/`git am` (author timestamps preserved — the freeze-before-build ordering is still verifiable), the sudoku research recovered, and `vetted-bench` restored to its pre-run state (backup branch `overnight-run-mislocated` kept there until reviewed). Wave 2 hardcoded the base path, so it stayed clean.

---

## Showcase: task 18 "Wonders of the Universe" (live)

The task-18 reference page is public at **https://wonders-of-the-universe.iamjoshchang.workers.dev**. It's a cinematic, code-only WebGL world (Three.js r186 + custom GLSL) and the flagship benchmark page. It's served as Cloudflare Workers static assets straight from `tasks/18-wonders-landing/src/`. Redeploy after a change with:

```
npx wrangler deploy --config deploy/wonders/wrangler.jsonc
```
