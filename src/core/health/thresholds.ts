// Thresholds for the data health checks, from analytics-spec §3. Judgement
// calls, not tuned to make a test pass.

/** Example rows shown with a problem. */
export const EXAMPLE_ROWS = 5;

/** H1: duplicates are serious from this share of rows. */
export const DUPLICATE_SERIOUS_SHARE = 0.005;

/** H2: an identifier "looks unique" when distinct values cover this share of its rows. */
export const IDENTIFIER_UNIQUE_SHARE = 0.99;

/** H3: report empty values from this share of rows. */
export const EMPTY_FLOOR = 0.01;
/** H3: lower floor for columns the dictionary uses (D-032, Q-11). */
export const EMPTY_DICTIONARY_FLOOR = 0.001;
/** H3: serious from this share on a dictionary column. */
export const EMPTY_SERIOUS_SHARE = 0.2;

/** H4: label variants are serious from this share of rows. */
export const VARIANT_SERIOUS_SHARE = 0.02;

/** H5: values beyond median ± EXTREME_MADS × MAD_SCALE × MAD. */
export const EXTREME_MADS = 10;
export const MAD_SCALE = 1.4826;
/** H5: measured on the log scale when this share of values is above 0 (D-032). */
export const LOG_SCALE_POSITIVE_SHARE = 0.99;
/** H5: up to this many extreme rows are shown. */
export const EXTREME_EXAMPLE_ROWS = 20;

/** H6: a measure counts as non-negative when this share of values is zero or more. */
export const NON_NEGATIVE_SHARE = 0.99;

/** H9: a date column is an end date when it is on or after the time column this often. */
export const END_AFTER_START_SHARE = 0.9;

/** H10: the final period is complete with this share of the usual distinct days (§4). */
export const COMPLETE_PERIOD_SHARE = 0.9;

/** H12: reported only when rare: at most this share of rows where the other is positive. */
export const ZERO_BESIDE_POSITIVE_MAX = 0.05;
/** H12: serious from this share of rows, as for duplicates. */
export const ZERO_BESIDE_POSITIVE_SERIOUS_SHARE = 0.005;
