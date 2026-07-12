# Research — Bouncing Balls Inside a Spinning Polygon

Stage 1 (researcher + spec author), 2026-07-11 overnight run.
Meta-rule honored: every correctness rule below traces to an external authority; none invented here.

## Second-brain check

Grepped `C:/Users/iamjo/second-brain` for "bouncing" and "benchmark". No prior notes on this task family
(only unrelated trading/career hits). The vetted-bench design doc
(`C:/Users/iamjo/Projects/vetted-bench/docs/superpowers/specs/2026-07-11-vetted-bench-design.md`) lists this as
task #4, type B ("canonical model-killer physics/render task"), graded Blind A/B + rubric, and warns that "the
pelican and the hexagon are in training data now — contaminated" (see Contamination note below).

## Origin and lineage of the canonical prompt

1. **Original (single ball, hexagon)** — Flavio Adamo (@flavioAd), X, Jan 31 2025:
   > "write a Python program that shows a ball bouncing inside a spinning hexagon. The ball should be affected by gravity and friction, and it must bounce off the rotating walls realistically"
   - https://x.com/flavioAd/status/1885449107436679394 (the viral o3-mini vs DeepSeek R1 post)
   - Confirmed as the originator by Theo (t3.gg): https://x.com/theo/status/1892505193406730559 and by Flavio's own
     one-year-anniversary post: https://x.com/flavioAd/status/2025531815931351413
   - OpenAI Developers themselves used "@flavioAd's" test for GPT-4.5: https://x.com/OpenAIDevs/status/1895226704408481893

2. **Multi-ball variants** — AK (@_akhaliq), Feb 2025:
   > "write a script that shows 10 balls bouncing inside a spinning hexagon. The balls should be affected by gravity and friction, and must bounce off the rotating walls realistically"
   - https://x.com/_akhaliq/status/1885733581651050586 (also a 100-balls hexagonal-prism variant:
     https://x.com/_akhaliq/status/1885785469306163510)

3. **THE canonical numbered-balls version (20 balls, spinning heptagon)** — KCORES LLM Arena, GitHub, ~Feb–Apr 2025.
   This is the version the task scope describes ("~20 numbered balls") and the only one with a published,
   widely-cited scoring rubric. Full verbatim prompt + 90-point rubric:
   - https://github.com/KCORES/kcores-llm-arena/blob/main/benchmark-ball-bouncing-inside-spinning-heptagon/README.md
   - Raw file verified this session (22,306 bytes fetched):
     https://raw.githubusercontent.com/KCORES/kcores-llm-arena/main/benchmark-ball-bouncing-inside-spinning-heptagon/README.md
   - Prompt frozen VERBATIM in `../frozen-prompt.md` (see Adaptation note for the two flagged substitutions).

4. **Press coverage of the phenomenon** — TechCrunch, Jan 24 2025, "People are benchmarking AI by having it make
   balls bounce in rotating shapes":
   - https://techcrunch.com/2025/01/24/people-are-benchmarking-ai-by-having-it-make-balls-bounce-in-rotating-shapes/
   - Documents the community failure signal ("misjudged the physics, resulting in the ball escaping the shape") and
     the rigor caveat ("slight variations in the prompt can yield different outcomes" → freeze the wording, which
     the design doc already mandates).

5. **HTML/JS single-file convention** (the artifact format this bench uses):
   - Artificial Analysis MicroEval "Balls bouncing inside a spinning hexagon" (verbatim prompt: "Create an
     animation in JS with 10 balls bouncing inside a spinning hexagon."), community-upvote judged:
     https://artificialanalysis.ai/microevals/balls-bouncing-inside-a-spinning-hexagon-1750176234580
   - Hasan Can (@HCSolakoglu), X, Apr 2025 — explicit "Generate a single, self-contained HTML file demonstrating a
     robust physics simulation of multiple balls bouncing within a rotating regular polygon container using the
     HTML Canvas API": https://x.com/HCSolakoglu/status/1911889543189712976

6. **Secondary repos replicating the test** (corroborate wording + judging dimensions):
   - https://github.com/aligeramy/ai-benchmark (hexagon prompt verbatim; judges on Correctness / Completeness /
     Code Quality / Performance / Error Handling)
   - https://github.com/lucrbvi/bouncing-ball-hexagon

## How the community judges results (adopted correctness rules, each with citation)

The KCORES rubric (source 3) is the only published objective rubric — 18 criteria x 5 points = 90, human-scored
per run, best of 3 runs, and **hard zero if the program fails to run, exits with an error, shows no picture, or is
not an animation**. Its per-model score table doubles as a catalogue of real observed failure modes. Rules adopted
(criterion numbers = KCORES rubric rows):

