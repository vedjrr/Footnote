import { describe, expect, test } from 'vitest';
import {
  addRatio,
  editDimension,
  editMetric,
  hideDimension,
  removeMetric,
  showColumn,
} from './edit';
import { type SemanticModel, semanticModelSchema } from './types';

const model: SemanticModel = semanticModelSchema.parse({
  table: 'orders',
  version: 1,
  time: null,
  metrics: [
    {
      kind: 'simple',
      id: 'rows',
      label: 'Order lines',
      column: null,
      agg: 'count',
      format: { style: 'number' },
      direction: 'higher_better',
      importance: 0.7,
    },
    {
      kind: 'simple',
      id: 'revenue',
      label: 'Revenue',
      column: 'revenue',
      agg: 'sum',
      format: { style: 'currency', unit: 'GBP' },
      direction: 'higher_better',
      importance: 1,
    },
    {
      kind: 'simple',
      id: 'cost',
      label: 'Cost',
      column: 'cost',
      agg: 'sum',
      format: { style: 'currency', unit: 'GBP' },
      direction: 'lower_better',
      importance: 0.8,
    },
    {
      kind: 'simple',
      id: 'returns',
      label: 'Returned lines',
      column: null,
      agg: 'count',
      where: [{ dimension: 'returned', op: 'in', values: ['true'] }],
      format: { style: 'number' },
      direction: 'lower_better',
      importance: 0.4,
    },
    {
      kind: 'ratio',
      id: 'return_rate',
      label: 'Return rate',
      numerator: 'returns',
      denominator: 'rows',
      format: { style: 'percent' },
      direction: 'lower_better',
      importance: 0.6,
    },
  ],
  dimensions: [
    {
      id: 'region',
      label: 'Region',
      column: 'region',
      role: 'category',
      distinct: 4,
      private: false,
    },
    {
      id: 'returned',
      label: 'Returned',
      column: 'returned',
      role: 'category',
      distinct: 2,
      private: false,
    },
  ],
});

const ok = (r: ReturnType<typeof editMetric>) => {
  if (!r.ok) throw new Error(r.message);
  return r.model;
};

describe('editMetric', () => {
  test('renames, re-aggregates, sets direction and tidies synonyms', () => {
    const next = ok(
      editMetric(model, 'revenue', {
        label: ' Sales ',
        agg: 'avg',
        direction: 'neutral',
        synonyms: ['turnover', ' Turnover', '', 'takings'],
      }),
    );
    expect(next.metrics[1]).toMatchObject({
      label: 'Sales',
      agg: 'avg',
      direction: 'neutral',
      synonyms: ['turnover', 'takings'],
    });
    expect(model.metrics[1].label).toBe('Revenue');
  });

  test('refuses an empty name, a taken name and aggregating a count', () => {
    expect(editMetric(model, 'revenue', { label: ' ' })).toEqual({
      ok: false,
      message: 'Give the metric a name.',
    });
    expect(editMetric(model, 'revenue', { label: 'cost' })).toEqual({
      ok: false,
      message: 'Another metric is already called Cost.',
    });
    expect(editMetric(model, 'rows', { agg: 'sum' }).ok).toBe(false);
    expect(editMetric(model, 'return_rate', { agg: 'sum' }).ok).toBe(false);
  });
});

describe('addRatio', () => {
  test('adds a ratio with a percentage format when both sides are alike', () => {
    const next = ok(
      addRatio(model, { label: 'Average discount', numerator: 'cost', denominator: 'revenue' }),
    );
    expect(next.metrics.at(-1)).toMatchObject({
      kind: 'ratio',
      id: 'average_discount',
      label: 'Average discount',
      format: { style: 'percent' },
    });
  });

  test('money over a count stays money', () => {
    const next = ok(
      addRatio(model, { label: 'Per line', numerator: 'revenue', denominator: 'rows' }),
    );
    expect(next.metrics.at(-1)?.format).toEqual({ style: 'currency', unit: 'GBP' });
  });

  test('refuses a missing name, a taken name and one metric twice', () => {
    expect(addRatio(model, { label: '', numerator: 'cost', denominator: 'revenue' }).ok).toBe(
      false,
    );
    expect(
      addRatio(model, { label: 'Revenue', numerator: 'cost', denominator: 'revenue' }),
    ).toEqual({ ok: false, message: 'A metric is already called Revenue.' });
    expect(addRatio(model, { label: 'X', numerator: 'cost', denominator: 'cost' })).toEqual({
      ok: false,
      message: 'Choose two different metrics.',
    });
  });
});

describe('remove, hide and show', () => {
  test('a metric used by another cannot be removed', () => {
    expect(removeMetric(model, 'returns')).toEqual({
      ok: false,
      message: 'Return rate uses this metric. Remove it first.',
    });
    expect(ok(removeMetric(model, 'cost')).metrics.map((m) => m.id)).not.toContain('cost');
  });

  test('hiding moves the column to hidden; showing brings it back', () => {
    const hidden = ok(hideDimension(model, 'region'));
    expect(hidden.dimensions.map((d) => d.id)).toEqual(['returned']);
    expect(hidden.hidden).toEqual(['region']);
    const shown = ok(showColumn(hidden, model, 'region'));
    expect(shown.dimensions.map((d) => d.id)).toEqual(['returned', 'region']);
    expect(shown.hidden).toEqual([]);
    expect(showColumn(hidden, model, 'order_id').ok).toBe(false);
  });

  test('a column a metric counts by cannot be hidden', () => {
    expect(hideDimension(model, 'returned')).toEqual({
      ok: false,
      message: 'Returned lines counts rows by this column. Remove it first.',
    });
  });

  test('dimensions can be renamed and given synonyms', () => {
    const next = ok(editDimension(model, 'region', { label: 'Area', synonyms: ['territory'] }));
    expect(next.dimensions[0]).toMatchObject({ label: 'Area', synonyms: ['territory'] });
    expect(editDimension(model, 'region', { label: '' }).ok).toBe(false);
  });
});
