# AI Benchmark — overnight autonomous run (2026-07-11)

Candidate tasks for the **Vetted Bench** project (design doc: `../vetted-bench/docs/superpowers/specs/2026-07-11-vetted-bench-design.md`), built overnight by autonomous agents.

## The meta-experiment

This run rehearses the vetted-bench loop with one twist: **"what to build" and "what counts as correct" are outsourced to research** — external authorities and community consensus (official rules, canonical community prompts, how other people judge these tasks) — instead of Josh hand-vetting. Per task:

1. **Research** — read the second brain + the web; write `spec.md` (requirements + numbered acceptance criteria, every rule traceable to an external source), `frozen-prompt.md` (the one-shot prompt for future bench runs), `research/RESEARCH.md` (sources).
2. **Freeze** — all specs committed to git **before any implementation exists**.
3. **Build** — an implementer agent builds from `spec.md` only.
4. **Verify** — a separate agent (never the builder) writes and runs its own checks from the spec: unit tests for logic tasks, browser checks + screenshots for visual tasks. If it fails, the builder gets behavioral feedback and retries (max 2 fix rounds).

## Tasks (from the vetted-bench starter suite)

| # | Task | Type |
|---|------|------|
| 01 | Tennis scoring engine + scoreboard app | A (logic) |
| 02 | Habit-streak engine | A (logic) |
| 03 | Sudoku solver + validator | A (logic) |
| 04 | Bouncing balls in a spinning polygon | B (visual) |
| 05 | SVG object (community-canonical) | B (visual) |
| 06 | Animated solar system + FPS counter | B (visual) |

## Per-task layout

```
tasks/<slug>/
  research/RESEARCH.md   sources + adopted correctness rules
  spec.md                the builder's only brief
  frozen-prompt.md       one-shot prompt for future bench runs
  metadata.json          {type, difficulty, status, authorities}
  src/                   the implementation
  verify/                verifier's tests / screenshots
  VERIFY.md              verdict, per-check results, feedback history
  STATUS.md              append-only stage log
```

## Caveats for review

- Research-vetted ≠ Josh-vetted. Promotion into the real Vetted Bench still requires the human vetting gates from the design doc.
- Tasks 04/05 use community-canonical prompts deliberately (tonight's rule is "what other people defined") — the real bench swaps in personal variants for contamination reasons.

Run report: `REPORT.md`. Per-task progress: `TODO.md` + each task's `STATUS.md`.
