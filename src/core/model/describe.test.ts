import { describe, expect, test } from 'vitest';
import { dependents, describeMetric, formatWords, metricFormula } from './describe';
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
      overTime: 'last',
      format: { style: 'currency', unit: 'GBP' },
      direction: 'higher_better',
      importance: 1,
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
      kind: 'simple',
      id: 'customers',
      label: 'Customers',
      column: 'customer_id',
      agg: 'count_distinct',
      format: { style: 'number' },
      direction: 'higher_better',
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
    {
      kind: 'difference',
      id: 'net',
      label: 'Net',
      minuend: 'revenue',
      subtrahend: 'returns',
      format: { style: 'duration', unit: 'hours' },
      direction: 'neutral',
      importance: 0.4,
    },
  ],
  dimensions: [
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

const m = (id: string) => model.metrics.find((x) => x.id === id)!;

describe('describeMetric', () => {
  test('simple metrics, with filters and snapshot roll-up', () => {
    expect(describeMetric(model, m('rows'))).toBe('Order lines is the number of rows.');
    expect(describeMetric(model, m('revenue'))).toBe(
      'Revenue is the sum of revenue. Over several periods it is the value in the last one.',
    );
    expect(describeMetric(model, m('returns'))).toBe(
      'Returned lines is the number of rows where returned is true.',
    );
    expect(describeMetric(model, m('customers'))).toBe(
      'Customers is the number of different customer_id values.',
    );
  });

  test('ratios and differences name their parts', () => {
    expect(describeMetric(model, m('return_rate'))).toBe(
      'Return rate is Returned lines divided by Order lines.',
    );
    expect(describeMetric(model, m('net'))).toBe('Net is Revenue minus Returned lines.');
  });
});

test('formulas', () => {
  expect(metricFormula(model, m('revenue'))).toBe('sum(revenue)');
  expect(metricFormula(model, m('returns'))).toBe('count(*) where returned = true');
  expect(metricFormula(model, m('customers'))).toBe('count(distinct customer_id)');
  expect(metricFormula(model, m('return_rate'))).toBe('Returned lines / Order lines');
  expect(metricFormula(model, m('net'))).toBe('Revenue − Returned lines');
});

test('formats and dependents', () => {
  expect(formatWords({ style: 'currency', unit: 'GBP' })).toBe('Money (GBP)');
  expect(formatWords({ style: 'duration', unit: 'hours' })).toBe('Time in hours');
  expect(formatWords({ style: 'number', unit: '%' })).toBe('Number (%)');
  expect(formatWords({ style: 'percent' })).toBe('Percentage');
  expect(dependents(model, 'returns').map((x) => x.id)).toEqual(['return_rate', 'net']);
});
