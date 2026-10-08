// A dictionary entry in words, for the metrics screen and the working paper:
// "Revenue is the sum of revenue." Also the formula and format as short text.

import type {
  Aggregation,
  Direction,
  Metric,
  MetricFormat,
  SemanticModel,
  SimpleMetric,
} from './types';

export const AGGREGATION_WORDS: Record<Aggregation, string> = {
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
  median: 'Median',
  count: 'Count of rows',
  count_distinct: 'Count of different values',
};

export const DIRECTION_WORDS: Record<Direction, string> = {
  higher_better: 'Higher is better',
  lower_better: 'Lower is better',
  neutral: 'Neither higher nor lower is better',
};

function label(model: SemanticModel, id: string): string {
  return model.metrics.find((m) => m.id === id)?.label ?? id;
}

function whereWords(model: SemanticModel, m: SimpleMetric): string {
  if (!m.where?.length) return '';
  const parts = m.where.map((f) => {
    const dim = model.dimensions.find((d) => d.id === f.dimension);
    const name = dim?.label.toLowerCase() ?? f.dimension;
    const values = f.values.join(' or ');
    if (f.op === 'contains') return `${name} contains ${values}`;
    if (values === 'true' && f.op === 'in') return `${name} is true`;
    return `${name} is ${f.op === 'not_in' ? 'not ' : ''}${values}`;
  });
  return ` where ${parts.join(' and ')}`;
}

/** One sentence: what the metric is. */
export function describeMetric(model: SemanticModel, m: Metric): string {
  let what: string;
  if (m.kind === 'ratio') {
    what = `${label(model, m.numerator)} divided by ${label(model, m.denominator)}`;
  } else if (m.kind === 'difference') {
    what = `${label(model, m.minuend)} minus ${label(model, m.subtrahend)}`;
  } else {
    const col = m.column ?? '';
    const of: Record<Aggregation, string> = {
      sum: `the sum of ${col}`,
      avg: `the average of ${col}, over the rows that have a value`,
      min: `the smallest ${col}`,
      max: `the largest ${col}`,
      median: `the median of ${col}`,
      count: 'the number of rows',
      count_distinct: `the number of different ${col} values`,
    };
    what = of[m.agg] + whereWords(model, m);
  }
  let sentence = `${m.label} is ${what}.`;
  if (m.kind === 'simple' && m.overTime === 'last') {
    sentence += ' Over several periods it is the value in the last one.';
  }
  return sentence;
}

/** The formula as short text: sum(revenue), Revenue / Orders. */
export function metricFormula(model: SemanticModel, m: Metric): string {
  if (m.kind === 'ratio') return `${label(model, m.numerator)} / ${label(model, m.denominator)}`;
  if (m.kind === 'difference') {
    return `${label(model, m.minuend)} − ${label(model, m.subtrahend)}`;
  }
  const base =
    m.agg === 'count'
      ? 'count(*)'
      : m.agg === 'count_distinct'
        ? `count(distinct ${m.column})`
        : `${m.agg}(${m.column})`;
  const where = m.where?.length
    ? ` where ${m.where
        .map((f) => {
          const col = model.dimensions.find((d) => d.id === f.dimension)?.column ?? f.dimension;
          return f.values.length === 1 && f.op === 'in'
            ? `${col} = ${f.values[0]}`
            : `${col} ${f.op.replace('_', ' ')} (${f.values.join(', ')})`;
        })
        .join(' and ')}`
    : '';
  return base + where;
}

export function formatWords(f: MetricFormat): string {
  switch (f.style) {
    case 'currency':
      return f.unit ? `Money (${f.unit})` : 'Money';
    case 'percent':
      return 'Percentage';
    case 'duration':
      return f.unit ? `Time in ${f.unit}` : 'Time';
    default:
      return f.unit ? `Number (${f.unit})` : 'Number';
  }
}

/** Metric ids that use `id` as a part. */
export function dependents(model: SemanticModel, id: string): Metric[] {
  return model.metrics.filter(
    (m) =>
      (m.kind === 'ratio' && (m.numerator === id || m.denominator === id)) ||
      (m.kind === 'difference' && (m.minuend === id || m.subtrahend === id)),
  );
}
