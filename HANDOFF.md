# HANDOFF — ai-benchmark ("Vetted Bench") — 2026-09-26

## Task & Scope
- Josh is building a benchmark platform for his YouTube channel ("a software engineer who builds real things with AI, honestly"; thesis: *the harness outlives the model*). The repo has frozen tasks and a harness (`bench/`) that runs task × harness × model on his **subscriptions only** (Claude Max, Codex $20, GLM, pi), grades against frozen answer keys, and renders a static HTML report.
- **In scope right now:** task **18 "Wonders of the Universe"**, the flagship benchmark page, a cinematic code-only WebGL landing page. The reference/starter page is DONE and live. **Next is its grader** (the 82-point checklist) plus the runner change that copies `tasks/<t>/inputs/` into the agent workspace.
- **NOT in scope:**
  - Tasks 19 (clone), 20 (Three.js), 21 (spreadsheet): specced only.
  - The context-flooding experiment.
  - Publishing run data.
  - More task-18 art polish (Josh approved it: "we can use this as the benchmark").

## Current State
- **Live:** https://wonders-of-the-universe.iamjoshchang.workers.dev. Verified after the last deploy: HTTP 200, `{"three":true,"hook":"function","title":"Wonders of the Universe"}`, errs `[]`, bad responses `[]`. Version `3cddea4d-224f-4c42-a833-7074eee58020`.
- **Task 18 reference** (`tasks/18-wonders-landing/src/`):
  - 0 console errors, 0 network requests, 0px horizontal overflow at 390px.
  - 60 fps / p95 16.9 ms in all 7 scenes at 1440×900.
  - Legibility probe: **`85/85 text checks pass`** at 1440 / 2000 / 390.
  - Functional probe passes: cursor, carousel, 3 form states, mobile menu, reduced motion.
