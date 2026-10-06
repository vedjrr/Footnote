// A user's file must load with the network cut after the page has loaded:
// no extension or bundle may be fetched at that point (architecture §4).

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { expect, test } from '@playwright/test';

const dir = mkdtempSync(join(tmpdir(), 'footnote-offline-'));
const csv =
  'order_id,order_date,region,revenue\n1,2024-01-05,north,120.50\n2,2024-01-06,south,80.00\n3,2024-02-01,north,42.25\n';

test.beforeAll(async () => {
  writeFileSync(join(dir, 'orders.csv'), csv);
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();
  const csvPath = join(dir, 'orders.csv').replaceAll("'", "''");
  await conn.run(
    `COPY (SELECT * FROM read_csv('${csvPath}')) TO '${join(dir, 'orders.parquet')}' (FORMAT parquet)`,
  );
  await conn.run(
    `COPY (SELECT * FROM read_csv('${csvPath}')) TO '${join(dir, 'orders.json')}' (FORMAT json, ARRAY true)`,
  );
  conn.closeSync();
  instance.closeSync();
});

for (const file of ['orders.csv', 'orders.parquet', 'orders.json']) {
  test(`loads ${file} with the network off`, async ({ page, context, baseURL }) => {
    const beforeOffline: string[] = [];
    const afterOffline: string[] = [];
    let offline = false;
    page.on('request', (r) => (offline ? afterOffline : beforeOffline).push(r.url()));

    await page.goto('/dev/engine');
    await expect(page.getByTestId('status')).toHaveText(/^ready: duckdb/, { timeout: 60_000 });
    // Everything the engine needed came from this site (Q-01).
    expect(beforeOffline.filter((url) => !url.startsWith(baseURL!))).toEqual([]);
    expect(beforeOffline.some((url) => url.includes('/duckdb/extensions/'))).toBe(true);

    offline = true;
    await context.setOffline(true);
    await page.getByLabel('Data file').setInputFiles(join(dir, file));

    await expect(page.getByTestId('loaded')).toHaveText(
      'loaded 3 rows: order_id integer, order_date date, region text, revenue decimal',
    );
    expect(afterOffline).toEqual([]);
  });
}
