// The "Slotwise" subscriptions generator (analytics-spec §10.2). Pure: the
// same seed gives the same rows. Accounts are simulated month by month and the
// table is a true snapshot: one row per account per month while it is active.
// Churn counts are allocated per plan and month, so S1 is not lost in noise.

import { allocate, createRng, weightedPicker, type Rng } from '../rng';
import * as P from './params';

export interface SubscriptionRow {
  month: string;
  account_id: string;
  plan: string;
  region: string;
  industry: string | null;
  signup_channel: string;
  seats: number;
  mrr: number;
  is_new: boolean;
  is_churned: boolean;
}

interface Account {
  id: string;
  plan: number;
  region: number;
  industry: number | null;
  channel: number;
  seats: number;
  /** Month index of the account's first row. */
  start: number;
  isInitial: boolean;
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

function monthKey(t: number): { year: number; key: string } {
  const index = P.FIRST_MONTH.month - 1 + t;
  const year = P.FIRST_MONTH.year + Math.floor(index / 12);
  return { year, key: `${year}-${pad((index % 12) + 1, 2)}` };
}

/** Rounds up with probability equal to the fraction, so small growth still adds up. */
const stochasticRound = (rng: Rng, x: number): number => {
  const floor = Math.floor(x);
  return floor + (rng.next() < x - floor ? 1 : 0);
};

/** Picks `k` items without replacement, each in proportion to its weight. */
function pickWeighted<T>(rng: Rng, items: T[], weight: (item: T) => number, k: number): T[] {
  return items
    .map((item) => ({ item, key: Math.log(1 - rng.next()) / weight(item) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map(({ item }) => item);
}

export function generateSubscriptions(seed: number = P.SEED): SubscriptionRow[] {
  const rng = createRng(seed);
  const pickRegion = weightedPicker(P.REGION_WEIGHTS);
  const pickIndustry = weightedPicker(P.INDUSTRY_WEIGHTS);
  const pickChannel = weightedPicker(P.CHANNEL_NEW_SHARE);
  // Accounts that survived to January 2023 under-represent fast-churning channels.
  const pickInitialChannel = weightedPicker(
    P.CHANNEL_NEW_SHARE.map((s, i) => s / P.CHANNEL_CHURN_WEIGHT[i]),
  );
  // ...and fast-churning plans.
  const initialPlans = allocate(
    P.INITIAL_ACCOUNTS,
    P.PLAN_NEW_SHARE.map((s, i) => s / P.PLAN_CHURN[i]),
  );

  let nextId = 1;
  const open = (plan: number, start: number, isInitial: boolean): Account => {
    const s = P.PLAN_SEATS[plan];
    const seats = Math.round(s.mean * Math.exp(s.sigma * rng.normal() - s.sigma ** 2 / 2));
    return {
      id: `SW-${pad(nextId++, 5)}`,
      plan,
      region: pickRegion(rng),
      industry: rng.next() < P.S6.emptyIndustryShare ? null : pickIndustry(rng),
      channel: isInitial ? pickInitialChannel(rng) : pickChannel(rng),
      seats: Math.min(s.max, Math.max(s.min, seats)),
      start,
      isInitial,
    };
  };

  let active: Account[] = [];
  initialPlans.forEach((n, plan) => {
    for (let i = 0; i < n; i++) active.push(open(plan, 0, true));
  });

  const rows: SubscriptionRow[] = [];
  for (let t = 0; t < P.MONTHS; t++) {
    const { year, key } = monthKey(t);

    // Seats move on existing accounts.
    for (const a of active) {
      if (P.PLANS[a.plan] === 'Enterprise') {
        const growth =
          P.REGIONS[a.region] === P.S4.region && year === P.S4.year
            ? P.S4.seatGrowth
            : (P.ENTERPRISE_SEAT_GROWTH[year] ?? 0);
        a.seats = stochasticRound(rng, a.seats * (1 + growth * (1 + 0.5 * rng.normal())));
        a.seats = Math.max(P.PLAN_SEATS[a.plan].min, a.seats);
      } else {
        const r = rng.next();
        const { min, max } = P.PLAN_SEATS[a.plan];
        if (r < P.SEAT_DRIFT) a.seats = Math.min(max * 2, a.seats + 1);
        else if (r < 2 * P.SEAT_DRIFT) a.seats = Math.max(min, a.seats - 1);
      }
    }

    // New accounts, a fixed number per plan.
    allocate(P.NEW_PER_MONTH, P.PLAN_NEW_SHARE).forEach((n, plan) => {
      for (let i = 0; i < n; i++) active.push(open(plan, t, false));
    });

    // Churners: an exact count per plan, chosen with the channel's weight.
    const churned = new Set<Account>();
    P.PLANS.forEach((name, plan) => {
      const eligible = active.filter((a) => a.plan === plan && (a.start < t || a.isInitial));
      const factor = key === P.S1.month && name === P.S1.plan ? P.S1.factor : 1;
      const k = Math.round(eligible.length * P.PLAN_CHURN[plan] * factor);
      for (const a of pickWeighted(rng, eligible, (x) => P.CHANNEL_CHURN_WEIGHT[x.channel], k)) {
        churned.add(a);
      }
    });
    // A churner's final row is this month's, with is_churned true.
    for (const a of active) {
      rows.push({
        month: `${key}-01`,
        account_id: a.id,
        plan: P.PLANS[a.plan],
        region: P.REGIONS[a.region],
        industry: a.industry === null ? null : P.INDUSTRIES[a.industry],
        signup_channel: P.CHANNELS[a.channel],
        seats: a.seats,
        mrr: a.seats * P.PLAN_PRICE[a.plan],
        is_new: !a.isInitial && a.start === t,
        is_churned: churned.has(a),
      });
    }
    active = active.filter((a) => !churned.has(a));
  }

  plantZeroSeats(rng, rows);
  return rows;
}

/** S6: seats 0 while mrr stays above 0. */
function plantZeroSeats(rng: Rng, rows: SubscriptionRow[]): void {
  const k = Math.round(rows.length * P.S6.zeroSeatsShare);
  const indices = rng.shuffle(Array.from({ length: rows.length }, (_, i) => i)).slice(0, k);
  for (const i of indices) rows[i].seats = 0;
}
