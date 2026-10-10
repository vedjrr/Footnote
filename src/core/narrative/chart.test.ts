import { describe, expect, test } from 'vitest';
import type { Cell } from '@/core/engine/types';
import type { OutputColumn, OutputKind } from '@/core/query/compile';
import type { QuerySpecInput } from '@/core/query/spec';
import { MAX_MARKS, chooseChart, naturalOrder } from './chart';

/** A result shaped like the compiler's: period, splits, metrics, extras. */
function answer(spec: QuerySpecInput, rows: Cell[][]) {
  const columns: OutputColumn[] = [];
  const col = (name: string, kind: OutputKind, ref: string) => columns.push({ name, kind, ref });
  if (spec.time?.grain) col('period', 'period', 'period');
  for (const d of spec.by ?? []) col(d, 'dimension', d);
  for (const m of spec.metrics) col(m, 'metric', m);
  if (spec.compare) {
    for (const m of spec.metrics) {
      col(`${m}__previous`, 'previous', m);
      col(`${m}__change`, 'change', m);
      col(`${m}__change_pct`, 'change_pct', m);
    }
  }
  if (spec.calc === 'share_of_total') for (const m of spec.metrics) col(`${m}__share`, 'share', m);
  if (spec.calc === 'running_total')
    for (const m of spec.metrics) col(`${m}__running`, 'running', m);
  return { columns, rows };
}

const monthly = { grain: 'month', range: { kind: 'all' } } as const;
const months = (n: number) =>
  Array.from({ length: n }, (_, i) => `2024-${String(i + 1).padStart(2, '0')}-01`);
const regions = [
  'East',
  'North',
  'South',
  'West',
  'Central',
  'Islands',
  'Online',
  'Export',
  'Other',
];

describe('one value, or one value with a comparison: figures', () => {
  test('a total', () => {
    const spec = { metrics: ['revenue'] };
    expect(chooseChart(spec, answer(spec, [[1210655]])).form).toBe('figures');
  });

  test('a total against the previous period', () => {
    const spec: QuerySpecInput = { metrics: ['revenue'], compare: 'previous_period' };
    const plan = chooseChart(spec, answer(spec, [[100, 90, 10, 0.11]]));
    expect(plan.form).toBe('figures');
  });

  test('several totals, no split', () => {
    const spec = { metrics: ['revenue', 'orders', 'margin'] };
    expect(chooseChart(spec, answer(spec, [[1, 2, 3]])).form).toBe('figures');
  });

  test('two values split by a column are still two numbers', () => {
    const spec = { metrics: ['revenue'], by: ['channel'] };
    const plan = chooseChart(
      spec,
      answer(spec, [
        ['Online', 5],
        ['Store', 4],
      ]),
    );
    expect(plan.form).toBe('figures');
  });

  test('a series of one period', () => {
    const spec = { metrics: ['revenue'], time: monthly };
    expect(chooseChart(spec, answer(spec, [['2024-01-01', 5]])).form).toBe('figures');
  });

  test('no rows', () => {
    const spec = { metrics: ['revenue'], by: ['region'] };
    const plan = chooseChart(spec, answer(spec, []));
    expect(plan).toMatchObject({ form: 'figures', marks: 0 });
  });
});

describe('a series over time, up to 4 series: line', () => {
  test('one metric by month', () => {
    const spec = { metrics: ['revenue'], time: monthly };
    const rows = months(12).map((p, i) => [p, i * 10]);
    expect(chooseChart(spec, answer(spec, rows))).toMatchObject({
      form: 'line',
      series: [{ column: 'revenue' }],
      marks: 1,
    });
  });

  test('with a comparison, the comparison is the second line', () => {
    const spec: QuerySpecInput = {
      metrics: ['revenue'],
      time: monthly,
      compare: 'same_period_last_year',
    };
    const rows = months(6).map((p, i) => [p, i, i - 1, 1, 0.1]);
    const plan = chooseChart(spec, answer(spec, rows));
    expect(plan).toMatchObject({
      form: 'line',
      series: [{ column: 'revenue' }, { column: 'revenue__previous' }],
    });
  });

  test('a running total draws the running column', () => {
    const spec: QuerySpecInput = { metrics: ['revenue'], time: monthly, calc: 'running_total' };
    const rows = months(6).map((p, i) => [p, i, i * 2]);
    expect(chooseChart(spec, answer(spec, rows))).toMatchObject({
      form: 'line',
      series: [{ column: 'revenue__running' }],
    });
  });

  test('split by four values: four lines, largest total first', () => {
    const spec = { metrics: ['revenue'], by: ['region'], time: monthly };
    const totals: Record<string, number> = { East: 3, North: 1, South: 4, West: 2 };
    const rows = months(3).flatMap((p) => Object.entries(totals).map(([r, v]) => [p, r, v]));
    const plan = chooseChart(spec, answer(spec, rows));
    expect(plan.form).toBe('line');
    if (plan.form !== 'line') return;
    expect(plan.series.map((s) => s.split?.value)).toEqual(['South', 'East', 'West', 'North']);
    expect(plan.series[0]).toEqual({
      column: 'revenue',
      split: { dimension: 'region', value: 'South' },
    });
  });
});

