import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { computeStreaks } from '../streaks.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, '..', 'streaks.mjs');

describe('happy paths (criteria 1-5)', () => {
  it('1: empty dates -> 0/0', () => {
    expect(computeStreaks([], '2026-07-12')).toEqual({ current: 0, longest: 0 });
  });

  it('2: only today completed -> 1/1', () => {
    expect(computeStreaks(['2026-07-12'], '2026-07-12')).toEqual({ current: 1, longest: 1 });
  });

  it('3: run ending at today counts in full', () => {
    expect(computeStreaks(['2026-07-10', '2026-07-11', '2026-07-12'], '2026-07-12'))
      .toEqual({ current: 3, longest: 3 });
  });

  it('4: unordered input same as sorted', () => {
    expect(computeStreaks(['2026-07-12', '2026-07-10', '2026-07-11'], '2026-07-12'))
      .toEqual({ current: 3, longest: 3 });
  });

  it('5: duplicates collapse to one completed day', () => {
    expect(computeStreaks(['2026-07-12', '2026-07-12', '2026-07-11'], '2026-07-12'))
      .toEqual({ current: 2, longest: 2 });
  });
});

describe('grace for today (criteria 6-9)', () => {
  it('6: yesterday completed, today not yet -> streak alive, adds nothing', () => {
    expect(computeStreaks(['2026-07-11'], '2026-07-12')).toEqual({ current: 1, longest: 1 });
  });

  it('7: run ending yesterday, today not yet', () => {
    expect(computeStreaks(['2026-07-09', '2026-07-10', '2026-07-11'], '2026-07-12'))
      .toEqual({ current: 3, longest: 3 });
  });

  it('8: grace reaches back exactly one day and no further', () => {
    expect(computeStreaks(['2026-07-10'], '2026-07-12')).toEqual({ current: 0, longest: 1 });
  });

  it('9: grace never chains across a gap', () => {
    expect(computeStreaks(['2026-07-11', '2026-07-09'], '2026-07-12'))
      .toEqual({ current: 1, longest: 1 });
  });
});

describe('gaps, current vs longest (criteria 10-13)', () => {
  it('10: a missing fully-elapsed day breaks a streak', () => {
    expect(computeStreaks(['2026-07-08', '2026-07-09', '2026-07-11', '2026-07-12'], '2026-07-12'))
      .toEqual({ current: 2, longest: 2 });
  });

  it('11: longest may exceed current', () => {
    expect(computeStreaks(
      ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-07-11', '2026-07-12'],
      '2026-07-12',
    )).toEqual({ current: 2, longest: 5 });
  });

  it('12: longest counts a purely historical run even when current is 0', () => {
    expect(computeStreaks(['2026-05-01', '2026-05-02', '2026-05-03'], '2026-07-12'))
      .toEqual({ current: 0, longest: 3 });
  });

  it('13: longest >= current across a spread of inputs', () => {
    const cases = [
      [[], '2026-07-12'],
      [['2026-07-12'], '2026-07-12'],
      [['2026-07-10'], '2026-07-12'],
      [['2026-07-08', '2026-07-09', '2026-07-11', '2026-07-12'], '2026-07-12'],
      [['2026-05-01', '2026-05-02', '2026-05-03'], '2026-07-12'],
      [['2025-12-31', '2026-01-01'], '2026-01-01'],
      [['2026-07-13', '2026-07-14'], '2026-07-12'],
    ];
    for (const [dates, today] of cases) {
      const { current, longest } = computeStreaks(dates, today);
      expect(longest).toBeGreaterThanOrEqual(current);
      expect(current).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(current)).toBe(true);
      expect(Number.isInteger(longest)).toBe(true);
    }
  });
});

