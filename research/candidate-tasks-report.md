# Candidate Tasks for Vetted Bench — Deep-Research Report

**Date:** 2026-07-12 · **Method:** /deep-research workflow — 5 search angles, 21 sources fetched, 103 claims extracted, top 25 adversarially verified (3 skeptic votes each): **21 confirmed, 4 refuted, 0 unverified**. Every claim below survived verification; refuted claims are listed at the bottom so they don't get reused.

**Question:** find 10-20 more benchmark tasks where the spec AND the acceptance criteria are already defined by other people (community-canonical prompts, published eval suites, official rule sets) — so the human never invents the "correct answer."

---

## Recommended shortlist (~10, complementing the existing 6)

> Synthesis-confidence: the underlying facts are all 3-0 verified; the *selection* is the workflow's judgment.

| # | Task | Type | Spec/criteria source | Why it complements the 6 |
|---|------|------|---------------------|--------------------------|
| 1 | **Exercism `bowling`** — bowling-score engine | A (logic) | polyglot-benchmark repo (spec + shipped unit tests) | Gnarlier state than tennis/habit: strikes/spares/10th-frame |
| 2 | **Exercism `poker`** — hand ranking per official rules | A (logic) | polyglot-benchmark repo | Pure rules-logic, unit-test graded |
| 3 | **Exercism `forth`** — mini stack-language interpreter | A (logic) | polyglot-benchmark repo | Parsing + state machines — an axis none of the 6 cover |
| 4 | **Exercism `zebra-puzzle`** — constraint solver | A (logic) | polyglot-benchmark repo | Harder sibling of sudoku |
| 5 | **EvalPlus slice** — HumanEval+/MBPP+ subset | A (test-suite) | evalplus (80x/35x expanded tests) | The base-vs-plus score DROP detects subtly-wrong code |
| 6 | **"Build a game of chess"** — one-shot playable web game | B (game) | WebDev Arena canonical prompt | Judge blind A/B + a legal-moves checklist |
| 7 | **"Create a Hacker News clone"** — one-shot web app | B (web app) | WebDev Arena canonical prompt | Largest-category canonical prompt; UI/layout axis |
| 8 | **Wordle clone** (or Tetris) — one-shot browser game | B (game) | Artificial Analysis MicroEvals gallery | Implicitly-known rules, single HTML file |
| 9 | **Minecraft 3D clone** — Three.js one-shot | B (3D) | MicroEvals gallery | 3D rendering/controls, widely replicated across models |
| 10 | **Budget Tracker / Gantt chart** — small CRUD web app | B (web app) | MicroEvals gallery | CRUD + UI state — an app-type gap in the current 6 |

**Plus two upgrades to existing tasks (verified, high-value):**
- Adopt the **KCORES 90-point/18-category rubric verbatim** for the existing bouncing-balls task (our task is near-identical to their canonical heptagon prompt).
- Apply **Willison's animal/vehicle-swap variant** to the pelican task — his own documented contamination defense.

---

## Verified source families

