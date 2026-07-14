# Vetted Bench — Personal AI-Coding Benchmark Suite

**One-line purpose:** A suite of app/feature-building tasks, each with a human-vetted acceptance test suite as the "correct answer," reusable to evaluate any new model, method, or dev-loop configuration — and to power honest test-compare YouTube content.

_Design doc drafted 2026-07-11 (Fable), reviewed + committed by the main thread. Owner: Josh. Status: awaiting owner review before the implementation plan._

---

## Vision & Why

Channel thesis: **the harness outlives the model.** Models churn every few months; a vetted benchmark and a disciplined dev loop are durable assets. This project is both:

1. **A real eval tool.** When a new Claude model ships, Josh runs it against the suite and gets an objective answer — including whether his dev loop beats raw prompting.
2. **A content engine.** One flagship "loop-engineering" video (the tennis scorekeeper) plus a recurring "I ran [new model] on my benchmark" format.

**The key unlock — the vetted tests do double duty:**

- (a) They are the benchmark's *correct answer* for comparing models.
- (b) They are the *independent validator* that catches **fake convergence** in the dev loop — the moment a model self-validates, claims done, and is wrong.

This is the "don't let the AI grade its own homework" thesis, and it's research-grounded (cite lightly, don't over-claim): models are demonstrably worst at finding their own errors and show self-preference bias (Huang, ICLR 2024; Tyen, ACL 2024; Panickssery, NeurIPS 2024; METR, Jun 2025). Even Anthropic validates its own models with a separate auditor and judge (Petri, Oct 2025). Independent, human-owned acceptance tests are the fix at the personal-dev-loop scale.

---

## Goals / Non-goals

**Goals**

- A standardized task format so any task is runnable/gradable the same way.
- A vetting pipeline that makes each task's tests trustworthy *before* admission.
- Compare **"Claude in Josh's dev loop" vs "raw Claude"**, and **new Claude model vs old**.
- Ship the tennis scorekeeper as flagship video demo *and* suite task #1.
- Start as a **skill** (referenceable context); grow into a **harness** (auto-run + scoreboard).

**Non-goals (v1)**

- Multi-vendor comparison (OpenRouter/Ollama are a later phase).
- A public leaderboard or hosted service.
- Statistical rigor at academic scale — best-of-3 with frozen prompts is the bar, not n=100.
- Grading agentic long-horizon work (the seeded bug-fix task comes later).

---

## The Two Task Types

This distinction is load-bearing — the two types have different purposes, workflows, and scoring.

| | **Type A — spec-driven "loop" tasks (logic)** | **Type B — one-shot "vibe-check" tasks (visual)** |
|---|---|---|
| Shape | Spec with requirements + vetted acceptance test suite | Single prompt, rendered output |
| Workflow | Model builds → **self-validates** (writes its own checks, claims done) → **vetted tests** reveal true vs fake convergence | One-shot generate → render → blind-compare across models |
| Purpose | The dev-loop thesis; the flagship video | "Test a new model" episodes |
| Scoring | Objective: pass/fail against vetted tests | Blind A/B + written rubric |
| Narrative beat | "It *thought* it was done — the tests caught it" | "Which one looks right? You judge" |

---

## The Starter Suite

| # | Task | Type | Why it earns its slot | Grading |
|---|---|---|---|---|
| 1 | **Tennis scoring engine** — 15/30/40, deuce/advantage, tiebreak at 6-6 (first-to-7, win-by-2), super-tiebreak, ad/no-ad, best-of-3/5 | A | Flagship video's demo; dense rule edge cases models plausibly botch | Vetted unit tests |
| 2 | **Habit-streak engine** — current/longest streak, "grace for today" rule, month boundaries, unordered/duplicate dates | A | Date logic is a classic silent-failure zone; scaffold exists at `C:\Users\iamjo\Projects\habit-tracker` | Vetted unit tests |
| 3 | **Sudoku solver** | A | Pure algorithmic; graded by **hidden** test cases | Hidden vetted tests |
| 4 | **Bouncing balls inside a spinning polygon** | B | The canonical "model-killer" physics/render task | Blind A/B + rubric |
| 5 | **SVG "draw [Josh's object]"** — his own signature object, NOT the community pelican | B | Beats training-data contamination; brands the channel | Blind A/B + rubric |
| 6 | **Animated solar system** — labels + live FPS counter | B | Requirement-dense, so rubric-scorable, not just taste | Blind A/B + rubric |
| — | *Later:* seeded bug-fix in a small repo | A (agentic) | The "real-work" axis: navigate, diagnose, fix | Vetted tests on the fix |

**Flagship video demo:** the tennis task is built as a **full small app** — scoring engine + scoreboard UI + match state — not a bare function, so the loop has surface to drift on. The narratable break: the model self-validates and claims done, but botches deuce or the 6-6 tiebreak; the vetted tests catch it on camera. It then enters the suite as task #1.

---

## The Vetting Process (the trust core)

*"Correct answers vetted over multiple passes."* A task is **not admitted** to the suite until it clears all four gates:

1. **Write** the acceptance tests from the spec — the human owns them.
2. **Verify** them against a known-good reference implementation (all tests pass on a correct answer).
3. **Adversarially confirm** they reject wrong answers, mutation-style: deliberately break the reference (wrong deuce logic, off-by-one tiebreak, dropped month boundary) and confirm at least one test fails per mutation. A test suite that can't fail is decoration.
4. **Freeze.** Tests are committed *before* any candidate implementation exists, so any tampering (by model or human) shows in the diff.

