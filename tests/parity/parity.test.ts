// Runs every parity statement on the Node adapter. The normalised results are
// kept in expected.json; the browser test (tests/e2e/parity.spec.ts) compares
// the WASM adapter against the same file, so both adapters must agree.

import { afterAll, beforeAll, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { fixtureSql, loadStatements } from './statements';

let engine: QueryEngine;

beforeAll(async () => {
  engine = await createNodeEngine();
  await engine.query(fixtureSql);
});

afterAll(async () => {
  await engine.close();
});

test('there are at least 40 parity statements', () => {
  expect(loadStatements().length).toBeGreaterThanOrEqual(40);
});

test('node results match expected.json', async () => {
  const results: Record<string, unknown> = {};
  for (const s of loadStatements()) {
    const { columns, rows, rowCount } = await engine.query(s.sql, s.params);
    results[s.name] = { columns, rows, rowCount };
  }
  await expect(JSON.stringify(results, null, 1) + '\n').toMatchFileSnapshot('./expected.json');
});
