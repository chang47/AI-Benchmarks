# Holdout Rubric — Task 13 "Hacker News clone"

Answer key for grading a candidate's `src/index.html` against `spec.md`'s 16 acceptance criteria.
Authored independently of the builder; the builder never sees this folder.

**Weights: equal — 1 point per item, 16 points total.** Research (research/RESEARCH.md) gave no
reason to weight otherwise; its contamination note says to score the *pinned observable details*
(exact subtext wording, 85%/#f6f6ef frame, rank periods, arrow-hides-after-vote), which is exactly
what these items are. Score each item PASS (1) or FAIL (0); no partial credit. For items with both
an automated and a SCREENSHOT part, BOTH must pass.

## How to check

The spec defines no `window.__*` test hook, so all programmatic checks are DOM/computed-style/
console/network based, run by `autochecks.mjs`:

```
cd holdout
npm install                          # installs playwright (devDependency)
node autochecks.mjs ../src/index.html
```

It prints one JSON document. `results[].item` maps 1:1 to the item numbers below; `summary` gives
pass/fail totals; `screenshot` is the path of a full-page screenshot saved to the OS temp dir for
the SCREENSHOT judgments. Exit code 0 = all automated checks pass, 1 = failures, 2 = harness error.
The browser is Chrome (`channel:'chrome'`), falling back to Playwright's bundled Chromium
(auto-installing it via `npx playwright install chromium` if needed). The page is loaded via
`file://` — never a server, matching the spec's artifact contract.

**Contract preamble (gate, not a scored item):** the deliverable must be exactly one file,
`src/index.html`. If it is missing, autochecks exits 2 and the submission scores 0. Extra files
under `src/`, or any test code inside the artifact, are contract violations the grader should note
(network-freeness, no-dialogs, and no-reload behavior are covered by items 1, 13, 15 below).

## Items

1. **Loads clean.** Zero console errors, zero http(s)/ws network requests during load, and
   `document.title === "Hacker News"` (exact).
   *HOW:* programmatic — Playwright `console`/`request`/`pageerror` listeners + `page.title()`.
   `file://` subresource requests are recorded as warnings (a self-contained file should have
   none; a missing local file also surfaces as a console error and fails this item).

2. **Page frame.** A single centered column at ~85% viewport width (accepted 80–90%, centered
   within ±30px) with background exactly `rgb(246,246,239)` (`#f6f6ef`); page outside the column
   white (or default/transparent); base typography Verdana (computed `font-family` of title and
   subtext contains "Verdana"). Title/subtext point sizes are scored in items 9/10.
   *HOW:* programmatic — largest element whose computed background is exactly `#f6f6ef`; geometry
   vs `window.innerWidth`; computed `background-color` of `<html>`/`<body>`.

3. **Orange top bar.** An element with computed background exactly `rgb(255,102,0)` (`#ff6600`),
   sitting at the top of the column (within 30px) and spanning it (width ≥ 90% of column width,
   horizontally inside it).
   *HOW:* programmatic — topmost sufficiently-wide `#ff6600` element vs the column's box.

4. **Top bar contents.** Left to right: a small square logo mark (~18×18, accepted 12–28px square)
   with a ~1px white border; **Hacker News** in bold (font-weight ≥ 600); nav links in exactly
   this lowercase order separated by `|`: `new | past | comments | ask | show | jobs | submit`.
   *HOW:* programmatic — normalized top-bar text matched against the exact nav regex and
   "Hacker News"; deepest "Hacker News" element's computed font-weight; leftmost small-square
   descendant's box + computed border. SCREENSHOT: confirm the logo reads as a white-"Y"-style
   mark (glyph appearance can't be asserted from styles; if the logo is an `<svg>`/`<img>` whose
   border is drawn inside the graphic, the border sub-check also defers to the screenshot —
   autochecks flags this with `manualReview: true`).

5. **Login right, dark text.** A `login` link whose right edge is flush with the bar's right edge
   (within 40px); top-bar text color dark (avg channel ≤ 150, not white).
   *HOW:* programmatic — deepest element with text `login` inside the bar; computed `color` of a
   nav link and of `login`.

6. **20+ varied stories.** ≥ 20 story rows; no two identical titles; points and comment counts
   varied (≥ 80% distinct values each — tolerance for the "differ across stories" wording so a
   single accidental collision in otherwise-varied mock data does not fail); ≥ 3 distinct authors
   and ≥ 3 distinct age strings. Plausibility of titles/domains is a SCREENSHOT sanity glance.
   *HOW:* programmatic — counts and Set-cardinalities extracted from rank/title/subtext parses.

7. **Rank format.** Each rank renders as `N.` (number + trailing period), consecutive from 1 with
   no gaps; right-aligned in its column (computed `text-align: right` on the rank or its parent,
   OR geometric: single- and double-digit ranks share a right edge, not a left edge); gray
   (near-equal RGB channels, mid luminance).
   *HOW:* programmatic — deepest elements matching `/^\d{1,3}\.$/`, sequence check, computed
   styles, bounding boxes of ranks 9 vs 10.

8. **Upvote triangle.** One control per story with attribute `title="upvote"` (exact), box ~10px
   (accepted 5–22px), effective `cursor: pointer` (own computed style or via enclosing link),
   positioned between the rank and the title. Gray color is asserted when detectable (text `▲` →
   `color`; CSS border-triangle → `border-bottom-color`; else background); if the triangle is an
   SVG/image whose fill can't be read from computed style, gray-ness defers to SCREENSHOT
   (`manualReview: true`).
   *HOW:* programmatic — `querySelectorAll('[title="upvote"]')`, boxes, computed styles.

9. **Title link + domain.** Story titles are black links (computed color within #191919 of
   `#000000`) at ~10pt (12–15px computed); external stories show `(domain.tld)` after the title —
   ≥ 10 parenthesized domains on the page — in smaller (≤ title − 0.5px) gray text.
   *HOW:* programmatic — first story's title anchor (leftmost anchor on the rank's line, right of
   the rank); deepest elements whose text is exactly `(domain.tld)`; body-text regex count.

