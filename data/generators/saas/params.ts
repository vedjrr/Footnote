// Every knob of the "Slotwise" subscriptions generator (analytics-spec §10.2).
// Tune these, never the ranges in truth.ts, when an effect does not come out.

export const SEED = 20261006;
export const FIRST_MONTH = { year: 2023, month: 1 };
export const MONTHS = 24; // 2023-01 to 2024-12

/** Accounts already active in January 2023 (is_new false in their first row). */
export const INITIAL_ACCOUNTS = 2_250;
/** New accounts per month. About equal to monthly churn, so the count stays flat. */
export const NEW_PER_MONTH = 52;

export const PLANS = ['Starter', 'Team', 'Business', 'Enterprise'] as const;
export const REGIONS = ['EMEA', 'Americas', 'APAC'] as const;
export const INDUSTRIES = [
  'Software',
  'Retail',
  'Healthcare',
  'Financial services',
  'Education',
  'Manufacturing',
] as const;
export const CHANNELS = ['Organic', 'Paid search', 'Partner', 'Outbound'] as const;

/** Share of new accounts by plan. */
export const PLAN_NEW_SHARE = [0.45, 0.3, 0.17, 0.08];
/** Monthly churn rate by plan. Counts are allocated, not sampled. */
export const PLAN_CHURN = [0.035, 0.022, 0.015, 0.008];
/** Price per seat per month by plan. mrr = seats * price. */
export const PLAN_PRICE = [15, 25, 40, 55];
/** Seats at signup by plan: lognormal around `mean`, clamped to [min, max]. */
export const PLAN_SEATS = [
  { mean: 3, sigma: 0.4, min: 1, max: 5 },
  { mean: 10, sigma: 0.35, min: 5, max: 20 },
  { mean: 30, sigma: 0.35, min: 15, max: 60 },
  { mean: 110, sigma: 0.35, min: 50, max: 400 },
];
/** Chance per month that a non-Enterprise account adds or drops one seat (each). */
export const SEAT_DRIFT = 0.04;

export const REGION_WEIGHTS = [0.4, 0.4, 0.2];
export const INDUSTRY_WEIGHTS = [0.25, 0.15, 0.15, 0.15, 0.15, 0.15];

/** S3: share of new accounts by channel, and how much faster each churns. */
export const CHANNEL_NEW_SHARE = [0.3, 0.35, 0.15, 0.2];
export const CHANNEL_CHURN_WEIGHT = [1, 2, 1, 1];

/**
 * S2 and S4: monthly seat growth of Enterprise accounts, by year. In 2024 APAC
 * grows only enough to offset the seats its churned accounts take away.
 */
export const ENTERPRISE_SEAT_GROWTH: Record<number, number> = { 2023: 0.004, 2024: 0.03 };
export const S4 = { region: 'APAC', year: 2024, seatGrowth: 0.007 };

/** S1: in December 2024 the Starter churn rate is multiplied by this. */
export const S1 = { month: '2024-12', plan: 'Starter', factor: 2 };

/** S6: data problems. */
export const S6 = { zeroSeatsShare: 0.006, emptyIndustryShare: 0.02 };
