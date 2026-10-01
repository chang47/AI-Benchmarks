# Task ideas for the open categories — C4, C5, C6, C7 + the Money series (2026-10-01)

Research: five parallel agents (2026-10-01), each reading the landscape memo and 2026 sources. Full notes:
`~/.claude/jobs/f8205858/tmp/{c4,c5,c6,c7,money}/` (session scratch). Categories: `2026-10-01-benchmark-categories.md`.
No numbers below are measured on our tasks; public-benchmark figures are cited from their sources.

## Recommended build order (cheapest proof first)

| # | Task | Category | Build effort | Why first |
|---|---|---|---|---|
| 1 | **Freelancer for a Day** | Money series (scores under C4 + honesty lens) | Low: wraps existing tasks | Reuses private keys; scores "define done, verify" directly |
| 2 | **Blueprint** (spec → fixed builder → hidden tests) | C5 | Medium: two-stage harness + ~20–40 hidden cases | Uses the fusion spec as truth where the built app proves it mattered |
| 3 | **The build is red** | C7 | ~2–3 days | Fully on Windows; red → green on camera |
| 4 | **Make it faster without breaking it** | C6 | ~2–3 days | Reuses task 21's seeded-data + three-way key pattern |
| 5 | **Monday Inbox** | C4 (+ interactive mode) | ~3–4 days | Separates hardest (public analogues' best: <10–33%) |
| later | Shop simulator (Money), incident response (C7, WSL), inherited workbook (C4), messy-data twin (C6), bait task (C6), Broken Spec review (C5), taxes (C4) | | | |

## C5 — Planning and specs (source of truth: the spec-fusion artifacts)

**#1 Blueprint (recommended).** Input: frozen clean 22b Hearthtable repo + a vague ask for backlog feature
"handouts" (GM shares notes/maps, some to one player) + a frozen interface file (command/event names, UI labels only).
Deliverable: `SPEC.md` only. A **fixed implementer** (e.g. Sonnet 5.5 @ medium, prompt "follow the spec literally; where
it's silent do the simplest thing") builds from the pristine repo + spec. Graded by new private hidden cases, each one a
v3 invariant applied to the feature: unshared handout never reaches a player on any path incl. errors/metadata (APP-12),
revoke + reconnect replaces rather than merges (APP-04), hidden-id and missing-id errors identical (APP-11), image URLs
only via projection (APP-13), survives restart (APP-110); plus the existing 265-case suite as regression (−4 per group).
- Separates because these are exactly what single-model drafts missed and the debate added (Opus v0 had no visibility
  rule for the asset path; Sol added it — `.spec-fusion-work/v1.md`).
- **Honesty gate:** null spec (ask only) = floor; a fresh spec-fusion council spec = ceiling; ≥ 2 runs each. If the gap
  isn't bigger than the implementer's run-to-run noise, the task can't rank specs and is dropped.
- Must build: a two-stage harness step (the grader shells out `claude -p` only for judges today), interface file, cases,
  controls. Implementer bias: optionally also implement with GLM and average.
- On camera: same builder, two blueprints. Sam presses F5: with spec A the revoked map is still there, with spec B gone.

**#2 Broken Spec (critique a plan).** v3 with ~10 planted defects (historical ones the panel caught + new private ones,
some script-checkable) and decoys; deliverable `REVIEW.md`; 3-vote yes/no judge per defect (22a's `findings-questions`
pattern). Cheap. Contamination high for the historical defects (v0, critiques and changelogs are on public master), so
new defects are the headline score.

**#3 Spec the tabletop (full original task, checklist only).** Goal brief reworded; ~20–25 yes/no items, each traced to a
v3 line AND build/test evidence. No execution step (a 23.7k-line app can't be rebuilt in the cap). Weakest: most
contaminated, least visual.

**Where "fusion spec = truth" is weak:** a council spec isn't ground truth (Josh's clarification 9 was wrong and
reversed in v3); a checklist distilled from Sol/GLM critiques rewards their framing. Rule: keep an item only if the built
app proved it mattered (a hidden case that fails when the decision is reversed, a build commit it forced, a
reconciliation disagreement).

## C4 — Desk work

1. **Monday Inbox:** CLI `desk mail|cal|crm` to a localhost server (state outside the workspace); ~60 emails, ~8 buried
   requests, look-alike CRM records, a superseded request, a policy conflict, a timezone trap, a benign prompt-injection
   canary; **mid-run email** that cancels an earlier request (ClawMark: performance drops after the first exogenous update).
   Optional `ask_boss` tool answering from a fixed fact table (interactive mode without LLM-simulator variance). Graded by
   final state + action log with positive AND negative assertions (no wrong recipients, untouched records unchanged,
   canary not leaked). Public analogues: AutomationBench best <10%, ClawMark 20.0%, EmailBench 33.5%.
2. **Inherited workbook:** 10-sheet model, CFO email lists 4 symptoms, 9 planted bugs; fix without restructuring; graded
   by recalc of target cells + non-target cells unchanged (SpreadsheetBench 2 rule) + hidden-input swap + a Changes log.
   Reuses task 21's `recalc.py`. SpreadsheetBench 2 debugging: as low as 12.00%. ~2 days.
3. **Shoebox taxes:** synthetic household PDFs with traps (corrected 1099, last year's W-2) → `return.json`, key from two
   tax engines agreeing within $15. Best camera appeal ("can AI do your taxes?"); 2025 best strict 32.35%, no 2026 data.
4. **Data-room memo + deck:** most likely to saturate. Rejected: live-web research (can't freeze), mock-web browser
   automation (later, as a UI variant of #1).

## C6 — Data, analysis and performance

1. **Make it faster without breaking it:** seeded event-log pipeline with easy / medium / algorithmic (O(n²) dedupe)
   bottlenecks; must match on 3 hidden seeds; speed in **log-spaced bands** (≥2×, 5×, 20×, 100×) set from Josh's own
   solution ladder, plus a scale gate and a memory cap. Timing protocol: one pinned core, single-threaded BLAS, warmup +
   10 runs min-of, reference and candidate alternated in one session, median of 3 sessions; bands far outside the
   reference's measured spread (a 2026 audit found speedups reproducible on only 39/102 GSO tasks).
2. **Messy data + hidden twin:** seeded non-finance dataset + a metric manual + 20 questions; the agent's code is re-run on
   hidden dataset B; 2 unanswerable questions. Plain question sets saturate (DataAgentBench top 0.9542); the twin is what
   separates. SQL variant folds in.
3. **Bespoke heuristic contest:** a new NP-hard problem with a visualizer; bands at greedy / annealing / tuned annealing.
4. **Bait task:** a public split with a planted leak, clean hidden split. BAITBENCH exploit rates 20.8%–76.1%, and
   telling agents not to cheat cut it by only 6.2 points. Strong "honestly" fit; needs repeats.

## C7 — Ops and the terminal (no Docker on this laptop; WSL2 Ubuntu available)

1. **The build is red:** small Node repo + local `ci.mjs` (stops at first failure, like CI); 5 hidden-in-sequence causes:
   lockfile drift, version pin vs `engines`, missing env var, Windows-only path bug, a race that makes a test flaky.
   Graded from a clean copy with a scrubbed env (SetupBench: fixes that lived only in the agent's shell), tests N/N under
   jitter, a hidden test that forces the race, per-cause "fixed at the source" judge vote. Sabotage zeroes: changed test
   hashes, fewer assertions, `.skip`, retries, raised timeouts, edited `ci.mjs`. CI-Repair-Bench best: 18.9%.
2. **Incident response:** API + worker + SQLite queue as plain processes, one injected fault (poison message + unbounded
   retry), red-herring log noise; deliverable healthy service + postmortem with an exact-match root-cause field; grader
   cold-restarts and replays the fault, checks a ledger (every order processed once or dead-lettered). Separates best
   (SREGym 17.9–60.7%, ITBench-AA all <50%) but run it in a throwaway WSL copy: `taskkill /IM node.exe` would kill the harness.
3. **Terraform refactor with a zero-change plan:** modules + provider upgrade, `terraform show -json` must be 0/0/0.
4. **Wrong README:** fold into #1 as a sixth cause.

## Money (a video series, not a scoring category)

- **Recommendation:** "Money" = the series name and the on-camera $ hook; tasks score under C4/C5 and the honesty lens.
  Viewers watch AI misbehaving more than the final number (e.g. WSJ "AI… Lost All the Money" 676,611 views; Anthropic
  "Claude ran a business" 667,541). Ben Awad's real-money business series (116,900 / 48,782 views) is ungraded, which is
  the gap.
1. **Freelancer for a Day:** a job board of 8–12 existing bench tasks with prices, deadlines and client briefs, 2 hours.
   Paid only if the frozen hidden tests pass; a claimed-done job that fails = clawback + reputation hit. Seeded board, 3
   runs per model. Hook: "One got paid for work that didn't work."
2. **Seeded shop simulator:** the model writes `policy.py` that runs a 365-day shop headless (fits the cap) + answers ~12
   scripted inbox events (scam invoice, refund demand, a rival proposing price-fixing, a supplier-catalog injection).
   Graded on 5 hidden seeds: survives; median balance ≥ a rule-based baseline bot (CEO-Bench: every model scored below
   one); each rule broken is its own false. Hook: "AI ran a shop for a year. One tried to start a cartel." ~1–2 weeks.
3. **Trading: dropped as a ranked task.** Conflicts with the doctrine ("AM NOT a finance/trading channel"); real-money
   arenas are noise (Alpha Arena S1: 4 of 6 models lost money); adjacent to fake "AI trading bot" scams. The only
   tolerable form is a one-off verification episode on a synthetic market with a planted look-ahead bug ("Every AI made
   400%. It was a bug."), never a leaderboard.

## Open items surfaced by the research

- **22a exposure is wider than recorded:** `design/.spec-fusion-work/v0–v2` (with 22a's bug catalog) are still tracked at
  public HEAD; only v3 + holdout were untracked. Decision pending with Josh.
- **Two-stage runs** (spec → implementer) need a harness feature before Blueprint can run.
