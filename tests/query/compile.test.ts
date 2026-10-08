// The compiler on the samples (Node adapter). Each feature is checked against
// SQL written by hand, the two classic wrong answers are shown to differ from
// what the compiler returns, `displaySql` returns the same rows as `sql` with
// `params`, and a property test runs generated specs.

import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { Cell, QueryEngine, QueryResult } from '@/core/engine/types';
import { type TimeFacts, readTimeFacts, timeFactsSql } from '@/core/findings/periods';
import type { SemanticModel } from '@/core/model/types';
import { parseModelYaml } from '@/core/model/yaml';
import { HELPERS, compile } from '@/core/query/compile';
import { type QuerySpecInput, querySpecSchema } from '@/core/query/spec';

const SAMPLES = [
  { id: 'retail', table: 'orders' },
  { id: 'saas', table: 'subscriptions' },
  { id: 'support', table: 'tickets' },
] as const;

let engine: QueryEngine;
const models = new Map<string, SemanticModel>();
const facts = new Map<string, TimeFacts>();
/** Every spec run in this file, for the displaySql check at the end. */
const ran: Array<{ id: string; spec: QuerySpecInput }> = [];

beforeAll(async () => {
  engine = await createNodeEngine();
  for (const { id, table } of SAMPLES) {
    await engine.registerFile(table, {
      kind: 'path',
      format: 'parquet',
      path: `data/demo/${id}/${table}.parquet`,
    });
    const parsed = parseModelYaml(readFileSync(`data/demo/${id}/dictionary.yaml`, 'utf8'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems));
    models.set(id, parsed.model);
    facts.set(
      id,
      readTimeFacts(await engine.query(timeFactsSql(table, parsed.model.time!.column))),
    );
  }
}, 60_000);

afterAll(async () => {
  await engine.close();
});

async function run(id: string, spec: QuerySpecInput): Promise<Record<string, Cell>[]> {
  ran.push({ id, spec });
  const c = compile(spec, models.get(id)!, { time: facts.get(id)! });
  return objects(await engine.query(c.sql, c.params));
}

function objects(result: QueryResult): Record<string, Cell>[] {
  return result.rows.map((r) => Object.fromEntries(result.columns.map((c, i) => [c.name, r[i]])));
}

async function one(sql: string): Promise<Record<string, Cell>> {
  return objects(await engine.query(sql))[0];
}

const close = (a: Cell, b: Cell) => expect(Number(a)).toBeCloseTo(Number(b), 6);

