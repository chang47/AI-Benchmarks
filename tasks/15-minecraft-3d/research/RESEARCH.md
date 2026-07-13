# Research — 15-minecraft-3d (Minecraft-style 3D voxel one-shot)

Researched 2026-07-12. Meta-rule honored: every adopted rule below traces to an external
authority; the few harness-invented conventions are explicitly marked OURS.

## 1. Prompt canonicity

**Canonical source: Artificial Analysis MicroEvals — "Minecraft 3D"**
<https://artificialanalysis.ai/microevals/minecraft-3d-1751239585894>

- Gallery listing (<https://artificialanalysis.ai/microevals>) describes it as: "A basic
  minecraft 3D eval. It should create a basic chunk with a greedy mesher, block placing
  and distroying and fps camera" (sic), 1 upvote.
- The full prompt ("Project Prompt: WebGL2 Interactive Voxel Engine") was extracted
  VERBATIM from the served page HTML on 2026-07-12 (verified by string-matching the raw
  `Invoke-WebRequest` response, entities decoded: `&#x27;`→', `&amp;`→&, `&quot;`→").
  Frozen word-for-word in `frozen-prompt.md`.
- Ran against 14 models on the site (GPT-4.1, Claude 3.7 Sonnet, o3, Gemini 2.5
  Flash/Pro, MiniMax M1, Mistral Large 2, DeepSeek V3/R1, o4-mini, Llama 4 Maverick,
  Qwen3 32B, Claude 4 Sonnet, Grok 3 mini) — i.e. it is an actively used comparison
  prompt, not a one-off.
- The page notes "A system prompt was added to support web rendering" but does NOT
  disclose that system prompt; we therefore add our own clearly-marked harness addendum
  (delivery contract + test hook) instead of guessing theirs.

**Family survey (rejected variants):**
- "Minecraft Clone" <https://artificialanalysis.ai/microevals/minecraft-clone-1762988092197>
  — asks for a CODE-FREE design document ("Output only textual documentation—no code
  snippets"). Not a runnable one-shot; rejected. (Useful signal: it recommends
  "Three.js or Babylon.js", WASD + mouse first-person controls, chunked storage,
  heightmap terrain — the same feature canon.)
- "Minecraft 3D" <https://artificialanalysis.ai/microevals/minecraft-3d-1753712645748>
  — despite the name, a Minecraft LANDING PAGE (pixel-style HTML site). Rejected.
- "Minecraft Knowledge and Clone Creation" (gallery) — mixed trivia + clone eval.
  Rejected as non-focused.

## 2. Community judging checklist (how these one-shots are graded)

Community practice for judging a one-shot Minecraft clone (sources below) converges on:

| Check | Source |
|---|---|
| It renders a 3D voxel terrain at all (many models fail here) | MicroEvals model gallery for the canonical eval (14-model comparison thumbnails) |
| First-person controls work: WASD + mouse-look + pointer lock | Canonical prompt; BurnyCoder benchmark README ("First-person controls", W/A/S/D, mouse camera) |
| Left-click breaks a block, right-click places one | Canonical prompt ("Destroying Blocks... left-click", "Placing Blocks... right-click"); BurnyCoder ("Break and place different types of blocks", left/right click) |
| Procedurally generated terrain (heightmap, not a flat slab) | Canonical prompt ("simple procedural terrain... sine waves to define height"); BurnyCoder ("Procedurally generated terrain") |
| Crosshair at screen center | Canonical prompt (core UX element) |
| Playable frame rate / performant rendering | Canonical prompt's stated objective ("performant", single draw call per chunk); FPS counter stretch goal |
| Real-time world update on edit (no refresh) | Canonical prompt ("scene should update in real-time without needing a page refresh") |

- **BurnyCoder/minecraft-clone** <https://github.com/BurnyCoder/minecraft-clone> — "My
  periodic benchmark for each new LLM system": Three.js, break/place blocks, procedural
  terrain with trees, 6 block types, first-person + pointer lock. Used as the community
  feature-canon cross-check.
- **MineBench** <https://github.com/Ammaar-Alam/minebench> — voxel BUILD benchmark
  (models emit block coordinates, humans vote). Different genre (spatial reasoning, not
  clone coding); noted and excluded.

## 3. Adopted rules with citations

| # | Rule adopted in spec | Authority |
|---|---|---|
| 1 | Single self-contained HTML file, WebGL2 context, ES6+ | Canonical prompt (Core Technical Requirements) |
| 2 | Terrain = integer block grid, 0 = air; footprint ≥ 16×16 (one 16×16×16 chunk is the canonical example size) | Canonical prompt (Chunk-Based World) |
| 3 | Procedural height variation (sine-style heightmap) | Canonical prompt; BurnyCoder |
| 4 | WASD forward/left/back/right relative to camera yaw | Canonical prompt (FPS Camera → Movement) |
| 5 | Mouse-look = pointer lock; click canvas to lock, Escape releases; consume `movementX`/`movementY` | Canonical prompt; MDN Pointer Lock API (canonical usage incl. movementX/Y and Escape/`exitPointerLock`) <https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API> |
| 6 | WASD handled via `KeyboardEvent.code` (layout-independent, synthesizable) | MDN `KeyboardEvent.code` (recommends `code` for WASD game input) <https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code> |
| 7 | Center-screen raycast picks block + face; left removes, right places on face; context menu suppressed | Canonical prompt (Block Interaction); Amanatides & Woo, "A Fast Voxel Traversal Algorithm for Ray Tracing" <http://www.cse.yorku.ca/~amana/research/grid.pdf> (cited by name in the canonical prompt) |
| 8 | Reach 4–12 blocks (Minecraft's own reach is ~4.5 survival / 5 creative; we accept a band) | <https://minecraft.wiki/w/Breaking> |
| 9 | Greedy meshing / one draw call per chunk = the canonical performance mechanic (spec keeps it as the performance OUTCOME — ≥ 30 FPS — rather than mandating the algorithm, since behavior is what's checkable) | Canonical prompt; community-canonical explainer: 0fps, "Meshing in a Minecraft Game" <https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/> |
| 10 | Edit → remesh → re-upload VBO, scene updates without refresh | Canonical prompt (Dynamic World Updates) |
| 11 | Crosshair centered; on-screen instructions before lock, hideable during lock | Canonical prompt (UX Elements) |
| 12 | FPS counter measured from real rAF timing, labeled HUD | Canonical prompt (Stretch Goals → Simple UI), PROMOTED to required (see §4); technique: <https://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html> (same authority as task 06) |
| 13 | Pitch clamped so camera can't flip | Standard FPS behavior shown in MDN Pointer Lock example code (pitch bounded) |

## 4. Disagreements found + conventions picked

1. **Libraries: canonical prompt FORBIDS Three.js; the wider family recommends it.**
   The frozen prompt keeps the verbatim no-libraries constraint (raw models get canon).
   The artifact contract permits an off-canon fallback: Three.js only if VENDORED at
   `src/vendor/three.min.js`, referenced relatively — never a CDN (verifier is offline
   at `file://`). Vendored copy must be a UMD build ≤ r160: UMD builds were deprecated
   at r150 and removed after r160 (<https://github.com/mrdoob/three.js/pull/25435>,
   <https://discourse.threejs.org/t/umd-version-of-three-js-v-161/60912>), and local ES-
   module imports are CORS-blocked under `file://` (MDN JavaScript modules guide,
   <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules>), so a
   relative classic `<script>` is the only offline-safe way to load it.
2. **FPS counter: stretch goal in canon, required here.** The task scope and community
   judging ("playable frame rate") need a measurable surface; promoted to required and
   disclosed in the frozen prompt's harness addendum.
3. **Block types: canonical core = 1 solid type; community canon (BurnyCoder) = 6.**
   Convention picked: no block-type minimum, but faces must be visually distinguishable
   (directional shading and/or ≥ 2 block colors) so the render is judgeable as 3D — the
   dominant observed failure in the 14-model gallery is unshaded silhouettes.
4. **"Playable frame rate" has no canonical number.** OURS: ≥ 30 FPS 5-second average
   (standard playability floor), idle and after 25 scripted edits.
5. **Physics:** neither the canonical prompt nor the family requires gravity/collision
   (BurnyCoder has it as an extra). Convention: optional, flying movement acceptable.
6. **Test hook `window.__voxel` + coordinate/angle convention (y-up, [x,x+1) cells,
   yaw 0 → −Z, forward = (−sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch)).** OURS —
   harness-invented for programmatic verification (mandated shape:
   blockCount/place/remove/player), disclosed in the frozen prompt addendum; the pinned
   angle convention is what makes WASD-direction and place-in-view checks objective.

## 5. Contamination assessment

HIGH. Minecraft clones are among the most-replicated LLM one-shots in existence and the
canonical prompt itself is public on MicroEvals. Grading therefore leans on the pinned
`__voxel` hook contract, the angle convention, and behavioral/screenshot checks — surfaces
a memorized solution does not automatically satisfy.
