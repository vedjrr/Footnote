// The profile runs through the real engine (Node adapter): fixtures built in
// SQL pin each refinement rule, and the three samples are snapshotted.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { type ColumnProfile, type Profile, profileTable } from '@/core/profile/profile';

let engine: QueryEngine;

beforeAll(async () => {
  engine = await createNodeEngine();
  await engine.query(`
    CREATE TABLE fx AS SELECT
      i AS id,
      CASE WHEN i = 1 THEN 'n/a' WHEN i % 2 = 0 THEN '$1,' || lpad(i::VARCHAR, 3, '0')
           ELSE i::VARCHAR || '%' END AS price,
      CASE WHEN i <= 5 THEN 'x' ELSE i::VARCHAR END AS mostly_numbers,
      strftime(DATE '2024-01-01' + CAST(i AS INTEGER), '%d/%m/%Y') AS day_text,
      CASE WHEN i % 3 = 0 THEN ' Yes' ELSE 'no' END AS yes_no,
      CAST(i % 2 AS INTEGER) AS flag,
      CAST(i % 4 AS INTEGER) AS quarter_bucket,
      CASE WHEN i <= 10 THEN '' WHEN i <= 20 THEN NULL ELSE 'a' END AS blanks,
      CAST(NULL AS VARCHAR) AS nothing,
      CAST(NULL AS DOUBLE) AS no_numbers,
      TIMESTAMP '2024-01-01 10:00:00' + to_days(CAST(i * 2 AS INTEGER)) AS seen_at,
      CAST(i * -1.5 AS DOUBLE) AS "odd ""name"""
    FROM range(1, 101) t(i)`);
  await engine.query('CREATE TABLE fx_empty AS SELECT * FROM fx WHERE false');
});

afterAll(async () => {
  await engine.close();
});

function column(profile: Profile, name: string): ColumnProfile {
  const found = profile.columns.find((c) => c.name === name);
  if (!found) throw new Error(`No column ${name}`);
  return found;
}

describe('type refinement on fixtures', () => {
  let p: Profile;
  beforeAll(async () => {
    p = await profileTable(engine, 'fx');
  });

  test('text money and percentages become numbers; the rest is unparsed', () => {
    const price = column(p, 'price');
    expect(price.type).toBe('decimal');
    expect(price.refinement).toEqual({ from: 'text', parsed: 99, unparsed: 1, format: null });
    expect(price.numeric).toMatchObject({ min: 3, max: 1100 });
    expect(price.categorical).toBeNull();
  });

  test('below 98% parsed, a column stays text', () => {
    const mostly = column(p, 'mostly_numbers');
    expect(mostly.type).toBe('text');
    expect(mostly.refinement).toBeNull();
    expect(mostly.categorical?.top[0]).toEqual({ value: 'x', count: 5 });
  });

  test('day-first dates are read with the one format that fits them all', () => {
    const day = column(p, 'day_text');
    expect(day.type).toBe('date');
    expect(day.refinement).toEqual({ from: 'text', parsed: 100, unparsed: 0, format: '%d/%m/%Y' });
    expect(day.temporal).toEqual({
      min: '2024-01-02',
      max: '2024-04-10',
      distinctDays: 100,
      gapDays: 0,
    });
  });

  test('two-valued yes/no text and 0/1 integers become boolean', () => {
    expect(column(p, 'yes_no')).toMatchObject({
      type: 'boolean',
      refinement: { from: 'text', parsed: 100, unparsed: 0 },
    });
    expect(column(p, 'yes_no').categorical?.top).toEqual([
      { value: 'no', count: 67 },
      { value: ' Yes', count: 33 },
    ]);
    expect(column(p, 'flag')).toMatchObject({ type: 'boolean', refinement: { from: 'integer' } });
    expect(column(p, 'quarter_bucket')).toMatchObject({ type: 'integer', refinement: null });
  });

  test('blank text counts as empty', () => {
    expect(column(p, 'blanks')).toMatchObject({
      empty: 20,
      distinct: 1,
      categorical: { top: [{ value: 'a', count: 80 }], minLength: 1, maxLength: 1 },
    });
  });

  test('a column with no values has no statistics to report', () => {
    expect(column(p, 'nothing')).toMatchObject({
      type: 'text',
      empty: 100,
      distinct: 0,
      refinement: null,
      categorical: { top: [], minLength: null, maxLength: null },
    });
    expect(column(p, 'no_numbers').numeric).toEqual({
      min: null,
      max: null,
      mean: null,
      median: null,
      p05: null,
      p95: null,
      zeroShare: null,
      negativeShare: null,
    });
  });

  test('timestamps count distinct days and the days between with none', () => {
    expect(column(p, 'seen_at').temporal).toEqual({
      min: '2024-01-03T10:00:00',
      max: '2024-07-19T10:00:00',
      distinctDays: 100,
      gapDays: 99,
    });
  });

  test('numbers: centre, spread, zeros and negatives', () => {
    expect(column(p, 'odd "name"').numeric).toMatchObject({
      min: -150,
      max: -1.5,
      mean: -75.75,
      median: -75.75,
      zeroShare: 0,
      negativeShare: 1,
    });
    expect(column(p, 'quarter_bucket').numeric?.zeroShare).toBe(0.25);
  });

  test('five statements at most, whatever the column count', () => {
    expect(p.rows).toBe(100);
    expect(p.columns).toHaveLength(12);
    expect(p.sql).toHaveLength(5);
  });

  test('an empty table profiles without failing', async () => {
    const empty = await profileTable(engine, 'fx_empty');
    expect(empty.rows).toBe(0);
    expect(column(empty, 'price')).toMatchObject({ type: 'text', empty: 0, distinct: 0 });
    expect(column(empty, 'seen_at').temporal).toMatchObject({ distinctDays: 0, min: null });
  });
});

