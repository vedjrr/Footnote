// Data health checks H1 to H12 (analytics-spec §3). Each check runs its own
// statements through the engine, never changes the data, and reports a
// sentence, a count and share of rows, up to five example rows, the metrics
// it affects and the SQL behind its count.

import type { Cell, QueryEngine, QueryResult } from '@/core/engine/types';
import { type Role, assignRoles } from '@/core/model/infer';
import type { SemanticModel } from '@/core/model/types';
import { metricsUsing } from '@/core/model/usage';
import {
  formatDay,
  formatInteger,
  formatMonth,
  formatNumber,
  formatShare,
} from '@/core/narrative/format';
import {
  type ColumnProfile,
  type Profile,
  literal,
  quoteColumn,
  quoteTable,
  valueExpr,
} from '@/core/profile/profile';
import * as T from './thresholds';

export type CheckId =
  'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'H8' | 'H9' | 'H10' | 'H11' | 'H12';

export type Severity = 'serious' | 'minor' | 'information';

export interface Examples {
  columns: string[];
  rows: Cell[][];
}

export interface HealthProblem {
  check: CheckId;
  /** A short name for the kind of problem: "Duplicate rows". */
  title: string;
  severity: Severity;
  /** The columns involved; empty for whole rows. */
  columns: string[];
  /** One plain sentence. */
  statement: string;
  /** Rows affected (for H8, periods missing). */
  count: number;
  /** count / rows, 0..1 (for H8, of the periods in range). */
  share: number;
  examples: Examples;
  /** Metric ids whose values the problem can change. */
  metrics: string[];
  /** Dimension ids whose breakdowns the problem can change. */
  dimensions: string[];
  /** The statement the count came from. */
  sql: string;
}

export interface HealthReport {
  table: string;
  rows: number;
  /** Most serious first, then largest share. */
  problems: HealthProblem[];
  /** Every statement that ran, in order. */
  sql: string[];
}

export interface HealthOptions {
  /**
   * The latest plausible date (ISO), for H9; dates after it are reported.
   * Left out, the future-date part of H9 does not run.
   */
  latestPlausible?: string;
}

interface Ctx {
  engine: QueryEngine;
  profile: Profile;
  model: SemanticModel;
  roles: Map<string, Role>;
  rows: number;
  table: string;
  sql: string[];
  options: HealthOptions;
}

const SEVERITY_RANK: Record<Severity, number> = { serious: 0, minor: 1, information: 2 };

export async function checkHealth(
  engine: QueryEngine,
  profile: Profile,
  model: SemanticModel,
  options: HealthOptions = {},
): Promise<HealthReport> {
  const ctx: Ctx = {
    engine,
    profile,
    model,
    roles: assignRoles(profile),
    rows: profile.rows,
    table: quoteTable(profile.table),
    sql: [],
    options,
  };
  const problems: HealthProblem[] = [];
  if (profile.rows > 0) {
    for (const check of CHECKS) {
      for (const p of await check(ctx)) {
        const dimensions = model.dimensions.filter((d) => p.columns.includes(d.column));
        problems.push({ ...p, dimensions: dimensions.map((d) => d.id) });
      }
    }
  }
  problems.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.share - a.share ||
      checkOrder(a.check) - checkOrder(b.check),
  );
  return { table: profile.table, rows: profile.rows, problems, sql: ctx.sql };
}

const checkOrder = (id: CheckId) => Number(id.slice(1));

async function run(ctx: Ctx, sql: string): Promise<QueryResult> {
  ctx.sql.push(sql);
  return ctx.engine.query(sql);
}

function value(result: QueryResult, row: number, name: string): Cell {
  const i = result.columns.findIndex((c) => c.name === name);
  return i === -1 ? null : (result.rows[row]?.[i] ?? null);
}

const n = (cell: Cell): number => (cell === null ? 0 : Number(cell));

async function examples(ctx: Ctx, where: string, limit = T.EXAMPLE_ROWS): Promise<Examples> {
  const result = await run(
    ctx,
    `SELECT * FROM ${ctx.table} WHERE ${where} ORDER BY ALL LIMIT ${limit}`,
  );
  return { columns: result.columns.map((c) => c.name), rows: result.rows };
}

