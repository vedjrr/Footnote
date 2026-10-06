import { expect, test, type Page } from '@playwright/test';

// The reference mark and highlight (ui-ux-rules §6, §8) on /styleguide.

const paper = (page: Page) => page.locator('#styleguide-working-paper');
const mark = (page: Page, n: number) =>
  page
    .locator('#styleguide-working-paper')
    .locator('..')
    .locator(`button.fn-mark[data-note="${n}"]`);

function wipeDuration(page: Page, n: number) {
  return mark(page, n)
    .locator('.fn-number')
    .evaluate((el) => getComputedStyle(el, '::before').transitionDuration);
}

test('selecting a mark with the mouse highlights the number and its evidence', async ({ page }) => {
  await page.goto('/styleguide');
  const one = mark(page, 1);
  await expect(one).toHaveAttribute('aria-expanded', 'false');
  await expect(one).toHaveAttribute('aria-controls', 'styleguide-working-paper');
  await expect(one).toHaveAccessibleName('Note 1: how 7.4% was computed');

  await one.click();
  await expect(one).toHaveAttribute('aria-expanded', 'true');
  await expect(paper(page)).toContainText('Revenue, March 2025 against February');
  const cell = paper(page).locator('.fn-highlight[data-note="1"]');
  await expect(cell).toHaveAttribute('data-active', '');
  await expect(cell).toHaveText('−7.4%');
  expect(await wipeDuration(page, 1)).toBe('0.18s');

  // Selecting another mark moves the highlight; selecting it again clears it.
  await mark(page, 3).click();
  await expect(one).toHaveAttribute('aria-expanded', 'false');
  await expect(paper(page).locator('.fn-highlight[data-note="3"]')).toHaveAttribute(
    'data-active',
    '',
  );
  await mark(page, 3).click();
  await expect(mark(page, 3)).toHaveAttribute('aria-expanded', 'false');
  await expect(paper(page)).toContainText('The data at a glance');
});

test('marks work from the keyboard', async ({ page }) => {
  await page.goto('/styleguide');
  // Tab from the start of the page until the first mark has focus.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    if (await mark(page, 1).evaluate((el) => el === document.activeElement)) break;
  }
  await expect(mark(page, 1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(mark(page, 1)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(mark(page, 2)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(mark(page, 2)).toHaveAttribute('aria-expanded', 'true');
  await expect(paper(page).locator('.fn-highlight[data-note="2"]')).toHaveAttribute(
    'data-active',
    '',
  );
});

test('the clickable area of a mark is at least 24 by 24 px', async ({ page }) => {
  await page.goto('/styleguide');
  const box = await mark(page, 1).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const after = getComputedStyle(el, '::after');
    return {
      width: r.width - parseFloat(after.left) - parseFloat(after.right),
      height: r.height - parseFloat(after.top) - parseFloat(after.bottom),
    };
  });
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the highlight appears without movement', async ({ page }) => {
    await page.goto('/styleguide');
    await mark(page, 1).click();
    await expect(mark(page, 1)).toHaveAttribute('aria-expanded', 'true');
    expect(await wipeDuration(page, 1)).toBe('0s');
    const transform = await mark(page, 1)
      .locator('.fn-number')
      .evaluate((el) => getComputedStyle(el, '::before').transform);
    expect(transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
  });
});

for (const kind of ['panel', 'sheet']) {
  test(`the ${kind} takes focus, closes on Esc and returns focus`, async ({ page }) => {
    await page.goto('/styleguide');
    const open = page.getByRole('button', { name: `Open ${kind}` });
    await open.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Revenue is the sum of revenue.');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });
}

test('the theme choice is applied and remembered', async ({ page }) => {
  await page.goto('/styleguide');
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeVisible();
});