describe('month, year, leap boundaries (criteria 14-20)', () => {
  it('14: month end June 30 -> July 1', () => {
    expect(computeStreaks(['2026-06-30', '2026-07-01'], '2026-07-01'))
      .toEqual({ current: 2, longest: 2 });
  });

  it('15: 31-day month end Jan 31 -> Feb 1', () => {
    expect(computeStreaks(['2026-01-31', '2026-02-01'], '2026-02-01'))
      .toEqual({ current: 2, longest: 2 });
  });

  it('16: year end Dec 31 -> Jan 1', () => {
    expect(computeStreaks(['2025-12-31', '2026-01-01'], '2026-01-01'))
      .toEqual({ current: 2, longest: 2 });
  });

  it('17: leap year Feb 28 -> Feb 29 -> Mar 1 (2024)', () => {
    expect(computeStreaks(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01'))
      .toEqual({ current: 3, longest: 3 });
  });

  it('18: non-leap year Feb 28 -> Mar 1 consecutive (2023)', () => {
    expect(computeStreaks(['2023-02-28', '2023-03-01'], '2023-03-01'))
      .toEqual({ current: 2, longest: 2 });
  });

  it('19: century rule — 2000 IS leap, 2100-02-29 throws', () => {
    expect(computeStreaks(['2000-02-28', '2000-02-29', '2000-03-01'], '2000-03-01'))
      .toEqual({ current: 3, longest: 3 });
    expect(() => computeStreaks(['2100-02-29'], '2100-03-01')).toThrow(/2100-02-29/);
    expect(() => computeStreaks(['2100-02-28'], '2100-02-29')).toThrow(/2100-02-29/);
  });

  it('20: not consecutive across a month gap', () => {
    expect(computeStreaks(['2026-06-30', '2026-07-02'], '2026-07-02'))
      .toEqual({ current: 1, longest: 1 });
  });
});

describe('future dates (criteria 21-22)', () => {
  it('21: dates strictly after today are ignored in both metrics', () => {
    expect(computeStreaks(['2026-07-12', '2026-07-13'], '2026-07-12'))
      .toEqual({ current: 1, longest: 1 });
    expect(computeStreaks(['2026-08-01'], '2026-07-12'))
      .toEqual({ current: 0, longest: 0 });
  });

  it('22: a future run never inflates longest', () => {
    expect(computeStreaks(['2026-07-13', '2026-07-14', '2026-07-15'], '2026-07-12'))
      .toEqual({ current: 0, longest: 0 });
  });
});

describe('validation (criteria 23-26)', () => {
  const malformed = ['2026-7-4', '07-04-2026', '2026/07/04', ''];

  it('23: malformed strings throw with the offending value in the message', () => {
    for (const bad of malformed) {
      expect(() => computeStreaks([bad], '2026-07-12')).toThrow(Error);
      try {
        computeStreaks([bad], '2026-07-12');
        expect.unreachable(`expected throw for ${JSON.stringify(bad)}`);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain(bad);
      }
    }
  });

  it('23: non-string elements throw with the offending value in the message', () => {
    for (const bad of [null, 20260704]) {
      try {
        computeStreaks([bad], '2026-07-12');
        expect.unreachable(`expected throw for ${String(bad)}`);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain(String(bad));
      }
    }
  });

  it('24: impossible dates throw the same way', () => {
    for (const bad of ['2023-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-07-00']) {
      try {
        computeStreaks([bad], '2026-07-12');
        expect.unreachable(`expected throw for ${bad}`);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain(bad);
      }
    }
  });

  it('25: an invalid today throws under the same rules', () => {
    for (const bad of ['2026-7-4', '2023-02-29', '2026-13-01', '', null]) {
      try {
        computeStreaks(['2026-07-11'], bad);
        expect.unreachable(`expected throw for today=${String(bad)}`);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain(String(bad));
      }
    }
  });

  it('26: validation runs even for elements that would be ignored (future invalid date)', () => {
    expect(() => computeStreaks(['2026-07-12', '2027-02-29'], '2026-07-12'))
      .toThrow(/2027-02-29/);
  });
});

describe('purity (criteria 27-28)', () => {
  it('27: the input array is not mutated', () => {
    const d = ['2026-07-12', '2026-07-10', '2026-07-11', '2026-07-10'];
    const snapshot = [...d];
    computeStreaks(d, '2026-07-12');
    expect(d).toEqual(snapshot);
  });

  it('28: identical results under different TZ env vars (subprocess check)', () => {
    const script = [
      `import { computeStreaks } from ${JSON.stringify(pathToFileURL(MODULE_PATH).href)};`,
      `const r1 = computeStreaks(['2026-07-10','2026-07-11','2026-07-12'], '2026-07-12');`,
      `const r2 = computeStreaks(['2025-12-31','2026-01-01'], '2026-01-01');`,
      `const r3 = computeStreaks(['2024-02-28','2024-02-29','2024-03-01'], '2024-03-01');`,
      `console.log(JSON.stringify([r1, r2, r3]));`,
    ].join('\n');
    const run = (tz) =>
      execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        env: { ...process.env, TZ: tz },
        encoding: 'utf8',
      }).trim();
    const kiritimati = run('Pacific/Kiritimati');
    const losAngeles = run('America/Los_Angeles');
    const utc = run('UTC');
    expect(kiritimati).toBe(losAngeles);
    expect(kiritimati).toBe(utc);
    expect(JSON.parse(kiritimati)).toEqual([
      { current: 3, longest: 3 },
      { current: 2, longest: 2 },
      { current: 3, longest: 3 },
    ]);
  });

  it('28: implementation never touches Date or the system clock (source audit)', () => {
    const source = readFileSync(MODULE_PATH, 'utf8');
    expect(source).not.toMatch(/\bnew Date\b/);
    expect(source).not.toMatch(/\bDate\.now\b/);
    expect(source).not.toMatch(/\bDate\.parse\b/);
    expect(source).not.toMatch(/\bMath\.random\b/);
  });
});