const allMetrics = (ctx: Ctx) => ctx.model.metrics.map((m) => m.id);
const rowsOf = (count: number) => `${formatInteger(count)} ${count === 1 ? 'row' : 'rows'}`;
const ofRows = (ctx: Ctx, count: number) => `${rowsOf(count)} (${formatShare(count / ctx.rows)})`;

function columnsWithRole(ctx: Ctx, ...roles: Role[]): ColumnProfile[] {
  return ctx.profile.columns.filter((c) => roles.includes(ctx.roles.get(c.name) ?? 'other'));
}

/** Columns the dictionary uses: the time column, dimensions and metric columns. */
function dictionaryColumns(model: SemanticModel): Set<string> {
  const used = new Set<string>(model.dimensions.map((d) => d.column));
  if (model.time) used.add(model.time.column);
  for (const m of model.metrics) if (m.kind === 'simple' && m.column) used.add(m.column);
  return used;
}

function isEmptyExpr(col: ColumnProfile): string {
  const c = quoteColumn(col.name);
  return col.storageType === 'text' ? `(${c} IS NULL OR trim(${c}) = '')` : `${c} IS NULL`;
}

// ------------------------------------------------------------------- checks

/** H1: exact duplicate rows. */
async function duplicates(ctx: Ctx): Promise<Found[]> {
  const cols = ctx.profile.columns.map((c) => quoteColumn(c.name)).join(', ');
  const sql =
    `SELECT CAST(COALESCE(sum(n - 1), 0) AS BIGINT) AS extra FROM ` +
    `(SELECT count(*) AS n FROM ${ctx.table} GROUP BY ${cols}) g WHERE n > 1`;
  const count = n(value(await run(ctx, sql), 0, 'extra'));
  if (count === 0) return [];
  const ex = await run(
    ctx,
    `SELECT *, CAST(count(*) AS BIGINT) AS copies FROM ${ctx.table} GROUP BY ALL ` +
      `HAVING count(*) > 1 ORDER BY ALL LIMIT ${T.EXAMPLE_ROWS}`,
  );
  const share = count / ctx.rows;
  return [
    {
      check: 'H1',
      title: 'Duplicate rows',
      severity: share >= T.DUPLICATE_SERIOUS_SHARE ? 'serious' : 'minor',
      columns: [],
      statement: `${ofRows(ctx, count)} repeat an earlier row exactly.`,
      count,
      share,
      examples: { columns: ex.columns.map((c) => c.name), rows: ex.rows },
      metrics: allMetrics(ctx),
      sql,
    },
  ];
}

/** H2: an identifier that looks unique has repeats. */
async function repeatedIdentifiers(ctx: Ctx): Promise<Found[]> {
  const out: Found[] = [];
  for (const col of columnsWithRole(ctx, 'identifier')) {
    const filled = ctx.rows - col.empty;
    if (col.distinct >= filled || col.distinct < T.IDENTIFIER_UNIQUE_SHARE * filled) continue;
    const c = quoteColumn(col.name);
    const sql =
      `SELECT CAST(count(*) - count(DISTINCT ${c}) AS BIGINT) AS repeats ` +
      `FROM ${ctx.table} WHERE NOT ${isEmptyExpr(col)}`;
    const count = n(value(await run(ctx, sql), 0, 'repeats'));
    if (count === 0) continue;
    out.push({
      check: 'H2',
      title: 'Repeated identifier',
      severity: 'serious',
      columns: [col.name],
      statement: `${ofRows(ctx, count)} repeat a ${col.name} already used on another row.`,
      count,
      share: count / ctx.rows,
      examples: await examples(
        ctx,
        `${c} IN (SELECT ${c} FROM ${ctx.table} GROUP BY 1 HAVING count(*) > 1)`,
      ),
      metrics: allMetrics(ctx),
      sql,
    });
  }
  return out;
}

