import { describe, expect, test } from 'vitest';
import { assessChange, normalRange, scoreKeyChange } from './changes';

/** A steady series with a small wobble, then `last`. */
function series(n: number, last: number, base = 100): number[] {
  const out = Array.from({ length: n - 1 }, (_, i) => base + (i % 3) - 1);
  return [...out, last];
}

describe('normal-range label (analytics-spec §5.1)', () => {
  test('boundaries at 2 and 3.5, either sign', () => {
    expect(normalRange(null)).toBe('not_assessed');
    expect(normalRange(1.99)).toBe('normal');
    expect(normalRange(-2)).toBe('larger_than_usual');
    expect(normalRange(3.49)).toBe('larger_than_usual');
    expect(normalRange(-3.5)).toBe('unusually_large');
  });
});

describe('assessChange', () => {
  test('fewer than 8 periods is not assessed, for short history', () => {
    const values = series(7, 200);
    const a = assessChange(values, 'month', false);
    expect(a.label).toBe('not_assessed');
    expect(a.reason).toBe('short_history');
    expect(a.change).toBe(200 - values[5]);
  });

  test('8 periods compares against the period before', () => {
    const a = assessChange(series(8, 140), 'month', false);
    expect(a.basis).toBe('sequential');
    expect(a.history).toBe(6);
    expect(a.label).toBe('unusually_large');
  });

  test('a full season and seven more compares against the same period last season', () => {
    // A December peak every year: big against November, normal against last December.
    const year = [100, 101, 99, 100, 102, 100, 101, 99, 100, 101, 120, 150];
    const values = [...year, ...year.slice(0, 11).map((v, i) => v + 5 + (i % 2)), 156];
    const a = assessChange(values, 'month', false);
    expect(a.basis).toBe('seasonal');
    expect(a.label).toBe('normal');
    // The same series judged against the month before would be unusual.
    expect(assessChange(values, 'week', false).label).toBe('unusually_large');
  });

  test('week and year have no season', () => {
    expect(assessChange(series(30, 100), 'week', false).basis).toBe('sequential');
    expect(assessChange(series(7, 100), 'day', false).reason).toBe('short_history');
    expect(assessChange(series(14, 100), 'day', false).basis).toBe('seasonal');
  });

  test('little changed: under 0.5%, or under 0.1 points for percent metrics', () => {
    expect(assessChange([200, 200.99], 'month', false).littleChanged).toBe(true);
    expect(assessChange([200, 201], 'month', false).littleChanged).toBe(false);
    expect(assessChange([0.05, 0.0509], 'month', true).littleChanged).toBe(true);
    expect(assessChange([0.05, 0.0511], 'month', true).littleChanged).toBe(false);
    expect(assessChange([0.05, 0.0511], 'month', true).points).toBe(true);
  });

  test('a previous value of 0 gives no percent change', () => {
    const a = assessChange([0, 5], 'month', false);
    expect(a.pct).toBeNull();
    expect(a.change).toBe(5);
    expect(a.littleChanged).toBe(false);
    expect(assessChange([0, 0], 'month', false).littleChanged).toBe(true);
  });

  test('an empty current value, or a history with no spread, is not assessed', () => {
    const missing = assessChange([...series(9, 100).slice(0, 8), null], 'month', false);
    expect(missing.reason).toBe('missing_value');
    const flat = assessChange([...Array(9).fill(5), 9], 'month', false);
    expect(flat.reason).toBe('no_spread');
  });
});

describe('scoreKeyChange (analytics-spec §7)', () => {
  test('each term caps at 1 and weights add to 1', () => {
    const a = assessChange(series(8, 1000), 'month', false);
    expect(scoreKeyChange({ assessment: a, importance: 1, topShare: 1 })).toBeCloseTo(1, 10);
  });

  test('percent metrics use points in place of the percent term', () => {
    const a = assessChange([0.1, 0.125], 'month', true);
    // z not assessed: 0.25 * (0.025 / 0.05) + 0.2 * 0.5
    expect(scoreKeyChange({ assessment: a, importance: 0.5 })).toBeCloseTo(0.125 + 0.1, 10);
  });
});
