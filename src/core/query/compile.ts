// The compiler (architecture §6.3): QuerySpec + dictionary -> one SQL
// statement. Pure: the same input gives byte-identical output. It names only
// columns the dictionary holds, quotes every identifier and passes every
// value as a parameter.
//
// Shape of the statement:
//   base     the table's rows in range and filter, with helper columns:
//            _day (the row's day), _period (grain), _side (current or
//            previous, when comparing) and _last (the last day of each
//            bucket, for metrics that roll up as the last period)
//   grouped  one row per period and split, every metric aggregated from
//            totals, so a ratio is sum over sum, never an average of ratios
//   final    changes, calculations, sort and limit

import type { Cell } from '@/core/engine/types';
import {
  type DayRange,
  type TimeFacts,
  PeriodError,
  comparisonRange,
  resolveRange,
} from '@/core/findings/periods';
import type { Filter, Metric, SemanticModel, SimpleMetric } from '@/core/model/types';
import { quoteColumn, quoteTable } from '@/core/profile/profile';
import { type QuerySpec, type QuerySpecInput, querySpecSchema } from './spec';

export type CompileErrorCode =
  | 'invalid_spec'
  | 'unknown_metric'
  | 'unknown_dimension'
  | 'unknown_sort'
  | 'no_time'
  | 'no_time_facts'
  | 'compare_series'
  | 'running_needs_grain'
  | 'period';

export class CompileError extends Error {
  constructor(
    readonly code: CompileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CompileError';
  }
}

export type OutputKind =
  | 'period'
  | 'dimension'
  | 'metric'
  | 'previous'
  | 'change'
  | 'change_pct'
  | 'share'
  | 'running'
  | 'rank';

export interface OutputColumn {
  /** The column name in the result. */
  name: string;
  kind: OutputKind;
  /** The metric or dimension id it belongs to, or `period`. */
  ref: string;
}

export interface CompileContext {
  /** The time column's distinct days; needed for relative ranges and comparisons. */
  time: TimeFacts | null;
  /**
   * The SQL expression to read a column with, for text columns the profile
   * refined into numbers or dates. Defaults to the quoted column.
   */
  expressions?: Record<string, string>;
}

export interface Compiled {
  sql: string;
  params: Cell[];
  /** The same statement with values written in, for reading. */
  displaySql: string;
  columns: OutputColumn[];
  /** The days the answer covers, when it has a time range. */
  range: DayRange | null;
  /** The days it is compared against. */
  comparison: DayRange | null;
}

/** Names of helper columns the compiler adds; never dictionary ids. */
export const HELPERS = ['_day', '_period', '_side', '_last'] as const;

const q = quoteColumn;

