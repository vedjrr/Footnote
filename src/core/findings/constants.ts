// Every threshold and weight the findings use, in one place (analytics-spec
// §1). Each is a stated judgement with a pointer to the rule it implements.
// None is tuned to make a test pass: change the spec first, then this file.

import type { Grain } from '@/core/model/types';

// ------------------------------------------------ robust z-score (spec §1)

/** Iglewicz and Hoaglin: z = 0.6745 * (x - median) / MAD. */
export const MAD_SCALE = 0.6745;
/** Used when MAD is 0: z = (x - median) / (1.2533 * mean absolute deviation). */
export const MEAN_ABS_DEV_SCALE = 1.2533;

// --------------------------------------------------- key changes (spec §5.1)

/** Season length per grain. Week and year have none. */
export const SEASON: Record<Grain, number | null> = {
  day: 7,
  week: null,
  month: 12,
  quarter: 4,
  year: null,
};
/** Compare against the same point last season when n >= season + this. */
export const SEASONAL_EXTRA_PERIODS = 7;
/** Fewer complete periods than this: the change is not assessed. */
export const MIN_PERIODS = 8;
/** |z| at or above this is "unusually large". */
export const Z_UNUSUAL = 3.5;
/** |z| at or above this (and below Z_UNUSUAL) is "larger than usual". */
export const Z_LARGER = 2;
/** A change under this share of the previous value is "little changed". */
export const LITTLE_CHANGE_PCT = 0.005;
/** For percent metrics, a change under 0.1 points (stored as 0.001) is "little changed". */
export const LITTLE_CHANGE_POINTS = 0.001;

// ------------------------------------------------------ ranking (spec §7)

export const KEY_CHANGE_WEIGHTS = {
  z: 0.45,
  size: 0.25,
  importance: 0.2,
  topShare: 0.1,
} as const;
/** |z| at which the z term is full. */
export const KEY_CHANGE_Z_FULL = 3.5;
/** |pct| at which the size term is full. */
export const KEY_CHANGE_PCT_FULL = 0.25;
/** |points| at which the size term is full, for percent metrics (5 points). */
export const KEY_CHANGE_POINTS_FULL = 0.05;
