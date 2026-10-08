// Use your own file (FR-02, NFR-02): a file becomes a workspace with the right
// row count, each failure shows its message, and choosing a file makes no
// network request at all once the page has loaded.

import { closeSync, mkdtempSync, openSync, ftruncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { expect, test, type Page, type Request } from '@playwright/test';

test.setTimeout(90_000);

const dir = mkdtempSync(join(tmpdir(), 'footnote-upload-'));
const path = (name: string) => join(dir, name);

// Values chosen so they cannot appear in any request by chance.
const CSV = [
  'order_day,region,revenue',
  '2024-03-01,Quillmoor,120.50',
  '2024-03-02,Ashcombe,80.00',
  '2024-03-09,Quillmoor,42.25',
].join('\n');

test.beforeAll(async () => {
  writeFileSync(path('sales.csv'), CSV + '\n');
  writeFileSync(path('book.xlsx'), 'not a spreadsheet');
  writeFileSync(path('blank.csv'), '');
  writeFileSync(path('raw.csv'), '1,2024-01-01,3.5\n2,2024-01-02,4.5\n');
  writeFileSync(path('ragged.csv'), 'a,b,c\n1,2,3\n4,5,6,7\n');
  writeFileSync(path('short.csv'), 'a,b,c\n1,2,3\n4,5\n');
  writeFileSync(
    path('latin.csv'),
    Buffer.concat([Buffer.from('name,city\nJos'), Buffer.from([0xe9]), Buffer.from(',Leon\n')]),
  );
  // A sparse file: 301 MB on paper, nothing on disk.
  const big = openSync(path('huge.csv'), 'w');
  ftruncateSync(big, 301_000_000);
  closeSync(big);

  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();
  await conn.run(
    `COPY (SELECT range AS id, range % 7 AS bucket FROM range(1234)) TO '${path('events.parquet')}' (FORMAT parquet)`,
  );
  conn.closeSync();
  instance.closeSync();
});

/** Opens the screen and waits until every page asset, engine included, has loaded. */
async function openScreen(page: Page) {
  await page.goto('/open');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Use your own file');
  await page.waitForLoadState('networkidle');
}

async function choose(page: Page, file: string) {
  await page.getByLabel('Choose a file').setInputFiles(path(file));
}

test('a CSV opens with no network request, and its briefing counts its rows', async ({
  page,
  baseURL,
}) => {
  await openScreen(page);
  const requests: Request[] = [];
  page.on('request', (r) => requests.push(r));

  await choose(page, 'sales.csv');
  await expect(page.getByTestId('file-open')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('sales.csv is open');
  expect(requests.map((r) => `${r.method()} ${r.url()}`)).toEqual([]);

  // Going to the briefing loads that route's page code, and nothing else.
  await page.getByRole('link', { name: 'Read the briefing' }).click();
  await expect(page).toHaveURL(/\/w\/file-1\/briefing$/);
  await expect(page.getByTestId('row-count')).toHaveText('3');
  for (const r of requests) {
    expect(r.url().startsWith(baseURL!)).toBe(true);
    expect(r.method()).toBe('GET');
    expect(r.url()).not.toMatch(/Quillmoor|Ashcombe|sales/);
  }

  await page.getByRole('button', { name: /^Workspace:/ }).click();
  await expect(page.getByRole('menuitemradio', { name: 'sales.csv' })).toBeChecked();
});

test('a Parquet file opens with its row count', async ({ page }) => {
  await openScreen(page);
  await choose(page, 'events.parquet');
  await page.getByRole('link', { name: 'Read the briefing' }).click({ timeout: 60_000 });
  await expect(page.getByTestId('row-count')).toHaveText('1,234');
});

const FAILURES: [string, RegExp][] = [
  ['book.xlsx', /^Problem\. book\.xlsx is an \.xlsx file, which cannot be read here\./],
  ['blank.csv', /^Problem\. blank\.csv is empty\./],
  ['huge.csv', /^Problem\. huge\.csv is 301 MB, and files up to 300 MB can be opened/],
  ['raw.csv', /^Problem\. This file has no header row\. Add column names as the first line/],
  ['ragged.csv', /^Problem\. Line 3 of ragged\.csv has 4 values, but the header names 3 columns\./],
  ['short.csv', /^Problem\. Line 3 of short\.csv has 2 values, but the header names 3 columns\./],
  ['latin.csv', /^Problem\. latin\.csv is not saved as UTF-8 text/],
];

test('each failure shows its message, and the screen stays ready for another file', async ({
  page,
}) => {
  await openScreen(page);
  for (const [file, message] of FAILURES) {
    await choose(page, file);
    await expect(page.getByTestId('open-failure')).toHaveText(message, { timeout: 60_000 });
  }
  await choose(page, 'sales.csv');
  await expect(page.getByTestId('file-open')).toBeVisible({ timeout: 60_000 });
});

test('a file workspace that is not open says so', async ({ page }) => {
  await page.goto('/w/file-7/briefing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This file is not open');
  await page.getByRole('link', { name: 'Use your own file' }).click();
  await expect(page).toHaveURL(/\/open$/);
});
