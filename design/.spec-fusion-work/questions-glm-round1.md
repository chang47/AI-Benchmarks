# Task 22 "Broken Tabletop" — open questions for the requester (spec-fusion round 1)

## Task shape & harness mapping

1. **[BLOCKING]** Variant A (fix-it) and Variant B (grow-it) need two different agent-facing starting repos and prompts. Is task 22 **one bench task with two frozen prompts** (one slug, prompt chosen per run), or **two slugs** (e.g. `22a` / `22b`, like `15` vs `15b`), each with its own `bench.json` and `result.json`? And do **both** variants appear as scored rows on the scoreboard, or is one of them showcase/video-only for the first round?

2. **[BLOCKING]** What is the agent's wall-clock budget per run? Existing tasks use 30–60 min (task 20 = 60). Variant A asks an agent to navigate a 15–25k-line repo, reproduce ~5 vague complaints and fix them; Variant B asks it to brainstorm AND ship working features. Is ~60 min the cap for both variants, or is 90–120 min acceptable for this task? (This single number bounds how deep the planted bugs and Variant B features can be.)

## Runtime substrate & stack

3. **[BLOCKING]** May the app be a **real localhost server (Node + websockets)** that separate browser windows connect to — the natural home for the "permission checked only on the client" and "stale data sent to the wrong player" bug classes — or must it be a **serverless static page** (two windows syncing via BroadcastChannel/localStorage)? If serverful: is **GM + 2 players** (3 windows) the maximum concurrency the grader and on-camera demo may assume, or is GM + 1 player the ceiling?

4. **[BLOCKING]** Must everything the app needs at runtime be **vendored into the repo so it runs with zero `npm install`** (the task-18 precedent: Three.js vendored in `inputs/`, holdout ships its own committed `node_modules`), so agent and grader need only `node` + Chrome? Or may the app declare dependencies that the agent/grader installs at setup time (build-time network allowed, runtime still offline)?

5. **[MINOR]** Any constraint on language and build step — plain Node ESM + browser JS with **no build step** (like the harness itself), or are TypeScript/JSX with a compile step acceptable if vendored?

## Composition of the buggy repo the agent receives

6. **[BLOCKING]** Does the agent-facing buggy repo ship a **visible test suite**? Options: (a) no tests at all, (b) a small green "smoke" suite the agent may run (its edits to it never affect grading), (c) the app's original full suite minus the bug detectors. This sets the agent's feedback loop and the reward-hacking surface in one stroke. If any visible tests ship, confirm the grader is required to ignore the agent's edits/replacements of them.

7. **[MINOR]** May a planted bug live in a **vendored SRD data file** (e.g. one wrong number in a stat block), or must every planted bug live in code written for this app? (A data-file bug is hard to distinguish from a content error and may be effectively unfindable and un-demoable.)

## Planted-bug catalog

8. **[BLOCKING]** The brief fixes "~5 reported" complaints. How many **unreported** planted bugs should the catalog target (the research sketch suggests 5–8, i.e. ~10–13 total)? Is there a hard total cap so the on-camera repro set, the hidden-suite runtime, and the ≤ ~10 min grade all stay bounded?

9. **[MINOR]** Should the hidden suite include **"trap" checks** — weird-but-correct 5E rules (nat 1 always misses, resistance rounds down) that a hasty "fix everything that looks odd" agent would break — or should coverage stay strictly planted-bug + sentinel? (Traps reward restraint but can read as gotchas on camera.)

## Variant A prompt freeze

10. **[BLOCKING]** In the Variant A prompt, does the agent learn that bugs were **deliberately planted** (and roughly how many), or is the fiction "this is our live app; here are player complaints"? Related: since unreported bugs earn bonus, must the prompt hint "there may be other issues nobody reported," or stay silent about them?

11. **[BLOCKING]** If the agent concludes a complaint is **not a bug / the report is mistaken** (possible with vague wording), is "explain and decline" an accepted, zero-penalty outcome for that complaint, or must every reported complaint be treated as real? (Prior art: an explicit "you may say it's impossible" out cuts reward hacking sharply.)

## Scoring

12. **[BLOCKING]** For the unreported-bug bonus, what evidence earns points: the bug's hidden fail→pass test now passing **AND** a `FINDINGS.md` entry that a 3-vote judge confirms describes that bug, or either one alone? And is the bonus flat per bug or banded by difficulty tier?

13. **[BLOCKING]** Variant B scoring shape: a **frozen points checklist in the pipeline** (e.g. points per feature that demonstrably works × isn't on the frozen "obvious features" list × keeps all pass→pass sentinels green, capped), **3-vote yes/no judge items only**, or **intentionally ungraded / video-only** for the first run (pairwise human votes as content, not score)?

14. **[MINOR]** Regression penalties (per failing pass→pass sentinel group): is there a **cap** on total penalty, and can a run go net-below-zero on points? What's the intended optics if a model fixes 4 reported bugs but regresses 3 neighbourhoods?

## Content, licensing & size

15. **[MINOR]** Where must the SRD 5.2.1 CC-BY-4.0 attribution appear — repo README only, or also **inside the app** (About/legal page players can see), and do you want to state it on camera?

16. **[MINOR]** Does the 15–25k-line target **count vendored SRD data files** (the monster/spell JSON can be 10k+ lines by itself), or only hand-written app + test code?

## Acceptance & run policy

17. **[MINOR]** Is "Josh can run a real session with his group in this app" an **acceptance gate before freeze** (a dogfooding pass), or is the hidden suite plus the on-camera bug demos sufficient proof that "a real group could use it"?

18. **[MINOR]** Which profile is canonical for task-22 runs: **clean-room with web access** (agents may look up SRD 5.2.1 rules — realistic, and the app itself is contamination-free) or **no-web**? Does the answer differ between Variant A and Variant B?
