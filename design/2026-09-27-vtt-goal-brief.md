# Goal brief — "Broken Tabletop" benchmark (task 22)

## What we're making
A new task for **Vetted Bench**, Josh's AI-coding benchmark for his YouTube channel (thesis: *the harness outlives the
model*). Every existing task starts from a blank page; this one tests the other half of real coding — **working inside a
large existing codebase**.

The app is our own **web-based virtual tabletop for D&D 5e** (the kind of thing Roll20 / Foundry / Owlbear are). Josh plays
D&D with friends on Roll20, so the app should be something a real group could actually use for a session.

## How the benchmark uses it
1. We build a **correct** version of the app, with a large **hidden** test suite that proves it's correct.
2. We **plant bugs** into it — each a small recorded change that turns at least one hidden test red.
3. **Variant A — "fix it":** the agent gets the buggy repo plus ~5 **vague user complaints** (the way a real player would
   report a problem). It must reproduce, diagnose and fix them. **Bonus points** for finding and fixing planted bugs nobody
   reported. **Penalties** for breaking anything that worked.
4. **Variant B — "grow it":** on the same (correct) repo, the agent is told "here's our app" and asked to brainstorm what
   it should have next, then build it. This measures product sense and creativity.

## What the spec needs to decide
- **The feature scope of the correct app** — what a real group needs for a session, drawn as a clear core-vs-backlog line.
  The backlog becomes Variant B's raw material. Guard hard against scope creep.
- **How D&D rules and content are handled** — enough to be real, small enough to build and verify.
- **Architecture and stack** — something a single agent can run, test and change inside a sandbox.
- **Where bugs can hide** — the design should naturally create a variety of subtle, realistic bug sites across different
  subsystems, including ones that need two browsers or careful reading to notice.
- **The hidden test strategy** — how we prove the correct version is correct and that each planted bug is caught.
- **How the demo looks on camera** — the before/after of a fix should be visible, not only a test turning green.

## Constraints (fixed)
- **Runs fully offline.** No external APIs, accounts or network at runtime; any game content is vendored as data files.
- **Public.** The repo and videos are public, so any D&D content must come from openly licensed sources (the SRD under
  CC-BY-4.0) with correct attribution. Avoid non-SRD names.
- **Large enough to need real navigation** — mid-size, not a toy (on the order of 15–25k lines incl. tests), with planted
  bugs spread across many files.
- **Deterministic grading.** Randomness (dice!) must be controllable so tests are repeatable.
- **Grading is a points checklist** (Josh's rule for every task): true/false criteria worth fixed points; measured values
  map to points through bands frozen in advance; any subjectivity is contained in small yes/no judge questions (3 votes,
  majority). Never a 1–10 taste score.
- **Wow factor matters** — it's for YouTube. Prefer designs where a bug and its fix are obvious on screen to a non-coder.
- **Build cost is agent time**, not money (subscriptions only). But one person must be able to review it.
- **Not in the brief on purpose:** a feature list. The council should derive the features itself.
