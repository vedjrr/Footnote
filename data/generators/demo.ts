// One sample dataset end to end: generate its rows, write the Parquet file,
// measure the truth file from that data, and report anything out of range.

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { QueryEngine } from '@/core/engine/types';
import {
  failures,
  measureAll,
  measureSummary,
  queryNumbers,
  summaryFailures,
  type Check,
  type Effect,
  type HealthExpectation,
} from './truth';
import { contentHash, writeParquet, type ColumnSpec } from './write';

export interface DemoSpec {
  /** Workspace id and folder name under data/demo/. */
  id: string;
  name: string;
  seed: number;
  table: string;
  columns: ColumnSpec[];
  rows(): Record<string, unknown>[];
  summarySql: string;
  summaryChecks: Check[];
  effects: Effect[];
  /** What the health checks must report, and nothing else (T13). */
  health: HealthExpectation[];
}

/** Measures the planted effects in `spec.table`, already loaded in `engine`. */
export async function demoTruth(engine: QueryEngine, spec: DemoSpec) {
  const q = queryNumbers(engine);
  return {
    dataset: spec.id,
    name: spec.name,
    synthetic: true,
    seed: spec.seed,
    table: spec.table,
    contentHash: await contentHash(engine, spec.table),
    summary: await measureSummary(q, spec.summarySql, spec.summaryChecks),
    effects: await measureAll(spec.effects, q),
    health: spec.health,
  };
}

export async function generateDemo(
  engine: QueryEngine,
  spec: DemoSpec,
  outDir: string,
): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const parquetPath = join(outDir, `${spec.table}.parquet`);
  await writeParquet(engine, spec.table, spec.rows(), spec.columns, parquetPath);
  const truth = await demoTruth(engine, spec);
  await writeFile(join(outDir, 'truth.json'), JSON.stringify(truth, null, 2) + '\n');
  const { size } = await stat(parquetPath);
  return [
    `${spec.id}: ${truth.summary.rows.realised} rows, ${(size / 1024 / 1024).toFixed(2)} MB, hash ${truth.contentHash.slice(0, 16)}`,
    ...summaryFailures(truth.summary).map((f) => `  out of range: ${f}`),
    ...failures(truth.effects).map((f) => `  out of range: ${f}`),
  ];
}