/** H3: empty values. */
async function emptyValues(ctx: Ctx): Promise<Found[]> {
  const inDictionary = dictionaryColumns(ctx.model);
  const candidates = ctx.profile.columns.filter((c) => {
    const floor = inDictionary.has(c.name) ? T.EMPTY_DICTIONARY_FLOOR : T.EMPTY_FLOOR;
    return c.empty > 0 && c.empty / ctx.rows >= floor;
  });
  if (candidates.length === 0) return [];
  const sql =
    `SELECT ` +
    candidates
      .map((c, i) => `CAST(count(*) FILTER (WHERE ${isEmptyExpr(c)}) AS BIGINT) AS e${i}`)
      .join(', ') +
    ` FROM ${ctx.table}`;
  const result = await run(ctx, sql);
  const out: Found[] = [];
  for (const [i, col] of candidates.entries()) {
    const count = n(value(result, 0, `e${i}`));
    if (count === 0) continue;
    const share = count / ctx.rows;
    const metrics = metricsUsing(ctx.model, [col.name]);
    const averagedOnly = averagedOnlyMetrics(ctx.model, col.name);
    let severity: Severity = 'minor';
    let statement = `${col.name} is empty in ${ofRows(ctx, count)}.`;
    if (averagedOnly.length > 0) {
      // An average over the rows that have a value is what the metric means,
      // so emptiness is information, not a problem (D-032, Q-07).
      severity = 'information';
      const labels = averagedOnly.map((m) => m.label).join(' and ');
      statement =
        `${col.name} is empty in ${ofRows(ctx, count)}. ` +
        `${labels} ${averagedOnly.length === 1 ? 'uses' : 'use'} only the rows with a value.`;
    } else if (inDictionary.has(col.name) && share >= T.EMPTY_SERIOUS_SHARE) {
      severity = 'serious';
    }
    out.push({
      check: 'H3',
      title: 'Empty values',
      severity,
      columns: [col.name],
      statement,
      count,
      share,
      examples: await examples(ctx, isEmptyExpr(col)),
      metrics,
      sql,
    });
  }
  return out;
}

/**
 * The metrics on a column that skip empty values by definition (averages,
 * medians, minimums, maximums), when those are all the column feeds and it
 * is not a dimension. Empty for any other column.
 */
function averagedOnlyMetrics(model: SemanticModel, column: string) {
  if (model.dimensions.some((d) => d.column === column)) return [];
  const direct = model.metrics.filter((m) => m.kind === 'simple' && m.column === column);
  const skipping = direct.filter(
    (m) => m.kind === 'simple' && ['avg', 'median', 'min', 'max'].includes(m.agg),
  );
  return direct.length > 0 && skipping.length === direct.length ? skipping : [];
}

/** H4: category labels that differ only by case or surrounding spaces. */
async function labelVariants(ctx: Ctx): Promise<Found[]> {
  const cols = ctx.model.dimensions
    .filter((d) => d.role === 'category')
    .map((d) => ctx.profile.columns.find((c) => c.name === d.column))
    .filter((c): c is ColumnProfile => c?.storageType === 'text');
  if (cols.length === 0) return [];
  const sql = cols
    .map((col, i) => {
      const c = quoteColumn(col.name);
      return (
        `SELECT ${i} AS col, lower(trim(${c})) AS key, ${c} AS value, CAST(count(*) AS BIGINT) AS n ` +
        `FROM ${ctx.table} WHERE NOT ${isEmptyExpr(col)} GROUP BY 2, 3`
      );
    })
    .join('\nUNION ALL\n')
    .concat('\nORDER BY col, key, n DESC, value');
  const result = await run(ctx, sql);
  const out: Found[] = [];
  for (const [i, col] of cols.entries()) {
    const groups = new Map<string, Array<{ value: string; n: number }>>();
    result.rows.forEach((_, r) => {
      if (n(value(result, r, 'col')) !== i) return;
      const key = String(value(result, r, 'key'));
      const list = groups.get(key) ?? [];
      list.push({ value: String(value(result, r, 'value')), n: n(value(result, r, 'n')) });
      groups.set(key, list);
    });
    const variants = [...groups.values()].filter((g) => g.length > 1);
    if (variants.length === 0) continue;
    // The most common spelling in each group is taken as the intended one.
    const odd = variants.flatMap((g) => g.slice(1));
    const count = odd.reduce((s, v) => s + v.n, 0);
    const share = count / ctx.rows;
    const first = variants[0];
    out.push({
      check: 'H4',
      title: 'Label variants',
      severity: share >= T.VARIANT_SERIOUS_SHARE ? 'serious' : 'minor',
      columns: [col.name],
      statement:
        `${col.name} has ${formatInteger(odd.length)} ${odd.length === 1 ? 'label' : 'labels'} ` +
        `that differ only by case or spaces, such as "${first[1].value}" for "${first[0].value}", ` +
        `in ${ofRows(ctx, count)}.`,
      count,
      share,
      examples: await examples(
        ctx,
        `${quoteColumn(col.name)} IN (${odd.map((v) => literal(v.value)).join(', ')})`,
      ),
      metrics: metricsUsing(ctx.model, [col.name]),
      sql,
    });
  }
  return out;
}

