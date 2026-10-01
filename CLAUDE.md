# ai-benchmark (Vetted Bench) — project notes for agents

Frozen AI-coding tasks (`tasks/<slug>/`) + a harness (`bench/`) that runs task × harness × model,
grades against the frozen answer key, and renders a static HTML report. Built to feed Josh's
YouTube channel ("the harness outlives the model") and, later, a shareable eval platform.

## Read first
- `README.md` → "The harness" section: commands, harnesses, profiles, what a run writes.
- `design/2026-09-25-harness-v1-spec.md` — the spec the harness implements (acceptance checks A/B/C).
- `bench/trajectory/SCHEMA.md` — the normalized Step schema + which metrics each harness reports.
- `design/2026-10-01-task-rotation-policy.md` — which tasks are core / spotlight / archive, and when a task moves.
- `design/2026-10-01-benchmark-categories.md` — task categories (C1–C7), run modes, and the lenses measured on every run.
- `design/2026-10-01-category-task-ideas.md` — researched task designs for C4–C7 + the Money series, with a build order.

## Rules
- **Never edit anything under `tasks/<slug>/holdout/`** (or other frozen files). Grading re-hashes them
  against `FREEZE_MANIFEST.json` and refuses on mismatch. `tasks/<slug>/bench.json` is NOT frozen.
- **Raw is the source of truth.** `runs/<id>/raw.jsonl` is never edited. After a parser change run
  `node bench/cli.mjs reparse` to re-derive `steps.json` + metrics for every run.
- **Anti-fabrication.** Every number in a doc, caption or report comes from a run's `meta.json` /
  `result.json`. A metric a harness doesn't report stays `null` — never estimate it.
- **Subscriptions only** (Claude Max, Codex $20, GLM, pi auth). No API keys. `$` = estimate, labelled.
- **Validate UI by looking.** After touching `bench/render/`, run `npm run check` (C4 screenshots to
  `.bench-cache/shots/`) and actually open the PNGs.

## Feedback loop
`implement → npm run check (or --quick) → fix → commit`. `check` is the regression gate: parser
fixtures, reference-passes-key per wired task, broken/tamper/July-17 controls, report==JSON,
tool-call counts page==steps==raw, browser render clean at 1440/390, no path leaks.

## Gotchas (learned 2026-09-26)
- Spawn CLIs WITHOUT a shell (`claude.exe`/`codex.exe` directly, pi via `node cli.js`) — a shell drops
  the empty-string arg in `--setting-sources ""`.
- `claude --bare` refuses subscription (OAuth) auth; the clean profile uses `--setting-sources ""` etc.
- claude-glm's endpoint/token live in `~/.claude-glm/settings.json` `env`; clean mode injects that env
  (never log it).
- Freeze manifests vary: `{path: hash}` or `[{path, sha256}]`, upper/lower-case hex, some with a BOM.
- Frozen prompts for 15/17 say "output the complete contents of index.html" — agents often reply with
  the file instead of writing it; the runner extracts it from the final message (`artifacts[].source`
  records how it was collected).
- Task 15's scripted grader SKIPs R05 on a clipped probe window; the visual judge prompt must not
  treat skip-note numbers as failure (it did once; reference now 22/22 = the human resolution).

## Task 18 grader (added 2026-09-26)
- `tasks/18-wonders-landing/holdout/grade-wonders.mjs` (frozen, own node_modules: playwright 1.63 + axe-core + pngjs). ~7 min per grade,
  one Chrome at a time — legibility alone is ~3 min. `WONDERS_ONLY=title,scenes node grade-wonders.mjs <index.html>` runs a subset (dev only).
- Pixel probes hide all text + the custom cursor first. Film grain swamps per-pixel diffs; the galaxy-mouse probe uses 8×8 block
  averages, threshold calibrated against the `no-mouse` mutation (null 1.08×, reference 1.5–2.0×).
- `node bench/checks/mutations-18.mjs [names]` = probe validation (~1 h). Mutation anchors must survive CRLF sources.
- Memory: 3 parallel agent runs + a grading Chrome got both jobs killed by Claude Code's low-memory reaper. Run 18 serially.

## Task 20 Cannae (added 2026-09-27)
- Reference `tasks/20-cannae/src/` (deterministic sim `sim.js` + Three.js `render.js`); a WOW showcase — Josh accepted
  its remaining visual rough spots. Headless: `node tasks/20-cannae/research/run-sim.mjs`.
- Grader `holdout/grade-cannae.mjs` samples `__cannae.seek/state` every 10 s and scores rules + history on the states;
  judge frames are zoomed with the mouse wheel (the prompt requires wheel zoom). Reference 64/65.
- Determinism is tested across two FRESH page loads at an off-grid time (t=1473): a page that caches checkpoints
  returns identical states for repeated seeks even when its sim is random.

## Task 21 inventory (added 2026-09-27)
- Needs LibreOffice (installed 2026-09-27 via winget; `soffice.com` in Program Files) + `pip install openpyxl`.
- LibreOffice does NOT recalc .xlsx on load by default — `holdout/recalc.py` runs it with a private profile whose
  OOXMLRecalcMode=0. openpyxl must write newer functions with the `_xlfn.` prefix (`_xlfn.MAXIFS`) or they are #NAME?.
