import { expect, test } from 'vitest';
import { formatDay, formatInteger } from './format';

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