describe('features against hand-written SQL', () => {
  test('a total', async () => {
    const [row] = await run('retail', { metrics: ['revenue', 'order_lines'] });
    const want = await one('SELECT sum(revenue) AS r, count(*) AS n FROM orders');
    close(row.revenue, want.r);
    expect(row.order_lines).toBe(Number(want.n));
  });

  test('split by a dimension, filtered, sorted and limited', async () => {
    const rows = await run('retail', {
      metrics: ['revenue'],
      by: ['region'],
      filters: [{ dimension: 'channel', op: 'in', values: ['Online'] }],
      sort: { by: 'revenue', dir: 'desc' },
      limit: 3,
    });
    const want = objects(
      await engine.query(
        `SELECT region, sum(revenue) AS r FROM orders WHERE channel = 'Online'
         GROUP BY 1 ORDER BY 2 DESC LIMIT 3`,
      ),
    );
    expect(rows.map((r) => r.region)).toEqual(want.map((w) => w.region));
    rows.forEach((r, i) => close(r.revenue, want[i].r));
  });

  test('not_in keeps empty values; contains ignores case', async () => {
    const [notIn] = await run('retail', {
      metrics: ['order_lines'],
      filters: [{ dimension: 'customer_segment', op: 'not_in', values: ['Consumer'] }],
    });
    const want = await one(
      `SELECT count(*) AS n FROM orders WHERE customer_segment IS NULL OR customer_segment <> 'Consumer'`,
    );
    expect(notIn.order_lines).toBe(Number(want.n));
    const [contains] = await run('retail', {
      metrics: ['order_lines'],
      filters: [{ dimension: 'sub_category', op: 'contains', values: ['PHONE'] }],
    });
    const want2 = await one(`SELECT count(*) AS n FROM orders WHERE sub_category ILIKE '%phone%'`);
    expect(contains.order_lines).toBe(Number(want2.n));
  });

  test('a monthly series covers every month', async () => {
    const rows = await run('retail', {
      metrics: ['revenue'],
      time: { grain: 'month', range: { kind: 'all' } },
    });
    expect(rows).toHaveLength(27);
    expect(rows[0].period).toBe('2023-01-01');
    const want = await one(
      `SELECT sum(revenue) AS r FROM orders WHERE order_date BETWEEN '2025-03-01' AND '2025-03-31'`,
    );
    close(rows[26].revenue, want.r);
  });

  test('an average is the sum over the count of rows that have a value', async () => {
    const [row] = await run('support', { metrics: ['average_csat'] });
    const want = await one('SELECT sum(csat) / count(csat) AS a FROM tickets');
    close(row.average_csat, want.a);
  });

  test('a comparison with the previous month gives current, previous and the change', async () => {
    const [row] = await run('retail', {
      metrics: ['revenue'],
      time: { range: { kind: 'period', grain: 'month', offset: 0 } },
      compare: 'previous_period',
    });
    const want = await one(
      `SELECT sum(revenue) FILTER (WHERE order_date >= '2025-03-01') AS cur,
              sum(revenue) FILTER (WHERE order_date < '2025-03-01') AS prev
       FROM orders WHERE order_date BETWEEN '2025-02-01' AND '2025-03-31'`,
    );
    close(row.revenue, want.cur);
    close(row.revenue__previous, want.prev);
    close(row.revenue__change, Number(want.cur) - Number(want.prev));
    close(row.revenue__change_pct, (Number(want.cur) - Number(want.prev)) / Number(want.prev));
    // R1: total revenue falls 6% to 9% in March 2025.
    expect(Number(row.revenue__change_pct)).toBeLessThan(-0.06);
    expect(Number(row.revenue__change_pct)).toBeGreaterThan(-0.09);
  });

  test('the same period last year', async () => {
    const [row] = await run('retail', {
      metrics: ['order_lines'],
      time: { range: { kind: 'period', grain: 'quarter', offset: 0 } },
      compare: 'same_period_last_year',
    });
    const want = await one(
      `SELECT count(*) FILTER (WHERE order_date BETWEEN '2025-01-01' AND '2025-03-31') AS cur,
              count(*) FILTER (WHERE order_date BETWEEN '2024-01-01' AND '2024-03-31') AS prev
       FROM orders`,
    );
    expect(row.order_lines).toBe(Number(want.cur));
    expect(row.order_lines__previous).toBe(Number(want.prev));
  });

  test('the last three complete months', async () => {
    const [row] = await run('support', {
      metrics: ['tickets'],
      time: { range: { kind: 'last_n', n: 3, grain: 'month', complete: true } },
    });
    const want = await one(
      `SELECT count(*) AS n FROM tickets WHERE CAST(created_at AS DATE) BETWEEN '2024-10-01' AND '2024-12-31'`,
    );
    expect(row.tickets).toBe(Number(want.n));
  });

  test('share of total, rank and running total', async () => {
    const shares = await run('retail', {
      metrics: ['revenue'],
      by: ['category'],
      calc: 'share_of_total',
    });
    close(
      shares.reduce((s, r) => s + Number(r.revenue__share), 0),
      1,
    );
    const ranked = await run('retail', { metrics: ['revenue'], by: ['category'], calc: 'rank' });
    expect(ranked.map((r) => r.revenue__rank)).toEqual([1, 2, 3, 4, 5]);
    const running = await run('retail', {
      metrics: ['order_lines'],
      time: { grain: 'year', range: { kind: 'all' } },
      calc: 'running_total',
    });
    expect(running.at(-1)!.order_lines__running).toBe(59881);
  });
});

