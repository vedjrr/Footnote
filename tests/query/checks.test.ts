// Result checks C1 to C8 on the samples (Node adapter): each outcome is
// produced by a real question where the samples allow it, and by a doctored
// result or dictionary where they do not.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine, QueryResult } from '@/core/engine/types';
import { type TimeFacts, readTimeFacts, timeFactsSql } from '@/core/findings/periods';
import { type SemanticModel, semanticModelSchema } from '@/core/model/types';
import { parseModelYaml } from '@/core/model/yaml';
import { type CheckId, type ResultCheck, checkResult } from '@/core/query/checks';
import { compile } from '@/core/query/compile';
import type { QuerySpecInput } from '@/core/query/spec';

const SAMPLES = [
  { id: 'retail', table: 'orders' },
  { id: 'saas', table: 'subscriptions' },
  { id: 'support', table: 'tickets' },
] as const;

let engine: QueryEngine;
const models = new Map<string, SemanticModel>();
const facts = new Map<string, TimeFacts>();

beforeAll(async () => {
  engine = await createNodeEngine();
  for (const { id, table } of SAMPLES) {
    await engine.registerFile(table, {
      kind: 'path',
      format: 'parquet',
      path: `data/demo/${id}/${table}.parquet`,
    });
    const parsed = parseModelYaml(readFileSync(`data/demo/${id}/dictionary.yaml`, 'utf8'));
    if (!parsed.ok) throw new Error('bad dictionary');
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

async function checks(
  id: string,
  spec: QuerySpecInput,
  options: { model?: SemanticModel; doctor?: (r: QueryResult) => QueryResult } = {},
): Promise<Map<CheckId, ResultCheck>> {
  const model = options.model ?? models.get(id)!;
  const compiled = compile(spec, model, { time: facts.get(id)! });
  let result = await engine.query(compiled.sql, compiled.params);
  if (options.doctor) result = options.doctor(result);
  const found = await checkResult({ engine, model, spec, compiled, result, time: facts.get(id)! });
  return new Map(found.map((c) => [c.id, c]));
}

const march = { range: { kind: 'period' as const, grain: 'month' as const, offset: 0 } };

describe('C1 parts add up', () => {
  test('pass: revenue by region adds up to total revenue', async () => {
    const c = await checks('retail', { metrics: ['revenue', 'order_lines'], by: ['region'] });
    expect(c.get('C1')).toMatchObject({ outcome: 'pass' });
  });

  test('caution: a top-N says how much it covers', async () => {
    const c = await checks('retail', {
      metrics: ['revenue'],
      by: ['region'],
      sort: { by: 'revenue', dir: 'desc' },
      limit: 2,
    });
    expect(c.get('C1')?.outcome).toBe('caution');
    expect(c.get('C1')?.sentence).toMatch(
      /^These are the top 2 of 8, covering \d+\.\d% of revenue\.$/,
    );
  });

  test('fail: parts that do not add up are reported with both numbers', async () => {
    const c = await checks(
      'retail',
      { metrics: ['revenue'], by: ['channel'] },
      { doctor: (r) => ({ ...r, rows: r.rows.slice(1) }) },
    );
    expect(c.get('C1')?.outcome).toBe('fail');
    expect(c.get('C1')?.sentence).toMatch(
      /^The parts of Revenue add up to .+, but the total is .+\.$/,
    );
  });

  test('not run on ratios, series or comparisons', async () => {
    const c = await checks('retail', { metrics: ['margin'], by: ['region'] });
    expect(c.has('C1')).toBe(false);
  });
});

describe('C2 and C7: the rows in scope', () => {
  test('a narrow question has few rows behind it', async () => {
    const c = await checks('retail', {
      metrics: ['revenue'],
      time: { range: { kind: 'absolute', from: '2025-03-03', to: '2025-03-03' } },
      filters: [{ dimension: 'sub_category', op: 'in', values: ['Headphones'] }],
    });
    expect(c.get('C2')?.outcome).toBe('caution');
    expect(c.get('C2')?.sentence).toMatch(/^Only \d+ rows? (is|are) behind this answer/);
  });

  test('the duplicate week of June 2024 raises C7; March 2025 does not', async () => {
    const june = await checks('retail', {
      metrics: ['revenue'],
      time: { range: { kind: 'absolute', from: '2024-06-10', to: '2024-06-16' } },
    });
    expect(june.get('C7')?.outcome).toBe('caution');
    expect(june.get('C7')?.sentence).toContain('are exact duplicates');
    const mar = await checks('retail', { metrics: ['revenue'], time: march });
    expect(mar.get('C7')?.outcome).toBe('pass');
    expect(mar.get('C2')?.outcome).toBe('pass');
  });
});

describe('C3 filter values exist', () => {
  test('a misspelt value fails with the three closest values', async () => {
    const c = await checks('retail', {
      metrics: ['revenue'],
      filters: [{ dimension: 'region', op: 'in', values: ['Nrth'] }],
    });
    expect(c.get('C3')?.outcome).toBe('fail');
    expect(c.get('C3')?.sentence).toBe(
      'No row has region "Nrth". Closest values: "North", "north", "South".',
    );
  });

  test('values that exist pass; contains is checked as contains', async () => {
    const c = await checks('retail', {
      metrics: ['revenue'],
      filters: [{ dimension: 'sub_category', op: 'contains', values: ['phone'] }],
    });
    expect(c.get('C3')?.outcome).toBe('pass');
  });
});

describe('C4 complete period', () => {
  test('weekly retail ends in an incomplete week', async () => {
    const c = await checks('retail', {
      metrics: ['revenue'],
      time: { grain: 'week', range: { kind: 'all' } },
    });
    expect(c.get('C4')?.outcome).toBe('caution');
    expect(c.get('C4')?.sentence).toBe(
      'The range includes the week starting 31 March 2025, which is not complete: the data runs to 31 March 2025.',
    );
  });

  test('monthly retail is complete; a past range is complete', async () => {
    expect((await checks('retail', { metrics: ['revenue'] })).get('C4')?.outcome).toBe('pass');
    const c = await checks('retail', {
      metrics: ['revenue'],
      time: { range: { kind: 'absolute', from: '2024-01-01', to: '2024-01-31' } },
    });
    expect(c.get('C4')?.outcome).toBe('pass');
  });
});

describe('C5 empty result', () => {
  test('no rows fails plainly', async () => {
    const c = await checks('retail', {
      metrics: ['revenue'],
      by: ['region'],
      filters: [{ dimension: 'region', op: 'in', values: ['Nowhere'] }],
    });
    expect(c.get('C5')).toMatchObject({
      outcome: 'fail',
      sentence: 'No rows match this question, so there is nothing to show.',
    });
  });
});

describe('C6 small denominator', () => {
  test('caution: return rate by sub-category in one day rests on few lines', async () => {
    const c = await checks('retail', {
      metrics: ['return_rate'],
      by: ['sub_category'],
      time: { range: { kind: 'absolute', from: '2025-03-03', to: '2025-03-03' } },
    });
    expect(c.get('C6')?.outcome).toBe('caution');
    expect(c.get('C6')?.sentence).toBe(
      'Return rate rests on fewer than 30 order lines in part of this answer.',
    );
  });

  test('fail: a denominator of 0', async () => {
    const base = models.get('retail')!;
    const model = semanticModelSchema.parse({
      ...base,
      metrics: [
        ...base.metrics,
        {
          kind: 'ratio',
          id: 'revenue_per_return',
          label: 'Revenue per return',
          numerator: 'revenue',
          denominator: 'returned_lines',
          format: { style: 'currency' },
          direction: 'neutral',
          importance: 0.4,
        },
      ],
    });
    const c = await checks(
      'retail',
      {
        metrics: ['revenue_per_return'],
        by: ['sub_category'],
        time: { range: { kind: 'absolute', from: '2025-03-03', to: '2025-03-03' } },
      },
      { model },
    );
    expect(c.get('C6')).toMatchObject({
      outcome: 'fail',
      sentence:
        'Returned lines is 0 in part of this answer, so Revenue per return cannot be worked out there.',
    });
  });

  test('pass: return rate by category over a year', async () => {
    const c = await checks('retail', { metrics: ['return_rate'], by: ['category'] });
    expect(c.get('C6')?.outcome).toBe('pass');
  });
});

describe('C8 rolled-up snapshot metric', () => {
  test('MRR over a year is noted as taken at the end of the period', async () => {
    const c = await checks('saas', {
      metrics: ['mrr', 'churn_rate'],
      time: { range: { kind: 'absolute', from: '2024-01-01', to: '2024-12-31' } },
    });
    expect(c.get('C8')).toEqual({
      id: 'C8',
      outcome: 'note',
      sentence: 'MRR and Active accounts are taken at the end of the period, not added up.',
    });
  });

  test('no note for a monthly series, one month, or a sum metric', async () => {
    expect(
      (
        await checks('saas', { metrics: ['mrr'], time: { grain: 'month', range: { kind: 'all' } } })
      ).has('C8'),
    ).toBe(false);
    expect((await checks('saas', { metrics: ['mrr'], time: march })).has('C8')).toBe(false);
    expect((await checks('retail', { metrics: ['revenue'] })).has('C8')).toBe(false);
  });
});

test('comparisons count the current side and check both denominators', async () => {
  const c = await checks('saas', {
    metrics: ['churn_rate'],
    by: ['plan'],
    time: march,
    compare: 'previous_period',
  });
  expect(c.get('C2')?.outcome).toBe('pass');
  expect(c.get('C6')?.outcome).toBe('pass');
  expect(c.has('C1')).toBe(false);
});
