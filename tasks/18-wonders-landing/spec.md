# Spec — Wonders of the Universe (task 18)

The full task design and the points checklist are in
[`design/2026-09-26-web-3d-sheet-tasks-spec.md`](../../design/2026-09-26-web-3d-sheet-tasks-spec.md) → "Task 18".
The prompt given to models (including the exact copy and the test contract) is
[`frozen-prompt.md`](./frozen-prompt.md).

`src/index.html` is the reference ("starter") page, written 2026-09-26. It meets the contract. It was
checked by rendering it in a real browser and looking at the screenshots of every section. Its
functions were also checked: cursor, carousel, 3 form states, mobile menu, reduced motion, pausing
off-screen scenes, and volcano progress following the scroll. It exists to prove the grader's probes,
and to be the 19a clone target if no model page beats it.

Bug caught while building it: `overflow: hidden` on a pinned section silently disables
`position: sticky`, so the volcano and wonders strip scrolled away instead of pinning. That is exactly
what the "stays pinned" checks are there to catch in model builds.
