// Health checks on the real engine (Node adapter). On each sample the checks
// must report exactly the problems listed under `health` in truth.json:
// every planted one, and the extras accepted after review, nothing else.
// Fixtures built in SQL cover the checks the samples do not trigger.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { type HealthReport, checkHealth } from '@/core/health/health';
import { inferDictionary } from '@/core/model/infer';
import type { SemanticModel } from '@/core/model/types';
import { parseModelYaml } from '@/core/model/yaml';
import { profileTable } from '@/core/profile/profile';

const SAMPLES = [
  { id: 'retail', table: 'orders' },
  { id: 'saas', table: 'subscriptions' },
  { id: 'support', table: 'tickets' },
] as const;

interface Truth {
  effects: Array<{ id: string; realised: Record<string, number> }>;
  health: Array<{ check: string; columns: string[]; effect?: string; reason: string }>;
}

let engine: QueryEngine;
const reports = new Map<string, HealthReport>();
const models = new Map<string, SemanticModel>();
const truths = new Map<string, Truth>();

const key = (check: string, columns: string[]) => `${check} ${[...columns].sort().join(',')}`;

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
    truths.set(id, JSON.parse(readFileSync(`data/demo/${id}/truth.json`, 'utf8')) as Truth);
    const profile = await profileTable(engine, table);
    reports.set(
      id,
      await checkHealth(engine, profile, parsed.model, { latestPlausible: '2026-10-08' }),
    );
  }
}, 60_000);

afterAll(async () => {
  await engine.close();
});