describe('the classic wrong answers', () => {
  test('Slotwise MRR for 2024 is December 2024 MRR, not the sum of the months', async () => {
    const [row] = await run('saas', {
      metrics: ['mrr'],
      time: { range: { kind: 'absolute', from: '2024-01-01', to: '2024-12-31' } },
    });
    const dec = await one(`SELECT sum(mrr) AS m FROM subscriptions WHERE month = '2024-12-01'`);
    const summed = await one(`SELECT sum(mrr) AS m FROM subscriptions WHERE year(month) = 2024`);
    close(row.mrr, dec.m);
    // The sum of twelve months is about ten times larger: the wrong answer.
    expect(Number(summed.m)).toBeGreaterThan(10 * Number(row.mrr));
  });

  test('MRR by quarter is the last month of each quarter', async () => {
    const rows = await run('saas', {
      metrics: ['mrr', 'active_accounts'],
      time: { grain: 'quarter', range: { kind: 'all' } },
    });
    const sep = await one(
      `SELECT sum(mrr) AS m, count(*) AS n FROM subscriptions WHERE month = '2023-09-01'`,
    );
    const q3 = rows.find((r) => r.period === '2023-07-01')!;
    close(q3.mrr, sep.m);
    expect(q3.active_accounts).toBe(Number(sep.n));
  });

  test('return rate by category is returned rows over rows, not an average of monthly rates', async () => {
    const rows = await run('retail', {
      metrics: ['return_rate'],
      by: ['category'],
      time: { range: { kind: 'absolute', from: '2024-01-01', to: '2024-12-31' } },
    });
    const truth = objects(
      await engine.query(
        `SELECT category, count(*) FILTER (WHERE returned) / count(*) AS rate,
                avg(monthly) AS averaged
         FROM orders
         JOIN (SELECT category AS c, date_trunc('month', order_date) AS m,
                      count(*) FILTER (WHERE returned) / count(*) AS monthly
               FROM orders WHERE year(order_date) = 2024 GROUP BY 1, 2) mr
           ON mr.c = orders.category AND mr.m = date_trunc('month', order_date)
         WHERE year(order_date) = 2024
         GROUP BY 1`,
      ),
    );
    for (const r of rows) {
      const t = truth.find((x) => x.category === r.category)!;
      close(r.return_rate, t.rate);
    }
    // The averaging shortcut gives a different answer for at least one category.
    const plain = objects(
      await engine.query(
        `SELECT category, avg(rate) AS a FROM (
           SELECT category, date_trunc('month', order_date) AS m,
                  count(*) FILTER (WHERE returned) / count(*) AS rate
           FROM orders WHERE year(order_date) = 2024 GROUP BY 1, 2) GROUP BY 1`,
      ),
    );
    const differs = rows.some((r) => {
      const p = plain.find((x) => x.category === r.category)!;
      return Math.abs(Number(p.a) - Number(r.return_rate)) > 1e-4;
    });
    expect(differs).toBe(true);
  });

  test('S1: churn on Starter about doubles in December 2024', async () => {
    const rows = await run('saas', {
      metrics: ['churn_rate'],
      by: ['plan'],
      time: { range: { kind: 'period', grain: 'month', offset: 0 } },
      compare: 'previous_period',
    });
    const starter = rows.find((r) => r.plan === 'Starter')!;
    expect(Number(starter.churn_rate) / Number(starter.churn_rate__previous)).toBeGreaterThan(1.7);
  });
});

describe('starter questions', () => {
  test.each(SAMPLES)('$id starters are valid specs and run', async ({ id }) => {
    for (const s of models.get(id)!.starters) {
      expect(querySpecSchema.safeParse(s.spec).success, s.label).toBe(true);
      const rows = await run(id, s.spec as QuerySpecInput);
      expect(rows.length, s.label).toBeGreaterThan(0);
    }
  });
});

/** Quoted identifiers in a statement, unescaped. */
function identifiers(sql: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"]|"")*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) out.push(m[1].replaceAll('""', '"'));
  return out;
}