/**
 * H5: values far beyond the median, measured in MADs. A measure that is
 * almost always above 0 is measured on the log scale, so a long right tail
 * (a few large accounts, slow tickets) is not reported as extreme (D-032).
 */
async function extremeValues(ctx: Ctx): Promise<Found[]> {
  const cols = columnsWithRole(ctx, 'measure');
  if (cols.length === 0) return [];
  const scaled = cols.map((col) => {
    const raw = valueExpr(col);
    const positive = 1 - (col.numeric?.zeroShare ?? 1) - (col.numeric?.negativeShare ?? 0);
    const log = positive >= T.LOG_SCALE_POSITIVE_SHARE;
    return { col, log, x: log ? `CASE WHEN ${raw} > 0 THEN ln(${raw}) END` : raw };
  });
  const sql = scaled
    .map(
      ({ x }, i) =>
        `SELECT ${i} AS col, s.med, s.mad, CAST(count(*) FILTER (WHERE abs(${x} - s.med) > ` +
        `${T.EXTREME_MADS} * ${T.MAD_SCALE} * s.mad) AS BIGINT) AS n ` +
        `FROM ${ctx.table}, (SELECT CAST(median(${x}) AS DOUBLE) AS med, ` +
        `CAST(mad(${x}) AS DOUBLE) AS mad FROM ${ctx.table}) s GROUP BY s.med, s.mad`,
    )
    .join('\nUNION ALL\n');
  const result = await run(ctx, sql);
  const out: Found[] = [];
  for (const [i, { col, log, x }] of scaled.entries()) {
    const r = result.rows.findIndex((row) => Number(row[0]) === i);
    if (r === -1) continue;
    const med = n(value(result, r, 'med'));
    const mad = n(value(result, r, 'mad'));
    const count = n(value(result, r, 'n'));
    if (mad === 0 || count === 0) continue;
    const width = T.EXTREME_MADS * T.MAD_SCALE * mad;
    const back = (v: number) => (log ? Math.exp(v) : v);
    const [lo, hi] = [back(med - width), back(med + width)];
    const min = col.numeric?.min ?? lo;
    const max = col.numeric?.max ?? hi;
    const parts = [
      ...(min < lo ? [`below ${plainNumber(lo)}`] : []),
      ...(max > hi ? [`above ${plainNumber(hi)}`] : []),
    ];
    out.push({
      check: 'H5',
      title: 'Extreme values',
      severity: 'minor',
      columns: [col.name],
      statement:
        `${col.name} has ${ofRows(ctx, count)} with values far from the typical ones, ` +
        `${parts.join(' or ')}.`,
      count,
      share: count / ctx.rows,
      examples: await examples(ctx, `abs(${x} - ${med}) > ${width}`, T.EXTREME_EXAMPLE_ROWS),
      metrics: metricsUsing(ctx.model, [col.name]),
      sql,
    });
  }
  return out;
}

function plainNumber(x: number): string {
  return formatNumber(x, 2);
}

/** H6: negatives in a measure that is almost never negative. */
async function negativeValues(ctx: Ctx): Promise<Found[]> {
  const cols = columnsWithRole(ctx, 'measure').filter((c) => {
    const neg = c.numeric?.negativeShare ?? 0;
    return neg > 0 && neg <= 1 - T.NON_NEGATIVE_SHARE;
  });
  const out: Found[] = [];
  for (const col of cols) {
    const x = valueExpr(col);
    const sql = `SELECT CAST(count(*) FILTER (WHERE ${x} < 0) AS BIGINT) AS n FROM ${ctx.table}`;
    const count = n(value(await run(ctx, sql), 0, 'n'));
    if (count === 0) continue;
    out.push({
      check: 'H6',
      title: 'Negative values',
      severity: 'minor',
      columns: [col.name],
      statement: `${col.name} is negative in ${ofRows(ctx, count)}, though almost every other value is zero or more.`,
      count,
      share: count / ctx.rows,
      examples: await examples(ctx, `${x} < 0`),
      metrics: metricsUsing(ctx.model, [col.name]),
      sql,
    });
  }
  return out;
}

