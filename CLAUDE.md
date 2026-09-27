# ai-benchmark (Vetted Bench) — project notes for agents

Frozen AI-coding tasks (`tasks/<slug>/`) + a harness (`bench/`) that runs task × harness × model,
grades against the frozen answer key, and renders a static HTML report. Built to feed Josh's
YouTube channel ("the harness outlives the model") and, later, a shareable eval platform.

## Read first
- `README.md` → "The harness" section: commands, harnesses, profiles, what a run writes.
- `design/2026-09-25-harness-v1-spec.md` — the spec the harness implements (acceptance checks A/B/C).
- `bench/trajectory/SCHEMA.md` — the normalized Step schema + which metrics each harness reports.

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

