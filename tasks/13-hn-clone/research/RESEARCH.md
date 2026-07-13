# Research — 13-hn-clone (Hacker News clone, WebDev Arena canonical)

Stage-1 research log. Every adopted rule/number below carries its citation. Fetch date for all live
sources: **2026-07-12**.

## Sources (authorities)

| # | Source | Role |
|---|--------|------|
| S1 | https://arena.ai/blog/webdev-arena/ | Canonical prompt wording + popularity evidence |
| S2 | https://news.ycombinator.com/ (live front-page HTML) | Ground-truth layout, colors, exact text formats |
| S3 | https://news.ycombinator.com/news.css (live stylesheet) | Ground-truth fonts, sizes, colors |
| S4 | https://news.ycombinator.com/newest (live HTML) | Zero-comment "discuss" edge case |

## Prompt provenance (S1)

- The WebDev Arena blog post uses **"Create a Hacker News clone"** verbatim as its worked example
  prompt.
- The same post's most-asked-prompts table lists **`Clone of Hacker News`** at **rank #4 with 2,740
  votes** (behind "Clone of VS Code / Cursor" 4,189, "Make me a clone of WhatsApp Chat App" 3,385,
  "Build a game of chess" 3,154).
- **Disagreement + convention picked:** two canonical wordings exist (narrative example vs.
  leaderboard entry). We freeze the narrative wording "Create a Hacker News clone" — it is the form
  the arena's own authors chose to present as the exemplar, and it matches this task's assigned
  scope title. The leaderboard variant is recorded here for provenance.
- **Adaptation note (frozen-prompt.md):** the arena sandbox implicitly renders every answer as a
  standalone web app; a raw one-shot model has no such harness, so the frozen prompt appends one
  delivery sentence ("Return it as one single self-contained HTML file, using mock data (no
  backend).") marked `[ADAPTED]`. This mirrors the adaptation pattern used in task 04
  (Python/tkinter → single HTML file).

## Ground-truth reference: news.ycombinator.com front page (S2, raw HTML)

All values read directly from the live HTML source (`Invoke-WebRequest`, 2026-07-12), not from
memory.

### Page frame
- Whole page wrapped in `<center><table id="hnmain" ... width="85%" bgcolor="#f6f6ef">` →
  **centered column, 85% width, beige `#f6f6ef`** (spec criterion 2). Only two bgcolor values exist
  in the entire page: `#f6f6ef` and `#ff6600` (verified by regex over the full HTML).
- `<title>Hacker News</title>` (criterion 1).

### Top bar
- First row: `<td bgcolor="#ff6600">` → **orange `#ff6600`** (criterion 3).
- Logo: `<img src="y18.svg" width="18" height="18" style="border:1px white solid; display:block">`
  → **18×18, 1px solid white border** (criterion 4a).
- Site name: `<b class="hnname"><a href="news">Hacker News</a></b>` → **bold** (criterion 4b).
- Nav, verbatim from source (criterion 4c):
  `<a href="newest">new</a> | <a href="front">past</a> | <a href="newcomments">comments</a> | <a href="ask">ask</a> | <a href="show">show</a> | <a href="jobs">jobs</a> | <a href="submit">submit</a>`
- Right cell: `<span class="pagetop"><a href="login?goto=news">login</a></span>` with
  `text-align:right` (criterion 5).