/** H7: values that failed type refinement. */
async function unparsedValues(ctx: Ctx): Promise<Found[]> {
  const out: Found[] = [];
  for (const col of ctx.profile.columns) {
    if (!col.refinement || col.refinement.unparsed === 0 || col.type === 'boolean') continue;
    const where = `NOT ${isEmptyExpr(col)} AND ${valueExpr(col)} IS NULL`;
    const sql = `SELECT CAST(count(*) FILTER (WHERE ${where}) AS BIGINT) AS n FROM ${ctx.table}`;
    const count = n(value(await run(ctx, sql), 0, 'n'));
    if (count === 0) continue;
    const kind = col.type === 'date' ? 'dates' : 'numbers';
    out.push({
      check: 'H7',
      title: 'Unreadable values',
      severity: 'minor',
      columns: [col.name],
      statement: `${col.name} has ${ofRows(ctx, count)} with values that could not be read as ${kind}.`,
      count,
      share: count / ctx.rows,
      examples: await examples(ctx, where),
      metrics: metricsUsing(ctx.model, [col.name]),
      sql,
    });
  }
  return out;
}

/** The grain the time column is recorded at: month, week or day. */
async function nativeGrain(ctx: Ctx, t: string): Promise<'month' | 'week' | 'day'> {
  const result = await run(
    ctx,
    `SELECT CAST(count(*) FILTER (WHERE day(${t}) <> 1) AS BIGINT) AS off_first, ` +
      `CAST(count(DISTINCT isodow(${t})) AS BIGINT) AS weekdays, ` +
      `CAST(count(DISTINCT CAST(${t} AS DATE)) AS BIGINT) AS days ` +
      `FROM ${ctx.table} WHERE ${t} IS NOT NULL`,
  );
  const days = n(value(result, 0, 'days'));
  if (days > 1 && n(value(result, 0, 'off_first')) === 0) return 'month';
  if (days > 1 && n(value(result, 0, 'weekdays')) === 1) return 'week';
  return 'day';
}

/** H8: periods with no rows inside the range of the time column. */
async function timeGaps(ctx: Ctx): Promise<Found[]> {
  const time = ctx.model.time;
  if (!time) return [];
  const t = quoteColumn(time.column);
  const grain = await nativeGrain(ctx, t);
  const sql =
    `WITH p AS (SELECT DISTINCT CAST(date_trunc('${grain}', ${t}) AS DATE) AS period ` +
    `FROM ${ctx.table} WHERE ${t} IS NOT NULL), ` +
    `all_p AS (SELECT CAST(g AS DATE) AS period FROM p, generate_series(` +
    `(SELECT min(period) FROM p), (SELECT max(period) FROM p), INTERVAL 1 ${grain}) s(g) ` +
    `GROUP BY 1) ` +
    `SELECT period, (SELECT CAST(count(*) AS BIGINT) FROM all_p) AS periods FROM all_p ` +
    `WHERE period NOT IN (SELECT period FROM p) ORDER BY period`;
  const result = await run(ctx, sql);
  const count = result.rowCount;
  if (count === 0) return [];
  const periods = n(value(result, 0, 'periods'));
  const name = (iso: string) => (grain === 'month' ? formatMonth(iso) : formatDay(iso));
  const listed = result.rows.slice(0, T.EXAMPLE_ROWS).map((r) => name(String(r[0])));
  return [
    {
      check: 'H8',
      title: 'Gaps in time',
      severity: 'minor',
      columns: [time.column],
      statement:
        `${formatInteger(count)} ${grain}${count === 1 ? '' : 's'} inside the range of ` +
        `${time.column} have no rows, starting with ${listed.join(', ')}.`,
      count,
      share: periods > 0 ? count / periods : 0,
      examples: {
        columns: [`missing ${grain}`],
        rows: result.rows.slice(0, T.EXAMPLE_ROWS).map((r) => [r[0]]),
      },
      metrics: allMetrics(ctx),
      sql,
    },
  ];
}