describe.each(SAMPLES)('the $id sample', ({ id }) => {
  test('reports exactly the problems in truth.json', () => {
    const report = reports.get(id)!;
    console.log(
      `${id}:\n` +
        report.problems.map((p) => `  ${p.check} ${p.severity}: ${p.statement}`).join('\n'),
    );
    const found = report.problems.map((p) => key(p.check, p.columns)).sort();
    const expected = truths
      .get(id)!
      .health.map((h) => key(h.check, h.columns))
      .sort();
    expect(found).toEqual(expected);
  });

  test('each problem is well formed', () => {
    const model = models.get(id)!;
    const metricIds = new Set(model.metrics.map((m) => m.id));
    for (const p of reports.get(id)!.problems) {
      expect(p.count, p.statement).toBeGreaterThan(0);
      expect(p.share).toBeGreaterThan(0);
      expect(p.share).toBeLessThanOrEqual(1);
      expect(p.examples.rows.length).toBeGreaterThan(0);
      expect(p.examples.rows.length).toBeLessThanOrEqual(p.check === 'H5' ? 20 : 5);
      expect(reports.get(id)!.sql).toContain(p.sql);
      for (const m of p.metrics) expect(metricIds.has(m)).toBe(true);
    }
  });

  test('most serious first', () => {
    const rank = { serious: 0, minor: 1, information: 2 };
    const ranks = reports.get(id)!.problems.map((p) => rank[p.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe('counts agree with the measured truth', () => {
  const problem = (id: string, check: string, column?: string) =>
    reports
      .get(id)!
      .problems.find((p) => p.check === check && (!column || p.columns.includes(column)))!;
  const realised = (id: string, effect: string, k: string) =>
    truths.get(id)!.effects.find((e) => e.id === effect)!.realised[k];
  const pct = (x: number) => Math.round(x * 1_000_000) / 10_000;

  test('retail R7', () => {
    expect(pct(problem('retail', 'H1').share)).toBeCloseTo(
      realised('retail', 'R7', 'duplicate_rows_pct'),
      3,
    );
    expect(problem('retail', 'H1').severity).toBe('serious');
    expect(pct(problem('retail', 'H4').share)).toBeCloseTo(
      realised('retail', 'R7', 'lowercase_region_pct'),
      3,
    );
    expect(pct(problem('retail', 'H3').share)).toBeCloseTo(
      realised('retail', 'R7', 'empty_segment_pct'),
      3,
    );
    expect(problem('retail', 'H6', 'quantity').count).toBe(
      realised('retail', 'R7', 'negative_quantity_rows'),
    );
    expect(problem('retail', 'H4').dimensions).toEqual(['region']);
  });

  test('subscriptions S6', () => {
    const zero = problem('saas', 'H12');
    expect(pct(zero.share)).toBeCloseTo(realised('saas', 'S6', 'zero_seats_pct'), 3);
    expect(zero.severity).toBe('serious');
    expect(zero.statement).toBe('seats is 0 while mrr is above 0 in 338 rows (0.6%).');
    expect(pct(problem('saas', 'H3').share)).toBeCloseTo(
      realised('saas', 'S6', 'empty_industry_pct'),
      3,
    );
  });

  test('support T5, with empty csat as information', () => {
    expect(pct(problem('support', 'H9').share)).toBeCloseTo(
      realised('support', 'T5', 'resolved_before_created_pct'),
      3,
    );
    expect(pct(problem('support', 'H2').share)).toBeCloseTo(
      realised('support', 'T5', 'repeated_id_pct'),
      3,
    );
    const csat = problem('support', 'H3', 'csat');
    expect(csat.severity).toBe('information');
    expect(pct(csat.share)).toBeCloseTo(realised('support', 'T5', 'csat_empty_pct'), 3);
    expect(csat.statement).toContain('Average CSAT uses only the rows with a value');
  });
});

describe('fixtures', () => {
  async function report(sql: string, table: string, options = {}) {
    await engine.query(`CREATE OR REPLACE TABLE ${table} AS ${sql}`);
    const profile = await profileTable(engine, table);
    const model = await inferDictionary(engine, profile);
    return checkHealth(engine, profile, model, options);
  }

  test('a clean table reports nothing', async () => {
    const r = await report(
      `SELECT DATE '2024-01-01' + CAST(i AS INTEGER) AS day,
              CASE WHEN i % 3 = 0 THEN 'A' ELSE 'B' END AS kind,
              CAST(10 + i % 7 AS DOUBLE) AS amount
       FROM range(0, 120) t(i)`,
      'clean',
    );
    expect(r.problems).toEqual([]);
  });

  test('unreadable numbers, a constant column, a gap and an incomplete month', async () => {
    const r = await report(
      `SELECT DATE '2024-01-01' + CAST(i AS INTEGER) AS day,
              CASE WHEN i = 7 THEN 'n/a' ELSE '$' || (100 + i) END AS price,
              'UK' AS country,
              CAST(i % 5 AS DOUBLE) AS units
       FROM range(0, 200) t(i)
       WHERE i NOT BETWEEN 40 AND 44 AND i NOT BETWEEN 192 AND 199`,
      'messy',
    );
    const by = (check: string) => r.problems.find((p) => p.check === check);
    expect(by('H7')).toMatchObject({ columns: ['price'], count: 1 });
    expect(by('H11')).toMatchObject({
      columns: ['country'],
      severity: 'information',
      statement: 'country has the same value, "UK", in every row that has one.',
    });
    expect(by('H8')).toMatchObject({ count: 5, severity: 'minor' });
    expect(by('H8')?.statement).toContain('5 days inside the range of day have no rows');
    expect(by('H10')).toMatchObject({ severity: 'information' });
    expect(by('H10')?.statement).toMatch(/^The latest month, July 2024, has data on 10 days/);
  });

  test('dates after the latest plausible date', async () => {
    const r = await report(
      `SELECT DATE '2026-09-01' + CAST(i AS INTEGER) AS day, CAST(i AS DOUBLE) AS amount
       FROM range(0, 60) t(i)`,
      'future',
      { latestPlausible: '2026-10-08' },
    );
    const future = r.problems.find((p) => p.title === 'Dates in the future');
    expect(future).toMatchObject({ check: 'H9', severity: 'serious', count: 22 });
  });

  test('label variants above 2% are serious', async () => {
    const r = await report(
      `SELECT i AS n, CASE WHEN i % 10 = 0 THEN ' red' WHEN i % 2 = 0 THEN 'Red' ELSE 'Blue' END AS colour
       FROM range(0, 100) t(i)`,
      'labels',
    );
    expect(r.problems).toEqual([
      expect.objectContaining({ check: 'H4', severity: 'serious', count: 10 }),
    ]);
  });
});
