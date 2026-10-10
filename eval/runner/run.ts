// The eval runner (evals.md §6): asks an answerer every golden question on
// the Node engine, scores each reply, and writes `eval/results/<mode>-<set>.json`
// and the `summary.json` the accuracy page reads.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { Cell, QueryEngine } from '@/core/engine/types';
import type { SemanticModel } from '@/core/model/types';
import { parseModelYaml } from '@/core/model/yaml';
import { withTimeout } from '@/core/query/guard';
import { CATEGORIES, type Category, type Dataset, type LoadedGolden, type Split } from './goldens';
import {
  type Headline,
  type Label,
  type Outcome,
  type Scored,
  type Via,
  headline,
  score,
} from './score';

export const MODES = ['keyless', 'ai', 'baseline'] as const;
export type Mode = (typeof MODES)[number];

/** What an answerer is given: the question's dataset, and nothing about the golden. */
export interface DatasetContext {
  dataset: Dataset;
  table: string;
  engine: QueryEngine;
  model: SemanticModel;
}

export interface Reply {
  outcome: Outcome;
  modelCalls?: number;
  /** Polished sentences tried and rejected by the grounding check (ai mode). */
  polish?: { attempted: number; rejected: number };
}

export interface Answerer {
  mode: Mode;
  /** The model behind the answers; null when no model is called. */
  modelId: string | null;
  answer(question: string, context: DatasetContext): Promise<Reply>;
}

const truthSchema = z.object({
  table: z.string(),
  effects: z.array(z.object({ id: z.string(), realised: z.record(z.string(), z.number()) })),
});
type Truth = z.infer<typeof truthSchema>;

export interface OpenDataset extends DatasetContext {
  truth: Truth;
}

export const DEMO_DIR = join(process.cwd(), 'data', 'demo');

/** Loads each sample into its own Node engine, with its dictionary and truth file. */
export async function openDatasets(datasets: readonly Dataset[], dir = DEMO_DIR) {
  const out = new Map<Dataset, OpenDataset>();
  for (const dataset of datasets) {
    const truth = truthSchema.parse(
      JSON.parse(readFileSync(join(dir, dataset, 'truth.json'), 'utf8')),
    );
    const parsed = parseModelYaml(readFileSync(join(dir, dataset, 'dictionary.yaml'), 'utf8'));
    if (!parsed.ok) throw new Error(`${dataset}: ${JSON.stringify(parsed.problems)}`);
    const engine = await createNodeEngine();
    await engine.registerFile(truth.table, {
      kind: 'path',
      format: 'parquet',
      path: join(dir, dataset, `${truth.table}.parquet`),
    });
    out.set(dataset, { dataset, table: truth.table, engine, model: parsed.model, truth });
  }
  return out;
}

/**
 * The realised share of a change, from the one `*share*` figure the effect
 * records in truth.json; null when it records none, and then a change is
 * scored on its path alone (D-041).
 */
export function realisedShare(truth: Truth, effectId: string): number | null {
  const effect = truth.effects.find((e) => e.id === effectId);
  if (!effect) throw new Error(`truth.json has no effect ${effectId}`);
  const shares = Object.entries(effect.realised).filter(([key]) => key.includes('share'));
  return shares.length === 1 ? shares[0][1] : null;
}

/** A result kept in the record: its column names and the first rows. */
const KEPT_ROWS = 20;

type StoredOutcome =
  | Exclude<Outcome, { kind: 'answer' }>
  | {
      kind: 'answer';
      via: Via;
      sql: string;
      result: { columns: string[]; rows: Cell[][]; rowCount: number };
    };

export interface QuestionRecord extends Scored {
  id: string;
  dataset: Dataset;
  split: Split;
  question: string;
  reason: string | null;
  outcome: StoredOutcome | null;
  error: string | null;
  elapsedMs: number;
}

function store(outcome: Outcome): StoredOutcome {
  if (outcome.kind !== 'answer') return outcome;
  const { result } = outcome;
  return {
    ...outcome,
    result: {
      columns: result.columns.map((c) => c.name),
      rows: result.rows.slice(0, KEPT_ROWS),
      rowCount: result.rows.length,
    },
  };
}

export const QUESTION_TIMEOUT_MS = 60_000;

