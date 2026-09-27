# Open questions — task 22 "Broken Tabletop" (opus, round 1)

## Blocking

1. **[BLOCKING] How do players connect: over the internet, on a LAN, or only as windows on the same machine?** "A real group could use it" suggests remote friends. The two-window demo could work with same-machine sync (BroadcastChannel/localStorage). Options:
   - (a) Must it be a self-hosted Node server that players reach over LAN or internet (the host handles port-forwarding or tunnelling)?
   - (b) Is same-machine or LAN-only acceptable for v1?

   This decides whether an authoritative server exists at all. The "check done only on the client" and "stale data sent to the wrong player" bug classes depend on having one.

2. **[BLOCKING] Does the buggy repo ship with a visible test suite, and must the planted bugs leave it green?** A realistic 15–25k-line codebase would have its own tests. If so:
   - Must every planted bug slip past them (the realistic "tests didn't cover it" case)?
   - Does the "15–25k lines incl. tests" count the visible tests, the hidden tests, or both?

3. **[BLOCKING] What can the Variant A agent run inside its sandbox?** Specifically:
   - Is network available at run time (e.g. `npm install`), or must `node_modules` be vendored and pinned?
   - Does every harness (Claude Code, Codex, pi on Windows) have a headless browser/Playwright it can drive?

   If some harness can't open a browser, must every bug also be reproducible from the CLI (a unit/integration test or script) so harnesses are compared fairly?

4. **[BLOCKING] Are there limits on the stack?** Is a build step with a framework and TypeScript OK (e.g. Vite + React + TS + a `ws` server)? Or does Josh want no-build vanilla JS, like the earlier single-`index.html` tasks? What is the ceiling on third-party runtime dependencies (e.g. a canvas/map library)?

5. **[BLOCKING] Does the Variant A prompt tell the agent that unreported bugs exist and ask for a `FINDINGS.md`?** Or must bonus finds be discovered and written up unprompted?
   - This changes the frozen prompt.
   - It also changes whether the bonus measures proactiveness or search skill.

## Minor

6. **[MINOR] Access control between GM and players.** Is a trust-based join ("pick your name, GM gets a room link/code") acceptable? Or must a player be technically unable to become GM (e.g. a GM secret)? This decides whether an information leak to a player counts as a real security bug or only a UX bug.

7. **[MINOR] Art assets.** SRD 5.2.1 has no art. Are third-party CC0/CC-BY assets allowed for maps and tokens (e.g. Kenney, game-icons.net with attribution)? Or must all visuals be original/procedural? Can users upload their own map images at run time?

8. **[MINOR] Contamination.** The repo is public and the spec will contain the full bug catalog (fixes included). Is one frozen bug set acceptable for all runs, like other tasks' public holdouts? Or should the catalog/buggy build stay private until the videos air, or be rotated between bug sets?

9. **[MINOR] Run budget.** Is there a wall-clock or turn cap per Variant A / Variant B agent run? It bounds how much of a 20k-line codebase an agent can realistically explore, and so how many unreported bugs are worth planting.

10. **[MINOR] Score shape.** Can the Variant A total go below zero from regression penalties, or is it floored at 0? Should reported fixes outweigh unreported bonus finds, and by roughly how much?

11. **[MINOR] Task packaging.** Should Variants A and B be one task slug with a variant switch (this needs harness changes)? Or two separate slugs (e.g. `22a-broken-tabletop`, `22b-grow-tabletop`) sharing the reference `src/`?

12. **[MINOR] What "one person can review it" means.** Does Josh expect to read the whole 15–25k-line reference? Or to review by behaviour: play-test the demo, walk each bug's repro, and spot-check tests? Is a real play session with friends a required acceptance gate before freeze?

13. **[MINOR] Target platform.** Is desktop Chrome/Edge only acceptable? Or must players on phones/tablets or Firefox/Safari be supported, since Roll20 players often join from other devices?

14. **[MINOR] Repo docs.** Should the buggy repo ship with realistic developer docs (README, architecture notes)? Should it deliberately omit any agent-facing file (`AGENTS.md`/`CLAUDE.md`) so harnesses compete on their own navigation?
