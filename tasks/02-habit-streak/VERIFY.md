# Verification — 02-habit-streak

## Round 0

Independent verifier suite: `verify/tests/streaks.test.mjs` (39 tests) + `verify/tests/tz-runner.mjs`
(subprocess runner for the timezone criterion). Builder tests in `src/tests/` were NOT read.
Run: `npx vitest run` from `verify/` — **39 passed, 0 failed** (vitest 3.2.7).

### Per-criterion results

| Criterion | Result | Evidence |
|---|---|---|
| C1 empty input | PASS | `([], "2026-07-12")` → `{0,0}` |
| C2 only today | PASS | `(["2026-07-12"], ...)` → `{1,1}` |
| C3 run ending today | PASS | 3-day run → `{3,3}` |
| C4 unordered = sorted | PASS | shuffled input equals sorted result `{3,3}` |
| C5 duplicates collapse | PASS | dup of today → `{2,2}` |
| C6 grace, yesterday only | PASS | `(["2026-07-11"], "2026-07-12")` → `{1,1}` |
| C7 grace, run ending yesterday | PASS | 3-day run ending yesterday → `{3,3}` |
| C8 grace reaches back exactly one day | PASS | completion 2 days ago → `{0,1}` |
| C9 grace never chains across a gap | PASS | `["07-11","07-09"]` → `{1,1}` |
| C10 elapsed gap breaks streak | PASS | gap at 07-10 → `{2,2}` |
| C11 longest > current | PASS | 5-day June run vs 2-day current → `{2,5}` |
| C12 historical run only | PASS | May run, July today → `{0,3}` |
| C13 longest >= current invariant | PASS | 10-case battery, integers >= 0, invariant holds |
| C14 month end 06-30→07-01 | PASS | `{2,2}` |
| C15 31-day month end 01-31→02-01 | PASS | `{2,2}` |
| C16 year end 12-31→01-01 | PASS | `{2,2}` |
| C17 leap 2024 Feb28→29→Mar1 | PASS | `{3,3}` |
| C18 non-leap 2023 Feb28→Mar1 | PASS | `{2,2}` |
| C19 century rule (2000 leap, 2100 not) | PASS | 2000 run `{3,3}`; `"2100-02-29"` throws with value in message |
| C20 06-30→07-02 not consecutive | PASS | `{1,1}` |
| C21 future dates ignored | PASS | `{1,1}` and `{0,0}` as specified |
| C22 future run never inflates longest | PASS | all-future 3-day run → `{0,0}` |
| C23 malformed strings/non-strings throw | PASS | `"2026-7-4"`, `"07-04-2026"`, `"2026/07/04"`, `""`, `null`, `20260704` all throw; message contains value |
| C24 impossible dates throw | PASS | all 5 spec examples throw with value in message |
| C25 invalid today throws | PASS | `"2026-7-4"`, `"2026-02-30"`, `null` as today all throw |
| C26 ignored elements still validated | PASS | `"2027-02-29"` after today throws |
| C27 input array not mutated | PASS | elements + order unchanged after call |
| C28 timezone invariance | PASS | subprocesses under `TZ=Pacific/Kiritimati` vs `TZ=America/Los_Angeles` produce identical, spec-correct outputs (TZ confirmed honored via differing offsets); source contains no `new Date(`/`Date.now`/`Date.parse`/locale calls |

Researched extras (RESEARCH.md): 1900-02-29 throws (century rule); trailing-newline string rejected;
grace adds nothing (equals as-of-yesterday); future date does not bridge a gap; multi-run longest;
4-day run across a year boundary; result shape is exactly `{current, longest}` integers. All PASS.

- **passRate:** 39/39 = 1.0
- **fakeConvergence:** false (builder claimed done in `BUILD r0`; verifier verdict is pass)
- **Verdict: PASS**