### Story rows (first row quoted verbatim)
- Rank: `<span class="rank">1.</span>` in a right-aligned (`align="right"`) cell → **number +
  trailing period** (criterion 7). Exactly **30** `class="rank"` spans on the page → 30 stories per
  page (criterion 6's fidelity note).
- Vote control: `<div class='votearrow' title='upvote'></div>` inside a vote anchor (criterion 8).
- Title + domain: `<a href="...">Claude Code sends 33k tokens...</a><span class="sitebit comhead"> (<a ...><span class="sitestr">systima.ai</span></a>)</span>`
  → **domain in parentheses right after the title** (criterion 9).
- Subtext, verbatim: `237 points by systima 2 hours ago | hide | 121 comments`
  (real markup uses `121&nbsp;comments`) → **exact wording/order for criterion 10's format string**.
  Age element is a relative string (`2 hours ago`) linking to the item (criterion 11).
- Row separation: `<tr class="spacer" style="height:5px">` between stories → **~5px gap**
  (criterion 12).
- Pagination: `<a href='?p=2' class='morelink' rel='next'>More</a>` after story 30 (criterion 15).
- Footer (below More): a 1px-ish orange rule (`<td bgcolor="#ff6600">` in a `cellpadding="1"`
  table), then links `Guidelines | FAQ | Lists | API | Security | Legal | Apply to YC | Contact` and
  a `Search:` box. **Convention picked:** footer + search are OUTSIDE the assigned scope ("front
  page — ranked list, top bar, upvote, visual style") → not an acceptance criterion; a faithful
  footer is allowed, not required (spec non-goals).

### Vote behavior
- Real HN hides the arrow after you vote (the anchor gets a hidden/`nosee` state and an `unvote`
  link appears in the subtext). Adopted as criterion 14 in the simplified client-side form: arrow
  disappears after voting → at most one increment per story. The `unvote` link is a non-goal (the
  scope's contract is "upvote click increments the displayed points (client-side state)").

## Ground-truth reference: news.css (S3, raw CSS quoted)

- `body { font-family:Verdana, Geneva, sans-serif; font-size:10pt; color:#828282; }` →
  **Verdana stack** everywhere (criterion 2).
- `.title { font-family:Verdana, Geneva, sans-serif; font-size: 10pt; ... }` → titles **10pt**
  (criteria 2, 9).
- `a:link { color:#000000; text-decoration:none; }` → title links **black, no underline**
  (criterion 9).
- `.subtext { font-family:Verdana, Geneva, sans-serif; font-size: 7pt; color:#828282; }` and
  `.subtext a:link, .subtext a:visited { color:#828282; }` → subtext **7pt gray #828282, links same
  gray** (criteria 10, 12).
- `.comhead { ... font-size: 8pt; color:#828282; }` → the `(domain)` bit is smaller + gray
  (criterion 9).
- `.votearrow { width:10px; height:10px; ... background: url("triangle.svg") ... }` → **~10px gray
  triangle** (criterion 8). Since the artifact is self-contained, any inline rendering (CSS border
  triangle, inline SVG, `▲`) at that scale is acceptable.
- `.pagetop { ... color:#222222; ... }` → top-bar text **dark on orange, not white** (criterion 5).
- **Disagreement + convention picked:** news.css contains `@media` mobile overrides
  (`.title { font-size: 11pt; }`, `.subtext { font-size: 9pt; }`). We pin the DESKTOP base values
  (10pt/7pt) and mark them "~" in the spec; graders compare at desktop width (criterion 16 pins
  1024px+).

## Zero-comment edge case (S4)

- On https://news.ycombinator.com/newest, stories with no comments show
  `<a href="item?id=...">discuss</a>` in place of `N comments` (22 instances observed on
  2026-07-12). **Convention picked:** mock data may simply give every story ≥1 comment, so
  `discuss` is a non-goal (allowed if faithful) — keeps the criterion count in budget and the
  format string in criterion 10 unconditional.

## Difficulty & contamination assessment

- **Difficulty: easy.** Single static page, no algorithms, no physics, no state beyond a per-story
  vote flag; the target design is world-famous. The bar is FIDELITY (exact formats above), which is
  what separates candidates.
- **Contamination: high.** HN clones are a ubiquitous tutorial/training exercise, the site's design
  is heavily represented in crawls, and the exact arena prompt is public with thousands of votes.
  Scoring must therefore weight the pinned observable details (exact subtext wording, 85%/#f6f6ef
  frame, rank periods, arrow-hides-after-vote) rather than generic resemblance.

## What was NOT invented by this agent

Every number and string in spec.md traces to S1–S4 above: `#ff6600`, `#f6f6ef`, `85%`, `#828282`,
`#000000`, `#222222`, `10pt/7pt/8pt`, `18×18 + 1px white border`, `10px` arrow, `5px` spacer, 30
stories/page, nav order `new|past|comments|ask|show|jobs|submit`, subtext format
`N points by user AGE | hide | M comments`, `More`, `discuss`, `title="upvote"`, and the frozen
prompt wording. The only agent-chosen conventions are the four flagged "convention picked" items
(prompt variant, footer out of scope, desktop CSS values, discuss non-goal) and the 20-story
minimum, which comes from the task's assigned artifact contract (real page = 30, noted in
criterion 6).
