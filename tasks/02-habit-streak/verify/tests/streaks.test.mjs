// Independent verifier suite for 02-habit-streak (round 0).
// Derived ONLY from spec.md acceptance criteria 1-28 + RESEARCH.md edge cases.
// Builder tests in src/tests/ were NOT read.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { computeStreaks } from '../../src/streaks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcFile = path.resolve(here, '../../src/streaks.mjs');

function expectThrowsWithValue(fn, valueText) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    expect(err).toBeInstanceOf(Error);
    expect(String(err.message)).toContain(valueText);
  }
  expect(threw).toBe(true);
}

describe('happy paths (criteria 1-5)', () => {
  it('C1: empty dates -> {0,0}', () => {
    expect(computeStreaks([], '2026-07-12')).toEqual({ current: 0, longest: 0 });
  });

  it('C2: only today completed -> {1,1}', () => {
    expect(computeStreaks(['2026-07-12'], '2026-07-12')).toEqual({ current: 1, longest: 1 });
  });

  it('C3: run ending at today counts in full -> {3,3}', () => {
    expect(
      computeStreaks(['2026-07-10', '2026-07-11', '2026-07-12'], '2026-07-12')
    ).toEqual({ current: 3, longest: 3 });
  });

  it('C4: unordered input equals sorted input', () => {
    const unordered = computeStreaks(['2026-07-12', '2026-07-10', '2026-07-11'], '2026-07-12');
    const sorted = computeStreaks(['2026-07-10', '2026-07-11', '2026-07-12'], '2026-07-12');
    expect(unordered).toEqual({ current: 3, longest: 3 });
    expect(unordered).toEqual(sorted);
  });

  it('C5: duplicates collapse to one completed day -> {2,2}', () => {
    expect(
      computeStreaks(['2026-07-12', '2026-07-12', '2026-07-11'], '2026-07-12')
    ).toEqual({ current: 2, longest: 2 });
  });
});

describe('grace for today (criteria 6-9)', () => {
  it('C6: yesterday completed, today not -> {1,1}', () => {
    expect(computeStreaks(['2026-07-11'], '2026-07-12')).toEqual({ current: 1, longest: 1 });
  });

  it('C7: run ending yesterday, today not -> {3,3}', () => {
    expect(
      computeStreaks(['2026-07-09', '2026-07-10', '2026-07-11'], '2026-07-12')
    ).toEqual({ current: 3, longest: 3 });
  });

  it('C8: most recent completion two days ago -> current 0, longest 1', () => {
    expect(computeStreaks(['2026-07-10'], '2026-07-12')).toEqual({ current: 0, longest: 1 });
  });

  it('C9: grace never chains across a gap -> {1,1}', () => {
    expect(
      computeStreaks(['2026-07-11', '2026-07-09'], '2026-07-12')
    ).toEqual({ current: 1, longest: 1 });
  });
});

describe('gaps, current vs longest (criteria 10-13)', () => {
  it('C10: a missing elapsed day breaks a streak -> {2,2}', () => {
    expect(
      computeStreaks(['2026-07-08', '2026-07-09', '2026-07-11', '2026-07-12'], '2026-07-12')
    ).toEqual({ current: 2, longest: 2 });
  });

  it('C11: longest may exceed current -> {2,5}', () => {
    expect(
      computeStreaks(
        ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-07-11', '2026-07-12'],
        '2026-07-12'
      )
    ).toEqual({ current: 2, longest: 5 });
  });

  it('C12: purely historical run counts for longest, current 0 -> {0,3}', () => {
    expect(
      computeStreaks(['2026-05-01', '2026-05-02', '2026-05-03'], '2026-07-12')
    ).toEqual({ current: 0, longest: 3 });
  });

  it('C13: longest >= current across a battery of valid inputs', () => {
    const batteries = [
      [[], '2026-07-12'],
      [['2026-07-12'], '2026-07-12'],
      [['2026-07-11'], '2026-07-12'],
      [['2026-07-10'], '2026-07-12'],
      [['2026-07-08', '2026-07-09', '2026-07-11', '2026-07-12'], '2026-07-12'],
      [['2026-01-01', '2026-01-02', '2026-07-12'], '2026-07-12'],
      [['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'], '2026-01-02'],
      [['2024-02-27', '2024-02-28', '2024-02-29'], '2024-03-05'],
      [['2026-08-01'], '2026-07-12'],
      [['2026-07-12', '2026-07-12', '2026-07-11', '2026-07-09'], '2026-07-12'],
    ];
    for (const [dates, today] of batteries) {
      const { current, longest } = computeStreaks(dates, today);
      expect(Number.isInteger(current)).toBe(true);
      expect(Number.isInteger(longest)).toBe(true);
      expect(current).toBeGreaterThanOrEqual(0);
      expect(longest).toBeGreaterThanOrEqual(current);
    }
  });
});

