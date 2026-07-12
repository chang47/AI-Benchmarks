# Frozen prompt — Task 05 (SVG object)

The exact one-shot prompt given verbatim to a raw model in a benchmark run:

```
Generate an SVG of a pelican riding a bicycle
```

## Provenance

This is the community-canonical wording, quoted verbatim from Simon Willison's benchmark:

- Repo README (canonical statement of the prompt): https://github.com/simonw/pelican-bicycle
- Original post introducing the benchmark (2024-10-25): https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/

## Protocol notes

- The prompt is frozen: never reworded between runs or models (Willison runs the identical
  prompt across every model; the Vetted Bench design doc mandates "freeze the exact prompt,
  run best-of-3").
- One-shot: no follow-ups, no iteration, no rendering feedback to the model.
- The model's SVG output is saved as `src/object.svg` and graded against `spec.md` /
  the task rubric by a judge that is never the model under test.
- Contamination caveat (recorded in research/RESEARCH.md): the pelican prompt is in training
  data; production Vetted Bench episodes swap in Josh's own object. The pelican is used here
  deliberately because tonight's correctness is community-defined.
