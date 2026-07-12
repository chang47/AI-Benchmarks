# Frozen prompt — 02-habit-streak

The exact one-shot prompt a raw model receives for this task in a benchmark run.
Everything between the markers is the prompt, verbatim.

---PROMPT START---

Implement a habit-streak engine in plain modern JavaScript.

Create exactly one file, `src/streaks.mjs`, an ES module exporting:

```js
export function computeStreaks(dates, today)
```

INPUTS
- `dates`: an array of calendar-date strings, each exactly `"YYYY-MM-DD"` (e.g. "2026-07-04").
  The array may be unordered, may contain duplicates, and may contain dates after `today`.
- `today`: one `"YYYY-MM-DD"` string — the reference day the streaks are measured at.

OUTPUT
- Return `{ current: <integer>, longest: <integer> }`, both `>= 0`.

SEMANTICS (follow these exactly)
1. All logic is pure calendar-date arithmetic in the Gregorian calendar. Day B is "the day
   after" day A iff B is exactly one calendar day later — including across month ends
   (2026-06-30 -> 2026-07-01), year ends (2025-12-31 -> 2026-01-01), and leap days
   (2024-02-28 -> 2024-02-29 -> 2024-03-01; in non-leap 2023, 2023-02-28 -> 2023-03-01).
   Leap year = divisible by 4, except century years, which are leap only if divisible by 400
   (2000 and 2024 are leap; 1900, 2023, 2100 are not).
   Do NOT determine day identity by parsing the strings with `new Date("YYYY-MM-DD")` and
   reading local-time fields — JavaScript parses date-only strings as UTC, which shifts the
   calendar date in non-UTC timezones. Work with the year/month/day fields directly (e.g.,
   convert each date to a serial day number and compare integers).
2. A "completed day" is a day that appears at least once in `dates` (duplicates collapse to
   one) and is not after `today`. Dates strictly after `today` are ignored (but still
   validated — see 6).
3. A "run" is a maximal set of completed days forming an unbroken consecutive-day sequence.
4. `longest` = the length of the longest run (0 if there are no completed days). Runs
   entirely in the past count.
5. `current`:
   - if `today` is a completed day: the length of the run ending at `today`;
   - else if the day before `today` is a completed day: the length of the run ending at that
     day (grace: today is still in progress, so an incomplete today does not break the
     streak — and it adds nothing to the count);
   - else 0.
   The grace reaches back exactly one day, never further, and never bridges a gap.
   Consequence: `longest >= current` always.
6. Validation: every element of `dates`, and `today`, must be a string of exactly the shape
   `YYYY-MM-DD` AND name a real calendar date (month 01-12; day within that month's length
   for that year; February has 29 days only in leap years). On the first invalid value
   (wrong type, wrong shape like "2026-7-4" or "07-04-2026", or an impossible date like
   "2023-02-29", "2026-13-01", "2026-04-31"), throw an `Error` whose message contains the
   offending value. Validate even dates that would be ignored for being after `today`.
7. Purity: no I/O, no system clock (`Date.now()` / `new Date()` with no args), no timezone
   dependence, no randomness, no third-party imports, and do not mutate the `dates` array.
   Same inputs must give the same output on any machine in any timezone.

WORKED EXAMPLES
- `computeStreaks([], "2026-07-12")` -> `{ current: 0, longest: 0 }`
- `computeStreaks(["2026-07-12"], "2026-07-12")` -> `{ current: 1, longest: 1 }`
- `computeStreaks(["2026-07-12", "2026-07-10", "2026-07-11"], "2026-07-12")` -> `{ current: 3, longest: 3 }`
- `computeStreaks(["2026-07-09", "2026-07-10", "2026-07-11"], "2026-07-12")` -> `{ current: 3, longest: 3 }` (grace)
- `computeStreaks(["2026-07-10"], "2026-07-12")` -> `{ current: 0, longest: 1 }` (grace is one day only)
- `computeStreaks(["2026-06-01","2026-06-02","2026-06-03","2026-06-04","2026-06-05","2026-07-11","2026-07-12"], "2026-07-12")` -> `{ current: 2, longest: 5 }`
- `computeStreaks(["2026-07-12", "2026-07-13"], "2026-07-12")` -> `{ current: 1, longest: 1 }` (future ignored)
- `computeStreaks(["2026-07-12", "2027-02-29"], "2026-07-12")` -> throws (2027 is not a leap year)

Write only the implementation file `src/streaks.mjs`. No tests, no README, no other files.

---PROMPT END---