export function compile(
  input: QuerySpecInput,
  model: SemanticModel,
  context: CompileContext,
): Compiled {
  const parsed = querySpecSchema.safeParse(input);
  if (!parsed.success) {
    throw new CompileError('invalid_spec', parsed.error.issues[0].message);
  }
  const spec: QuerySpec = parsed.data;
  const params: Cell[] = [];
  const param = (value: Cell) => {
    params.push(value);
    return '?';
  };

  // ---------------------------------------------------------- references
  const metricById = new Map(model.metrics.map((m) => [m.id, m]));
  const dimById = new Map(model.dimensions.map((d) => [d.id, d]));
  const metrics = spec.metrics.map((id) => {
    const m = metricById.get(id);
    if (!m) throw new CompileError('unknown_metric', `"${id}" is not a metric in the dictionary`);
    return m;
  });
  const dims = spec.by.map((id) => {
    const d = dimById.get(id);
    if (!d)
      throw new CompileError('unknown_dimension', `"${id}" is not a dimension in the dictionary`);
    return d;
  });
  for (const f of spec.filters) {
    if (!dimById.has(f.dimension)) {
      throw new CompileError(
        'unknown_dimension',
        `"${f.dimension}" is not a dimension in the dictionary`,
      );
    }
  }

  const grain = spec.time?.grain;
  const compare = spec.compare;
  if ((spec.time || compare) && !model.time) {
    throw new CompileError('no_time', 'This data has no date column, so it has no periods.');
  }
  if (compare && grain) {
    throw new CompileError(
      'compare_series',
      'A comparison is made between two totals, not over a series.',
    );
  }
  if (compare && !spec.time) {
    throw new CompileError('period', 'A comparison needs a period to compare.');
  }
  if (spec.calc === 'running_total' && !grain) {
    throw new CompileError('running_needs_grain', 'A running total needs a series over time.');
  }

  // --------------------------------------------------------------- range
  // "All" with no comparison needs no filter. Anything relative, and any
  // comparison, is resolved against the days in the data.
  let range: DayRange | null = null;
  let comparison: DayRange | null = null;
  const r = spec.time?.range;
  if (r && (r.kind !== 'all' || compare)) {
    const facts = context.time;
    if (!facts && (r.kind !== 'absolute' || compare)) {
      throw new CompileError('no_time_facts', 'Relative periods need the days in the data.');
    }
    try {
      range = r.kind === 'absolute' ? { from: r.from, to: r.to } : resolveRange(r, facts!);
      if (compare) comparison = comparisonRange(r, range, compare, facts!);
    } catch (error) {
      if (error instanceof PeriodError) throw new CompileError('period', error.message);
      throw error;
    }
  }

  // The simple metrics every requested metric is built from.
  const simples = new Map<string, SimpleMetric>();
  const collect = (m: Metric) => {
    if (m.kind === 'simple') simples.set(m.id, m);
    else if (m.kind === 'ratio')
      [m.numerator, m.denominator].forEach((id) => collect(metricById.get(id)!));
    else [m.minuend, m.subtrahend].forEach((id) => collect(metricById.get(id)!));
  };
  metrics.forEach(collect);
  const hasTime = model.time !== null;
  const needsLast = hasTime && [...simples.values()].some((m) => m.overTime === 'last');
  const needsDay =
    hasTime && (needsLast || [...simples.values()].some((m) => m.overTime === 'avg'));

  const expr = (column: string) => context.expressions?.[column] ?? q(column);
  const t = model.time ? expr(model.time.column) : '';
  const day = `CAST(${t} AS DATE)`;
  const period = grain ? `CAST(date_trunc('${grain}', ${t}) AS DATE)` : '';

  // ---------------------------------------------------------------- base
  const select: string[] = ['*'];
  if (needsDay || compare) select.push(`${day} AS ${q('_day')}`);
  if (grain) select.push(`${period} AS ${q('_period')}`);
  const sideExpr = (from: string) =>
    `CASE WHEN ${day} >= CAST(${param(from)} AS DATE) THEN 'current' ELSE 'previous' END`;
  if (compare && range) select.push(`${sideExpr(range.from)} AS ${q('_side')}`);
  if (needsLast) {
    // Each bucket's last day: per period in a series, per side in a
    // comparison, else the last day in range.
    const partition = grain
      ? `PARTITION BY ${period}`
      : compare && range
        ? `PARTITION BY ${sideExpr(range.from)}`
        : '';
    select.push(`max(${day}) OVER (${partition}) AS ${q('_last')}`);
  }
  const where: string[] = [];
  if (range) {
    const between = (r: DayRange) =>
      `${day} BETWEEN CAST(${param(r.from)} AS DATE) AND CAST(${param(r.to)} AS DATE)`;
    where.push(comparison ? `(${between(range)} OR ${between(comparison)})` : between(range));
  }
  for (const f of spec.filters) where.push(filterSql(f, model, expr, param));

  const base = [
    `base AS (`,
    `  SELECT ${select.join(',\n    ')}`,
    `  FROM ${quoteTable(model.table)}`,
    ...(where.length ? [`  WHERE ${where.join('\n    AND ')}`] : []),
    `)`,
  ].join('\n');

  // ------------------------------------------------------------- grouped
  const aggregate = (m: SimpleMetric, onSide: string | null): string => {
    const conds: string[] = [];
    for (const f of m.where ?? []) conds.push(filterSql(f, model, (c) => q(c), param));
    if (m.overTime === 'last' && needsLast) conds.push(`${q('_day')} = ${q('_last')}`);
    if (onSide) conds.push(`${q('_side')} = '${onSide}'`);
    const filter = conds.length ? ` FILTER (WHERE ${conds.join(' AND ')})` : '';
    const x = m.column ? q(m.column) : '';
    let sql: string;
    switch (m.agg) {
      case 'sum':
        sql = `CAST(sum(${x})${filter} AS DOUBLE)`;
        break;
      case 'avg':
        // An average is a ratio of totals, so it decomposes like one (§6.3).
        sql = `CAST(sum(${x})${filter} AS DOUBLE) / NULLIF(count(${x})${filter}, 0)`;
        break;
      case 'min':
      case 'max':
      case 'median':
        sql = `CAST(${m.agg}(${x})${filter} AS DOUBLE)`;
        break;
      case 'count':
        sql = `CAST(count(*)${filter} AS BIGINT)`;
        break;
      case 'count_distinct':
        sql = `CAST(count(DISTINCT ${x})${filter} AS BIGINT)`;
        break;
    }
    if (m.overTime === 'avg' && needsDay) {
      const sideFilter = onSide ? ` FILTER (WHERE ${q('_side')} = '${onSide}')` : '';
      sql = `(${sql}) / NULLIF(count(DISTINCT ${q('_day')})${sideFilter}, 0)`;
    }
    return sql;
  };
  const metricSql = (m: Metric, onSide: string | null): string => {
    if (m.kind === 'simple') return aggregate(m, onSide);
    if (m.kind === 'ratio') {
      const num = metricSql(metricById.get(m.numerator)!, onSide);
      const den = metricSql(metricById.get(m.denominator)!, onSide);
      return `CAST(${num} AS DOUBLE) / NULLIF(CAST(${den} AS DOUBLE), 0)`;
    }
    const a = metricSql(metricById.get(m.minuend)!, onSide);
    const b = metricSql(metricById.get(m.subtrahend)!, onSide);
    return `CAST(${a} AS DOUBLE) - CAST(${b} AS DOUBLE)`;
  };

  const columns: OutputColumn[] = [];
  const groupedSelect: string[] = [];
  if (grain) {
    groupedSelect.push(`${q('_period')} AS ${q('period')}`);
    columns.push({ name: 'period', kind: 'period', ref: 'period' });
  }
  for (const d of dims) {
    groupedSelect.push(`${q(d.column)} AS ${q(d.id)}`);
    columns.push({ name: d.id, kind: 'dimension', ref: d.id });
  }
  for (const m of metrics) {
    groupedSelect.push(`${metricSql(m, compare ? 'current' : null)} AS ${q(m.id)}`);
    if (compare) groupedSelect.push(`${metricSql(m, 'previous')} AS ${q(`${m.id}__previous`)}`);
  }
  const grouped = [
    `grouped AS (`,
    `  SELECT ${groupedSelect.join(',\n    ')}`,
    `  FROM base`,
    ...(grain || dims.length ? [`  GROUP BY ALL`] : []),
    `)`,
  ].join('\n');

  // --------------------------------------------------------------- final
  const finalSelect: string[] = [];
  if (grain) finalSelect.push(q('period'));
  for (const d of dims) finalSelect.push(q(d.id));
  for (const m of metrics) {
    finalSelect.push(q(m.id));
    columns.push({ name: m.id, kind: 'metric', ref: m.id });
  }
  if (compare) {
    for (const m of metrics) {
      const [cur, prev] = [q(m.id), q(`${m.id}__previous`)];
      finalSelect.push(prev, `${cur} - ${prev} AS ${q(`${m.id}__change`)}`);
      finalSelect.push(
        `(${cur} - ${prev}) / NULLIF(abs(${prev}), 0) AS ${q(`${m.id}__change_pct`)}`,
      );
      columns.push(
        { name: `${m.id}__previous`, kind: 'previous', ref: m.id },
        { name: `${m.id}__change`, kind: 'change', ref: m.id },
        { name: `${m.id}__change_pct`, kind: 'change_pct', ref: m.id },
      );
    }
  }
  const perPeriod = grain ? `PARTITION BY ${q('period')} ` : '';
  if (spec.calc === 'share_of_total') {
    for (const m of metrics) {
      finalSelect.push(
        `${q(m.id)} / NULLIF(sum(${q(m.id)}) OVER (${perPeriod.trim()}), 0) AS ${q(`${m.id}__share`)}`,
      );
      columns.push({ name: `${m.id}__share`, kind: 'share', ref: m.id });
    }
  } else if (spec.calc === 'running_total') {
    const byDims = dims.length ? `PARTITION BY ${dims.map((d) => q(d.id)).join(', ')} ` : '';
    for (const m of metrics) {
      finalSelect.push(
        `sum(${q(m.id)}) OVER (${byDims}ORDER BY ${q('period')} ROWS UNBOUNDED PRECEDING) AS ${q(`${m.id}__running`)}`,
      );
      columns.push({ name: `${m.id}__running`, kind: 'running', ref: m.id });
    }
  } else if (spec.calc === 'rank') {
    const first = metrics[0];
    finalSelect.push(
      `rank() OVER (${perPeriod}ORDER BY ${q(first.id)} DESC NULLS LAST) AS ${q(`${first.id}__rank`)}`,
    );
    columns.push({ name: `${first.id}__rank`, kind: 'rank', ref: first.id });
  }

  // Sort: what was asked, then period and splits so ties are always ordered.
  const sortable = new Set([...metrics.map((m) => m.id), ...dims.map((d) => d.id)]);
  if (grain) sortable.add('period');
  const order: string[] = [];
  if (spec.sort) {
    if (!sortable.has(spec.sort.by)) {
      throw new CompileError(
        'unknown_sort',
        `"${spec.sort.by}" is not in this answer, so it cannot sort it`,
      );
    }
    order.push(`${q(spec.sort.by)} ${spec.sort.dir.toUpperCase()} NULLS LAST`);
  } else if (!grain && dims.length) {
    order.push(`${q(metrics[0].id)} DESC NULLS LAST`);
  }
  if (grain && spec.sort?.by !== 'period') order.push(`${q('period')} ASC`);
  for (const d of dims) if (spec.sort?.by !== d.id) order.push(`${q(d.id)} ASC NULLS LAST`);

  const sql = [
    `WITH ${base},`,
    grouped,
    `SELECT ${finalSelect.join(',\n  ')}`,
    `FROM grouped`,
    ...(order.length ? [`ORDER BY ${order.join(', ')}`] : []),
    ...(spec.limit ? [`LIMIT ${spec.limit}`] : []),
  ].join('\n');

  return { sql, params, displaySql: displaySql(sql, params), columns, range, comparison };
}

