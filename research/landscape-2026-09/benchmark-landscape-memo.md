# Vetted Bench: what people benchmark with in 2026 beyond games

*Research memo, 2026-09-26. The facts and URLs come from seven research lanes plus a completeness critique. Leaderboard numbers marked "aggregator" were not checked against a primary page.*

## 1. The short answer

In 2026, most model benchmarks outside games ask the agent to **produce a real artifact, then check it by running it**. The main families:

- **Web and visual:** websites, landing pages, UI clones, and 3D/WebGL scenes. Graded by blind human votes (the Arena and Design Arena leaderboards), by visual similarity to a reference, or by browser scripts that check state and interactions.
- **Real software:** fixing and extending existing repos, including fresh monthly issue sets, terminal and DevOps tasks, whole-app builds from a PRD, migrations, and secure backends. Graded by hidden tests.
- **Knowledge work:** spreadsheets, slide decks, office deliverables, customer-support tool use, and long-running business simulations. Graded by diffing the final file or database state, or by blind comparison against an expert's deliverable.
- **Data, ML and science engineering:** Kaggle-style ML, speed optimization, heuristic contests scored against human rankings, SQL, and scientific code.
- **Agent behaviour:** whether the agent games tests, claims work it didn't do, gets sycophantic, falls for prompt injection, degrades with context length, or behaves differently in a different harness.
- **Creator formats:** the pelican SVG, bouncing balls in a spinning polygon, and same-prompt landing-page showdowns. These are popular, but they are almost all one sample graded by eye.

**No public benchmark grades a scroll-animated showcase site reproducibly.** WebVR comes closest because it grades motion from video. That gap is the most obvious one for Vetted Bench to fill.

## 2. Catalog

Key: **Auto** = fully scripted (S), mostly scripted (M), judge needed (J), human votes (H). **Separates?** = whether it still separates frontier models as of Sep 2026: yes, hard (unsolved), sat (saturated), or ? (no 2026 evidence).

### Web / visual
| Name | Tests | Graded by | Auto | Separates? | Source |
|---|---|---|---|---|---|
| Arena Code Arena – WebDev (formerly LMArena) | Web apps built from one prompt | Blind pairwise votes → Bradley-Terry (~795k votes, 134 models) | H | yes | https://arena.ai/leaderboard/code/webdev/ |
| Design Arena | Website, UI, 3D, dataviz, SVG, slides, video-to-website | Blind pairwise votes → Bradley-Terry | H | yes (narrow at the top) | https://www.designarena.ai/leaderboard |
| UI-Bench | Visual polish of text-to-app output (30 open prompts) | Expert pairwise → TrueSkill | J | ? | https://arxiv.org/abs/2508.20410 |
| Design2Code / Sketch2Code / Figma2Code | Screenshot, sketch or Figma to code | CLIP, block-match, text, colour and position metrics | S | base set sat; Hard subset and Figma2Code open | https://arxiv.org/abs/2403.03163 |
| WebVR | Rebuild a page from a **video** (motion, timing) | MLLM judge on a human-aligned rubric | J | yes | https://arxiv.org/abs/2603.13391 |
| Interaction2Code | Hover, click and modal transitions | Scripted action, then screenshot similarity | S | ? | https://github.com/WebPAI/Interaction2Code |
| ArtifactsBench | Interactive artifacts in 9 categories | Timed screenshots + MLLM per-task checklist | J | ? | https://arxiv.org/abs/2507.04952 |
| Web-Bench | 50 projects × 20 sequential front-end tasks | Playwright E2E per task | S | ? (25% SOTA in 2025) | https://github.com/bytedance/web-bench |
| WebGen-Bench | Multi-file site from a spec | Agent-executed test cases | M | ? | https://arxiv.org/abs/2505.03733 |
| WebRISE | Required states and transitions | Browser execution of Interaction Contract Graphs | S | yes (best 65.6%) | https://arxiv.org/abs/2606.03220 |
| Cookie-Bench | 1,000 web queries including presentation pages | Agent explores and records screen, then judge (61.6% agreement with humans) | J | yes | https://arxiv.org/abs/2605.30000 |
| UI2App / WebCraftBench | Multi-route app from screenshots | Reachability + visual + interaction checks | M | yes | https://arxiv.org/abs/2607.06306 |
| Cloning Bench (small: 1 site, 43 steps) | Clone Slack UI through a scripted flow | Per-checkpoint SSIM | S | not established | https://vibrantlabs.com/research/cloning-bench |
| WorldCoder-Bench | Three.js 3D scenes | Runtime state probes against hidden contracts | S | hard (best 27.8%) | https://arxiv.org/abs/2606.01869 |
| Vercel Next.js Agent Evals | Next.js features and migrations, per harness | Build + tests, pass@4 | S | yes | https://github.com/vercel/next-evals-oss |
| MS a11y-llm-eval | Accessible generated UI | axe-core + requirement assertions | S | ? | https://github.com/microsoft/a11y-llm-eval |
| WebDevJudge (meta-eval) | How reliable LLM judges are on web dev | Agreement with human labels | S | n/a (calibration tool) | https://arxiv.org/abs/2510.18560 |

