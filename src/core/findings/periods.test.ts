import { describe, expect, test } from 'vitest';
import {
  addMonths,
  addPeriods,
  comparisonRange,
  currentPeriod,
  dataNow,
  defaultGrain,
  hasSamePeriodLastYear,
  isComplete,
  periodEnd,
  periodStart,
  previousPeriod,
  readTimeFacts,
  resolveRange,
  timeFactsSql,
  type TimeFacts,
} from './periods';

/** Every day from `from` to `to`, optionally skipping some. */
function days(from: string, to: string, skip: (iso: string) => boolean = () => false): TimeFacts {
  const out: string[] = [];
  for (let d = from; d <= to; d = addPeriods(d, 'day', 1)) if (!skip(d)) out.push(d);
  return { days: out };
}

describe('day arithmetic', () => {
  test('period starts for every grain; weeks start on Monday', () => {
    expect(periodStart('2025-03-19', 'day')).toBe('2025-03-19');
    expect(periodStart('2025-03-19', 'week')).toBe('2025-03-17');
    expect(periodStart('2025-03-16', 'week')).toBe('2025-03-10');
    expect(periodStart('2025-03-19', 'month')).toBe('2025-03-01');
    expect(periodStart('2025-08-19', 'quarter')).toBe('2025-07-01');
    expect(periodStart('2025-08-19', 'year')).toBe('2025-01-01');
  });

  test('period ends and month arithmetic that keeps the day where it can', () => {
    expect(periodEnd('2024-02-10', 'month')).toBe('2024-02-29');
    expect(periodEnd('2024-10-01', 'quarter')).toBe('2024-12-31');
    expect(periodEnd('2024-03-11', 'week')).toBe('2024-03-17');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addPeriods('2024-01-01', 'year', -1)).toBe('2023-01-01');
  });

  test('default grain by span', () => {
    expect(defaultGrain('2024-01-01', '2024-03-30')).toBe('month');
    expect(defaultGrain('2024-01-01', '2024-01-21')).toBe('week');
    expect(defaultGrain('2024-01-01', '2024-01-20')).toBe('day');
  });

  test('the facts statement and reader', () => {
    expect(timeFactsSql('orders', 'order_date')).toBe(
      'SELECT DISTINCT CAST("order_date" AS DATE) AS day FROM "orders" WHERE "order_date" IS NOT NULL ORDER BY 1',
    );
    expect(
      readTimeFacts({
        columns: [{ name: 'day', type: 'date', nullable: false }],
        rows: [['2024-01-01'], ['2024-01-02']],
        rowCount: 2,
        elapsedMs: 0,
      }),
    ).toEqual({ days: ['2024-01-01', '2024-01-02'] });
  });
});

describe('complete periods', () => {
  const full = days('2023-01-01', '2025-03-31');
  const partial = days('2023-01-01', '2025-03-12');

  test('a period with data on or after its last day is complete', () => {
    expect(isComplete('2025-03-01', 'month', full)).toBe(true);
    expect(isComplete('2025-02-01', 'month', partial)).toBe(true);
    expect(currentPeriod('month', full)).toBe('2025-03-01');
    expect(previousPeriod('month', full)).toBe('2025-02-01');
  });

  test('a final month with 12 of about 30 days is not complete', () => {
    expect(isComplete('2025-03-01', 'month', partial)).toBe(false);
    expect(currentPeriod('month', partial)).toBe('2025-02-01');
    expect(dataNow(partial)).toBe('2025-03-12');
  });

  test('a final period at 90% of the usual days counts as complete', () => {
    // Weekdays only: the last week has its five days and so is complete,
    // though the data stops on Friday before the week ends.
    const weekdays = days('2024-01-01', '2024-03-29', (d) => {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      return dow === 0 || dow === 6;
    });
    expect(isComplete('2024-03-25', 'week', weekdays)).toBe(true);
  });

  test('a monthly snapshot has one day a month and every month is complete', () => {
    const monthly = { days: Array.from({ length: 24 }, (_, i) => addMonths('2023-01-01', i)) };
    expect(currentPeriod('month', monthly)).toBe('2024-12-01');
    expect(hasSamePeriodLastYear('month', monthly)).toBe(true);
  });

  test('edge cases: no days, one period, no year before', () => {
    expect(isComplete('2024-01-01', 'month', { days: [] })).toBe(false);
    expect(currentPeriod('month', { days: [] })).toBeNull();
    const one = days('2024-01-01', '2024-01-10');
    expect(currentPeriod('month', one)).toBeNull();
    expect(previousPeriod('month', one)).toBeNull();
    expect(hasSamePeriodLastYear('month', days('2024-01-01', '2024-06-30'))).toBe(false);
    expect(previousPeriod('month', days('2024-01-01', '2024-01-31'))).toBeNull();
  });
});

