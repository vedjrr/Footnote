// Inference runs on the real engine (Node adapter). On each sample it must
// agree with the hand-written dictionary on 90% or more of column roles
// (analytics-spec §2.8, FR-12); every disagreement is printed. A fixture with
// names, emails and phone numbers pins the private-column rules (§2.4).

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { inferDictionary, snapshotEntities, snapshotSql } from '@/core/model/infer';
import { compareRoles } from '@/core/model/roles';
import type { SemanticModel } from '@/core/model/types';
import { parseModelYaml } from '@/core/model/yaml';
import { type Profile, profileTable } from '@/core/profile/profile';

const SAMPLES = [
  { id: 'retail', table: 'orders' },
  { id: 'saas', table: 'subscriptions' },
  { id: 'support', table: 'tickets' },
] as const;

const AGREEMENT = 0.9;

let engine: QueryEngine;
const profiles = new Map<string, Profile>();
const inferred = new Map<string, SemanticModel>();

function written(id: string): SemanticModel {
  const result = parseModelYaml(readFileSync(`data/demo/${id}/dictionary.yaml`, 'utf8'));
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.model;
}

beforeAll(async () => {
  engine = await createNodeEngine();
  for (const { id, table } of SAMPLES) {
    await engine.registerFile(table, {
      kind: 'path',
      format: 'parquet',
      path: `data/demo/${id}/${table}.parquet`,
    });
    const profile = await profileTable(engine, table);
    profiles.set(id, profile);
    inferred.set(id, await inferDictionary(engine, profile));
  }
}, 60_000);

afterAll(async () => {
  await engine.close();
});

describe.each(SAMPLES)('the $id sample', ({ id, table }) => {
  test('the hand-written dictionary is valid and matches the data', () => {
    const model = written(id);
    const profile = profiles.get(id)!;
    expect(model.table).toBe(table);
    const names = profile.columns.map((c) => c.name);
    for (const d of model.dimensions) {
      expect(names).toContain(d.column);
      expect(d.distinct, d.column).toBe(profile.columns.find((c) => c.name === d.column)?.distinct);
    }
    for (const column of model.hidden) expect(names).toContain(column);
    const time = profile.columns.find((c) => c.name === model.time?.column);
    expect(model.time).toMatchObject({ min: time?.temporal?.min, max: time?.temporal?.max });
    expect(model.starters).toHaveLength(3);
  });

  test('inferred roles agree with the hand-written ones on 90% of columns', () => {
    const profile = profiles.get(id)!;
    const comparison = compareRoles(
      inferred.get(id)!,
      written(id),
      profile.columns.map((c) => c.name),
    );
    const lines = comparison.disagreements.map(
      (d) => `  ${d.column}: inferred ${d.inferred}, written ${d.written}`,
    );
    console.log(
      `${id}: ${comparison.agreeing} of ${comparison.columns} column roles agree` +
        (lines.length ? `\n${lines.join('\n')}` : ', no disagreements'),
    );
    expect(comparison.share).toBeGreaterThanOrEqual(AGREEMENT);
  });

  test('inference is deterministic', async () => {
    const again = await inferDictionary(engine, profiles.get(id)!);
    expect(again).toEqual(inferred.get(id));
  });
});

describe('snapshot detection', () => {
  test('MRR, seats and the row count roll up as the last month on subscriptions', () => {
    const metrics = inferred.get('saas')!.metrics;
    const overTime = (column: string | null, agg: string) =>
      metrics.find((m) => m.kind === 'simple' && m.column === column && m.agg === agg);
    expect(overTime('mrr', 'sum')).toMatchObject({ overTime: 'last', importance: 1 });
    expect(overTime('seats', 'sum')).toMatchObject({ overTime: 'last' });
    expect(metrics[0]).toMatchObject({ column: null, agg: 'count', overTime: 'last' });
  });

  test('orders and tickets are not snapshots', () => {
    for (const id of ['retail', 'support']) {
      for (const m of inferred.get(id)!.metrics) {
        if (m.kind === 'simple') expect(m.overTime, `${id} ${m.id}`).toBe('sum');
      }
    }
  });

  test('the probe reports each entity with its unique share and periods', async () => {
    const sql = snapshotSql(profiles.get('retail')!);
    expect(sql).not.toBeNull();
    const result = await engine.query(sql!);
    expect(result.rows.map((r) => r[0]).sort()).toEqual(['customer_id', 'order_id']);
    expect(snapshotEntities(result)).toEqual([]);
    expect(snapshotSql(profiles.get('support')!)).toBeNull();
  });
});

describe('private columns on a fixture', () => {
  let model: SemanticModel;
  beforeAll(async () => {
    await engine.query(`
      CREATE TABLE people AS SELECT
        i AS person_id,
        DATE '2024-01-01' + CAST(i % 60 AS INTEGER) AS joined_on,
        'Person ' || (i % 40) AS full_name,
        'user' || (i % 30) || '@example.com' AS contact,
        '+44 20 7946 ' || lpad((i % 25)::VARCHAR, 4, '0') AS reach_on,
        CASE WHEN i % 2 = 0 THEN 'Gold' ELSE 'Silver' END AS tier,
        'C' || (i % 80) AS club_no,
        'Note number ' || (i % 1500) || ' about this person' AS note,
        CAST(i % 7 AS DOUBLE) * 10.5 AS spend
      FROM range(1, 2001) t(i)`);
    const profile = await profileTable(engine, 'people');
    model = await inferDictionary(engine, profile);
  });

  const dim = (column: string) => model.dimensions.find((d) => d.column === column);

  test('a name in the column name makes it private', () => {
    expect(dim('full_name')).toMatchObject({ role: 'category', private: true });
  });

  test('values that look like emails or phone numbers make it private', () => {
    expect(dim('contact')).toMatchObject({ role: 'category', private: true });
    expect(dim('reach_on')).toMatchObject({ role: 'category', private: true });
  });

  test('entities are private and free text is hidden', () => {
    expect(dim('club_no')).toMatchObject({ role: 'entity', private: true });
    expect(model.hidden).toEqual(['person_id', 'note']);
  });

  test('an ordinary category is not private', () => {
    expect(dim('tier')).toMatchObject({ private: false });
  });

  test('the unique identifier names the row count', () => {
    expect(model.metrics[0]).toMatchObject({ label: 'Persons', column: null, agg: 'count' });
  });
});