/** Rounds floating statistics so a snapshot does not depend on summation order. */
function rounded(profile: Profile): unknown {
  return JSON.parse(
    JSON.stringify({ ...profile, sql: undefined }, (_key, value: unknown) =>
      typeof value === 'number' && !Number.isInteger(value) ? Number(value.toPrecision(9)) : value,
    ),
  );
}

const SAMPLES = [
  ['retail', 'orders'],
  ['saas', 'subscriptions'],
  ['support', 'tickets'],
] as const;

describe('the three samples', () => {
  test.each(SAMPLES)('%s profile', async (id, table) => {
    await engine.registerFile(table, {
      kind: 'path',
      path: `data/demo/${id}/${table}.parquet`,
      format: 'parquet',
    });
    const profile = await profileTable(engine, table);
    expect(profile.sql.length).toBeLessThanOrEqual(5);
    expect(rounded(profile)).toMatchSnapshot();
  });

  test('profiling the retail sample takes under a second', async () => {
    const fresh = await createNodeEngine();
    try {
      await fresh.registerFile('orders', {
        kind: 'path',
        path: 'data/demo/retail/orders.parquet',
        format: 'parquet',
      });
      const start = performance.now();
      await profileTable(fresh, 'orders');
      const elapsed = performance.now() - start;
      console.info(`retail profile: ${elapsed.toFixed(0)} ms`);
      expect(elapsed).toBeLessThan(1000);
    } finally {
      await fresh.close();
    }
  });
});

describe('spaces inside a value', () => {
  test('phone numbers stay text; a space after a currency symbol is fine', async () => {
    await engine.query(`
      CREATE TABLE fx_spaces AS SELECT
        '+44 20 7946 ' || lpad(i::VARCHAR, 4, '0') AS phone_text,
        '£ ' || CAST(i AS VARCHAR) || '.50' AS spaced_money
      FROM range(1, 51) t(i)`);
    const p = await profileTable(engine, 'fx_spaces');
    expect(column(p, 'phone_text')).toMatchObject({ type: 'text', refinement: null });
    expect(column(p, 'spaced_money')).toMatchObject({
      type: 'decimal',
      refinement: { parsed: 50, unparsed: 0 },
    });
  });
});