describe('resolving ranges against the data', () => {
  const partial = days('2023-01-01', '2025-03-12');

  test('each kind of range', () => {
    expect(resolveRange({ kind: 'all' }, partial)).toEqual({
      from: '2023-01-01',
      to: '2025-03-12',
    });
    expect(
      resolveRange({ kind: 'absolute', from: '2024-01-01', to: '2024-01-31' }, partial),
    ).toEqual({ from: '2024-01-01', to: '2024-01-31' });
    expect(resolveRange({ kind: 'period', grain: 'month', offset: 0 }, partial)).toEqual({
      from: '2025-02-01',
      to: '2025-02-28',
    });
    expect(resolveRange({ kind: 'period', grain: 'month', offset: 2 }, partial)).toEqual({
      from: '2024-12-01',
      to: '2024-12-31',
    });
    expect(resolveRange({ kind: 'last_n', n: 3, grain: 'month', complete: true }, partial)).toEqual(
      { from: '2024-12-01', to: '2025-02-28' },
    );
    expect(
      resolveRange({ kind: 'last_n', n: 3, grain: 'month', complete: false }, partial),
    ).toEqual({ from: '2025-01-01', to: '2025-03-31' });
  });

  test('comparison ranges', () => {
    const period = { kind: 'period', grain: 'month', offset: 0 } as const;
    const feb = resolveRange(period, partial);
    expect(comparisonRange(period, feb, 'previous_period', partial)).toEqual({
      from: '2025-01-01',
      to: '2025-01-31',
    });
    expect(comparisonRange(period, feb, 'same_period_last_year', partial)).toEqual({
      from: '2024-02-01',
      to: '2024-02-28',
    });
    const last3 = { kind: 'last_n', n: 3, grain: 'month', complete: true } as const;
    expect(
      comparisonRange(last3, resolveRange(last3, partial), 'previous_period', partial),
    ).toEqual({ from: '2024-09-01', to: '2024-11-30' });
    const abs = { kind: 'absolute', from: '2024-06-10', to: '2024-06-16' } as const;
    expect(comparisonRange(abs, abs, 'previous_period', partial)).toEqual({
      from: '2024-06-03',
      to: '2024-06-09',
    });
  });

  test('a comparison before the data starts, or no complete period, is an error', () => {
    const all = { kind: 'all' } as const;
    expect(() =>
      comparisonRange(all, resolveRange(all, partial), 'previous_period', partial),
    ).toThrow('does not reach back far enough');
    const period = { kind: 'period', grain: 'year', offset: 0 } as const;
    expect(() => resolveRange(period, days('2024-01-01', '2024-06-30'))).toThrow(
      'no complete year',
    );
    expect(() => resolveRange({ kind: 'all' }, { days: [] })).toThrow('no dates');
    expect(() => resolveRange({ kind: 'period', grain: 'year', offset: 5 }, partial)).toThrow(
      'starts after that year',
    );
    const y = { kind: 'period', grain: 'month', offset: 0 } as const;
    const short = days('2024-06-01', '2024-09-30');
    expect(() =>
      comparisonRange(y, resolveRange(y, short), 'same_period_last_year', short),
    ).toThrow('full year');
  });
});
