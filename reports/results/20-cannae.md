# 20-cannae — results

Exported 2026-09-27 from runs/*/result.json (scores only; raw runs stay local).
Current grader: holdout FREEZE_MANIFEST sha256 6970bc48077e. Runs graded before manifests were recorded show "—"; all rows below were graded on the same grader in one pass unless marked.

| Harness / model | Points | Scripted | Judge | Claimed done | False done | Build time | Lost checks |
|---|---|---|---|---|---|---|---|
| claude / claude-opus-5-5 | 60/65 (92%) | 57/60 | 3/5 | claimed | no | 33.9 min | H-ratio, H-gauls, J1, J5 |
| claude-glm / glm-5.3 | 60/65 (92%) | 57/60 | 3/5 | claimed | no | 81.1 min | R-contact, R-overlap, J1, J3 |
| claude-glm / glm-5.3 | 56/65 (86%) | 54/60 | 2/5 | — (hit time limit) | — | 60.3 min | R-contact, R-overlap, H-ratio, H-gauls, J3, J4, J5 |
| claude / claude-opus-4-8 | ok | — | — | — | — | 43.7 min |  |
| pi / zai/glm-5.3 | ok | — | — | — | — | 51.2 min |  |
