// Role and metric rules on hand-built profiles. Engine-backed tests on the
// samples and the private-column fixture are in tests/model.

import { describe, expect, test } from 'vitest';
import type { ColumnProfile, Profile } from '@/core/profile/profile';
import { assignRoles, defaultGrain, inferModel, snapshotEntities } from './infer';
import { humanize, isIdName, nameHas, plural, slug, tokens } from './words';

function col(name: string, over: Partial<ColumnProfile>): ColumnProfile {
  return {
    name,
    storageType: over.type ?? 'text',
    type: 'text',
    empty: 0,
    distinct: 10,
    refinement: null,
    numeric: null,
    temporal: null,
    categorical: null,
    ...over,
  };
}

const num = (min: number, median: number, p95: number) => ({
  min,
  max: p95 * 2,
  mean: median,
  median,
  p05: min,
  p95,
  zeroShare: 0,
  negativeShare: 0,
});

const days = (min: string, max: string, distinctDays: number) => ({
  min,
  max,
  distinctDays,
  gapDays: 0,
});

function profile(columns: ColumnProfile[], rows = 1000, table = 'sales'): Profile {
  return { table, rows, columns, sql: [] };
}

describe('words', () => {
  test('names split on case and punctuation', () => {
    expect(tokens('firstResponse_minutes')).toEqual(['first', 'response', 'minutes']);
  });
  test('plurals and past tenses match their word; parts of words do not', () => {
    expect(nameHas('is_returned', ['return'])).toBe(true);
    expect(nameHas('agent_count', ['age'])).toBe(false);
    expect(isIdName('paid')).toBe(false);
    expect(isIdName('customerId')).toBe(true);
    expect(isIdName('order_no')).toBe(true);
  });
  test('labels, plurals and ids', () => {
    expect(humanize(['discount', 'pct'])).toBe('Discount %');
    expect(humanize(['mrr'])).toBe('MRR');
    expect(plural('category')).toBe('categories');
    expect(plural('box')).toBe('boxes');
    expect(slug('Average discount %')).toBe('average_discount');
    expect(slug('2024 total')).toBe('m_2024_total');
  });
});

describe('roles', () => {
  test('first matching rule wins, in the order of analytics-spec §2.3', () => {
    const roles = assignRoles(
      profile([
        col('sale_id', { distinct: 1000 }),
        col('row_number', { type: 'integer', distinct: 1000 }),
        col('sold_on', { type: 'date', temporal: days('2024-01-01', '2024-03-31', 91) }),
        col('shipped_on', { type: 'date', temporal: days('2024-01-02', '2024-04-02', 91) }),
        col('store_id', { distinct: 120 }),
        col('store_code', { type: 'integer', distinct: 12 }),
        col('amount', { type: 'decimal', numeric: num(1, 20, 80) }),
        col('year', { type: 'integer', distinct: 3 }),
        col('lat', { type: 'decimal', distinct: 900 }),
        col('colour', { distinct: 7 }),
        col('city', { distinct: 40, empty: 10 }),
        col('note', { distinct: 800 }),
        col('blank', { empty: 1000, distinct: 0 }),
      ]),
    );
    expect(Object.fromEntries(roles)).toEqual({
      sale_id: 'identifier',
      row_number: 'identifier',
      sold_on: 'time',
      shipped_on: 'other',
      store_id: 'entity',
      store_code: 'category',
      amount: 'measure',
      year: 'category',
      lat: 'other',
      colour: 'category',
      city: 'category',
      note: 'free_text',
      blank: 'other',
    });
  });

  test('a date with fewer than 14 days is not the time column', () => {
    const roles = assignRoles(
      profile([col('day', { type: 'date', temporal: days('2024-01-01', '2024-01-10', 10) })]),
    );
    expect(roles.get('day')).toBe('other');
  });

  test('among dates, a hinted name beats more distinct days', () => {
    const roles = assignRoles(
      profile([
        col('updated', { type: 'timestamp', temporal: days('2024-01-01', '2024-12-31', 366) }),
        col('created', { type: 'timestamp', temporal: days('2024-01-01', '2024-06-30', 180) }),
      ]),
    );
    expect(roles.get('created')).toBe('time');
  });
});