function filterSql(
  f: Filter,
  model: SemanticModel,
  expr: (column: string) => string,
  param: (value: Cell) => string,
): string {
  const dim = model.dimensions.find((d) => d.id === f.dimension);
  if (!dim)
    throw new CompileError(
      'unknown_dimension',
      `"${f.dimension}" is not a dimension in the dictionary`,
    );
  const col = `CAST(${expr(dim.column)} AS VARCHAR)`;
  if (f.op === 'contains') {
    const parts = f.values.map((v) => `contains(lower(${col}), lower(${param(v)}))`);
    return `(${parts.join(' OR ')})`;
  }
  const list = f.values.map((v) => param(v)).join(', ');
  return f.op === 'in' ? `${col} IN (${list})` : `(${col} IS NULL OR ${col} NOT IN (${list}))`;
}

function literal(value: Cell): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * Writes each parameter into the statement in place of its `?`, skipping
 * question marks inside quoted identifiers and string literals.
 */
export function displaySql(sql: string, params: Cell[]): string {
  let out = '';
  let next = 0;
  let quote: '"' | "'" | null = null;
  for (const ch of sql) {
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
    } else if (ch === '?') {
      if (next >= params.length) throw new Error('More placeholders than parameters');
      out += literal(params[next++]);
    } else {
      out += ch;
    }
  }
  if (next !== params.length) throw new Error('More parameters than placeholders');
  return out;
}
