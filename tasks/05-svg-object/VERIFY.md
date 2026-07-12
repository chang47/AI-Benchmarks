# VERIFY — Task 05: SVG Object (pelican riding a bicycle)

## Round 0

Independent verifier (did not build the candidate). Harness: local Playwright (Chrome channel,
headless) in `verify/check.mjs`; SVG rendered inline in a minimal blank HTML page loaded via
`file://`. Evidence: `verify/round-0/results.json`, screenshots `shot-0s.png` / `shot-3s.png`
(byte-identical, diff = 0 — confirms static). Console errors: 0. Page errors: 0.

### Checklist (spec acceptance criteria, equal weight)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Exists, well-formed XML, full artifact contract (static, self-contained, vector-only, xmlns + viewBox) | PASS | DOMParser: no parsererror; xmlns=svg ns; viewBox="0 0 800 600"; no `<script>`/on* handlers/SMIL/CSS animation/`<image>`/data-URIs/external URLs (programmatic scan of every attribute) |
| 2 | Renders as visible drawing, no console/parse errors | PASS | 0 console errors, 0 page errors; rendered bbox > 100px; screenshot shows full scene |
| 3 | Long beak with visible pouch, longer than head | PASS | Beak bbox 110 wide vs head diameter 52 (programmatic); screenshot shows a large sagging orange pouch under the beak line — unmistakably pelican |
| 4 | Distinct head, neck, body + eye | PASS | Round head circle, white S-curve neck, oval body, black eye with white highlight all visible in screenshot |
| 5 | Legs on opposite sides of the bike | PASS | Far leg (muted brown) at DOM order 9, painted BEFORE wheels (order 14) = behind bike; near leg (bright orange) at order 55, in front; both visible in screenshot with correct occlusion |
| 6 | Two wheels ~equal size (within 25%) | PASS | Both wheels r=95 at (250,450) and (570,450) — exactly equal |
| 7 | Frame attaches to BOTH hubs, no floating members | PASS | 2 frame lines terminate at rear hub, 1 (fork) at front hub (within 15px probe); visually all red members meet at joints |
| 8 | Handlebars connected to fork/front | PASS | Stem line from head tube (528,300) to (522,264); bar curve starts there; visually attached in screenshot |
| 9 | Pedal/crank at bottom bracket (saddle recommended) | PASS | Chainring circle (400,460) r20; 2 crank lines from it; 2 pedal rects within 60px; saddle present above seat tube |
| 10 | Pelican ON the bike: body above frame between wheels, over saddle | PASS | Body ellipse (375,250) horizontally between hubs, above them (programmatic); screenshot shows body resting on the saddle, no wheel overlap, no floating gap |
| 11 | Contact points: leg to pedal, oriented to handlebars | PASS | Near leg path ends at the near pedal (436,494) with a foot; neck/head lean forward; wing sweeps to the handlebars (the "ideal" case) |
| 12 | Whole scene inside the viewBox, nothing clipped | PASS | Per-element bbox+stroke/2 scan: only flag is the full-bleed ground edge line (1.5px heuristic overstatement from butt caps on a 0..800 horizontal line — intentional backdrop, not a scene element); screenshot confirms nothing clipped |
| 13 | Wheel bottoms on a common ground line (within 5% of height) | PASS | Both wheel bottoms at y=545 exactly; ground line at y=546 |
| 14 | Bird and bike visually distinguishable | PASS | White/cream bird + orange beak/legs vs red frame + black wheels; 24 distinct colors |
| 15 | Cold-viewer test | PASS | Screenshot reads instantly as a bird riding a bicycle, and the pouched beak specifically says pelican; nothing abstract |

### Verdict

- **passRate: 15/15 = 1.00**
- **Fake-convergence flag: NO** — builder claimed done (STATUS "BUILD r0: CLAIMED DONE=yes") and the claim holds.
- **Verdict: PASS**

Minor non-blocking observations (not criteria failures): the wing tip slightly overlaps the
handlebar hook, and the far-side pedal is muted grey — both are depth-cue choices that read
correctly in the render.