describe('property: generated specs', () => {
  test('any valid spec on retail compiles, runs and names only dictionary identifiers', async () => {
    const model = models.get('retail')!;
    const metricIds = model.metrics.map((m) => m.id);
    const dimIds = model.dimensions.filter((d) => d.role === 'category').map((d) => d.id);
    const values: Record<string, string[]> = {
      region: ['North', 'east', 'Nowhere'],
      channel: ['Online', 'Store'],
      category: ['Electronics', 'Decor'],
      sub_category: ['Headphones', 'x'],
      customer_segment: ['Consumer'],
      returned: ['true', 'false'],
    };
    const grain = fc.constantFrom('day', 'week', 'month', 'quarter', 'year' as const);
    const range = fc.oneof(
      fc.constant({ kind: 'all' as const }),
      fc.record({
        kind: fc.constant('period' as const),
        grain,
        offset: fc.integer({ min: 0, max: 3 }),
      }),
      fc.record({
        kind: fc.constant('last_n' as const),
        n: fc.integer({ min: 1, max: 6 }),
        grain,
        complete: fc.boolean(),
      }),
      fc.constant({ kind: 'absolute' as const, from: '2024-03-01', to: '2024-09-30' }),
    );
    const specArb = fc
      .record({
        metrics: fc.uniqueArray(fc.constantFrom(...metricIds), { minLength: 1, maxLength: 4 }),
        by: fc.uniqueArray(fc.constantFrom(...dimIds), { maxLength: 2 }),
        time: fc.option(fc.record({ grain: fc.option(grain, { nil: undefined }), range }), {
          nil: undefined,
        }),
        filters: fc.array(
          fc.constantFrom(...dimIds).chain((dimension) =>
            fc.record({
              dimension: fc.constant(dimension),
              op: fc.constantFrom('in', 'not_in', 'contains' as const),
              values: fc.subarray(values[dimension], { minLength: 1 }),
            }),
          ),
          { maxLength: 2 },
        ),
        compare: fc.option(fc.constantFrom('previous_period', 'same_period_last_year' as const), {
          nil: undefined,
        }),
        calc: fc.option(fc.constantFrom('share_of_total', 'running_total', 'rank' as const), {
          nil: undefined,
        }),
        limit: fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }),
      })
      // Keep the combinations the compiler accepts by design.
      .map((s) => {
        const time = s.compare
          ? {
              range:
                s.time?.range.kind === 'all' || !s.time
                  ? { kind: 'period' as const, grain: 'month' as const, offset: 0 }
                  : s.time.range,
            }
          : s.time;
        const hasGrain = time !== undefined && 'grain' in time && time.grain !== undefined;
        const calc = s.calc === 'running_total' && !hasGrain ? undefined : s.calc;
        return { ...s, time, calc };
      });

    const allowed = new Set<string>([
      model.table,
      ...model.metrics.flatMap((m) => [
        m.id,
        `${m.id}__previous`,
        `${m.id}__change`,
        `${m.id}__change_pct`,
        `${m.id}__share`,
        `${m.id}__running`,
        `${m.id}__rank`,
      ]),
      ...model.dimensions.flatMap((d) => [d.id, d.column]),
      ...model.metrics.flatMap((m) => (m.kind === 'simple' && m.column ? [m.column] : [])),
      model.time!.column,
      'period',
      ...HELPERS,
    ]);

    await fc.assert(
      fc.asyncProperty(specArb, async (spec) => {
        let c;
        try {
          c = compile(spec, model, { time: facts.get('retail')! });
        } catch (e) {
          // A period the data cannot cover is refused with a reason, not a crash.
          if (
            e instanceof Error &&
            e.name === 'CompileError' &&
            (e as { code?: string }).code === 'period'
          )
            return;
          throw e;
        }
        for (const ident of identifiers(c.sql)) expect(allowed.has(ident), ident).toBe(true);
        await engine.query(c.sql, c.params);
      }),
      { numRuns: 120, seed: 20261008 },
    );
  }, 120_000);
});

describe('displaySql', () => {
  test('returns the same rows as sql with params, for every spec above', async () => {
    expect(ran.length).toBeGreaterThan(15);
    for (const { id, spec } of ran) {
      const c = compile(spec, models.get(id)!, { time: facts.get(id)! });
      const a = await engine.query(c.sql, c.params);
      const b = await engine.query(c.displaySql);
      expect(b.rows, JSON.stringify(spec)).toEqual(a.rows);
    }
  });
});
