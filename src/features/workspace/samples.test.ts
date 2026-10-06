// The registry must describe the files the generators wrote, and the glance
// query must read the row counts the truth files recorded.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { glanceSql, readGlance } from '@/core/profile/glance';
import { RETAIL } from '../../../data/generators/retail';
import { SAAS } from '../../../data/generators/saas';
import { SUPPORT } from '../../../data/generators/support';
import { SAMPLES } from './samples';

const specs = { retail: RETAIL, saas: SAAS, support: SUPPORT };

let engine: QueryEngine;
beforeAll(async () => {
  engine = await createNodeEngine();
});
afterAll(async () => {
  await engine.close();
});

describe.each(SAMPLES)('$id', (sample) => {
  const spec = specs[sample.id];
  const truth = JSON.parse(readFileSync(`data/demo/${sample.id}/truth.json`, 'utf8'));

  test('matches its generator', () => {
    expect(sample.name).toBe(spec.name);
    expect(sample.table).toBe(spec.table);
    const time = spec.columns.find((c) => c.name === sample.timeColumn);
    expect(time?.sqlType).toMatch(/^(DATE|TIMESTAMP)$/);
  });

  test('the glance reads the rows the truth file recorded', async () => {
    const columns = await engine.registerFile(sample.table, {
      kind: 'path',
      path: `data/demo/${sample.id}/${sample.table}.parquet`,
      format: 'parquet',
    });
    const glance = readGlance(
      await engine.query(glanceSql(sample.table, sample.timeColumn)),
      columns,
    );
    expect(glance.rows).toBe(truth.summary.rows.realised);
    expect(glance.columns).toBe(spec.columns.length);
    expect(glance.firstDay).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(glance.lastDay! > glance.firstDay!).toBe(true);
  });
});
