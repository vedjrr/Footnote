// Answers in the Ask view (FR-40 to FR-42): selecting a mark, by mouse or
// keyboard, highlights the number and its cell in the working paper; the
// SQL the working paper shows, pasted into DuckDB, returns the number; a
// failed check replaces the sentence with the problem.

import { expect, test, type Page } from '@playwright/test';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { Cell, QueryEngine } from '@/core/engine/types';

test.setTimeout(120_000);

const SAMPLES = [
  { id: 'retail', table: 'orders' },
  { id: 'saas', table: 'subscriptions' },
  { id: 'support', table: 'tickets' },
];

let engines: Map<string, QueryEngine>;

test.beforeAll(async () => {
  engines = new Map();
  for (const s of SAMPLES) {
    const engine = await createNodeEngine();
    await engine.registerFile(s.table, {
      kind: 'path',
      format: 'parquet',
      path: `data/demo/${s.id}/${s.table}.parquet`,
    });
    engines.set(s.id, engine);
  }
});

test.afterAll(async () => {
  for (const e of engines.values()) await e.close();
});

async function openAsk(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'Ask' })).toBeVisible();
  await expect(page.locator('#starters ~ ul button').first()).toBeVisible({ timeout: 60_000 });
}

async function ask(page: Page, question: string) {
  await page.getByRole('button', { name: question, exact: true }).click();
  const heading = page.getByRole('heading', { level: 2, name: question });
  await expect(heading).toBeFocused({ timeout: 60_000 });
  return page.locator('article[data-answer]', { has: heading });
}

/** A number as the working paper writes it, as a plain number: "−8.2 pts" is −0.082. */
function parse(text: string): number {
  const t = text.replace(/,/g, '').replace('−', '-').replace('+', '');
  const n = parseFloat(t);
  return /%|pts/.test(t) ? n / 100 : n;
}

function close(a: number, b: number, decimals: number): boolean {
  return Math.abs(a - b) <= 0.5 * 10 ** -decimals + 1e-9;
}

for (const sample of SAMPLES) {
  test(`${sample.id}: every mark of every starter links to a cell the pasted SQL returns`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAsk(page, `/w/${sample.id}/ask`);
    const labels = await page.locator('#starters ~ ul button').allTextContents();
    expect(labels).toHaveLength(3);
    const paper = page.getByRole('complementary', { name: 'Working paper' });

    for (const label of labels) {
      const answer = await ask(page, label);
      const marks = answer.locator('.fn-mark');
      const count = await marks.count();
      expect(count, label).toBeGreaterThan(0);

      let cells: Cell[] = [];
      for (let i = 0; i < count; i++) {
        const mark = marks.nth(i);
        await mark.click();
        await expect(mark).toHaveAttribute('aria-expanded', 'true');
        await expect(mark.locator('.fn-number')).toBeVisible();
        const lit = paper.locator('[data-cell="linked"] .fn-highlight[data-active]');
        await expect(lit, `${label}, mark ${i + 1}`).toHaveCount(1);
        if (i === 0) {
          // The SQL as the working paper shows it, run on its own.
          await paper.getByText('SQL', { exact: true }).click();
          const sql = await paper.getByTestId('answer-sql').textContent();
          cells = (await engines.get(sample.id)!.query(sql!)).rows.flat();
        }
        const text = (await lit.textContent())!;
        const decimals =
          (text.replace(/[^\d.]/g, '').split('.')[1] ?? '').length + (/%|pts/.test(text) ? 2 : 0);
        const value = parse(text);
        const found = cells.some((c) => typeof c === 'number' && close(c, value, decimals));
        expect(found, `${label}: ${text} is in the pasted result`).toBe(true);
      }
    }
  });
}

test('keyboard: a mark opens the panel on a tablet, Esc closes it and focus returns', async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 1000 });
  await openAsk(page, '/w/retail/ask');
  await ask(page, 'Which categories moved revenue last month?');
  // Not found by role: the page behind the open panel is hidden from it.
  const mark = page.locator('.fn-mark[data-note="1"]');
  await mark.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Change in revenue, Electronics, March 2025');
  await expect(panel.locator('.fn-highlight[data-active]')).toHaveCount(1);
  await expect(mark).toHaveAttribute('aria-expanded', 'true');
  expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(mark).toBeFocused();
});

test('keyboard: Tab reaches the marks in reading order and Enter selects one', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAsk(page, '/w/saas/ask');
  const answer = await ask(page, 'Churn rate by plan last month');
  // Focus is on the question; the next stops are the marks, in order.
  for (const n of [1, 2, 3]) {
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-note', String(n));
  }
  await page.keyboard.press('Enter');
  const paper = page.getByRole('complementary', { name: 'Working paper' });
  await expect(paper).toContainText('Churn rate, Starter, December 2024');
  await expect(paper.locator('[data-cell="linked"] .fn-highlight[data-active]')).toHaveCount(1);
  await expect(answer.locator('[data-note="3"]')).toHaveAttribute('aria-expanded', 'true');
});

test('phone: a mark opens the working paper as a sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAsk(page, '/w/support/ask');
  const answer = await ask(page, 'SLA breach rate by team last month');
  await answer.locator('.fn-mark').first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.fn-highlight[data-active]')).toHaveCount(1);
  await sheet.getByText('Rows behind it').click();
  await expect(sheet).toContainText('rows are behind this number', { timeout: 30_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('a failed check replaces the sentence with the problem', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAsk(page, '/dev/answer');
  const answer = await ask(page, 'Revenue in the Nrth region');
  await expect(answer).toContainText('a check on the result failed');
  await expect(answer).toContainText('No row has region "Nrth". Closest values: "North"');
  await expect(answer.getByTestId('answer-sentence')).toHaveCount(0);
  await expect(answer.locator('.fn-mark')).toHaveCount(0);
  await answer.getByRole('button', { name: 'Show the working paper' }).click();
  const paper = page.getByRole('complementary', { name: 'Working paper' });
  await expect(paper).toContainText('Problem.');
  await expect(paper.getByTestId('answer-sql')).toHaveCount(1);
});