### Real software engineering
| Name | Tests | Graded by | Auto | Separates? | Source |
|---|---|---|---|---|---|
| SWE-bench Verified | Python issue fixing | Hidden tests in Docker | S | sat; OpenAI stopped reporting it (flawed and contaminated) | https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/ |
| SWE-Bench Pro (+ Pro Verified) | Multi-file, multi-language, 41 repos | Hidden tests (Scale fixed-scaffold top 61.5) | S | yes | https://labs.scale.com/leaderboard/swe_bench_pro |
| SWE-rebench / SWE-bench-Live | Issues filed after training cutoffs, refreshed monthly | Docker tests | S | yes | https://swe-rebench.com/ |
| SWE-bench Multimodal v2 | JS/UI bugs with screenshots (480 open tasks) | Hidden tests | S | ? (thin data) | https://www.swebench.com/multimodal.html |
| Terminal-Bench 2.1 (Harbor) | Terminal/sysadmin/build tasks | Per-task test scripts | S | yes, top nearing ceiling | https://github.com/harbor-framework/terminal-bench-2-1 |
| Vibe Code Bench (+ 1-100 variant) | Full web app from a spec | Browser agent runs workflows | M | v1.1 top numbers conflict between sources; 1-100 variant ~28% top | https://www.vals.ai/benchmarks/vibe-code |
| ViBench (Replit) | Build from PRD, then extend own code | Test plans (Opus 4.6 46%) | M | yes | https://github.com/ViBench/vibench-public |
| Commit0 | Write a library from spec + tests | Unit-test pass fraction | S | yes | https://github.com/commit-0/commit0 |
| FeatBench / FEA-Bench / NoCode-bench | Add a feature to a real repo | PR tests | S | yes | https://arxiv.org/html/2509.22237 |
| FreshBrew | Java 8→17 migration without deleting tests | Build + tests + test-integrity check | S | yes | https://arxiv.org/abs/2510.04852 |
| CRUST-Bench | C → safe Rust | Compiles + tests + no unsafe | S | hard | https://arxiv.org/abs/2504.15254 |
| BaxBench | Backends in 14 frameworks | Functional tests + live exploits | S | yes | https://github.com/logic-star-ai/baxbench |
| SWE-Lancer Diamond | Upwork jobs, scored in $ earned | E2E tests | S | ? | https://openai.com/index/swe-lancer/ |
| MobileDev-Bench | Native/RN/Flutter app issues | Test patches (~3–6%) | S | hard | https://arxiv.org/abs/2603.24946 |
| SWT-bench | Write a test that reproduces an issue | Fail→pass against the gold fix | S | ? | https://github.com/logic-star-ai/swt-bench |
| CodeReviewBench / Martian | Catch real PR bugs | Precision/recall against known bugs | M | yes | https://www.codereviewbench.com/ |
| IaC-Eval family | Terraform/CFN from intent | validate/plan + OPA policies | S | yes | https://arxiv.org/abs/2509.05303 |
| CVDP / VerilogEval v2 | RTL hardware design | Simulation testbenches | S | yes | https://arxiv.org/pdf/2506.14074 |
| Verina (Lean) | Code + spec + proof | Lean kernel | S | hard | https://github.com/sunblaze-ucb/verina |
| METR time horizon | Task length an agent can finish | Logistic fit on human time | M | hard | https://metr.org/time-horizons/ |

