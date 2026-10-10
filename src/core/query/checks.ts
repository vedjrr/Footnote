// Result checks C1 to C8 (analytics-spec §8). Every result is checked before
// it is shown. Each check returns pass, caution or fail with a sentence, and
// the SQL it ran, if any; C8 is a note. A fail replaces the answer sentence.

import type { Cell, QueryEngine, QueryResult } from '@/core/engine/types';
import { type TimeFacts, dataNow, isComplete, periodStart } from '@/core/findings/periods';
import type { Metric, SemanticModel, SimpleMetric } from '@/core/model/types';
import {
  formatDay,
  formatInteger,
  formatMonth,
  formatNumber,
  formatShare,
} from '@/core/narrative/format';
import { quoteColumn, quoteTable } from '@/core/profile/profile';
import { type Compiled, compile, displaySql } from './compile';
import { type QuerySpecInput, querySpecSchema } from './spec';

export type CheckId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8';
export type CheckOutcome = 'pass' | 'caution' | 'fail' | 'note';

export interface ResultCheck {
  id: CheckId;
  outcome: CheckOutcome;
  sentence: string;
  /** The statement the check ran, when it ran one. */
  sql?: string;
}

export interface CheckInput {
  engine: QueryEngine;
  model: SemanticModel;
  spec: QuerySpecInput;
  compiled: Compiled;
  result: QueryResult;
  time: TimeFacts | null;
}

/** analytics-spec §1 */
const REL_TOLERANCE = 1e-6;
const ABS_TOLERANCE = 0.005;
/** C2, C6 */
const FEW_ROWS = 30;
/** C7 */
const DUPLICATE_SHARE = 0.005;
/** C3 */
const CLOSEST = 3;

const q = quoteColumn;

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(ABS_TOLERANCE, REL_TOLERANCE * Math.abs(b));
}

function column(result: QueryResult, name: string): Cell[] {
  const i = result.columns.findIndex((c) => c.name === name);
  return i === -1 ? [] : result.rows.map((r) => r[i]);
}

function plain(x: number): string {
  return formatNumber(x, 2);
}

export async function checkResult(input: CheckInput): Promise<ResultCheck[]> {
  const spec = querySpecSchema.parse(input.spec);
  const ctx = { ...input, spec };
  const out: ResultCheck[] = [];
  for (const check of [
    partsAddUp,
    enoughRows,
    filterValues,
    completePeriod,
    emptyResult,
    smallDenominator,
    duplicatesInScope,
    snapshotNote,
  ]) {
    const found = await check(ctx);
    if (found) out.push(found);
  }
  return out;
}

type Ctx = CheckInput & { spec: ReturnType<typeof querySpecSchema.parse> };

const metricOf = (model: SemanticModel, id: string) => model.metrics.find((m) => m.id === id)!;

async function run(
  ctx: Ctx,
  spec: QuerySpecInput,
): Promise<{ compiled: Compiled; result: QueryResult }> {
  const compiled = compile(spec, ctx.model, { time: ctx.time });
  return { compiled, result: await ctx.engine.query(compiled.sql, compiled.params) };
}

/** C1: an additive metric split by one dimension sums to the unsplit total. */
async function partsAddUp(ctx: Ctx): Promise<ResultCheck | null> {
  const { spec, model } = ctx;
  const additive = spec.metrics
    .map((id) => metricOf(model, id))
    .filter(
      (m): m is SimpleMetric => m.kind === 'simple' && (m.agg === 'sum' || m.agg === 'count'),
    );
  if (spec.by.length !== 1 || spec.time?.grain || spec.compare || additive.length === 0)
    return null;
  const totalSpec = { ...spec, by: [], sort: undefined, limit: undefined, calc: undefined };
  const total = await run(ctx, totalSpec);
  const shown = ctx.result.rowCount;

  if (spec.limit !== undefined) {
    const all = await run(ctx, { ...spec, sort: undefined, limit: undefined, calc: undefined });
    if (all.result.rowCount > shown) {
      const m = additive[0];
      const part = column(ctx.result, m.id).reduce<number>((s, v) => s + Number(v ?? 0), 0);
      const whole = Number(column(total.result, m.id)[0] ?? 0);
      return {
        id: 'C1',
        outcome: 'caution',
        sentence:
          `These are the top ${formatInteger(shown)} of ${formatInteger(all.result.rowCount)}, ` +
          `covering ${whole === 0 ? 'none' : formatShare(part / whole)} of ${m.label.toLowerCase()}.`,
        sql: all.compiled.displaySql,
      };
    }
  }
  for (const m of additive) {
    const part = column(ctx.result, m.id).reduce<number>((s, v) => s + Number(v ?? 0), 0);
    const whole = Number(column(total.result, m.id)[0] ?? 0);
    if (!near(part, whole)) {
      return {
        id: 'C1',
        outcome: 'fail',
        sentence: `The parts of ${m.label} add up to ${plain(part)}, but the total is ${plain(whole)}.`,
        sql: total.compiled.displaySql,
      };
    }
  }
  return {
    id: 'C1',
    outcome: 'pass',
    sentence: `The parts add up to the total.`,
    sql: total.compiled.displaySql,
  };
}

