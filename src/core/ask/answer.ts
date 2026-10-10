// An answer to one question (FR-40 to FR-42): compile the spec, run it,
// check the result, choose a chart and write the sentence. Everything the
// answer view and its working paper show comes from here, so the SQL shown
// is the SQL that ran and every number in the sentence names its cell.

import type { Cell, QueryEngine, QueryResult } from '@/core/engine/types';
import type { TimeFacts } from '@/core/findings/periods';
import type { SemanticModel } from '@/core/model/types';
import { type Sentence, inSentence, writeSentence } from '@/core/narrative/answer-sentence';
import { type ChartPlan, chooseChart } from '@/core/narrative/chart';
import { rangeWords } from '@/core/narrative/period-words';
import { quoteColumn } from '@/core/profile/profile';
import { type ResultCheck, checkResult } from '@/core/query/checks';
import { type Compiled, CompileError, HELPERS, compile, displaySql } from '@/core/query/compile';
import { withTimeout } from '@/core/query/guard';
import { type QuerySpec, querySpecSchema } from '@/core/query/spec';

/** One part of the interpretation row: "Metric Revenue", "Period March 2025". */
export interface Part {
  label: string;
  value: string;
  /** Footnote chose this part; the question did not state it. */
  assumed: boolean;
}

export interface Answer {
  question: string;
  spec: QuerySpec;
  interpretation: Part[];
  /** Period and filters in words, for the working paper. */
  scope: string[];
  compiled: Compiled;
  result: QueryResult;
  checks: ResultCheck[];
  /** The first failed check. When set, it is shown instead of the sentence. */
  problem: ResultCheck | null;
  sentence: Sentence;
  chart: ChartPlan;
}

export type AnswerOutcome =
  { ok: true; answer: Answer } | { ok: false; question: string; message: string };

export interface AnswerInput {
  engine: QueryEngine;
  model: SemanticModel;
  time: TimeFacts | null;
  question: string;
  /** A QuerySpec, checked here: a starter's spec is plain data from the dictionary. */
  spec: unknown;
  /** The step in words, for the progress line. */
  onStep?: (step: string) => void;
}

export async function runAnswer(input: AnswerInput): Promise<AnswerOutcome> {
  const { engine, model, time, question } = input;
  const parsed = querySpecSchema.safeParse(input.spec);
  if (!parsed.success) {
    return { ok: false, question, message: parsed.error.issues[0].message };
  }
  const spec = parsed.data;
  let compiled: Compiled;
  try {
    compiled = compile(spec, model, { time });
  } catch (error) {
    if (error instanceof CompileError) return { ok: false, question, message: error.message };
    throw error;
  }
  let result: QueryResult;
  input.onStep?.('Running the query');
  try {
    result = await withTimeout(engine.query(compiled.sql, compiled.params));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, question, message: `The query did not finish: ${message}` };
  }
  input.onStep?.('Checking the result');
  const checks = await checkResult({ engine, model, spec, compiled, result, time });
  const problem = checks.find((c) => c.outcome === 'fail') ?? null;
  const sentence = problem
    ? { segments: [], facts: [] }
    : writeSentence({ spec, model, compiled, result, time });
  return {
    ok: true,
    answer: {
      question,
      spec,
      interpretation: interpret(spec, model, compiled),
      scope: scopeWords(spec, model, compiled),
      compiled,
      result,
      checks,
      problem,
      sentence,
      chart: chooseChart(spec, { columns: compiled.columns, rows: result.rows }),
    },
  };
}