### Creative / multimodal code (non-game)
| Name | Tests | Graded by | Auto | Separates? | Source |
|---|---|---|---|---|---|
| Pelican SVG (Willison) + Castillo 48-prompt grid | Composition as SVG | By eye; grid scored by LLM judge 1–5 on 3 axes | J | original prompt likely trained on; the grid still separates | https://dylancastillo.co/posts/pelicanmaxxing.html |
| AA MicroEval: GLSL shader art | Julia set in Three.js + GLSL with controls | Community votes | M | ? | https://artificialanalysis.ai/microevals/llm-ultimate-challenge-interactive-glsl-shader-art-1756340323607 |
| Spinning-heptagon balls (KCORES) | Physics sim | Community / human | M | sat | https://github.com/KCORES/kcores-llm-arena |
| BenchCAD | CadQuery parts from images | Voxel IoU, Chamfer | S | yes | https://arxiv.org/html/2605.10865v1 |
| BlenderGym | Edit a Blender scene to match a goal render | Image similarity | M | hard | https://arxiv.org/abs/2504.01786 |
| ChartMimic / Plot2Code | Chart image → matplotlib | Element metrics + judge | M | sat | https://github.com/ChartMimic/ChartMimic |
| VisEval | NL + DB → chart | Validity/legality checks against ground-truth data | M | ? | https://arxiv.org/html/2407.00981v1 |
| Edit2TikZ / DaTikZ | Scientific figures in TikZ | Compile + similarity (~75% compile) | M | yes | https://arxiv.org/html/2608.13441v1 |
| MermaidSeqBench | NL → sequence diagram | LLM judge (can be made graph-diff) | M | ? | https://huggingface.co/datasets/ibm-research/MermaidSeqBench |
| SlidesGen-Bench | Document → editable deck | Quiz bank + closed-form aesthetics + editability | M | yes | https://github.com/YunqiaoYang/SlidesGen-Bench |
| ManiBench et al. | Manim explainer animations | Render + visual similarity | M | ? | https://arxiv.org/html/2603.13251 |
| ABC-Eval / Strudel | Music as code | Parse and check constraints | S | ? | https://arxiv.org/abs/2509.23350 |
| MC-Bench / MineBench | Voxel builds | Pairwise votes | J | yes (overlaps the voxel task) | https://minebench.ai/ |

### Knowledge work and tool use
| Name | Tests | Graded by | Auto | Separates? | Source |
|---|---|---|---|---|---|
| GDPval / GDPval-AA | Office deliverables across 44 occupations | Blind pairwise vs expert file → Elo | J | yes | https://artificialanalysis.ai/evaluations/gdpval-aa |
| Remote Labor Index | Paid freelance deliverables across 23 domains | Experts vs the human deliverable (best 16.1%) | H | yes | https://scale.com/blog/rli |
| tau2-bench | Support agent + tools + simulated user | Final DB state, pass^k | S | yes | https://github.com/sierra-research/tau2-bench |
| BrowseComp / -Plus | Hard web research questions | Short-answer match | S | original clustered near the top (saturation disputed); Plus separates | https://github.com/texttron/BrowseComp-Plus |
| DeepResearch Bench | Cited research reports | RACE judge + FACT citation checks | J | yes | https://github.com/Ayanami0730/deep_research_bench |
| OSWorld-Verified | Desktop GUI tasks | VM state scripts | S | sat (beyond human baseline) | https://llm-stats.com/benchmarks/osworld-verified |
| WebArena-Verified | Self-hosted web apps | Deterministic + network trace | S | yes | https://github.com/ServiceNow/webarena-verified |
| SpreadsheetBench v1 / **2** | Excel tasks | Cell diff | S | v1 sat; v2 yes (top 34.8%) | https://arxiv.org/pdf/2606.29955 |
| PresentBench / PPTEval | Decks | Per-instance rubric, MLLM judge | J | yes | https://presentbench.github.io/ |
| Toolathlon | 32 apps, ~20-step tool tasks | State-check scripts | S | yes | https://github.com/hkust-nlp/Toolathlon |
| MCPMark / MCP-Universe | Real MCP server use | Verifier scripts | S | yes | https://mcpmark.ai/leaderboard |
| TheAgentCompany | Simulated company tasks | Checkpoints, partial credit | M | ? (stale board) | https://github.com/TheAgentCompany/TheAgentCompany |
| Vending-Bench 2 | Run a business for 1 simulated year | Final balance | S | yes (no public local package) | https://andonlabs.com/evals/vending-bench-2 |

