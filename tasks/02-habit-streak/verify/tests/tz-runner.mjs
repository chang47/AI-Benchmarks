// Subprocess runner for the timezone-invariance criterion (spec #28).
// Runs a fixed battery of computeStreaks cases and prints JSON to stdout.
// The parent test launches this under different TZ env values and compares.
import { computeStreaks } from '../../src/streaks.mjs';

const cases = [
  [['2026-07-10', '2026-07-11', '2026-07-12'], '2026-07-12'],
  [['2026-07-11'], '2026-07-12'],
  [['2025-12-31', '2026-01-01'], '2026-01-01'],
  [['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01'],
  [['2026-06-30', '2026-07-01'], '2026-07-01'],
  [['2026-07-12', '2026-07-13'], '2026-07-12'],
  [['2026-05-01', '2026-05-02', '2026-05-03'], '2026-07-12'],
];

const results = cases.map(([dates, today]) => computeStreaks(dates, today));
// tzOffset lets the parent confirm the TZ env var actually took effect.
console.log(
  JSON.stringify({ results, tzOffset: new Date(86400000).getTimezoneOffset() })
);
