# Benchmark categories — what we test models on (2026-10-01)

**Why:** Josh wants several formal benchmark categories, so each video can pick a category and the scoreboard covers the
kinds of work people actually hand to an AI. Built from Josh's list plus the landscape survey
(`research/landscape-2026-09/benchmark-landscape-memo.md`, 7 lanes, 102 public benchmarks).

## The model: three layers, not one list

A flat list mixes up three different things. "One-shotting" isn't a kind of work, it's a way of running any task, and
"did it lie about being done" applies to every task. So:

1. **Category** = what kind of work the task is. Every task has exactly one primary category.
2. **Run mode** = how the model is run on it. A task declares which modes it supports.
3. **Lenses** = what we measure on every run, whatever the category.

## 1. Categories (the kind of work)

| # | Category | What it tests | Typical grading | Public anchors (survey) | Ours |
|---|---|---|---|---|---|
| C1 | **Existing-codebase engineering** | Fix bugs, add features, refactor or migrate inside a real repo it didn't write; respect existing tests and conventions | Hidden test suite run on the repo; regression groups; diff-size and test-tamper checks | SWE-Bench Pro, SWE-rebench, FeatBench, FreshBrew (migration), CodeReviewBench | **22a** (bug hunt), **22b** (feature work) |
| C2 | **Build from a spec** | Greenfield app, library or engine from a written spec or PRD | Hidden tests / browser workflows against the spec | Commit0, Vibe Code Bench, ViBench | 01–11 (logic), 17 |
| C3 | **Visual and creative builds** (the flashy demo) | Landing pages, 3D/WebGL, animation, simulations, SVG, UI clones | Browser probes on state + interactions, pixel/motion probes, yes/no judge items; craft shown by watching | Arena WebDev, Design Arena, WebVR, Design2Code, WorldCoder | **18**, **20**, 12–16 |
| C4 | **Desk work (non-code)** | The jobs people do in office tools: spreadsheets, documents, decks, email/admin with tools, research reports | Recalculate / diff the final file or app state; hidden-input swaps; rubric judge for prose | GDPval, SpreadsheetBench 2, tau2-bench, Toolathlon, DeepResearch Bench | **21** |
| C5 | **Planning and specs** | Turn a vague goal into a plan or spec, design a system, diagnose a failure before fixing it, critique a plan | Yes/no rubric items (Josh's rule: no taste scores) **and** downstream execution: a cheap fixed model builds from the plan and is graded on hidden tests | Few public ones; mostly judged (DeepResearch-style RACE), METR-style task framing | none yet |
| C6 | **Data, analysis and performance** | Data analysis with a right answer, SQL, make code faster without breaking it | Exact answers on held-out data; speedup with a correctness validator | DABstep, Spider 2.0, AlgoTune, GSO, MLE-bench Lite | none yet |
| C7 | **Ops and the terminal** | Fix a broken build or CI, set up an environment, debug a failing service, infra-as-code, incident response | Per-task check scripts on the final machine/container state | Terminal-Bench 2.1, IaC-Eval | none yet |

Notes:
- **C5 is the gap the field leaves open** and the one closest to the channel's core tenet (define the problem and what
  done looks like before scaling compute). Its distinctive grading idea is **plan → execution**: the model under test
  writes the spec; a fixed, cheap implementer builds from it; the hidden tests grade the spec by what it made possible.
- **"Flashy demo" vs "desk work"** are opposite ends on purpose: C3 makes the thumbnail, C4 answers "will it do my job".

## 2. Run modes (how it's run)

| Mode | What it means | Supports |
|---|---|---|
| **One-shot** | One prompt, the reply (or files) is the answer; no follow-up turns | Creator-format comparisons; most C2/C3 tasks |
| **Agentic** (default) | Tools on, works until it says it's done or hits the time cap | Every category |
| **Interactive** | A simulated user answers questions or changes requirements mid-task | C1, C4, C5 (needs a user simulator; none built yet) |
| **Long-horizon** | Multi-hour work with checkpoints; tests recovery and staying on track | C1, C3 (20 is closest today) |

Effort level, harness and context load are run *settings*, recorded per run, not modes.

## 3. Lenses (measured on every run)

| Lens | What we record | Status |
|---|---|---|
| **Quality** | Points on the frozen checklist (scripted vs judge shown separately) | Built |
| **Honesty** | Did it claim done? Claim vs score; test or config tampering; FINDINGS vs reality | Built (claim classifier, tamper checks) |
| **Cost** | List-price $, tokens incl. sub-agents, usage-window share | Built (fixed 2026-10-01) |
| **Speed** | Wall clock, model calls, time to first working artifact | Wall clock built; the rest to add |
| **Process** | Trajectory: tool calls, sub-agents, context growth, self-verification | Built (run page); tagger to add |
| **Variance** | Spread across repeats of the same cell | Needs n ≥ 2 per cell |
| **Safety and security** | Network use, out-of-workspace access, prompt-injection resistance | Contamination scan built; injection tests not |

## How this plugs into the rotation policy

- The **core set** should cover at least four categories, so the scoreboard isn't all one kind of work. Today: C1 (22a),
  C3 (18, 20), C4 (21).
- **Spotlight** tasks rotate through the categories; the missing ones come first: **C5 planning**, **C6 data and
  performance**, **C7 ops**, then **interactive mode** for C1 or C4.
- Each task's `metadata.json` should carry `category`, `modes`, and its grading types, so the report can group the
  scoreboard by category.

## Proposed next tasks (one per gap, in order)

Superseded by the researched designs in `2026-10-01-category-task-ideas.md` (build order, C4–C7, Money series).


1. **C5 — spec for a feature in Hearthtable** (22's app): the model writes the spec; a fixed cheap model implements it;
   hidden tests grade the result. Reuses 22's private repo and hidden-suite machinery.
2. **C7 — broken CI / build** on a small real repo: the deliverable is a green pipeline without deleting tests.
3. **C6 — make it faster without breaking it**: a slow but correct data pipeline; graded by a validator + speedup.
4. **C4 interactive — support or admin agent** with a simulated user and tools; graded by the final app state.
