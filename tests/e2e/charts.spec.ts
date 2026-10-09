// Chart components on the styleguide (NFR-05, ui-ux-rules §7 and §11): no
// text in a chart is clipped or overlaps other text at phone width, Tab
// reaches every chart, the arrow keys move between points, and every chart
// switches to a table.

import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90_000);

const charts = '[role="group"][aria-roledescription="chart"]';

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/styleguide');
  await expect(page.getByRole('heading', { level: 2, name: 'Charts' })).toBeVisible();
  // Wait for the browser to measure the charts and lay them out again.
  await page.waitForFunction(() => {
    const svg = document.querySelector('svg[data-plot]');
    if (!svg) return false;
    const viewWidth = Number(svg.getAttribute('viewBox')?.split(' ')[2]);
    return Math.abs(viewWidth - svg.getBoundingClientRect().width) < 1;
  });
}

/** Text outside its chart, or text on top of other text, per chart. */
async function textProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    document.querySelectorAll('svg[data-plot]').forEach((svg, n) => {
      const box = svg.getBoundingClientRect();
      const texts = [...svg.querySelectorAll('text')]
        .map((t) => ({ text: t.textContent, r: t.getBoundingClientRect() }))
        .filter((t) => t.r.width > 0);
      for (const { text, r } of texts) {
        if (
          r.left < box.left - 0.5 ||
          r.right > box.right + 0.5 ||
          r.top < box.top - 0.5 ||
          r.bottom > box.bottom + 0.5
        ) {
          issues.push(`chart ${n}: "${text}" leaves the chart`);
        }
      }
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i].r;
          const b = texts[j].r;
          const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (x > 1 && y > 1)
            issues.push(`chart ${n}: "${texts[i].text}" overlaps "${texts[j].text}"`);
        }
      }
    });
    if (document.documentElement.scrollWidth > window.innerWidth) {
      issues.push('the page scrolls sideways');
    }
    return issues;
  });
}

for (const width of [390, 834, 1440]) {
  test(`no chart text clips or overlaps at ${width} px`, async ({ page }) => {
    await open(page, width);
    expect(await page.locator('svg[data-plot]').count()).toBe(17);
    expect(await textProblems(page)).toEqual([]);
  });
}

test('Tab reaches every chart', async ({ page }) => {
  await open(page, 390);
  const total = await page.locator(charts).count();
  await page.evaluate(() => {
    const p = document.querySelector('#charts + p') as HTMLElement;
    p.tabIndex = -1;
    p.focus();
  });
  const reached = new Set<string>();
  for (let i = 0; i < 80 && reached.size < total; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate((selector) => {
      const el = document.activeElement;
      if (!el?.matches(selector)) return null;
      return [...document.querySelectorAll(selector)].indexOf(el).toString();
    }, charts);
    if (id !== null) reached.add(id);
  }
  expect(reached.size).toBe(total);
});

test('arrow keys move between points and read each one out', async ({ page }) => {
  await open(page, 834);
  const chart = page.getByRole('group', { name: /^Revenue by month from January 2023/ });
  await chart.focus();
  const live = chart.locator('xpath=..').locator('[aria-live="polite"]');
  // Focus starts on the point the sentence is about: February 2025.
  await expect(live).toHaveText('Feb 2025. 476,320 GBP');
  await page.keyboard.press('ArrowRight');
  await expect(live).toHaveText('Mar 2025. 438,441 GBP');
  await page.keyboard.press('ArrowRight');
  await expect(live).toHaveText('Mar 2025. 438,441 GBP');
  await page.keyboard.press('Home');
  await expect(live).toHaveText('Jan 2023. 446,158 GBP');
  await page.keyboard.press('ArrowDown');
  await expect(live).toHaveText('Feb 2023. 437,930 GBP');
  await page.keyboard.press('Escape');
  await expect(live).toHaveText('');

  const bars = page.getByRole('group', {
    name: /^Electronics revenue in March 2025 by channel and region\. Online/,
  });
  await bars.focus();
  const barsLive = bars.locator('xpath=..').locator('[aria-live="polite"]');
  await expect(barsLive).toHaveText('Online orders in the West. 13,480 GBP');
  await page.keyboard.press('ArrowDown');
  await expect(barsLive).toHaveText('Online orders in the North. 13,034 GBP');
});

test('hover shows one tooltip listing every series', async ({ page }) => {
  await open(page, 1440);
  const chart = page.getByRole('group', {
    name: /^Revenue by region from April 2024 to March 2025\. West/,
  });
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const live = chart.locator('xpath=..').locator('[aria-live="polite"]');
  await expect(live).toContainText('West');
  await expect(live).toContainText('South');
});

test('every chart switches to a table and back', async ({ page }) => {
  await open(page, 834);
  const buttons = page.getByRole('button', { name: 'Show as table' });
  const count = await buttons.count();
  expect(count).toBe(17 - 1); // the sparkline sits beside its figure, without a frame
  const first = page.locator('figure[data-chart]').first();
  await first.getByRole('button', { name: 'Show as table' }).click();
  await expect(first.locator('table')).toBeVisible();
  await expect(first.locator('tbody tr')).toHaveCount(27);
  await expect(first.locator('tbody tr').last()).toContainText('438,441 GBP');
  await first.getByRole('button', { name: 'Show as chart' }).click();
  await expect(first.locator('svg[data-plot]')).toBeVisible();
});

test('empty charts say so in a sentence', async ({ page }) => {
  await open(page, 834);
  await expect(
    page.getByText('This file has no date column, so there are no months to draw.'),
  ).toBeVisible();
  await expect(page.getByText('Nothing changed between the two months.')).toBeVisible();
});