describe('metrics', () => {
  const shop = profile(
    [
      col('order_date', { type: 'date', temporal: days('2024-01-01', '2024-12-31', 366) }),
      col('order_id', { distinct: 1000 }),
      col('revenue', { type: 'decimal', numeric: num(0, 50, 200) }),
      col('cost', { type: 'decimal', numeric: num(0, 30, 120) }),
      col('units', { type: 'integer', numeric: num(1, 2, 5) }),
      col('rating', { type: 'integer', numeric: num(1, 4, 5), distinct: 5 }),
      col('weight', { type: 'decimal', numeric: num(0, 1, 500) }),
      col('balance', { type: 'decimal', numeric: num(-5, 10, 30) }),
      col('promo_pct', { type: 'decimal', numeric: { ...num(0, 0.1, 0.3), max: 0.5 } }),
      col('wait_minutes', { type: 'integer', numeric: num(0, 4, 20) }),
      col('refunded', { type: 'boolean' }),
    ],
    1000,
    'orders',
  );
  const model = inferModel(shop);
  const metric = (id: string) => model.metrics.find((m) => m.id === id);

  test('the row count is named after a unique identifier', () => {
    expect(model.metrics[0]).toMatchObject({ id: 'orders', label: 'Orders', importance: 0.7 });
  });

  test('aggregation follows the name, then the shape of the values', () => {
    expect(metric('revenue')).toMatchObject({ agg: 'sum', importance: 1 });
    expect(metric('units')).toMatchObject({ agg: 'sum' });
    expect(metric('average_rating')).toMatchObject({ agg: 'avg', direction: 'neutral' });
    expect(metric('average_weight')).toMatchObject({ agg: 'avg' }); // skewed
    expect(metric('average_balance')).toMatchObject({ agg: 'avg' }); // negatives
  });

  test('formats: money, durations, fractions as percentages', () => {
    expect(metric('revenue')?.format).toEqual({ style: 'currency' });
    expect(metric('average_wait_minutes')?.format).toEqual({ style: 'duration', unit: 'minutes' });
    expect(metric('average_promo')?.format).toEqual({ style: 'percent', decimals: 1 });
  });

  test('a boolean becomes a rate over rows', () => {
    expect(metric('refunded_rate')).toMatchObject({
      kind: 'ratio',
      numerator: 'refunded_rows',
      denominator: 'orders',
      direction: 'lower_better',
      importance: 0.6,
      format: { style: 'percent' },
    });
    expect(metric('refunded_rows')).toMatchObject({
      where: [{ dimension: 'refunded', op: 'in', values: ['true'] }],
    });
  });

  test('derived ratios: margin through gross profit, average order value, average price', () => {
    expect(metric('gross_profit')).toMatchObject({
      kind: 'difference',
      minuend: 'revenue',
      subtrahend: 'cost',
    });
    expect(metric('margin')).toMatchObject({
      numerator: 'gross_profit',
      denominator: 'revenue',
      format: { style: 'percent' },
      importance: 0.8,
    });
    expect(metric('average_order_value')).toMatchObject({
      numerator: 'revenue',
      denominator: 'orders',
      format: { style: 'currency' },
    });
    expect(metric('average_price')).toMatchObject({ numerator: 'revenue', denominator: 'units' });
    expect(metric('cost')).toMatchObject({ direction: 'lower_better', importance: 0.8 });
  });

  test('the time column carries its range and default grain', () => {
    expect(model.time).toEqual({
      id: 'order_date',
      label: 'Order date',
      column: 'order_date',
      min: '2024-01-01',
      max: '2024-12-31',
      defaultGrain: 'month',
    });
    expect(model.hidden).toEqual(['order_id']);
  });

  test('a snapshot rolls sums and the row count up as the last period', () => {
    const snap = inferModel(shop, { snapshotEntities: ['order_id'] });
    const byId = (id: string) => snap.metrics.find((m) => m.id === id);
    expect(byId('orders')).toMatchObject({ overTime: 'last' });
    expect(byId('revenue')).toMatchObject({ overTime: 'last' });
    expect(byId('average_rating')).toMatchObject({ overTime: 'sum' });
  });
});

describe('helpers', () => {
  test('default grain by span: month from 90 days, week from 21', () => {
    expect(defaultGrain('2024-01-01', '2024-03-30')).toBe('month');
    expect(defaultGrain('2024-01-01', '2024-03-29')).toBe('week');
    expect(defaultGrain('2024-01-01', '2024-01-21T10:00:00')).toBe('week');
    expect(defaultGrain('2024-01-01', '2024-01-20')).toBe('day');
  });

  test('snapshot entities need 99% unique pairs over 3 or more periods', () => {
    const result = {
      columns: [
        { name: 'entity', type: 'text' as const, nullable: false },
        { name: 'unique_share', type: 'decimal' as const, nullable: false },
        { name: 'periods', type: 'integer' as const, nullable: false },
      ],
      rows: [
        ['a', 0.995, 24],
        ['b', 0.98, 24],
        ['c', 1, 2],
      ],
      rowCount: 3,
      elapsedMs: 0,
    };
    expect(snapshotEntities(result)).toEqual(['a']);
  });
});