function scopeSql(ctx: Ctx, select: string): string {
  const { cte, compared } = ctx.compiled.base;
  return `WITH ${cte}\nSELECT ${select}\nFROM base${compared ? `\nWHERE ${q('_side')} = 'current'` : ''}`;
}

/** C2: enough rows behind the result. */
async function enoughRows(ctx: Ctx): Promise<ResultCheck> {
  const sql = scopeSql(ctx, 'CAST(count(*) AS BIGINT) AS n');
  const n = Number((await ctx.engine.query(sql, ctx.compiled.base.params)).rows[0][0] ?? 0);
  const display = displaySql(sql, ctx.compiled.base.params);
  if (n < FEW_ROWS) {
    return {
      id: 'C2',
      outcome: 'caution',
      sentence: `Only ${formatInteger(n)} ${n === 1 ? 'row is' : 'rows are'} behind this answer, so a few rows can move it a lot.`,
      sql: display,
    };
  }
  return {
    id: 'C2',
    outcome: 'pass',
    sentence: `${formatInteger(n)} rows are behind this answer.`,
    sql: display,
  };
}

/** C3: each filter value matched at least one row. */
async function filterValues(ctx: Ctx): Promise<ResultCheck | null> {
  const { spec, model } = ctx;
  if (spec.filters.length === 0) return null;
  const table = quoteTable(model.table);
  for (const f of spec.filters) {
    const dim = model.dimensions.find((d) => d.id === f.dimension)!;
    const col = `CAST(${q(dim.column)} AS VARCHAR)`;
    for (const value of f.values) {
      const match = f.op === 'contains' ? `contains(lower(${col}), lower(?))` : `${col} = ?`;
      const sql = `SELECT CAST(count(*) AS BIGINT) AS n FROM ${table} WHERE ${match}`;
      const n = Number((await ctx.engine.query(sql, [value])).rows[0][0] ?? 0);
      if (n > 0) continue;
      const closest = await ctx.engine.query(
        `SELECT v FROM (SELECT DISTINCT ${col} AS v FROM ${table} WHERE ${q(dim.column)} IS NOT NULL) ` +
          `ORDER BY levenshtein(lower(v), lower(?)), v LIMIT ${CLOSEST}`,
        [value],
      );
      const options = closest.rows.map((r) => `"${String(r[0])}"`);
      return {
        id: 'C3',
        outcome: 'fail',
        sentence:
          `No row has ${dim.label.toLowerCase()} ${f.op === 'contains' ? 'containing ' : ''}"${value}".` +
          (options.length ? ` Closest values: ${options.join(', ')}.` : ''),
        sql: displaySql(sql, [value]),
      };
    }
  }
  return { id: 'C3', outcome: 'pass', sentence: 'Every filter value matched rows.' };
}

/** C4: the range includes an incomplete latest period. */
async function completePeriod(ctx: Ctx): Promise<ResultCheck | null> {
  const { model, time, compiled, spec } = ctx;
  if (!model.time || !time || time.days.length === 0) return null;
  const now = dataNow(time);
  const range = compiled.range;
  if (range && (now < range.from || now > range.to)) {
    return { id: 'C4', outcome: 'pass', sentence: 'Every period in range is complete.' };
  }
  const grain = spec.time?.grain ?? model.time.defaultGrain;
  const latest = periodStart(now, grain);
  if (isComplete(latest, grain, time)) {
    return { id: 'C4', outcome: 'pass', sentence: 'Every period in range is complete.' };
  }
  const name =
    grain === 'month' ? formatMonth(latest) : `the ${grain} starting ${formatDay(latest)}`;
  return {
    id: 'C4',
    outcome: 'caution',
    sentence: `The range includes ${name}, which is not complete: the data runs to ${formatDay(now)}.`,
  };
}

