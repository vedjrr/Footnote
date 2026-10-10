// Key changes (analytics-spec §5.1, FR-20): for each metric, how the latest
// complete period compares with the one before, and whether that change is
// within the normal range for the metric.
//
// Each metric runs two compiled queries. `series` holds every complete
// period up to the current one; the normal-range label is worked out from
// its cells. `compare` is the current period against the previous one; the
// current, previous, change and percent change facts are its cells, so the
// numbers a sentence shows come straight from SQL.
//
// With a full season and seven more periods of history, the change compared
// is against the same period last season (December against December), so a
// seasonal peak is not called unusual. With less, it is the change on the
// period before. Under eight periods, it is not assessed.

import type { QueryEngine, QueryResult } from '@/core/engine/types';
import type { Grain, SemanticModel } from '@/core/model/types';
import { type Compiled, compile } from '@/core/query/compile';
import { withTimeout } from '@/core/query/guard';
import { type QuerySpec, querySpecSchema, type QuerySpecInput } from '@/core/query/spec';
import {
  KEY_CHANGE_PCT_FULL,
  KEY_CHANGE_POINTS_FULL,
  KEY_CHANGE_WEIGHTS,
  KEY_CHANGE_Z_FULL,
  LITTLE_CHANGE_PCT,
  LITTLE_CHANGE_POINTS,
  MIN_PERIODS,
  SEASON,
  SEASONAL_EXTRA_PERIODS,
  Z_LARGER,
  Z_UNUSUAL,
} from './constants';
import type {
  ChangeAssessment,
  FindingFact,
  FindingQuery,
  KeyChange,
  NormalRange,
} from './finding';
import {
  type TimeFacts,
  addPeriods,
  currentPeriod,
  firstDay,
  periodEnd,
  periodStart,
} from './periods';
import { robustZ } from './stats';

export function normalRange(z: number | null): NormalRange {
  if (z === null) return 'not_assessed';
  const size = Math.abs(z);
  if (size >= Z_UNUSUAL) return 'unusually_large';
  if (size >= Z_LARGER) return 'larger_than_usual';
  return 'normal';
}

/** Differences `v[i] - v[i - lag]` for `from <= i < to`, skipping empty values. */
function differences(values: (number | null)[], lag: number, from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = Math.max(from, lag); i < to; i++) {
    const [a, b] = [values[i], values[i - lag]];
    if (a !== null && b !== null) out.push(a - b);
  }
  return out;
}

/**
 * Assess the change into the last value of a series of consecutive complete
 * periods (analytics-spec §5.1). `percent` marks a metric shown as a
 * percentage, whose change is reported in points.
 */
export function assessChange(
  values: (number | null)[],
  grain: Grain,
  percent: boolean,
): ChangeAssessment {
  const n = values.length;
  const current = n > 0 ? values[n - 1] : null;
  const previous = n > 1 ? values[n - 2] : null;
  const change = current !== null && previous !== null ? current - previous : null;
  const pct = change !== null && previous !== 0 ? change / Math.abs(previous!) : null;
  const littleChanged =
    change !== null &&
    (percent
      ? Math.abs(change) < LITTLE_CHANGE_POINTS
      : pct !== null
        ? Math.abs(pct) < LITTLE_CHANGE_PCT
        : change === 0);
  const out: ChangeAssessment = {
    label: 'not_assessed',
    basis: null,
    z: null,
    history: 0,
    reason: null,
    change,
    pct,
    points: percent,
    littleChanged,
  };

  const season = SEASON[grain];
  let basis: ChangeAssessment['basis'];
  let lag: number;
  if (season !== null && n >= season + SEASONAL_EXTRA_PERIODS) [basis, lag] = ['seasonal', season];
  else if (n >= MIN_PERIODS) [basis, lag] = ['sequential', 1];
  else return { ...out, reason: 'short_history' };

  const x =
    current !== null && values[n - 1 - lag] !== null ? current - values[n - 1 - lag]! : null;
  if (x === null) return { ...out, reason: 'missing_value' };
  const history = differences(values, lag, 0, n - 1);
  const z = robustZ(x, history);
  if (z === null) return { ...out, history: history.length, reason: 'no_spread' };
  return { ...out, label: normalRange(z), basis, z, history: history.length };
}