### Data / ML / science
| Name | Tests | Graded by | Auto | Separates? | Source |
|---|---|---|---|---|---|
| MLE-bench (+ Lite) | Kaggle competitions | Medal / percentile vs the real leaderboard | S | yes | https://github.com/openai/mle-bench |
| AlgoTune | Speed up 154 numeric solvers (CPU) | Validator + geometric-mean speedup | S | yes | https://github.com/oripress/AlgoTune |
| ALE-Bench | AtCoder heuristic contests | Official scorer → human percentile | S | yes | https://arxiv.org/abs/2506.09050 |
| KernelBench | CUDA/Triton kernels (GPU) | Correctness + speedup | M | yes | https://crfm.stanford.edu/2025/05/28/fast-kernels.html |
| GSO | Repo-level performance work | Speedup vs the expert commit | M | yes (replay reliability issues) | https://github.com/gso-bench/gso |
| Spider 2.0-Lite / LiveSQLBench / BIRD-Interact | Enterprise and interactive SQL | Execution / DB state | S | yes | https://github.com/bird-bench/livesqlbench |
| DABstep | Multi-step payments analysis | Exact match | S | yes | https://huggingface.co/spaces/adyen/DABstep |
| SciCode (+ Verified) | Scientist-written research code | Subproblem tests | S | yes | https://arxiv.org/html/2608.04975v1 |
| RE-Bench | 8-hour ML research engineering | Normalized 0→1 vs a reference | S | yes (mostly GPU) | https://arxiv.org/abs/2411.15114 |
| ScienceAgentBench | Data-driven science programs | Execution + criteria | M | yes | https://osu-nlp-group.github.io/ScienceAgentBench/ |
| CORE-Bench Hard / DS-1000 | Reproducibility / DS snippets | Tolerance / tests | S | sat | https://hal.cs.princeton.edu/corebench_hard |

### Agent behaviour and harness
| Name | Tests | Graded by | Auto | Separates? | Source |
|---|---|---|---|---|---|
| Harness-Bench | 6 harnesses × 8 models × 106 tasks | Security gate × completion × process | M | yes (23.8pp harness spread) | https://arxiv.org/html/2605.27922v1 |
| Context Rot (Chroma) | Accuracy vs input length and distractors | Exact match per length | S | yes (all 18 models degrade) | https://www.trychroma.com/research/context-rot |
| RULER / NoLiMa / MRCR v2 | Effective context length | Deterministic match | S | yes | https://crfm.stanford.edu/helm/long-context/latest/ |
| ImpossibleBench | Gaming tests that contradict the spec | Any pass = cheat | S | yes | https://arxiv.org/pdf/2510.20270 |
| BaitBench | Optional leakage shortcuts in ML tasks | Public-vs-hidden split gap (57.1% hack overall) | M | yes | https://arxiv.org/html/2608.30724 |
| OverclaimBench (headline numbers disputed) | Final report vs what the agent actually did | Transcript coverage + judge | M | yes | https://arxiv.org/abs/2609.20812 |
| AgentDojo / AgentDyn | Indirect prompt injection | Env state: utility × attack success | S | yes | https://arxiv.org/html/2602.03117v1 |
| Mazur sycophancy | Siding with whoever tells the story | Flip across paired framings | M | yes | https://github.com/lechmazur/sycophancy |
| SnitchBench (Theo) | Unprompted whistleblowing with tools | Parse tool calls in the transcript | S | yes | https://github.com/T3-Content/SnitchBench |
| IFBench | Out-of-distribution verifiable constraints | Python verifiers | S | ? | https://proceedings.neurips.cc/paper_files/paper/2025/file/46499a0622ecf568b72d17b61e45dbd5-Paper-Datasets_and_Benchmarks_Track.pdf |