- **Task 18 grader: NOT BUILT.** The checklist exists only in the spec. `tasks/18-wonders-landing/bench.json` does not exist yet.
- **Runner does NOT copy `inputs/`** into the workspace yet (spec harness item 1). Task 18 needs it: the vendored Three.js is in `tasks/18-wonders-landing/inputs/vendor/`.
- **PAUSED (Josh's instruction):**
  - The task-15 grader-v2 regrade: 3 runs left.
  - Grading the ungraded task-17 runs.
  - Running 15b on 9 arms.

  Reason: grading Minecraft (task 15) in the hidden Chrome **grabs Josh's real mouse** (pointer lock parks it top-left on Windows). Only run it while Josh is away. `npm run check` (full) also grades 15/15b references, so it grabs the mouse too; `--quick` doesn't.
- Last check run: `node bench/checks/check.mjs --quick --no-browser` → `14/14 checks passed`.
- **Git:** branch `master`, last commit `91b8131 Merge legibility: live-background contrast probe + task-18 readability fixes`; plus a commit following this handoff (renormalized `inputs/vendor` + `HANDOFF.md`).
  - Untracked but NOT ours: `tasks/07-bowling/demo.mjs`, `tasks/17-budget-dashboard/*` (pre-existing, never committed), `bash.exe.stackdump`. Don't `git add -A`.

## Work Completed (this session)
- **Harness v1 (`bench/`), landed `380ce9f`.**
  - Runner `bench/run.mjs` (`runOne`, `runPool`, `reparseRun`, `clipEnds`, `extractFromText`).
  - Adapters `bench/harnesses/index.mjs`: `claude`, `claude-glm`, `codex`, `pi`.
  - Parsers `bench/trajectory/{parse-claude,parse-codex,parse-pi,index,common}.mjs`: raw → normalized Steps (see `bench/trajectory/SCHEMA.md`).
  - Grader `bench/grade/{grade,judge,normalize}.mjs`.
  - Report `bench/render/{report.mjs,assets/app.js,assets/style.css}`.
  - Checks `bench/checks/{check,render-check}.mjs`.
  - Profiles `bench/profiles/{clean-room,josh,no-web}.json`.
  - Arms `bench/arms/pilot.json`.
- **Grader fixes found by testing:**
  - A fresh sandbox per grade, because concurrent grades were swapping each other's `src/`.
  - Manifests in three dialects (`{path: hash}` / `[{path, sha256}]` / upper-case hex / BOM).
  - A 3-vote AI judge (a single vote flipped pass/unclear/pass on the same item).
  - Username redaction at any backslash depth.
- **Task 15 grader v2 + task 15b, landed `69a5b24`.**
  - `bench/grade/resolvers/15-world-probe.mjs` OVERRIDES R05/R06/R07/R17/R20. The frozen probes searched only around the player, and Opus 4.8 built a correct 32×32 world with the camera at z=44 outside it.
  - It FILLS skipped R12/R13/R14/R18, and ADDS G1 (≤ chunks+4 draw calls/frame) and G2 (quads ≤ 60% of the unmerged face count).
  - `grader.repeat: 2` marks checks that disagree across runs as `unclear` (R10 passed 2 of 3 grades of the same build).
  - The July reference only culls hidden faces: `3836 quads drawn per frame vs 3836 unmerged` → it fails G2 (correct).
  - 15b = 15 + one prompt line (spawn inside the world); holdout is a byte copy.
- **Research:** `research/landscape-2026-09/benchmark-landscape-memo.md` + `lanes.json` (7-lane web survey, 102 items, ranked task ideas).
- **Spec:** `design/2026-09-26-web-3d-sheet-tasks-spec.md` for tasks 18 / 19a / 19b / 20 / 21 as POINTS CHECKLISTS.
  - Josh: "it should still be some sort of checklist of points and grading criteria… contain some of the subjectivity". So: yes/no judge questions only, no 1–10 taste scores, measured values → frozen bands.
- **Task 18 v1** (2D canvas/SVG, `c9cf8cf`) was rejected by Josh as "too simplistic… just a simple parallax page".
- **Task 18 v2 (cinematic), `af18938`:**
  - One fixed full-screen WebGL canvas; scroll picks a stage; the next stage dissolves in through a noise mask (`MIX` shader), then bloom + `GRADE` (ACES, grain, vignette).
  - Stages: particle galaxy (140k points), meteor sky, scroll-scrubbed volcano (pure function of `uP` → rewinds), waterfall + conifers, aurora, Seascape-style raymarched ocean, far galaxy.
  - Wonder cards are baked once from the `CARDS` shader.
  - Three.js r186 is vendored as an IIFE (`window.THREE` + `THREE.addons`).
  - The prompt was updated to require this direction and provide Three.js.
- **Deploy:** `deploy/wonders/wrangler.jsonc` (Workers static assets from `tasks/18-wonders-landing/src`), `09d9055`.
- **Legibility, `91b8131`:**
  - `bench/grade/web/legibility.mjs` `measureLegibility(page, {selector, maxElements, samples=3, sampleGapMs=450})` hides ALL text, screenshots, and takes the brightest 10% of background pixels in each text box. It computes WCAG contrast (≥4.5 normal, ≥3 large); the worst of 3 samples wins.
  - On the reference it found 18/104 failures (counter `1.15:1`, waterfall copy `2.2:1`, quotes over the galaxy core).
  - Fixed with `.scrim::before` feathered pools (`.scrim.tight` for the hero subtitle so the galaxy stays visible), a phone panel variant, counter colour `#ffe9c7`, far galaxy `cam.lookAt(far ? -1.35 : 0, 0, 0)`, and `main { overflow-x: clip }`.
  - Added the "Legibility, 4 pts" row to the spec (total now 82).

## Files Touched
- **created:**
  - `C:\Users\iamjo\Projects\ai-benchmark\bench\**` (all harness files above)
  - `...\bench\grade\web\legibility.mjs`
  - `...\bench\grade\resolvers\15-world-probe.mjs`
  - `...\tasks\15b-minecraft-3d-spawn\**`
  - `...\tasks\{07,08,09,10,15,17}-*\bench.json`
  - `...\tasks\18-wonders-landing\{frozen-prompt.md,spec.md,metadata.json,src\index.html,src\shaders.js,src\world.js,src\vendor\three-r186.iife.js,src\vendor\THREE-LICENSE.txt,inputs\vendor\three-r186.iife.js,inputs\vendor\THREE-LICENSE.txt}`
  - `...\deploy\wonders\wrangler.jsonc`
  - `...\design\2026-09-25-harness-v1-spec.md`, `...\design\2026-09-26-web-3d-sheet-tasks-spec.md`
  - `...\research\landscape-2026-09\*`
  - `...\CLAUDE.md`, `...\package.json`, `...\.gitattributes`
- **modified:** `...\README.md` (harness + showcase sections), `...\.gitignore` (`runs/` fully ignored, `.bench-cache/`, `reports/`).
- **read-for-context:** `tasks/15-minecraft-3d/holdout/{autochecks.mjs,rubric.md}`, `tasks/17-budget-dashboard/holdout/verify-reference.mjs`, `C:\Users\iamjo\Projects\CtxMap\src\core\*`, `C:\Users\iamjo\Projects\video-studio\content\outlines\two-agent-consensus.md`.
- **Re-read these first on resume:**
  1. `design/2026-09-26-web-3d-sheet-tasks-spec.md` (Task 18 checklist table)
  2. `tasks/18-wonders-landing/frozen-prompt.md` (the test contract)
  3. `bench/grade/grade.mjs`
  4. `bench/run.mjs`
  5. `bench/grade/web/legibility.mjs`

## Preserve Verbatim (do NOT paraphrase)
- **Task 18 test contract** (graders depend on it):
  - `data-section` ids: `hero, meteors, volcano, waterfall, wonders, ocean, voices, join`.
  - `data-anim="<section>-text"` (hero: `hero-title`).
  - `data-cursor`, `data-cursor-trail`, `data-counter`, `data-carousel`, `data-prev`, `data-next`, `data-slide` (shown slide `aria-hidden="false"`).
  - `data-form`, `data-form-message` with `data-state="error"|"success"`.
  - `data-menu-button` with `aria-expanded`.
  - `data-depth` elements in `waterfall`.
  - `window.__wonder = { progress(id) /* 0..1 for "volcano","wonders" */, playing(id) /* "galaxy","meteors","waterfall","ocean" */ }`.
- **Counter target** `2,000,000,000,000`.
- **Form messages:** `Please enter your email.` / `That email doesn't look right.` / `Welcome aboard. Your first wonder letter is on its way.`
- **Vendored Three.js:** `three-r186.iife.js` defines `window.THREE`, with `THREE.addons = { EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, FilmPass, Sky, ImprovedNoise }`. Built with esbuild from `.bench-cache/three/entry.js` (three `0.186.1`).
- **Clean Claude flags:** `--setting-sources "" --strict-mcp-config --disable-slash-commands --no-chrome`.
  - `claude --bare` help text: "Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeySource via --settings (OAuth and keychain are never read)".
- **Wrangler Pages failure:** `Could not detect a directory containing static files (e.g. html, css and js) for the project` → use `npx wrangler deploy --config deploy/wonders/wrangler.jsonc` instead.
- **Cloudflare account:** `Iamjoshchang@gmail.com's Account`, id `fcc070660660cc0dff3624efcc082a3f`.
- **Task-15 v2 partial regrade results:**
  - Opus 4.8: `13/22 → 19/24`
  - pi/gpt-6-astra: `14/22 → 24/24`
  - claude-glm: 22/24
  - Opus 5.5: 21/24 and 20/24
  - Sonnet 5: 20/24
  - Haiku 4.5: 11/24
- **Pilot facts:**
  - Task 07: everyone 31/31 except Haiku (26/31, 29/31, false "done").
  - Task 17: all 8/8 except Haiku 0/8 (`add: unexpected throw: Error: Invalid category`) and pi/GLM 7/8 (V8).

## Constraints & Invariants
- **Never edit `tasks/*/holdout/**`.** Grading re-hashes them against `FREEZE_MANIFEST.json`.
- **`.gitattributes` keeps `tasks/*/holdout/**` and `tasks/*/inputs/**` as `-text`** (byte-exact).
- **`runs/` is gitignored and must never be published:** `meta.json` holds absolute paths with the username, and the repo is public (github.com/chang47/AI-Benchmarks).
- **Frozen prompt discipline:** a prompt is frozen once any model has run on it. Task 18's has NOT been run yet, so it can still change. Commit it before the first run.
- **Git:** no PRs, land on master with `--no-ff`, never force, stage only our own files.
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_019WgTSFkmJtFAsWk3hzkJJp`.
- **Anti-fabrication:** every number must be read from `meta.json` / `result.json`; a metric a harness doesn't report stays `null`.
- **Validate UI by rendering and LOOKING** (screenshots via Playwright; the Playwright MCP is disconnected, so use node scripts). Keep files < 500 lines.
- **Memory is tight:** ~1.4–2.2 GB free (Chrome uses ~6 GB). Run grading and model runs serially. Claude Code already killed one batch for low memory; don't restart killed jobs without asking.

## Dead Ends (already tried — do NOT repeat)
- **Photoreal via supplied assets:** Josh rejected it ("push the shader harder… a better test of our model vs using assets"). Cinematic, not photoreal, is the bar.
- **2D canvas/SVG art for task 18:** rejected as simplistic.
- **`overflow:hidden` on pinned sections:** silently breaks `position: sticky`. Use `overflow-x: clip`.
- **`wrangler pages project create/deploy`:** now delegates to Workers and fails for static folders.
- **ES-module import of local three.js under `file://`:** CORS-blocked. Use the IIFE bundle.
- **Judge-only resolution of task-15 R05:** unstable. The deterministic probe replaced it.
- **Legibility sampling with only the target text hidden:** counted the carousel's next quote as "background". Now all text is hidden, with an effective-opacity filter.
- **Oval scrim on phones:** fades out exactly where full-width text sits. The phone panel variant replaced it.
- **`claude --bare` for the clean profile:** refuses subscription auth.

## Next Steps
1. **Runner:** copy `tasks/<slug>/inputs/**` into the workspace in `bench/run.mjs::runOne` (after `makeWorkspace`). Hash-check inputs like holdouts.
2. **Build the task-18 grader:**
   - `tasks/18-wonders-landing/bench.json` + a web-probe grader implementing the 82-point checklist (spec Task 18 table).
   - Reuse `legibility.mjs` and `.bench-cache/wonders/{func,fps}.mjs` logic.
   - Add points scoring (`pointsEarned`/`pointsPossible`) to `grade.mjs` + the report.
3. **Mutation controls for 18:** frozen volcano `progress`, broken pin, never-pausing scenes, cursor removed, no validation, no reduced motion, a console error, low-contrast text. Each must drop only its own group; the reference should score ≥ 95% scripted.
4. **Pilot task 18** on `bench/arms/pilot.json` (serially; ask Josh first).
5. **Resume the paused work only while Josh is away** (mouse grab):
   - `node bench/cli.mjs grade $(ls runs | grep -- "-15-")`
   - `node bench/cli.mjs grade --ungraded`
   - `node bench/cli.mjs run --task 15b --arms bench/arms/pilot.json --parallel 1 --grade`

## Gotchas & Open Questions
- **Legibility probe caveats:** text shadows are ignored (conservative). Opaque-background elements are skipped (axe covers those). It samples fixed checkpoints, so animated backgrounds are only covered 3× per element.
- **Task 18 fps** was measured on Josh's GPU via headless Chrome. The frame-time bands in the grader may need margin on other machines.
- **Open (Josh):**
  - 19b real-page candidate (needs a license check).
  - Is LibreOffice OK to install for task 21?
  - 6–8 judge yes/no questions: keep, trim or add?
- **Josh's taste notes:** likes the first/galaxy scene and the meteors. Wonders cards must be big, with neighbours peeking, draggable and short. He wants fluid "bleed" between scenes, and the cursor effect is "really magical".
- **Video-studio link:** `content/outlines/two-agent-consensus.md` uses `ai-benchmark` as its grader. CtxMap (`C:\Users\iamjo\Projects\CtxMap`) only contributed the context-growth formula (ported in `bench/trajectory/common.mjs`).

## How to Resume
```
cd /c/Users/iamjo/Projects/ai-benchmark
git status --short && git log --oneline -5
npm install                                              # playwright (root)
node bench/checks/check.mjs --quick --no-browser         # expect 14/14
node .bench-cache/wonders/legi.mjs tasks/18-wonders-landing/src/index.html   # expect 85/85 (scratch script; recreate from bench/grade/web/legibility.mjs if .bench-cache was wiped)
npx wrangler deploy --config deploy/wonders/wrangler.jsonc                   # redeploy the showcase after changes
```
Re-read, in order:
1. `design/2026-09-26-web-3d-sheet-tasks-spec.md`
2. `tasks/18-wonders-landing/frozen-prompt.md`
3. `bench/run.mjs`
4. `bench/grade/grade.mjs`
5. `bench/grade/web/legibility.mjs`

Memory: `~/.claude/projects/C--Users-iamjo-Projects-ai-benchmark/memory/project_status_harness.md`.
