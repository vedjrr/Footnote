// The planted effects of the retail sample (analytics-spec §10.1): each one's
// range, read from the spec's wording, and the query that measures it. The
// ranges were set before the generator was tuned (decisions.md D-023).

import { mixRate, type Effect, type HealthExpectation, type Segment } from '../truth';
import * as P from './params';

const pct = (x: number): number => x * 100;

export const SUMMARY_CHECKS = [
  { key: 'rows', label: 'Rows, duplicates included', min: 55_000, max: 65_000 },
  { key: 'customers', label: 'Distinct customers', min: 5_500, max: 6_500 },
];

export const summarySql = `SELECT count(*) AS rows, count(DISTINCT customer_id) AS customers FROM orders`;

export const RETAIL_EFFECTS: Effect[] = [
  {
    id: 'R1',
    spec: 'March 2025: Electronics revenue falls about 30% on February, almost all in Online in the West, where it falls about 75%. Total revenue falls 6% to 9%',
    briefing: true,
    parameters: { ...P.R1 },
    checks: [
      {
        key: 'electronics_change_pct',
        label: 'Electronics revenue, March on February (%)',
        min: -35,
        max: -25,
      },
      {
        key: 'online_west_change_pct',
        label: 'Electronics Online West revenue, March on February (%)',
        min: -80,
        max: -70,
      },
      {
        key: 'online_west_share_of_fall',
        label: "Online West's share of the Electronics fall",
        min: 0.8,
        max: 1.1,
      },
      { key: 'total_change_pct', label: 'Total revenue, March on February (%)', min: -9, max: -6 },
    ],
    async measure(q) {
      const [r] = await q(`
        WITH m AS (
          SELECT strftime(order_date, '%Y-%m') AS month, category, region, channel, CAST(revenue AS DOUBLE) AS revenue
          FROM orders WHERE order_date >= DATE '2025-02-01' AND order_date < DATE '2025-04-01')
        SELECT
          sum(revenue) FILTER (WHERE month = '2025-02') AS t0,
          sum(revenue) FILTER (WHERE month = '2025-03') AS t1,
          sum(revenue) FILTER (WHERE month = '2025-02' AND category = 'Electronics') AS e0,
          sum(revenue) FILTER (WHERE month = '2025-03' AND category = 'Electronics') AS e1,
          sum(revenue) FILTER (WHERE month = '2025-02' AND category = 'Electronics' AND region = 'West' AND channel = 'Online') AS w0,
          sum(revenue) FILTER (WHERE month = '2025-03' AND category = 'Electronics' AND region = 'West' AND channel = 'Online') AS w1
        FROM m`);
      return {
        electronics_change_pct: pct(r.e1 / r.e0 - 1),
        online_west_change_pct: pct(r.w1 / r.w0 - 1),
        online_west_share_of_fall: (r.w0 - r.w1) / (r.e0 - r.e1),
        total_change_pct: pct(r.t1 / r.t0 - 1),
      };
    },
  },
  {
    id: 'R2',
    spec: 'From October 2024: Furniture discounts rise in every segment, so Furniture margin falls about 4 points. A rate effect',
    briefing: false,
    parameters: { ...P.R2 },
    checks: [
      {
        key: 'margin_change_pts',
        label: 'Furniture margin, Oct 2024 to Mar 2025 against Apr to Sep 2024 (points)',
        min: -5,
        max: -3,
      },
      {
        key: 'min_segment_discount_rise_pts',
        label: 'Smallest rise in mean Furniture discount across segments (points)',
        min: 3,
      },
      {
        key: 'mix_over_rate',
        label: '|mix| / |rate| for margin by segment (mostly rate at 0.5 or less, §6.2)',
        max: 0.5,
      },
    ],
    async measure(q) {
      const rows = await q(`
        SELECT
          CASE customer_segment WHEN 'Consumer' THEN 0 WHEN 'Small business' THEN 1 WHEN 'Corporate' THEN 2 ELSE 3 END AS segment,
          CASE WHEN order_date >= DATE '2024-10-01' THEN 1 ELSE 0 END AS after,
          sum(CAST(revenue - cost AS DOUBLE)) AS profit,
          sum(CAST(revenue AS DOUBLE)) AS revenue,
          avg(discount_pct) AS discount
        FROM orders
        WHERE category = 'Furniture' AND order_date >= DATE '2024-04-01' AND order_date < DATE '2025-04-01'
        GROUP BY ALL`);
      const segments = new Map<number, Segment & { disc0: number; disc1: number }>();
      for (const r of rows) {
        const s = segments.get(r.segment) ?? { n0: 0, d0: 0, n1: 0, d1: 0, disc0: 0, disc1: 0 };
        if (r.after) Object.assign(s, { n1: r.profit, d1: r.revenue, disc1: r.discount });
        else Object.assign(s, { n0: r.profit, d0: r.revenue, disc0: r.discount });
        segments.set(r.segment, s);
      }
      const named = [0, 1, 2].map((k) => segments.get(k)!);
      const { mix, rate, change } = mixRate([...segments.values()]);
      return {
        margin_change_pts: pct(change),
        min_segment_discount_rise_pts: Math.min(...named.map((s) => s.disc1 - s.disc0)),
        mix_pts: pct(mix),
        rate_pts: pct(rate),
        mix_over_rate: Math.abs(mix) / Math.abs(rate),
      };
    },
  },
  {
    id: 'R3',
    spec: 'December 2024: return rate for the Headphones sub-category is about three times its usual level',
    briefing: false,
    parameters: { ...P.R3 },
    checks: [
      {
        key: 'ratio_to_usual',
        label: 'Headphones return rate, Dec 2024 over all other months',
        min: 2.5,
        max: 3.5,
      },
    ],
    async measure(q) {
      const [r] = await q(`
        SELECT
          avg(CAST(returned AS INTEGER)) FILTER (WHERE strftime(order_date, '%Y-%m') = '2024-12') AS dec,
          avg(CAST(returned AS INTEGER)) FILTER (WHERE strftime(order_date, '%Y-%m') <> '2024-12') AS usual
        FROM orders WHERE sub_category = 'Headphones'`);
      return {
        dec_2024_rate_pct: pct(r.dec),
        usual_rate_pct: pct(r.usual),
        ratio_to_usual: r.dec / r.usual,
      };
    },
  },
  {
    id: 'R4',
    spec: 'November and December are about 35% above the monthly average in both years; underlying growth about 8% a year',
    briefing: false,
    parameters: {
      growthPerYear: P.GROWTH_PER_YEAR,
      peakMonths: P.PEAK_MONTHS,
      peakFactor: P.PEAK_FACTOR,
    },
    checks: [
      {
        key: 'peak_lift_2023_pct',
        label: 'Nov and Dec 2023 against the 2023 monthly average (%)',
        min: 30,
        max: 40,
      },
      {
        key: 'peak_lift_2024_pct',
        label: 'Nov and Dec 2024 against the 2024 monthly average (%)',
        min: 30,
        max: 40,
      },
      { key: 'growth_2024_pct', label: 'Revenue 2024 on 2023 (%)', min: 5, max: 11 },
    ],
    async measure(q) {
      const rows = await q(`
        WITH m AS (
          SELECT year(order_date) AS y, month(order_date) AS mo, sum(CAST(revenue AS DOUBLE)) AS revenue
          FROM orders WHERE order_date < DATE '2025-01-01' GROUP BY ALL)
        SELECT y, avg(revenue) FILTER (WHERE mo IN (11, 12)) AS peak, avg(revenue) AS mean, sum(revenue) AS total
        FROM m GROUP BY y ORDER BY y`);
      const [y23, y24] = rows;
      return {
        peak_lift_2023_pct: pct(y23.peak / y23.mean - 1),
        peak_lift_2024_pct: pct(y24.peak / y24.mean - 1),
        growth_2024_pct: pct(y24.total / y23.total - 1),
      };
    },
  },
  {
    id: 'R5',
    spec: 'The top 20% of customers hold about 60% of revenue',
    briefing: true,
    parameters: {
      customers: P.CUSTOMERS,
      customerSigma: P.CUSTOMER_SIGMA,
      segmentBoost: P.SEGMENT_BOOST,
    },
    checks: [
      {
        key: 'top_20_share_pct',
        label: 'Share of revenue held by the top 20% of customers (%)',
        min: 55,
        max: 65,
      },
    ],
    async measure(q) {
      const [r] = await q(`
        WITH c AS (SELECT customer_id, sum(CAST(revenue AS DOUBLE)) AS revenue FROM orders GROUP BY ALL),
        ranked AS (SELECT revenue, row_number() OVER (ORDER BY revenue DESC, customer_id) AS rank, count(*) OVER () AS n FROM c)
        SELECT sum(revenue) FILTER (WHERE rank <= ceil(0.2 * n)) / sum(revenue) AS share FROM ranked`);
      return { top_20_share_pct: pct(r.share) };
    },
  },
  {
    id: 'R6',
    spec: 'Q4 2024: overall return rate rises about 0.6 points because Electronics, which has a higher return rate, takes a larger share. Category rates are flat. A mix effect',
    briefing: false,
    parameters: { ...P.R6 },
    checks: [
      {
        key: 'overall_change_pts',
        label: 'Return rate, Q4 2024 against Q3 2024 (points)',
        min: 0.4,
        max: 0.8,
      },
      {
        key: 'rate_over_mix',
        label: '|rate| / |mix| by category (mostly mix at 0.5 or less, §6.2)',
        max: 0.5,
      },
      {
        key: 'max_category_change_pts',
        label: 'Largest change in any category return rate (points; Electronics holds R3)',
        max: 1.5,
      },
    ],
    async measure(q) {
      const rows = await q(`
        SELECT
          CASE category WHEN 'Electronics' THEN 0 WHEN 'Furniture' THEN 1 WHEN 'Kitchen' THEN 2 WHEN 'Outdoor' THEN 3 ELSE 4 END AS category,
          CASE WHEN order_date >= DATE '2024-10-01' THEN 1 ELSE 0 END AS q4,
          sum(CAST(returned AS INTEGER)) AS returns, count(*) AS lines
        FROM orders WHERE order_date >= DATE '2024-07-01' AND order_date < DATE '2025-01-01'
        GROUP BY ALL`);
      const segments = new Map<number, Segment>();
      for (const r of rows) {
        const s = segments.get(r.category) ?? { n0: 0, d0: 0, n1: 0, d1: 0 };
        if (r.q4) Object.assign(s, { n1: r.returns, d1: r.lines });
        else Object.assign(s, { n0: r.returns, d0: r.lines });
        segments.set(r.category, s);
      }
      const { mix, rate, change } = mixRate([...segments.values()]);
      const categoryChanges = [...segments.values()].map((s) =>
        Math.abs(s.n1 / s.d1 - s.n0 / s.d0),
      );
      return {
        overall_change_pts: pct(change),
        mix_pts: pct(mix),
        rate_pts: pct(rate),
        rate_over_mix: Math.abs(rate) / Math.abs(mix),
        max_category_change_pts: pct(Math.max(...categoryChanges)),
      };
    },
  },
  {
    id: 'R7',
    spec: 'Data problems: 1.2% exact duplicate rows, most of them in the week of 10 June 2024; 0.8% of region values in lower case; 0.5% of customer_segment empty; 12 rows with negative quantity',
    briefing: true,
    parameters: { ...P.R7 },
    checks: [
      {
        key: 'duplicate_rows_pct',
        label: 'Rows that repeat an earlier row (%)',
        min: 1.0,
        max: 1.4,
      },
      {
        key: 'duplicates_in_week_pct',
        label: 'Of those, share dated 10 to 16 June 2024 (%)',
        min: 60,
      },
      {
        key: 'lowercase_region_pct',
        label: 'Rows with region in lower case (%)',
        min: 0.6,
        max: 1.0,
      },
      {
        key: 'empty_segment_pct',
        label: 'Rows with customer_segment empty (%)',
        min: 0.3,
        max: 0.7,
      },
      { key: 'negative_quantity_rows', label: 'Rows with negative quantity', min: 12, max: 12 },
    ],
    async measure(q) {
      const [r] = await q(`
        WITH d AS (SELECT *, count(*) AS copies FROM orders GROUP BY ALL)
        SELECT
          (SELECT count(*) FROM orders) AS rows,
          sum(copies - 1) AS duplicates,
          sum(copies - 1) FILTER (WHERE order_date BETWEEN DATE '2024-06-10' AND DATE '2024-06-16') AS in_week,
          (SELECT count(*) FROM orders WHERE region = lower(region)) AS lowercase,
          (SELECT count(*) FROM orders WHERE customer_segment IS NULL OR trim(customer_segment) = '') AS empty,
          (SELECT count(*) FROM orders WHERE quantity < 0) AS negative
        FROM d`);
      return {
        duplicate_rows_pct: pct(r.duplicates / r.rows),
        duplicates_in_week_pct: pct(r.in_week / r.duplicates),
        lowercase_region_pct: pct(r.lowercase / r.rows),
        empty_segment_pct: pct(r.empty / r.rows),
        negative_quantity_rows: r.negative,
      };
    },
  },
];

/** What the health checks report on this sample (T13): planted, or accepted with a reason. */
export const RETAIL_HEALTH: HealthExpectation[] = [
  { check: 'H1', columns: [], effect: 'R7', reason: 'Planted: 1.2% exact duplicate rows.' },
  {
    check: 'H4',
    columns: ['region'],
    effect: 'R7',
    reason: 'Planted: 0.8% of regions in lower case.',
  },
  {
    check: 'H3',
    columns: ['customer_segment'],
    effect: 'R7',
    reason: 'Planted: 0.5% of segments empty.',
  },
  {
    check: 'H6',
    columns: ['quantity'],
    effect: 'R7',
    reason: 'Planted: 12 rows with negative quantity.',
  },
  {
    check: 'H6',
    columns: ['revenue'],
    reason: 'Accepted: the 12 negative-quantity rows of R7 also have negative revenue.',
  },
  {
    check: 'H6',
    columns: ['cost'],
    reason: 'Accepted: the 12 negative-quantity rows of R7 also have negative cost.',
  },
];