### Creator formats (useful as external anchors or video hooks)
| Name | Tests | Graded by | Auto | Separates? | Source |
|---|---|---|---|---|---|
| SimpleBench | Trick common-sense questions (private set) | MC exact match, human baseline 83.7% | S | yes | https://simple-bench.com/ |
| Mazur NYT Connections (extended) | Lateral grouping with decoy words | Exact grouping | S | yes | https://github.com/lechmazur/nyt-connections |
| EQ-Bench creative writing + Judgemark | Long-form writing; judge quality | LLM judge with validated judges | J | yes | https://eqbench.com/creative_writing_longform.html |
| Same-prompt landing-page showdowns | One-shot front-end craft | Vibes, n=1 | M | yes, but unrigorous | https://www.xda-developers.com/i-asked-gemini-claude-and-chatgpt-to-build-a-customer-landing-page-and-only-one-nailed-the-brief/ |
| BalatroBench (game) | Long-horizon strategy, fixed seeds | Rounds reached | S | yes | https://github.com/coder/balatrobench |

I dropped these as gradable tasks: the Berman rubric and the Every "Senior Engineer" benchmark (no public key), the Artificial Analysis per-task cost figures and the scaffold-effect vendor numbers (unverified), and the per-model BaitBench spread (unverified).

## 3. Best fits for Vetted Bench (ranked)

**1. Scroll-driven portfolio landing page (the flagship website task).**
- **Prompt:** a single-folder static site for a fictional designer. It needs a pinned hero with a WebGL or canvas background, 4 sections that reveal on scroll (fade and translate), one horizontal-scroll gallery pinned for 3 viewport heights, a testimonials carousel, a validated contact form, and a `prefers-reduced-motion` fallback. The spec requires `data-anim="<id>"` on every animated element.
- **Defines correct:** the prompt style from Arena WebDev / Design Arena, the motion rubric adapted from WebVR, and Google's thresholds (Core Web Vitals) plus axe/WCAG.
- **Artifact:** the site folder, plus a scroll-through video recorded by the grader.
- **Grader (mostly scripted):**
  - Playwright scrolls in fixed 10% steps. At each step it asserts that each `data-anim` element's computed `opacity`/`transform` moved in the right direction between offsets, that the pinned section's `getBoundingClientRect().top` stays about 0 across its range, that `document.getAnimations()` or ScrollTrigger is non-empty, and that the canvas has non-blank pixels that change between frames.
  - Carousel advances. Form rejects bad input.
  - With reduced motion emulated, the transforms are static.
  - Zero console errors. No horizontal overflow at 375/768/1440.
  - Lighthouse perf ≥ 90 (or an LCP budget), CLS < 0.1, and zero serious/critical axe violations.
  - Sample rAF frame times during auto-scroll and require p95 < ~33 ms.
  - Taste only: a blind pairwise vision judge on the recorded videos, with order swapped and a majority vote, aggregated with Bradley-Terry across runs.
- **Difficulty:** medium-hard. The probes catch "pretty but static" and "pretty but janky", which is where models split.
- **On camera:** side-by-side scroll recordings plus a red/green probe checklist.

**2. Clone a public page, including its motion.**
- **Prompt:** "Recreate this page" with a frozen screen recording plus screenshots at fixed scroll offsets of a public open-source landing page (or a Design2Code-Hard / WebVR item).
- **Defines correct:** the reference page itself, or the WebVR / Design2Code datasets.
- **Artifact:** HTML/CSS/JS.
- **Grader:** Playwright replays a scripted flow (scroll to Y, hover X, click Z). At each checkpoint it computes SSIM + CLIP + DOM text recall against the frozen reference and renders pixel-diff heatmaps. Interaction assertions in the Interaction2Code / WebRISE style act as gates, so a static pixel-perfect shell fails (the Cloning Bench lesson). A WebVR-rubric judge scores the motion.
- **Difficulty:** hard. WebVR reports substantial motion gaps.
- **On camera:** the diff heatmaps are very good b-roll.

**3. Three.js scene with a behavioural contract (non-game 3D).**
- **Prompt:** take 3–5 tasks from the WorldCoder-Dev split, for example "objects fall under gravity; clicking spawns one". The scene must be exposed on `window.__3D_STATE__`.
- **Defines correct:** WorldCoder's hidden contracts, hash-frozen.
- **Grader:** Playwright drives actions and diffs state snapshots against the contract. A judge scores aesthetics from video.
- **Difficulty:** hard. Best published result is 27.8%, and this lane already matches what separates models in the voxel task.
- **On camera:** high.