const GRAIN_WORDS = { day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year' };

function filterWords(spec: QuerySpec, model: SemanticModel): string[] {
  return spec.filters.map((f) => {
    const label = model.dimensions.find((d) => d.id === f.dimension)?.label ?? f.dimension;
    const values = f.values.join(' or ');
    if (f.op === 'contains') return `${label} contains ${values}`;
    return `${label} is ${f.op === 'not_in' ? 'not ' : ''}${values}`;
  });
}

/** The parts Footnote understood, as the interpretation row shows them (ui-ux-rules §6). */
export function interpret(spec: QuerySpec, model: SemanticModel, compiled: Compiled): Part[] {
  const label = (id: string) =>
    model.metrics.find((m) => m.id === id)?.label ??
    model.dimensions.find((d) => d.id === id)?.label ??
    id;
  const parts: Part[] = [
    { label: 'Metric', value: spec.metrics.map(label).join(', '), assumed: false },
  ];
  if (spec.by.length) {
    parts.push({ label: 'Split by', value: spec.by.map(label).join(', '), assumed: false });
  }
  if (spec.time?.grain) {
    parts.push({ label: 'Over time', value: GRAIN_WORDS[spec.time.grain], assumed: false });
  }
  parts.push({
    label: 'Period',
    value: compiled.range ? rangeWords(compiled.range) : 'All the data',
    assumed: false,
  });
  if (spec.compare && compiled.comparison) {
    parts.push({
      label: 'Compared with',
      value: `${spec.compare === 'previous_period' ? 'Previous period' : 'Same period last year'}, ${rangeWords(compiled.comparison)}`,
      assumed: false,
    });
  }
  for (const words of filterWords(spec, model)) {
    parts.push({ label: 'Only', value: words, assumed: false });
  }
  if (spec.sort) {
    const high = spec.sort.dir === 'desc';
    const isMetric = spec.metrics.includes(spec.sort.by);
    parts.push({
      label: 'Sorted by',
      value: `${label(spec.sort.by)}, ${isMetric ? (high ? 'highest first' : 'lowest first') : high ? 'Z to A' : 'A to Z'}`,
      assumed: false,
    });
  }
  if (spec.limit) parts.push({ label: 'Showing', value: `First ${spec.limit}`, assumed: false });
  return parts;
}

/** Period and filters as sentences, for the working paper's scope. */
export function scopeWords(spec: QuerySpec, model: SemanticModel, compiled: Compiled): string[] {
  const lines: string[] = [];
  const days = (r: { from: string; to: string }) =>
    r.from === r.to ? r.from : `${r.from} to ${r.to}`;
  if (!model.time || !compiled.range) {
    lines.push(`All rows of the ${model.table} table.`);
  } else {
    const r = compiled.range;
    lines.push(`Rows dated ${rangeWords(r)} by ${model.time.column} (${days(r)}).`);
    const c = compiled.comparison;
    if (c) lines.push(`Compared with ${rangeWords(c)} (${days(c)}).`);
  }
  const filters = filterWords(spec, model);
  lines.push(filters.length ? `Only rows where ${filters.join(' and ')}.` : 'No filters.');
  const per = spec.by.map((d) => inSentence(model.dimensions.find((x) => x.id === d)!.label));
  if (spec.time?.grain) per.push(spec.time.grain);
  if (per.length) lines.push(`One result row per ${per.join(' and ')}.`);
  return lines;
}

// ------------------------------------------------------- rows behind it

export interface RowsBehind {
  /** Five sample rows. */
  sample: { sql: string; params: Cell[]; display: string };
  /** How many rows there are. */
  count: { sql: string; params: Cell[]; display: string };
}

export const SAMPLE_ROWS = 5;

/**
 * The statements that read the rows behind one cell: the answer's base rows
 * narrowed to that cell's split values, period and side of the comparison.
 * A change looks at both sides.
 */
export function rowsBehind(
  answer: Answer,
  model: SemanticModel,
  row: number,
  column: string,
): RowsBehind {
  const { compiled, result, spec } = answer;
  const index = new Map(compiled.columns.map((c, i) => [c.name, i]));
  const kind = compiled.columns.find((c) => c.name === column)?.kind;
  const params: Cell[] = [...compiled.base.params];
  const where: string[] = [];
  for (const d of spec.by) {
    const dim = model.dimensions.find((x) => x.id === d)!;
    const value = result.rows[row][index.get(d)!];
    if (value === null) where.push(`${quoteColumn(dim.column)} IS NULL`);
    else {
      where.push(`CAST(${quoteColumn(dim.column)} AS VARCHAR) = ?`);
      params.push(String(value));
    }
  }
  if (spec.time?.grain) {
    where.push(`${quoteColumn('_period')} = CAST(? AS DATE)`);
    params.push(String(result.rows[row][index.get('period')!]));
  }
  if (compiled.base.compared && (kind === 'metric' || kind === 'previous')) {
    where.push(`${quoteColumn('_side')} = '${kind === 'metric' ? 'current' : 'previous'}'`);
  }
  // The helper columns the compiler added are left out of the sample.
  const helpers = HELPERS.filter((h) => compiled.base.cte.includes(`AS ${quoteColumn(h)}`));
  const exclude = helpers.length ? ` EXCLUDE (${helpers.map(quoteColumn).join(', ')})` : '';
  const filter = where.length ? `\nWHERE ${where.join('\n  AND ')}` : '';
  const sample = `WITH ${compiled.base.cte}\nSELECT *${exclude}\nFROM base${filter}\nLIMIT ${SAMPLE_ROWS}`;
  const count = `WITH ${compiled.base.cte}\nSELECT CAST(count(*) AS BIGINT) AS n\nFROM base${filter}`;
  return {
    sample: { sql: sample, params, display: displaySql(sample, params) },
    count: { sql: count, params, display: displaySql(count, params) },
  };
}