/** The ranking score for a key change (analytics-spec §7). */
export function scoreKeyChange(input: {
  assessment: ChangeAssessment;
  importance: number;
  /** Share of the change held by the top segment; 0 until T41 works it out. */
  topShare?: number;
}): number {
  const { assessment: a, importance, topShare = 0 } = input;
  const w = KEY_CHANGE_WEIGHTS;
  const zTerm = a.z === null ? 0 : Math.min(Math.abs(a.z) / KEY_CHANGE_Z_FULL, 1);
  const size = a.points
    ? a.change === null
      ? 0
      : Math.min(Math.abs(a.change) / KEY_CHANGE_POINTS_FULL, 1)
    : a.pct === null
      ? 0
      : Math.min(Math.abs(a.pct) / KEY_CHANGE_PCT_FULL, 1);
  return (
    w.z * zTerm +
    w.size * size +
    w.importance * importance +
    w.topShare * Math.min(Math.abs(topShare), 1)
  );
}

export interface KeyChangeOptions {
  /** Defaults to the time column's default grain. */
  grain?: Grain;
  /** 0 is the latest complete period, 1 the one before, and so on. */
  offset?: number;
}

async function run(
  id: string,
  input: QuerySpecInput,
  model: SemanticModel,
  engine: QueryEngine,
  time: TimeFacts,
): Promise<FindingQuery> {
  const spec: QuerySpec = querySpecSchema.parse(input);
  const compiled: Compiled = compile(spec, model, { time });
  const result: QueryResult = await withTimeout(engine.query(compiled.sql, compiled.params));
  return { id, spec, compiled, result };
}

function fact(query: FindingQuery, row: number, column: string): FindingFact {
  const index = query.compiled.columns.findIndex((c) => c.name === column);
  return { query: query.id, cell: { row, column }, value: query.result.rows[row]?.[index] ?? null };
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Key changes for every metric in the dictionary, highest score first.
 * Empty when the data has no time column or no complete period.
 */
export async function keyChanges(
  model: SemanticModel,
  engine: QueryEngine,
  time: TimeFacts | null,
  options: KeyChangeOptions = {},
): Promise<KeyChange[]> {
  if (!model.time || !time || time.days.length === 0) return [];
  const grain = options.grain ?? model.time.defaultGrain;
  const latest = currentPeriod(grain, time);
  if (!latest) return [];
  const offset = options.offset ?? 0;
  const target = addPeriods(latest, grain, -offset);
  const start = periodStart(firstDay(time), grain);
  if (target < start) return [];
  const periods: string[] = [];
  for (let p = start; p <= target; p = addPeriods(p, grain, 1)) periods.push(p);
  const hasPrevious = periods.length > 1;

  const out: KeyChange[] = [];
  for (const metric of model.metrics) {
    const series = await run(
      'series',
      {
        metrics: [metric.id],
        time: { grain, range: { kind: 'absolute', from: start, to: periodEnd(target, grain) } },
      },
      model,
      engine,
      time,
    );
    const byPeriod = new Map(
      series.result.rows.map((r) => [String(r[0]).slice(0, 10), asNumber(r[1])]),
    );
    const values = periods.map((p) => byPeriod.get(p) ?? null);
    const assessment = assessChange(values, grain, metric.format.style === 'percent');

    const queries = [series];
    const facts: Record<string, FindingFact> = {};
    if (hasPrevious) {
      const compare = await run(
        'compare',
        {
          metrics: [metric.id],
          time: { range: { kind: 'period', grain, offset } },
          compare: 'previous_period',
        },
        model,
        engine,
        time,
      );
      queries.push(compare);
      facts.current = fact(compare, 0, metric.id);
      facts.previous = fact(compare, 0, `${metric.id}__previous`);
      facts.change = fact(compare, 0, `${metric.id}__change`);
      facts.change_pct = fact(compare, 0, `${metric.id}__change_pct`);
    } else {
      const row = series.result.rows.length - 1;
      if (row >= 0) facts.current = fact(series, row, metric.id);
    }

    out.push({
      id: `key_change:${metric.id}:${target}`,
      kind: 'key_change',
      metric: metric.id,
      period: {
        grain,
        current: { from: target, to: periodEnd(target, grain) },
        previous: hasPrevious
          ? { from: periods[periods.length - 2], to: periodEnd(periods[periods.length - 2], grain) }
          : null,
      },
      facts,
      queries,
      score: scoreKeyChange({ assessment, importance: metric.importance }),
      assessment,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