### 1. Aider polyglot benchmark — the strongest "spec by others" source (HIGH, 3-0)
225 Exercism problems across exactly C++, Go, Java, JavaScript, Python, Rust, in a public repo; each problem is individually extractable as a standalone locally-runnable task **with pre-written test files**. Correctness judged automatically by unit tests. The 225 were selected for discriminative power: aider ran 7 top models against all 697 Exercism problems in those languages and kept only those solved by ≤3 models. Spot-checked `python/exercises/practice/bowling`: stub + `bowling_test.py` + `.docs/` instructions.
Sources: [repo](https://github.com/Aider-AI/polyglot-benchmark) · [blog](https://aider.chat/2024/12/21/polyglot.html) · [benchmark README](https://github.com/Aider-AI/aider/blob/main/benchmark/README.md)
Caveat: selection is Dec-2024 vintage — separates mid-tier from frontier better than frontier-vs-frontier today.

### 2. Exercism problem-specifications — the upstream canonical spec store (HIGH, 3-0)
151 exercise directories, all with community-written prose specs; **142/151 (94%) with machine-readable `canonical-data.json`** test inputs/outputs — both "what to build" and "what's correct" pre-defined. Actively maintained (2,840 commits, 3-review merge policy). Verified-extractable candidates: bowling, poker, forth, zebra-puzzle, affine-cipher.
Source: [problem-specifications](https://github.com/exercism/problem-specifications)
Caveat: `canonical-data.json` is test DATA needing trivial translation into a runner, not ready-to-run tests.

### 3. EvalPlus (HumanEval+ / MBPP+) — rigor-drop as the discriminator (HIGH, 3-0)
80x / 35x expanded unit-test suites over the two canonical codegen benchmarks; the **score drop from base→plus** exposes models producing subtly wrong code (expanded tests cut pass@k by up to 19.3-28.9% per the NeurIPS 2023 paper). Public before/after leaderboard.
Sources: [PyPI](https://pypi.org/project/evalplus/) · [leaderboard](https://evalplus.github.io/leaderboard.html)
Caveats: the "one pip install, runs locally on Windows" claim was **REFUTED (0-3)** — verify Windows runnability (may need WSL). Benchmark is aging (saturation/contamination critiques; LiveCodeBench positioned as successor).

### 4. KCORES llm-arena spinning-heptagon — canonical prompt + published rubric (HIGH, 3-0)
Exact canonical prompt: single-file Python, 20 numbered same-radius balls in a spinning heptagon; **pygame banned**, allowlist (tkinter, math, numpy, dataclasses, typing, sys) forces hand-written collision physics. Correctness = published **90-point rubric (18 categories × 5 pts)** judged by manual visual assessment at 2K full-screen. Demonstrated spread: GPT-4.5-Preview 90/90 → Claude-3.7/DeepSeek-R1/Gemini-2.5-Pro 88/90 → GPT-4.1-nano 30/90 → ERNIE-4.5 23/90 → Doubao-1.5-pro 18/90.
Source: [KCORES README](https://github.com/KCORES/kcores-llm-arena/blob/main/benchmark-ball-bouncing-inside-spinning-heptagon/README.md)
Caveats: scores are Mar-Apr 2025 vintage (top compressed 88-90 now); HIGH contamination risk from mass replication → main value for us is **retrofitting the rubric onto our existing balls task**, plus personal variants (polygon sides / ball count).

### 5. Willison's pelican-on-a-bicycle — validates our existing task + its judging method (HIGH, 3-0)
The canonical prompt is exactly: *"Generate an SVG of a pelican riding a bicycle."* Chosen explicitly for contamination avoidance ("I'm pretty sure there aren't any pelican on a bicycle SVG files floating around (yet)"). **No rubric or tests exist** — community-accepted judging is subjective visual comparison, later semi-automated by Willison as LLM-judged pairwise A/B (GPT-4.1-mini over ~560 image pairs → Elo). He himself expects benchmaxxing; the documented defense is **swapping the animal/vehicle pair**.
Sources: [2024 post](https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/) · [repo](https://github.com/simonw/pelican-bicycle) · [6-months-in-LLMs](https://simonwillison.net/2025/Jun/6/six-months-in-llms/)

### 6. WebDev Arena — blind-A/B one-shot web apps (HIGH, 3-0)
One prompt → two anonymous LLMs build working apps → community votes (Bradley-Terry, 80k+ votes). Published prompt analysis names directly reusable canonical prompts: **"Build a game of chess," "Create a Hacker News clone," "Design a modern Twitter profile layout"**; top categories Website Design 15.3%, Game Development 12.1%, Clone Development 11.6%.
Sources: [arena.ai blog](https://arena.ai/blog/webdev-arena/) · [Epoch AI](https://epoch.ai/benchmarks/webdev-arena)
Caveats: judging is human preference voting — not locally reproducible; substitute our blind A/B or a checklist. The three prompts are representative examples of top categories, not literally the most-submitted. Early-2025 snapshot; platform folded into Code Arena.

### 7. Artificial Analysis MicroEvals — a ~280-eval community prompt gallery (HIGH, 3-0)
First-party platform hosting community-created one-shot prompts run side-by-side across 80+ models: SVG one-shots, p5.js physics, Three.js fractals, browser games (Tetris, Wordle, Snake, Minecraft-3D, arcade racers), small web apps (budget tracker, Gantt chart, HN clone, Spotify clone, dashboards). Verified live 2026-07-12; every named eval confirmed present.
Source: [microevals](https://artificialanalysis.ai/microevals)
Caveat: supplies PROMPTS only — the "thumbs-up voting = acceptance" claim was **REFUTED (1-2)**; judging there is informal eyeballing. Pair each adopted prompt with a KCORES-style rubric or our own vetted tests.

---

## Run-level caveats (from the verification pass)

1. **Judging-rigor split:** only Exercism/aider-polyglot and EvalPlus give locally runnable, objective unit-test grading. KCORES = manual visual rubric; WebDev Arena / MicroEvals / pelican = preference A/B a solo user can't reproduce as-is.
2. **Contamination is HIGH for the most canonical prompts** (KCORES heptagon, pelican) — personal variants are effectively mandatory for 2026 frontier models.
3. **Discrimination data is time-anchored** (aider ≤3-of-7 is Dec-2024; KCORES Mar-Apr 2025) — these tasks separate mid-tier from frontier better than frontier-vs-frontier.
4. **Refuted specifics — do not reuse:** the "5-50% calibration band" and the "258 solved-by-all / 66 solved-by-none" exclusion counts both failed verification (fabricated-looking), as did EvalPlus one-command Windows grading and MicroEvals thumbs-up-as-acceptance.

## Open questions

1. **Agentic bug-fix axis has zero verified coverage** — the one requested type not filled. Candidates to research: SWE-bench Lite/Verified single instances, aider's refactoring benchmark; need a small, locally runnable Windows-friendly slice.
2. Can EvalPlus actually be graded locally on Windows, or does it require WSL/Linux?
3. Does any community-published per-task checklist exist that converts WebDev Arena/MicroEvals crowd votes into locally checkable criteria?
4. How much difficulty do personal-variant transformations preserve (heptagon→nonagon, pelican→other animal)? No published evidence found on which variant axes defeat memorization without changing hardness.

## Additional sources fetched (secondary, informed the search but claims not in the verified top-25)

kata-log.rocks (Bowling Game / Mars Rover / Poker Hands / Gilded Rose katas) · codingdojo.org/kata (70+ katas) · tddbuddy.com/katas (73 katas in 3 difficulty tiers, incl. Tennis Score) · chessprogramming.org/Perft_Results (canonical perft node counts = ready-made acceptance data for a chess move generator) · handbook.fide.com (official Laws of Chess) · SWE-bench Lite overview (emergentmind) · gally.net pelican-alternatives · Willison "training for pelicans" (2025-11) · nawaz.org pelican-raytracer variant · mbrenndoerfer.com contamination survey.
