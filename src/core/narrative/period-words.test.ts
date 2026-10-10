import { describe, expect, test } from 'vitest';
import { inPeriod, inRange, rangeWords } from './period-words';

describe('rangeWords', () => {
  test.each([
    [{ from: '2025-03-01', to: '2025-03-31' }, 'March 2025'],
    [{ from: '2024-01-01', to: '2024-12-31' }, '2024'],
    [{ from: '2024-10-01', to: '2024-12-31' }, 'Q4 2024'],
    [{ from: '2025-04-01', to: '2025-09-30' }, 'April to September 2025'],
    [{ from: '2024-10-01', to: '2025-03-31' }, 'October 2024 to March 2025'],
    [{ from: '2024-07-18', to: '2024-07-18' }, '18 July 2024'],
    [{ from: '2025-06-09', to: '2025-06-15' }, '9 June 2025 to 15 June 2025'],
  ])('%o is %s', (range, words) => {
    expect(rangeWords(range)).toBe(words);
  });
});

test('inRange picks the preposition', () => {
  expect(inRange({ from: '2025-03-01', to: '2025-03-31' })).toBe('in March 2025');
  expect(inRange({ from: '2024-07-18', to: '2024-07-18' })).toBe('on 18 July 2024');
  expect(inRange({ from: '2025-04-01', to: '2025-09-30' })).toBe('from April to September 2025');
});

test('inPeriod names one period of a series', () => {
  expect(inPeriod('2025-03-01', 'month')).toBe('in March 2025');
  expect(inPeriod('2025-06-09', 'week')).toBe('in the week of 9 June 2025');
  expect(inPeriod('2024-07-18', 'day')).toBe('on 18 July 2024');
});