/** C5: no rows, or every value empty. */
async function emptyResult(ctx: Ctx): Promise<ResultCheck> {
  const metricCols = ctx.compiled.columns.filter((c) => c.kind === 'metric').map((c) => c.name);
  const empty =
    ctx.result.rowCount === 0 ||
    metricCols.every((name) => column(ctx.result, name).every((v) => v === null));
  return empty
    ? {
        id: 'C5',
        outcome: 'fail',
        sentence: 'No rows match this question, so there is nothing to show.',
      }
    : { id: 'C5', outcome: 'pass', sentence: 'The result has values.' };
}

/** C6: a ratio's denominator is 0, or a count under 30. */
async function smallDenominator(ctx: Ctx): Promise<ResultCheck | null> {
  const { spec, model } = ctx;
  const ratios = spec.metrics
    .map((id) => metricOf(model, id))
    .filter((m): m is Extract<Metric, { kind: 'ratio' }> => m.kind === 'ratio');
  if (ratios.length === 0) return null;
  const denominators = [...new Set(ratios.map((r) => r.denominator))];
  const { compiled, result } = await run(ctx, {
    ...spec,
    metrics: denominators,
    sort: undefined,
    limit: undefined,
    calc: undefined,
  });
  let caution: ResultCheck | null = null;
  for (const r of ratios) {
    const den = metricOf(model, r.denominator);
    const names = spec.compare ? [den.id, `${den.id}__previous`] : [den.id];
    const values = names.flatMap((n) => column(result, n)).map((v) => (v === null ? 0 : Number(v)));
    if (values.some((v) => v === 0)) {
      return {
        id: 'C6',
        outcome: 'fail',
        sentence: `${den.label} is 0 in part of this answer, so ${r.label} cannot be worked out there.`,
        sql: compiled.displaySql,
      };
    }
    const isCount = den.kind === 'simple' && (den.agg === 'count' || den.agg === 'count_distinct');
    if (isCount && values.some((v) => v < FEW_ROWS) && !caution) {
      caution = {
        id: 'C6',
        outcome: 'caution',
        sentence: `${r.label} rests on fewer than ${FEW_ROWS} ${den.label.toLowerCase()} in part of this answer.`,
        sql: compiled.displaySql,
      };
    }
  }
  return (
    caution ?? {
      id: 'C6',
      outcome: 'pass',
      sentence: 'Every ratio has a large enough denominator.',
      sql: compiled.displaySql,
    }
  );
}

/** C7: exact duplicates are 0.5% or more of the rows in scope. */
async function duplicatesInScope(ctx: Ctx): Promise<ResultCheck> {
  const { cte } = ctx.compiled.base;
  const sql =
    `WITH ${cte}\nSELECT CAST(count(*) AS BIGINT) AS n, ` +
    `CAST(count(*) - (SELECT count(*) FROM (SELECT DISTINCT * FROM base)) AS BIGINT) AS d\nFROM base`;
  const row = (await ctx.engine.query(sql, ctx.compiled.base.params)).rows[0];
  const [n, d] = [Number(row[0] ?? 0), Number(row[1] ?? 0)];
  const share = n === 0 ? 0 : d / n;
  if (share >= DUPLICATE_SHARE) {
    return {
      id: 'C7',
      outcome: 'caution',
      sentence: `${formatInteger(d)} of the rows in scope (${formatShare(share)}) are exact duplicates, so totals may be too high.`,
      sql: displaySql(sql, ctx.compiled.base.params),
    };
  }
  return {
    id: 'C7',
    outcome: 'pass',
    sentence: 'Duplicates are not a concern in this scope.',
    sql: displaySql(sql, ctx.compiled.base.params),
  };
}

/** C8: an `overTime: last` metric over several periods. */
async function snapshotNote(ctx: Ctx): Promise<ResultCheck | null> {
  const { spec, model, time, compiled } = ctx;
  if (!model.time || spec.time?.grain) return null;
  const parts = new Set<SimpleMetric>();
  const collect = (m: Metric) => {
    if (m.kind === 'simple') parts.add(m);
    else if (m.kind === 'ratio')
      [m.numerator, m.denominator].forEach((id) => collect(metricOf(model, id)));
    else [m.minuend, m.subtrahend].forEach((id) => collect(metricOf(model, id)));
  };
  spec.metrics.forEach((id) => collect(metricOf(model, id)));
  const last = [...parts].filter((m) => m.overTime === 'last');
  if (last.length === 0 || !time) return null;
  const range = compiled.range;
  const days = time.days.filter((d) => !range || (d >= range.from && d <= range.to));
  if (days.length < 2) return null;
  const labels = last.map((m) => m.label);
  return {
    id: 'C8',
    outcome: 'note',
    sentence: `${labels.join(' and ')} ${labels.length === 1 ? 'is' : 'are'} taken at the end of the period, not added up.`,
  };
}
