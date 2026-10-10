// Chart choice (steps T23, ui-ux-rules §7): the shape of an answer picks its
// form, before any colour. The plan names result columns and the order to
// draw them in; the answer view (T24) turns it into chart props. Every value
// a chart draws is a cell of the result, so nothing here adds numbers up.
//
// | Shape of the answer                          | Form                     |
// |----------------------------------------------|--------------------------|
// | one value, or one value with a comparison    | figures, no chart        |
// | a series over time, up to 4 series           | line                     |
// | a series over time, more than 4 series       | small multiples          |
// | one dimension, no time                       | ranked bars              |
// | one dimension with a comparison              | bars, change labelled    |
// | two dimensions, no time                      | small multiples, or table|
// | a change analysis                            | waterfall                |
// | anything over 40 marks                       | table                    |
//
// Judgement calls are in D-038.

import type { Cell } from '@/core/engine/types';
import type { OutputColumn } from '@/core/query/compile';
import type { QuerySpecInput } from '@/core/query/spec';

/** More marks than this and the answer is a table (ui-ux-rules §7). */
export const MAX_MARKS = 40;
/** Lines on one chart; series colours run out after four. */
export const MAX_LINES = 4;
/** Values of a split drawn as panels; more and the answer is a table. */
export const MAX_PANELS = 8;
/** One or two numbers are shown as figures, never charted. */
export const MAX_FIGURES = 2;

/** One line or one panel: a result column, optionally for one value of a split. */
export interface SeriesPlan {
  column: string;
  split?: { dimension: string; value: string };
}

interface PlanBase {
  /** Why this form, in a sentence, for the working paper. */
  reason: string;
  /** Bars, lines or panels the chart would draw. */
  marks: number;
}

export type ChartPlan =
  | (PlanBase & { form: 'figures' })
  | (PlanBase & { form: 'table' })
  | (PlanBase & { form: 'line'; series: SeriesPlan[] })
  | (PlanBase & {
      form: 'bars';
      /** The dimension id whose values are the bars. */
      category: string;
      /** The result column the bars measure. */
      value: string;
      /** Category values in drawing order. */
      order: string[];
      /** True when the order is natural or asked for, not largest first. */
      ordered: boolean;
      /** Label each bar with its change against the comparison. */
      labelChange: boolean;
    })
  | (PlanBase & {
      form: 'small_multiples';
      kind: 'line' | 'bars';
      /** The x axis of every panel: `period` or a dimension id. */
      x: string;
      /** Values of `x` in drawing order, for bar panels. */
      order: string[];
      panels: SeriesPlan[];
    })
  | (PlanBase & { form: 'waterfall' });

export interface ChartResult {
  /** The compiler's output columns, in result order. */
  columns: OutputColumn[];
  rows: Cell[][];
}

/** Where a change came from: a start total, the steps and an end total (T41). */
export interface ChangeAnalysis {
  kind: 'change_analysis';
  steps: number;
}

export function chooseChart(analysis: ChangeAnalysis): ChartPlan;
export function chooseChart(spec: QuerySpecInput, result: ChartResult): ChartPlan;
export function chooseChart(
  input: QuerySpecInput | ChangeAnalysis,
  result?: ChartResult,
): ChartPlan {
  if ('kind' in input) {
    const marks = input.steps + 2;
    return marks > MAX_MARKS
      ? { form: 'table', marks, reason: tooMany(marks) }
      : { form: 'waterfall', marks, reason: 'A change analysis walks from one total to the other' };
  }
  return chooseForQuery(input, result ?? { columns: [], rows: [] });
}

function tooMany(marks: number): string {
  return `${marks} marks is more than a chart can show clearly`;
}

