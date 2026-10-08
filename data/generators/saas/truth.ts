// The planted effects of the subscriptions sample (analytics-spec §10.2): each
// one's range, read from the spec's wording, and the query that measures it.
// The ranges were set before the generator was tuned (decisions.md D-023).

import { mixRate, type Check, type Effect, type HealthExpectation, type Segment } from '../truth';
import * as P from './params';

const pct = (x: number): number => x * 100;

export const SUMMARY_CHECKS: Check[] = [
  { key: 'rows', label: 'Rows (account-months)', min: 50_000, max: 60_000 },
  { key: 'accounts', label: 'Distinct accounts', min: 3_200, max: 3_800 },
  { key: 'months', label: 'Distinct months', min: 24, max: 24 },
];

export const summarySql = `SELECT count(*) AS rows, count(DISTINCT account_id) AS accounts, count(DISTINCT month) AS months FROM subscriptions`;

const PLAN_CASE = `CASE plan WHEN 'Starter' THEN 0 WHEN 'Team' THEN 1 WHEN 'Business' THEN 2 ELSE 3 END`;

export const SAAS_EFFECTS: Effect[] = [
  {
    id: 'S1',
    spec: 'December 2024: churn rate on the Starter plan about doubles on November. Other plans unchanged. A rate effect',
    briefing: true,
    parameters: { ...P.S1, planChurn: P.PLAN_CHURN },
    checks: [
      {
        key: 'starter_dec_over_nov',
        label: 'Starter churn rate, December 2024 over November 2024',
        min: 1.7,
        max: 2.3,
      },
      {
        key: 'max_other_plan_change_pts',
        label: 'Largest change in another plan’s churn rate, Dec on Nov (points)',
        max: 0.5,
      },
      {
        key: 'mix_over_rate',
        label: '|mix| / |rate| for churn by plan (mostly rate at 0.5 or less, §6.2)',
        max: 0.5,
      },
    ],
    async measure(q) {
      const rows = await q(`
        SELECT ${PLAN_CASE} AS plan, CASE WHEN month = DATE '2024-12-01' THEN 1 ELSE 0 END AS dec,
          sum(CAST(is_churned AS INTEGER)) AS churned, count(*) AS accounts
        FROM subscriptions WHERE month IN (DATE '2024-11-01', DATE '2024-12-01')
        GROUP BY ALL`);
      const plans = new Map<number, Segment>();
      for (const r of rows) {
        const s = plans.get(r.plan) ?? { n0: 0, d0: 0, n1: 0, d1: 0 };
        if (r.dec) Object.assign(s, { n1: r.churned, d1: r.accounts });
        else Object.assign(s, { n0: r.churned, d0: r.accounts });
        plans.set(r.plan, s);
      }
      const rate = (s: Segment, after: boolean) => (after ? s.n1 / s.d1 : s.n0 / s.d0);
      const starter = plans.get(0)!;
      const others = [1, 2, 3].map((k) => plans.get(k)!);
      const split = mixRate([...plans.values()]);
      return {
        starter_nov_pct: pct(rate(starter, false)),
        starter_dec_pct: pct(rate(starter, true)),
        starter_dec_over_nov: rate(starter, true) / rate(starter, false),
        max_other_plan_change_pts: pct(
          Math.max(...others.map((s) => Math.abs(rate(s, true) - rate(s, false)))),
        ),
        overall_change_pts: pct(split.change),
        mix_over_rate: Math.abs(split.mix) / Math.abs(split.rate),
      };
    },
  },
  {
    id: 'S2',
    spec: 'Through 2024, most of the MRR growth comes from Enterprise accounts adding seats',
    briefing: false,
    parameters: { enterpriseSeatGrowth: P.ENTERPRISE_SEAT_GROWTH, planPrice: P.PLAN_PRICE },
    checks: [
      { key: 'mrr_growth_pct', label: 'MRR, December 2024 on December 2023 (%)', min: 5 },
      {
        key: 'enterprise_expansion_share',
        label: 'Share of that growth from seats added by Enterprise accounts active in both months',
        min: 0.5,
        max: 1,
      },
    ],
    async measure(q) {
      const [r] = await q(`
        WITH d AS (
          SELECT account_id, plan, month, CAST(mrr AS DOUBLE) AS mrr FROM subscriptions
          WHERE month IN (DATE '2023-12-01', DATE '2024-12-01'))
        SELECT
          sum(mrr) FILTER (WHERE month = DATE '2023-12-01') AS t0,
          sum(mrr) FILTER (WHERE month = DATE '2024-12-01') AS t1,
          (SELECT sum(b.mrr - a.mrr) FROM d a JOIN d b USING (account_id)
            WHERE a.month = DATE '2023-12-01' AND b.month = DATE '2024-12-01' AND a.plan = 'Enterprise') AS expansion
        FROM d`);
      return {
        mrr_growth_pct: pct(r.t1 / r.t0 - 1),
        enterprise_expansion: r.expansion,
        enterprise_expansion_share: r.expansion / (r.t1 - r.t0),
      };
    },
  },
  {
    id: 'S3',
    spec: 'Paid search brings about 35% of new accounts but they churn about twice as fast',
    briefing: false,
    parameters: {
      channelNewShare: P.CHANNEL_NEW_SHARE,
      channelChurnWeight: P.CHANNEL_CHURN_WEIGHT,
    },
    checks: [
      {
        key: 'paid_share_of_new_pct',
        label: 'Share of new accounts from Paid search (%)',
        min: 30,
        max: 40,
      },
      {
        key: 'churn_ratio',
        label: 'Monthly churn rate, Paid search over the other channels',
        min: 1.7,
        max: 2.3,
      },
    ],
    async measure(q) {
      const [r] = await q(`
        SELECT
          count(*) FILTER (WHERE is_new AND signup_channel = 'Paid search') / count(*) FILTER (WHERE is_new) AS paid_share,
          avg(CAST(is_churned AS INTEGER)) FILTER (WHERE signup_channel = 'Paid search') AS paid_churn,
          avg(CAST(is_churned AS INTEGER)) FILTER (WHERE signup_channel <> 'Paid search') AS other_churn
        FROM subscriptions`);
      return {
        paid_share_of_new_pct: pct(r.paid_share),
        paid_churn_pct: pct(r.paid_churn),
        other_churn_pct: pct(r.other_churn),
        churn_ratio: r.paid_churn / r.other_churn,
      };
    },
  },
  {
    id: 'S4',
    spec: 'APAC MRR is flat across 2024 while the other regions grow',
    briefing: false,
    parameters: { ...P.S4 },
    checks: [
      {
        key: 'apac_change_pct',
        label: 'APAC MRR, December 2024 on December 2023 (%)',
        min: -3,
        max: 3,
      },
      {
        key: 'apac_max_monthly_gap_pct',
        label: 'Largest gap between an APAC month in 2024 and its 2024 mean (%)',
        max: 5,
      },
      {
        key: 'min_other_change_pct',
        label: 'Slowest other region, December 2024 on December 2023 (%)',
        min: 8,
      },
    ],
    async measure(q) {
      const rows = await q(`
        SELECT CASE region WHEN 'EMEA' THEN 0 WHEN 'Americas' THEN 1 ELSE 2 END AS region,
          datediff('month', DATE '2023-12-01', month) AS t, sum(CAST(mrr AS DOUBLE)) AS mrr
        FROM subscriptions WHERE month >= DATE '2023-12-01' GROUP BY ALL`);
      // t = 0 is December 2023, t = 1 to 12 are the months of 2024.
      const series = [0, 1, 2].map((region) => {
        const m: number[] = [];
        for (const r of rows.filter((x) => x.region === region)) m[r.t] = r.mrr;
        return m;
      });
      const change = (m: number[]) => m[12] / m[0] - 1;
      const apac = series[2];
      const months2024 = apac.slice(1);
      const mean = months2024.reduce((a, x) => a + x, 0) / months2024.length;
      return {
        apac_change_pct: pct(change(apac)),
        apac_max_monthly_gap_pct: pct(Math.max(...months2024.map((x) => Math.abs(x / mean - 1)))),
        emea_change_pct: pct(change(series[0])),
        americas_change_pct: pct(change(series[1])),
        min_other_change_pct: pct(Math.min(change(series[0]), change(series[1]))),
      };
    },
  },
  {
    id: 'S5',
    spec: "MRR is a snapshot metric: the 2024 figure is December's, not the sum of twelve months",
    briefing: false,
    parameters: {},
    checks: [
      {
        key: 'unique_account_month_pct',
        label: 'Rows whose (account_id, month) pair is unique (%; §2.7 needs 99 or more)',
        min: 100,
        max: 100,
      },
      {
        key: 'sum_over_december',
        label: 'Sum of 2024 monthly MRR over December 2024 MRR (what summing would overstate)',
        min: 10,
        max: 12.5,
      },
    ],
    async measure(q) {
      const [r] = await q(`
        SELECT
          (SELECT count(*) FROM (SELECT account_id, month FROM subscriptions GROUP BY ALL HAVING count(*) = 1)) / count(*) AS unique_share,
          sum(CAST(mrr AS DOUBLE)) FILTER (WHERE month = DATE '2024-12-01') AS december,
          sum(CAST(mrr AS DOUBLE)) FILTER (WHERE year(month) = 2024) AS year_sum
        FROM subscriptions`);
      return {
        unique_account_month_pct: pct(r.unique_share),
        mrr_2024: r.december,
        sum_over_december: r.year_sum / r.december,
      };
    },
  },
  {
    id: 'S6',
    spec: 'Data problems: 0.6% of rows have seats 0 with mrr above 0; industry empty in 2%',
    briefing: true,
    parameters: { ...P.S6 },
    checks: [
      {
        key: 'zero_seats_pct',
        label: 'Rows with seats 0 and mrr above 0 (%)',
        min: 0.5,
        max: 0.7,
      },
      { key: 'empty_industry_pct', label: 'Rows with industry empty (%)', min: 1.5, max: 2.5 },
    ],
    async measure(q) {
      const [r] = await q(`
        SELECT
          count(*) FILTER (WHERE seats = 0 AND mrr > 0) / count(*) AS zero_seats,
          count(*) FILTER (WHERE industry IS NULL OR trim(industry) = '') / count(*) AS empty_industry
        FROM subscriptions`);
      return {
        zero_seats_pct: pct(r.zero_seats),
        empty_industry_pct: pct(r.empty_industry),
      };
    },
  },
];

/** What the health checks report on this sample (T13): planted, or accepted with a reason. */
export const SAAS_HEALTH: HealthExpectation[] = [
  {
    check: 'H12',
    columns: ['seats', 'mrr'],
    effect: 'S6',
    reason: 'Planted: 0.6% of rows have seats 0 with mrr above 0.',
  },
  { check: 'H3', columns: ['industry'], effect: 'S6', reason: 'Planted: industry empty in 2%.' },
];
