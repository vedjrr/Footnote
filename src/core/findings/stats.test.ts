import { describe, expect, test } from 'vitest';
import { median, robustZ } from './stats';

describe('robust z-score (analytics-spec §1)', () => {
  test('median of odd and even sets', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  test('uses MAD when it is above 0', () => {
    // median 3, deviations [2, 1, 0, 1, 2], MAD 1
    expect(robustZ(7, [1, 2, 3, 4, 5])).toBeCloseTo(0.6745 * 4, 10);
    expect(robustZ(-1, [1, 2, 3, 4, 5])).toBeCloseTo(-0.6745 * 4, 10);
  });

  test('falls back to the mean absolute deviation when MAD is 0', () => {
    // median 5, deviations [0, 0, 0, 0, 5], MAD 0, mean 1
    expect(robustZ(8, [5, 5, 5, 5, 10])).toBeCloseTo(3 / 1.2533, 10);
  });

  test('not assessed when the set has no spread or no values', () => {
    expect(robustZ(9, [4, 4, 4])).toBeNull();
    expect(robustZ(9, [])).toBeNull();
  });

  test('one wild value in the history does not hide the next one', () => {
    // A mean and standard deviation would put 10 below the average of this set.
    expect(robustZ(10, [1, 2, 3, 2, 1, 2, 3, 200])).toBeGreaterThanOrEqual(3.5);
  });
});
