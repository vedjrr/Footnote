import { describe, expect, test } from 'vitest';
import {
  formatCompact,
  formatDay,
  formatDuration,
  formatFixed,
  formatInteger,
  formatMegabytes,
  formatMonth,
  formatNumber,
  formatPercentChange,
  formatPeriod,
  formatPeriodShort,
  formatPoints,
  formatQuarter,
  formatShare,
  formatTick,
  formatValue,
  formatWeek,
} from './format';

const gbp = { style: 'currency', unit: 'GBP' } as const;
const pct = { style: 'percent', decimals: 1 } as const;
const minutes = { style: 'duration', unit: 'minutes' } as const;

describe('plain numbers', () => {
  test('integers have thousands separators and a real minus sign', () => {
    expect(formatInteger(59881)).toBe('59,881');
    expect(formatInteger(0)).toBe('0');
    expect(formatInteger(-1234)).toBe('−1,234');
  });

  test('a value that rounds to zero has no sign', () => {
    expect(formatNumber(-0.004, 2)).toBe('0');
    expect(formatFixed(-0.004, 2)).toBe('0.00');
    expect(formatNumber(0.004, 2, { signed: true })).toBe('0');
  });

  test('decimals: up to, or exactly', () => {
    expect(formatNumber(1234.5, 2)).toBe('1,234.5');
    expect(formatFixed(4, 1)).toBe('4.0');
    expect(formatFixed(-12.5, 2)).toBe('−12.50');
  });

  test('megabytes are whole, small files say so', () => {
    expect(formatMegabytes(12_400_000)).toBe('12 MB');
    expect(formatMegabytes(400_000)).toBe('under 1 MB');
  });
});

describe('full values, for tables and working papers', () => {
  test('thousands separators, the unit after the number, no symbol', () => {
    expect(formatValue(1210655, gbp)).toBe('1,210,655 GBP');
    expect(formatValue(48.235, gbp)).toBe('48.24 GBP');
    expect(formatValue(1210655)).toBe('1,210,655');
    expect(formatValue(12.5, { style: 'number', decimals: 2 })).toBe('12.50');
  });

  test('negative values use U+2212', () => {
    expect(formatValue(-3200, gbp)).toBe('−3,200 GBP');
    expect(formatValue(-3200, gbp).charCodeAt(0)).toBe(0x2212);
  });

  test('percent metrics are stored as fractions', () => {
    expect(formatValue(0.125, pct)).toBe('12.5%');
    expect(formatValue(-0.031, pct)).toBe('−3.1%');
    expect(formatValue(0.2, { style: 'percent' })).toBe('20.0%');
  });

  test('durations keep their stored unit in full', () => {
    expect(formatValue(95.25, minutes)).toBe('95.3 minutes');
    expect(formatValue(1, minutes)).toBe('1 minute');
  });

  test('signed and bare', () => {
    expect(formatValue(12400, gbp, { signed: true })).toBe('+12,400 GBP');
    expect(formatValue(-12400, gbp, { signed: true, bare: true })).toBe('−12,400');
    expect(formatValue(0, gbp, { signed: true })).toBe('0 GBP');
  });

  test('a missing value says so', () => {
    expect(formatValue(null)).toBe('No value');
    expect(formatValue(Number.NaN)).toBe('No value');
    expect(formatCompact(null)).toBe('No value');
  });
});

describe('compact values, for prose and headline figures', () => {
  test('three significant digits from 10,000', () => {
    expect(formatCompact(1284000, gbp)).toBe('1.28M GBP');
    expect(formatCompact(48210)).toBe('48.2K');
    expect(formatCompact(2_150_000_000)).toBe('2.15B');
    expect(formatCompact(999_999)).toBe('1M');
  });

  test('smaller values keep three significant digits, with separators', () => {
    expect(formatCompact(1234.5)).toBe('1,230');
    expect(formatCompact(48.234, gbp)).toBe('48.2 GBP');
    expect(formatCompact(4.567)).toBe('4.57');
    expect(formatCompact(7)).toBe('7');
  });

  test('signs', () => {
    expect(formatCompact(-48210, gbp)).toBe('−48.2K GBP');
    expect(formatCompact(48210, gbp, { signed: true })).toBe('+48.2K GBP');
  });

  test('percent and duration metrics', () => {
    expect(formatCompact(0.2345, pct)).toBe('23.5%');
    expect(formatCompact(150, minutes)).toBe('2.5 hours');
  });
});

