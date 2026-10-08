import { expect, test } from 'vitest';
import { formatDay, formatInteger, formatMonth, formatShare } from './format';

test('integers have thousands separators and a real minus sign', () => {
  expect(formatInteger(59881)).toBe('59,881');
  expect(formatInteger(0)).toBe('0');
  expect(formatInteger(-1234)).toBe('−1,234');
});

test('days are written out, whatever the time zone', () => {
  expect(formatDay('2024-07-18')).toBe('18 July 2024');
  expect(formatDay('2023-01-01')).toBe('1 January 2023');
  expect(formatDay('2024-12-31 23:59:59')).toBe('31 December 2024');
});

test('shares have one decimal, and tiny ones say so', () => {
  expect(formatShare(0.012)).toBe('1.2%');
  expect(formatShare(0.59422)).toBe('59.4%');
  expect(formatShare(0)).toBe('0.0%');
  expect(formatShare(0.0003)).toBe('under 0.1%');
});

test('months are written out', () => {
  expect(formatMonth('2025-03-01')).toBe('March 2025');
  expect(formatMonth('2024-12-31T22:57:22')).toBe('December 2024');
});
