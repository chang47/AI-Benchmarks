# spec-fusion problem statement — task 22 "Broken Tabletop" (2026-09-27)

_Input to `/spec-fusion`. Built from `design/2026-09-27-vtt-goal-brief.md` + `research/vtt-2026-09/bug-benchmark-prior-art.md`
+ Josh's 2026-09-27 direction on the bug catalog. The VTT feature-inventory research is deliberately withheld so the
council derives the feature set itself._

## What we're making
A new task for **Vetted Bench**, Josh's AI-coding benchmark for his YouTube channel (thesis: *the harness outlives the
model*). Every existing task starts from a blank page; this one tests the other half of real coding — **working inside a
large existing codebase**.

The app is our own **web-based virtual tabletop for 5E-compatible tabletop RPG play** (the kind of thing Roll20 / Foundry /
Owlbear are). Josh plays with friends on Roll20, so the app should be something a real group could actually use for a
session.

## How the benchmark uses it
1. We build a **correct** version of the app, with a large **hidden** test suite that proves it's correct.
2. We **plant bugs** into it — each a small recorded change that turns at least one hidden test red.
3. **Variant A — "fix it":** the agent gets the buggy repo plus ~5 **vague user complaints** (the way a real player would
   report a problem). It must reproduce, diagnose and fix them. **Bonus points** for finding and fixing planted bugs nobody
   reported. **Penalties** for breaking anything that worked.
4. **Variant B — "grow it":** on the same (correct) repo, the agent is told "here's our app" and asked to brainstorm what
   it should have next, then build it. This measures product sense and creativity.

## THE PLANTED-BUG CATALOG IS A FIRST-CLASS DELIVERABLE OF THIS SPEC
Josh's direction: the spec must decide **what in the game to break**, not leave it for later. Every planted bug must be:
- **Real** — the kind of mistake a real developer makes while building or extending this app (off-by-one, wrong rule,
  missing guard, state not reset, check done only on the client, stale data sent to the wrong player) — not an
  artificial mutation, and not a syntax error or crash-on-load.
- **Obvious enough to demo live** — Josh must be able to reproduce it **by hand in a real browser (two windows = GM +
  player where needed)** on camera, in under a minute, with a scripted repro, and a **non-coder viewer must see that
  something is wrong** (a number is wrong, a player sees what they shouldn't, a token jumps, a turn is skipped). After the
  fix, the same repro visibly behaves correctly.
- **Automatically detectable** — at least one hidden fail→pass test catches it deterministically; sentinel pass→pass tests
  guard its neighbourhood.
- **Subtle enough to be a benchmark** — obvious once you look, but not found by grepping for a comment or a single weird
  token; the reported ones are described only by a vague player complaint.

For each planted bug the spec should give: id, subsystem, the realistic "how it got there" story, the on-camera repro
script (steps + what the viewer sees, before vs after), the vague complaint wording (if reported), the detecting test
idea, difficulty tier, and whether it's reported or unreported. Spread bugs across subsystems and difficulty (domain rule,
state/lifecycle, multi-file server+client, information leak to a player, UI/visual, at most 1–2 crash-floor bugs).
Explain how the app's design deliberately creates good bug sites.

## What the spec needs to decide
- **The feature scope of the correct app** — what a real group needs for a session, drawn as a clear core-vs-backlog line.
  The backlog becomes Variant B's raw material. Guard hard against scope creep.
- **How 5E rules and content are handled** — enough to be real, small enough to build and verify.
- **Architecture and stack** — something a single agent can run, test and change inside a sandbox.
- **The planted-bug catalog** (above).
- **The hidden test strategy** — how we prove the correct version is correct and that each planted bug is caught.
- **Scoring** for Variant A (and a sketch for Variant B).
- **How the demo looks on camera** — the before/after of a fix should be visible, not only a test turning green.
- **Build plan** — the order an agent builds this in, and how one person reviews it.

## Constraints (fixed)
- **Runs fully offline.** No external APIs, accounts or network at runtime; any game content is vendored as data files.
- **Public.** Repo and videos are public, so game content must come from openly licensed sources: the SRD 5.2.1 under
  CC-BY-4.0 with its required attribution. No "D&D"/"Dungeons & Dragons" branding ("5E-compatible" is fine); avoid
  non-SRD Product Identity names.
- **Large enough to need real navigation** — mid-size, not a toy (on the order of 15–25k lines incl. tests), with planted
  bugs spread across many files.
