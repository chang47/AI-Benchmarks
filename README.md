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