10. **Subtext line.** Directly under each title, matching EXACTLY
    `{points} points by {username} {age} | hide | {n} comments`
    (literal `points`/`by`/`hide`/`comments`, `|` separators; singular `point`/`comment`
    accepted); ≥ 20 such lines; ~7pt (8–11.5px computed); gray pinned near `#828282`
    (avg channel 110–150, spread ≤ 20); indented to align with the TITLE (within 25px), not the
    rank (≥ 8px right of the rank's left edge), and rendered below the title.
    *HOW:* programmatic — deepest elements matching the normalized subtext regex; computed
    font-size/color; bounding boxes vs title/rank of story 1.

11. **Relative ages.** Every subtext age is an HN-style relative string —
    `\d+ (minute|hour|day|month|year)s? ago` — never an absolute date. (An absolute date would
    also fail item 10's format match; this item validates the age token itself.)
    *HOW:* programmatic — regex over the captured age group of every subtext line.

12. **Subtext links + density.** Links inside the subtext (`hide`, `N comments`, username) render
    in the same gray as the subtext (each channel within ±30, and gray); the list is dense —
    median vertical pitch between consecutive rank tops 20–70px (the real page's ~5px spacer +
    two 10pt/7pt lines lands well inside this). SCREENSHOT: confirm the ~5px gap look (rows
    visually dense, clearly separated). If the subtext contains no anchors at all, color parity
    is vacuous — autochecks flags `manualReview: true` and the grader judges fidelity from the
    screenshot (real HN renders these as links).
    *HOW:* programmatic — computed color of first anchor inside a subtext element vs the
    subtext's own color; rank-top pitch statistics.

13. **Upvote works, scoped.** Clicking story 1's upvote triangle increments story 1's displayed
    points by exactly 1 (`N points` still parses), leaves every other story's points unchanged,
    with no page reload (a pre-click `window` marker must survive), no navigation, and no
    dialog (`alert`/`confirm`/`prompt` auto-fail).
    *HOW:* programmatic — parse all subtext points → click the topmost `[title="upvote"]` →
    re-parse and diff (index-based, with a (user,comments)-keyed fallback); marker + dialog +
    URL listeners. Post-vote parsing tolerates an inserted `unvote |` segment (spec non-goal,
    allowed if faithful).

14. **Arrow disappears; single increment.** After voting, that story's arrow is no longer visible
    (hidden or removed — visible-arrow count drops by exactly 1), so points can rise at most
    once: a second click attempt (only possible if the arrow is somehow still visible) must not
    change the points again; all subtext lines still parse with correct `N points` wording.
    *HOW:* programmatic — visibility scan of `[title="upvote"]` before/after; guarded second
    click; re-parse.

15. **More link.** Below the last story there is a link with exact text `More`, styled like a
    title link (black, ~10pt / 11–15px); clicking it neither navigates away (same `file://` URL
    modulo `#`, or a clean reload of it) nor throws/opens dialogs, and the page still renders.
    *HOW:* programmatic — deepest bottom-most element with text `More`, box below the last
    subtext; click; compare `page.url()`, error/dialog counters, body text length.

16. **Robust at desktop widths.** At 1024px and 1440px: no horizontal scrollbar
    (`scrollWidth ≤ clientWidth + 1`), page not blank (body text > 200 chars); zero uncaught
    exceptions during the whole load + upvote + More interaction session.
    *HOW:* programmatic — fresh loads at both viewports; `pageerror` listener across all phases.

## Scoring notes

- Automated verdicts are authoritative for their asserted sub-checks; `manualReview: true` items
  (typically 4, 8, and 12) additionally need a human look at the saved screenshot before final
  PASS.
- Tolerances above are frozen; do not widen them per-candidate. They were chosen so the REAL
  news.ycombinator.com values (85%, #f6f6ef, #ff6600, #828282, #000000, 10pt/7pt/8pt, 18×18 logo,
  10px arrow, 5px spacer, 30 ranks) pass with margin, per research/RESEARCH.md.
- Final score = passed items / 16.