function chooseForQuery(spec: QuerySpecInput, result: ChartResult): ChartPlan {
  const { columns, rows } = result;
  const metrics = spec.metrics;
  const dims = spec.by ?? [];
  const index = (name: string) => columns.findIndex((c) => c.name === name);
  const valueColumn = (metric: string) => {
    const calc = columns.find(
      (c) => c.ref === metric && (c.kind === 'share' || c.kind === 'running'),
    );
    return calc?.name ?? metric;
  };
  const distinct = (name: string): string[] => {
    const i = index(name);
    if (i === -1) return [];
    const seen = new Set<string>();
    for (const row of rows) seen.add(cellKey(row[i]));
    return [...seen];
  };

  if (rows.length === 0) {
    return { form: 'figures', marks: 0, reason: 'There are no rows, so there is nothing to draw' };
  }
  const values = rows.length * metrics.length;
  if (values <= MAX_FIGURES) {
    return {
      form: 'figures',
      marks: values,
      reason: values === 1 ? 'One value reads best as a figure' : 'Two values read best as figures',
    };
  }

  const periods = index('period') === -1 ? 0 : distinct('period').length;

  // ------------------------------------------------------- over time
  if (periods > 1) {
    if (dims.length === 0) {
      if (metrics.length === 1) {
        const series: SeriesPlan[] = [{ column: valueColumn(metrics[0]) }];
        if (spec.compare && index(`${metrics[0]}__previous`) !== -1) {
          series.push({ column: `${metrics[0]}__previous` });
        }
        return { form: 'line', series, marks: series.length, reason: 'A series over time' };
      }
      // Metrics never share an axis: each has its own unit and scale.
      const panels = metrics.map((m) => ({ column: valueColumn(m) }));
      return {
        form: 'small_multiples',
        kind: 'line',
        x: 'period',
        order: [],
        panels,
        marks: panels.length,
        reason: 'Several metrics over time, each on its own scale',
      };
    }
    if (dims.length === 1 && metrics.length === 1) {
      const dim = dims[0];
      const column = valueColumn(metrics[0]);
      const splits = byTotal(rows, index(dim), index(column));
      const series = splits.map((value) => ({ column, split: { dimension: dim, value } }));
      if (series.length <= MAX_LINES) {
        return {
          form: 'line',
          series,
          marks: series.length,
          reason: 'A series over time per value',
        };
      }
      if (series.length <= MAX_PANELS) {
        return {
          form: 'small_multiples',
          kind: 'line',
          x: 'period',
          order: [],
          panels: series,
          marks: series.length,
          reason: `${series.length} series are too many for one chart, so each gets a panel`,
        };
      }
      return {
        form: 'table',
        marks: series.length,
        reason: `${series.length} series are too many to draw, even as panels`,
      };
    }
    return {
      form: 'table',
      marks: rows.length,
      reason: 'A split by more than one thing over time reads best as a table',
    };
  }

  // -------------------------------------------------------- no time
  if (dims.length === 0) {
    return { form: 'figures', marks: values, reason: 'A few totals read best as figures' };
  }
  if (dims.length === 1) {
    const dim = dims[0];
    const categories = distinct(dim);
    const natural = naturalOrder(categories);
    const order = spec.sort ? categories : (natural ?? categories);
    const ordered = spec.sort !== undefined || natural !== null;
    if (metrics.length === 1) {
      if (rows.length > MAX_MARKS)
        return { form: 'table', marks: rows.length, reason: tooMany(rows.length) };
      const labelChange = spec.compare !== undefined;
      return {
        form: 'bars',
        category: dim,
        value: valueColumn(metrics[0]),
        order,
        ordered,
        labelChange,
        marks: rows.length,
        reason: labelChange
          ? 'One value per category, with the change against the comparison'
          : 'One value per category, compared',
      };
    }
    if (categories.length > MAX_PANELS || values > MAX_MARKS) {
      return {
        form: 'table',
        marks: values,
        reason: 'Several metrics across many values read best as a table',
      };
    }
    return {
      form: 'small_multiples',
      kind: 'bars',
      x: dim,
      order,
      panels: metrics.map((m) => ({ column: valueColumn(m) })),
      marks: values,
      reason: 'Several metrics across one split, each on its own scale',
    };
  }
  if (dims.length === 2 && metrics.length === 1) {
    const [a, b] = dims.map((d) => ({ id: d, values: distinct(d) }));
    if (a.values.length > MAX_PANELS || b.values.length > MAX_PANELS) {
      return {
        form: 'table',
        marks: rows.length,
        reason: `A split with more than ${MAX_PANELS} values is too many panels`,
      };
    }
    if (rows.length > MAX_MARKS)
      return { form: 'table', marks: rows.length, reason: tooMany(rows.length) };
    // Panels by the split with fewer values; bars within by the other.
    const [panel, x] = b.values.length < a.values.length ? [b, a] : [a, b];
    const column = valueColumn(metrics[0]);
    const order = spec.sort
      ? x.values
      : (naturalOrder(x.values) ?? byTotal(rows, index(x.id), index(column)));
    return {
      form: 'small_multiples',
      kind: 'bars',
      x: x.id,
      order,
      panels: panel.values.map((value) => ({ column, split: { dimension: panel.id, value } })),
      marks: rows.length,
      reason: 'One measure across two splits, one panel per value',
    };
  }
  return {
    form: 'table',
    marks: values,
    reason: 'Several metrics across two splits read best as a table',
  };
}

/** How a split's value is named in a plan; an empty value is "". */
export function cellKey(cell: Cell): string {
  return cell === null ? '' : String(cell);
}

/** Values of column `key`, largest total of column `value` first; ties by name. */
function byTotal(rows: Cell[][], key: number, value: number): string[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const k = cellKey(row[key]);
    const v = row[value];
    totals.set(k, (totals.get(k) ?? 0) + (typeof v === 'number' ? v : 0));
  }
  return [...totals.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .map(([k]) => k);
}

// An optional "<", ">", "≤", "≥" or currency sign, then the number.
const LEADING_NUMBER = /^([<>≤≥]?)[^\d\-−]{0,2}?([-−]?\d+(?:[.,]\d+)*)/;

/**
 * The natural order of ordered categories, such as "0-10", "11-50", "51+",
 * "<1 hour" or "1 star" to "5 stars": every value starts with a number.
 * Null otherwise.
 */
export function naturalOrder(values: string[]): string[] | null {
  if (values.length < 2) return null;
  const keyed: { v: string; n: number }[] = [];
  for (const v of values) {
    const m = LEADING_NUMBER.exec(v.trim());
    if (!m) return null;
    const n = Number(m[2].replace(/,/g, '').replace('−', '-'));
    if (Number.isNaN(n)) return null;
    // "<1" comes before "1-4", ">50" after "50".
    const nudge = m[1] === '<' || m[1] === '≤' ? -0.5 : m[1] ? 0.5 : 0;
    keyed.push({ v, n: n + nudge });
  }
  return keyed.sort((x, y) => x.n - y.n || x.v.localeCompare(y.v)).map((k) => k.v);
}