| # | Rule adopted | KCORES criterion / other source |
|---|---|---|
| R1 | Single-file implementation, no external/physics libraries; collision detection + response implemented by hand | #1, #2 |
| R2 | Exactly 20 balls displayed, all same radius | #3, #4 (many models rendered only ONE ball: Grok-2/3, Qwen-QwQ, GPT-4.1-nano, Doubao) |
| R3 | Numbers 1–20 visible on the balls, no duplicates/omissions | #5 |
| R4 | All balls drop from the polygon center at start | #6 |
| R5 | The 20 specified colors used | #7 |
| R6 | Ball–ball collisions AND ball–wall collisions both present | #8 (frequent failure: "no collisions" — Gemini-2.0-Flash, GPT-4o-mini, Qwen-2.5-Max, Llama-4-Maverick) |
| R7 | Friction present; balls spin, numbers rotate with the spin at a plausible rate | #9, #12, #15 (the single most-failed cluster: "no friction"/"numbers don't rotate" across ~15 models) |
| R8 | Gravity constantly downward in SCREEN space (does not rotate with the polygon) | #10 ("gravity should always stay downward and obey physics") |
| R9 | Elasticity bounded: bounces visibly damp (not perfectly elastic) but are not dead — impact bounce height stays under the polygon radius yet exceeds the ball radius | #11 + prompt bullet ("impact bounce height will not exceed the radius of the heptagon, but higher than ball radius") |
| R10 | Balls never overlap persistently after the initial release | #13 ("balls overlap" failed DeepSeek-V3, GPT-4o, Gemma-3, Llama-4, o4-mini) |
| R11 | **Containment: balls never escape/tunnel through the walls** | #14 — the signature failure ("ball fell out of the heptagon" hit Claude-3.5-Sonnet, DeepSeek-V3-0324, Gemini-2.0-Flash*, GPT-4o*, Grok-3, Qwen, Llama-4, hunyuan…); TechCrunch (source 4) independently names "ball escaping the shape" as THE fail signal |
| R12 | Regular polygon drawn correctly (equal sides), large enough to contain all balls, fits the window | #16 |
| R13 | Polygon spins about its center at 360° per 5 s; visibly, not too fast/slow (±50% tolerance for partial credit) | #17 |
| R14 | Animation smooth (no stutter, not hyper-speed / slow-motion) and runs indefinitely | #18 + hard-zero rule (crash / blank / static = 0) |
| R15 | Wall bounces must respect the MOVING wall (velocity reflected about the current wall normal, wall's rotational velocity felt) — "bounce off the rotating walls realistically" | prompt text itself (sources 1, 2, 3 all share this exact clause); spin transfer is what graders eyeball via the rotating numbers (#9/#12) |

## Disagreements between sources, and the convention picked

1. **Language/runtime: Python+tkinter (flavioAd, KCORES) vs JS/HTML single file (MicroEval, Hasan Can).**
   → Picked **one self-contained HTML file, canvas rendering** — mandated by the vetted-bench design doc scope and
   the stage brief's artifact contract; the HTML convention is independently community-established (sources 5).
2. **Shape: hexagon (original) vs heptagon (KCORES 20-ball version).**
   → Picked **heptagon**, because the ~20-numbered-balls scope matches only the KCORES version, and that is the
   only variant with a published rubric.
3. **Ball count: 1 / 10 / 20 / 100 across variants.**
   → Picked **20 numbered balls** (KCORES; matches the design-doc scope "~20 numbered balls").
4. **Judging: human-eyeball rubric (KCORES) vs 5 soft dimensions (aligeramy) vs upvotes (MicroEval).**
   → Picked the **KCORES 18-criterion rubric** as the objective backbone (it subsumes the others), reformulated as
   testable acceptance criteria in `../spec.md`; the bench's Blind A/B + rubric grading maps onto it directly.
5. **Color list quirk:** the verbatim KCORES color list contains duplicates (#ec6800 twice, #ea5506 twice). Kept
   verbatim — the rubric's "numbers unique" rule (R3), not colors, carries uniqueness.

## Adaptation note (frozen-prompt.md)

The KCORES prompt is frozen VERBATIM except three short clauses that would otherwise contradict the artifact
contract, each flagged inline with an `[ADAPTED]` marker in `../frozen-prompt.md`:
- "Write a Python program" → "Write a single self-contained HTML file with JavaScript".
- The library clause ("Do not use the pygame library… allowed: tkinter, math, numpy, dataclasses, typing, sys")
  → no external libraries, vanilla JS + Canvas API only.
- "All codes should be put in a single Python file." → "…a single HTML file." These substitutions
  follows the community HTML convention wording of sources 5 (Hasan Can: "single, self-contained HTML file …
  HTML Canvas API").
Every physics/behavior bullet is untouched.

## Contamination caveat (for the bench runner, not the builder)

The design doc's own principle: hexagon/heptagon prompts are in post-2025 training data. The canonical wording is
frozen here because the brief demands it; at episode time the runner may swap the polygon (e.g. side count) per the
"Swap Josh's own variant each episode" principle. That swap is out of scope for this task folder.
