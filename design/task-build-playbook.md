# Task build + benchmark playbook

How to add a benchmark task and benchmark models on it without wasting days. Distilled from building tasks 23–25
(2026-10-01/02): five tasks built, validated, reviewed and piloted overnight — and every one saturated, which a 5-minute
pilot would have shown before most of the build. Skill wrapper: `bench-task-build` (Josh's claude-config dotfiles).

## 1. The order (pilot first)

| # | Step | Gate to pass before the next step |
|---|---|---|
| 0 | Pick category/tier (`design/2026-10-01-benchmark-categories.md`, `-task-rotation-policy.md`); decide private vs public key | Josh approves the spec + open questions |
| 1 | **Prototype**: frozen-prompt draft + inputs + the answer key only (engine or hand key). No grader, no sandbox, no controls | Key computes |
| 2 | **Pilot gate**: 2 blind runs each of Sonnet 5.5 and Opus 5.5 at **medium**, scored by a crude script against the key | Spread between frontier arms **≥ 10 points** (or clear failure modes worth filming). Saturated → redesign the traps now, not after the build |
| 3 | Key cross-check: two independent engines (second one written blind by a fresh `claude -p` from the brief only) + a blind solver | All agree; every disagreement fixed in the brief/key, then re-run all three |
| 4 | Full grader (points checklist), controls (reference, hard-coded, empty, one mutation per rule, cheat attempts), freeze | Each control lands in its band / loses exactly its set |
| 5 | **Blind validator** on holdout scenarios the implementer never saw + **adversarial reviewer** (read-only, hunts gaming/leaks/unfairness), in parallel | ≥ 80% satisfaction and zero blocking; fix round; re-check the fixed items |
| 6 | Install (gitignored if private), `npm run check --quick`, then the real pilot/round runs | — |

Steps 3–5 are the Dark Factory loop (implementer → validator → reviewer, max 5 rounds). Holdouts live in the private repo
`_validator-only/`; implementers never read them. Reviewers found real blockers on every task (readable answer key,
honest runs flagged as tamper, stale judge cache, guessing scoring above rule-following) — never skip gate 5.

## 2. What makes a task separate models

- **Written rules do not create difficulty.** Frontier models follow explicit rulings perfectly, even odd ones (24b:
  one-for-one refund cancellation, two encodings of "unknown", a fee folded into another column — all 100% correct).
- **What separated runs:** a question whose honest answer is "cannot be answered from this data" with a tempting proxy
  next to it (24 Q17); discovering unreported problems (22a bug hunt); resource discipline.
- So harden with judgment: unanswerable-with-proxy, silent mid-run changes, ambiguity that must be flagged, a real rule
  that looks like an injection. Not with more rules.
- Saturated anyway? Keep it as a spotlight/demo task; a harder version is a new slug (`24b`), never an edit to a frozen one.

## 3. Arms and effort

- Default arms: `bench/arms/new-model-medium.json` (medium effort, clean-room). Add the new model as one more medium arm.
- **No max/high runs** except for a dedicated effort video. Task 24: Sonnet max took 74 + 27 min (~$11 + $5 list) vs
  1 min ($0.12) at medium, for +2 points. Haiku and Sonnet-high are dropped.
- n = 2 per arm for scripted tasks; n = 3 for judge-graded tasks (task 23 judge noise: the same plan scored 97 and 92).

## 4. Running on the laptop (~10 GB free, Claude Code's low-memory reaper kills parallel jobs)

- One heavy thing at a time machine-wide: `bash bench/heavyq.sh <label> <cmd...>` (FIFO lock). Steps ≤ 2 GB and ≤ 10 min
  may skip it when free RAM ≥ 5 GB.
- Queue runs **one per lock hold**: `bash bench/pilot-queue.sh <task> <n> <harness:model:profile>...` so builds and
  validators can slot in between runs. (`bench/overnight.mjs` holds the lock for the whole batch — fine when nothing else
  runs.)
- **Lid closed = sleep**, and `keepawake.ps1` cannot stop it (one run lost 9 h). Set lid-close to "do nothing" or keep it
  open during batches. A run killed by sleep → `runs/_aborted/` and re-run.
- A Claude Code background command stops tracking after 2 h; the queue keeps running. Poll `.bench-cache/logs/`.
- Sandboxes that re-run agent code: measure the **agent's** code, not only the reference, before setting caps (a correct
  agent script used 4.9–6 GB vs a 0.9 GB reference). Windows re-runs use an AppContainer (task 24 `holdout/appcontainer.py`):
  no file access outside the sandbox, no network.
- `denyWebTools` blocks the web tools, not shell network (`curl`); read `meta.contamination`.

## 5. Agent orchestration gotchas

- **`/clear` does not stop background agents.** Before (re)launching builders, list running agents; a survivor plus a new
  builder in the same folder clobber each other. One builder per task; split files explicitly if two must overlap.
- **Worktrees share one git index**: stage explicit paths and check `git show --stat` after committing.
- A worktree-isolated Claude Code session cannot run git in another repo and may only leave the worktree when Josh says
  so: keep public-repo changes in their own `git worktree add` from the start, and plan the landing step before isolating.
- Brief every agent with the lock command, "never read `_validator-only/`", kill-by-PID only (never `taskkill /IM node.exe`).

## 6. Cost and token data

Every Claude run's `raw.jsonl` ends with Claude Code's `result` event: API-reported tokens (input, output, cache, thinking)
per model and turn. `total_cost_usd` is those tokens × **list price** (`costBasis: "list"`), not the subscription bill —
label it "list est.".
