# Spec — Habit-streak engine (`02-habit-streak`)

## Purpose

A pure date-logic engine for a habit tracker: given the calendar days on which a habit was
completed and a reference "today", compute the **current streak** and the **longest streak**
of consecutive completed days. The semantics follow how mainstream habit trackers
(Loop Habit Tracker, Duolingo, Streaks) define streaks: strict consecutive calendar days,
with the single exception that a not-yet-completed *today* does not break a live streak.

## Artifact contract

Create exactly one source file: **`src/streaks.mjs`** (an ES module), exporting:

```js
export function computeStreaks(dates, today)
```

- `dates` — an array of calendar-date strings in exactly the form `"YYYY-MM-DD"`
  (4-digit year, 2-digit month, 2-digit day, hyphen-separated; e.g. `"2026-07-04"`).
  The array may be **unordered**, may contain **duplicates**, and may contain dates
  **after `today`** (handling defined below).
- `today` — a single `"YYYY-MM-DD"` string: the reference day the streaks are measured at.
- Returns a plain object `{ current: <integer>, longest: <integer> }`, both `>= 0`.
- **Pure function**: no I/O, no reading the system clock (`Date.now`, `new Date()` with no
  args), no timezone dependence of any kind, no randomness, and it must **not mutate the
  `dates` array** it was given. Same inputs → same output, on any machine in any timezone.
- No dependencies beyond the JavaScript standard library. Do not shell out, import
  third-party packages, or read files.

## Definitions

- All arithmetic is **pure calendar-date arithmetic** in the (proleptic) Gregorian calendar.
  Day `B` is "the day after" day `A` iff `B` is exactly one calendar day later than `A` —
  including across month ends, year ends, and leap days. Do **not** derive day identity by
  parsing the strings with `new Date("YYYY-MM-DD")` and reading local-time fields: JavaScript
  parses date-only strings as UTC, which shifts the calendar date in non-UTC timezones.
  Work with the year/month/day fields directly (e.g., convert each date to a serial day
  number and compare integers).
- A **completed day** is a calendar day that appears at least once in `dates` (after
  removing duplicates) and is **not after `today`**.
- A **run** is a maximal set of completed days forming an unbroken consecutive-day sequence.
- **Longest streak** = the length of the longest run (0 if there are no completed days).
- **Current streak**:
  - If `today` is a completed day → the length of the run that ends at `today`.
  - Else if the day before `today` is a completed day → the length of the run that ends at
    that day ("grace for today": today is still in progress, so an incomplete today does not
    break the streak — but it adds nothing to the count either).
  - Else → `0`.

## Input validation

- Every element of `dates`, and `today`, must be a string matching exactly
  `YYYY-MM-DD` (regex shape `^\d{4}-\d{2}-\d{2}$`) AND name a real calendar date:
  month `01`–`12`; day `01` up to that month's length in that year; February has 29 days in
  leap years, 28 otherwise. Leap year = divisible by 4, EXCEPT century years, which are leap
  only if divisible by 400 (so 2024 and 2000 are leap; 2023, 1900, and 2100 are not).
- On the first invalid value encountered (wrong type, wrong shape — e.g. `"2026-7-4"`,
  `"07-04-2026"` — or an impossible date — e.g. `"2023-02-29"`, `"2026-13-01"`,
  `"2026-04-31"`), **throw an `Error`** (any `Error` subclass is acceptable) whose message
  contains the offending value. Validation applies to every element, including dates after
  `today` (they are validated, then ignored).

## Acceptance criteria

Happy paths:

1. `computeStreaks([], "2026-07-12")` → `{ current: 0, longest: 0 }`.
2. Only today completed: `computeStreaks(["2026-07-12"], "2026-07-12")` → `{ current: 1, longest: 1 }`.
3. A run ending at today counts it in full:
   `computeStreaks(["2026-07-10", "2026-07-11", "2026-07-12"], "2026-07-12")` → `{ current: 3, longest: 3 }`.
4. Unordered input gives the same answer as sorted input:
   `computeStreaks(["2026-07-12", "2026-07-10", "2026-07-11"], "2026-07-12")` → `{ current: 3, longest: 3 }`.
5. Duplicates collapse to one completed day:
   `computeStreaks(["2026-07-12", "2026-07-12", "2026-07-11"], "2026-07-12")` → `{ current: 2, longest: 2 }`.

Grace for today:

6. Yesterday completed, today not yet: `computeStreaks(["2026-07-11"], "2026-07-12")`
   → `{ current: 1, longest: 1 }` (the streak is alive but today adds nothing).
