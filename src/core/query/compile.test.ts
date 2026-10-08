// The compiler without an engine: errors, determinism, quoting and the shape
// of what it emits. Results on real data are tested in tests/query.

import { describe, expect, test } from 'vitest';
import { type SemanticModel, semanticModelSchema } from '@/core/model/types';
import { CompileError, compile, displaySql } from './compile';
import { querySpecSchema } from './spec';

const model: SemanticModel = semanticModelSchema.parse({
  table: 'orders',
  version: 1,
  time: {
    id: 'order_date',
    label: 'Order date',
    column: 'order_date',
    min: '2024-01-01',
    max: '2024-12-31',
    defaultGrain: 'month',
  },
  metrics: [
    {
      kind: 'simple',
      id: 'revenue',
      label: 'Revenue',
      column: 'revenue',
      agg: 'sum',
      format: { style: 'currency' },
      direction: 'higher_better',
      importance: 1,
    },
    {
      kind: 'simple',
      id: 'rows',
      label: 'Rows',
      column: null,
      agg: 'count',
      format: { style: 'number' },
      direction: 'higher_better',
      importance: 0.7,
    },
    {
      kind: 'simple',
      id: 'balance',
      label: 'Balance',
      column: 'odd "col"',
      agg: 'avg',
      overTime: 'avg',
      format: { style: 'number' },
      direction: 'neutral',
      importance: 0.4,
    },
    {
      kind: 'ratio',
      id: 'per_row',
      label: 'Per row',
      numerator: 'revenue',
      denominator: 'rows',
      format: { style: 'currency' },
      direction: 'higher_better',
      importance: 0.4,
    },
  ],
  dimensions: [
    {
      id: 'region',
      label: 'Region',
      column: 'region',
      role: 'category',
      distinct: 4,
      private: false,
    },
  ],
});

const facts = { days: ['2024-01-01', '2024-06-30', '2024-12-31'] };
const ctx = { time: facts };

function error(fn: () => unknown): CompileError {
  try {
    fn();
  } catch (e) {
    if (e instanceof CompileError) return e;
    throw e;
  }
  throw new Error('did not throw');
}

describe('refusals', () => {
  test('ids not in the dictionary', () => {
    expect(error(() => compile({ metrics: ['profit'] }, model, ctx)).code).toBe('unknown_metric');
    expect(error(() => compile({ metrics: ['revenue'], by: ['city'] }, model, ctx)).code).toBe(
      'unknown_dimension',
    );
    expect(
      error(() =>
        compile(
          { metrics: ['revenue'], filters: [{ dimension: 'city', op: 'in', values: ['x'] }] },
          model,
          ctx,
        ),
      ).code,
    ).toBe('unknown_dimension');
    expect(
      error(() => compile({ metrics: ['revenue'], sort: { by: 'rows', dir: 'asc' } }, model, ctx))
        .code,
    ).toBe('unknown_sort');
  });

  test('invalid specs and impossible combinations', () => {
    expect(error(() => compile({ metrics: [] }, model, ctx)).code).toBe('invalid_spec');
    expect(
      error(() =>
        compile(
          {
            metrics: ['revenue'],
            time: { grain: 'month', range: { kind: 'all' } },
            compare: 'previous_period',
          },
          model,
          ctx,
        ),
      ).code,
    ).toBe('compare_series');
    expect(
      error(() => compile({ metrics: ['revenue'], compare: 'previous_period' }, model, ctx)).code,
    ).toBe('period');
    expect(
      error(() => compile({ metrics: ['revenue'], calc: 'running_total' }, model, ctx)).code,
    ).toBe('running_needs_grain');
    const timeless = { ...model, time: null };
    expect(
      error(() =>
        compile({ metrics: ['revenue'], time: { range: { kind: 'all' } } }, timeless, ctx),
      ).code,
    ).toBe('no_time');
    expect(
      error(() =>
        compile(
          { metrics: ['revenue'], time: { range: { kind: 'period', grain: 'month', offset: 0 } } },
          model,
          { time: null },
        ),
      ).code,
    ).toBe('no_time_facts');
    expect(
      error(() =>
        compile(
          { metrics: ['revenue'], time: { range: { kind: 'period', grain: 'year', offset: 1 } } },
          model,
          ctx,
        ),
      ).code,
    ).toBe('period');
  });

  test('the spec schema refuses repeats and a backwards range', () => {
    expect(querySpecSchema.safeParse({ metrics: ['a', 'a'] }).success).toBe(false);
    expect(querySpecSchema.safeParse({ metrics: ['a'], by: ['b', 'b'] }).success).toBe(false);
    expect(
      querySpecSchema.safeParse({
        metrics: ['a'],
        time: { range: { kind: 'absolute', from: '2024-02-01', to: '2024-01-01' } },
      }).success,
    ).toBe(false);
  });
});

