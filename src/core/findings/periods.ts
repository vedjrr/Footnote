// Periods (analytics-spec §4). Every relative phrase resolves against the
// data, never the clock: "now" is the latest day in the time column. The
// functions here are pure and work on the sorted list of distinct days the
// time column holds, which one statement (`timeFactsSql`) reads.

import type { QueryResult } from '@/core/engine/types';
import type { Grain } from '@/core/model/types';
import { quoteColumn, quoteTable } from '@/core/profile/profile';
import type { TimeRange } from '@/core/query/spec';

/** The distinct days in the time column, as sorted ISO dates. */
export interface TimeFacts {
  days: string[];
}

export interface DayRange {
  /** Inclusive ISO dates. */
  from: string;
  to: string;
}

/** A complete period needs this share of the usual distinct days (§4). */
export const COMPLETE_SHARE = 0.9;
const MONTH_GRAIN_DAYS = 90;
const WEEK_GRAIN_DAYS = 21;

export function timeFactsSql(table: string, column: string): string {
  const t = quoteColumn(column);
  return `SELECT DISTINCT CAST(${t} AS DATE) AS day FROM ${quoteTable(table)} WHERE ${t} IS NOT NULL ORDER BY 1`;
}

export function readTimeFacts(result: QueryResult): TimeFacts {
  return { days: result.rows.map((r) => String(r[0]).slice(0, 10)) };
}

// ------------------------------------------------------------ day arithmetic

function toDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** Adds months, keeping the day where it exists: 29 Feb 2024 + 12 months is 28 Feb 2025. */
export function addMonths(iso: string, n: number): string {
  const d = toDate(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return toIso(target);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

/** The first day of the period holding `iso`. Weeks start on Monday (ISO). */
export function periodStart(iso: string, grain: Grain): string {
  const d = toDate(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (grain) {
    case 'day':
      return toIso(d);
    case 'week':
      return addDays(toIso(d), -((d.getUTCDay() + 6) % 7));
    case 'month':
      return toIso(new Date(Date.UTC(y, m, 1)));
    case 'quarter':
      return toIso(new Date(Date.UTC(y, m - (m % 3), 1)));
    case 'year':
      return toIso(new Date(Date.UTC(y, 0, 1)));
  }
}

/** The start of the period `n` periods after the one starting at `start`. */
export function addPeriods(start: string, grain: Grain, n: number): string {
  switch (grain) {
    case 'day':
      return addDays(start, n);
    case 'week':
      return addDays(start, 7 * n);
    case 'month':
      return addMonths(start, n);
    case 'quarter':
      return addMonths(start, 3 * n);
    case 'year':
      return addMonths(start, 12 * n);
  }
}

export function periodEnd(start: string, grain: Grain): string {
  return addDays(addPeriods(periodStart(start, grain), grain, 1), -1);
}

// --------------------------------------------------------------- the data

export function dataNow(facts: TimeFacts): string {
  return facts.days[facts.days.length - 1];
}

export function firstDay(facts: TimeFacts): string {
  return facts.days[0];
}

/** Month for 90 days or more, week for 21 to 89, else day (§4). */
export function defaultGrain(min: string, max: string): Grain {
  const days = daysBetween(min, max) + 1;
  if (days >= MONTH_GRAIN_DAYS) return 'month';
  if (days >= WEEK_GRAIN_DAYS) return 'week';
  return 'day';
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Distinct days with data in each period, from the first period to the last. */
function daysPerPeriod(facts: TimeFacts, grain: Grain): Map<string, number> {
  const counts = new Map<string, number>();
  if (facts.days.length === 0) return counts;
  const last = periodStart(dataNow(facts), grain);
  for (let p = periodStart(firstDay(facts), grain); p <= last; p = addPeriods(p, grain, 1)) {
    counts.set(p, 0);
  }
  for (const day of facts.days) {
    const p = periodStart(day, grain);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return counts;
}

/**
 * A period is complete when the data has a day on or after its last day,
 * or, for the final period, when it has 90% of the median distinct days of
 * the earlier periods (§4).
 */
export function isComplete(start: string, grain: Grain, facts: TimeFacts): boolean {
  if (facts.days.length === 0) return false;
  const s = periodStart(start, grain);
  if (dataNow(facts) >= periodEnd(s, grain)) return true;
  if (s !== periodStart(dataNow(facts), grain)) return false;
  const counts = daysPerPeriod(facts, grain);
  const earlier = [...counts].filter(([p]) => p < s).map(([, n]) => n);
  if (earlier.length === 0) return false;
  return (counts.get(s) ?? 0) >= COMPLETE_SHARE * median(earlier);
}

/** The start of the latest complete period ("current period"), or null. */
export function currentPeriod(grain: Grain, facts: TimeFacts): string | null {
  if (facts.days.length === 0) return null;
  const last = periodStart(dataNow(facts), grain);
  if (isComplete(last, grain, facts)) return last;
  const before = addPeriods(last, grain, -1);
  return before >= periodStart(firstDay(facts), grain) ? before : null;
}

export function previousPeriod(grain: Grain, facts: TimeFacts): string | null {
  const current = currentPeriod(grain, facts);
  if (!current) return null;
  const before = addPeriods(current, grain, -1);
  return before >= periodStart(firstDay(facts), grain) ? before : null;
}

/** True when the data reaches back a full year before the current period starts. */
export function hasSamePeriodLastYear(grain: Grain, facts: TimeFacts): boolean {
  const current = currentPeriod(grain, facts);
  return current !== null && firstDay(facts) <= addMonths(current, -12);
}

export class PeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeriodError';
  }
}

/** The days a range covers, resolved against the data. */
export function resolveRange(range: TimeRange, facts: TimeFacts): DayRange {
  if (facts.days.length === 0) throw new PeriodError('The time column has no dates.');
  switch (range.kind) {
    case 'absolute':
      return { from: range.from, to: range.to };
    case 'all':
      return { from: firstDay(facts), to: dataNow(facts) };
    case 'period': {
      const current = currentPeriod(range.grain, facts);
      if (!current) throw new PeriodError(`The data has no complete ${range.grain} yet.`);
      const start = addPeriods(current, range.grain, -range.offset);
      const to = periodEnd(start, range.grain);
      if (to < firstDay(facts)) {
        throw new PeriodError(`The data starts after that ${range.grain}.`);
      }
      return { from: start, to };
    }
    case 'last_n': {
      const end = range.complete
        ? currentPeriod(range.grain, facts)
        : periodStart(dataNow(facts), range.grain);
      if (!end) throw new PeriodError(`The data has no complete ${range.grain} yet.`);
      return {
        from: addPeriods(end, range.grain, -(range.n - 1)),
        to: periodEnd(end, range.grain),
      };
    }
  }
}

/**
 * The range a comparison is made against: the same length immediately
 * before, or the same days a year earlier.
 */
export function comparisonRange(
  range: TimeRange,
  resolved: DayRange,
  compare: 'previous_period' | 'same_period_last_year',
  facts: TimeFacts,
): DayRange {
  let out: DayRange;
  if (compare === 'same_period_last_year') {
    out = { from: addMonths(resolved.from, -12), to: addMonths(resolved.to, -12) };
  } else if (range.kind === 'period' || range.kind === 'last_n') {
    const n = range.kind === 'period' ? 1 : range.n;
    const from = addPeriods(resolved.from, range.grain, -n);
    out = { from, to: addDays(resolved.from, -1) };
  } else {
    const length = daysBetween(resolved.from, resolved.to) + 1;
    out = { from: addDays(resolved.from, -length), to: addDays(resolved.from, -1) };
  }
  if (facts.days.length === 0 || out.to < firstDay(facts) || out.from < firstDay(facts)) {
    throw new PeriodError(
      compare === 'same_period_last_year'
        ? 'The data does not reach back a full year before this period.'
        : 'The data does not reach back far enough for the period before this one.',
    );
  }
  return out;
}
