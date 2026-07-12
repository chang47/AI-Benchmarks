# Task 05 — SVG Object: Pelican Riding a Bicycle

## Purpose

Produce one static SVG file depicting a **pelican riding a bicycle** — the community-canonical
SVG generation task. The drawing is judged on whether a person seeing it cold recognizes both the
pelican and the bicycle, and on whether the scene composes as an actual riding pose. This is a
Type-B (visual) benchmark task: the artifact is the deliverable; there is no application code.

## Artifact contract

- **Exactly one file: `src/object.svg`** (inside this task folder).
- One **static** SVG document:
  - No `<script>` elements and no event-handler attributes (`onload`, `onclick`, etc.).
  - No animation: no SMIL elements (`<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`)
    and no CSS animations/transitions.
  - No external references of any kind: no `http(s)://` URLs, no external CSS/font/image loads.
    Everything inline in the one file.
  - No embedded raster images: no `<image>` elements and no base64/raster `data:` URIs. The
    drawing must be built from vector primitives (paths, shapes, groups, gradients are fine).
- Root `<svg>` element has the SVG namespace (`xmlns="http://www.w3.org/2000/svg"`) and a
  `viewBox` attribute.
- Opens and renders in a stock browser (Chrome/Firefox) with no console errors or parse errors.

## Acceptance criteria

**Validity**

1. `src/object.svg` exists, is well-formed XML, and satisfies every point of the artifact
   contract above (static, self-contained, vector-only, namespaced root with `viewBox`).
2. The file renders in a browser as a visible drawing (not blank, not a parse error page).

**Pelican (anatomy must be present and identifiable)**

3. The bird has a **long beak with a visible pouch** — the beak is clearly longer than the head
   is tall/wide, and the pouch reads as a bulge or second contour under the beak. This is the
   single feature that distinguishes a pelican from a generic bird; without it the task fails.
4. The bird has a distinct **head, neck, and body** (separate shapes or clearly articulated
   contour), plus at least one visible **eye**.
5. The bird has **legs** that are visible and on plausibly opposite sides of the bicycle — NOT
   both legs rendered on the same side (a known community-flagged failure).

**Bicycle (structure must be mechanically coherent)**

6. **Two wheels** of approximately equal size (within ~25% of each other's diameter), rendered as
   circles/ellipses.
7. A **frame** of connecting lines/paths that visibly attaches to BOTH wheel hubs/centers — no
   floating wheels and no frame members that end in space (frame disconnection is a known
   community-flagged failure).
8. **Handlebars** at the front of the frame, visibly connected to the frame/front-wheel fork —
   not floating detached.
9. At least one **pedal/crank** near the bottom bracket area of the frame. A seat/saddle is
   strongly recommended (the pelican needs something to sit on) but the pedal is mandatory.

**Riding pose and composition**

10. The pelican is positioned **on the bicycle**: its body sits above the frame between the two
    wheels (over the saddle area), not beside the bike, not floating above it with a visible gap,
    and not overlapping into the wheels.
11. Plausible contact points: at least one leg extends toward a pedal, and the body/neck orients
    toward the handlebars (a wing reaching the handlebars is ideal).
12. The entire scene fits **inside the viewBox** — no element of the pelican or bicycle is
    clipped off-canvas (off-screen placement is a known community-flagged failure).
13. Both wheels rest on a common implied ground line: the bottoms of the two wheels are at
    approximately the same y-coordinate (within ~5% of the viewBox height).
14. The pelican and the bicycle are visually distinguishable from each other (different
    fill/stroke treatments — e.g., light body + darker bike; not one undifferentiated silhouette
    color for everything). Typical pelican coloring (white/grey body, yellow-orange beak) is
    recommended but any palette that keeps bird and bike distinct is acceptable.
15. **Cold-viewer test:** a person shown only the rendered image should name the scene as a bird
    (ideally a pelican) riding a bicycle. Abstract shape arrangements that require the title to
    interpret are a fail.

## Notes for the builder

- Draw the whole scene yourself from vector primitives. Do not trace, embed, or fetch any
  existing artwork.
- Keep it a single flat file; a few hundred lines of hand-authored SVG is the expected scale.
- Style is free (flat, cartoon, detailed) as long as every numbered criterion holds.
