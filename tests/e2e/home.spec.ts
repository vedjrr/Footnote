import { expect, test } from '@playwright/test';

// The engine downloads and starts in this test, so allow it time.
test.setTimeout(90_000);

test('home shows the retail sample, and switching sample updates the facts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Harbour & Pine');
  await expect(page.getByTestId('row-count')).toHaveText('59,881', { timeout: 60_000 });

  await page.getByRole('button', { name: /^Workspace:/ }).click();
  await page.getByRole('menuitemradio', { name: /Slotwise/ }).click();

  await expect(page).toHaveURL(/\/w\/saas\/briefing$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Slotwise');
  await expect(page.getByTestId('row-count')).toHaveText('56,352', { timeout: 30_000 });
});

test('a mark opens its working paper with the SQL that ran', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/w/support/briefing');
  const mark = page.getByRole('button', { name: /^Note 1:/ });
  await expect(mark).toBeVisible({ timeout: 60_000 });
  await mark.click();
  const paper = page.getByRole('complementary', { name: 'Working paper' });
  await expect(paper.getByRole('heading', { name: /Rows in the file/ })).toBeVisible();
  await paper.getByText('SQL', { exact: true }).click();
  await expect(paper.locator('pre')).toContainText('FROM "tickets"');
});

test('an unknown workspace is not found', async ({ page }) => {
  const response = await page.goto('/w/nothing/briefing');
  expect(response?.status()).toBe(404);
});