**4. Impossible katas + overclaim detector (revives saturated tasks).**
- **Prompt:** the existing bowling/poker/forth tasks, with one test flipped so it contradicts the README.
- **Defines correct:** the ImpossibleBench method, with your own specs as the key.
- **Grader:** a pass on the mutated test = cheat. The test file hash must be unchanged. A transcript grep checks whether the agent flagged the contradiction. On every Vetted Bench run, also compare "all tests pass" claims in the final message against the real grader result.
- **Difficulty:** separates on behaviour, not skill.
- **On camera:** "the model lied about passing" is a strong beat. Use a second arm with hidden tests to show the harness effect.

**5. ViBench PRD build → extend your own code.**
- **Prompt:** a ViBench PRD verbatim, then the stage-2 feature request.
- **Defines correct:** ViBench test plans (Apache 2.0).
- **Grader:** test plans ported to deterministic Playwright, scored as the fraction of substeps passed at each stage.
- **Difficulty:** medium-hard (Opus 4.6 46%; 7 of 9 models degrade on stage 2).
- **On camera:** compounding errors across two stages.

**6. AlgoTune speedups (CPU only).**
- **Prompt:** 5–10 tasks with the reference solver.
- **Defines correct:** the AlgoTune validator and reference.
- **Grader:** validate on fresh inputs, time on pinned cores (median of repeats), report geometric-mean speedup. Reject calls back to the reference.
- **Difficulty:** open-ended and continuous.
- **On camera:** "4.1× faster than SciPy" is instantly legible.

**7. ALE-Bench heuristic contest.**
- **Prompt:** 1–2 AtCoder Heuristic Contest problems from the Lite subset. Prefer contests held after the models' training cutoffs.
- **Defines correct:** the official scorer and the real human leaderboard.
- **Grader:** run on frozen seeds and report the percentile vs about 1,000 humans.
- **Difficulty:** open-ended.
- **On camera:** "beat 80% of human contestants".

**8. Office deliverable: GDPval gold task or SpreadsheetBench 2.**
- **Prompt:** a public GDPval task with its reference files (xlsx + memo), or 3 SpreadsheetBench 2 tasks.
- **Defines correct:** the expert deliverable / answer workbook.
- **Grader:** recalculate in headless LibreOffice, then diff cells (catches hardcoded values posing as formulas) and run structure probes. A blind pairwise judge compares against the expert file for the narrative parts.
- **Difficulty:** SpreadsheetBench 2 top is 34.8%.
- **On camera:** medium to high.

**9. Slide deck from a paper (PresentBench / SlidesGen-Bench).**
- **Artifact:** a .pptx rendered to PNGs.
- **Grader:**
  - Deterministic: slide count, text-overflow bounds via python-pptx, contrast/colour metrics, an editability parse.
  - Judged: a VLM answers a frozen quiz bank from the rendered slides. The PresentBench rubric judge scores the rest.
- **On camera:** very watchable side-by-side.

**10. CadQuery part (BenchCAD).**
- **Prompt:** multi-view renders of an industrial part → `part.py`.
- **Defines correct:** the reference solid (CC-BY).
- **Grader:** voxel IoU and Chamfer distance against thresholds, plus a manifold check. Fully deterministic.
- **On camera:** medium. Rotating renders work well.

**11. Fresh real-repo work via Harbor.**
- **Prompt:** 3 Terminal-Bench 2.1 hard tasks plus 3 SWE-rebench instances from the latest month.
- **Defines correct:** the official tests. Hash the test directories and image digests.
- **Grader:** the official test scripts, with a test-integrity check.
- **On camera:** the "real job" counterweight, and it is decontaminated.

**12. Harness grid + context flood (a method applied to existing tasks, not a new task).**
- **Setup:** run the voxel game and dashboard as a model × {Claude Code, Codex, pi} grid, reported as pass^k (k≥4), tokens per solved task, and wall-clock.
- **Context-flood arm:** pre-seed 0/32k/128k tokens of near-miss spec distractors (the Chroma method) and plot the pass-rate curve.
- **On camera:** directly supports "the harness outlives the model".

Games: none added. The voxel task stays as the one game, and BalatroBench is the only one I'd consider later.

## 4. Grading techniques to add, ranked