describe('a series over time, more than 4 series: small multiples', () => {
  const spec = { metrics: ['revenue'], by: ['region'], time: monthly };

  test('five to eight series get a panel each', () => {
    const rows = months(3).flatMap((p) => regions.slice(0, 6).map((r, i) => [p, r, i]));
    expect(chooseChart(spec, answer(spec, rows))).toMatchObject({
      form: 'small_multiples',
      kind: 'line',
      x: 'period',
      marks: 6,
    });
  });

  test('more than eight series: a table', () => {
    const rows = months(3).flatMap((p) => regions.map((r, i) => [p, r, i]));
    expect(chooseChart(spec, answer(spec, rows)).form).toBe('table');
  });

  test('several metrics over time never share an axis', () => {
    const two = { metrics: ['revenue', 'margin'], time: monthly };
    const rows = months(6).map((p, i) => [p, i * 100, 0.3]);
    expect(chooseChart(two, answer(two, rows))).toMatchObject({
      form: 'small_multiples',
      kind: 'line',
      panels: [{ column: 'revenue' }, { column: 'margin' }],
    });
  });

  test('two splits over time: a table', () => {
    const both = { metrics: ['revenue'], by: ['region', 'channel'], time: monthly };
    const rows = months(3).flatMap((p) => [
      [p, 'East', 'Online', 1],
      [p, 'East', 'Store', 2],
    ]);
    expect(chooseChart(both, answer(both, rows)).form).toBe('table');
  });
});

describe('one dimension, no time: ranked bars', () => {
  test('largest first', () => {
    const spec = { metrics: ['revenue'], by: ['category'] };
    const rows = [
      ['Furniture', 9],
      ['Decor', 7],
      ['Kitchen', 3],
    ];
    expect(chooseChart(spec, answer(spec, rows))).toMatchObject({
      form: 'bars',
      category: 'category',
      value: 'revenue',
      order: ['Furniture', 'Decor', 'Kitchen'],
      ordered: false,
      labelChange: false,
      marks: 3,
    });
  });

  test('ordered categories keep their natural order', () => {
    const spec = { metrics: ['orders'], by: ['basket_size'] };
    const rows = [
      ['2-3 items', 900],
      ['1 item', 700],
      ['10+ items', 50],
      ['4-9 items', 300],
    ];
    expect(chooseChart(spec, answer(spec, rows))).toMatchObject({
      form: 'bars',
      order: ['1 item', '2-3 items', '4-9 items', '10+ items'],
      ordered: true,
    });
  });

  test('a sort that was asked for is kept', () => {
    const spec: QuerySpecInput = {
      metrics: ['revenue'],
      by: ['category'],
      sort: { by: 'category', dir: 'desc' },
    };
    const rows = [
      ['Outdoor', 1],
      ['Kitchen', 9],
      ['Decor', 5],
    ];
    expect(chooseChart(spec, answer(spec, rows))).toMatchObject({
      order: ['Outdoor', 'Kitchen', 'Decor'],
      ordered: true,
    });
  });

  test('a share of total draws the share column', () => {
    const spec: QuerySpecInput = { metrics: ['revenue'], by: ['category'], calc: 'share_of_total' };
    const rows = [
      ['A', 6, 0.6],
      ['B', 3, 0.3],
      ['C', 1, 0.1],
    ];
    expect(chooseChart(spec, answer(spec, rows))).toMatchObject({ value: 'revenue__share' });
  });

  test('several metrics across one split: a panel per metric', () => {
    const spec = { metrics: ['revenue', 'margin'], by: ['category'] };
    const rows = [
      ['A', 6, 0.2],
      ['B', 3, 0.4],
    ];
    expect(chooseChart(spec, answer(spec, rows))).toMatchObject({
      form: 'small_multiples',
      kind: 'bars',
      x: 'category',
      panels: [{ column: 'revenue' }, { column: 'margin' }],
    });
  });
});

describe('one dimension with a comparison: bars with the change labelled', () => {
  test('change labels on', () => {
    const spec: QuerySpecInput = {
      metrics: ['revenue'],
      by: ['region'],
      compare: 'previous_period',
    };
    const rows = [
      ['East', 10, 8, 2, 0.25],
      ['West', 9, 10, -1, -0.1],
      ['North', 5, 5, 0, 0],
    ];
    expect(chooseChart(spec, answer(spec, rows))).toMatchObject({
      form: 'bars',
      value: 'revenue',
      labelChange: true,
    });
  });
});

