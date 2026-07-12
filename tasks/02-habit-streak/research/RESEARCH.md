# Research — 02-habit-streak (Habit-streak engine)

Stage 1 (RESEARCHER + SPEC AUTHOR) of research -> freeze -> build -> verify.
Meta-rule honored: every correctness rule below traces to an external authority or explicit
prior art; where sources disagree, the disagreement is recorded and ONE convention is picked.

NOTE ON BASE PATH: the orchestration brief passed `BASE: undefined` (a script bug — JS template
with an undefined variable). The clearly intended base is `C:/Users/iamjo/Projects/vetted-bench`
(the Vetted Bench repo, per the design-doc memory). All files were written to
`C:/Users/iamjo/Projects/vetted-bench/tasks/02-habit-streak/`.

---

## Step 1 — Second brain (grep for "habit" / "streak")

- `01_Projects/public-building/outlines/token-burn-convergence-loop.md` — the habit tracker's
  streak logic is explicitly called out as "a perfect trap (passes a naive test, breaks on
  timezone/gap edges)". Confirms this task is a good discriminating benchmark item and that
  timezone + gap edges are the known failure modes to pin down.
- No second-brain note defines streak *semantics*; everything else matching "streak" was
  unrelated (dating, CS-recall, video outlines).

## Prior art (local, READ-ONLY): `C:/Users/iamjo/Projects/habit-tracker/spec.md`

Defines: current streak = consecutive calendar days ending at `today` walking backward;
**grace for today** (today not done but yesterday done → streak alive, counted from yesterday);
neither today nor yesterday → 0; a gap breaks the streak; input may be unordered/duplicated;
"yesterday" must be real calendar math across month boundaries. Prior art only — every rule
adopted below is corroborated externally.

---

## Step 2 — External sources (8)

| # | Source | URL | What it establishes |
|---|--------|-----|---------------------|
| S1 | Loop Habit Tracker source, `StreakList.kt` (iSoron/uhabits, dev branch) | https://github.com/iSoron/uhabits/blob/dev/uhabits-core/src/commonMain/kotlin/org/isoron/uhabits/core/models/StreakList.kt (fetched raw) | A streak is a **maximal run of consecutive days**: iterating completed days newest→oldest, the run continues iff the next date is exactly one day earlier (`current == begin.minus(1)`); when adjacency breaks, the streak is closed and a new one begins. Only qualifying (completed) days enter the computation, over an explicit `from..to` window. "Today" is not special-cased: the current streak simply ends at the most recent qualifying day. |
| S2 | Duolingo Wiki — "Streak" (content obtained via search excerpt; page itself is paywalled to fetchers) | https://duolingo.fandom.com/wiki/Streak | "A streak starts at zero and increases by one for the **first lesson done each day**" (duplicates within a day don't add). "To extend your streak for a given day, you must complete a lesson **before midnight**" — i.e., a day only *breaks* the streak once it has fully elapsed; an in-progress today cannot break it. Also: the streak's day boundary is a per-account time zone — a mutable, environment-dependent concern. |
| S3 | Duolingo official blog — "The Duolingo Streak Uses Habit Research to Keep You Motivated" | https://blog.duolingo.com/how-duolingo-streak-builds-habit/ | Official definition: the streak "tracks the number of days in a row you've completed a lesson". Streak Freeze = an explicit *product* grace mechanic ("hit pause on your streak for a day"), i.e., forgiveness for a fully missed day is an opt-in inventory feature, not part of the base streak definition. |
| S4 | Deconstructor of Fun — "Duolingo Streaks: How the Mechanic Drives 2x Daily Retention" | https://duolingo.deconstructoroffun.com/mechanics/streaks | Corroborates S2: the streak increments on the **first lesson of the day**; the day has a hard deadline ("Your 84 day streak ends in 10 minutes"); freezes cover one missed day each and cap consecutive forgiven misses. |
| S5 | duoplanet — "Duolingo Streak Freeze — everything you need to know" | https://duoplanet.com/duolingo-streak-freeze/ | Freeze semantics detail: on a frozen missed day "your streak will remain exactly the same … you won't gain a day either" — grace never *adds* to a streak count. |
| S6 | Streaks (iOS) developer blog — "Now Available: Streaks 10" (Crunchy Bagel) | https://crunchybagel.com/now-available-streaks-10/ | Baseline in Streaks: missing a scheduled day resets the streak to 0. The **2-Day Rule** is an opt-in per-task setting: miss Monday → "skipped" (streak not reset), but you must complete Tuesday, "otherwise it is marked as 'missed' and your streak resets to 0". So one-full-missed-day forgiveness is again an explicit opt-in, not the default. |
| S7 | MDN — `Date` reference (JavaScript) | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date | The canonical pitfall: **date-only strings ("2024-03-01") are parsed as UTC midnight** ("a historical spec error … not consistent with ISO 8601"), so `new Date("YYYY-MM-DD")` read back in local time shifts the calendar date by ±1 day in non-UTC zones. This is why the engine must do pure calendar-date arithmetic on the strings/fields, never round-trip through timezone-bearing `Date` values. |
| S8 | Howard Hinnant — "chrono-Compatible Low-Level Date Algorithms" (`days_from_civil` / `civil_from_days`) | https://howardhinnant.github.io/date_algorithms.html | The robust technique: convert y/m/d to a **serial day number** (proleptic Gregorian); "consecutive days" and "yesterday" become integer arithmetic. Leap years and month lengths are handled by the algorithm itself (era/400-year math, `365*yoe + yoe/4 - yoe/100`), so month ends, year ends, and Feb 29 need no special cases. |
| S9 | RFC 3339 — "Date and Time on the Internet: Timestamps", §5.6/§5.7 | https://datatracker.ietf.org/doc/html/rfc3339 | The `full-date` format `date-fullyear "-" date-month "-" date-mday` (4DIGIT-2DIGIT-2DIGIT); `date-mday` maximums vary by month/year — February 28, or **29 in leap years** (leap-year determination per Appendix C: divisible by 4, except centuries unless divisible by 400). Basis for input validation. |

