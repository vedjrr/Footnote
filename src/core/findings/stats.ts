// The robust z-score (analytics-spec §1). Median and MAD rather than mean and
// standard deviation, so one wild value in the history does not hide the
// next one.

import { MAD_SCALE, MEAN_ABS_DEV_SCALE } from './constants';

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * How far `x` sits from the set, in robust standard deviations. Null when
 * the set is empty or has no spread at all, so z cannot be assessed.
 */
export function robustZ(x: number, set: number[]): number | null {
  if (set.length === 0) return null;
  const m = median(set);
  const deviations = set.map((v) => Math.abs(v - m));
  const mad = median(deviations);
  if (mad > 0) return (MAD_SCALE * (x - m)) / mad;
  const meanAbsDev = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  if (meanAbsDev > 0) return (x - m) / (MEAN_ABS_DEV_SCALE * meanAbsDev);
  return null;
}