- Data is seeded (`research/generate.py`); the answer key is `holdout/engine.py`, cross-checked by the live-formula
  reference (`research/build_reference.py` → `src/`) and a blind solver from the brief alone (81/81 identical). If you
  change a rule, change all three and re-run that three-way check before freezing.

## Whole-repo harness options (added 2026-09-28)
- `bench.json` `workspace.from` + `shortRoot`, `artifactDirs: ["."]` + `artifactExclude`, `judgeText`, `denyWebTools`,
  `referenceDir`, `contamination.extraTerms` — semantics in README "Whole-repo tasks". Self-tests D1–D6 in `npm run check`.
- Prepared dirs carry npm-workspaces **junctions**. The copier re-creates in-source links pointing INTO the workspace and
  dereferences out-of-source ones; it refuses a workspace with any link leaving it. Never "optimise" the copy into a
  junction/symlink to the prepared dir — the agent (or `rm -rf`) would then write into the pristine source.
- `listFiles` no longer recurses through links (junction cycles); `fs.rmSync` unlinks junctions without following them.
- Short roots live under `C:\b` (override `VBENCH_SHORT_ROOT`); a `--keep` run leaves its `C:\b\<task>-<4hex>` behind.
- Codex has no per-tool deny: web search is the top-level config `web_search` (`-c web_search="disabled"`). pi has no
  built-in web tool. No harness blocks shell network (`curl`, `npm install`) — read `meta.contamination` instead.
- The contamination scan is calibrated against the local runs (loopback `http.get`/`fetch(` and `grep "fetch("` were false
  positives, now ignored). It is unscored; don't fold it into a score.
- `VBENCH_TASKS_DIR` (new) exists for the D6 fixture task only; like `VBENCH_RUNS_DIR` it must be set before
  `bench/lib/util.mjs` is imported (hence D6 runs in a child process).
- Judge seam for tests: `judgeHooks.ask` in `bench/grade/judge.mjs` (null in production).

## Public showcase
- Task 18 reference page → https://wonders-of-the-universe.iamjoshchang.workers.dev. Redeploy with
  `npx wrangler deploy --config deploy/wonders/wrangler.jsonc` (Workers static assets; `wrangler pages`
  now delegates to Workers and fails for a plain static folder). Only the reference page (`src/`) is
  public. Never deploy run data: `runs/` holds absolute local paths.

## Gotchas (learned 2026-09-27)
- GLM-5.3 is ~2x slower wall-clock than Opus 5.5 (endpoint latency); tasks 20/21 use `timeoutMin: 120`. A run killed by
  the time limit gets no "false done" verdict (its last message is mid-work).
- GLM's endpoint uploads screenshots and returns URLs with the local path URL-encoded (`C:%5CUsers%5C<user>`); the
  redactor handles `%5C` / `%2F` separators — C5 catches regressions.
- The laptop sleeps overnight and a sleeping run is logged as a timeout — hold ES_SYSTEM_REQUIRED while `bench/cli.mjs` runs.
- **Task 22's answer key is private** (spec v3 §1 A8): `design/2026-09-27-task22-*` and `tasks/22*/` are gitignored.
  Backup copies live in `~/Projects/ai-benchmark-private/task22/`. Never commit them until the round-1 runs are done.
- **`git rm --cached` + `.gitignore` + switching branches DELETES the file from disk.** Checking out a branch that still
  tracks the file overwrites it (git treats ignored files as expendable), and merging the untracking commit then removes
  it. Copy the file somewhere outside the repo first. (Lost the uncommitted spec v3 edits this way once; re-applied.)

## Overnight batches (added 2026-10-01)
- `bench/overnight.mjs` (wrap in `bench/keepawake.ps1`) = serial run → grade → next, usage-limit aware, `--stop-at`. README has the command.
- A run killed by a dropped connection (ENOTFOUND, "Can't reach the API server") is moved to `runs/_aborted` and retried
  after 5 min (max 6), like the usage limit (2026-10-01: a DNS outage turned two task-18 runs into "0/82" in ~4 min).
- Effort is pinned per arm via `clean-room-medium` / `clean-room-max` profiles. Runs before 2026-10-01 have `profile.effort: null`
  (Claude Code default, which Anthropic says is Medium; not provable from the logs), so pair them with an explicit-medium run.
- Task 18 `timeoutMin` raised 60 → 120 (2026-10-01) so a max-effort arm isn't cut off; every arm in a batch gets the same limit.
- Capped runs (2026-10-01): Claude Code runs are interrupted at `timeoutMin` via stream-json `control_request {subtype:"interrupt"}`
  and keep their `result` event (verified live: Cannae capped at 30 s → interrupted at 30.0 s, cost + modelUsage recorded).
  Runs from before this change that hit the cap (e.g. 20261001-053939-20-claude-sonnet55-b545) have no result event:
  input/cache tokens are exact, output tokens + cost are null.
- Max effort can fan out to sub-agents (Sonnet 5.5 max on 22a: 4 auditors, 724 model calls, $80.92 list). Token totals come
  from `modelUsage`; the context chart interleaves main + sub-agent calls (a sawtooth), not a bug.