(S2 could not be fetched directly — HTTP 402 to automated fetchers; its content was captured via
search-result excerpts and is corroborated independently by S4. 8 distinct organizations/authors.)

---

## Adopted correctness rules (each with its citation)

- **R1 — Date representation & validation.** Dates are RFC 3339 `full-date` strings
  `YYYY-MM-DD` (S9 ABNF). Any element of `dates` (or `today`) that is not a string in exactly
  that shape, or that names an impossible calendar date (month 00/13, day 00/32,
  `2023-02-29`, `2100-02-29`), is invalid → the function throws. Day-of-month limits and the
  leap-year rule are per S9 §5.7 + Appendix C (div-by-4, except centuries unless div-by-400).
- **R2 — Pure calendar arithmetic, no timezone.** Never derive semantics from parsing the
  strings with `new Date(...)`: date-only strings parse as UTC and shift a calendar day in
  non-UTC zones (S7). Adjacency is defined on **serial day numbers** in the proleptic
  Gregorian calendar (S8): dates `a`, `b` are consecutive iff `dayNumber(b) − dayNumber(a) === 1`.
  This makes month ends (2026-06-30→2026-07-01), year ends (2025-12-31→2026-01-01) and Feb 29
  fall out of the same rule with no special cases (S8).
- **R3 — Duplicates collapse.** Multiple completions on the same calendar day count as ONE
  completed day — Duolingo increments "for the first lesson done each day" only (S2, S4).
- **R4 — Streak = maximal consecutive-day run.** A streak is a maximal run of distinct
  completed days where each successive day is exactly one day after the previous (S1, Loop's
  `StreakList` adjacency test; S3, "days in a row").
- **R5 — Current streak with grace-for-today.** The current streak is the run ending at
  `today` if today is completed; otherwise the run ending at `today − 1` if yesterday is
  completed (today is still in progress — a day only breaks the streak once it has fully
  elapsed at midnight, S2/S4; Loop likewise never resets the displayed streak mid-day, S1);
  otherwise **0**. Grace never adds a day to the count (freeze semantics: "you won't gain a
  day either", S5) — with today incomplete, the current streak equals the length of the run
  ending yesterday.
- **R6 — Longest streak.** The maximum length over ALL maximal runs among the deduplicated,
  non-future completion days (Loop computes and displays "best streaks" the same way — the
  streak list is the source for both, S1). Grace contributes nothing (R5), so
  `longest >= current` always.
- **R7 — Future dates ignored.** Completion dates strictly after `today` are validated
  (R1) but **excluded** from both computations. Rationale + prior art: streaks are an
  "as-of-today" measure and Loop computes its streak list over an explicit window ending at
  the most recent relevant day (`recompute(from, to)`, S1); no surveyed tracker counts
  future check-ins. (This is the one rule where authorities are silent — the convention is
  declared explicitly rather than corroborated verbatim.)
- **R8 — Empty/degenerate input.** No dates (or all future) → `{current: 0, longest: 0}`
  (Duolingo: "a streak starts at zero", S2).

## Disagreements found → conventions picked

1. **Is one fully missed day forgiven?** Streaks' 2-Day Rule forgives one missed day
   (opt-in, S6); Duolingo freezes forgive missed days (consumable inventory, S3/S5); Loop's
   *score* decays instead of resetting (but its *streak list* is strict, S1).
   **Picked: STRICT** — any fully elapsed day with no completion breaks the streak; the only
   grace is for the still-in-progress `today` (R5). Justification: in every surveyed product
   the base streak definition is strict and forgiveness is an explicit opt-in feature
   (S3, S6); the base engine models the base definition.
2. **Day boundary / timezone.** Duolingo anchors the day boundary to a per-account time zone
   (S2) — an application concern that made their engineering harder, not simpler.
   **Picked: the engine has NO clock and NO timezone** — it receives `today` as a calendar
   date and does pure date arithmetic (S7 documents why letting `Date`/timezones in corrupts
   day identity). Deciding what "today" is belongs to the caller.
3. **Habit "strength" (Loop's headline metric) vs streaks.** Loop's advanced exponential
   score is a different metric; its streak list (S1) is the comparable feature.
   **Picked: streak-list semantics**; strength/score is out of scope.
