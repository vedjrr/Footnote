// Chart choice on the retail sample (Node adapter): real compiled columns and
// real rows, so a plan's column names are the ones the compiler emits and its
// split values are the ones in the file.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { type TimeFacts, readTimeFacts, timeFactsSql } from '@/core/findings/periods';
import type { SemanticModel } from '@/core/model/types';
import { parseModelYaml } from '@/core/model/yaml';
import { type ChartPlan, chooseChart } from '@/core/narrative/chart';
import { compile } from '@/core/query/compile';
import type { QuerySpecInput } from '@/core/query/spec';

let engine: QueryEngine;
let model: SemanticModel;
let facts: TimeFacts;

beforeAll(async () => {
  engine = await createNodeEngine();
  await engine.registerFile('orders', {
    kind: 'path',
    format: 'parquet',
    path: 'data/demo/retail/orders.parquet',
  });
  const parsed = parseModelYaml(readFileSync('data/demo/retail/dictionary.yaml', 'utf8'));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems));
  model = parsed.model;
  facts = readTimeFacts(await engine.query(timeFactsSql('orders', model.time!.column)));
}, 60_000);

afterAll(async () => {
  await engine.close();
});

async function plan(spec: QuerySpecInput): Promise<{ plan: ChartPlan; names: string[] }> {
  const c = compile(spec, model, { time: facts });
  const result = await engine.query(c.sql, c.params);
  expect(result.columns.map((col) => col.name)).toEqual(c.columns.map((col) => col.name));
  return {
    plan: chooseChart(spec, { columns: c.columns, rows: result.rows }),
    names: c.columns.map((col) => col.name),
  };
}

/** Every column a plan names is in the result. */
function columnsOf(p: ChartPlan): string[] {
  switch (p.form) {
    case 'line':
      return p.series.map((s) => s.column);
    case 'small_multiples':
      return p.panels.map((s) => s.column);
    case 'bars':
      return [p.value];
    default:
      return [];
  }
}

describe('retail', () => {
  test('total revenue: figures', async () => {
    expect((await plan({ metrics: ['revenue'] })).plan.form).toBe('figures');
  });

  test('revenue by month: one line', async () => {
    const { plan: p, names } = await plan({
      metrics: ['revenue'],
      time: { grain: 'month', range: { kind: 'all' } },
    });
    expect(p).toMatchObject({ form: 'line', series: [{ column: 'revenue' }] });
    for (const c of columnsOf(p)) expect(names).toContain(c);
  });

  test('revenue by month and channel: three lines, largest first', async () => {
    const { plan: p } = await plan({
      metrics: ['revenue'],
      by: ['channel'],
      time: { grain: 'month', range: { kind: 'all' } },
    });
    expect(p.form).toBe('line');
    if (p.form !== 'line') return;
    expect(p.series.map((s) => s.split?.value)).toEqual(['Online', 'Store', 'Marketplace']);
  });

  test('revenue by category: ranked bars', async () => {
    const { plan: p } = await plan({ metrics: ['revenue'], by: ['category'] });
    expect(p).toMatchObject({ form: 'bars', category: 'category', ordered: false, marks: 5 });
  });

  test('revenue by category against the previous month: bars with the change', async () => {
    const { plan: p } = await plan({
      metrics: ['revenue'],
      by: ['category'],
      time: { range: { kind: 'period', grain: 'month', offset: 0 } },
      compare: 'previous_period',
    });
    expect(p).toMatchObject({ form: 'bars', value: 'revenue', labelChange: true });
  });

  test('share of revenue by channel: bars of the share column', async () => {
    const { plan: p, names } = await plan({
      metrics: ['revenue'],
      by: ['channel'],
      calc: 'share_of_total',
    });
    expect(p).toMatchObject({ form: 'bars', value: 'revenue__share' });
    for (const c of columnsOf(p)) expect(names).toContain(c);
  });

  test('revenue by channel and category: small multiples', async () => {
    const { plan: p } = await plan({ metrics: ['revenue'], by: ['channel', 'category'] });
    expect(p).toMatchObject({ form: 'small_multiples', kind: 'bars', x: 'category', marks: 15 });
  });

  test('revenue by customer: a table', async () => {
    expect((await plan({ metrics: ['revenue'], by: ['customer'] })).plan.form).toBe('table');
  });
});
