# Frozen Prompt — Bouncing Balls Inside a Spinning Polygon

Origin: KCORES LLM Arena, "Ball Bouncing Inside Spinning Heptagon" benchmark
(https://github.com/KCORES/kcores-llm-arena/blob/main/benchmark-ball-bouncing-inside-spinning-heptagon/README.md),
itself descended from Flavio Adamo's original hexagon test (https://x.com/flavioAd/status/1885449107436679394).
Wording is verbatim from the KCORES README except the two clauses marked `[ADAPTED]`, which retarget the
language/runtime from Python+tkinter to a single self-contained HTML file per the bench artifact contract
(rationale + citation trail: research/RESEARCH.md, "Adaptation note").

Run best-of-3 with this exact text. Never reword between runs or models.

---

Write a single self-contained HTML file with JavaScript that shows 20 balls bouncing inside a spinning heptagon: `[ADAPTED — was "Write a Python program that shows 20 balls bouncing inside a spinning heptagon:"]`
- All balls have the same radius.
- All balls have a number on it from 1 to 20.
- All balls drop from the heptagon center when starting.
- Colors are: #f8b862, #f6ad49, #f39800, #f08300, #ec6d51, #ee7948, #ed6d3d, #ec6800, #ec6800, #ee7800, #eb6238, #ea5506, #ea5506, #eb6101, #e49e61, #e45e32, #e17b34, #dd7a56, #db8449, #d66a35
- The balls should be affected by gravity and friction, and they must bounce off the rotating walls realistically. There should also be collisions between balls.
- The material of all the balls determines that their impact bounce height will not exceed the radius of the heptagon, but higher than ball radius.
- All balls rotate with friction, the numbers on the ball can be used to indicate the spin of the ball.
- The heptagon is spinning around its center, and the speed of spinning is 360 degrees per 5 seconds.
- The heptagon size should be large enough to contain all the balls.
- Do not use any external libraries or frameworks; implement collision detection algorithms and collision response etc. by yourself. Only vanilla JavaScript and the HTML Canvas API are allowed. `[ADAPTED — was "Do not use the pygame library; implement collision detection algorithms and collision response etc. by yourself. The following Python libraries are allowed: tkinter, math, numpy, dataclasses, typing, sys."]`
- All codes should be put in a single HTML file. `[ADAPTED — was "All codes should be put in a single Python file."]`

---

Note for the harness: strip the `[ADAPTED — …]` markers before sending; they are provenance annotations, not prompt text.
