# Research — Task 05: SVG drawing (community-canonical object)

Stage 1 (RESEARCHER + SPEC AUTHOR), overnight run 2026-07-11.
Meta-rule for tonight: every correctness rule below traces to an external authority; nothing invented here.

## Base-path note (orchestrator bug)

The launching script passed `BASE = undefined`. Resolved to `C:\Users\iamjo\Projects\vetted-bench`
(the Vetted Bench repo; design doc at `docs/superpowers/specs/2026-07-11-vetted-bench-design.md`
lists this exact task as starter-suite #5). All files live under `tasks/05-svg-object/`.

## Second-brain check (Step 1)

Grepped `C:/Users/iamjo/second-brain` for `pelican`, `svg benchmark|svg eval|svg drawing`:
**no matches.** No prior vault context on this task.

## The canonical community task

**Simon Willison's "pelican riding a bicycle" SVG benchmark.**

- Created late 2024. Canonical prompt, verbatim from the repo README:
  **`Generate an SVG of a pelican riding a bicycle`**
  Source: https://github.com/simonw/pelican-bicycle (repo title: *"LLM benchmark: Generate an SVG of a pelican riding a bicycle"*).
- Original post (2024-10-25): chosen because Willison likes pelicans and believed
  "there aren't any pelican on a bicycle SVG files floating around (yet)" — i.e. it forces
  generative composition, not retrieval. He ran 16 models and compared the rendered SVGs visually.
  Source: https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/
- Still the community's go-to informal eval in 2026; Willison's tag page shows it applied to every
  major model release through July 2026.
  Source: https://simonwillison.net/tags/pelican-riding-a-bicycle/

## How the community judges results

1. **Willison's own judging is holistic + comparative, not rubric-based.** For his June 2025
   AI Engineer keynote he ran 560 pairwise image matchups over 34 pelican SVGs, judged by an LLM
   with the instruction "Pick the best illustration of a pelican riding a bicycle," then computed
   Elo ratings. Source: https://simonwillison.net/2025/Jun/6/six-months-in-llms/
2. **But his running commentary names concrete quality signals**, which the community echoes.
   Recurring GOOD signals (tag-page commentary across releases):
   - recognizable pelican anatomy: distinctive long beak with pouch, head/neck, body, legs
   - "The bicycle is the correct shape" — two wheels, connected frame, handlebars, pedals
   - proper proportions and the pelican correctly positioned ON the bicycle
   Recurring BAD signals (his named failure modes):
   - bicycle frame disconnections (pedals/rear wheel not attached to frame)
   - disconnected handlebars
   - both pelican legs on one side
   - pelican positioned off the bike or off the canvas
   - abstract blobs "that look nothing like they should" (his worst-ranked output)
   Source: https://simonwillison.net/tags/pelican-riding-a-bicycle/
3. **Third-party summary** (secondary source) decomposes the same axes: syntactic correctness of
   the SVG markup, structural understanding of bicycle + pelican anatomy, spatial reasoning for
   composition, stylistic creativity. Source: https://grokipedia.com/page/Pelican_on_a_bicycle_AI_benchmark
4. **Community variant** (Robert Glaser's "Agentic Pelican on a Bicycle") deliberately keeps the
   prompt minimal, and the improvements models made converge on the same implicit criteria:
   mechanical coherence (chain/pedals connect), proportional accuracy, pose/composition
   (positioning relative to handlebars). Source: https://www.robert-glaser.de/agentic-pelican-on-a-bicycle/

### Disagreement + the convention we pick

- **Disagreement:** Willison and Glaser both *refuse* an explicit rubric (holistic pairwise
  judging preserves the zero-shot spirit); tonight's bench needs testable acceptance criteria.
- **Resolution:** we adopt an **explicit decomposed rubric** built ONLY from the failure modes and
  quality signals Willison himself has named in writing (list above). This also matches the Vetted
  Bench design doc's Type-B scoring rule: "Rubric verdicts beat holistic 'which is better'
  verdicts." The frozen prompt stays holistic/verbatim; only the *grading* is decomposed.
- Also decided: the artifact must be genuine **vector** art — no embedded raster (`<image>` /
  base64 data URIs). The community task is explicitly an *SVG code generation* test ("requires
  genuine creative code generation"); embedding a bitmap would bypass what the benchmark measures.

## CONTAMINATION NOTE (explicit, per brief)

**The real Vetted Bench will swap in Josh's own object, NOT the pelican**, because the pelican is
now in training data — contaminated:

- Willison himself documents the contamination loop: Steve Cosman's `pelicans_riding_bicycles`
  repo deliberately "pollutes the training set," and Willison concedes "most of the examples I've
  published count as poisoning too." He wrote a whole post on labs training for the benchmark:
  https://simonwillison.net/2025/Nov/13/training-for-pelicans-riding-bicycles/ (OpenAI's Aidan
  McLaughlin: "we do not hill climb on svg art" — but the exposure risk stands).
- The Vetted Bench design doc encodes the same rule: "The pelican and the hexagon are in training
  data now — contaminated. Personal variants are both cleaner evals and channel branding."

**Tonight uses the community pelican deliberately** because tonight's meta-rule is that
correctness must be community-defined, and the pelican is the only SVG task with a rich public
judging record to outsource correctness to.

## Sources (authorities)

1. https://github.com/simonw/pelican-bicycle — canonical repo; verbatim prompt.
2. https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/ — original benchmark post.
3. https://simonwillison.net/2025/Jun/6/six-months-in-llms/ — keynote; pairwise LLM-judge + Elo methodology.
4. https://simonwillison.net/tags/pelican-riding-a-bicycle/ — ongoing series; named good/bad signals.
5. https://simonwillison.net/2025/Nov/13/training-for-pelicans-riding-bicycles/ — contamination/training-for-the-benchmark.
6. https://www.robert-glaser.de/agentic-pelican-on-a-bicycle/ — community agentic variant; implicit criteria.
7. https://grokipedia.com/page/Pelican_on_a_bicycle_AI_benchmark — secondary summary of judged axes.

## Correctness rules adopted → citations

| # | Rule | Authority |
|---|------|-----------|
| R1 | Valid, renderable SVG markup (syntactic correctness) | Grokipedia summary [7]; implicit in Willison's render-and-compare workflow [2][3] |
| R2 | Pelican anatomy: long beak with pouch, head, body, legs | Willison tag-page commentary [4]; keynote winners [3] |
| R3 | Bicycle structure: two wheels, connected frame, handlebars, pedals | Willison: "the bicycle is the correct shape"; named failures = frame/handlebar disconnections [4]; Glaser: mechanical coherence [6] |
| R4 | Riding pose: pelican ON the bike, plausible contact (legs→pedals, toward handlebars), legs not both on one side | Willison failure modes [4]; Glaser pose/composition [6] |
| R5 | Composition: everything on-canvas, wheels grounded, coherent scene | Willison: "pelican ends up positioned off the screen" as failure [4]; spatial-reasoning axis [7] |
| R6 | Recognizability to a cold human viewer ("looks nothing like they should" = fail) | Willison worst-case commentary [3][4] |
| R7 | Genuine vector art — no embedded raster, no scripts/external refs (static one-file SVG) | Benchmark measures SVG *code generation* [2][7]; artifact contract from the bench brief |
| R8 | Frozen prompt used verbatim, one-shot | Willison's protocol (same prompt across all models) [1][2]; Vetted Bench design principle "freeze the exact prompt" |