describe('axis ticks', () => {
  test('compact from 1,000, never a unit', () => {
    expect(formatTick(1210655)).toBe('1.21M');
    expect(formatTick(2000, gbp)).toBe('2K');
    expect(formatTick(-2000)).toBe('−2K');
    expect(formatTick(500)).toBe('500');
    expect(formatTick(0)).toBe('0');
  });

  test('percent ticks are whole, with one decimal below 10%', () => {
    expect(formatTick(0.25, pct)).toBe('25%');
    expect(formatTick(0.025, pct)).toBe('2.5%');
    expect(formatTick(0, pct)).toBe('0%');
  });
});

describe('changes', () => {
  test('percent changes have one decimal', () => {
    expect(formatPercentChange(0.12345)).toBe('12.3%');
    expect(formatPercentChange(-0.0612, { signed: true })).toBe('−6.1%');
    expect(formatPercentChange(0.0612, { signed: true })).toBe('+6.1%');
    expect(formatPercentChange(0)).toBe('0.0%');
  });

  test('ratio changes are points with one decimal, written "pts"', () => {
    expect(formatPoints(0.024)).toBe('2.4 pts');
    expect(formatPoints(-0.0137, { signed: true })).toBe('−1.4 pts');
    expect(formatPoints(0.0137, { signed: true })).toBe('+1.4 pts');
  });
});

describe('shares', () => {
  test('one decimal, and tiny ones say so', () => {
    expect(formatShare(0.012)).toBe('1.2%');
    expect(formatShare(0.59422)).toBe('59.4%');
    expect(formatShare(0)).toBe('0.0%');
    expect(formatShare(0.0003)).toBe('under 0.1%');
  });
});

describe('durations pick a sensible unit', () => {
  test('minutes under 2 hours', () => {
    expect(formatDuration(42, 'minutes')).toBe('42 minutes');
    expect(formatDuration(119, 'minutes')).toBe('119 minutes');
    expect(formatDuration(4.25, 'minutes')).toBe('4.3 minutes');
    expect(formatDuration(1, 'minutes')).toBe('1 minute');
  });

  test('hours under 3 days, days beyond', () => {
    expect(formatDuration(120, 'minutes')).toBe('2 hours');
    expect(formatDuration(30.5, 'hours')).toBe('30.5 hours');
    expect(formatDuration(72, 'hours')).toBe('3 days');
    expect(formatDuration(100, 'hours')).toBe('4.2 days');
  });

  test('seconds under a minute; signs', () => {
    expect(formatDuration(0.5, 'minutes')).toBe('30 seconds');
    expect(formatDuration(-1.5, 'hours')).toBe('−90 minutes');
    expect(formatDuration(1.5, 'hours', { signed: true })).toBe('+90 minutes');
  });
});

describe('dates', () => {
  test('days are written out, whatever the time zone', () => {
    expect(formatDay('2024-07-18')).toBe('18 July 2024');
    expect(formatDay('2023-01-01')).toBe('1 January 2023');
    expect(formatDay('2024-12-31 23:59:59')).toBe('31 December 2024');
  });

  test('months, weeks, quarters', () => {
    expect(formatMonth('2025-03-01')).toBe('March 2025');
    expect(formatMonth('2024-12-31T22:57:22')).toBe('December 2024');
    expect(formatWeek('2025-06-09')).toBe('the week of 9 June 2025');
    expect(formatQuarter('2025-04-01')).toBe('Q2 2025');
    expect(formatQuarter('2024-12-01')).toBe('Q4 2024');
  });

  test('periods by grain, in prose and short', () => {
    expect(formatPeriod('2025-03-01', 'month')).toBe('March 2025');
    expect(formatPeriod('2025-06-09', 'week')).toBe('the week of 9 June 2025');
    expect(formatPeriod('2024-07-18', 'day')).toBe('18 July 2024');
    expect(formatPeriod('2024-01-01', 'year')).toBe('2024');
    expect(formatPeriodShort('2025-09-01', 'month')).toBe('Sep 2025');
    expect(formatPeriodShort('2025-06-09', 'week')).toBe('9 Jun 2025');
    expect(formatPeriodShort('2025-07-01', 'quarter')).toBe('Q3 2025');
  });
});
