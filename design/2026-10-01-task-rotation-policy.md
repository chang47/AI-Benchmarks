# Task rotation policy — core, spotlight, archive (2026-10-01)

**Why:** the benchmark has two jobs that pull in different directions. Comparisons over time need the SAME tasks on
every model ("the harness outlives the model"). The videos need VARIETY, so viewers aren't watching the same landing
page every episode. Answer keys also wear out: once a task is shown in depth on camera or saturates, it stops measuring.

## The three tiers

| Tier | What it's for | Who runs it | On camera |
|---|---|---|---|
| **Core** (4–6 tasks) | Comparable numbers across models and months | Every new model / effort setting, n ≥ 2 | A 10–15 s scoreboard, one new column per video |
| **Spotlight** (1–2 per video) | The video's visual hero and its story | The arms that video compares | The main segments |
| **Archive** | Regression checks for the harness; public examples | Only when the harness changes | Never as new results |

A task moves **spotlight → core** when it passes the admission bar, and **core → archive** when it saturates or its
answer key is exposed. Frozen tasks are never edited: a harder version is a new slug (e.g. `21b`).

## Where each task sits now

| Task | Tier | Notes |
|---|---|---|
| 18 Wonders landing page | Core | Visual, functional checklist (82). Grader public in this repo; craft judged by watching, not scored. |
| 20 Cannae battle sim | Core | Long-horizon build (65). Sonnet max hit the 2 h cap; separates on time and cost. |
| 21 Pip's inventory | Core, **saturated → harden** | Every arm 45/45 so far. Keep one more video as the "only the bill differs" beat, then replace with `21b` (longer hidden log beyond the prompt's 1,000-row promise; settle the same-day return-cost wording first). |
| 22a Broken Tabletop | Core + video-2 spotlight | Bug hunt (69); separates arms on the unreported bugs. Answer key private (`ai-benchmark-private`). Exposure: the early spec with the bug list is on public master (`design/.spec-fusion-work/`), decision open with Josh. |
| 22b Grow Tabletop | Spotlight candidate | Open-ended feature work. Needs a scored version + the bench fix for unscored checks before any run. |
| 15 / 15b Minecraft | Archive | Grading grabs the real mouse; mostly measured hook-contract probes. |
| 01–14, 16, 17 | Archive | Community-canonical answers (Exercism, FIDE, perft), saturated (e.g. 07 everyone 31/31 except Haiku; 17 all 8/8 except Haiku). |

## Admission bar (spotlight → core)

All of these, on the record in the task's `metadata.json` or handoff:
1. Frozen prompt + grader with **mutation controls**: each sabotaged build loses exactly its own checks.
2. **Answer key cross-checked** by an independent method (three-way agreement as in 21, or a blind solver), and an
   independent re-verification pass (as done for 21/22 on 2026-09-30).
3. **Separates arms:** on the pilot, at least a 10-point (or 10%) spread between frontier arms. A task every arm aces
   is a demo, not a core task.
4. **Bounded cost:** a medium-effort frontier run finishes within the cap (≤ 2 h) with room to spare.
5. **Private answer key** for anything bespoke (gitignored + private repo, like 22). Agents run with shell network
   access (Sonnet max downloaded a PDF on 22a), so a public holdout is reachable mid-run.

## Retirement rules (core → archive)

- **Saturated:** 3 or more distinct frontier arms score ≥ 95% on n ≥ 2. Retire, or replace with a harder slug.
- **Exposed:** its answer key or specific bugs were shown in depth on camera or published. Runs before the publish date
  stay valid; any later run is stamped `post-exposure` in its results, and the task leaves core after the next video.
- **Broken grader:** a flaky check (e.g. 22a's `b09.sent.three-failures-dead`, 1 in 25 on the clean build) gets fixed
  and the task re-frozen before its next scored run; until then results carry a note.

## Cadence

- **One new spotlight task per video.** A trustworthy task (prompt, grader, mutations, cross-checked key, re-verification)
  is days of work, so the backlog (`design/benchmark-backlog.md`) stays at least two tasks ahead of the videos.
- **Rotate genres** across videos: cinematic web build (18) · simulation (20) · data / spreadsheet (21) · repo bug hunt
  (22a) · next up: long-horizon feature on an existing repo (22b), migration / refactor, a game, an ops / incident fix,
  clone-from-screenshots (19, parked).
- **Every new model:** core set at its default effort and at medium, n ≥ 2, before it appears in any video.

## Run hygiene that applies to every tier

- Effort pinned per arm (`clean-room-medium` / `clean-room-max` profiles); never compare a default-effort run without
  saying so.
- Capped runs are interrupted, not killed, so they keep Claude Code's result event (README, "Time cap").
- Read `meta.contamination` on every run before it goes in a video; network fetches of the task's own repo or holdout
  disqualify the run.