Ordering rule: **tests exist before candidates.** This is both the anti-tamper mechanism and what makes the "grade its own homework" comparison honest — the candidate never saw the answer key.

---

## Scoring

**Type A (logic):** objective unit-test pass rate against the vetted suite. Best signal available; entirely sidesteps judge bias. Record per-run: pass/fail per test, plus whether the model *claimed* convergence before the vetted run (the fake-convergence flag is itself a metric).

**Type B (visual/subjective):** blind A/B comparison against a **written rubric** (e.g., solar system: labels present? FPS counter live? orbits plausible?). If an LLM judge is used at all:

- Run **dual-order** (A-vs-B and B-vs-A) to cancel position bias.
- Use a **neutral third-party judge** — never the model under test (self-preference bias is documented; see research above).
- Rubric verdicts beat holistic "which is better" verdicts.

**Protocol for every comparison:** freeze the exact prompt, run **best-of-3** per method (prompts are flip-sensitive), record all three.

---

## Architecture Units (describe, don't code)

Four units, same shape whether the delivery is a skill or a harness:

1. **Task Registry** — one folder per task:
   - `spec.md` (requirements), the frozen prompt, the vetted test suite, optional reference solution, and metadata `{type: logic|visual, difficulty, status: active|retired|private}`.
2. **Method/Model Runner** — an adapter that runs `task × method`. v1 methods: "raw Claude" and "Claude in Josh's dev loop," via Claude Code / the Claude Agent SDK. Later: OpenRouter (multi-vendor) + Ollama (local).
3. **Grader** —
   - Logic: execute candidate output against the vetted tests **in a sandbox**.
   - Visual: iframe-render outputs side by side; blind vote against the rubric.
4. **Store + Scoreboard** — JSON/SQLite per run: `{date, task, method, model, score, converged_claim, tokens, cost, latency, raw_output}`. Scoreboard UI: method × task matrix, tracked over time (this is where "the harness outlives the model" becomes visible).

---

## Delivery: Skill → Harness

**v1 — a Skill.** The vetted suite ships as referenceable context Josh invokes inside his existing dev loop: the skill knows the task registry layout, the vetting checklist, and how to run a task's tests against a candidate. No automation yet — the human drives, the skill supplies the frozen tasks and grading procedure.

**Phase 2 — a Harness.** Built on the Claude Agent SDK + /workflows (Josh's existing stack): auto-run tasks × methods, grade in the sandbox, write to the store, render the live scoreboard. **Same tasks, same registry, same tests** — only the driver changes. Nothing in v1 should need rework to get here; the task format is the contract.

---

## V1 Scope + Phased Roadmap

**V1 (build first):**

- (a) Tennis scorekeeper as the flagship Type-A task, built through Josh's dev loop.
- (b) The standardized task format / folder structure (the registry contract).
- (c) Full vetting of the tennis acceptance tests (all four gates, committed-first).
- (d) Delivery as a skill.

**Phase 2:** the runner + grader + store + scoreboard (harness on Agent SDK + /workflows); vet and admit the remaining starter tasks.

**Phase 3:** multi-vendor via OpenRouter + local via Ollama; the seeded bug-fix agentic task.

---

## Design Principles

- **Freeze the exact prompt; run best-of-3.** Prompt wording flips outcomes; never compare across reworded prompts.
- **Swap Josh's own object/variant each episode.** The pelican and the hexagon are in training data now — contaminated. Personal variants are both cleaner evals and channel branding.
- **Retire saturated tasks.** Once every model passes, a task measures nothing — mark it `retired`, keep the data.
- **Bank every task a model couldn't one-shot** (the ezyang meta-pattern). Every real-work failure is a future benchmark task — an infinite content supply.
- **Assume a ~2-year task lifespan** and rotate accordingly.
- **Keep some tasks private** (the Lütke tactic) — a public benchmark leaks into training data; a private slice stays honest.
- **The human owns the tests, and they come first.** Committed before candidates, always.

---

## On-Camera Anti-Fabrication Notes

- Don't quote Tobi Lütke's exact words or attribute specific private tasks to him — reference the *tactic* generically.
- No specific model-version or Elo numbers on screen sourced from SEO articles — only numbers produced by this suite, from disk.
- When using a personal SVG object, say *why*: the pelican is contaminated (in training data), not "mine is better."
- The AI's imperfection **is the honest angle** — fake convergence caught on camera is the content, not a flaw to edit around.
- Cite the self-evaluation research lightly (one line, named papers) — don't over-claim what the papers show.

---

## Open Questions

1. **Sandbox choice for the grader** — local subprocess with timeouts vs a proper sandbox (e.g., container / Sandbox SDK)? v1 skill can run tests directly; Phase 2 needs isolation for untrusted generated code.
2. **Hidden-test hygiene for Sudoku** — where do hidden cases live so they never enter the model's context (separate private repo? encrypted at rest)?
3. **Blind-vote mechanics for Type B** — is Josh the sole voter (fast, biased) or does he recruit 2–3 voters per episode (slower, better content)?
4. **Fake-convergence metric definition** — binary (claimed done + failed vetted tests) or graded (how many vetted tests failed after the claim)? Affects the flagship video's headline stat.
5. **Task difficulty calibration** — does difficulty metadata come from prior run data (empirical) or hand-assigned at vetting time?
6. **Private-task ratio** — what fraction of the suite stays unpublished, and does the scoreboard show private-task scores in aggregate only?