describe('what it emits', () => {
  const spec = {
    metrics: ['per_row', 'balance'],
    by: ['region'],
    time: { range: { kind: 'absolute' as const, from: '2024-01-01', to: '2024-03-31' } },
    filters: [
      { dimension: 'region', op: 'not_in' as const, values: ["O'Neil?"] },
      { dimension: 'region', op: 'contains' as const, values: ['north', 'south'] },
    ],
  };

  test('the same spec gives byte-identical SQL', () => {
    expect(compile(spec, model, ctx)).toEqual(compile(structuredClone(spec), model, ctx));
  });

  test('values are parameters, identifiers are quoted and escaped', () => {
    const c = compile(spec, model, ctx);
    expect(c.params).toEqual(['2024-01-01', '2024-03-31', "O'Neil?", 'north', 'south']);
    expect(c.sql).not.toContain('Neil');
    expect(c.sql).toContain('"odd ""col"""');
    expect(c.displaySql).toContain("'O''Neil?'");
    expect(c.displaySql).not.toMatch(/\?(?![^']*')/);
  });

  test('a ratio is a ratio of totals; an average is sum over count of non-empty', () => {
    const c = compile(spec, model, ctx);
    expect(c.sql).toContain(
      'CAST(CAST(sum("revenue") AS DOUBLE) AS DOUBLE) / NULLIF(CAST(CAST(count(*) AS BIGINT) AS DOUBLE), 0) AS "per_row"',
    );
    expect(c.sql).toContain(
      '(CAST(sum("odd ""col""") AS DOUBLE) / NULLIF(count("odd ""col"""), 0)) / NULLIF(count(DISTINCT "_day"), 0) AS "balance"',
    );
    expect(c.columns.map((col) => `${col.kind}:${col.name}`)).toEqual([
      'dimension:region',
      'metric:per_row',
      'metric:balance',
    ]);
  });

  test('refined columns are read through their expression', () => {
    const c = compile({ metrics: ['revenue'] }, model, {
      time: null,
      expressions: { revenue: 'TRY_CAST("revenue" AS DOUBLE)' },
    });
    // Metric columns are aggregated as stored; the time column and filters
    // use the expression.
    expect(c.sql).toContain('sum("revenue")');
    const t = compile(
      { metrics: ['rows'], time: { grain: 'month', range: { kind: 'all' } } },
      model,
      {
        time: null,
        expressions: { order_date: 'try_strptime("order_date", \'%d/%m/%Y\')' },
      },
    );
    expect(t.sql).toContain("date_trunc('month', try_strptime(\"order_date\", '%d/%m/%Y'))");
  });

  test('a lone total has no GROUP BY and no ORDER BY', () => {
    const c = compile({ metrics: ['revenue'] }, model, ctx);
    expect(c.sql).not.toContain('GROUP BY');
    expect(c.sql).not.toContain('ORDER BY');
    expect(c.range).toBeNull();
  });

  test('calculations add their columns', () => {
    const share = compile(
      { metrics: ['revenue'], by: ['region'], calc: 'share_of_total' },
      model,
      ctx,
    );
    expect(share.columns.at(-1)).toEqual({ name: 'revenue__share', kind: 'share', ref: 'revenue' });
    const rank = compile(
      {
        metrics: ['revenue'],
        by: ['region'],
        time: { grain: 'month', range: { kind: 'all' } },
        calc: 'rank',
      },
      model,
      ctx,
    );
    expect(rank.sql).toContain(
      'rank() OVER (PARTITION BY "period" ORDER BY "revenue" DESC NULLS LAST)',
    );
    const sorted = compile(
      {
        metrics: ['revenue'],
        time: { grain: 'month', range: { kind: 'all' } },
        sort: { by: 'period', dir: 'desc' },
        limit: 3,
      },
      model,
      ctx,
    );
    expect(sorted.sql).toMatch(/ORDER BY "period" DESC NULLS LAST\nLIMIT 3$/);
  });
});

describe('displaySql', () => {
  test('writes values in, skipping question marks in quotes', () => {
    expect(displaySql(`SELECT "a?" , '?' , ? , ? , ? , ?`, ['x', 1.5, true, null])).toBe(
      `SELECT "a?" , '?' , 'x' , 1.5 , TRUE , NULL`,
    );
    expect(displaySql('SELECT ?', [false])).toBe('SELECT FALSE');
  });

  test('a count mismatch is a bug and throws', () => {
    expect(() => displaySql('SELECT ?, ?', [1])).toThrow('More placeholders');
    expect(() => displaySql('SELECT 1', [1])).toThrow('More parameters');
  });
});
