// The metrics screen (FR-13, FR-14): the sample dictionary is listed, a ratio
// metric can be added with the keyboard alone and survives navigating away
// and back, an edit can be made and cancelled, and a broken YAML file says
// which line is wrong without changing anything.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90_000);

const dir = mkdtempSync(join(tmpdir(), 'footnote-metrics-'));

async function openMetrics(page: Page) {
  await page.goto('/w/retail/metrics');
  await expect(page.getByRole('heading', { level: 1, name: 'Metrics' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Revenue', exact: true })).toBeVisible({
    timeout: 60_000,
  });
}

/** Presses Tab until `target` has focus, so the test proves it is reachable by keyboard. */
async function tabTo(page: Page, name: string | RegExp, role: 'button' | 'textbox' | 'combobox') {
  const target = page.getByRole(role, { name, exact: typeof name === 'string' });
  for (let i = 0; i < 200; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Could not reach ${name} with Tab`);
}

test('lists the hand-written metrics with their definitions', async ({ page }) => {
  await openMetrics(page);
  const revenue = page.locator('[data-metric="revenue"]');
  await expect(revenue).toContainText('Revenue is the sum of revenue.');
  await expect(revenue).toContainText('sum(revenue)');
  await expect(revenue).toContainText('Money (GBP)');
  await expect(revenue).toContainText('sales, turnover, takings, income');
  await expect(page.getByRole('heading', { level: 3, name: 'Customer segment' })).toBeVisible();
  await expect(page.getByText('Order date (column order_date) dates each row.')).toBeVisible();
});

test('adds "Average discount" by keyboard and keeps it after navigating', async ({ page }) => {
  await openMetrics(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });

  await tabTo(page, 'Name', 'textbox');
  // The first Name field on the page is the add form's when nothing is being edited.
  await page.keyboard.type('Average discount');
  await page.keyboard.press('Tab');
  const divide = page.getByRole('combobox', { name: 'Divide' });
  await expect(divide).toBeFocused();
  await divide.selectOption({ label: 'Cost' });
  await page.keyboard.press('Tab');
  const by = page.getByRole('combobox', { name: 'By' });
  await expect(by).toBeFocused();
  await by.selectOption({ label: 'Revenue' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add metric' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('status').filter({ hasText: 'Added Average discount.' }),
  ).toBeVisible();
  const added = page.locator('[data-metric="average_discount"]');
  await expect(added).toContainText('Average discount is Cost divided by Revenue.');
  await expect(added).toContainText('Percentage');

  await page.getByRole('link', { name: 'Briefing' }).first().click();
  await expect(page).toHaveURL(/\/w\/retail\/briefing$/);
  await page.getByRole('link', { name: 'Metrics' }).first().click();
  await expect(page).toHaveURL(/\/w\/retail\/metrics$/);
  await expect(page.locator('[data-metric="average_discount"]')).toContainText(
    'Average discount is Cost divided by Revenue.',
  );
});

test('edits by keyboard: rename, add a synonym, Escape cancels', async ({ page }) => {
  await openMetrics(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await tabTo(page, 'Edit Cost', 'button');
  await page.keyboard.press('Enter');
  const name = page.getByRole('textbox', { name: 'Name' }).first();
  await expect(name).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit Cost' })).toBeFocused();

  await page.keyboard.press('Enter');
  await name.fill('Cost of goods');
  await page.getByRole('textbox', { name: 'Add a name' }).fill('landed cost');
  await page.getByRole('textbox', { name: 'Add a name' }).press('Enter');
  await page.getByRole('button', { name: 'Save', exact: true }).focus();
  await page.keyboard.press('Enter');
  const cost = page.locator('[data-metric="cost"]');
  await expect(cost.getByRole('heading', { level: 3 })).toHaveText('Cost of goods');
  await expect(cost).toContainText('landed cost');
});

test('hides a column and brings it back', async ({ page }) => {
  await openMetrics(page);
  await page.getByRole('button', { name: 'Hide Channel' }).click();
  await expect(page.locator('[data-dimension="channel"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show channel' }).click();
  await expect(page.locator('[data-dimension="channel"]')).toHaveCount(1);
});

test('a broken YAML file names the line and changes nothing', async ({ page }) => {
  await openMetrics(page);
  const file = join(dir, 'broken.yaml');
  writeFileSync(
    file,
    [
      'table: orders',
      'version: 1',
      'time: null',
      'metrics:',
      '  - kind: simple',
      '    id: revenue',
      '    label: Revenue',
      '    column: revenue',
      '    agg: total',
      '    format: { style: number }',
      '    direction: higher_better',
      '    importance: 1',
      '',
    ].join('\n'),
  );
  await page.getByTestId('yaml-input').setInputFiles(file);
  const alert = page.getByRole('alert').filter({ hasText: 'was not loaded' });
  await expect(alert).toContainText('broken.yaml was not loaded.');
  await expect(alert).toContainText('Line 9:');
  await expect(page.locator('[data-metric="return_rate"]')).toHaveCount(1);

  const good = join(dir, 'small.yaml');
  writeFileSync(good, readFileSync(file, 'utf8').replace('agg: total', 'agg: sum'));
  await page.getByTestId('yaml-input').setInputFiles(good);
  await expect(
    page.getByRole('status').filter({ hasText: 'Loaded small.yaml: 1 metric and' }),
  ).toBeVisible();
  await expect(page.locator('[data-metric]')).toHaveCount(1);
});