7. Run ending yesterday, today not yet:
   `computeStreaks(["2026-07-09", "2026-07-10", "2026-07-11"], "2026-07-12")` → `{ current: 3, longest: 3 }`.
8. Grace reaches back exactly one day and no further — most recent completion two days ago:
   `computeStreaks(["2026-07-10"], "2026-07-12")` → `{ current: 0, longest: 1 }`.
9. Grace never chains across a gap: `computeStreaks(["2026-07-11", "2026-07-09"], "2026-07-12")`
   → `{ current: 1, longest: 1 }` (the run ending yesterday has length 1; 07-09 is a separate run).

Gaps, current vs longest:

10. A missing (fully elapsed) day breaks a streak:
    `computeStreaks(["2026-07-08", "2026-07-09", "2026-07-11", "2026-07-12"], "2026-07-12")`
    → `{ current: 2, longest: 2 }`.
11. Longest may exceed current:
    `computeStreaks(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-07-11", "2026-07-12"], "2026-07-12")`
    → `{ current: 2, longest: 5 }`.
12. Longest counts a purely historical run even when current is 0:
    `computeStreaks(["2026-05-01", "2026-05-02", "2026-05-03"], "2026-07-12")` → `{ current: 0, longest: 3 }`.
13. For every valid input, `longest >= current`.

Month, year, and leap boundaries (consecutiveness is real calendar math, never string math):

14. Month end: `computeStreaks(["2026-06-30", "2026-07-01"], "2026-07-01")` → `{ current: 2, longest: 2 }`.
15. 31-day month end: `computeStreaks(["2026-01-31", "2026-02-01"], "2026-02-01")` → `{ current: 2, longest: 2 }`.
16. Year end: `computeStreaks(["2025-12-31", "2026-01-01"], "2026-01-01")` → `{ current: 2, longest: 2 }`.
17. Leap year: `computeStreaks(["2024-02-28", "2024-02-29", "2024-03-01"], "2024-03-01")`
    → `{ current: 3, longest: 3 }`.
18. Non-leap year: `computeStreaks(["2023-02-28", "2023-03-01"], "2023-03-01")`
    → `{ current: 2, longest: 2 }` (Feb 28 → Mar 1 are consecutive in 2023).
19. Century rule: `computeStreaks(["2000-02-28", "2000-02-29", "2000-03-01"], "2000-03-01")`
    → `{ current: 3, longest: 3 }` (2000 IS a leap year), while `"2100-02-29"` anywhere in the
    input throws (2100 is NOT a leap year).
20. Not consecutive across a month: `computeStreaks(["2026-06-30", "2026-07-02"], "2026-07-02")`
    → `{ current: 1, longest: 1 }`.

Future dates:

21. Dates strictly after `today` are ignored in both metrics:
    `computeStreaks(["2026-07-12", "2026-07-13"], "2026-07-12")` → `{ current: 1, longest: 1 }`;
    `computeStreaks(["2026-08-01"], "2026-07-12")` → `{ current: 0, longest: 0 }`.
22. A future run never inflates `longest`:
    `computeStreaks(["2026-07-13", "2026-07-14", "2026-07-15"], "2026-07-12")` → `{ current: 0, longest: 0 }`.

Validation:

23. Malformed strings throw an `Error` whose message contains the offending value:
    `"2026-7-4"`, `"07-04-2026"`, `"2026/07/04"`, `""`, and non-string elements (e.g. `null`,
    `20260704`) all throw.
24. Impossible dates throw the same way: `"2023-02-29"`, `"2026-13-01"`, `"2026-00-10"`,
    `"2026-04-31"`, `"2026-07-00"`.
25. An invalid `today` throws under the same rules.
26. Validation runs even for elements that would be ignored:
    `computeStreaks(["2026-07-12", "2027-02-29"], "2026-07-12")` throws (2027 is not a leap year).

Purity:

27. The input array is not mutated: after calling `computeStreaks(d, t)`, `d` has the same
    elements in the same order as before the call.
28. The result is identical regardless of the machine's timezone (e.g., under `TZ=Pacific/Kiritimati`
    and `TZ=America/Los_Angeles` the same inputs give the same outputs). The implementation
    must not consult the system clock or local timezone at all.

## Out of scope

Streak freezes / "2-day rules" / skip days (grace beyond today), weekly or every-N-days habit
schedules, habit "strength" scores, timezone or clock handling, persistence, and any UI.