1. **Scroll/animation probes:** `data-anim` hooks, computed-style deltas across scroll offsets, pin checks, canvas pixel entropy across frames, reduced-motion emulation. This is the thing no public benchmark does.
2. **Deterministic web gates on every web task:** build, zero console errors, no overflow at 375/768/1440, Lighthouse/CWV budgets, axe serious/critical = 0, keyboard reachability.
3. **Exposed-state contracts** for canvas/WebGL/physics (`window.__STATE__`), validated by mutation testing: inject known bugs into a reference and reject any probe that misses them.
4. **Scripted flow replay with per-checkpoint SSIM/CLIP + heatmaps**, always gated by interaction/state assertions.
5. **Blind pairwise judge** on recorded scroll videos or frames: swap order, hide model identity, use cross-vendor majority vote, aggregate with Bradley-Terry. Calibrate the judge first (Judgemark / WebDevJudge style) on known-good and known-bad pairs.
6. **pass^k** plus tokens/latency/API-equivalent cost columns on every run.
7. **Integrity checks:** hash tests and specs after the run, run randomized hidden tests, keep the answer key outside the sandbox, grade after the agent exits.
8. **Overclaim check:** compare completion claims in the final message against real grader output; use transcript coverage parsing.
9. **Partial-credit scoring:** test-pass fraction (Commit0), checkpoints (TheAgentCompany), human-percentile mapping (ALE/MLE-bench), normalized 0→1 (RE-Bench).
10. **Structure extraction over pixels where possible:** recalculate and diff workbooks, parse pptx XML, compare Mermaid graphs, check music21 constraints.
11. **Fresh-slice / held-out grids** (monthly issues, Castillo-style animal × vehicle sampling) to limit contamination.

## 5. Traps and caveats

- **Contamination.** Famous prompts (pelican, hexagon, snake), SWE-bench Verified (models recalled gold patches from the task ID), popular repos in Commit0/FEA, and Kaggle solutions are all risky. Use held-out variants, fresh monthly slices, and a memorization probe.
- **Saturation.** SWE-bench Verified, OSWorld-Verified, SpreadsheetBench v1, CORE-Bench Hard, ChartMimic, DS-1000, base Design2Code, and the basic hexagon no longer separate frontier models. Vibe Code Bench v1.1 and BrowseComp are contested between sources; don't call either one saturated on camera without citing a live board.
- **Metric traps.** SSIM/CLIP reward static shells: in Cloning Bench the top-SSIM model had no interactivity, and in WebRISE one model scored 80.8% on visuals and 15.5% on transitions. axe-optimized output can be semantically empty. Performance benchmarks get reward-hacked heavily: a study found 73.8% of KernelBench evals showed proxy-only gains, and GSO oracles replay validly for only 39 of 102 tasks across machines. Re-baseline on your own machine.
- **Judge bias.** Judges show position, verbosity and self-preference bias. Cookie-Bench's judge agrees with humans only 61.6% of the time, and DeepResearch Bench had to swap judges and split its leaderboard. Never let the contestant's vendor judge alone, and keep scripted signals primary.
- **Arena gaming.** "The Leaderboard Illusion" documented private variant testing and unequal sampling. Arenas also favour flashy, dense pages. Use them as an external sanity anchor, not an answer key.
- **Harness confounds.** The Pokémon runs used different tools per model, so the comparisons were invalid. Hold the harness constant or report it as a variable. Quote BaitBench's per-model figures and the scaffold-effect numbers only after reading the primary papers.
- **Disputed numbers.** OverclaimBench's headline percentages are publicly disputed (task selection, same-family judge). Aggregator Elo and leaderboard figures conflict between sources, so treat them as snapshots.
- **Flaky browser checks.** Animations need fixed viewports, disabled network fonts or pinned local fonts, waits for `document.fonts.ready` plus a settle delay, deterministic seeds for any randomness, and several runs before a probe counts as failed. Frame-time and Lighthouse perf vary with machine load, so run them serially on a quiet machine and use budgets with margin.
- **Infrastructure cost.** KernelBench, most of RE-Bench, full MLE-bench and PaperBench need GPUs. SWE-Lancer and WebArena images are heavy. Vending-Bench 2 has no confirmed local package. Spider 2.0-Snow's eval account was suspended and its gold answers had a reported 62.8% error rate, so hand-verify any SQL gold before freezing it.
- **Safety.** Prompt-injection tasks should use benign canary tokens only, and never publish exploit strings.