// The data health screen (FR-10, FR-11): each sample shows its planted
// problems in plain sentences, a mark opens the working paper with example
// rows and SQL, a clean file says nothing was found, and the glance in the
// working paper summarises health on other screens.

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90_000);

async function openHealth(page: Page, id: string) {
  await page.goto(`/w/${id}/health`);
  await expect(page.getByRole('heading', { level: 1, name: 'Data health' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'What each column holds' })).toBeVisible(
    { timeout: 60_000 },
  );
}

test('retail shows its planted problems, serious first', async ({ page }) => {
  await openHealth(page, 'retail');
  const checks = await page
    .locator('[data-check]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-check')));
  expect(checks[0]).toBe('H1');
  await expect(page.locator('[data-check="H1"]')).toContainText('719 rows (1.2%)');
  await expect(page.locator('[data-check="H1"]')).toContainText('repeat an earlier row exactly.');
  await expect(page.locator('[data-check="H4"]')).toContainText('"east" for "East"');
  await expect(page.locator('[data-check="H3"]')).toContainText('customer_segment is empty');
});

test('a mark opens the rows and SQL behind the count', async ({ page }) => {
  await openHealth(page, 'retail');
  await page.getByRole('button', { name: /^Note 1:/ }).click();
  const paper = page.getByRole('complementary', { name: 'Working paper' });
  await expect(paper).toContainText('Duplicate rows');
  await expect(paper).toContainText('719');
  await paper.getByText('Rows behind it').click();
  await expect(paper.locator('table').nth(1)).toContainText('copies');
  await paper.getByText('SQL', { exact: true }).click();
  await expect(paper.locator('pre')).toContainText('GROUP BY');
});

test('support reports empty csat as something to know, not a problem', async ({ page }) => {
  await openHealth(page, 'support');
  const known = page.getByRole('region', { name: 'Good to know' });
  await expect(known).toContainText('csat is empty in 23,769 rows (59.4%)');
  await expect(known).toContainText('Average CSAT uses only the rows with a value.');
  await expect(
    page.getByRole('region', { name: 'Fix before you rely on the numbers' }),
  ).toContainText('resolved_at is before created_at');
});

test('subscriptions shows seats 0 beside MRR', async ({ page }) => {
  await openHealth(page, 'saas');
  const zero = page.locator('[data-check="H12"]');
  await expect(zero).toContainText('seats is 0 while mrr is above 0 in 338 rows (0.6%)');
});

test('a clean file says nothing was found', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'footnote-health-'));
  const rows = ['day,kind,amount'];
  for (let i = 0; i < 91; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    rows.push(`${d},${i % 3 ? 'A' : 'B'},${10 + (i % 7)}`);
  }
  writeFileSync(join(dir, 'clean.csv'), rows.join('\n') + '\n');
  await page.goto('/open');
  await page.locator('input[type=file]').setInputFiles(join(dir, 'clean.csv'));
  await page.getByRole('link', { name: 'Read the briefing' }).click({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/w\/file-\d+\/briefing$/);
  await page.getByRole('link', { name: 'Data health', exact: true }).first().click();
  await expect(page).toHaveURL(/\/w\/file-\d+\/health$/);
  await expect(page.getByTestId('health-clean')).toContainText('found no duplicates', {
    timeout: 60_000,
  });
});

test('the glance summarises health on the briefing', async ({ page }) => {
  await page.goto('/w/saas/briefing');
  const paper = page.getByRole('complementary', { name: 'Working paper' });
  await expect(paper.getByRole('link', { name: '1 serious, 1 minor problems' })).toBeVisible({
    timeout: 60_000,
  });
});
