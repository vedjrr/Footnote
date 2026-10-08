// The planted effects of the support sample (analytics-spec §10.3): each one's
// range, read from the spec's wording, and the query that measures it. The
// ranges were set before the generator was tuned (decisions.md D-023).

import { mixRate, type Check, type Effect, type HealthExpectation, type Segment } from '../truth';
import * as P from './params';

const pct = (x: number): number => x * 100;

export const SUMMARY_CHECKS: Check[] = [
  { key: 'rows', label: 'Rows (tickets, repeated ids included)', min: 38_000, max: 42_000 },
  { key: 'days', label: 'Distinct days with tickets', min: 366, max: 366 },
];

export const summarySql = `SELECT count(*) AS rows, count(DISTINCT CAST(created_at AS DATE)) AS days FROM tickets`;

const TEAM_CASE = `CASE team WHEN 'Billing' THEN 0 WHEN 'Technical' THEN 1 WHEN 'Onboarding' THEN 2 ELSE 3 END`;

export const SUPPORT_EFFECTS: Effect[] = [
  {
    id: 'T1',
    spec: 'From 2 December 2024: SLA breach rate in the Technical team rises from about 8% to about 22%. Other teams flat. A rate effect',
    briefing: true,
    parameters: { ...P.T1, breachRate: P.BREACH_RATE },
    checks: [
      {
        key: 'technical_before_pct',
        label: 'Technical breach rate, November 2024 (%)',
        min: 6,
        max: 10,
      },
      {
        key: 'technical_after_pct',
        label: 'Technical breach rate, 2 to 31 December 2024 (%)',
        min: 19,
        max: 25,
      },
      {
        key: 'max_other_team_change_pts',
        label: 'Largest change in another team’s breach rate, same periods (points)',
        max: 2,
      },
      {
        key: 'mix_over_rate',
        label: '|mix| / |rate| for breach rate by team (mostly rate at 0.5 or less, §6.2)',
        max: 0.5,
      },
    ],
    async measure(q) {
      const rows = await q(`
        SELECT ${TEAM_CASE} AS team, CASE WHEN created_at >= TIMESTAMP '2024-12-02' THEN 1 ELSE 0 END AS after,
          sum(CAST(sla_breached AS INTEGER)) AS breached, count(*) AS tickets
        FROM tickets
        WHERE (created_at >= TIMESTAMP '2024-11-01' AND created_at < TIMESTAMP '2024-12-01')
           OR created_at >= TIMESTAMP '2024-12-02'
        GROUP BY ALL`);
      const teams = new Map<number, Segment>();
      for (const r of rows) {
        const s = teams.get(r.team) ?? { n0: 0, d0: 0, n1: 0, d1: 0 };
        if (r.after) Object.assign(s, { n1: r.breached, d1: r.tickets });
        else Object.assign(s, { n0: r.breached, d0: r.tickets });
        teams.set(r.team, s);
      }
      const technical = teams.get(1)!;
      const others = [0, 2, 3].map((k) => teams.get(k)!);
      const split = mixRate([...teams.values()]);
      return {
        technical_before_pct: pct(technical.n0 / technical.d0),
        technical_after_pct: pct(technical.n1 / technical.d1),
        max_other_team_change_pts: pct(
          Math.max(...others.map((s) => Math.abs(s.n1 / s.d1 - s.n0 / s.d0))),
        ),
        overall_change_pts: pct(split.change),
        mix_over_rate: Math.abs(split.mix) / Math.abs(split.rate),
      };
    },
  },
  {
    id: 'T2',
    spec: 'November 2024: CSAT for "Login issues" falls by about 0.6',
    briefing: false,
    parameters: { ...P.T2, usualShares: P.CSAT_SHARES },
    checks: [
      {
        key: 'login_change',
        label: 'Login issues mean CSAT, November against January to October 2024',
        min: -0.8,
        max: -0.4,
      },
      {
        key: 'max_other_category_change',
        label: 'Largest change for another category, same periods',
        max: 0.2,
      },
    ],
    async measure(q) {
      const rows = await q(`
        SELECT category = 'Login issues' AS login, category,
          avg(csat) FILTER (WHERE created_at >= TIMESTAMP '2024-11-01' AND created_at < TIMESTAMP '2024-12-01') AS nov,
          avg(csat) FILTER (WHERE created_at < TIMESTAMP '2024-11-01') AS usual
        FROM tickets GROUP BY ALL`);
      const login = rows.find((r) => r.login === 1)!;
      const others = rows.filter((r) => r.login === 0);
      return {
        login_nov: login.nov,
        login_usual: login.usual,
        login_change: login.nov - login.usual,
        max_other_category_change: Math.max(...others.map((r) => Math.abs(r.nov - r.usual))),
      };
    },
  },
  {
    id: 'T3',
    spec: 'Mondays carry about 40% more tickets than other weekdays. This must not be reported as unusual',
    briefing: false,
    parameters: { weekdayFactor: P.WEEKDAY_FACTOR, dayNoise: P.DAY_NOISE },
    checks: [
      {
        key: 'monday_over_other_weekdays',
        label: 'Mean tickets on a Monday over the mean on Tuesday to Friday',
        min: 1.3,
        max: 1.5,
      },
    ],
    async measure(q) {
      const [r] = await q(`
        WITH d AS (SELECT CAST(created_at AS DATE) AS day, count(*) AS n FROM tickets GROUP BY ALL)
        SELECT avg(n) FILTER (WHERE dayofweek(day) = 1) AS monday,
          avg(n) FILTER (WHERE dayofweek(day) BETWEEN 2 AND 5 AND day <> DATE '${P.T4.date}') AS weekday
        FROM d`);
      return { monday_over_other_weekdays: r.monday / r.weekday };
    },
  },
  {
    id: 'T4',
    spec: '18 July 2024: ticket volume is about 3.5 times normal for one day',
    briefing: true,
    parameters: { ...P.T4 },
    checks: [
      {
        key: 'spike_over_usual',
        label: 'Tickets on 18 July 2024 over the mean of the other Thursdays',
        min: 3,
        max: 4,
      },
    ],
    async measure(q) {
      const [r] = await q(`
        WITH d AS (SELECT CAST(created_at AS DATE) AS day, count(*) AS n FROM tickets GROUP BY ALL)
        SELECT max(n) FILTER (WHERE day = DATE '${P.T4.date}') AS spike,
          avg(n) FILTER (WHERE dayofweek(day) = 4 AND day <> DATE '${P.T4.date}') AS usual
        FROM d`);
      return {
        spike_tickets: r.spike,
        usual_thursday: r.usual,
        spike_over_usual: r.spike / r.usual,
      };
    },
  },
  {
    id: 'T5',
    spec: 'Data problems: 1.5% of tickets resolved before they were created; 0.4% repeated ticket_id. Empty csat is expected and must be described as "rated tickets only", not as a problem',
    briefing: true,
    parameters: { ...P.T5, ratedShare: P.RATED_SHARE },
    checks: [
      {
        key: 'resolved_before_created_pct',
        label: 'Tickets with resolved_at before created_at (%)',
        min: 1.3,
        max: 1.7,
      },
      {
        key: 'repeated_id_pct',
        label: 'Rows whose ticket_id appeared on an earlier row (%)',
        min: 0.3,
        max: 0.5,
      },
      { key: 'csat_empty_pct', label: 'Tickets with csat empty (%)', min: 55, max: 65 },
    ],
    async measure(q) {
      const [r] = await q(`
        SELECT count(*) AS rows,
          count(*) FILTER (WHERE resolved_at < created_at) AS early,
          count(*) - count(DISTINCT ticket_id) AS repeated,
          count(*) FILTER (WHERE csat IS NULL) AS unrated
        FROM tickets`);
      return {
        resolved_before_created_pct: pct(r.early / r.rows),
        repeated_id_pct: pct(r.repeated / r.rows),
        csat_empty_pct: pct(r.unrated / r.rows),
      };
    },
  },
];

/** What the health checks report on this sample (T13): planted, or accepted with a reason. */
export const SUPPORT_HEALTH: HealthExpectation[] = [
  {
    check: 'H9',
    columns: ['created_at', 'resolved_at'],
    effect: 'T5',
    reason: 'Planted: 1.5% of tickets resolved before they were created.',
  },
  {
    check: 'H2',
    columns: ['ticket_id'],
    effect: 'T5',
    reason: 'Planted: 0.4% repeated ticket_id.',
  },
  {
    check: 'H3',
    columns: ['csat'],
    effect: 'T5',
    reason: 'Planted: csat empty for about 60%, reported as information (rated tickets only).',
  },
  {
    check: 'H3',
    columns: ['resolved_at'],
    reason: 'Accepted: open tickets have no resolved_at; 1.0% of tickets are open.',
  },
  {
    check: 'H3',
    columns: ['resolution_hours'],
    reason: 'Accepted: open tickets have no resolution time; reported as information.',
  },
  {
    check: 'H5',
    columns: ['resolution_hours'],
    reason:
      'Accepted: the T5 rows give 1.5% negative resolution times, so the long right tail is ' +
      'judged on the linear scale and its far end is reported as extreme.',
  },
];