/** H9: an end before its start, and dates after the latest plausible date. */
async function datesOutOfOrder(ctx: Ctx): Promise<Found[]> {
  const out: Found[] = [];
  const time = ctx.model.time;
  const temporal = ctx.profile.columns.filter((c) => c.type === 'date' || c.type === 'timestamp');
  if (time) {
    const t = quoteColumn(time.column);
    for (const col of temporal.filter((c) => c.name !== time.column)) {
      const o = valueExpr(col);
      const sql =
        `SELECT CAST(count(*) FILTER (WHERE ${o} IS NOT NULL AND ${t} IS NOT NULL) AS BIGINT) AS both, ` +
        `CAST(count(*) FILTER (WHERE ${o} < ${t}) AS BIGINT) AS before FROM ${ctx.table}`;
      const result = await run(ctx, sql);
      const both = n(value(result, 0, 'both'));
      const count = n(value(result, 0, 'before'));
      // Only a column that almost always comes after the time column is an
      // end date; one that is often earlier is just another date.
      if (count === 0 || both === 0 || count / both > 1 - T.END_AFTER_START_SHARE) continue;
      out.push({
        check: 'H9',
        title: 'Dates out of order',
        severity: 'serious',
        columns: [time.column, col.name],
        statement: `${col.name} is before ${time.column} in ${ofRows(ctx, count)}.`,
        count,
        share: count / ctx.rows,
        examples: await examples(ctx, `${o} < ${t}`),
        metrics: metricsUsing(ctx.model, [time.column, col.name]),
        sql,
      });
    }
  }
  const latest = ctx.options.latestPlausible;
  if (latest) {
    for (const col of temporal) {
      const where = `CAST(${valueExpr(col)} AS DATE) > DATE ${literal(latest.slice(0, 10))}`;
      const sql = `SELECT CAST(count(*) FILTER (WHERE ${where}) AS BIGINT) AS n FROM ${ctx.table}`;
      const count = n(value(await run(ctx, sql), 0, 'n'));
      if (count === 0) continue;
      out.push({
        check: 'H9',
        title: 'Dates in the future',
        severity: 'serious',
        columns: [col.name],
        statement: `${col.name} is after ${formatDay(latest)} in ${ofRows(ctx, count)}.`,
        count,
        share: count / ctx.rows,
        examples: await examples(ctx, where),
        metrics: metricsUsing(ctx.model, [col.name]),
        sql,
      });
    }
  }
  return out;
}

