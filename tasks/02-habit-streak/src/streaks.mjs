/**
 * Habit-streak engine — pure calendar-date logic.
 *
 * computeStreaks(dates, today) -> { current, longest }
 *
 * - Strict consecutive calendar days (proleptic Gregorian), with "grace for
 *   today": an incomplete today does not break a live streak, but adds nothing.
 * - Pure: no I/O, no system clock, no timezone dependence, no mutation of input.
 * - No Date parsing anywhere — year/month/day fields are handled directly and
 *   converted to an integer serial day number for consecutiveness checks.
 */

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** Gregorian leap-year rule: divisible by 4, except centuries unless divisible by 400. */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year, month) {
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_LENGTHS[month - 1];
}

/**
 * Validate one value as a "YYYY-MM-DD" real calendar date.
 * Throws an Error whose message contains the offending value.
 * Returns [year, month, day] as integers.
 */
function parseDate(value) {
  if (typeof value !== 'string' || !DATE_SHAPE.test(value)) {
    throw new Error(`Invalid date: ${String(value)}`);
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) {
    throw new Error(`Invalid date: ${value}`);
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid date: ${value}`);
  }
  return [year, month, day];
}

/**
 * Convert a calendar date to a serial day number (days since 0000-03-01,
 * proleptic Gregorian). Pure integer arithmetic — no Date objects.
 * Adapted from Howard Hinnant's days_from_civil algorithm.
 */
function toSerial(year, month, day) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400; // [0, 399]
  const mp = (month + 9) % 12; // Mar=0 ... Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe;
}

/** Length of the run of consecutive completed days ending at `endSerial`. */
function runLengthEndingAt(serialSet, endSerial) {
  let length = 0;
  let s = endSerial;
  while (serialSet.has(s)) {
    length += 1;
    s -= 1;
  }
  return length;
}

/**
 * Compute current and longest streaks of consecutive completed calendar days.
 *
 * @param {string[]} dates - "YYYY-MM-DD" strings; may be unordered, contain
 *   duplicates, and contain dates after `today` (validated, then ignored).
 * @param {string} today - "YYYY-MM-DD" reference day.
 * @returns {{ current: number, longest: number }}
 */
export function computeStreaks(dates, today) {
  if (!Array.isArray(dates)) {
    throw new Error(`Invalid dates argument: ${String(dates)}`);
  }

  const todaySerial = toSerial(...parseDate(today));

  // Validate every element (including future ones), dedupe, drop days after today.
  const completed = new Set();
  for (const value of dates) {
    const serial = toSerial(...parseDate(value));
    if (serial <= todaySerial) {
      completed.add(serial);
    }
  }

  // Longest: scan sorted unique serials for maximal consecutive runs.
  const sorted = [...completed].sort((a, b) => a - b);
  let longest = 0;
  let runLength = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] === sorted[i - 1] + 1) {
      runLength += 1;
    } else {
      runLength = 1;
    }
    if (runLength > longest) longest = runLength;
  }

  // Current: run ending at today, else (grace) run ending at yesterday, else 0.
  let current = 0;
  if (completed.has(todaySerial)) {
    current = runLengthEndingAt(completed, todaySerial);
  } else if (completed.has(todaySerial - 1)) {
    current = runLengthEndingAt(completed, todaySerial - 1);
  }

  return { current, longest };
}
