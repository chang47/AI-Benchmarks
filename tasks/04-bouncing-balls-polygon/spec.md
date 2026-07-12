# Spec — Bouncing Balls Inside a Spinning Heptagon

## Purpose

Build the reference implementation of the community-canonical "model-killer" physics/render task: 20 numbered
balls bouncing under gravity and friction inside a regular heptagon that spins about its center, with realistic
ball–wall collisions against the ROTATING walls and ball–ball collisions. This reference is what benchmark
candidates' outputs will be compared against (blind A/B + rubric), so it must nail every criterion below — the
criteria are exactly the points on which real models fail.

## Artifact contract

- Deliverable: `src/index.html` — exactly ONE file.
- Fully self-contained: no network requests of any kind (no CDN scripts, no external CSS/fonts/images). Inline
  everything.
- No external libraries or frameworks; no physics engines. Vanilla JavaScript + HTML Canvas API only. Collision
  detection and collision response implemented by hand.
- Opens directly via `file://` in a modern Chromium browser and starts animating immediately — no build step, no
  server, no user interaction required to start.
- Must never call `alert()`, `confirm()`, `prompt()`, or anything else that opens a dialog.

## Scene constants

- Container: a REGULAR heptagon (7 equal sides), centered in the canvas, large enough to contain all 20 balls
  comfortably and fully visible inside the window (do not overflow the viewport).
- Heptagon rotation: spins about its own center at exactly 360 degrees per 5 seconds (72°/s), continuously.
- Balls: exactly 20; all the SAME radius; each labeled with a unique number 1–20 drawn on the ball.
- Ball fill colors, assigned in order 1–20 (duplicates are intentional, keep verbatim):
  `#f8b862, #f6ad49, #f39800, #f08300, #ec6d51, #ee7948, #ed6d3d, #ec6800, #ec6800, #ee7800, #eb6238, #ea5506, #ea5506, #eb6101, #e49e61, #e45e32, #e17b34, #dd7a56, #db8449, #d66a35`
- Spawn: all balls start at (or tightly clustered around) the heptagon's center and drop from there under gravity.

## Acceptance criteria

Happy path:

1. Opening `src/index.html` from disk shows a canvas with a regular heptagon and 20 balls animating, with zero
   console errors or uncaught exceptions — at load and after 5+ minutes of continuous running.
2. The heptagon VISIBLY rotates about its center; one full revolution takes 5 seconds (±10% is fine for the
   reference; graders penalize beyond ±50%).
3. Exactly 20 balls are rendered, all with the same radius, numbered 1–20 with no duplicate or missing numbers,
   using the 20 specified colors in order.
4. All balls drop from the heptagon center at start and fall under gravity.
5. Gravity always points DOWN in screen space. It must not rotate with the heptagon.
6. Balls bounce off the heptagon walls realistically: velocity reflects about the CURRENT wall normal of the
   rotated wall, and the wall's own motion (from rotation) influences the bounce — a moving wall imparts velocity.
7. Ball–ball collisions occur: balls visibly push off each other (equal-mass elastic-style impulse with damping is
   acceptable).
8. Friction and spin: collisions and rolling contact slow the balls over time, balls acquire spin, and the painted
   number rotates with each ball's spin at a plausible rate (this is how a viewer sees the spin).
9. Bounce energy is bounded on both sides: after the initial drop settles, a typical impact bounce rises HIGHER
   than one ball radius but NEVER above the heptagon's circumradius — i.e. restitution is neither ~0 (dead balls
   stuck to the wall) nor ~1 (perpetual full-height bouncing).
10. The animation is smooth at ~60 fps with all 20 balls active (no visible stutter, no slow-motion or
    hyper-speed), using requestAnimationFrame timing that stays stable if the tab briefly loses focus.

Edge cases / invariants (the researched community fail conditions — each must hold FOREVER, not just at start):

11. CONTAINMENT: no ball ever escapes or tunnels through a wall. Concretely: every ball's center remains strictly
    inside the heptagon polygon on every frame, including during fast spin, corner hits, and pile-ups. This is the
    single most-failed criterion in community testing — treat wall collision robustly (e.g. handle the case where
    a ball would cross a wall between frames, and re-resolve after the heptagon rotates into a ball).
12. BALL COUNT: the number of balls stays exactly 20 for the entire run — none deleted, none duplicated, none
    frozen off-screen.
13. NO PERSISTENT OVERLAP: after the initial release from the center, no two balls remain visibly interpenetrated;
    resting stacks/piles look physically plausible (balls settle against walls and each other without jitter
    explosions or sinking into one another).
14. CORNER SAFETY: a ball meeting a heptagon vertex (two walls at once) must not gain energy, get ejected, or pass
    through.
15. LONG-RUN STABILITY: energy never blows up — the system must not accelerate over time; with friction on, an
    undisturbed pile eventually calms while the rotating walls keep stirring it (both behaviors coexisting is
    correct).
16. The page never scrolls, never shows a blank screen, and never stops animating (a static frame counts as
    failure).

## Non-goals

- No UI controls, sliders, sound, score, or resize handling beyond keeping the scene visible are required.
- No test code in the artifact.
- Determinism is not required; a seeded/random initial jitter at the center is fine.
