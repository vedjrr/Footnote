// Every knob of the "Kettle Helpdesk" support generator (analytics-spec §10.3).
// Tune these, never the ranges in truth.ts, when an effect does not come out.

export const SEED = 20261007;
export const YEAR = 2024;
export const TICKETS = 40_000;

export const TEAMS = ['Billing', 'Technical', 'Onboarding', 'Accounts'] as const;
export const TEAM_WEIGHTS = [0.25, 0.35, 0.15, 0.25];
/** Categories by team; eight in all. */
export const TEAM_CATEGORIES: { name: string; weight: number }[][] = [
  [
    { name: 'Invoices', weight: 0.6 },
    { name: 'Refunds', weight: 0.4 },
  ],
  [
    { name: 'Login issues', weight: 0.35 },
    { name: 'Bugs', weight: 0.4 },
    { name: 'Integrations', weight: 0.25 },
  ],
  [{ name: 'Setup', weight: 1 }],
  [
    { name: 'Account changes', weight: 0.6 },
    { name: 'Permissions', weight: 0.4 },
  ],
];
export const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export const PRIORITY_WEIGHTS = [0.25, 0.5, 0.18, 0.07];
/** First-response target by priority, in minutes. A breach is a response later than this. */
export const SLA_MINUTES = [1440, 480, 120, 30];
/** Typical resolution time by priority, in hours (lognormal median). */
export const RESOLUTION_HOURS = [40, 20, 8, 3];
export const RESOLUTION_SIGMA = 0.8;
export const CHANNELS = ['Email', 'Chat', 'Phone'] as const;
export const CHANNEL_WEIGHTS = [0.5, 0.35, 0.15];

/** Tickets per day relative to a normal weekday, Sunday first. T3: Monday is 1.4. */
export const WEEKDAY_FACTOR = [0.3, 1.4, 1, 1, 1, 1, 0.35];
/** Day-to-day noise on ticket counts (standard deviation, as a fraction). */
export const DAY_NOISE = 0.05;
/** Tickets by hour of day (0 to 23). */
export const HOUR_WEIGHTS = [
  1, 1, 1, 1, 1, 2, 3, 5, 8, 10, 10, 10, 9, 9, 10, 10, 9, 8, 6, 5, 4, 3, 2, 1,
];

/** Share of breaches by team before T1; allocated exactly per team and month. */
export const BREACH_RATE = [0.07, 0.08, 0.09, 0.06];
/** T1: from 2 December, the Technical team breaches at this rate. */
export const T1 = { from: '2024-12-02', team: 'Technical', rate: 0.22 };

/** CSAT score shares for 1 to 5. Allocated exactly per category and month. */
export const CSAT_SHARES = [0.04, 0.06, 0.12, 0.33, 0.45];
/** Share of resolved tickets that get a rating. */
export const RATED_SHARE = 0.41;
/** T2: November CSAT shares for "Login issues". */
export const T2 = {
  month: '2024-11',
  category: 'Login issues',
  shares: [0.12, 0.13, 0.18, 0.29, 0.28],
};

/** T4: one day with this many times the normal volume. */
export const T4 = { date: '2024-07-18', factor: 3.5 };

/** Tickets left open: a small base share, and more in the last days of the year. */
export const OPEN_SHARE = 0.005;
export const OPEN_LATE = { from: '2024-12-24', share: 0.25 };
export const REOPENED_SHARE = 0.05;

/** T5: data problems. */
export const T5 = { resolvedBeforeCreatedShare: 0.015, repeatedIdShare: 0.004 };
