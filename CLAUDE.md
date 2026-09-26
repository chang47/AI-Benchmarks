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

## Public showcase
- Task 18 reference page → https://wonders-of-the-universe.iamjoshchang.workers.dev. Redeploy with
  `npx wrangler deploy --config deploy/wonders/wrangler.jsonc` (Workers static assets; `wrangler pages`
  now delegates to Workers and fails for a plain static folder). Only the reference page (`src/`) is
  public. Never deploy run data: `runs/` holds absolute local paths.
