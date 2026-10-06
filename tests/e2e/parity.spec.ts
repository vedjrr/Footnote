// Runs the parity statements on the WASM adapter in a real browser and
// compares the normalised results with expected.json, which the Node adapter
// produces in tests/parity/parity.test.ts.

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectedPath, fixtureSql, loadStatements } from '../parity/statements';

test('wasm results match the node results for every parity statement', async ({ page }) => {
  test.setTimeout(120_000);
  const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as Record<string, unknown>;
  const statements = loadStatements();
  expect(Object.keys(expected).sort()).toEqual(statements.map((s) => s.name));

  await page.goto('/dev/engine');
  await expect(page.getByTestId('status')).toHaveText(/^ready: duckdb/, { timeout: 60_000 });

  await page.evaluate((sql) => window.footnoteEngine!.query(sql), fixtureSql);
  for (const s of statements) {
    const actual = await page.evaluate(async ({ sql, params }) => {
      try {
        const { columns, rows, rowCount } = await window.footnoteEngine!.query(sql, params);
        return { columns, rows, rowCount };
      } catch (err) {
        return { error: String(err) };
      }
    }, s);
    expect.soft(actual, s.name).toEqual(expected[s.name]);
  }
});