export async function runEval(
  answerer: Answerer,
  goldens: readonly LoadedGolden[],
  datasets: Map<Dataset, OpenDataset>,
  {
    timeoutMs = QUESTION_TIMEOUT_MS,
    onRecord,
  }: { timeoutMs?: number; onRecord?: (r: QuestionRecord) => void } = {},
): Promise<QuestionRecord[]> {
  const records: QuestionRecord[] = [];
  for (const golden of goldens) {
    const context = datasets.get(golden.dataset);
    if (!context) throw new Error(`${golden.id}: dataset ${golden.dataset} is not open`);
    const { truth, ...given } = context;
    const base = {
      id: golden.id,
      dataset: golden.dataset,
      split: golden.split,
      category: golden.category,
      expect: golden.expect,
      question: golden.question,
    };
    const start = performance.now();
    let reply: Reply;
    try {
      reply = await withTimeout(answerer.answer(golden.question, given), timeoutMs);
    } catch (e) {
      const record: QuestionRecord = {
        ...base,
        kind: 'error',
        via: null,
        label: 'error',
        reason: 'the answerer failed',
        outcome: null,
        error: e instanceof Error ? e.message : String(e),
        modelCalls: 0,
        polish: null,
        elapsedMs: Math.round(performance.now() - start),
      };
      records.push(record);
      onRecord?.(record);
      continue;
    }
    const elapsedMs = Math.round(performance.now() - start);
    const { outcome } = reply;

    // Expected results are computed here, from the hand-written reference.
    const reference =
      golden.expect === 'answer' && outcome.kind === 'answer'
        ? await context.engine.query(golden.reference_sql)
        : undefined;
    const share = golden.expect === 'change' ? realisedShare(truth, golden.truth) : undefined;
    const { label, reason } = score(golden, outcome, { reference, share });

    const record: QuestionRecord = {
      ...base,
      kind: outcome.kind,
      via: outcome.kind === 'answer' || outcome.kind === 'change' ? outcome.via : null,
      label,
      reason,
      outcome: store(outcome),
      error: null,
      modelCalls: reply.modelCalls ?? 0,
      polish: reply.polish ?? null,
      elapsedMs,
    };
    records.push(record);
    onRecord?.(record);
  }
  return records;
}

export interface RunFile {
  mode: Mode;
  set: Split;
  runAt: string;
  commit: string;
  /** Uncommitted changes outside eval/results when the run started. */
  dirty: boolean;
  modelId: string | null;
  engineVersion: string;
  headline: Headline;
  byCategory: Partial<Record<Category, Headline>>;
  byDataset: Partial<Record<Dataset, Headline>>;
  records: QuestionRecord[];
}

function groupHeadlines<K extends string>(
  records: QuestionRecord[],
  key: (r: QuestionRecord) => K,
) {
  const out: Partial<Record<K, Headline>> = {};
  for (const k of [...new Set(records.map(key))]) {
    out[k] = headline(records.filter((r) => key(r) === k));
  }
  return out;
}

export function gitState(): { commit: string; dirty: boolean } {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const changed = git('status', '--porcelain', '--', '.', ':(exclude)eval/results');
  return { commit: git('rev-parse', '--short', 'HEAD'), dirty: changed !== '' };
}

export function buildRunFile(
  info: Omit<RunFile, 'headline' | 'byCategory' | 'byDataset' | 'records'>,
  records: QuestionRecord[],
): RunFile {
  const order = (c: Category) => CATEGORIES.indexOf(c);
  const sorted = [...records].sort((a, b) => order(a.category) - order(b.category));
  return {
    ...info,
    headline: headline(records),
    byCategory: groupHeadlines(sorted, (r) => r.category),
    byDataset: groupHeadlines(records, (r) => r.dataset),
    records,
  };
}

export const RESULTS_DIR = join(process.cwd(), 'eval', 'results');
const RUN_FILE = /^(keyless|ai|baseline)-(dev|holdout)\.json$/;

export interface Summary {
  runs: Array<
    Omit<RunFile, 'records'> & {
      /** The questions not answered correctly; null for holdout, whose failures are not read (§3.2). */
      notCorrect: Array<{
        id: string;
        dataset: Dataset;
        category: Category;
        question: string;
        label: Label;
        reason: string | null;
      }> | null;
    }
  >;
}

/** The summary of every run file present, so one mode's run keeps the others. */
export function buildSummary(runs: RunFile[]): Summary {
  const key = (r: RunFile) => MODES.indexOf(r.mode) * 2 + (r.set === 'dev' ? 0 : 1);
  return {
    runs: [...runs]
      .sort((a, b) => key(a) - key(b))
      .map(({ records, ...run }) => ({
        ...run,
        notCorrect:
          run.set === 'holdout'
            ? null
            : records
                .filter((r) => r.label !== 'correct')
                .map(({ id, dataset, category, question, label, reason }) => ({
                  id,
                  dataset,
                  category,
                  question,
                  label,
                  reason,
                })),
      })),
  };
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** Writes the run's file, then rebuilds summary.json from every run file present. */
export function writeResults(run: RunFile, dir = RESULTS_DIR): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${run.mode}-${run.set}.json`);
  writeFileSync(path, json(run));
  const runs = readdirSync(dir)
    .filter((f) => RUN_FILE.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RunFile);
  writeFileSync(join(dir, 'summary.json'), json(buildSummary(runs)));
  return path;
}