- **Deterministic grading.** Randomness (dice!) must be controllable so tests are repeatable.
- **Grading is a points checklist** (Josh's rule for every task): true/false criteria worth fixed points; measured values
  map to points through bands frozen in advance; any subjectivity is contained in small yes/no judge questions (3 votes,
  majority). Never a 1–10 taste score.
- **Wow factor matters** — it's for YouTube. Prefer designs where a bug and its fix are obvious on screen to a non-coder.
- **Build cost is agent time**, not money (subscriptions only). But one person must be able to review it.
- **Not in the brief on purpose:** a feature list. Derive the features yourselves.

## Prior art to design against (research 2026-09-27; figures approximate)
- **Closest prior art:** Active-SWE (issue-free fixing incl. multi-bug and "potential bug discovery"; discovered bugs graded
  by an agent-written fail→pass test + an LLM judge that the test targets the bug). FuzzingBrain-Bench credits any distinct
  reproducible finding, weighted D1–D5 by difficulty.
- **Realistic bugs:** BugPilot/FeatAdd — bugs introduced *while adding a feature* are more human-like and more multi-file
  than SWE-smith mutations (~25% lower solve rate). SWE-smith: LLM-injected bugs leak inline comments at the bug site
  unless forbidden.
- **Hardest bug types:** state & lifecycle (transitions, races, leaks) and domain-workflow (missing business-rule guards,
  wrong operation order); multi-file bugs; visual bugs; security. Easy: syntax, single-token mutations.
- **Test validity:** too-narrow tests (enforcing unspecified strings/order/types) are the main failure → test observable
  behaviour; accept any valid implementation. From-scratch tasks with hand-written behavioural checkers had far lower
  judge disagreement than inherited tests.
- **Reward hacking:** agents cheat mostly by editing tests → hidden tests never enter the container; an "allowed to say
  it's impossible" out and a "Solution Originality" prompt line cut exploit use sharply. Git history leaks even after
  deleting refs → ship the buggy repo as a fresh single-commit `git init`.
- **Self-checks are weak:** ~46% of agents' own "tests pass" evidence couldn't tell buggy from fixed code → never credit
  agent-written tests unless replayed against the buggy version.
- **Research agent's suggested design (a starting point, not binding):** per bug a stored patch + ≥1 hidden fail→pass test
  (red on bugged, green on clean, 3/3 deterministic) + a pass→pass sentinel set in the same module; each bug detectable
  alone and with all bugs applied; validate tests against 2–3 alternative correct fixes per bug. Mix ~5 reported +
  5–8 unreported. Reported fix = points gated on its sentinel group; unreported fix = bonus only if also described in a
  `FINDINGS.md` (3-vote judge "does an entry describe bug X?"); weight by difficulty; penalty per failing pass→pass group;
  "trap" tests on weird-but-correct rules (nat 1 always misses, resistance rounds down); don't penalise false-positive
  findings. Grader copies only `src/` into a fresh harness; hidden inputs differ from complaint examples. Freeze F2P/P2P
  lists, points, bands and judge questions in `FREEZE_MANIFEST.json` before any run.

## Repo context (Vetted Bench harness)
- Tasks live in `tasks/<slug>/` with `bench.json`, a frozen prompt, a reference solution in `src/`, and a frozen
  `holdout/` (grader + hidden tests) hashed in `FREEZE_MANIFEST.json`; grading refuses on hash mismatch.
- Existing graders are Node scripts (`holdout/grade-*.mjs`) often driving Playwright/Chrome; results are a points checklist
  in `result.json`. Harness runs task × harness (Claude Code, Codex, pi, …) × model on Windows, subscriptions only.
- Heavy browser graders are memory-hungry; runs are serial. A grade that takes ≤ ~10 min is acceptable.

## Resolved clarifications (Josh, 2026-09-27, clarify round 1)
1. **Connectivity:** no LAN port-forwarding or tunnel setup for players. The GM runs the app's Node server on their own
   machine and shares it via **Tailscale** (e.g. Tailscale Serve/Funnel or tailnet sharing) — realistic, zero hosting cost.
   Friends should need as little setup as possible (ideally just open a link). The app itself still runs fully offline;
   Tailscale is deployment, not a runtime dependency. The demo/grader use multiple browser windows on one machine.
   An authoritative server exists (Node + WebSockets) — server-side permission/visibility bug classes are in scope.
2. **Stack:** the standard industry stack — **Vite + React + TypeScript** client, Node + TypeScript server. Dependencies
   must be installable/pre-installed so the agent sandbox and grader need no network at run time (decide how: committed
   lockfile + pre-populated node_modules / offline cache).
3. **Time limit:** **120 minutes** per agent run for both variants (GLM needs the headroom).
4. **Visible tests:** the buggy repo ships a realistic visible test suite that stays green with all bugs planted
   (the "tests didn't cover it" case). The grader ignores anything the agent does to visible tests. Josh is lukewarm on
   AI-written tests — keep them realistic and modest.
5. **Variant A prompt framing:** "this is our live app; here are player complaints", plus one line: if you find other bugs,
   fix them and list them in `FINDINGS.md`. The agent may argue a complaint isn't a bug (scores 0, no penalty) — all 5
   complaints are real.
6. **Bug count:** 5 reported + ~6 unreported (~11 total); on-camera repro set and full grade stay ≤ ~10 min.
7. **Unreported bonus:** requires BOTH the bug's hidden fail→pass test passing AND a `FINDINGS.md` entry that a 3-vote
   judge confirms describes that bug; bonus weighted by difficulty tier.
8. **Packaging:** two task slugs sharing one reference app — `22a` (fix it, fully specified) and `22b` (grow it,
   points-checklist sketch; video-only / unscored for its first round).
9. **Leak risk:** keeping the spec, clean source and patches in the public repo is acceptable.