describe('month, year, leap boundaries (criteria 14-20)', () => {
  it('C14: June 30 -> July 1 consecutive -> {2,2}', () => {
    expect(
      computeStreaks(['2026-06-30', '2026-07-01'], '2026-07-01')
    ).toEqual({ current: 2, longest: 2 });
  });

  it('C15: Jan 31 -> Feb 1 consecutive -> {2,2}', () => {
    expect(
      computeStreaks(['2026-01-31', '2026-02-01'], '2026-02-01')
    ).toEqual({ current: 2, longest: 2 });
  });

  it('C16: Dec 31 -> Jan 1 consecutive across year end -> {2,2}', () => {
    expect(
      computeStreaks(['2025-12-31', '2026-01-01'], '2026-01-01')
    ).toEqual({ current: 2, longest: 2 });
  });

  it('C17: leap year Feb 28 -> Feb 29 -> Mar 1 -> {3,3}', () => {
    expect(
      computeStreaks(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01')
    ).toEqual({ current: 3, longest: 3 });
  });

  it('C18: non-leap year Feb 28 -> Mar 1 consecutive -> {2,2}', () => {
    expect(
      computeStreaks(['2023-02-28', '2023-03-01'], '2023-03-01')
    ).toEqual({ current: 2, longest: 2 });
  });

  it('C19a: 2000 IS a leap year -> {3,3}', () => {
    expect(
      computeStreaks(['2000-02-28', '2000-02-29', '2000-03-01'], '2000-03-01')
    ).toEqual({ current: 3, longest: 3 });
  });

  it('C19b: 2100-02-29 throws (2100 is NOT a leap year)', () => {
    expectThrowsWithValue(
      () => computeStreaks(['2100-02-29'], '2100-03-01'),
      '2100-02-29'
    );
  });

  it('C20: June 30 -> July 2 NOT consecutive -> {1,1}', () => {
    expect(
      computeStreaks(['2026-06-30', '2026-07-02'], '2026-07-02')
    ).toEqual({ current: 1, longest: 1 });
  });
});

describe('future dates (criteria 21-22)', () => {
  it('C21a: date after today ignored -> {1,1}', () => {
    expect(
      computeStreaks(['2026-07-12', '2026-07-13'], '2026-07-12')
    ).toEqual({ current: 1, longest: 1 });
  });

  it('C21b: only a future date -> {0,0}', () => {
    expect(computeStreaks(['2026-08-01'], '2026-07-12')).toEqual({ current: 0, longest: 0 });
  });

  it('C22: a future run never inflates longest -> {0,0}', () => {
    expect(
      computeStreaks(['2026-07-13', '2026-07-14', '2026-07-15'], '2026-07-12')
    ).toEqual({ current: 0, longest: 0 });
  });
});

describe('validation (criteria 23-26)', () => {
  it('C23: malformed strings and non-strings throw with the value in the message', () => {
    expectThrowsWithValue(() => computeStreaks(['2026-7-4'], '2026-07-12'), '2026-7-4');
    expectThrowsWithValue(() => computeStreaks(['07-04-2026'], '2026-07-12'), '07-04-2026');
    expectThrowsWithValue(() => computeStreaks(['2026/07/04'], '2026-07-12'), '2026/07/04');
    expect(() => computeStreaks([''], '2026-07-12')).toThrow(Error);
    expectThrowsWithValue(() => computeStreaks([null], '2026-07-12'), 'null');
    expectThrowsWithValue(() => computeStreaks([20260704], '2026-07-12'), '20260704');
  });

  it('C24: impossible dates throw with the value in the message', () => {
    for (const bad of ['2023-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-07-00']) {
      expectThrowsWithValue(() => computeStreaks([bad], '2026-07-12'), bad);
    }
  });

  it('C25: invalid today throws under the same rules', () => {
    expectThrowsWithValue(() => computeStreaks([], '2026-7-4'), '2026-7-4');
    expectThrowsWithValue(() => computeStreaks(['2026-07-12'], '2026-02-30'), '2026-02-30');
    expectThrowsWithValue(() => computeStreaks([], null), 'null');
  });

  it('C26: validation runs even for future (ignored) elements', () => {
    expectThrowsWithValue(
      () => computeStreaks(['2026-07-12', '2027-02-29'], '2026-07-12'),
      '2027-02-29'
    );
  });

  it('R1 extra (RESEARCH S9): 1900-02-29 throws (century, not div by 400)', () => {
    expectThrowsWithValue(() => computeStreaks(['1900-02-29'], '2026-07-12'), '1900-02-29');
  });

  it('R1 extra: trailing-newline string is not a valid YYYY-MM-DD', () => {
    expect(() => computeStreaks(['2026-07-04\n'], '2026-07-12')).toThrow(Error);
  });
});

describe('purity (criteria 27-28)', () => {
  it('C27: the input array is not mutated (same elements, same order)', () => {
    const d = ['2026-07-12', '2026-07-10', '2026-07-11', '2026-07-10'];
    const snapshot = [...d];
    computeStreaks(d, '2026-07-12');
    expect(d).toEqual(snapshot);
  });

  it('C28a: identical results under TZ=Pacific/Kiritimati and TZ=America/Los_Angeles', () => {
    const runner = path.join(here, 'tz-runner.mjs');
    const runUnder = (tz) => {
      const out = execFileSync(process.execPath, [runner], {
        env: { ...process.env, TZ: tz },
        encoding: 'utf8',
      });
      return JSON.parse(out);
    };
    const kiritimati = runUnder('Pacific/Kiritimati');
    const losAngeles = runUnder('America/Los_Angeles');
    expect(kiritimati.results).toEqual(losAngeles.results);
    // Both must also equal the spec-expected values, not merely each other.
    expect(kiritimati.results).toEqual([
      { current: 3, longest: 3 },
      { current: 1, longest: 1 },
      { current: 2, longest: 2 },
      { current: 3, longest: 3 },
      { current: 2, longest: 2 },
      { current: 1, longest: 1 },
      { current: 0, longest: 3 },
    ]);
    // Sanity: confirm the TZ env var actually took effect in the children
    // (Kiritimati is UTC+14, LA is UTC-7/-8 -> offsets must differ). If a
    // platform ignored TZ, this check keeps the test from passing vacuously.
    expect(kiritimati.tzOffset).not.toBe(losAngeles.tzOffset);
  });

  it('C28b: source never consults the clock or constructs local Dates', () => {
    const src = readFileSync(srcFile, 'utf8');
    expect(src).not.toMatch(/Date\.now\s*\(/);
    expect(src).not.toMatch(/new\s+Date\s*\(/);
    expect(src).not.toMatch(/Date\.parse\s*\(/);
    expect(src).not.toMatch(/getTimezoneOffset/);
    expect(src).not.toMatch(/toLocale/);
  });
});

describe('researched edge cases (RESEARCH.md)', () => {
  it('R3/R5: duplicate of yesterday under grace still counts once', () => {
    expect(
      computeStreaks(['2026-07-11', '2026-07-11', '2026-07-10'], '2026-07-12')
    ).toEqual({ current: 2, longest: 2 });
  });

  it('R5: grace adds nothing — incomplete today never contributes a day', () => {
    const withGrace = computeStreaks(['2026-07-09', '2026-07-10', '2026-07-11'], '2026-07-12');
    const asOfYesterday = computeStreaks(['2026-07-09', '2026-07-10', '2026-07-11'], '2026-07-11');
    expect(withGrace.current).toBe(asOfYesterday.current);
  });

  it('R7: future dates do not bridge a gap to create a longer current run', () => {
    // 07-13 (future) would connect 07-12 to 07-14 if wrongly included.
    expect(
      computeStreaks(['2026-07-12', '2026-07-13', '2026-07-14'], '2026-07-12')
    ).toEqual({ current: 1, longest: 1 });
  });

  it('R4: multiple historical runs — longest picks the max', () => {
    expect(
      computeStreaks(
        ['2026-01-01', '2026-01-02', '2026-03-01', '2026-03-02', '2026-03-03', '2026-06-01'],
        '2026-07-12'
      )
    ).toEqual({ current: 0, longest: 3 });
  });

  it('R2: long run across leap-day + month + year boundaries counts exactly', () => {
    // 2023-12-30 .. 2024-01-02 (4 consecutive days across a year end)
    expect(
      computeStreaks(['2023-12-30', '2023-12-31', '2024-01-01', '2024-01-02'], '2024-01-02')
    ).toEqual({ current: 4, longest: 4 });
  });

  it('shape: returns a plain object with integer current/longest only', () => {
    const res = computeStreaks(['2026-07-12'], '2026-07-12');
    expect(Object.keys(res).sort()).toEqual(['current', 'longest']);
    expect(Number.isInteger(res.current)).toBe(true);
    expect(Number.isInteger(res.longest)).toBe(true);
  });
});