/** H10: the latest period at the default grain is incomplete (analytics-spec §4). */
async function incompleteLatest(ctx: Ctx): Promise<Found[]> {
  const time = ctx.model.time;
  if (!time) return [];
  const t = quoteColumn(time.column);
  const grain = time.defaultGrain;
  const sql =
    `SELECT CAST(date_trunc('${grain}', ${t}) AS DATE) AS period, ` +
    `CAST(count(DISTINCT CAST(${t} AS DATE)) AS BIGINT) AS days, ` +
    `CAST(max(CAST(${t} AS DATE)) AS DATE) AS last_day, ` +
    `CAST(date_trunc('${grain}', ${t}) + INTERVAL 1 ${grain} - INTERVAL 1 day AS DATE) AS period_end, ` +
    `CAST(count(*) AS BIGINT) AS n ` +
    `FROM ${ctx.table} WHERE ${t} IS NOT NULL GROUP BY 1, 4 ORDER BY 1`;
  const result = await run(ctx, sql);
  if (result.rowCount < 2) return [];
  const last = result.rowCount - 1;
  const days = n(value(result, last, 'days'));
  if (String(value(result, last, 'last_day')) >= String(value(result, last, 'period_end'))) {
    return [];
  }
  const earlier = result.rows.slice(0, last).map((_, r) => n(value(result, r, 'days')));
  const usual = median(earlier);
  if (days >= T.COMPLETE_PERIOD_SHARE * usual) return [];
  const count = n(value(result, last, 'n'));
  const period = String(value(result, last, 'period'));
  const name = grain === 'month' ? formatMonth(period) : `${grain} of ${formatDay(period)}`;
  return [
    {
      check: 'H10',
      title: 'Incomplete latest period',
      severity: 'information',
      columns: [time.column],
      statement:
        `The latest ${grain}, ${name}, has data on ${formatInteger(days)} ` +
        `${days === 1 ? 'day' : 'days'} against a usual ${formatInteger(usual)}, ` +
        `so comparisons use the ${grain} before it.`,
      count,
      share: count / ctx.rows,
      examples: await examples(
        ctx,
        `CAST(date_trunc('${grain}', ${t}) AS DATE) = DATE ${literal(period)}`,
      ),
      metrics: allMetrics(ctx),
      sql,
    },
  ];
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** H11: a column with one distinct value. */
async function constantColumns(ctx: Ctx): Promise<Found[]> {
  const out: Found[] = [];
  for (const col of ctx.profile.columns.filter((c) => c.distinct === 1)) {
    const c = quoteColumn(col.name);
    const sql =
      `SELECT CAST(count(*) AS BIGINT) AS n, CAST(min(${c}) AS VARCHAR) AS only ` +
      `FROM ${ctx.table} WHERE NOT ${isEmptyExpr(col)}`;
    const result = await run(ctx, sql);
    const count = n(value(result, 0, 'n'));
    out.push({
      check: 'H11',
      title: 'Constant column',
      severity: 'information',
      columns: [col.name],
      statement: `${col.name} has the same value, "${String(value(result, 0, 'only'))}", in every row that has one.`,
      count,
      share: count / ctx.rows,
      examples: await examples(ctx, `NOT ${isEmptyExpr(col)}`),
      metrics: metricsUsing(ctx.model, [col.name]),
      sql,
    });
  }
  return out;
}

/**
 * H12: one additive measure is 0 while another on the same row is above 0,
 * in a small share of the rows where the other is above 0 (D-032, Q-06).
 * Seats 0 with MRR above 0 is the usual case.
 */
async function zeroBesidePositive(ctx: Ctx): Promise<Found[]> {
  const summed = new Set(
    ctx.model.metrics.flatMap((m) =>
      m.kind === 'simple' && m.agg === 'sum' && m.column ? [m.column] : [],
    ),
  );
  const cols = columnsWithRole(ctx, 'measure').filter(
    (c) => summed.has(c.name) && (c.numeric?.min ?? -1) >= 0,
  );
  const pairs = cols.flatMap((a) => cols.filter((b) => b !== a).map((b) => [a, b] as const));
  if (pairs.length === 0) return [];
  const sql =
    `SELECT ` +
    pairs
      .map(([a, b], i) => {
        const [x, y] = [valueExpr(a), valueExpr(b)];
        return (
          `CAST(count(*) FILTER (WHERE ${x} = 0 AND ${y} > 0) AS BIGINT) AS z${i}, ` +
          `CAST(count(*) FILTER (WHERE ${y} > 0) AS BIGINT) AS p${i}`
        );
      })
      .join(', ') +
    ` FROM ${ctx.table}`;
  const result = await run(ctx, sql);
  const out: Found[] = [];
  for (const [i, [a, b]] of pairs.entries()) {
    const count = n(value(result, 0, `z${i}`));
    const positive = n(value(result, 0, `p${i}`));
    if (count === 0 || positive === 0 || count / positive > T.ZERO_BESIDE_POSITIVE_MAX) continue;
    const share = count / ctx.rows;
    out.push({
      check: 'H12',
      title: 'Zero beside a positive value',
      severity: share >= T.ZERO_BESIDE_POSITIVE_SERIOUS_SHARE ? 'serious' : 'minor',
      columns: [a.name, b.name],
      statement: `${a.name} is 0 while ${b.name} is above 0 in ${ofRows(ctx, count)}.`,
      count,
      share,
      examples: await examples(ctx, `${valueExpr(a)} = 0 AND ${valueExpr(b)} > 0`),
      metrics: metricsUsing(ctx.model, [a.name, b.name]),
      sql,
    });
  }
  return out;
}

type Found = Omit<HealthProblem, 'dimensions'>;

const CHECKS: Array<(ctx: Ctx) => Promise<Found[]>> = [
  duplicates,
  repeatedIdentifiers,
  emptyValues,
  labelVariants,
  extremeValues,
  negativeValues,
  unparsedValues,
  timeGaps,
  datesOutOfOrder,
  incompleteLatest,
  constantColumns,
  zeroBesidePositive,
];
