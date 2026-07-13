# Spec — Hacker News Clone (WebDev Arena canonical one-shot)

## Purpose

Build the reference implementation of the WebDev Arena canonical prompt "Create a Hacker News clone":
the classic HN front page — ranked story list with points/author/comment-count/age, the orange top bar
with nav links, a working client-side upvote, and HN's distinctive visual style — from mock data, no
backend. Every criterion below is pinned to the REAL news.ycombinator.com front page as observed on
2026-07-12 (exact colors, fonts, text formats extracted from its live HTML and news.css — citations in
`research/RESEARCH.md`). This reference is what benchmark candidates' outputs will be compared against
(blind A/B + rubric), so it must nail the details models blur: exact subtext wording, rank format,
the 85% beige column, and honest upvote state.

## Artifact contract

- Deliverable: `src/index.html` — exactly ONE file.
- Fully self-contained: no network requests of any kind (no CDN scripts, no external CSS/fonts/images —
  the logo must be inline SVG / data URI / styled markup). Opens directly via `file://` in a modern
  Chromium browser with no build step and no server.
- Mock data only: 20+ stories hardcoded in the file. No `fetch`/XHR, no backend, no service worker.
- Upvote is client-side state: clicking a story's upvote arrow increments that story's displayed
  points in the DOM.
- Must never call `alert()`, `confirm()`, `prompt()`, or open any dialog.
- No test code in the artifact.

## Acceptance criteria

Page frame:

1. Opening `src/index.html` from disk renders the full page with zero console errors and zero network
   requests; the document title is exactly `Hacker News`.
2. The content is a single centered column at 85% of the viewport width with background `#f6f6ef`
   (beige); the page area outside the column is white. Base typography everywhere is
   `Verdana, Geneva, sans-serif` at small sizes (titles ~10pt, subtext ~7pt).
3. The first row of the column is the orange top bar: background exactly `#ff6600`, spanning the full
   column width.
4. Top bar, left to right: (a) a small square logo mark (~18×18px, white "Y" styling with a 1px solid
   white border) — rendered inline, not fetched; (b) the site name **Hacker News** in bold; (c) the nav
   links in exactly this order and exact lowercase text, separated by `|` characters:
   `new | past | comments | ask | show | jobs | submit`.
5. A `login` link sits flush at the right edge of the top bar. Top-bar text is dark (black/near-black)
   on the orange, not white.

Story list:

6. At least 20 mock stories render (30 = fidelity to the real page, which shows exactly 30 plus a
   "More" link). Titles, authors, domains, points, comment counts, and ages are plausible and VARIED —
   not repeated placeholder rows (no two identical titles; points and comment counts differ across
   stories).
7. Each story row starts with its rank as the number plus a trailing period — `1.`, `2.`, `3.`, … —
   consecutive from 1 with no gaps, right-aligned in its column, in gray.
8. Between the rank and the title sits a small gray upvote triangle (▲ pointing up, on the order of
   10px), with `cursor: pointer` and a `title="upvote"` tooltip.
9. The story title is a black (#000000) link at ~10pt; for external stories the domain follows the
   title in parentheses in smaller gray text, e.g. `(example.com)`.
10. Directly under each title (indented to align with the title, NOT with the rank) is the subtext
    line in small gray (~7pt, `#828282`), in exactly this shape:
    `{points} points by {username} {age} | hide | {n} comments`
    — literal words `points`, `by`, `hide`, `comments`, with ` | ` separators. Example from the real
    page: `237 points by systima 2 hours ago | hide | 121 comments`.
11. Ages are HN-style relative strings (`2 hours ago`, `1 day ago`, `35 minutes ago`) — never absolute
    dates.
12. Subtext links (`hide`, `N comments`, username) render in the same gray as the rest of the subtext;
    story rows are separated by a small vertical gap (~5px), keeping the list visually dense.

Upvote interaction:

13. Clicking a story's upvote triangle immediately increments THAT story's displayed points by exactly
    1, client-side, with no page reload, no navigation, and no dialog. Other stories' points are
    unaffected.
14. After a story has been upvoted, its triangle disappears (real HN hides the arrow once you've
    voted); consequently a story's points can be incremented at most once. The updated points text
    keeps the correct `N points` wording.

Bottom of list / robustness:

15. Below the last story there is a `More` link (plain text "More", styled like a title link),
    matching the real page's pagination affordance. It must not navigate away or error when clicked
    (href `#`-style or reload-safe is fine).
16. No horizontal scrollbar and no layout collapse at common desktop widths (1024px and wider); the
    page never shows a blank screen and never throws an uncaught exception during load or upvoting.

## Non-goals

- No real pagination, login, submit, comments pages, hide functionality, or unvote link (the nav and
  `hide` links may be inert `#` anchors).
- No `discuss` zero-comment edge case, Ask HN domain-less rows, or job rows required (allowed if done
  faithfully; see research notes).
- No mobile/responsive breakpoints beyond criterion 16; no dark mode; no animations.
- No frameworks required or forbidden — but everything must remain inline in the single file.