describe('two dimensions, no time: small multiples, or a table', () => {
  test('panels by the split with fewer values', () => {
    const spec = { metrics: ['revenue'], by: ['region', 'channel'] };
    const rows = ['East', 'North', 'South', 'West'].flatMap((r, i) => [
      [r, 'Online', 10 + i],
      [r, 'Store', 5 + i],
    ]);
    const plan = chooseChart(spec, answer(spec, rows));
    expect(plan).toMatchObject({ form: 'small_multiples', kind: 'bars', x: 'region' });
    if (plan.form !== 'small_multiples') return;
    expect(plan.panels.map((p) => p.split?.value)).toEqual(['Online', 'Store']);
    expect(plan.order).toEqual(['West', 'South', 'North', 'East']);
  });

  test('a table when either split has more than 8 values', () => {
    const spec = { metrics: ['revenue'], by: ['region', 'channel'] };
    const rows = regions.map((r) => [r, 'Online', 1]);
    expect(chooseChart(spec, answer(spec, rows)).form).toBe('table');
  });

  test('several metrics across two splits: a table', () => {
    const spec = { metrics: ['revenue', 'orders'], by: ['region', 'channel'] };
    const rows = [
      ['East', 'Online', 1, 2],
      ['East', 'Store', 3, 4],
    ];
    expect(chooseChart(spec, answer(spec, rows)).form).toBe('table');
  });
});

describe('a change analysis: waterfall', () => {
  test('a few steps', () => {
    expect(chooseChart({ kind: 'change_analysis', steps: 4 })).toMatchObject({
      form: 'waterfall',
      marks: 6,
    });
  });

  test('too many steps: a table', () => {
    expect(chooseChart({ kind: 'change_analysis', steps: MAX_MARKS }).form).toBe('table');
  });
});

describe('anything over 40 marks: table', () => {
  const spec = { metrics: ['revenue'], by: ['customer'] };
  const rows = (n: number) => Array.from({ length: n }, (_, i) => [`C${i}`, n - i]);

  test('40 bars is still a chart, 41 is a table', () => {
    expect(chooseChart(spec, answer(spec, rows(40))).form).toBe('bars');
    expect(chooseChart(spec, answer(spec, rows(41)))).toMatchObject({ form: 'table', marks: 41 });
  });

  test('two splits of 8 by 6 is 48 bars: a table', () => {
    const two = { metrics: ['revenue'], by: ['a', 'b'] };
    const r = regions.slice(0, 8).flatMap((x) => regions.slice(0, 6).map((y) => [x, y, 1]));
    expect(chooseChart(two, answer(two, r)).form).toBe('table');
  });

  test('a long daily line is one mark, not hundreds', () => {
    const daily: QuerySpecInput = {
      metrics: ['revenue'],
      time: { grain: 'day', range: { kind: 'all' } },
    };
    const r = Array.from({ length: 365 }, (_, i) => [`2024-01-01+${i}`, i]);
    expect(chooseChart(daily, answer(daily, r))).toMatchObject({ form: 'line', marks: 1 });
  });
});

describe('every plan says why', () => {
  test('reasons are sentences without a full stop', () => {
    const spec = { metrics: ['revenue'], by: ['category'] };
    const plan = chooseChart(
      spec,
      answer(spec, [
        ['A', 1],
        ['B', 2],
        ['C', 3],
      ]),
    );
    expect(plan.reason).toMatch(/^[A-Z0-9].*[^.]$/);
  });
});

describe('naturalOrder', () => {
  test('values that start with a number sort by it', () => {
    expect(naturalOrder(['51+', '0-10', '11-50'])).toEqual(['0-10', '11-50', '51+']);
    expect(naturalOrder(['5 stars', '1 star', '3 stars'])).toEqual([
      '1 star',
      '3 stars',
      '5 stars',
    ]);
    expect(naturalOrder(['<1 hour', '1-4 hours', '24+ hours'])).toEqual([
      '<1 hour',
      '1-4 hours',
      '24+ hours',
    ]);
    expect(naturalOrder(['10,000+', '1,000-9,999', '0-999'])).toEqual([
      '0-999',
      '1,000-9,999',
      '10,000+',
    ]);
  });

  test('names are not ordered', () => {
    expect(naturalOrder(['East', 'West'])).toBeNull();
    expect(naturalOrder(['1 item', 'Many'])).toBeNull();
    expect(naturalOrder(['Region 2', 'Region 1'])).toBeNull();
    expect(naturalOrder(['5'])).toBeNull();
  });
});
